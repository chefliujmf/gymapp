#!/usr/bin/env python3
"""Shared helper for loading ignored local .env files used by the coach tools.

Both the Intervals.icu tool and the Centr scraper read secrets from local,
git-ignored env files. The parsing logic lives here so the two callers cannot
drift apart; each passes its own tuple of candidate paths.
"""

from __future__ import annotations

import os
from pathlib import Path


def load_local_env_files(paths: tuple[Path, ...]) -> None:
    """Load ignored local env files without overriding already-exported values."""
    for path in paths:
        if not path.exists():
            continue
        for raw_line in path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export ") :].strip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value
