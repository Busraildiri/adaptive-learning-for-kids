from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from media_worker.providers import openmontage_provider as provider_module
from media_worker.render_manifest import media_generation_input_from_dict, story_video_input_from_dict


def manifest(**overrides: object) -> dict:
    value = {
        "scene": {
            "sceneId": "scene-test",
            "storyId": "story-test",
            "emotion": "happy",
            "event": "greeting",
            "narration": "Mırmır kırmızı balonuyla oynuyor.",
            "visualPrompt": "Mırmır parkta kırmızı balonuyla neşeyle oynuyor.",
            "duration": 5,
        },
        "mode": "local_animation",
        "aspectRatio": "4:5",
        "imageProvider": "openai",
        "imageQuality": "low",
        "imageSize": "1024x1536",
    }
    value.update(overrides)
    return value


class FakeImageSelector:
    last_input: dict | None = None
    inputs: list[dict] = []

    def execute(self, inputs: dict) -> SimpleNamespace:
        self.__class__.last_input = inputs
        self.__class__.inputs.append(inputs)
        output = Path(inputs["output_path"])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"generated-image")
        return SimpleNamespace(success=True, error=None, data={"output": str(output)})


class FakePiper:
    inputs: list[dict] = []

    def execute(self, inputs: dict) -> SimpleNamespace:
        self.__class__.inputs.append(inputs)
        Path(inputs["output_path"]).write_bytes(b"audio")
        return SimpleNamespace(success=True, error=None)


class FakeHyperFrames:
    last_input: dict | None = None

    def execute(self, inputs: dict) -> SimpleNamespace:
        self.__class__.last_input = inputs
        Path(inputs["output_path"]).write_bytes(b"video")
        return SimpleNamespace(success=True, error=None)


class OpenMontageProviderTests(unittest.TestCase):
    def test_generates_visual_from_scene_prompt_before_tts_and_render(self) -> None:
        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(provider_module, "_OUTPUT_ROOT", Path(temp_dir)),
            patch.object(provider_module, "ImageSelector", FakeImageSelector),
            patch.object(provider_module, "PiperTTS", FakePiper),
            patch.object(provider_module, "HyperFramesCompose", FakeHyperFrames),
            patch.object(provider_module, "ensure_ffmpeg_on_path"),
        ):
            result = provider_module.OpenMontageProvider().generate(
                media_generation_input_from_dict(manifest())
            )

        self.assertEqual(result.kind, "video")
        self.assertIn("Mırmır parkta", FakeImageSelector.last_input["prompt"])
        self.assertEqual(FakeImageSelector.last_input["preferred_provider"], "openai")
        self.assertEqual(FakeImageSelector.last_input["quality"], "low")
        self.assertEqual(FakeImageSelector.last_input["size"], "1024x1536")
        image_asset = FakeHyperFrames.last_input["asset_manifest"]["assets"][0]
        self.assertTrue(image_asset["path"].endswith("generated-visual.png"))

    def test_local_image_override_skips_paid_image_generation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            image = Path(temp_dir) / "existing.png"
            image.write_bytes(b"existing-image")
            with (
                patch.object(provider_module, "_OUTPUT_ROOT", Path(temp_dir) / "renders"),
                patch.object(provider_module, "ImageSelector") as selector,
                patch.object(provider_module, "PiperTTS", FakePiper),
                patch.object(provider_module, "HyperFramesCompose", FakeHyperFrames),
                patch.object(provider_module, "ensure_ffmpeg_on_path"),
            ):
                provider_module.OpenMontageProvider().generate(
                    media_generation_input_from_dict(manifest(imagePath=str(image)))
                )

        selector.assert_not_called()
        image_asset = FakeHyperFrames.last_input["asset_manifest"]["assets"][0]
        self.assertEqual(Path(image_asset["path"]), image.resolve())

    def test_complete_story_template_becomes_one_timeline(self) -> None:
        story = story_video_input_from_dict(
            {
                "storyId": "mirmir-story",
                "title": "Mırmır'ın Hikâyesi",
                "characterDescription": "A consistent orange tabby kitten",
                "visualStyle": "soft 3D children's animation",
                "scenes": [
                    {
                        "sceneId": "start",
                        "emotion": "happy",
                        "event": "start",
                        "narration": "Mırmır oynuyor.",
                        "visualPrompt": "Mırmır plays with a red balloon.",
                        "duration": 4,
                    },
                    {
                        "sceneId": "ending",
                        "emotion": "happy",
                        "event": "ending",
                        "narration": "Mırmır gülümsüyor.",
                        "visualPrompt": "Mırmır smiles with the balloon.",
                        "duration": 5,
                    },
                ],
            }
        )
        FakeImageSelector.inputs = []
        FakePiper.inputs = []
        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(provider_module, "_OUTPUT_ROOT", Path(temp_dir)),
            patch.object(provider_module, "ImageSelector", FakeImageSelector),
            patch.object(provider_module, "PiperTTS", FakePiper),
            patch.object(provider_module, "HyperFramesCompose", FakeHyperFrames),
            patch.object(provider_module, "ensure_ffmpeg_on_path"),
        ):
            result = provider_module.OpenMontageProvider().generate_story(story)

        self.assertEqual(result.duration_ms, 9000)
        self.assertEqual(len(FakeImageSelector.inputs), 2)
        self.assertEqual(len(FakePiper.inputs), 2)
        self.assertIn("consistent orange tabby", FakeImageSelector.inputs[0]["prompt"])
        render = FakeHyperFrames.last_input
        self.assertEqual(
            render["edit_decisions"]["cuts"],
            [
                {
                    "source": "scene_image_01",
                    "type": "image",
                    "in_seconds": 0.0,
                    "out_seconds": 4.0,
                },
                {
                    "source": "scene_image_02",
                    "type": "image",
                    "in_seconds": 4.0,
                    "out_seconds": 9.0,
                },
            ],
        )
        self.assertEqual(len(render["asset_manifest"]["assets"]), 4)


class FakePiperForAudio:
    def execute(self, inputs: dict) -> SimpleNamespace:
        # Not a structurally valid WAV -- _wav_duration() catches wave.Error
        # and safely returns 0.0, which is fine for these tests.
        Path(inputs["output_path"]).write_bytes(b"not-a-real-wav")
        return SimpleNamespace(success=True, error=None)


def _fake_ffmpeg_success(cmd, capture_output, text):  # noqa: ANN001, ARG001
    Path(cmd[-1]).write_bytes(b"m4a-bytes")
    return SimpleNamespace(returncode=0, stdout="", stderr="")


def _fake_ffmpeg_failure(cmd, capture_output, text):  # noqa: ANN001, ARG001
    return SimpleNamespace(returncode=1, stdout="", stderr="conversion exploded")


class SynthesizeNarrationAudioTests(unittest.TestCase):
    def test_produces_an_m4a_file_and_cleans_up_the_temporary_wav(self) -> None:
        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(provider_module, "PiperTTS", FakePiperForAudio),
            patch.object(provider_module, "ensure_ffmpeg_on_path", return_value=Path("ffmpeg")),
            patch.object(provider_module.subprocess, "run", side_effect=_fake_ffmpeg_success),
        ):
            output_path = Path(temp_dir) / "question.m4a"
            result = provider_module.OpenMontageProvider().synthesize_narration_audio(
                "Mırmır'a nasıl yardım etmek istersin?", None, output_path
            )

            # Must run inside the TemporaryDirectory block -- it deletes the
            # directory (and any file check would trivially pass/fail) on exit.
            self.assertTrue(output_path.is_file())
            temp_wav = output_path.with_name(f".{output_path.stem}.tmp.wav")
            self.assertFalse(temp_wav.exists(), "temporary WAV must be removed after a successful conversion")

        self.assertEqual(output_path.suffix, ".m4a")
        self.assertEqual(result.kind, "audio")
        self.assertEqual(result.mime_type, "audio/mp4")

    def test_conversion_failure_raises_and_still_cleans_up_the_temporary_wav(self) -> None:
        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(provider_module, "PiperTTS", FakePiperForAudio),
            patch.object(provider_module, "ensure_ffmpeg_on_path", return_value=Path("ffmpeg")),
            patch.object(provider_module.subprocess, "run", side_effect=_fake_ffmpeg_failure),
        ):
            output_path = Path(temp_dir) / "question.m4a"
            with self.assertRaises(RuntimeError):
                provider_module.OpenMontageProvider().synthesize_narration_audio("Merhaba", None, output_path)

            temp_wav = output_path.with_name(f".{output_path.stem}.tmp.wav")
            self.assertFalse(temp_wav.exists(), "temporary WAV must be removed even when conversion fails")

    def test_piper_failure_raises_before_any_conversion_is_attempted(self) -> None:
        class AlwaysFailingPiper:
            def execute(self, inputs: dict) -> SimpleNamespace:
                return SimpleNamespace(success=False, error="no voice model")

        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(provider_module, "PiperTTS", AlwaysFailingPiper),
            patch.object(provider_module, "ensure_ffmpeg_on_path", return_value=Path("ffmpeg")),
            patch.object(provider_module.subprocess, "run") as ffmpeg_run,
        ):
            output_path = Path(temp_dir) / "question.m4a"
            with self.assertRaises(RuntimeError):
                provider_module.OpenMontageProvider().synthesize_narration_audio("Merhaba", None, output_path)

        ffmpeg_run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
