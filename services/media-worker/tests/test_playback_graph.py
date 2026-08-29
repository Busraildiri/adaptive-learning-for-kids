from __future__ import annotations

import unittest

from media_worker.playback_graph import story_playback_graph_from_dict


def sample_graph_dict() -> dict:
    return {
        "id": "graph-1",
        "storyId": "story-1",
        "storyVersion": 1,
        "sourceRequestId": "req-1",
        "startClipId": "scene-01",
        "clips": [
            {"id": "scene-01", "kind": "linear", "sourceSceneId": "scene-01", "nextClipId": "help_01"},
            {
                "id": "help_01",
                "kind": "decision",
                "sourceSceneId": "help_01",
                "choice": {
                    "question": "Nasıl yardım etmek istersin?",
                    "options": [
                        {"id": "hug", "label": "Sarıl", "nextClipId": "help_01-hug"},
                        {"id": "balloon", "label": "Balon bul", "nextClipId": "help_01-balloon"},
                    ],
                },
            },
            {"id": "help_01-hug", "kind": "ending", "sourceSceneId": "help_01"},
            {"id": "help_01-balloon", "kind": "ending", "sourceSceneId": "help_01"},
        ],
    }


class StoryPlaybackGraphFromDictTests(unittest.TestCase):
    def test_deserializes_topology_fields(self) -> None:
        graph = story_playback_graph_from_dict(sample_graph_dict())

        self.assertEqual(graph.id, "graph-1")
        self.assertEqual(graph.start_clip_id, "scene-01")
        self.assertEqual(len(graph.clips), 4)

    def test_decision_clip_choice_has_exactly_two_options(self) -> None:
        graph = story_playback_graph_from_dict(sample_graph_dict())
        decision = next(clip for clip in graph.clips if clip.kind == "decision")

        self.assertIsNotNone(decision.choice)
        self.assertEqual(len(decision.choice.options), 2)
        self.assertEqual([option.id for option in decision.choice.options], ["hug", "balloon"])

    def test_linear_clip_has_no_choice(self) -> None:
        graph = story_playback_graph_from_dict(sample_graph_dict())
        linear = next(clip for clip in graph.clips if clip.kind == "linear")

        self.assertIsNone(linear.choice)
        self.assertEqual(linear.next_clip_id, "help_01")

    def test_source_request_id_is_provenance_not_identity(self) -> None:
        data = sample_graph_dict()
        graph_a = story_playback_graph_from_dict(data)
        data["sourceRequestId"] = None
        del data["sourceRequestId"]
        graph_b = story_playback_graph_from_dict(data)

        self.assertEqual(graph_a.source_request_id, "req-1")
        self.assertIsNone(graph_b.source_request_id)
        # Both are independently valid graphs -- sourceRequestId is optional
        # metadata, never required to identify or construct a graph.
        self.assertEqual(graph_a.id, graph_b.id)


if __name__ == "__main__":
    unittest.main()
