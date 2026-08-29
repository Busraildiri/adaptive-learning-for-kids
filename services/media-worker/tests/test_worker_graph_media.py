from __future__ import annotations

import unittest

from media_worker.storage_paths import choice_option_storage_path, clip_storage_path


class WorkerGraphMediaTests(unittest.TestCase):
    def test_graph_audio_path_is_unique_per_choice_and_render(self) -> None:
        first = choice_option_storage_path(
            "story-1", "graph-1", "emotion-question", "emotion-sad", "render-1"
        )
        second = choice_option_storage_path(
            "story-1", "graph-1", "emotion-question", "emotion-scared", "render-1"
        )

        self.assertNotEqual(first, second)
        self.assertIn("emotion-sad", first)
        self.assertTrue(first.endswith("render-1.m4a"))

    def test_graph_clip_path_keeps_render_attempts_separate(self) -> None:
        first = clip_storage_path("story-1", "graph-1", "scene-1", "render-1")
        second = clip_storage_path("story-1", "graph-1", "scene-1", "render-2")

        self.assertNotEqual(first, second)
        self.assertEqual(first, "stories/story-1/graphs/graph-1/clips/scene-1/render-1.mp4")


if __name__ == "__main__":
    unittest.main()
