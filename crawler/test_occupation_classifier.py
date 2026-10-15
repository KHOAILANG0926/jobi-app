"""occupation_classifier 오프라인 시험. 실행: cd crawler && python3 -m unittest test_occupation_classifier"""
import json
import unittest
from pathlib import Path

from occupation_classifier import RULES, classify_occupation, occupation_fields

ROOT = Path(__file__).resolve().parents[1]
CODES = {c['code']: c for c in json.loads((ROOT / 'data/occupations/34-2020/occupation_codes.json').read_text('utf-8'))}


class OccupationClassifierTests(unittest.TestCase):
    def test_every_rule_code_is_official(self):
        for rule in RULES:
            self.assertIn(rule.code, CODES, f'공식 목록에 없는 코드: {rule.code}')
            self.assertGreaterEqual(CODES[rule.code]['level'], 4, f'4·5단계만 사용: {rule.code}')

    def test_job_4824_original_text(self):
        # 운영 #4824 제목 원문 그대로 (2026-10-15 운영 DB 읽기로 확인)
        got = classify_occupation('CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong')
        self.assertEqual(got, {'occupation_code': '82022', 'occupation_evidence': 'làm linh kiện tai nghe'})

    def test_evidence_is_exact_original_substring(self):
        cases = ['Tuyển THỢ HÀN gấp', 'Cần tuyển Phụ Bếp nhà hàng', 'tuyen tai xe container', 'Tuyển Shipper khu vực Bắc Ninh',
                 'Nhân viên pha chế ca tối', 'Tuyển công nhân đóng gói', 'TUYỂN LỄ TÂN KHÁCH SẠN']
        for title in cases:
            got = classify_occupation(title)
            self.assertIsNotNone(got, title)
            self.assertIn(got['occupation_evidence'], title, title)

    def test_priority_specific_before_generic(self):
        self.assertEqual(classify_occupation('Tuyển công nhân hàn')['occupation_code'], '7212')
        self.assertEqual(classify_occupation('Tuyển công nhân đóng gói')['occupation_code'], '9321')
        self.assertEqual(classify_occupation('Tuyển công nhân sản xuất')['occupation_code'], '9329')
        self.assertEqual(classify_occupation('Lái xe tải 5 tấn')['occupation_code'], '8332')
        self.assertEqual(classify_occupation('Tuyển lái xe 7 chỗ')['occupation_code'], '8322')
        self.assertEqual(classify_occupation('Tuyển lái xe nâng')['occupation_code'], '8344')
        self.assertEqual(classify_occupation('Kế toán trưởng')['occupation_code'], '2411')
        self.assertEqual(classify_occupation('Nhân viên kế toán')['occupation_code'], '4311')

    def test_unknown_is_none_not_other(self):
        self.assertIsNone(classify_occupation('Tuyển gấp nhiều vị trí lương cao', 'Liên hệ 0901234567'))
        self.assertIsNone(classify_occupation(''))

    def test_company_or_kcn_alone_is_not_used(self):
        # 회사명·공단명은 입력으로 받지 않는다. 제목에 직무가 없으면 미분류.
        self.assertIsNone(classify_occupation('KCN VSIP Bắc Ninh tuyển dụng', 'Công ty TNHH Điện tử Samsung'))

    def test_title_only_words_ignored_in_body(self):
        self.assertIsNone(classify_occupation('Tuyển gấp', 'Có bảo vệ trông xe, gần chợ bán hàng'))
        self.assertEqual(classify_occupation('Tuyển bảo vệ ca đêm')['occupation_code'], '5401')

    def test_body_used_when_title_has_no_job(self):
        got = classify_occupation('TUYỂN GẤP 20 NGƯỜI', 'Vị trí: thợ hàn TIG\nLương 12tr')
        self.assertEqual(got, {'occupation_code': '7212', 'occupation_evidence': 'thợ hàn'})

    def test_unaccented_input(self):
        got = classify_occupation('tuyen tho han luong cao')
        self.assertEqual(got, {'occupation_code': '7212', 'occupation_evidence': 'tho han'})

    def test_occupation_fields_for_crawler_payload(self):
        self.assertEqual(occupation_fields({'title': 'Tuyển gấp', 'source_text': 'Cần tuyển phụ bếp ca tối', 'company': 'Nhà hàng Bếp Việt'}),
                         {'occupation_code': '9402', 'occupation_evidence': 'phụ bếp'})
        # 회사명만 직무처럼 보여도 쓰지 않는다
        self.assertEqual(occupation_fields({'title': 'Tuyển gấp', 'company': 'Công ty Bảo Vệ Long Hải'}),
                         {'occupation_code': None, 'occupation_evidence': None})
        # source_text가 없으면 description을 본다(VietnamWorks 경로)
        self.assertEqual(occupation_fields({'title': 'Tuyển gấp', 'description': 'Vị trí: thợ hàn'})['occupation_code'], '7212')

    def test_facebook_parse_post_carries_occupation(self):
        import crawl_facebook
        job = crawl_facebook.parse_post({'text': 'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong\nLiên hệ 0877880756',
                                         'images': [], 'location': 'Bắc Ninh'})
        self.assertEqual((job['occupation_code'], job['occupation_evidence']), ('82022', 'làm linh kiện tai nghe'))


if __name__ == '__main__':
    unittest.main()
