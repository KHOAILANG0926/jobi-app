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


if __name__ == "__main__":
    unittest.main()
