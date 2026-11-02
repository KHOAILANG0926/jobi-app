#!/usr/bin/env python3
"""미분류 공고(occupation_code is null)에 자동 분류 결과를 채우는 SQL을 만든다 (규칙 R8).

입력(stdin): psql이 뽑은 JSON 배열 [{"id", "title", "source_text", "created_at"}, ...]
기존 공고 보호(Lee 2026-11-01, config/auto-processing-cutoff.json): 기준 시각 전에 만든 공고는 건드리지 않는다.
created_at이 없거나 읽을 수 없는 행도 건드리지 않는다(보호 쪽으로).
출력(stdout): update SQL. 직업코드 두 칸만 바꾼다(공개 상태·다른 칸은 그대로). 이미 분류된 행은 건드리지 않는다.
분류가 안 되는 공고는 그대로 미분류로 둔다. DB 트리거(R8)가 근거를 다시 검사한다.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'crawler'))
from occupation_classifier import classify_occupation  # noqa: E402


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


ROOT = Path(__file__).resolve().parents[2]


def cutoff() -> datetime:
    return parse_time(json.loads((ROOT / 'config' / 'auto-processing-cutoff.json').read_text(encoding='utf-8'))['created_after'])


def parse_time(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None


def protected(row, limit: datetime) -> bool:
    """기준 시각 이전(또는 시각 불명) 공고는 보호 대상."""
    made = parse_time(row.get('created_at'))
    return made is None or made.tzinfo is None or made <= limit


def main():
    rows = json.loads(sys.stdin.read() or '[]') or []
    limit = cutoff()
    skipped = 0
    done = 0
    print('begin;')
    for row in rows:
        if protected(row, limit):
            skipped += 1
            continue
        got = classify_occupation(row.get('title') or '', row.get('source_text') or '')
        if not got:
            continue
        done += 1
        print(f"update public.local_jobs set occupation_code = {q(got['occupation_code'])}, "
              f"occupation_evidence = {q(got['occupation_evidence'])} where id = {int(row['id'])} and occupation_code is null;")
    print('commit;')
    print(f'backfill: {len(rows)} unclassified, {skipped} protected (before {limit.isoformat()}), {done} classified', file=sys.stderr)


if __name__ == '__main__':
    main()
