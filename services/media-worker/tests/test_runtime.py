from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from media_worker.runtime import ensure_ffmpeg_on_path


class RuntimeTests(unittest.TestCase):
    def test_explicit_ffmpeg_file_is_added_to_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            ffmpeg = Path(temp_dir) / "ffmpeg.exe"
            ffmpeg.touch()
            with patch("media_worker.runtime.shutil.which", return_value=None), patch.dict(
                os.environ,
                {"MEDIA_WORKER_FFMPEG_PATH": str(ffmpeg), "PATH": "existing"},
                clear=False,
            ):
                resolved = ensure_ffmpeg_on_path()

                self.assertEqual(resolved, ffmpeg.resolve())
                self.assertTrue(os.environ["PATH"].startswith(str(ffmpeg.parent.resolve())))


if __name__ == "__main__":
    unittest.main()
