"""Runtime executable discovery for local media generation."""
from __future__ import annotations

import os
import shutil
from pathlib import Path


def ensure_ffmpeg_on_path() -> Path:
    """Return an FFmpeg executable and expose its directory through PATH.

    Normal PATH resolution wins. On Windows we also support an explicit
    MEDIA_WORKER_FFMPEG_PATH and Winget's standard package directory. This
    keeps machine-specific absolute paths out of manifests and source code.
    """
    resolved = shutil.which("ffmpeg")
    if resolved:
        return Path(resolved).resolve()

    configured = os.environ.get("MEDIA_WORKER_FFMPEG_PATH")
    if configured:
        configured_path = Path(configured).expanduser()
        configured_candidate = (
            configured_path if configured_path.suffix.lower() == ".exe" else configured_path / "ffmpeg.exe"
        )
        try:
            if configured_candidate.is_file():
                ffmpeg_dir = str(configured_candidate.resolve().parent)
                os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
                return configured_candidate.resolve()
        except OSError:
            pass

    local_app_data = os.environ.get("LOCALAPPDATA")
    if os.name == "nt" and local_app_data:
        packages_dir = Path(local_app_data) / "Microsoft" / "WinGet" / "Packages"
        try:
            winget_candidates = packages_dir.glob("Gyan.FFmpeg_*/*/bin/ffmpeg.exe")
            for candidate in winget_candidates:
                if candidate.is_file():
                    ffmpeg_dir = str(candidate.resolve().parent)
                    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
                    return candidate.resolve()
        except OSError:
            # Sandboxed processes may see LOCALAPPDATA but be denied access.
            # Fall through to the actionable error below.
            pass

    raise RuntimeError(
        "FFmpeg bulunamadı. ffmpeg'i PATH'e ekleyin veya "
        "MEDIA_WORKER_FFMPEG_PATH ortam değişkenine ffmpeg.exe ya da bin klasörünü verin."
    )
