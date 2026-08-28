from __future__ import annotations

import unittest
from types import SimpleNamespace

from media_worker.story_planner import PlannedScene, PlannedStory, PromptStoryPlanner


class FakeResponses:
    last_input: dict | None = None
    inputs: list[dict] = []

    def parse(self, **kwargs: object) -> SimpleNamespace:
        self.__class__.last_input = kwargs
        self.__class__.inputs.append(kwargs)
        return SimpleNamespace(
            output_parsed=PlannedStory(
                title="Mırmır ve Sarı Yağmurluk",
                character_id="mirmir",
                character_description=(
                    "Mırmır is a small orange tabby kitten with a red collar and warm brown eyes."
                ),
                visual_style="Soft polished 3D children's animation with warm gentle lighting.",
                scenes=[
                    PlannedScene(
                        scene_id="parka-gelis",
                        emotion="happy",
                        event="Mırmır parka gelir.",
                        narration="Mırmır neşeyle parka geldi.",
                        visual_prompt="Orange kitten Mırmır arrives at a sunny park.",
                        duration=4,
                    ),
                    PlannedScene(
                        scene_id="yagmurluk-kayip",
                        emotion="sad",
                        event="Sarı yağmurluk kaybolur.",
                        narration="Arkadaşının sarı yağmurluğu kaybolmuştu.",
                        visual_prompt="Same orange kitten notices a missing yellow raincoat.",
                        duration=5,
                    ),
                    PlannedScene(
                        scene_id="yagmurluk-bulundu",
                        emotion="happy",
                        event="Mırmır yağmurluğu bulur.",
                        narration="Mırmır yağmurluğu bulup arkadaşına verdi.",
                        visual_prompt="Same orange kitten safely returns the yellow raincoat.",
                        duration=5,
                    ),
                ],
            )
        )


class PromptStoryPlannerTests(unittest.TestCase):
    def test_one_prompt_becomes_story_video_input(self) -> None:
        FakeResponses.inputs = []
        client = SimpleNamespace(responses=FakeResponses())
        result = PromptStoryPlanner(client=client).generate(
            "Mırmır parkta kaybolan sarı yağmurluğu bulsun.",
            model="test-model",
            voice_model="voice.onnx",
        )

        self.assertEqual(result.title, "Mırmır ve Sarı Yağmurluk")
        self.assertEqual(len(result.scenes), 3)
        self.assertTrue(all(scene.story_id == result.story_id for scene in result.scenes))
        self.assertEqual(result.voice_model, "voice.onnx")
        self.assertEqual(len(FakeResponses.inputs), 2)
        producer_request, reviewer_request = FakeResponses.inputs
        self.assertEqual(producer_request["model"], "test-model")
        self.assertEqual(reviewer_request["model"], "test-model")
        self.assertIs(producer_request["text_format"], PlannedStory)
        self.assertFalse(producer_request["store"])
        self.assertIn("<story_idea>", producer_request["input"])
        self.assertIn("Draft to edit", reviewer_request["input"])

    def test_empty_prompt_is_rejected_before_api_call(self) -> None:
        client = SimpleNamespace(responses=FakeResponses())
        with self.assertRaisesRegex(ValueError, "Prompt"):
            PromptStoryPlanner(client=client).generate("  ")


if __name__ == "__main__":
    unittest.main()
