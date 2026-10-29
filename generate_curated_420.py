#!/usr/bin/env python3
"""Generate the approved 404 normal + 15 rare + 1 secret LMNFT release."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parent/'scripts/build-launchmynft-420.py'),run_name='__main__')
