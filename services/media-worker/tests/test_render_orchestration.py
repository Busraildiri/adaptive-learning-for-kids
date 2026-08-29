from __future__ import annotations

import tempfile
import unittest
import uuid
from pathlib import Path

from media_worker import render_orchestration
from media_worker.playback_graph import story_playback_graph_from_dict
from media_worker.provider import register_provider
from media_worker.render_manifest import MediaGenerationResult, SceneGenerationSpec


def make_scene(scene_id: str, story_id: str = "story-1") -> SceneGenerationSpec:
    return SceneGenerationSpec(
        scene_id=scene_id,
        story_id=story_id,
        emotion="neutral",
        event=scene_id,
        narration=f"Narration for {scene_id}",
        visual_prompt=(
            "GLOBAL CONTINUITY: fixture\nPREVIOUS SCENE STATE: none\n"
            f"CURRENT SCENE GOAL: {scene_id}\nENDING STATE: {scene_id}"
        ),
        duration=5,
    )


def make_graph(clips: list[dict], start_clip_id: str, graph_id: str = "graph-1", story_id: str = "story-1"):
    return story_playback_graph_from_dict(
        {
            "id": graph_id,
            "storyId": story_id,
            "storyVersion": 1,
            "startClipId": start_clip_id,
            "clips": clips,
        }
    )


class FakeProvider:
    """Duck-types MediaProvider without any relation to OpenMontageProvider --
    proves orchestration only depends on the protocol, resolved via the
    registry, never on a concrete provider class."""

    def __init__(self, provider_id: str = "fake") -> None:
        self.id = provider_id
        self.generate_calls: list[object] = []
        self.audio_calls: list[tuple[str, object]] = []
        self._temp_dir = Path(tempfile.mkdtemp())

    def generate(self, input) -> MediaGenerationResult:  # noqa: A002
        self.generate_calls.append(input)
        video_path = self._temp_dir / f"{input.scene.scene_id}-{uuid.uuid4()}.mp4"
        video_path.write_bytes(b"fake-video")
        return MediaGenerationResult(
            kind="video", asset_uri=str(video_path), mime_type="video/mp4",
            duration_ms=int(input.scene.duration * 1000),
        )

    def synthesize_narration_audio(self, text, voice_model, output_path) -> MediaGenerationResult:
        self.audio_calls.append((text, voice_model))
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"fake-audio")
        return MediaGenerationResult(
            kind="audio", asset_uri=str(output_path), mime_type="audio/mp4", duration_ms=1200,
        )


class PartiallyFailingProvider:
    def __init__(self, provider_id: str, fail_scene_ids: set[str]) -> None:
        self.id = provider_id
        self.fail_scene_ids = fail_scene_ids
        self._temp_dir = Path(tempfile.mkdtemp())

    def generate(self, input) -> MediaGenerationResult:  # noqa: A002
        if input.scene.scene_id in self.fail_scene_ids:
            raise RuntimeError(f"boom rendering {input.scene.scene_id}")
        video_path = self._temp_dir / f"{input.scene.scene_id}.mp4"
        video_path.write_bytes(b"video")
        return MediaGenerationResult(kind="video", asset_uri=str(video_path), mime_type="video/mp4", duration_ms=1000)

    def synthesize_narration_audio(self, text, voice_model, output_path) -> MediaGenerationResult:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"audio")
        return MediaGenerationResult(kind="audio", asset_uri=str(output_path), mime_type="audio/mp4", duration_ms=500)


class RenderSingleClipTests(unittest.TestCase):
    def test_is_callable_standalone_and_returns_a_ready_result(self) -> None:
        provider = FakeProvider("fake-single")
        register_provider(provider)
        scene = make_scene("scene-01")

        result = render_orchestration.render_single_clip(
            scene, story_id="story-1", graph_id="graph-1", provider_id="fake-single"
        )

        self.assertEqual(result.status, "ready")
        self.assertEqual(result.kind, "video")
        self.assertEqual(result.clip_id, "scene-01")
        self.assertTrue(Path(result.asset_uri).is_file())

    def test_deterministic_storage_path_contains_all_expected_segments(self) -> None:
        register_provider(FakeProvider("fake-path"))
        scene = make_scene("scene-02")

        result = render_orchestration.render_single_clip(
            scene, story_id="story-xyz", graph_id="graph-abc", provider_id="fake-path"
        )

        self.assertTrue(result.storage_path.startswith("stories/story-xyz/graphs/graph-abc/clips/scene-02/"))
        self.assertTrue(result.storage_path.endswith(".mp4"))
        # exactly one path segment (the render id) between the clip-id directory and the file
        render_id_segment = result.storage_path.rsplit("/", 1)[-1]
        self.assertEqual(render_id_segment, f"{uuid.UUID(render_id_segment.removesuffix('.mp4'))}.mp4")

    def test_two_render_attempts_for_the_same_clip_get_different_paths(self) -> None:
        register_provider(FakeProvider("fake-twice"))
        scene = make_scene("scene-03")

        first = render_orchestration.render_single_clip(scene, story_id="s", graph_id="g", provider_id="fake-twice")
        second = render_orchestration.render_single_clip(scene, story_id="s", graph_id="g", provider_id="fake-twice")

        self.assertNotEqual(first.storage_path, second.storage_path)

    def test_provider_failure_maps_to_a_failed_clip_result_not_an_exception(self) -> None:
        register_provider(PartiallyFailingProvider("fake-fail-one", fail_scene_ids={"scene-04"}))
        scene = make_scene("scene-04")

        result = render_orchestration.render_single_clip(scene, story_id="s", graph_id="g", provider_id="fake-fail-one")

        self.assertEqual(result.status, "failed")
        self.assertIsNotNone(result.error)
        self.assertIsNone(result.asset_uri)

    def test_continuity_visual_prompt_reaches_the_provider_unchanged(self) -> None:
        provider = FakeProvider("fake-prompt")
        register_provider(provider)
        scene = make_scene("scene-05")

        render_orchestration.render_single_clip(scene, story_id="s", graph_id="g", provider_id="fake-prompt")

        self.assertEqual(provider.generate_calls[0].scene.visual_prompt, scene.visual_prompt)


class RenderStoryClipsTests(unittest.TestCase):
    def test_multiple_scenes_produce_separate_independent_results(self) -> None:
        register_provider(FakeProvider("fake-batch"))
        scenes = [make_scene("scene-a"), make_scene("scene-b"), make_scene("scene-c")]

        results = render_orchestration.render_story_clips(
            scenes, story_id="s", graph_id="g", provider_id="fake-batch"
        )

        self.assertEqual(len(results), 3)
        self.assertEqual({r.clip_id for r in results}, {"scene-a", "scene-b", "scene-c"})
        paths = {r.asset_uri for r in results}
        self.assertEqual(len(paths), 3, "each clip must be its own independent asset, no shared/combined file")

    def test_branch_ending_clips_remain_separate_outputs(self) -> None:
        register_provider(FakeProvider("fake-branches"))
        scenes = [make_scene("help_01-hug"), make_scene("help_01-balloon")]

        results = render_orchestration.render_story_clips(
            scenes, story_id="s", graph_id="g", provider_id="fake-branches"
        )

        self.assertEqual({r.clip_id for r in results}, {"help_01-hug", "help_01-balloon"})
        self.assertNotEqual(results[0].asset_uri, results[1].asset_uri)

    def test_one_failure_does_not_erase_other_successful_results(self) -> None:
        register_provider(PartiallyFailingProvider("fake-partial", fail_scene_ids={"scene-b"}))
        scenes = [make_scene("scene-a"), make_scene("scene-b"), make_scene("scene-c")]

        results = render_orchestration.render_story_clips(
            scenes, story_id="s", graph_id="g", provider_id="fake-partial"
        )

        by_id = {r.clip_id: r for r in results}
        self.assertEqual(by_id["scene-a"].status, "ready")
        self.assertEqual(by_id["scene-b"].status, "failed")
        self.assertEqual(by_id["scene-c"].status, "ready")

    def test_batch_helper_delegates_to_render_single_clip(self) -> None:
        calls: list[str] = []
        original = render_orchestration.render_single_clip

        def spy(scene, **kwargs):  # noqa: ANN001
            calls.append(scene.scene_id)
            return original(scene, **kwargs)

        register_provider(FakeProvider("fake-spy"))
        render_orchestration.render_single_clip = spy  # type: ignore[assignment]
        try:
            scenes = [make_scene("x"), make_scene("y")]
            render_orchestration.render_story_clips(scenes, story_id="s", graph_id="g", provider_id="fake-spy")
        finally:
            render_orchestration.render_single_clip = original  # type: ignore[assignment]

        self.assertEqual(calls, ["x", "y"])


class DecisionAudioTests(unittest.TestCase):
    def _decision_graph(self):
        return make_graph(
            [
                {"id": "scene-01", "kind": "linear", "sourceSceneId": "scene-01", "nextClipId": "help_01"},
                {
                    "id": "help_01",
                    "kind": "decision",
                    "sourceSceneId": "help_01",
                    "choice": {
                        "question": "Mırmır'a nasıl yardım etmek istersin?",
                        "options": [
                            {"id": "hug", "label": "Sarıl", "nextClipId": "help_01-hug"},
                            {"id": "balloon", "label": "Yeni balon bul", "nextClipId": "help_01-balloon"},
                        ],
                    },
                },
                {"id": "help_01-hug", "kind": "ending", "sourceSceneId": "help_01"},
                {"id": "help_01-balloon", "kind": "ending", "sourceSceneId": "help_01"},
            ],
            start_clip_id="scene-01",
        )

    def test_question_and_both_options_are_generated_as_separate_audio_assets(self) -> None:
        provider = FakeProvider("fake-audio")
        register_provider(provider)
        graph = self._decision_graph()

        results = render_orchestration.render_decision_audio_for_graph(
            graph, story_id="story-1", graph_id="graph-1", provider_id="fake-audio"
        )

        self.assertEqual(len(results), 3)
        self.assertEqual({r.clip_id for r in results}, {"help_01-question", "help_01-hug", "help_01-balloon"})
        self.assertTrue(all(r.kind == "audio" for r in results))
        self.assertEqual({text for text, _ in provider.audio_calls}, {
            "Mırmır'a nasıl yardım etmek istersin?", "Sarıl", "Yeni balon bul",
        })

    def test_audio_storage_paths_end_in_m4a(self) -> None:
        register_provider(FakeProvider("fake-audio-ext"))
        graph = self._decision_graph()

        results = render_orchestration.render_decision_audio_for_graph(
            graph, story_id="story-1", graph_id="graph-1", provider_id="fake-audio-ext"
        )

        self.assertTrue(all(r.storage_path.endswith(".m4a") for r in results))
        self.assertTrue(all("/choices/help_01/" in r.storage_path for r in results))

    def test_audio_provider_failure_maps_to_a_failed_result_only(self) -> None:
        class FailingAudioProvider(FakeProvider):
            def synthesize_narration_audio(self, text, voice_model, output_path):
                if text == "Sarıl":
                    raise RuntimeError("tts boom")
                return super().synthesize_narration_audio(text, voice_model, output_path)

        register_provider(FailingAudioProvider("fake-audio-fail"))
        graph = self._decision_graph()

        results = render_orchestration.render_decision_audio_for_graph(
            graph, story_id="story-1", graph_id="graph-1", provider_id="fake-audio-fail"
        )

        by_id = {r.clip_id: r for r in results}
        self.assertEqual(by_id["help_01-hug"].status, "failed")
        self.assertEqual(by_id["help_01-question"].status, "ready")
        self.assertEqual(by_id["help_01-balloon"].status, "ready")


class RenderStoryMediaTests(unittest.TestCase):
    def test_full_story_render_needs_no_combined_mp4(self) -> None:
        register_provider(FakeProvider("fake-full"))
        graph = make_graph(
            [{"id": "scene-01", "kind": "ending", "sourceSceneId": "scene-01"}],
            start_clip_id="scene-01",
            graph_id="graph-full",
            story_id="story-full",
        )
        scenes = [make_scene("scene-01", story_id="story-full")]

        result = render_orchestration.render_story_media(graph, scenes, provider_id="fake-full")

        self.assertEqual(len(result.clips), 1)
        self.assertEqual(result.clips[0].status, "ready")
        self.assertIsNone(result.combined_preview_uri)

    def test_missing_scene_for_a_clip_is_rejected_explicitly(self) -> None:
        register_provider(FakeProvider("fake-missing"))
        graph = make_graph(
            [{"id": "scene-01", "kind": "ending", "sourceSceneId": "scene-01"}],
            start_clip_id="scene-01",
        )

        with self.assertRaises(render_orchestration.MissingSceneForClipError):
            render_orchestration.render_story_media(graph, scenes=[], provider_id="fake-missing")


if __name__ == "__main__":
    unittest.main()
