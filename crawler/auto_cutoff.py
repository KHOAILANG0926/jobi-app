"""Lee 2026-11-01: 자동 작업은 config/auto-processing-cutoff.json 시각 이후에 만든 공고만 다룬다(기존 공고 보호)."""
import json
import re
from pathlib import Path

AUTO_CUTOFF = json.loads((Path(__file__).resolve().parent.parent / "config" / "auto-processing-cutoff.json")
                         .read_text(encoding="utf-8"))["created_after"]
if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", AUTO_CUTOFF):
    raise RuntimeError("auto-processing-cutoff.json created_after 형식 오류")
