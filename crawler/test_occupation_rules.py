"""occupation_rules.json·occupation_rule_cases.json(주간 자동 보강이 고치는 데이터) 시험. 표준 라이브러리만 — 열쇠 없는 상자에서 돈다.
실행: cd crawler && python3 -m unittest test_occupation_rules
(크롤러 연결 시험은 test_occupation_classifier — 의존성 설치 필요)"""
import json
import re
import unittest
from pathlib import Path

from occupation_classifier import RULES, classify_occupation

HERE = Path(__file__).resolve().parent
CODES = {c['code']: c for c in json.loads((HERE.parent / 'data/occupations/34-2020/occupation_codes.json').read_text('utf-8'))}
RULE_DATA = json.loads((HERE / 'occupation_rules.json').read_text('utf-8'))
# 실제 제목 사례: title, (source_text), code(null=미분류여야 함), evidence(원문 글자 그대로)
CASES = json.loads((HERE / 'occupation_rule_cases.json').read_text('utf-8'))


class OccupationRuleDataTests(unittest.TestCase):
    def test_every_rule_code_is_official(self):
        for rule in RULES:
            self.assertIn(rule.code, CODES, f'공식 목록에 없는 코드: {rule.code}')
            self.assertGreaterEqual(CODES[rule.code]['level'], 4, f'4·5단계만 사용: {rule.code}')

    def test_rule_data_shape(self):
        # 규칙 JSON은 정해진 칸만(코드·정규식·title_only·공식 명칭), 정규식은 짧고 컴파일돼야 한다
        self.assertIsInstance(RULE_DATA, list)
        for r in RULE_DATA:
            self.assertLessEqual(set(r), {'code', 'pattern', 'title_only', 'name'}, r)
            self.assertIsInstance(r['pattern'], str)
            self.assertLessEqual(len(r['pattern']), 400, r['code'])
            re.compile(r['pattern'])
            self.assertIsInstance(r.get('title_only', False), bool)
            if r.get('name'):
                self.assertEqual(r['name'], CODES[r['code']]['name_vi'], f'공식 명칭과 다름: {r["code"]}')

    def test_cases_from_data(self):
        self.assertIsInstance(CASES, list)
        for c in CASES:
            self.assertLessEqual(set(c), {'title', 'source_text', 'code', 'evidence'}, c)
            got = classify_occupation(c['title'], c.get('source_text', ''))
            if c.get('code') is None:
                self.assertIsNone(got, c['title'])
                continue
            self.assertEqual(got, {'occupation_code': c['code'], 'occupation_evidence': c['evidence']}, c['title'])
            self.assertIn(got['occupation_evidence'], c['title'] + '\n' + c.get('source_text', ''), c['title'])

