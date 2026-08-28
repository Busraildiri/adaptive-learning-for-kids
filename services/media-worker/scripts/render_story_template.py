"""Render a complete StoryVideoInput template through OpenMontage."""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

_MEDIA_WORKER_ROOT = Path(__file__).resolve().parent.parent
if str(_MEDIA_WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(_MEDIA_WORKER_ROOT))

from media_worker.providers.openmontage_provider import OpenMontageProvider  # noqa: E402
from media_worker.render_manifest import story_video_input_from_dict  # noqa: E402


def _image_overrides(values: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for value in values:
        scene_id, separator, path = value.partition("=")
        if not separator or not scene_id or not path:
            raise ValueError("--image değeri sceneId=C:\\tam\\yol biçiminde olmalı.")
        result[scene_id] = path
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", required=True, help="StoryVideoInput JSON path")
    parser.add_argument(
        "--generate-images",
        action="store_true",
        help="Generate every scene image through OpenMontage (may call a paid API)",
    )
    parser.add_argument(
        "--image",
        action="append",
        default=[],
        metavar="SCENE_ID=PATH",
        help="Use a local image for one scene; repeat for multiple scenes",
    )
    parser.add_argument("--voice-model", default=None)
    args = parser.parse_args()

    template_data = json.loads(Path(args.template).read_text(encoding="utf-8"))
    story_input = story_video_input_from_dict(template_data)
    overrides = {**story_input.image_paths, **_image_overrides(args.image)}
    if not args.generate_images:
        missing = [scene.scene_id for scene in story_input.scenes if scene.scene_id not in overrides]
        if missing:
            parser.error(
                "Ücretli üretim kapalı ve şu sahnelerde yerel görsel yok: " + ", ".join(missing)
            )
    story_input = replace(
        story_input,
        image_paths=overrides,
        voice_model=args.voice_model or story_input.voice_model,
    )

    print(
        f"[render_story_template] story={story_input.story_id} scenes={len(story_input.scenes)}"
    )
    result = OpenMontageProvider().generate_story(story_input)
    print(
        f"[render_story_template] OK -> {result.asset_uri} "
        f"({result.width}x{result.height}, {result.duration_ms}ms)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
