from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from media_worker.providers import openmontage_provider as provider_module
from media_worker.render_manifest import media_generation_input_from_dict, story_video_input_from_dict


def manifest(**overrides: object) -> dict:
    value = {
        "scene": {
            "sceneId": "scene-test",
            "storyId": "story-test",
            "emotion": "happy",
            "event": "greeting",
            "narration": "Mırmır kırmızı balonuyla oynuyor.",
            "visualPrompt": "Mırmır parkta kırmızı balonuyla neşeyle oynuyor.",
            "duration": 5,
        },
        "mode": "local_animation",
        "aspectRatio": "4:5",
        "imageProvider": "openai",
        "imageQuality": "low",
        "imageSize": "1024x1536",
    }
    value.update(overrides)
    return value


class FakeImageSelector:
    last_input: dict | None = None
    inputs: list[dict] = []

    def execute(self, inputs: dict) -> SimpleNamespace:
        self.__class__.last_input = inputs
        self.__class__.inputs.append(inputs)
        output = Path(inputs["output_path"])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"generated-image")
        return SimpleNamespace(success=True, error=None, data={"output": str(output)})


class FakePiper:
    inputs: list[dict] = []

    def execute(self, inputs: dict) -> SimpleNamespace:
        self.__class__.inputs.append(inputs)
        Path(inputs["output_path"]).write_bytes(b"audio")
        return SimpleNamespace(success=True, error=None)


class FakeHyperFrames:
    last_input: dict | None = None

    def execute(self, inputs: dict) -> SimpleNamespace:
        self.__class__.last_input = inputs
        Path(inputs["output_path"]).write_bytes(b"video")
        return SimpleNamespace(success=True, error=None)


class OpenMontageProviderTests(unittest.TestCase):
    def test_generates_visual_from_scene_prompt_before_tts_and_render(self) -> None:
        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(provider_module, "_OUTPUT_ROOT", Path(temp_dir)),
            patch.object(provider_module, "ImageSelector", FakeImageSelector),
            patch.object(provider_module, "PiperTTS", FakePiper),
            patch.object(provider_module, "HyperFramesCompose", FakeHyperFrames),
            patch.object(provider_module, "ensure_ffmpeg_on_path"),
        ):
            result = provider_module.OpenMontageProvider().generate(
                media_generation_input_from_dict(manifest())
            )

        self.assertEqual(result.kind, "video")
        self.assertIn("Mırmır parkta", FakeImageSelector.last_input["prompt"])
        self.assertEqual(FakeImageSelector.last_input["preferred_provider"], "openai")
        self.assertEqual(FakeImageSelector.last_input["quality"], "low")
        self.assertEqual(FakeImageSelector.last_input["size"], "1024x1536")
        image_asset = FakeHyperFrames.last_input["asset_manifest"]["assets"][0]
        self.assertTrue(image_asset["path"].endswith("generated-visual.png"))

    def test_local_image_override_skips_paid_image_generation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            image = Path(temp_dir) / "existing.png"
            image.write_bytes(b"existing-image")
            with (
                patch.object(provider_module, "_OUTPUT_ROOT", Path(temp_dir) / "renders"),
                patch.object(provider_module, "ImageSelector") as selector,
                patch.object(provider_module, "PiperTTS", FakePiper),
                patch.object(provider_module, "HyperFramesCompose", FakeHyperFrames),
                patch.object(provider_module, "ensure_ffmpeg_on_path"),
            ):
                provider_module.OpenMontageProvider().generate(
                    media_generation_input_from_dict(manifest(imagePath=str(image)))
                )

        selector.assert_not_called()
        image_asset = FakeHyperFrames.last_input["asset_manifest"]["assets"][0]
        self.assertEqual(Path(image_asset["path"]), image.resolve())

    def test_complete_story_template_becomes_one_timeline(self) -> None:
        story = story_video_input_from_dict(
            {
                "storyId": "mirmir-story",
                "title": "Mırmır'ın Hikâyesi",
                "characterDescription": "A consistent orange tabby kitten",
                "visualStyle": "soft 3D children's animation",
                "scenes": [
                    {
                        "sceneId": "start",
                        "emotion": "happy",
                        "event": "start",
                        "narration": "Mırmır oynuyor.",
                        "visualPrompt": "Mırmır plays with a red balloon.",
                        "duration": 4,
                    },
                    {
                        "sceneId": "ending",
                        "emotion": "happy",
                        "event": "ending",
                        "narration": "Mırmır gülümsüyor.",
                        "visualPrompt": "Mırmır smiles with the balloon.",
                        "duration": 5,
                    },
                ],
            }
        )
        FakeImageSelector.inputs = []
        FakePiper.inputs = []
        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(provider_module, "_OUTPUT_ROOT", Path(temp_dir)),
            patch.object(provider_module, "ImageSelector", FakeImageSelector),
            patch.object(provider_module, "PiperTTS", FakePiper),
            patch.object(provider_module, "HyperFramesCompose", FakeHyperFrames),
            patch.object(provider_module, "ensure_ffmpeg_on_path"),
        ):
            result = provider_module.OpenMontageProvider().generate_story(story)

        self.assertEqual(result.duration_ms, 9000)
        self.assertEqual(len(FakeImageSelector.inputs), 2)
        self.assertEqual(len(FakePiper.inputs), 2)
        self.assertIn("consistent orange tabby", FakeImageSelector.inputs[0]["prompt"])
        render = FakeHyperFrames.last_input
        self.assertEqual(
            render["edit_decisions"]["cuts"],
            [
                {
                    "source": "scene_image_01",
                    "type": "image",
                    "in_seconds": 0.0,
                    "out_seconds": 4.0,
                },
                {
                    "source": "scene_image_02",
                    "type": "image",
                    "in_seconds": 4.0,
                    "out_seconds": 9.0,
                },
            ],
        )
        self.assertEqual(len(render["asset_manifest"]["assets"]), 4)


if __name__ == "__main__":
    unittest.main()
