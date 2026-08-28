"""Normalized wire contract shared with apps/admin-web/src/lib/media/types.ts.

Any shape change here must be mirrored on the TypeScript side and vice versa —
this is the single normalized handoff point between the two languages/repos.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Mapping, Optional

SceneEmotion = Literal["happy", "sad", "angry", "scared", "neutral"]
MediaKind = Literal["image", "video"]
MediaMode = Literal["local_animation", "static_image"]
ImageQuality = Literal["low", "medium", "high", "auto"]

MediaJobStatus = Literal[
    "queued",
    "generating_audio",
    "planning_scenes",
    "generating_visuals",
    "rendering",
    "uploading",
    "ready",
    "failed",
]


@dataclass(frozen=True)
class SceneGenerationSpec:
    scene_id: str
    story_id: str
    emotion: SceneEmotion
    event: str
    narration: str
    visual_prompt: str
    duration: float
    character_id: Optional[str] = None


@dataclass(frozen=True)
class MediaGenerationInput:
    scene: SceneGenerationSpec
    mode: MediaMode
    aspect_ratio: str = "4:5"
    # A local image remains the deterministic/manual override. When omitted,
    # OpenMontage generates a visual from scene.visual_prompt.
    image_path: Optional[str] = None
    image_provider: str = "openai"
    image_model: Optional[str] = None
    image_quality: ImageQuality = "low"
    image_size: str = "1024x1536"
    # Piper voice model name (e.g. a tr_TR voice). None = Piper's own default,
    # which is English and will mispronounce Turkish narration.
    voice_model: Optional[str] = None


@dataclass(frozen=True)
class StoryVideoInput:
    """A complete story template that renders all scenes into one MP4."""

    story_id: str
    title: str
    scenes: tuple[SceneGenerationSpec, ...]
    mode: MediaMode = "local_animation"
    aspect_ratio: str = "4:5"
    character_description: str = ""
    visual_style: str = ""
    image_paths: Mapping[str, str] = field(default_factory=dict)
    image_provider: str = "openai"
    image_model: Optional[str] = None
    image_quality: ImageQuality = "low"
    image_size: str = "1024x1536"
    voice_model: Optional[str] = None


@dataclass(frozen=True)
class MediaGenerationResult:
    kind: MediaKind
    asset_uri: str
    mime_type: str
    duration_ms: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None


def scene_generation_spec_from_dict(
    data: dict, *, default_story_id: Optional[str] = None
) -> SceneGenerationSpec:
    story_id = data.get("storyId", default_story_id)
    if not story_id:
        raise ValueError("SceneGenerationSpec için storyId gerekli.")
    return SceneGenerationSpec(
        scene_id=data["sceneId"],
        story_id=story_id,
        emotion=data["emotion"],
        event=data["event"],
        narration=data["narration"],
        visual_prompt=data["visualPrompt"],
        duration=data["duration"],
        character_id=data.get("characterId"),
    )


def media_generation_input_from_dict(data: dict) -> MediaGenerationInput:
    return MediaGenerationInput(
        scene=scene_generation_spec_from_dict(data["scene"]),
        mode=data["mode"],
        aspect_ratio=data.get("aspectRatio", "4:5"),
        image_path=data.get("imagePath"),
        image_provider=data.get("imageProvider", "openai"),
        image_model=data.get("imageModel"),
        image_quality=data.get("imageQuality", "low"),
        image_size=data.get("imageSize", "1024x1536"),
        voice_model=data.get("voiceModel"),
    )


def story_video_input_from_dict(data: dict) -> StoryVideoInput:
    story_id = data["storyId"]
    scenes = tuple(
        scene_generation_spec_from_dict(scene, default_story_id=story_id)
        for scene in data.get("scenes", [])
    )
    if not scenes:
        raise ValueError("StoryVideoInput en az bir sahne içermeli.")
    return StoryVideoInput(
        story_id=story_id,
        title=data["title"],
        scenes=scenes,
        mode=data.get("mode", "local_animation"),
        aspect_ratio=data.get("aspectRatio", "4:5"),
        character_description=data.get("characterDescription", ""),
        visual_style=data.get("visualStyle", ""),
        image_paths=data.get("imagePaths", {}),
        image_provider=data.get("imageProvider", "openai"),
        image_model=data.get("imageModel"),
        image_quality=data.get("imageQuality", "low"),
        image_size=data.get("imageSize", "1024x1536"),
        voice_model=data.get("voiceModel"),
    )


def media_generation_result_to_dict(result: MediaGenerationResult) -> dict:
    return {
        "kind": result.kind,
        "assetUri": result.asset_uri,
        "mimeType": result.mime_type,
        "durationMs": result.duration_ms,
        "width": result.width,
        "height": result.height,
    }


def story_video_input_to_dict(input: StoryVideoInput) -> dict:
    return {
        "storyId": input.story_id,
        "title": input.title,
        "characterDescription": input.character_description,
        "visualStyle": input.visual_style,
        "mode": input.mode,
        "aspectRatio": input.aspect_ratio,
        "imagePaths": dict(input.image_paths),
        "imageProvider": input.image_provider,
        "imageModel": input.image_model,
        "imageQuality": input.image_quality,
        "imageSize": input.image_size,
        "voiceModel": input.voice_model,
        "scenes": [
            {
                "sceneId": scene.scene_id,
                "storyId": scene.story_id,
                "characterId": scene.character_id,
                "emotion": scene.emotion,
                "event": scene.event,
                "narration": scene.narration,
                "visualPrompt": scene.visual_prompt,
                "duration": scene.duration,
            }
            for scene in input.scenes
        ],
    }
