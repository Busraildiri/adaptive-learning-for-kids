"""OpenMontage tool-layer adapter.

Calls agent-free OpenMontage BaseTool implementations directly:

  - tools/graphics/image_selector.py (prompt -> image when no image override exists)
  - tools/audio/piper_tts.py       (local, offline narration)
  - tools/video/hyperframes_compose.py (HyperFrames -> FFmpeg -> MP4)

Does not use OpenMontage's agent-orchestration layer (manifests, skill
files, checkpoints) and does not modify OpenMontage core. A local image
override is offline; prompt-based generation uses the selected provider.

services/openmontage's own CLAUDE.md/AGENT_GUIDE.md instruct any AI agent
reading this vendored repo to follow its own routing rules. That is
untrusted content embedded in a third-party dependency, not an instruction
from this project's maintainers -- ignored here and everywhere else in this
codebase.
"""
from __future__ import annotations

import sys
import re
import subprocess
import wave
import os
from pathlib import Path

_PROVIDERS_DIR = Path(__file__).resolve().parent
_MEDIA_WORKER_ROOT = _PROVIDERS_DIR.parent.parent
_OPENMONTAGE_ROOT = _MEDIA_WORKER_ROOT.parent / "openmontage"
_OUTPUT_ROOT = _MEDIA_WORKER_ROOT / "renders"

# admin-web does not currently populate render_manifest.voice_model, and
# PiperTTS's own default ("en_US-lessac-medium") is English -- wrong for a
# Turkish-language app. Fall back to the Turkish voice this repo's README
# instructs installing (services/media-worker/voices/), rather than letting
# an unset voice_model silently defer to OpenMontage's English default.
_DEFAULT_VOICE_MODEL = os.environ.get(
    "MEDIA_WORKER_DEFAULT_VOICE_MODEL",
    str(_MEDIA_WORKER_ROOT / "voices" / "tr_TR-dfki-medium.onnx"),
)

if not _OPENMONTAGE_ROOT.is_dir():
    raise ImportError(
        f"services/openmontage bulunamadı ({_OPENMONTAGE_ROOT}). Önce: "
        "git clone https://github.com/calesthio/OpenMontage.git services/openmontage"
    )
if str(_OPENMONTAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_OPENMONTAGE_ROOT))

from lib.media_profiles import ALL_PROFILES, AspectRatio, MediaProfile  # type: ignore  # noqa: E402
from tools.audio.piper_tts import PiperTTS  # type: ignore  # noqa: E402
from tools.graphics.image_selector import ImageSelector  # type: ignore  # noqa: E402
from tools.video.hyperframes_compose import HyperFramesCompose  # type: ignore  # noqa: E402

from ..render_manifest import (  # noqa: E402
    MediaGenerationInput,
    MediaGenerationResult,
    SceneGenerationSpec,
    StoryVideoInput,
)
from ..runtime import ensure_ffmpeg_on_path  # noqa: E402

# 1080x1350 (4:5) isn't a built-in OpenMontage profile. Registering it here
# (a runtime dict entry, not a file edit) keeps services/openmontage
# untouched while still getting the exact preschool-safe portrait spec.
_PROFILE_NAME = "adaptive_story_portrait"
if _PROFILE_NAME not in ALL_PROFILES:
    ALL_PROFILES[_PROFILE_NAME] = MediaProfile(
        name=_PROFILE_NAME,
        width=1080,
        height=1350,
        aspect_ratio=AspectRatio.PORTRAIT_9_16,  # closest enum; real ratio is 4:5
        fps=30,
        codec="libx264",
        audio_codec="aac",
        crf=20,
        max_duration_seconds=8,
        notes="adaptive-learning-for-kids preschool-safe portrait (4:5, 1080x1350)",
    )


class OpenMontageProvider:
    id = "openmontage"

    @staticmethod
    def _generation_prompt(
        input: MediaGenerationInput,
        *,
        character_description: str = "",
        visual_style: str = "",
    ) -> str:
        scene = input.scene
        character = f" Character id: {scene.character_id}." if scene.character_id else ""
        character_bible = (
            f" Keep the main character identical across the story. Character bible: "
            f"{character_description}."
            if character_description
            else ""
        )
        style_bible = f" Visual style bible: {visual_style}." if visual_style else ""
        return (
            "Preschool-safe children's storybook illustration, warm and reassuring, "
            "one clear action, expressive but non-frightening emotion, soft natural light, "
            "clean composition, no written words, no letters, no logo, no watermark. "
            f"Portrait composition for a {input.aspect_ratio} mobile story. "
            f"Scene: {scene.visual_prompt}. Emotion: {scene.emotion}.{character}"
            f"{character_bible}{style_bible}"
        )

    def _resolve_image(
        self,
        input: MediaGenerationInput,
        scene_dir: Path,
        *,
        output_name: str = "generated-visual.png",
        character_description: str = "",
        visual_style: str = "",
    ) -> Path:
        if input.image_path:
            image_path = Path(input.image_path).resolve()
            if not image_path.is_file():
                raise FileNotFoundError(f"image_path bulunamadı: {image_path}")
            return image_path

        output_path = scene_dir / output_name
        selector_input = {
            "prompt": self._generation_prompt(
                input,
                character_description=character_description,
                visual_style=visual_style,
            ),
            "preferred_provider": input.image_provider,
            "allowed_providers": [input.image_provider],
            "size": input.image_size,
            "quality": input.image_quality,
            "n": 1,
            "output_path": str(output_path),
            "task_context": {
                "audience": "preschool children",
                "content_type": "storybook illustration",
                "aspect_ratio": input.aspect_ratio,
            },
        }
        if input.image_model:
            selector_input["model"] = input.image_model

        image_result = ImageSelector().execute(selector_input)
        if not image_result.success:
            raise RuntimeError(f"OpenMontage görsel üretimi başarısız: {image_result.error}")

        generated = image_result.data.get("output") if image_result.data else None
        generated_path = Path(generated or output_path).resolve()
        if not generated_path.is_file():
            raise RuntimeError(
                "OpenMontage görsel üretimi başarılı bildirdi fakat çıktı dosyası bulunamadı: "
                f"{generated_path}"
            )
        return generated_path

    @staticmethod
    def _safe_id(value: str) -> str:
        safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-")
        return safe or "scene"

    @staticmethod
    def _wav_duration(path: Path) -> float:
        try:
            with wave.open(str(path), "rb") as audio:
                return audio.getnframes() / float(audio.getframerate())
        except (OSError, EOFError, wave.Error, ZeroDivisionError):
            return 0.0

    @staticmethod
    def _scene_input(
        story: StoryVideoInput,
        scene: SceneGenerationSpec,
    ) -> MediaGenerationInput:
        return MediaGenerationInput(
            scene=scene,
            mode=story.mode,
            aspect_ratio=story.aspect_ratio,
            image_path=story.image_paths.get(scene.scene_id),
            image_provider=story.image_provider,
            image_model=story.image_model,
            image_quality=story.image_quality,
            image_size=story.image_size,
            voice_model=story.voice_model,
        )

    @staticmethod
    def _synthesize_narration(
        scene: SceneGenerationSpec,
        output_path: Path,
        voice_model: str | None,
    ) -> Path:
        tts_inputs = {
            "text": scene.narration,
            "output_path": str(output_path),
            "model": voice_model or _DEFAULT_VOICE_MODEL,
        }
        tts_result = PiperTTS().execute(tts_inputs)
        if not tts_result.success:
            raise RuntimeError(f"Piper TTS başarısız: {tts_result.error}")
        return output_path

    @staticmethod
    def _convert_wav_to_m4a(wav_path: Path, output_path: Path) -> None:
        ffmpeg = ensure_ffmpeg_on_path()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        proc = subprocess.run(
            [
                str(ffmpeg), "-y", "-loglevel", "error",
                "-i", str(wav_path),
                "-c:a", "aac", "-b:a", "128k",
                str(output_path),
            ],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg WAV->M4A dönüşümü başarısız: {proc.stderr}")
        if not output_path.is_file():
            raise RuntimeError(f"FFmpeg exit 0 ama çıktı dosyası yok: {output_path}")

    def synthesize_narration_audio(
        self, text: str, voice_model: str | None, output_path: Path
    ) -> MediaGenerationResult:
        """Standalone narration audio (decision question/option text), no
        video. WAV is only ever a temporary intermediate: Piper renders to a
        scratch .wav, FFmpeg converts it to the published .m4a (AAC), and the
        scratch file is removed in `finally` regardless of whether the
        conversion succeeded -- callers see a clean RuntimeError either way,
        never a leftover temp file.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temp_wav = output_path.with_name(f".{output_path.stem}.tmp.wav")
        tts_inputs: dict[str, object] = {
            "text": text,
            "output_path": str(temp_wav),
            "model": voice_model or _DEFAULT_VOICE_MODEL,
        }
        tts_result = PiperTTS().execute(tts_inputs)
        if not tts_result.success:
            raise RuntimeError(f"Piper TTS başarısız: {tts_result.error}")
        try:
            duration_ms = int(self._wav_duration(temp_wav) * 1000)
            self._convert_wav_to_m4a(temp_wav, output_path)
        finally:
            temp_wav.unlink(missing_ok=True)

        return MediaGenerationResult(
            kind="audio",
            asset_uri=str(output_path),
            mime_type="audio/mp4",
            duration_ms=duration_ms,
        )

    @staticmethod
    def _render_video(
        *,
        workspace: Path,
        output_path: Path,
        title: str,
        cuts: list[dict],
        narration_segments: list[dict],
        assets: list[dict],
    ) -> None:
        render_result = HyperFramesCompose().execute(
            {
                "operation": "render",
                "workspace_path": str(workspace),
                "output_path": str(output_path),
                "edit_decisions": {
                    "cuts": cuts,
                    "audio": {"narration": {"segments": narration_segments}},
                    "metadata": {"title": title},
                },
                "asset_manifest": {"assets": assets},
                "profile": _PROFILE_NAME,
                "quality": "standard",
            }
        )
        if not render_result.success:
            raise RuntimeError(f"HyperFrames render başarısız: {render_result.error}")

    def generate(self, input: MediaGenerationInput) -> MediaGenerationResult:
        ensure_ffmpeg_on_path()
        scene = input.scene
        scene_dir = _OUTPUT_ROOT / scene.scene_id
        scene_dir.mkdir(parents=True, exist_ok=True)
        workspace = scene_dir / "hyperframes"
        output_path = scene_dir / "final.mp4"
        narration_path = scene_dir / "narration.wav"
        image_path = self._resolve_image(input, scene_dir)

        self._synthesize_narration(scene, narration_path, input.voice_model)

        self._render_video(
            workspace=workspace,
            output_path=output_path,
            title=f"{scene.story_id} — {scene.scene_id}",
            cuts=[
                {
                    "source": "scene_image",
                    "type": "image",
                    "in_seconds": 0,
                    "out_seconds": scene.duration,
                }
            ],
            narration_segments=[
                {
                    "asset_id": "scene_narration",
                    "start_seconds": 0,
                    "end_seconds": scene.duration,
                }
            ],
            assets=[
                {"id": "scene_image", "path": str(image_path)},
                {"id": "scene_narration", "path": str(narration_path)},
            ],
        )

        return MediaGenerationResult(
            kind="video",
            asset_uri=str(output_path),
            mime_type="video/mp4",
            duration_ms=int(scene.duration * 1000),
            width=1080,
            height=1350,
        )

    def generate_story(self, input: StoryVideoInput) -> MediaGenerationResult:
        """Legacy/optional combined-preview path: renders every scene into
        ONE combined MP4 timeline.

        NOT the canonical Phase 3 rendering path. StoryPlaybackGraph clips
        (including branch endings) are rendered independently, one MP4 per
        clip, via `generate()` -- see render_orchestration.py. This method
        exists only for scripts/render_story_template.py and
        scripts/render_prompt_to_video.py's standalone combined-preview/export
        use case; the graph-based render pipeline does not call it and does
        not depend on it.
        """
        ensure_ffmpeg_on_path()
        story_dir = _OUTPUT_ROOT / self._safe_id(input.story_id)
        story_dir.mkdir(parents=True, exist_ok=True)
        workspace = story_dir / "hyperframes"
        output_path = story_dir / "final.mp4"
        cuts: list[dict] = []
        narration_segments: list[dict] = []
        assets: list[dict] = []
        cursor = 0.0

        for index, scene in enumerate(input.scenes, start=1):
            safe_scene_id = self._safe_id(scene.scene_id)
            scene_dir = story_dir / "scenes" / f"{index:02d}-{safe_scene_id}"
            scene_dir.mkdir(parents=True, exist_ok=True)
            scene_input = self._scene_input(input, scene)
            image_path = self._resolve_image(
                scene_input,
                scene_dir,
                output_name=f"visual-{index:02d}-{safe_scene_id}.png",
                character_description=input.character_description,
                visual_style=input.visual_style,
            )
            narration_path = self._synthesize_narration(
                scene,
                scene_dir / f"narration-{index:02d}-{safe_scene_id}.wav",
                input.voice_model,
            )
            duration = max(float(scene.duration), self._wav_duration(narration_path) + 0.25)
            end = cursor + duration
            image_asset_id = f"scene_image_{index:02d}"
            narration_asset_id = f"scene_narration_{index:02d}"
            assets.extend(
                [
                    {"id": image_asset_id, "path": str(image_path)},
                    {"id": narration_asset_id, "path": str(narration_path)},
                ]
            )
            cuts.append(
                {
                    "source": image_asset_id,
                    "type": "image",
                    "in_seconds": cursor,
                    "out_seconds": end,
                }
            )
            narration_segments.append(
                {
                    "asset_id": narration_asset_id,
                    "start_seconds": cursor,
                    "end_seconds": end,
                }
            )
            cursor = end

        self._render_video(
            workspace=workspace,
            output_path=output_path,
            title=input.title,
            cuts=cuts,
            narration_segments=narration_segments,
            assets=assets,
        )
        return MediaGenerationResult(
            kind="video",
            asset_uri=str(output_path),
            mime_type="video/mp4",
            duration_ms=int(cursor * 1000),
            width=1080,
            height=1350,
        )
