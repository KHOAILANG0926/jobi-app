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

import hashlib
from datetime import timedelta, timezone

import crawl_facebook
from crawl_facebook import (account_lock_reason, advance_feed, build_cookies, expand_visible_posts, extract_visible_posts,
                            inspect_page_state, parse_time_label, write_account_lock)

try:
    from playwright_stealth import stealth_async
except ImportError:
    async def stealth_async(page): pass

# 한국 거주자 그룹만: "hàn"만으로는 "thợ hàn"(용접공)·"tiếng Hàn"(베트남 안 한국어 일자리)이 섞였다(2026-11-11 그룹 목록)
NOT_IN_KOREA = re.compile(r"thợ hàn|bắc ninh|quế võ|hà nội|tp\.?hcm|hồ chí minh|đà nẵng", re.I)
KOREA_NAME = re.compile(r"korea|hàn quốc|tại hàn\b|ở hàn\b|seoul|busan|incheon|inchoen|ulsan|ansan|suwon|daegu|daejeon|대전|gwangju|gimhae|changwon|hwaseong|pyeongtaek", re.I)
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


def is_korea_group(name: str) -> bool:
    """한국 거주자 그룹 판정 한 곳 — 검색 결과·저장된 그룹 모두 이 함수로(저장된 옛 판정은 믿지 않는다)."""
    return bool(KOREA_NAME.search(name)) and not NOT_IN_KOREA.search(name)


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
    if not await open_page(page, f"https://www.facebook.com/search/groups/?q={quote(query)}"):
        return []
    for _ in range(scrolls):
        await page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
        await page.wait_for_timeout(random.randint(1500, 2500))
    rows = await page.evaluate(SEARCH_JS)
    for r in rows:
        r["members"] = parse_members(r["meta"].split("·")[1] if "·" in r["meta"] else r["meta"])
        day = re.search(r"(일일 게시물|bài viết mỗi ngày|posts a day)\s*([\d+개,]+)|([\d+]+)\s*(bài viết mỗi ngày|posts a day)", r["meta"])
        r["daily"] = (day.group(2) or day.group(3)) if day else ""
        r["korea_name"] = is_korea_group(r["name"])
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
    if not await open_page(page, f"https://www.facebook.com/groups/{gid}/about"):
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


async def read_recent_posts(page, gid: str, want: int) -> list[dict] | None:
    """그룹 최근 글(접힌 '더 보기'는 펼친 뒤 전문). 시험 조사·장기 수집이 함께 쓴다.
    화면이 안 열리면 None(정상적으로 글이 없는 빈 그룹의 [] 와 구분)."""
    if not await open_page(page, f"https://www.facebook.com/groups/{gid}/?sorting_setting=CHRONOLOGICAL"):
        return None
    state = await inspect_page_state(page)
    if state in ("checkpoint", "session_expired"):
        raise RuntimeError(state)
    seen, out, stall = set(), [], 0
    for _ in range(40):
        await expand_visible_posts(page)
        await page.wait_for_timeout(random.randint(800, 1500))
        got = await extract_visible_posts(page)
        before = len(out)
        for p in got.get("posts", []):
            key = p["text"][:120]
            if key in seen:
                continue
            seen.add(key)
            text = re.sub(r"[ \t]+", " ", p["text"]).strip()
            t = parse_time_label(p.get("timeLabel", ""))
            raw_url = p.get("postUrl") or ""
            out.append({"text": text, "url": raw_url.split("?")[0] if "/posts/" in raw_url else raw_url,
                        "head": mask(re.sub(r"\s+", " ", text)[:160]),
                        "class": classify(text), "visa": sorted({v.upper() for v in VISA_RE.findall(text)}),
                        "no_visa": bool(NO_VISA_RE.search(text)), "time": p.get("timeLabel", "")[:30],
                        "est": (t or {}).get("estimate"), "images": len(p.get("images") or [])})
        if len(out) >= want:
            break
        stall = stall + 1 if len(out) == before else 0
        if stall >= 3:
            break
        await advance_feed(page)
    return out[:want]


async def open_page(page, url: str) -> bool:
    """그룹 화면은 서버에서 'domcontentloaded'까지 30초 안에 안 끝나 전부 실패했다(2026-11-11 조사: 101번 모두 Timeout,
    검색 화면은 정상). 응답 시작(commit)만 기다린 뒤 본문 영역이 보이면 진행한다. 실패하면 어디서 멈췄는지 남기고 30초 뒤 1번 더."""
    for attempt in (1, 2):
        try:
            await page.goto(url, wait_until="commit", timeout=45000)
            await page.wait_for_selector('[role="main"], [role="feed"]', timeout=45000)
            await page.wait_for_timeout(2500)
            return True
        except Exception as e:  # noqa: BLE001
            try:
                title = await page.title()
            except Exception:  # noqa: BLE001
                title = "?"
            print(f"  ⛔ 열기 실패({attempt}/2): {type(e).__name__} · 지금 주소 {page.url[:80]} · 제목 {title[:40]}")
            state = await inspect_page_state(page)  # 로그인·checkpoint로 튕긴 화면이면 일반 로딩 실패가 아니라 계정 이상
            if state in ("checkpoint", "session_expired"):
                raise RuntimeError(state)
            if attempt == 1:
                await page.wait_for_timeout(30000)
    return False


async def limited(coro, secs: int, label: str, page):
    """페이지 안 스크립트 실행(evaluate)에는 시간 한도가 없어, 화면이 멈추면 몇 시간 그대로 기다린다
    (2026-11-11 시험: 검색 뒤 3시간 반 아무 출력 없이 멈춤 → 수집기 줄까지 막음). 단계마다 한도를 두고,
    넘기면 그때 화면 주소·제목을 남기고 실패로 센다."""
    t0 = datetime.now()
    print(f"  · {label} 시작 {t0:%H:%M:%S}")
    try:
        r = await asyncio.wait_for(coro, timeout=secs)
        print(f"  · {label} 끝 {(datetime.now() - t0).seconds}초")
        return r
    except asyncio.TimeoutError:
        try:
            title = await asyncio.wait_for(page.title(), timeout=10)
        except Exception:  # noqa: BLE001
            title = "?"
        print(f"  ⛔ {label} {secs}초 넘김 — 지금 주소 {page.url[:80]} · 제목 {title[:40]}")
        return "timeout"


async def fresh_page(ctx, page):
    """멈춘 화면은 닫고 새 화면으로 다음 단계를 잇는다."""
    try:
        await asyncio.wait_for(page.close(), timeout=15)
    except Exception:  # noqa: BLE001
        pass
    np = await ctx.new_page()
    await stealth_async(np)
    return np


def save_json(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def summarize(groups: list[dict]) -> dict:
    def stat(rows):
        return {"count": len(rows), "ge_100k": sum(r["members"] >= 100_000 for r in rows),
                "ge_10k": sum(r["members"] >= 10_000 for r in rows),
                "daily_90plus": sum("90" in r["daily"] for r in rows)}
    return {"all": stat(groups), "korea_named": stat([g for g in groups if g["korea_name"]])}


# ── 장기 조사(Lee 2026-11-11 "한 달 이상 걸려도 철저히, 안까지 싹") ─────────────────────────
# 매일 큰 그룹 몇 곳을 돌아가며(오래 안 본 곳부터) 최근 글 전부 + 판매 아닌 글의 댓글까지 읽어
# 비공개 저장소(research_artifacts, 공개 접근 차단)에 쌓는다. 같은 글은 한 줄(다시 보면 마지막 본 날만 바뀜).
# 주 1회 report가 쌓인 글로 "사람들이 무엇을 올리고 묻는가"를 센다. 사람 이름은 저장하지 않고 전화번호는 가린다.
KIND_POST, KIND_GROUP, KIND_META = "korea-fb-post", "korea-fb-group", "korea-fb-meta"
SEARCH_EVERY_DAYS = 7
MIN_MEMBERS = 30000  # Lee 2026-11-11: 작은 그룹은 조사하지 않는다(몇만~몇십만 그룹이 충분히 많음)

COMMENTS_JS = """() => {
  const arts = [...document.querySelectorAll('[role="article"]')]
  const top = arts.find(a => !(a.parentElement && a.parentElement.closest('[role="article"]')))
  const out = []
  for (const a of arts) {
    if (a === top) continue
    // 작성자 이름은 링크·제목 안에 있다 → 그런 노드와 링크만 담은 노드는 빼고 본문 노드만 쓴다(사람 이름 비저장)
    const t = [...a.querySelectorAll('div[dir="auto"]')]
      .filter(d => !d.closest('a, h2, h3, h4') && !(d.querySelector('a') && !(d.innerText || '').replace(d.querySelector('a').innerText || '', '').trim()))
      .map(d => (d.innerText || '').trim()).filter(x => x.length > 1)
    const txt = [...new Set(t)].join(' ').trim()
    if (txt) out.push(txt)
  }
  return out
}"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _db():
    if not crawl_facebook.supabase:
        raise SystemExit("::error::SUPABASE_SERVICE_ROLE_KEY 필요(비공개 저장소 쓰기)")
    return crawl_facebook.supabase


def _rows(kind: str) -> list[dict]:
    out, start = [], 0
    while True:
        part = _db().table("research_artifacts").select("name,payload,meta").eq("kind", kind).range(start, start + 999).execute().data or []
        out += part
        if len(part) < 1000:
            return out
        start += 1000


def _upsert(kind: str, name: str, payload: dict, meta: dict) -> None:
    _db().table("research_artifacts").upsert({"kind": kind, "name": name, "payload": payload, "meta": meta},
                                             on_conflict="kind,name").execute()


def post_name(gid: str, text: str, url: str) -> str:
    pid = crawl_facebook.extract_post_id(url)  # pfbid 같은 영숫자 ID도 읽는 기존 함수
    return f"{gid}:{pid or hashlib.sha1(text[:300].encode()).hexdigest()[:16]}"


async def read_comments(page, url: str, cap: int = 40) -> list[str]:
    if not url or not await open_page(page, url):
        return []
    state = await inspect_page_state(page)
    if state in ("checkpoint", "session_expired"):
        raise RuntimeError(state)
    for _ in range(3):  # 댓글 더 보기
        try:
            more = page.get_by_text(re.compile(r"^(댓글 더 보기|Xem thêm bình luận|View more comments|이전 댓글 보기)"))
            if await more.count() == 0:
                break
            await more.first.click(timeout=3000)
            await page.wait_for_timeout(random.randint(1500, 2500))
        except Exception:
            break
    texts = await page.evaluate(COMMENTS_JS)
    return [mask(re.sub(r"\s+", " ", t))[:300] for t in texts[:cap]]


async def refresh_registry(page, queries: list[str]) -> None:
    meta_rows = {r["name"]: r for r in _rows(KIND_META)}
    last = (meta_rows.get("search", {}).get("meta") or {}).get("at", "")
    if last and datetime.fromisoformat(last) > datetime.now(timezone.utc) - timedelta(days=SEARCH_EVERY_DAYS):
        return
    known = {r["name"]: r for r in _rows(KIND_GROUP)}
    for q in queries:
        for g in await search_groups(page, q, scrolls=8):
            old = known.get(g["id"], {})
            _upsert(KIND_GROUP, g["id"], {**(old.get("payload") or {}), **{k: g[k] for k in ("name", "members", "daily", "korea_name")}},
                    old.get("meta") or {"found_at": _now(), "visits": 0})
        await page.wait_for_timeout(random.randint(20000, 40000))
    _upsert(KIND_META, "search", {"queries": queries}, {"at": _now()})
    print(f"그룹 목록 갱신: 검색어 {len(queries)}개")


def pick_groups(n: int) -> list[dict]:
    rows = [r for r in _rows(KIND_GROUP) if is_korea_group((r["payload"] or {}).get("name", "")) and (r["payload"] or {}).get("members", 0) >= MIN_MEMBERS]
    rows.sort(key=lambda r: ((r["meta"] or {}).get("last_visit") or "", -(r["payload"] or {}).get("members", 0)))
    return rows[:n]


async def collect(page, ctx, groups_per_run: int, want_posts: int, comment_posts: int) -> dict:
    stats = {"groups": [], "new_posts": 0, "comments": 0}
    for g in pick_groups(groups_per_run):
        gid, gname = g["name"], (g["payload"] or {}).get("name", "")
        print(f"그룹 {gname[:40]}")
        about = await limited(read_about(page, gid), 300, "소개 화면", page)
        if about == "timeout":
            page = await fresh_page(ctx, page)
            about = {"id": gid, "error": "timeout"}
        await page.wait_for_timeout(random.randint(10000, 20000))
        posts = await limited(read_recent_posts(page, gid, want_posts), 900, "글 읽기", page)
        if posts == "timeout":
            page = await fresh_page(ctx, page)
            posts = None
        failed = bool(about.get("error")) or posts is None  # 소개·글 화면 중 하나라도 안 열렸으면 실패
        posts = posts or []
        names = [post_name(gid, p["text"], p["url"]) for p in posts]
        existing = {}
        for k in range(0, len(names), 100):  # 이번에 읽은 글만 이름으로 조회(저장분이 1,000건을 넘어도 안전)
            for r in _db().table("research_artifacts").select("name,payload,meta").eq("kind", KIND_POST).in_("name", names[k:k + 100]).execute().data or []:
                existing[r["name"]] = r
        new, with_comments = 0, 0
        for p in posts:
            name = post_name(gid, p["text"], p["url"])
            old = existing.get(name)
            comments = []
            # 새 글이거나, 저장된 댓글이 아직 없는 글(예전에 비어 있었거나 읽기 실패)은 이번 한도 안에서 다시 읽는다
            if (not old or not (old.get("payload") or {}).get("comments")) and p["class"] != "sell" and p["url"] and with_comments < comment_posts:
                await page.wait_for_timeout(random.randint(8000, 15000))
                comments = await limited(read_comments(page, p["url"]), 180, "댓글", page)
                if comments == "timeout":
                    page = await fresh_page(ctx, page)
                    comments = []
                with_comments += 1
                stats["comments"] += len(comments)
            payload = {"gid": gid, "group": gname, "text": mask(p["text"])[:3000], "class": p["class"], "visa": p["visa"],
                       "no_visa": p["no_visa"], "time_label": p["time"], "est": p["est"], "images": p["images"]}
            if comments:
                payload["comments"] = comments
            meta = {**((old or {}).get("meta") or {"first_seen": _now()}), "last_seen": _now()}
            if old and not comments:
                _db().table("research_artifacts").update({"meta": meta}).eq("kind", KIND_POST).eq("name", name).execute()
            else:
                _upsert(KIND_POST, name, payload, meta)
            new += 0 if old else 1
        hist = ((g["meta"] or {}).get("history") or [])[-89:] + [{"at": _now(), **{k: about.get(k, "") for k in ("today", "month", "total")}}]
        _upsert(KIND_GROUP, gid, {**(g["payload"] or {}), "created": about.get("created", ""), "rules_head": about.get("rules_head", ""),
                                  "admin_business_words": about.get("admin_business_words", [])},
                {**(g["meta"] or {}), "last_visit": _now(), "visits": int((g["meta"] or {}).get("visits") or 0) + 1, "history": hist})
        stats["groups"].append({"name": gname[:40], "read": len(posts), "new": new, "with_comments": with_comments})
        if failed and not posts:
            stats["load_failed"] = stats.get("load_failed", 0) + 1
            if stats["load_failed"] >= 2:
                print("::error title=그룹 화면이 열리지 않음::2곳 연속 실패 — 오늘 수집 중단")
                break
        else:
            stats["load_failed"] = 0
        stats["new_posts"] += new
        print(f"그룹 {gname[:40]}: 읽음 {len(posts)} · 새 글 {new} · 댓글 읽은 글 {with_comments}")
        await page.wait_for_timeout(random.randint(60000, 120000))
    return stats


def report(out_path: str) -> dict:
    posts = [r["payload"] for r in _rows(KIND_POST)]
    groups = _rows(KIND_GROUP)
    by_class, by_group, comments = {}, {}, 0
    for p in posts:
        by_class[p["class"]] = by_class.get(p["class"], 0) + 1
        g = by_group.setdefault(p.get("gid") or p["group"][:40], {})
        g[p["class"]] = g.get(p["class"], 0) + 1
        comments += len(p.get("comments") or [])
    samples = {c: [p["text"][:300] for p in posts if p["class"] == c][:40] for c in by_class if c != "sell"}
    visited = [g for g in groups if (g["meta"] or {}).get("visits")]
    # Lee 2026-11-11: 글을 그냥 합치면 한 그룹의 쏠림이 전체처럼 보인다 → 그룹마다 비율을 낸 뒤 회원 수로 가중 평균
    members = {g["name"]: (g["payload"] or {}).get("members", 0) for g in groups}  # 그룹 ID(행 이름)로 연결 — 잘린 이름 충돌 방지
    weighted, wsum = {}, 0
    group_share = {}
    for gname, cnt in by_group.items():
        n = sum(cnt.values())
        m = members.get(gname, 0)
        if not n or not m:
            continue
        group_share[gname] = {"members": m, "posts": n, **{k: round(v * 100 / n) for k, v in cnt.items()}}
        wsum += m
        for k, v in cnt.items():
            weighted[k] = weighted.get(k, 0) + m * v / n
    by_class_weighted = {k: round(v * 100 / wsum, 1) for k, v in weighted.items()} if wsum else {}
    res = {"at": _now(), "posts": len(posts), "comments": comments, "by_class": by_class, "by_group": by_group,
           "groups_known": len(groups), "groups_visited": len(visited),
           "by_class_weighted_pct": by_class_weighted, "group_share_pct": group_share,
           "no_visa_posts": sum(1 for p in posts if p.get("no_visa")),
           "jobs_with_visa": sum(1 for p in posts if p["class"] == "job" and p.get("visa")),
           "group_history": {(g["payload"] or {}).get("name", "")[:40]: (g["meta"] or {}).get("history", []) for g in visited},
           "samples": samples}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return res


async def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queries", default="người việt tại hàn quốc|việc làm hàn quốc|cộng đồng việt nam hàn quốc")
    ap.add_argument("--top", type=int, default=10, help="자세히 볼 큰 그룹 수(한국 이름 그룹, 회원 수 순)")
    ap.add_argument("--posts", type=int, default=100)
    ap.add_argument("--out", default="/tmp/korea_fb_survey.json")
    ap.add_argument("--mode", choices=["survey", "collect", "report"], default="survey")
    ap.add_argument("--groups-per-run", type=int, default=4)
    ap.add_argument("--comment-posts", type=int, default=12)
    a = ap.parse_args(argv)
    if a.mode == "report":
        r = report(a.out)
        print(f"쌓인 글 {r['posts']} · 댓글 {r['comments']} · 그룹 {r['groups_visited']}/{r['groups_known']} · {r['by_class']}")
        return 0

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
            if a.mode == "collect":
                await refresh_registry(page, [x.strip() for x in a.queries.split("|") if x.strip()])
                result["collect"] = await collect(page, ctx, a.groups_per_run, a.posts, a.comment_posts)
                raise StopAsyncIteration
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
            targets = [g for g in result["groups"] if g["korea_name"] and g.get("members", 0) >= MIN_MEMBERS][: a.top]
            fails = 0
            for g in targets:
                print(f"그룹 {g['name'][:40]} ({g['members']:,}명)")
                about = await limited(read_about(page, g["id"]), 300, "소개 화면", page)
                if about == "timeout":
                    page = await fresh_page(ctx, page)
                    about = {"id": g["id"], "error": "timeout"}
                await page.wait_for_timeout(random.randint(8000, 15000))
                posts = await limited(read_recent_posts(page, g["id"], a.posts), 900, "글 읽기", page)
                if posts == "timeout":
                    page = await fresh_page(ctx, page)
                    posts = None
                failed = bool(about.get("error")) or posts is None
                posts = posts or []
                counts = {}
                for x in posts:
                    counts[x["class"]] = counts.get(x["class"], 0) + 1
                result["detail"].append({**about, "name": g["name"], "members": g["members"], "daily": g["daily"],
                                         "post_counts": counts, "posts_read": len(posts),
                                         "jobs_with_visa": sum(1 for x in posts if x["class"] == "job" and x["visa"]),
                                         "no_visa_posts": sum(1 for x in posts if x["no_visa"]),
                                         "posts": [{**x, "text": mask(x["text"])} for x in posts]})
                print(f"그룹 {g['name'][:40]}: 글 {len(posts)}개 {counts}")
                fails = fails + 1 if (failed and not posts) else 0
                if fails >= 2:  # 그룹 2곳 연속으로 화면이 안 열리면 몇 시간 헛돌지 않고 멈춘다
                    print("::error title=그룹 화면이 열리지 않음::2곳 연속 실패 — 원인 확인 전까지 중단")
                    result["stopped"] = "group_page_load_failed"
                    save_json(a.out, result)
                    break
                save_json(a.out, result)  # 그룹마다 바로 저장 — 시간 한도로 끊겨도 본 데까지 남게(2026-11-11 4시간 한도 사고)
                await page.wait_for_timeout(random.randint(60000, 120000))  # 수집기와 같은 그룹 간 쉬는 시간
        except StopAsyncIteration:
            pass
        except RuntimeError as e:
            write_account_lock(str(e), "korea_fb_survey")
            print(f"::error title=Facebook 계정 이상({e})::잠금을 만들고 멈춥니다. 일반 브라우저로 계정 확인 후 쿠키 갱신이 필요합니다.")
            result["stopped"] = str(e)
        finally:
            await browser.close()

    save_json(a.out, result)
    return 0 if not result.get("stopped") else 3


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
