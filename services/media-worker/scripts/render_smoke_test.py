"""Milestone 1 smoke test: local PNG -> OpenMontage/HyperFrames -> FFmpeg -> MP4.

No admin-web/Supabase job queue involved -- this calls the provider directly
so the OpenMontage integration itself can be verified in isolation first.

Usage:
    python scripts/render_smoke_test.py --image path/to/any.png
    python scripts/render_smoke_test.py --generate-image --manifest examples/local_test_manifest.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_MEDIA_WORKER_ROOT = Path(__file__).resolve().parent.parent
if str(_MEDIA_WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(_MEDIA_WORKER_ROOT))

from media_worker.provider import get_provider, register_provider  # noqa: E402
from media_worker.providers.openmontage_provider import OpenMontageProvider  # noqa: E402
from media_worker.render_manifest import media_generation_input_from_dict  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    visual = parser.add_mutually_exclusive_group(required=True)
    visual.add_argument("--image", help="Path to an existing local PNG/JPEG file")
    visual.add_argument(
        "--generate-image",
        action="store_true",
        help="Generate the scene visual through OpenMontage (may call a paid API)",
    )
    parser.add_argument(
        "--manifest",
        default=str(_MEDIA_WORKER_ROOT / "examples" / "local_test_manifest.json"),
        help="Path to a MediaGenerationInput JSON manifest",
    )
    parser.add_argument(
        "--voice-model",
        default=None,
        help=(
            "Piper voice model name. Manifest narration is Turkish; Piper's "
            "own default (en_US-lessac-medium) will mispronounce it. Pass a "
            "tr_TR voice from https://github.com/rhasspy/piper/blob/master/VOICES.md "
            "once you've downloaded one -- left unset only for mechanics-only smoke tests."
        ),
    )
    parser.add_argument("--image-provider", default="openai")
    parser.add_argument("--image-model", default=None)
    parser.add_argument(
        "--image-quality",
        choices=("low", "medium", "high", "auto"),
        default="low",
    )
    parser.add_argument("--image-size", default="1024x1536")
    args = parser.parse_args()

    manifest_data = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    if args.image:
        manifest_data["imagePath"] = args.image
    else:
        manifest_data["imageProvider"] = args.image_provider
        manifest_data["imageQuality"] = args.image_quality
        manifest_data["imageSize"] = args.image_size
        if args.image_model:
            manifest_data["imageModel"] = args.image_model
    if args.voice_model:
        manifest_data["voiceModel"] = args.voice_model
    media_input = media_generation_input_from_dict(manifest_data)

    register_provider(OpenMontageProvider())
    provider = get_provider("openmontage")

    print(f"[render_smoke_test] provider={provider.id} scene={media_input.scene.scene_id}")
    result = provider.generate(media_input)
    print(f"[render_smoke_test] OK -> {result.asset_uri} ({result.width}x{result.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
