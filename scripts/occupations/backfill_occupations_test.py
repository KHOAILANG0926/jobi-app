#!/usr/bin/env python3
"""R8 보충의 기존 공고 보호 시험(Lee 2026-11-01 기준 시각). 기준 전·시각 불명 공고는 SQL이 나오지 않아야 한다."""
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import backfill_occupations as b  # noqa: E402

limit = b.cutoff()
rows = [
    {'id': 1, 'title': 'Tuyển dụng nhân viên bán hàng', 'source_text': '', 'created_at': '2026-11-02T12:32:26+00:00'},
    {'id': 2, 'title': 'Tuyển dụng nhân viên bán hàng', 'source_text': '', 'created_at': '2026-10-20T00:00:00+00:00'},
    {'id': 3, 'title': 'Tuyển dụng nhân viên bán hàng', 'source_text': '', 'created_at': None},
]
assert not b.protected(rows[0], limit), 'after cutoff must be processed'
assert b.protected(rows[1], limit), 'before cutoff must be protected'
assert b.protected(rows[2], limit), 'unknown time must be protected'
sys.stdin = io.StringIO(json.dumps(rows))
out = io.StringIO()
sys.stdout, real = out, sys.stdout
try:
    b.main()
finally:
    sys.stdout = real
sql = out.getvalue()
assert 'where id = 1 ' in sql and "'5223'" in sql, sql
assert 'where id = 2 ' not in sql and 'where id = 3 ' not in sql, sql
print('backfill cutoff: protected rows untouched, new row classified (5223)')
