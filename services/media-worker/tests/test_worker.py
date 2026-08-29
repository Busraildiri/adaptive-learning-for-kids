from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from media_worker import worker
from media_worker.provider import register_provider
from media_worker.render_manifest import ClipRenderResult


class FakeRpcCall:
    def __init__(self, client: "FakeClient", name: str, params: dict) -> None:
        self._client = client
        self._name = name
        self._params = params

    def execute(self):
        self._client.calls.append((self._name, self._params))
        return SimpleNamespace(data=self._client.responses.get(self._name))


class FakeStorageBucket:
    def __init__(self, client: "FakeClient") -> None:
        self._client = client

    def upload(self, path, file_obj, options):  # noqa: ANN001
        self._client.uploads.append(path)

    def create_signed_url(self, path, ttl):  # noqa: ANN001
        return {"signedURL": f"https://example.test/{path}"}


class FakeStorage:
    def __init__(self, client: "FakeClient") -> None:
        self._client = client

    def from_(self, bucket):  # noqa: ANN001
        return FakeStorageBucket(self._client)


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.uploads: list[str] = []
        self.responses: dict[str, object] = {}
        self.storage = FakeStorage(self)

    def rpc(self, name: str, params: dict | None = None) -> FakeRpcCall:
        return FakeRpcCall(self, name, params or {})

    def status_calls(self) -> list[dict]:
        return [params for name, params in self.calls if name == "update_media_job_status"]


class FakeProvider:
    id = "fake"

    def __init__(self, tmp_dir: Path) -> None:
        self._tmp_dir = tmp_dir

    def generate(self, input):  # noqa: ANN001, A002
        tmp = self._tmp_dir / "legacy.mp4"
        tmp.write_bytes(b"video")
        return SimpleNamespace(asset_uri=str(tmp), duration_ms=1000)


def legacy_job() -> dict:
    return {
        "id": "job-legacy",
        "story_id": "story-1",
        "scene_id": "scene-01",
        "provider": "fake",
        "mode": "local_animation",
        "render_manifest": {
            "scene": {
                "sceneId": "scene-01", "storyId": "story-1", "emotion": "neutral",
                "event": "scene-01", "narration": "n", "visualPrompt": "v", "duration": 5,
            },
            "mode": "local_animation", "aspectRatio": "4:5",
        },
        "graph_id": None,
        "media_kind": "video",
        "audio_role": None,
        "choice_id": None,
        "render_id": "render-legacy",
    }


def video_job() -> dict:
    job = legacy_job()
    job.update({"id": "job-video", "graph_id": "graph-1", "render_id": "render-video"})
    return job


def audio_job() -> dict:
    return {
        "id": "job-audio",
        "story_id": "story-1",
        "scene_id": "help_01",
        "provider": "fake",
        "mode": "local_animation",
        "render_manifest": {
            "kind": "decision_audio", "text": "Sarıl", "decisionClipId": "help_01",
            "audioRole": "choice", "choiceId": "hug",
        },
        "graph_id": "graph-1",
        "media_kind": "audio",
        "audio_role": "choice",
        "choice_id": "hug",
        "render_id": "render-audio",
    }


class ProcessJobDispatchTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        self._tmp_dir = Path(self._tmpdir.name)
        register_provider(FakeProvider(self._tmp_dir))

    def test_legacy_job_uses_old_path_and_writes_asset_url_not_storage_state(self) -> None:
        client = FakeClient()
        worker._process_job(client, legacy_job())

        uploaded_path = client.uploads[0]
        self.assertEqual(uploaded_path, "story-1/scene-01.mp4")
        final_status = client.status_calls()[-1]
        self.assertEqual(final_status["new_status"], "ready")
        self.assertIsNotNone(final_status["new_asset_url"])
        self.assertEqual(final_status["expected_render_id"], "render-legacy")
        self.assertFalse(
            any(name in ("update_story_clip_media_state", "update_choice_media_state") for name, _ in client.calls),
            "legacy jobs must never touch graph clip/choice state",
        )

    def test_graph_video_job_uses_render_single_clip_and_storage_path_not_asset_url(self) -> None:
        client = FakeClient()
        fake_result = ClipRenderResult(
            clip_id="scene-01", source_scene_id="scene-01", kind="video", status="ready",
            asset_uri=str(self._tmp_dir / "graph.mp4"),
            storage_path="stories/story-1/graphs/graph-1/clips/scene-01/render-video.mp4",
            duration_ms=4000,
        )
        Path(fake_result.asset_uri).write_bytes(b"video")

        with patch.object(worker, "render_single_clip", return_value=fake_result) as render_mock:
            worker._process_job(client, video_job())

        render_mock.assert_called_once()
        self.assertEqual(render_mock.call_args.kwargs["render_id"], "render-video")
        self.assertEqual(client.uploads[0], fake_result.storage_path)

        final_status = client.status_calls()[-1]
        self.assertEqual(final_status["new_status"], "ready")
        self.assertIsNone(final_status.get("new_asset_url"))
        self.assertEqual(final_status["new_storage_path"], fake_result.storage_path)
        self.assertEqual(final_status["expected_render_id"], "render-video")

        clip_state_calls = [p for name, p in client.calls if name == "update_story_clip_media_state"]
        self.assertEqual(len(clip_state_calls), 1)
        self.assertEqual(clip_state_calls[0]["new_status"], "ready")
        self.assertEqual(clip_state_calls[0]["target_clip_id"], "scene-01")
        self.assertEqual(clip_state_calls[0]["new_render_id"], "render-video")

    def test_graph_audio_job_dispatches_choice_option_audio_with_decoded_input(self) -> None:
        client = FakeClient()
        fake_result = ClipRenderResult(
            clip_id="help_01-hug", source_scene_id="help_01", kind="audio", status="ready",
            asset_uri=str(self._tmp_dir / "audio.m4a"),
            storage_path="stories/story-1/graphs/graph-1/choices/help_01/hug/render-audio.m4a",
            duration_ms=900,
        )
        Path(fake_result.asset_uri).write_bytes(b"audio")

        with patch.object(worker, "render_choice_option_audio", return_value=fake_result) as render_mock:
            worker._process_job(client, audio_job())

        self.assertEqual(render_mock.call_args.args[0], "Sarıl")
        self.assertEqual(render_mock.call_args.kwargs["choice_id"], "hug")
        self.assertEqual(render_mock.call_args.kwargs["render_id"], "render-audio")

        choice_state_calls = [p for name, p in client.calls if name == "update_choice_media_state"]
        self.assertEqual(len(choice_state_calls), 1)
        self.assertEqual(choice_state_calls[0]["target_choice_id"], "hug")
        self.assertEqual(choice_state_calls[0]["new_status"], "ready")
        self.assertEqual(choice_state_calls[0]["new_render_id"], "render-audio")

    def test_graph_job_failure_marks_both_job_and_clip_state_failed(self) -> None:
        client = FakeClient()
        failed_result = ClipRenderResult(
            clip_id="scene-01", source_scene_id="scene-01", kind="video",
            status="failed", error="boom",
        )
        with patch.object(worker, "render_single_clip", return_value=failed_result):
            worker._process_job(client, video_job())

        final_status = client.status_calls()[-1]
        self.assertEqual(final_status["new_status"], "failed")
        self.assertEqual(final_status["new_error"], "boom")

        clip_state_calls = [p for name, p in client.calls if name == "update_story_clip_media_state"]
        self.assertEqual(clip_state_calls[-1]["new_status"], "failed")
        self.assertEqual(clip_state_calls[-1]["new_error"], "boom")
        self.assertEqual(clip_state_calls[-1]["new_render_id"], "render-video")

    def test_legacy_job_failure_does_not_touch_graph_state(self) -> None:
        client = FakeClient()
        with patch.object(worker, "get_provider") as get_provider_mock:
            get_provider_mock.return_value = SimpleNamespace(
                generate=lambda _input: (_ for _ in ()).throw(RuntimeError("legacy boom"))
            )
            worker._process_job(client, legacy_job())

        final_status = client.status_calls()[-1]
        self.assertEqual(final_status["new_status"], "failed")
        self.assertFalse(
            any(name in ("update_story_clip_media_state", "update_choice_media_state") for name, _ in client.calls)
        )


if __name__ == "__main__":
    unittest.main()
