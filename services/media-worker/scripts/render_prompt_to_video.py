"""One prompt -> structured story template -> images -> Turkish voice -> MP4."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_MEDIA_WORKER_ROOT = Path(__file__).resolve().parent.parent
_REPO_ROOT = _MEDIA_WORKER_ROOT.parent.parent
_DEFAULT_ENV_FILE = _REPO_ROOT / "apps" / "admin-web" / ".env.local"
if str(_MEDIA_WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(_MEDIA_WORKER_ROOT))

from media_worker.providers.openmontage_provider import OpenMontageProvider  # noqa: E402
from media_worker.render_manifest import story_video_input_to_dict  # noqa: E402
from media_worker.story_planner import PromptStoryPlanner  # noqa: E402

_OPENAI_ENV_KEYS = {"OPENAI_API_KEY", "OPENAI_PRODUCER_MODEL", "OPENAI_REVIEWER_MODEL"}


def _load_openai_environment(path: Path) -> None:
    """Load only planner-related values, never unrelated admin secrets."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        if name in _OPENAI_ENV_KEYS and name not in os.environ:
            os.environ[name] = value.strip().strip('"').strip("'")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", required=True, help="One Turkish story idea")
    parser.add_argument(
        "--env-file",
        default=str(_DEFAULT_ENV_FILE),
        help="Local env file used only for OPENAI_API_KEY and planner model names",
    )
    parser.add_argument("--model", default=None, help="OpenAI text model override")
    parser.add_argument("--reviewer-model", default=None, help="OpenAI Turkish editor model override")
    parser.add_argument("--character-description", default="")
    parser.add_argument("--visual-style", default="")
    parser.add_argument("--image-provider", default="openai")
    parser.add_argument("--image-model", default=None)
    parser.add_argument(
        "--image-quality",
        choices=("low", "medium", "high", "auto"),
        default="low",
    )
    parser.add_argument("--image-size", default="1024x1536")
    parser.add_argument(
        "--voice-model",
        default=str(_MEDIA_WORKER_ROOT / "voices" / "tr_TR-dfki-medium.onnx"),
    )
    parser.add_argument(
        "--plan-only",
        action="store_true",
        help="Create and save the story template without generating images/video",
    )
    args = parser.parse_args()
    _load_openai_environment(Path(args.env_file).resolve())

    voice_model = Path(args.voice_model).resolve()
    if not voice_model.is_file() and not args.plan_only:
        parser.error(f"Türkçe ses modeli bulunamadı: {voice_model}")

    print("[render_prompt_to_video] planning story from one prompt")
    story_input = PromptStoryPlanner().generate(
        args.prompt,
        model=args.model,
        reviewer_model=args.reviewer_model,
        character_description=args.character_description,
        visual_style=args.visual_style,
        image_provider=args.image_provider,
        image_model=args.image_model,
        image_quality=args.image_quality,
        image_size=args.image_size,
        voice_model=str(voice_model),
    )
    story_dir = _MEDIA_WORKER_ROOT / "renders" / story_input.story_id
    story_dir.mkdir(parents=True, exist_ok=True)
    template_path = story_dir / "story-template.json"
    template_path.write_text(
        json.dumps(story_video_input_to_dict(story_input), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[render_prompt_to_video] template -> {template_path}")
    if args.plan_only:
        print("[render_prompt_to_video] OK (plan only)")
        return 0

    result = OpenMontageProvider().generate_story(story_input)
    print(
        f"[render_prompt_to_video] OK -> {result.asset_uri} "
        f"({result.width}x{result.height}, {result.duration_ms}ms)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
