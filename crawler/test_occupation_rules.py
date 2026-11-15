"""occupation_rules.json·occupation_rule_cases.json(주간 자동 보강이 고치는 데이터) 시험. 표준 라이브러리만 — 열쇠 없는 상자에서 돈다.
실행: cd crawler && python3 -m unittest test_occupation_rules
(크롤러 연결 시험은 test_occupation_classifier — 의존성 설치 필요)

- 기준 사례(BASELINE)는 이 .py에 고정한다. 주간 작업은 .py를 못 고치므로 규칙을 지우거나 넓혀 기준이 깨지면 병합 전에 실패한다(S4 독립 검토 7회 지적 2).
- 데이터에는 정규식을 두지 않는다. 낱말 묶음 형식 밖(정규식 기호·빈 일치·한 낱말 경계 없음)은 불러올 때 거절된다(7회 지적 1).
"""
import json
import tempfile
import time
import unittest
from pathlib import Path

import occupation_classifier as oc
from occupation_classifier import RULES, classify_occupation

HERE = Path(__file__).resolve().parent
CODES = {c['code']: c for c in json.loads((HERE.parent / 'data/occupations/34-2020/occupation_codes.json').read_text('utf-8'))}
RULE_DATA = json.loads((HERE / 'occupation_rules.json').read_text('utf-8'))
# 데이터 사례(주간 작업이 더함): title, (source_text), code(null=미분류여야 함), evidence(원문 글자 그대로)
CASES = json.loads((HERE / 'occupation_rule_cases.json').read_text('utf-8'))

# 고정 기준 사례 (제목, 원문, 기대 코드 또는 None, 기대 근거 또는 None) — test_occupation_classifier의 기준과 같은 값
BASELINE = [
    ('CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', '', '82022', 'làm linh kiện tai nghe'),
    ('Tuyển THỢ HÀN gấp', '', '7212', 'THỢ HÀN'),
    ('Cần tuyển Phụ Bếp nhà hàng', '', '9402', 'Phụ Bếp'),
    ('tuyen tai xe container', '', '8332', 'tai xe container'),
    ('Tuyển Shipper khu vực Bắc Ninh', '', '9621', 'Shipper'),
    ('Nhân viên pha chế ca tối', '', '5132', 'pha chế'),
    ('Tuyển công nhân đóng gói', '', '9321', 'đóng gói'),
    ('TUYỂN LỄ TÂN KHÁCH SẠN', '', '4226', 'LỄ TÂN'),
    ('Tuyển công nhân hàn', '', '7212', None),
    ('Tuyển công nhân sản xuất', '', '9329', None),
    ('Lái xe tải 5 tấn', '', '8332', None),
    ('Tuyển lái xe 7 chỗ', '', '8322', None),
    ('Tuyển lái xe nâng', '', '8344', None),
    ('Kế toán trưởng', '', '2411', None),
    ('Nhân viên kế toán', '', '4311', None),
    ('Tuyển bảo vệ ca đêm', '', '5401', None),
    ('TUYỂN GẤP 20 NGƯỜI', 'Vị trí: thợ hàn TIG\nLương 12tr', '7212', 'thợ hàn'),
    ('tuyen tho han luong cao', '', '7212', 'tho han'),
    ('Tuyển gấp nhiều vị trí lương cao', 'Liên hệ 0901234567', None, None),
    ('', '', None, None),
    ('KCN VSIP Bắc Ninh tuyển dụng', 'Công ty TNHH Điện tử Samsung', None, None),
    ('Tuyển gấp', 'Có bảo vệ trông xe, gần chợ bán hàng', None, None),
]


def _with_rules(data):
    """임시 규칙 데이터로 불러오기 — 형식 검사가 거절하면 ValueError"""
    path = Path(tempfile.mkdtemp()) / 'rules.json'
    path.write_text(json.dumps(data), 'utf-8')
    saved = oc._RULES_FILE
    try:
        oc._RULES_FILE = path
        return oc._load_rules()
    finally:
        oc._RULES_FILE = saved
        path.unlink()


class OccupationRuleDataTests(unittest.TestCase):
    def test_every_rule_code_is_official(self):
        for rule in RULES:
            self.assertIn(rule.code, CODES, f'공식 목록에 없는 코드: {rule.code}')
            self.assertGreaterEqual(CODES[rule.code]['level'], 4, f'4·5단계만 사용: {rule.code}')

    def test_rule_names_are_official(self):
        for r in RULE_DATA:
            if r.get('name'):
                self.assertEqual(r['name'], CODES[r['code']]['name_vi'], f'공식 명칭과 다름: {r["code"]}')

    def test_baseline_fixed_cases(self):
        for title, body, code, evidence in BASELINE:
            got = classify_occupation(title, body)
            if code is None:
                self.assertIsNone(got, title)
                continue
            self.assertIsNotNone(got, title)
            self.assertEqual(got['occupation_code'], code, title)
            if evidence is not None:
                self.assertEqual(got['occupation_evidence'], evidence, title)
            self.assertIn(got['occupation_evidence'], title + '\n' + body, title)

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

    def test_malicious_rule_data_rejected(self):
        bad = [
            [],                                                        # 규칙 전부 삭제
            [{'code': '9329', 'phrases': ['(\\w+\\s?)+$']}],           # 정규식(멈춤)
            [{'code': '9329', 'phrases': ['a*']}],                     # 정규식 기호
            [{'code': '9329', 'phrases': ['']}],                       # 빈 일치
            [{'code': '9329', 'phrases': ['*a*']}],                    # 경계 없는 한 글자 = 거의 모든 제목
            [{'code': '9329', 'phrases': ['cong  nhan']}],             # 빈칸 두 개
            [{'code': '9329', 'phrases': []}],
            [{'code': '9329', 'phrases': ['x' * 61]}],
            [{'code': '9329', 'phrases': ['cong nhan'], 'pattern': '.*'}],  # 정해진 칸 밖
            [{'code': '9329', 'phrases': 'cong nhan'}],                # 목록이 아님
            [{'code': 'x', 'phrases': ['cong nhan']}],
            [{'code': '9329', 'phrases': ['cong nhan'], 'title_only': 'yes'}],
        ]
        for data in bad:
            with self.assertRaises(ValueError, msg=repr(data)):
                _with_rules(data)

    def test_no_slow_match(self):
        # 긴 제목에서도 빨리 끝나야 한다(멈춤 없음)
        long_title = ('cong nhan ' * 2000) + '!'
        t0 = time.monotonic()
        classify_occupation(long_title, 'a ' * 5000)
        self.assertLess(time.monotonic() - t0, 2.0)


if __name__ == '__main__':
    unittest.main()
