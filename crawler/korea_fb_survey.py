"""
한국 거주 베트남인 페이스북 그룹 조사 (읽기 전용, 저장 없음) — Lee 2026-11-11 한국 사이트 조사.
Lee 컴퓨터가 꺼져 있어도 VPS 실행기에서 돈다(crawl-facebook-one과 같은 쿠키·같은 IP).
- 그룹 검색: 그룹 수·회원 수·하루 글 수
- 큰 그룹 몇 곳: 만든 날·오늘/지난달 글 수·규칙 앞부분 + 최근 글 N개를 낱말로 분류
- 사람 이름·전화번호는 남기지 않는다(글은 앞부분만, 전화번호 가림). DB 저장 없음.
- 계정 잠금(FACEBOOK_ACCOUNT_LOCK)이 있으면 시작하지 않고, 이상이 보이면 잠금을 만든다(수집기와 같은 규칙).
"""
import argparse
import asyncio
import json
import random
import re
import sys
from datetime import datetime
from urllib.parse import quote

from playwright.async_api import async_playwright

from crawl_facebook import (account_lock_reason, advance_feed, build_cookies, extract_visible_posts,
                            goto_with_retry, inspect_page_state, write_account_lock)

try:
    from playwright_stealth import stealth_async
except ImportError:
    async def stealth_async(page): pass

KOREA_NAME = re.compile(r"korea|hàn|seoul|busan|incheon|inchoen|ulsan|ansan|suwon|daegu|daejeon|대전|gwangju|gimhae|changwon|hwaseong|pyeongtaek", re.I)
PHONE = re.compile(r"(?<!\d)(?:\+?\d[\d .\-]{7,}\d)")

# 글 종류(앞에서부터 처음 맞는 것). 조사용 대략 분류 — 숫자는 "대략"으로 보고한다.
CLASSES = [
    # 회사 질문·회사 바꾸기는 구인보다 먼저 본다("이 회사 괜찮나요"가 구인으로 세어지지 않게)
    ("company_q", r"công ty (này|đó|nào|ấy)|xưởng (này|đó|nào)|có ổn không|có tốt không|review|đánh giá công ty|làm ở đó"),
    ("change_co", r"đổi công ty|chuyển công ty|chuyển xưởng|đổi xưởng|xin chuyển|chuyển việc|사업장 변경"),
    ("job", r"tuyển|tìm việc|việc làm|cần (người|tuyển|gấp|thợ)|nhận (lao động|người|thợ)|xin việc|công việc|đi làm|ca ngày|ca đêm|lương|시급|구인|nhân viên"),
    ("money", r"đổi tiền|chuyển tiền|tỷ giá|gửi tiền về|vay"),
    ("room", r"phòng trọ|ở ghép|thuê nhà|cho thuê|원룸|nhà nghỉ"),
    ("visa_doc", r"visa|gia hạn|thẻ người nước ngoài|xuất nhập cảnh|hồ sơ|bảo hiểm|thuế|lương hưu|퇴직금"),
    ("sell", r"\d+\s?kk?\b|\bkg\b|thùng|ship|giải cứu|\bbán\b|giá|order|sale|combo|inbox|lên đơn"),
    ("ask", r"\?|cho (e|em|mình) hỏi|ai biết|xin ý kiến|tư vấn giúp"),
]
CLASS_RE = [(k, re.compile(p, re.I)) for k, p in CLASSES]
VISA_RE = re.compile(r"\b(E-?9|E-?7|E-?8|H-?2|D-?2|D-?4|D-?10|F-?2|F-?4|F-?5|F-?6)\b", re.I)
NO_VISA_RE = re.compile(r"không (cần|yêu cầu) visa|ko cần visa|k cần visa|bất hợp pháp|bhp|không giấy tờ", re.I)


def classify(text: str) -> str:
    for k, rx in CLASS_RE:
        if rx.search(text):
            return k
    return "other"


def mask(text: str) -> str:
    return PHONE.sub("[số]", text)


def parse_members(line: str) -> int:
    m = re.search(r"([\d.,]+)\s*(만|천|K|M)?\s*명?", line)
    if not m:
        return 0
    n = float(m.group(1).replace(",", ""))
    unit = m.group(2)
    return int(n * {"만": 10000, "천": 1000, "K": 1000, "M": 1000000}.get(unit, 1))


SEARCH_JS = """() => {
  const out = new Map()
  document.querySelectorAll('a[href*="/groups/"]').forEach(a => {
    const name = (a.innerText || '').trim()
    if (!name || name === '그룹' || name === 'Nhóm' || name === 'Groups') return
    const id = (a.href.split('/groups/')[1] || '').split(/[/?]/)[0]
    if (!id) return
    let box = a.parentElement
    for (let i = 0; i < 8 && box && !/멤버|thành viên|members/.test(box.innerText || ''); i++) box = box.parentElement
    const meta = ((box && box.innerText) || '').split('\\n').find(l => /멤버|thành viên|members/.test(l)) || ''
    if (!out.has(id)) out.set(id, { id, name: name.slice(0, 80), meta })
  })
  return [...out.values()]
}"""


async def search_groups(page, query: str, scrolls: int) -> list[dict]:
    if not await goto_with_retry(page, f"https://www.facebook.com/search/groups/?q={quote(query)}"):
        return []
    for _ in range(scrolls):
        await page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
        await page.wait_for_timeout(random.randint(1500, 2500))
    rows = await page.evaluate(SEARCH_JS)
    for r in rows:
        r["members"] = parse_members(r["meta"].split("·")[1] if "·" in r["meta"] else r["meta"])
        day = re.search(r"(일일 게시물|bài viết mỗi ngày|posts a day)\s*([\d+개,]+)|([\d+]+)\s*(bài viết mỗi ngày|posts a day)", r["meta"])
        r["daily"] = (day.group(2) or day.group(3)) if day else ""
        r["korea_name"] = bool(KOREA_NAME.search(r["name"]))
        r["query"] = query
    return rows


ABOUT_KEYS = {
    "created": re.compile(r"(\d{4}년 \d{1,2}월 \d{1,2}일에 그룹이 만들어졌습니다|Đã tạo nhóm vào .*|Group created on .*|\d+년 전\s*에 만듦)"),
    "today": re.compile(r"(오늘 올라온 게시물 [\d.,만천]+개|[\d.,]+ bài viết mới hôm nay|[\d.,]+ new posts today)"),
    "month": re.compile(r"(지난달 올라온 게시물 [\d.,만천]+개|[\d.,KM]+ bài viết trong tháng trước|[\d.,KM]+ posts last month)"),
    "total": re.compile(r"(총 멤버 [\d,]+명|Tổng cộng [\d.,]+ thành viên|[\d,]+ total members)"),
}


async def read_about(page, gid: str) -> dict:
    info = {"id": gid}
    if not await goto_with_retry(page, f"https://www.facebook.com/groups/{gid}/about"):
        info["error"] = "load_failed"
        return info
    state = await inspect_page_state(page)
    if state in ("checkpoint", "session_expired"):
        raise RuntimeError(state)
    body = await page.locator('[role="main"]').first.inner_text(timeout=8000)
    for k, rx in ABOUT_KEYS.items():
        m = rx.search(body)
        info[k] = m.group(1) if m else ""
    rules = re.split(r"관리자가 설정한 그룹 규칙|Quy tắc nhóm từ quản trị viên|Group rules from the admins", body)
    info["rules_head"] = mask(rules[1][:400].strip()) if len(rules) > 1 else ""
    # 관리자 '이름'은 남기지 않고, 관리자가 페이지(업체)인지만 본다 — 광고·환전 업체 운영 여부
    admins = next((l for l in body.split("\n") if "관리자입니다" in l or "là quản trị viên" in l or "are admins" in l), "")
    info["admin_business_words"] = sorted(set(re.findall(r"Dịch Vụ|Đổi Tiền|Shop|Store|Company|Công Ty|Visa|Việc Làm", admins, re.I)))
    return info


async def read_recent_posts(page, gid: str, want: int) -> list[dict]:
    if not await goto_with_retry(page, f"https://www.facebook.com/groups/{gid}/?sorting_setting=CHRONOLOGICAL"):
        return []
    state = await inspect_page_state(page)
    if state in ("checkpoint", "session_expired"):
        raise RuntimeError(state)
    seen, out, stall = set(), [], 0
    for _ in range(25):
        got = await extract_visible_posts(page)
        before = len(out)
        for p in got.get("posts", []):
            key = p["text"][:120]
            if key in seen:
                continue
            seen.add(key)
            text = re.sub(r"\s+", " ", p["text"])
            out.append({"class": classify(text), "visa": sorted({v.upper().replace("-", "-") for v in VISA_RE.findall(text)}),
                        "no_visa": bool(NO_VISA_RE.search(text)), "time": p.get("timeLabel", "")[:20],
                        "head": mask(text[:160])})
        if len(out) >= want:
            break
        stall = stall + 1 if len(out) == before else 0
        if stall >= 3:
            break
        await advance_feed(page)
    return out[:want]


# 그룹 안 검색: 이 말이 든 글이 얼마나 있나(상한까지만 센다 — "많다/적다"를 보는 용도)
KEYWORDS = ["công ty này", "có ổn không", "đổi công ty", "tìm việc", "gia hạn visa", "phòng trọ", "đổi tiền", "quảng cáo"]


async def count_keyword(page, gid: str, kw: str, cap: int = 40) -> dict:
    if not await goto_with_retry(page, f"https://www.facebook.com/groups/{gid}/search/?q={quote(kw)}"):
        return {"kw": kw, "count": None}
    state = await inspect_page_state(page)
    if state in ("checkpoint", "session_expired"):
        raise RuntimeError(state)
    seen, heads = set(), []
    for _ in range(6):
        got = await extract_visible_posts(page)
        for p in got.get("posts", []):
            k = p["text"][:120]
            if k not in seen:
                seen.add(k)
                if len(heads) < 3:
                    heads.append({"time": p.get("timeLabel", "")[:20], "head": mask(re.sub(r"\s+", " ", p["text"])[:120])})
        if len(seen) >= cap:
            break
        await advance_feed(page)
    return {"kw": kw, "count": len(seen), "capped": len(seen) >= cap, "samples": heads}


def summarize(groups: list[dict]) -> dict:
    def stat(rows):
        return {"count": len(rows), "ge_100k": sum(r["members"] >= 100_000 for r in rows),
                "ge_10k": sum(r["members"] >= 10_000 for r in rows),
                "daily_90plus": sum("90" in r["daily"] for r in rows)}
    return {"all": stat(groups), "korea_named": stat([g for g in groups if g["korea_name"]])}


async def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queries", default="người việt tại hàn quốc|việc làm hàn quốc|cộng đồng việt nam hàn quốc")
    ap.add_argument("--top", type=int, default=10, help="자세히 볼 큰 그룹 수(한국 이름 그룹, 회원 수 순)")
    ap.add_argument("--posts", type=int, default=100)
    ap.add_argument("--out", default="/tmp/korea_fb_survey.json")
    a = ap.parse_args(argv)

    lock = account_lock_reason()
    if lock:
        print(f"::error title=Facebook 계정 잠금::{lock} — 수집기와 같은 잠금이라 시작하지 않습니다.")
        return 2

    result = {"at": datetime.now().isoformat(timespec="seconds"), "queries": [], "groups": [], "detail": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 800}, locale="ko-KR",
                                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        await ctx.add_cookies(build_cookies())
        page = await ctx.new_page()
        await stealth_async(page)
        try:
            found = {}
            for q in [x.strip() for x in a.queries.split("|") if x.strip()]:
                rows = await search_groups(page, q, scrolls=8)
                print(f"검색 '{q}': 그룹 {len(rows)}개")
                result["queries"].append({"query": q, **summarize(rows)})
                for r in rows:
                    found.setdefault(r["id"], r)
                await page.wait_for_timeout(random.randint(20000, 40000))
            result["groups"] = sorted(found.values(), key=lambda r: -r["members"])
            result["summary"] = summarize(result["groups"])
            targets = [g for g in result["groups"] if g["korea_name"]][: a.top]
            for g in targets:
                about = await read_about(page, g["id"])
                await page.wait_for_timeout(random.randint(8000, 15000))
                posts = await read_recent_posts(page, g["id"], a.posts)
                kws = []
                for kw in KEYWORDS:
                    await page.wait_for_timeout(random.randint(8000, 15000))
                    kws.append(await count_keyword(page, g["id"], kw))
                counts = {}
                for x in posts:
                    counts[x["class"]] = counts.get(x["class"], 0) + 1
                result["detail"].append({**about, "name": g["name"], "members": g["members"], "daily": g["daily"],
                                         "post_counts": counts, "posts_read": len(posts),
                                         "jobs_with_visa": sum(1 for x in posts if x["class"] == "job" and x["visa"]),
                                         "no_visa_posts": sum(1 for x in posts if x["no_visa"]), "keywords": kws, "posts": posts})
                print(f"그룹 {g['name'][:40]}: 글 {len(posts)}개 {counts}")
                await page.wait_for_timeout(random.randint(60000, 120000))  # 수집기와 같은 그룹 간 쉬는 시간
        except RuntimeError as e:
            write_account_lock(str(e), "korea_fb_survey")
            print(f"::error title=Facebook 계정 이상({e})::잠금을 만들고 멈춥니다. 일반 브라우저로 계정 확인 후 쿠키 갱신이 필요합니다.")
            result["stopped"] = str(e)
        finally:
            await browser.close()

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    return 0 if not result.get("stopped") else 3


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
