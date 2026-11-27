"""muaban_probe 순수 함수 시험 — 네트워크 없음."""
import json
import unittest

import muaban_probe as p


def page(obj):
    return '<html><script id="__NEXT_DATA__" type="application/json">' + json.dumps(obj) + "</script></html>"


class MuabanProbeTest(unittest.TestCase):
    def test_block_detection(self):
        self.assertTrue(p.is_blocked(403, ""))
        self.assertTrue(p.is_blocked(429, ""))
        self.assertTrue(p.is_blocked(200, "<html>Please solve the CAPTCHA</html>"))
        self.assertFalse(p.is_blocked(200, "<html>việc làm</html>"))
        # 실제 목록이 담긴 페이지는 머리말의 robots 메타 낱말만으로 차단으로 보지 않는다(2026-11-27 첫 실행 오판).
        self.assertFalse(p.is_blocked(200, '<head><meta name="robots" content="index"></head>' + page({"a": 1})))
        self.assertEqual(p.block_phrase(200, "<title>Just a moment</title>"), "Just a moment")

    def test_find_ads_and_links(self):
        html = page({"props": {"items": [{"id": 1, "title": "Công nhân", "address": "Bắc Ninh"}, {"x": 1}]}})
        ads = []
        p.find_ads(p.next_data(html), ads)
        self.assertEqual([a["id"] for a in ads], [1])
        h = '<a href="/viec-lam/cong-nhan-id123">a</a><a href="/viec-lam/cong-nhan-id123">b</a>'
        self.assertEqual(p.detail_links(h), ["https://muaban.net/viec-lam/cong-nhan-id123"])

    def test_mask_shows_last_three_only(self):
        self.assertEqual(p.mask("0912345678"), "…678(10자리)")
        self.assertEqual(p.mask(None), "없음")
        self.assertTrue(p.is_masked("0912***678"))
        self.assertFalse(p.is_masked("0912345678"))

    def test_summarize_detail_hides_phone(self):
        html = page({"ad": {"id": 9, "title": "Tuyển công nhân", "address": "KCN Quế Võ", "body": "Gọi 0987654321", "phone": "0912***678"}})
        s = p.summarize_detail(html)
        self.assertEqual(s["title"], "Tuyển công nhân")
        self.assertEqual(s["body_phone"], "…321(10자리)")
        self.assertTrue(s["phone_masked"])
        self.assertNotIn("0987654321", json.dumps(s))

    def test_summarize_detail_uses_ad_of_url_id(self):
        html = page({"a": [{"id": 1, "title": "옆 공고", "address": "x", "phone": "0900000111"}, {"id": 2, "title": "이 공고", "address": "y", "phone": "0911222333"}]})
        s = p.summarize_detail(html, "2")
        self.assertTrue(s["matched"])
        self.assertEqual(s["title"], "이 공고")
        self.assertEqual(s["phone"], "…333(10자리)")
        self.assertEqual(p.url_ad_id("https://muaban.net/viec-lam/x/abc-id71399107"), "71399107")

    def test_summarize_detail_unmatched_is_indeterminate(self):
        html = page({"a": [{"id": 1, "title": "옆 공고", "address": "x", "phone": "0900000111"}]}) .replace("</html>", '<a href="tel:0123456789">t</a></html>')
        s = p.summarize_detail(html, "5")
        self.assertFalse(s["matched"])
        self.assertEqual(s["phone"], "없음")
        self.assertEqual(s["page_tel_links"], 1)

    def test_contact_field_is_phone_candidate(self):
        html = page({"a": [{"id": 3, "title": "공고", "address": "x", "contact": "0933***777", "contact_name": "A"}]})
        s = p.summarize_detail(html, "3")
        self.assertTrue(s["phone_masked"])
        self.assertEqual(s["contact_type"], "str")
        html2 = page({"a": [{"id": 4, "title": "공고", "address": "x", "contact": {"phone": "0944555666"}}]})
        self.assertEqual(p.summarize_detail(html2, "4")["phone"], "…666(10자리)")

    def test_contact_dict_fields_are_masked(self):
        html = page({"a": [{"id": 5, "title": "공고", "address": "x", "contact": {"sdt": "0955111222", "name": "B", "hidden": True}}]})
        s = p.summarize_detail(html, "5")
        self.assertEqual(s["contact_fields"], {"sdt": "…222(10자리)", "name": "str", "hidden": "bool"})
        self.assertEqual(s["phone"], "…222(10자리)")
        self.assertNotIn("0955111222", json.dumps(s))


if __name__ == "__main__":
    unittest.main()
