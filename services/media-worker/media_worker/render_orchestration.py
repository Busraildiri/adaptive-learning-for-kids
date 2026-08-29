"""Phase 3: turns Phase 2's output (a StoryPlaybackGraph + its
SceneGenerationSpecs) into independent media assets -- one MP4 per clip, one
M4A per decision question/option. Never produces or requires one combined
MP4 as the source of truth.

Depends only on the MediaProvider protocol via provider.get_provider() --
never imports OpenMontageProvider (or any other concrete provider) directly.
Whoever calls this module (a script, a future worker) is responsible for
calling register_provider() first.

Does not touch Supabase, media_jobs, or any DB/job orchestration -- that is
Phase 4. storage_paths.py's builders describe where an asset WOULD live once
uploaded; nothing here uploads it.

Continuity (GLOBAL/PREVIOUS/CURRENT/ENDING) is entirely Phase 2's
responsibility, already baked into each SceneGenerationSpec.visual_prompt --
this module passes that prompt through unchanged and invents no narrative
content of its own.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Iterable, Optional

from .playback_graph import StoryPlaybackGraph
from .provider import get_provider
from .render_manifest import (
    ClipRenderResult,
    MediaGenerationInput,
    MediaMode,
    SceneGenerationSpec,
    StoryMediaRenderResult,
)
from .storage_paths import (
    choice_option_storage_path,
    clip_storage_path,
    decision_question_storage_path,
)

_MEDIA_WORKER_ROOT = Path(__file__).resolve().parent.parent
_OUTPUT_ROOT = _MEDIA_WORKER_ROOT / "renders"


class MissingSceneForClipError(Exception):
    """A non-decision PlaybackClip has no matching SceneGenerationSpec.

    Raised eagerly by render_story_media() rather than letting individual
    clips fail one-by-one deep inside the render loop -- a graph/scenes
    mismatch is a caller bug (Phase 2 output desync), not a per-asset
    render failure, so it is rejected up front.
    """

    def __init__(self, clip_ids: list[str]) -> None:
        super().__init__(
            f"No SceneGenerationSpec found for clip id(s): {', '.join(clip_ids)}"
        )
        self.clip_ids = clip_ids


def render_single_clip(
    scene: SceneGenerationSpec,
    *,
    story_id: str,
    graph_id: str,
    provider_id: str = "openmontage",
    mode: MediaMode = "local_animation",
    aspect_ratio: str = "4:5",
    image_path: Optional[str] = None,
    image_provider: str = "openai",
    image_model: Optional[str] = None,
    image_quality: str = "low",
    image_size: str = "1024x1536",
    voice_model: Optional[str] = None,
    render_id: Optional[str] = None,
) -> ClipRenderResult:
    """The canonical render primitive: one SceneGenerationSpec -> one
    independent MP4. Callable standalone (Phase 7 clip regeneration will call
    exactly this, not a batch API) -- render_story_clips() below is only a
    thin loop over this function, not a second implementation.

    `render_id`: pass the job's claim-time fencing token (Phase 4's
    worker.py does) so the storage path and the job's render_id are the same
    identity; left unset, a fresh one is minted (standalone/test usage).
    """
    render_id = render_id or str(uuid.uuid4())
    relative_path = clip_storage_path(story_id, graph_id, scene.scene_id, render_id)
    output_path = _OUTPUT_ROOT / relative_path
    try:
        provider = get_provider(provider_id)
        media_input = MediaGenerationInput(
            scene=scene,
            mode=mode,
            aspect_ratio=aspect_ratio,
            image_path=image_path,
            image_provider=image_provider,
            image_model=image_model,
            image_quality=image_quality,  # type: ignore[arg-type]
            image_size=image_size,
            voice_model=voice_model,
        )
        result = provider.generate(media_input)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(result.asset_uri, output_path)
        return ClipRenderResult(
            clip_id=scene.scene_id,
            source_scene_id=scene.scene_id,
            kind="video",
            status="ready",
            asset_uri=str(output_path),
            storage_path=relative_path,
            duration_ms=result.duration_ms,
        )
    except Exception as exc:  # noqa: BLE001 -- one clip's failure must not abort the batch
        return ClipRenderResult(
            clip_id=scene.scene_id,
            source_scene_id=scene.scene_id,
            kind="video",
            status="failed",
            error=str(exc),
        )


def render_story_clips(
    scenes: Iterable[SceneGenerationSpec],
    *,
    story_id: str,
    graph_id: str,
    provider_id: str = "openmontage",
    voice_model: Optional[str] = None,
) -> tuple[ClipRenderResult, ...]:
    """Batch helper: loops render_single_clip() over every scene. Not a
    second render implementation -- if this needs different behavior than
    render_single_clip(), that belongs in render_single_clip() itself so
    Phase 7's single-clip regeneration stays consistent with a full render.
    """
    return tuple(
        render_single_clip(
            scene,
            story_id=story_id,
            graph_id=graph_id,
            provider_id=provider_id,
            voice_model=voice_model,
        )
        for scene in scenes
    )


def render_decision_question_audio(
    text: str,
    *,
    story_id: str,
    graph_id: str,
    decision_clip_id: str,
    provider_id: str = "openmontage",
    voice_model: Optional[str] = None,
    render_id: Optional[str] = None,
) -> ClipRenderResult:
    render_id = render_id or str(uuid.uuid4())
    relative_path = decision_question_storage_path(story_id, graph_id, decision_clip_id, render_id)
    output_path = _OUTPUT_ROOT / relative_path
    clip_id = f"{decision_clip_id}-question"
    try:
        provider = get_provider(provider_id)
        result = provider.synthesize_narration_audio(text, voice_model, output_path)
        return ClipRenderResult(
            clip_id=clip_id,
            source_scene_id=decision_clip_id,
            kind="audio",
            status="ready",
            asset_uri=result.asset_uri,
            storage_path=relative_path,
            duration_ms=result.duration_ms,
        )
    except Exception as exc:  # noqa: BLE001
        return ClipRenderResult(
            clip_id=clip_id, source_scene_id=decision_clip_id, kind="audio",
            status="failed", error=str(exc),
        )


def render_choice_option_audio(
    text: str,
    *,
    story_id: str,
    graph_id: str,
    decision_clip_id: str,
    choice_id: str,
    provider_id: str = "openmontage",
    voice_model: Optional[str] = None,
    render_id: Optional[str] = None,
) -> ClipRenderResult:
    render_id = render_id or str(uuid.uuid4())
    relative_path = choice_option_storage_path(
        story_id, graph_id, decision_clip_id, choice_id, render_id
    )
    output_path = _OUTPUT_ROOT / relative_path
    clip_id = f"{decision_clip_id}-{choice_id}"
    try:
        provider = get_provider(provider_id)
        result = provider.synthesize_narration_audio(text, voice_model, output_path)
        return ClipRenderResult(
            clip_id=clip_id,
            source_scene_id=decision_clip_id,
            kind="audio",
            status="ready",
            asset_uri=result.asset_uri,
            storage_path=relative_path,
            duration_ms=result.duration_ms,
        )
    except Exception as exc:  # noqa: BLE001
        return ClipRenderResult(
            clip_id=clip_id, source_scene_id=decision_clip_id, kind="audio",
            status="failed", error=str(exc),
        )


def render_decision_audio_for_graph(
    graph: StoryPlaybackGraph,
    *,
    story_id: str,
    graph_id: str,
    provider_id: str = "openmontage",
    voice_model: Optional[str] = None,
) -> tuple[ClipRenderResult, ...]:
    """Batch helper over every decision clip's question + both options.
    Built entirely on render_decision_question_audio()/render_choice_option_audio()
    -- Phase 7 can call either of those alone for a single regenerated asset.
    """
    results: list[ClipRenderResult] = []
    for clip in graph.clips:
        if clip.kind != "decision" or clip.choice is None:
            continue
        results.append(
            render_decision_question_audio(
                clip.choice.question,
                story_id=story_id,
                graph_id=graph_id,
                decision_clip_id=clip.id,
                provider_id=provider_id,
                voice_model=voice_model,
            )
        )
        for option in clip.choice.options:
            results.append(
                render_choice_option_audio(
                    option.label,
                    story_id=story_id,
                    graph_id=graph_id,
                    decision_clip_id=clip.id,
                    choice_id=option.id,
                    provider_id=provider_id,
                    voice_model=voice_model,
                )
            )
    return tuple(results)


def render_story_media(
    graph: StoryPlaybackGraph,
    scenes: Iterable[SceneGenerationSpec],
    *,
    provider_id: str = "openmontage",
    voice_model: Optional[str] = None,
) -> StoryMediaRenderResult:
    """Top-level Phase 3 entry point: every renderable clip's video +
    every decision's question/option audio, independently. No combined MP4
    is produced or required -- combined_preview_uri stays unset here.
    """
    scenes_by_id = {scene.scene_id: scene for scene in scenes}
    renderable_clip_ids = [clip.id for clip in graph.clips if clip.kind != "decision"]
    missing = [clip_id for clip_id in renderable_clip_ids if clip_id not in scenes_by_id]
    if missing:
        raise MissingSceneForClipError(missing)

    ordered_scenes = [scenes_by_id[clip_id] for clip_id in renderable_clip_ids]
    clips = render_story_clips(
        ordered_scenes, story_id=graph.story_id, graph_id=graph.id,
        provider_id=provider_id, voice_model=voice_model,
    )
    decision_audio = render_decision_audio_for_graph(
        graph, story_id=graph.story_id, graph_id=graph.id,
        provider_id=provider_id, voice_model=voice_model,
    )
    return StoryMediaRenderResult(
        graph_id=graph.id,
        story_id=graph.story_id,
        clips=clips,
        decision_audio=decision_audio,
    )
