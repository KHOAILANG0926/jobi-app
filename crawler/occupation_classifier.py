"""공고 → 베트남 공식 직업코드(QĐ 34/2020/QĐ-TTg) 자동 분류 (규칙 R8의 입력).

- 결과는 (코드, 원문 근거) 또는 None. 근거는 공고 제목/원문에서 **그대로 잘라낸 글자**다(가공 금지).
  DB 트리거(R8)가 근거가 실제 원문에 있는지, 코드가 occupation_master에 있는지 다시 검사한다.
- 모르면 None(미분류). 'other' 같은 기본값을 붙이지 않는다.
- 회사명·공단명(KCN)·업종으로 추정하지 않는다 — 제목과 공고 원문만 본다.
- 제목에서 먼저 찾고, 제목에 없을 때만 원문 앞부분을 본다. 원문에서 흔히 다른 뜻으로 나오는 말
  ("bảo vệ", "bán hàng", "phục vụ", "văn phòng" 등)은 제목에서만 인정한다(title_only).
- 코드는 모두 data/occupations/34-2020/occupation_codes.json 에 있는 것만 쓴다(테스트가 강제).
- 규칙(occupation_rules.json) 목록은 순서가 우선순위다(구체적인 것 먼저, "công nhân" 같은 포괄 규칙은 맨 끝).
"""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

BODY_SCAN_CHARS = 1500


@dataclass(frozen=True)
class Rule:
    code: str
    pattern: str            # 성조·대소문자를 뺀 글자 기준 정규식
    title_only: bool = False


# 규칙 데이터는 occupation_rules.json(코드·정규식·title_only·공식 명칭)에 둔다 — 주간 자동 보강(occupation-weekly-unclassified)은
# 이 JSON과 사례 JSON만 고칠 수 있다(코드는 못 바꿈, S4 3차 독립 검토 6회 지적: 비신뢰 공고 제목 → Claude → 병합 뒤 크롤러에서 실행되는 코드).
# 명칭은 시험에서 공식 목록과 대조한다. 목록 순서가 우선순위다.
_RULES_FILE = Path(__file__).with_name('occupation_rules.json')
RULES: list[Rule] = [
    Rule(str(r['code']), str(r['pattern']), bool(r.get('title_only', False)))
    for r in json.loads(_RULES_FILE.read_text('utf-8'))
]
_COMPILED = [(r, re.compile(r.pattern)) for r in RULES]


def _fold(text: str) -> tuple[str, list[int]]:
    """성조·대소문자 제거. 접힌 글자 각각이 원문 몇 번째 글자에서 왔는지 함께 돌려준다."""
    out, index = [], []
    for i, ch in enumerate(unicodedata.normalize('NFC', text or '')):
        base = 'd' if ch in 'đĐ' else ''.join(c for c in unicodedata.normalize('NFD', ch) if unicodedata.category(c) != 'Mn')
        for c in base.lower():
            out.append(c)
            index.append(i)
    return ''.join(out), index


def _find(text: str, allow_title_only: bool) -> tuple[str, str] | None:
    folded, index = _fold(text)
    original = unicodedata.normalize('NFC', text or '')
    for rule, regex in _COMPILED:
        if rule.title_only and not allow_title_only:
            continue
        m = regex.search(folded)
        if m:
            start, end = index[m.start()], index[m.end() - 1] + 1
            return rule.code, original[start:end]
    return None


def classify_occupation(title: str, source_text: str = '') -> dict | None:
    """{'occupation_code', 'occupation_evidence'} 또는 None(미분류)."""
    hit = _find(title, allow_title_only=True) or _find((source_text or '')[:BODY_SCAN_CHARS], allow_title_only=False)
    if not hit:
        return None
    code, evidence = hit
    return {'occupation_code': code, 'occupation_evidence': evidence}


def occupation_fields(job: dict) -> dict:
    """크롤러 저장용: local_jobs.occupation_code / occupation_evidence 두 칸(미분류면 둘 다 None).
    제목과 원문(source_text, 없으면 description)만 본다 — 회사명은 넘기지 않는다."""
    got = classify_occupation(job.get('title') or '', job.get('source_text') or job.get('description') or '')
    return got or {'occupation_code': None, 'occupation_evidence': None}
