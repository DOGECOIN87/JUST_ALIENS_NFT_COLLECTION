#!/usr/bin/env python3
"""Render the exact approved 420-piece selection; no random legacy headwear."""
from pathlib import Path
import runpy,sys
script=Path(__file__).resolve().parent/'production-traits/tools/export_collection.py'
sys.path.insert(0,str(script.parent))
sys.argv=[str(script),*sys.argv[1:]]
runpy.run_path(str(script),run_name='__main__')
