#!/usr/bin/env python3
"""미분류 공고(occupation_code is null)에 자동 분류 결과를 채우는 SQL을 만든다 (규칙 R8).

입력(stdin): psql이 뽑은 JSON 배열 [{"id", "title", "source_text"}, ...]
출력(stdout): update SQL. 직업코드 두 칸만 바꾼다(공개 상태·다른 칸은 그대로). 이미 분류된 행은 건드리지 않는다.
분류가 안 되는 공고는 그대로 미분류로 둔다. DB 트리거(R8)가 근거를 다시 검사한다.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'crawler'))
from occupation_classifier import classify_occupation  # noqa: E402


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def main():
    rows = json.loads(sys.stdin.read() or '[]') or []
    done = 0
    print('begin;')
    for row in rows:
        got = classify_occupation(row.get('title') or '', row.get('source_text') or '')
        if not got:
            continue
        done += 1
        print(f"update public.local_jobs set occupation_code = {q(got['occupation_code'])}, "
              f"occupation_evidence = {q(got['occupation_evidence'])} where id = {int(row['id'])} and occupation_code is null;")
    print('commit;')
    print(f'backfill: {len(rows)} unclassified, {done} classified', file=sys.stderr)


if __name__ == '__main__':
    main()
