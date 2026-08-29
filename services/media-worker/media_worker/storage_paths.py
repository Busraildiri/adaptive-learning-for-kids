"""Deterministic, collision-free storage object path builders.

Every render attempt (including two attempts for the same clip -- Phase 7
regeneration) gets its own `render_id` path segment, never overwriting a
previous attempt's object. That removes CDN/browser cache staleness by
construction (a new render is always a new URL) and leaves a natural,
already-path-shaped history per clip:

    clips/{clipId}/
      {renderIdA}.mp4
      {renderIdB}.mp4

Phase 3 does not decide which render is "active" or persist that decision --
these are pure path-string builders, no I/O, no DB. Phase 4/7 own picking
and recording the active render.
"""
from __future__ import annotations


def clip_storage_path(story_id: str, graph_id: str, clip_id: str, render_id: str) -> str:
    return f"stories/{story_id}/graphs/{graph_id}/clips/{clip_id}/{render_id}.mp4"


def decision_question_storage_path(
    story_id: str, graph_id: str, decision_clip_id: str, render_id: str
) -> str:
    return (
        f"stories/{story_id}/graphs/{graph_id}/choices/{decision_clip_id}/"
        f"question/{render_id}.m4a"
    )


def choice_option_storage_path(
    story_id: str, graph_id: str, decision_clip_id: str, choice_id: str, render_id: str
) -> str:
    return (
        f"stories/{story_id}/graphs/{graph_id}/choices/{decision_clip_id}/"
        f"{choice_id}/{render_id}.m4a"
    )
