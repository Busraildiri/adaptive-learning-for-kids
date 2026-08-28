"""Polling worker: claims queued rows from private.media_jobs (via the
service_role-only RPCs in supabase/migrations/20260828000000_media_jobs.sql),
renders through a MediaProvider, uploads the result to the private
`media-renders` Storage bucket (supabase/migrations/20260828010000_media_renders_bucket.sql),
and reports status back with a signed URL.

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

from supabase import Client, create_client

from .provider import get_provider, register_provider
from .providers.openmontage_provider import OpenMontageProvider
from .render_manifest import media_generation_input_from_dict

POLL_INTERVAL_SECONDS = float(os.environ.get("MEDIA_WORKER_POLL_INTERVAL", "5"))
STORAGE_BUCKET = os.environ.get("MEDIA_WORKER_STORAGE_BUCKET", "media-renders")
SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days; re-uploads mint a fresh one


def _client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _upload_and_sign(client: Client, job: dict, local_path: str) -> str:
    path = Path(local_path)
    storage_path = f"{job['story_id']}/{job['scene_id'] or job['id']}{path.suffix}"
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    with open(path, "rb") as file_obj:
        client.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            file_obj,
            {"content-type": mime_type, "upsert": "true"},
        )
    signed = client.storage.from_(STORAGE_BUCKET).create_signed_url(
        storage_path, SIGNED_URL_TTL_SECONDS
    )
    return signed["signedURL"]


def _process_job(client: Client, job: dict) -> None:
    job_id = job["id"]
    print(f"[media-worker] claimed job {job_id} (story={job['story_id']} scene={job['scene_id']})")
    try:
        media_input = media_generation_input_from_dict(job["render_manifest"])
        provider = get_provider(job["provider"])

        client.rpc(
            "update_media_job_status",
            {"target_job_id": job_id, "new_status": "rendering", "new_progress": 50},
        ).execute()

        result = provider.generate(media_input)

        client.rpc(
            "update_media_job_status",
            {"target_job_id": job_id, "new_status": "uploading", "new_progress": 80},
        ).execute()
        signed_url = _upload_and_sign(client, job, result.asset_uri)

        client.rpc(
            "update_media_job_status",
            {
                "target_job_id": job_id,
                "new_status": "ready",
                "new_progress": 100,
                "new_asset_url": signed_url,
            },
        ).execute()
        print(f"[media-worker] job {job_id} ready -> {signed_url}")
    except Exception as exc:  # noqa: BLE001 - report every failure back to the job row
        traceback.print_exc()
        client.rpc(
            "update_media_job_status",
            {"target_job_id": job_id, "new_status": "failed", "new_error": str(exc)},
        ).execute()


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
