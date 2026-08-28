from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.render_prompt_to_video import _load_openai_environment


class PromptScriptEnvironmentTests(unittest.TestCase):
    def test_loads_only_openai_planner_values(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            env_file = Path(temp_dir) / ".env.local"
            env_file.write_text(
                "OPENAI_API_KEY='test-key'\n"
                "OPENAI_PRODUCER_MODEL=gpt-test\n"
                "SUPABASE_SERVICE_ROLE_KEY=must-not-load\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {}, clear=True):
                _load_openai_environment(env_file)

                self.assertEqual(os.environ["OPENAI_API_KEY"], "test-key")
                self.assertEqual(os.environ["OPENAI_PRODUCER_MODEL"], "gpt-test")
                self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", os.environ)


if __name__ == "__main__":
    unittest.main()
