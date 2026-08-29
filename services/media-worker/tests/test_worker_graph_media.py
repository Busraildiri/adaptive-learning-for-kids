from __future__ import annotations

import unittest

from media_worker.worker import _storage_path


class WorkerGraphMediaTests(unittest.TestCase):
    def test_graph_audio_path_is_unique_per_choice_and_render(self) -> None:
        base = {
            "id": "job-1",
            "story_id": "story-1",
            "graph_id": "graph-1",
            "scene_id": "emotion-question",
            "media_kind": "audio",
            "audio_role": "choice",
            "render_id": "render-1",
        }
        first = _storage_path({**base, "choice_id": "emotion-sad"}, ".wav")
        second = _storage_path({**base, "choice_id": "emotion-scared"}, ".wav")

        self.assertNotEqual(first, second)
        self.assertIn("emotion-sad", first)
        self.assertTrue(first.endswith("render-1.wav"))

    def test_legacy_job_keeps_backward_compatible_path(self) -> None:
        path = _storage_path(
            {"id": "job-1", "story_id": "story-1", "scene_id": "scene-1"},
            ".mp4",
        )
        self.assertEqual(path, "story-1/scene-1.mp4")


if __name__ == "__main__":
    unittest.main()
