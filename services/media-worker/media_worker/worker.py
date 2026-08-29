"""Polling worker: claims queued rows from private.media_jobs (via the
service_role-only RPCs in
supabase/migrations/20260828030000_media_jobs_graph_extension.sql), renders
through Phase 3's render_orchestration primitives, and reports status back.

Never reconstructs story semantics: render_manifest is an immutable snapshot
written once at job-creation time (by admin-web's Scene Planner output) --
this module only deserializes and executes it, and never calls back into a
Story/Scene Planner.

Two dispatch paths:
  - Legacy single-scene jobs (graph_id is null): unchanged Phase 0-era
    behavior -- old `{storyId}/{sceneId}.ext` storage path, a signed URL
    written to asset_url. Kept exactly as before for backward compatibility.
  - Graph jobs (graph_id set): Phase 3's render_single_clip /
    render_decision_question_audio / render_choice_option_audio, Phase 3's
    deterministic storage path, and the durable storage_path column --
    asset_url is never written for these. story_clips/story_choice_media
    (the graph's "active state") are updated in addition to the job row.

Every status update passes the job's claim-time render_id back as
expected_render_id -- if requeue_stale_media_jobs() or retry_media_job() has
since handed this job to a different attempt, the update is rejected rather
than corrupting a newer attempt's state.

Usage:
    python -m media_worker.worker
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""
from __future__ import annotations

import mimetypes
import os
import time
import traceback
from pathlib import Path
from typing import Optional

from supabase import Client, create_client

from .provider import get_provider, register_provider
from .providers.openmontage_provider import OpenMontageProvider
from .render_manifest import (
    ClipRenderResult,
    decision_audio_input_from_dict,
    media_generation_input_from_dict,
)
from .render_orchestration import (
    render_choice_option_audio,
    render_decision_question_audio,
    render_single_clip,
)

POLL_INTERVAL_SECONDS = float(os.environ.get("MEDIA_WORKER_POLL_INTERVAL", "5"))
STORAGE_BUCKET = os.environ.get("MEDIA_WORKER_STORAGE_BUCKET", "media-renders")
LEGACY_SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60  # legacy single-scene jobs only


def _client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _upload_to_storage(client: Client, local_path: str, storage_path: str) -> None:
    path = Path(local_path)
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    with open(path, "rb") as file_obj:
        client.storage.from_(STORAGE_BUCKET).upload(
            storage_path, file_obj, {"content-type": mime_type, "upsert": "true"}
        )


def _legacy_signed_url(client: Client, storage_path: str) -> str:
    signed = client.storage.from_(STORAGE_BUCKET).create_signed_url(
        storage_path, LEGACY_SIGNED_URL_TTL_SECONDS
    )
    return signed["signedURL"]


def _render_video_job(job: dict, render_id: str) -> ClipRenderResult:
    media_input = media_generation_input_from_dict(job["render_manifest"])
    return render_single_clip(
        media_input.scene,
        story_id=job["story_id"],
        graph_id=job["graph_id"],
        provider_id=job["provider"],
        mode=media_input.mode,
        aspect_ratio=media_input.aspect_ratio,
        image_path=media_input.image_path,
        image_provider=media_input.image_provider,
        image_model=media_input.image_model,
        image_quality=media_input.image_quality,
        image_size=media_input.image_size,
        voice_model=media_input.voice_model,
        render_id=render_id,
    )


def _render_audio_job(job: dict, render_id: str) -> ClipRenderResult:
    audio_input = decision_audio_input_from_dict(job["render_manifest"])
    if audio_input.audio_role == "question":
        return render_decision_question_audio(
            audio_input.text,
            story_id=job["story_id"],
            graph_id=job["graph_id"],
            decision_clip_id=audio_input.decision_clip_id,
            provider_id=job["provider"],
            voice_model=audio_input.voice_model,
            render_id=render_id,
        )
    return render_choice_option_audio(
        audio_input.text,
        story_id=job["story_id"],
        graph_id=job["graph_id"],
        decision_clip_id=audio_input.decision_clip_id,
        choice_id=audio_input.choice_id,
        provider_id=job["provider"],
        voice_model=audio_input.voice_model,
        render_id=render_id,
    )


def _mark_job(client: Client, job_id: str, render_id: str, **fields: object) -> None:
    client.rpc(
        "update_media_job_status",
        {"target_job_id": job_id, "expected_render_id": render_id, **fields},
    ).execute()


def _mark_clip_or_choice(client: Client, job: dict, *, status: str, **fields: object) -> None:
    if job["media_kind"] == "video":
        client.rpc(
            "update_story_clip_media_state",
            {
                "target_graph_id": job["graph_id"],
                "target_clip_id": job["scene_id"],
                "new_status": status,
                **fields,
            },
        ).execute()
    else:
        client.rpc(
            "update_choice_media_state",
            {
                "target_graph_id": job["graph_id"],
                "target_decision_clip_id": job["scene_id"],
                "target_audio_role": job.get("audio_role"),
                "target_choice_id": job.get("choice_id"),
                "new_status": status,
                **fields,
            },
        ).execute()


def _process_legacy_job(client: Client, job: dict, render_id: str) -> None:
    """Unchanged Phase 0-era single-scene behavior."""
    job_id = job["id"]
    _mark_job(client, job_id, render_id, new_status="rendering", new_progress=75)
    media_input = media_generation_input_from_dict(job["render_manifest"])
    provider = get_provider(job["provider"])
    result = provider.generate(media_input)

    _mark_job(client, job_id, render_id, new_status="uploading", new_progress=90)
    storage_path = f"{job['story_id']}/{job['scene_id'] or job_id}{Path(result.asset_uri).suffix}"
    _upload_to_storage(client, result.asset_uri, storage_path)
    signed_url = _legacy_signed_url(client, storage_path)

    _mark_job(
        client, job_id, render_id,
        new_status="ready", new_progress=100,
        new_asset_url=signed_url, new_storage_path=storage_path,
    )
    print(f"[media-worker] job {job_id} ready (legacy) -> {signed_url}")


def _process_graph_job(client: Client, job: dict, render_id: str) -> None:
    job_id = job["id"]
    media_kind = job["media_kind"]
    render_result = _render_video_job(job, render_id) if media_kind == "video" else _render_audio_job(job, render_id)

    if render_result.status == "failed":
        raise RuntimeError(render_result.error or f"{media_kind} render failed")

    _mark_job(client, job_id, render_id, new_status="uploading", new_progress=75)
    _upload_to_storage(client, render_result.asset_uri, render_result.storage_path)

    _mark_job(
        client, job_id, render_id,
        new_status="ready", new_progress=100, new_storage_path=render_result.storage_path,
    )
    _mark_clip_or_choice(
        client, job, status="ready",
        new_storage_path=render_result.storage_path, new_duration_ms=render_result.duration_ms,
        new_render_id=render_id,
    )
    print(f"[media-worker] job {job_id} ready -> {render_result.storage_path}")


def _process_job(client: Client, job: dict) -> None:
    job_id = job["id"]
    render_id: Optional[str] = job.get("render_id")
    is_legacy = job.get("graph_id") is None
    print(
        f"[media-worker] claimed job {job_id} (story={job['story_id']} scene={job['scene_id']} "
        f"kind={job.get('media_kind')} legacy={is_legacy})"
    )
    try:
        if is_legacy:
            _process_legacy_job(client, job, render_id)
        else:
            _process_graph_job(client, job, render_id)
    except Exception as exc:  # noqa: BLE001 -- always report failure back to the job row
        traceback.print_exc()
        error_message = str(exc)
        try:
            _mark_job(client, job_id, render_id, new_status="failed", new_error=error_message)
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        if not is_legacy:
            try:
                _mark_clip_or_choice(
                    client, job, status="failed", new_error=error_message, new_render_id=render_id,
                )
            except Exception:  # noqa: BLE001
                traceback.print_exc()


def run_forever() -> None:
    register_provider(OpenMontageProvider())
    client = _client()
    print(f"[media-worker] polling every {POLL_INTERVAL_SECONDS}s (Ctrl+C to stop)")
    while True:
        claimed = client.rpc("claim_next_media_job", {}).execute().data or []
        if not claimed:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue
        for job in claimed:
            _process_job(client, job)


if __name__ == "__main__":
    run_forever()
