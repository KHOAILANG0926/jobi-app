"""한국 페북 조사(korea_fb_survey) 오프라인 시험 — 네트워크·브라우저·열쇠 없이 판정만 본다.

- 중복 열쇠: 실제로 겹쳤던 글 2쌍(접힌 글 / 펼친 글)이 같은 열쇠, 다른 글은 다른 열쇠
- AI 답 거르기: 목록 밖 갈래·없는 번호는 버리고, 열쇠가 없으면 '분류 안 됨'
- 보고: 예전 낱말 갈래로 저장된 글은 'legacy'로 모여 표에서 사라지지 않음
"""
from __future__ import annotations

import sys
import tempfile
import types
from pathlib import Path


class _Any(types.ModuleType):  # 브라우저·수집기 모듈 자리 채우기(이 시험은 그 기능을 쓰지 않음)
    def __getattr__(self, name):
        return "" if name.isupper() else (lambda *a, **k: None)  # 대문자 이름은 화면 읽기 JS 문자열


for _m in ("playwright", "playwright.async_api", "playwright_stealth", "crawl_facebook", "supabase"):
    sys.modules[_m] = _Any(_m)
sys.path.insert(0, str(Path(__file__).resolve().parent))

import korea_fb_survey as k  # noqa: E402

fails = []


def check(name, ok):
    print(("ok  " if ok else "FAIL") + " " + name)
    if not ok:
        fails.append(name)


# 1. 중복 열쇠 — 2026-11-11 조사에서 실제로 두 번 잡힌 글
a = "𝐒𝐚̂𝐦 𝐓𝐮̛𝐨̛𝐢 𝐧𝐚̀𝐨 𝐜𝐚̉ 𝐧𝐡𝐚̀ 𝐨̛𝐢𝐢𝐢Bên em sẵn đầy đủ các size sâm tươi từ 2 củ đến 10 củ/kg.Đủ tất cả các dòng:… 더 보기"
b = "𝐒𝐚̂𝐦 𝐓𝐮̛𝐨̛𝐢 𝐧𝐚̀𝐨 𝐜𝐚̉ 𝐧𝐡𝐚̀ 𝐨̛𝐢𝐢𝐢 Bên em sẵn đầy đủ các size sâm tươi từ 2 củ đến 10 củ/kg. Đủ tất cả các dòng: * Sâm thân dài"
c = "Ăn vặt không thể thiếu chân gà bà Tuyết nha cả nhàNay em về nhiều"
d = "Ăn vặt không thể thiếu chân gà bà Tuyết nha cả nhà Nay em về nhiều"
check("겹친 글 1쌍 같은 열쇠", k.dedupe_key(a) == k.dedupe_key(b))
check("겹친 글 2쌍 같은 열쇠", k.dedupe_key(c) == k.dedupe_key(d))
check("다른 글 다른 열쇠", k.dedupe_key("Cho em hỏi công ty này ổn không") != k.dedupe_key(c))

# 2. AI 답 거르기
posts = [{"text": "Gà dai 7k/1 con"}, {"text": "Đi diện E9 đơn xây dựng thì có đợi lâu không"}, {"text": "x"}]
k._ai_call = lambda p: 'Đây: [{"i":0,"c":"sell","w":"kr"},{"i":1,"c":"di_han","w":"vn"},{"i":2,"c":"bogus","w":"kr"},{"i":9,"c":"sell"}]'
k.ai_classify(posts)
check("맞는 답은 반영", (posts[0]["class"], posts[0]["writer"]) == ("sell", "kr") and (posts[1]["class"], posts[1]["writer"]) == ("di_han", "vn"))
check("목록 밖 갈래는 분류 안 됨", posts[2]["class"] == "unclassified")
k._ai_call = lambda p: None
k.ai_classify(posts)
check("열쇠 없음 → 모두 분류 안 됨", all(p["class"] == "unclassified" and p["writer"] == "unk" for p in posts))

# 3. 보고 — 예전 낱말 갈래 글
rows = {
    k.KIND_POST: [{"payload": {"class": "company_q", "gid": "g1", "group": "G", "text": "cũ"}},
                  {"payload": {"class": "other", "gid": "g1", "group": "G", "text": "cũ regex"}},  # 이름은 같아도 writer 없음 = 예전 저장분
                  {"payload": {"class": "life", "writer": "kr", "gid": "g1", "group": "G", "text": "mới"}}],
    k.KIND_GROUP: [{"name": "g1", "meta": {"visits": 1}, "payload": {"members": 1000}}],
}
k._rows = lambda kind: rows.get(kind, [])
with tempfile.TemporaryDirectory() as tmp:
    res = k.report(str(Path(tmp) / "r.json"))
check("예전 갈래는 legacy로 모임", res["by_class"] == {"legacy": 2, "life": 1})

if fails:
    sys.exit(f"{len(fails)}개 실패: {fails}")
print("모두 통과")
