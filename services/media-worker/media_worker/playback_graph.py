"""Python mirror of packages/media-schema's StoryPlaybackGraph contract.

Deferred in Phase 1 (nothing in Python read/wrote the graph yet). Phase 3 is
the first Python code that actually deserializes a persisted graph -- to
find decision clips for audio synthesis -- so per Phase 1's own guidance this
mirrors the full persistence contract, not a hand-picked subset, to avoid
silent drift between the two languages.

This module only models topology (PlaybackClip/Choice/ChoiceOption), never
render state -- render_manifest.py's ClipRenderResult/StoryMediaRenderResult
stay the separate render-result model, matching Phase 1's topology/state
separation.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

ClipKind = Literal["linear", "decision", "ending"]


@dataclass(frozen=True)
class ChoiceOption:
    """Topology/semantics only. Where its audio ended up (if anywhere) is
    Phase 4's story_choice_media table, not a field here -- see Phase 4's
    write-up for why this was corrected (it originally carried imageUrl/
    audioUrl, inconsistent with PlaybackClip/ClipMediaState's separation)."""

    id: str
    label: str
    next_clip_id: str


@dataclass(frozen=True)
class Choice:
    question: str
    options: tuple[ChoiceOption, ChoiceOption]


@dataclass(frozen=True)
class PlaybackClip:
    id: str
    kind: ClipKind
    source_scene_id: str
    role: Optional[str] = None
    # Populated only for kind == "linear"
    next_clip_id: Optional[str] = None
    # Populated only for kind == "decision"
    choice: Optional[Choice] = None


@dataclass(frozen=True)
class StoryPlaybackGraph:
    id: str
    story_id: str
    story_version: int
    start_clip_id: str
    clips: tuple[PlaybackClip, ...]
    # Provenance only, per Phase 0 -- never this graph's identity.
    source_request_id: Optional[str] = None


def choice_option_from_dict(data: dict) -> ChoiceOption:
    return ChoiceOption(
        id=data["id"],
        label=data["label"],
        next_clip_id=data["nextClipId"],
    )


def choice_from_dict(data: dict) -> Choice:
    options = tuple(choice_option_from_dict(option) for option in data["options"])
    if len(options) != 2:
        raise ValueError(f"Choice must have exactly two options, got {len(options)}.")
    return Choice(question=data["question"], options=options)  # type: ignore[arg-type]


def playback_clip_from_dict(data: dict) -> PlaybackClip:
    return PlaybackClip(
        id=data["id"],
        kind=data["kind"],
        source_scene_id=data["sourceSceneId"],
        role=data.get("role"),
        next_clip_id=data.get("nextClipId"),
        choice=choice_from_dict(data["choice"]) if "choice" in data else None,
    )


def story_playback_graph_from_dict(data: dict) -> StoryPlaybackGraph:
    clips = tuple(playback_clip_from_dict(clip) for clip in data["clips"])
    if not clips:
        raise ValueError("StoryPlaybackGraph must contain at least one clip.")
    return StoryPlaybackGraph(
        id=data["id"],
        story_id=data["storyId"],
        story_version=data["storyVersion"],
        start_clip_id=data["startClipId"],
        clips=clips,
        source_request_id=data.get("sourceRequestId"),
    )
