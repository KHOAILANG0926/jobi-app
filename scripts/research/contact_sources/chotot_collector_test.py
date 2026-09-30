"""Chợ Tốt 수집 전용 계정 테스트(박닌 최대 10건). 읽기 전용 — DB 저장·발신·메시지 없음.
- 전용 프로필 chotot-collector-profile/ 만 사용. 쿠키·토큰은 출력/저장하지 않는다.
- 공고마다 'Hiện số'를 1회 클릭하고, 번호 응답과 ats/candidate/channel/phone 요청 발생 여부를 기록.
- 경고·제한·추가 인증·로그아웃 신호가 보이면 즉시 중단.
- 결과: chotot_collector_test_result.tsv (전체 번호는 이 로컬 파일에만, 콘솔은 끝 3자리 가림)."""
import asyncio, csv, pathlib, re
from collections import defaultdict
from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).parent
PROFILE = HERE / "chotot-collector-profile"
OUT = HERE / "chotot_collector_test_result.tsv"
LIST_URL = "https://www.vieclamtot.com/viec-lam-bac-ninh"
MAX_JOBS = 10
PHONE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.\-]{0,2}\d){8,10}(?!\d)")
WARN = re.compile(r"tạm khóa|bị khóa|hạn chế|vượt quá|quá nhiều|xác minh|xác thực|captcha|robot|đăng nhập để liên hệ", re.I)
AGENCY_WORDS = re.compile(r"cung ứng (nhân lực|lao động)|dịch vụ việc làm|xuất khẩu lao động|thời vụ|nhân sự .*(bắc ninh|bắc giang)|tuyển dụng .*(bắc ninh|bắc giang)|trung tâm (giới thiệu|việc làm)", re.I)


def norm(s):
    d = re.sub(r"\D", "", s)
    if d.startswith("84"):
        d = "0" + d[2:]
    return d if len(d) in (10, 11) else None


def mask(d):
    return d[:-3] + "***" if d else ""


def company_from_title(title):
    m = re.search(r"(?:c[ôo]ng ty|cty|nhà máy)\s+([^\-–|,.(]+)", title, re.I)
    if m:
        return m.group(1).strip()
    m = re.match(r"\s*([A-ZÀ-Ỹ0-9][A-ZÀ-Ỹ0-9 &.]{1,30}?)\s+(TUYỂN|TUYEN|CẦN)", title)
    return m.group(1).strip() if m else ""


async def main():
    rows = []
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(str(PROFILE), headless=True, locale="vi-VN")
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.goto(LIST_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        links = list(dict.fromkeys(h.split("#")[0] for h in await page.evaluate("() => [...document.querySelectorAll('a[href]')].map(a => a.href)")
                                   if re.search(r"vieclamtot\.com/.+bac-ninh/\d{6,}\.htm", h)))[:MAX_JOBS]
        print(f"박닌 공고 {len(links)}건 대상")
        for url in links:
            hits = {"phone_api": None, "ats": False}

            async def on_response(r):
                u = r.url
                if "/ad-listing/phone" in u:
                    try:
                        hits["phone_api"] = (await r.json()).get("phone")
                    except Exception:
                        pass
                if "ats/candidate/channel/phone" in u:
                    hits["ats"] = True

            page.on("response", on_response)
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(3500)
            text = await page.evaluate("() => { const f = document.querySelector('footer'); return document.body.innerText.replace(f ? f.innerText : '', '') }")
            title = (await page.title()).rsplit(" - ", 1)[0]
            publisher = (re.search(r"Đăng bởi:?\s*([^\n]+)", text) or [None, ""])[1].strip()
            loc = (re.search(r"\n([^\n]*(Bắc Ninh|Bắc Giang)[^\n]*)\n", text) or [None, ""])[1].strip()
            body_phones = sorted({n for n in (norm(m.group(0)) for m in PHONE.finditer(text)) if n})
            btn = page.get_by_text(re.compile(r"^Hiện số")).first
            clickable = await btn.count() > 0
            warning = ""
            if clickable:
                await btn.click()
                await page.wait_for_timeout(4000)
                after = await page.evaluate("() => document.body.innerText")
                w = WARN.search(after)
                if w and not hits["phone_api"]:
                    warning = w.group(0)
            page.remove_listener("response", on_response)
            revealed = hits["phone_api"] or ""
            rows.append({"title": title, "url": url, "publisher": publisher, "work_company": company_from_title(title), "location": loc,
                         "body_phone": ",".join(body_phones), "hien_so_clickable": clickable, "revealed_phone": revealed,
                         "phone_request_detected": hits["ats"], "account_warning": warning, "text": text})
            print(f"- {title[:50]} | 게시자 {publisher} | 번호 {mask(revealed)} | ats {hits['ats']} | 경고 {warning or '없음'}")
            if warning:
                print("⛔ 계정 경고/제한 신호 — 즉시 중단")
                break
            await page.wait_for_timeout(6000)  # 과도한 조회를 피하려는 간격
        await ctx.close()

    # 전화번호·게시자 중복 관계
    by_phone, by_pub = defaultdict(list), defaultdict(set)
    for r in rows:
        if r["revealed_phone"]:
            by_phone[r["revealed_phone"]].append(r)
        if r["publisher"]:
            by_pub[r["publisher"]].add(r["work_company"] or r["title"])
    for r in rows:
        same = [o for o in by_phone.get(r["revealed_phone"], []) if o is not r]
        other_cos = sorted(c for c in by_pub.get(r["publisher"], set()) if c != (r["work_company"] or r["title"]))
        r["phone_duplicate_count"] = len(same) + 1 if r["revealed_phone"] else 0
        r["same_phone_other_jobs"] = " | ".join(o["title"][:40] for o in same)
        r["same_publisher_other_companies"] = " | ".join(other_cos)
        # 분류: 증거가 둘 이상일 때만 agency, 직접 근거가 있을 때만 direct, 나머지 unknown
        reasons_a, reasons_d = [], []
        diff_co_same_phone = {o["work_company"] for o in same if o["work_company"] and o["work_company"] != r["work_company"]}
        if diff_co_same_phone:
            reasons_a.append("같은 번호로 다른 회사 공고: " + ", ".join(sorted(diff_co_same_phone)))
        if other_cos:
            reasons_a.append("같은 게시자가 다른 회사 공고 게시")
        if AGENCY_WORDS.search(r["publisher"] + " " + r["text"][:3000]):
            reasons_a.append("인력공급 성격 문구")
        pub, co = r["publisher"].lower(), r["work_company"].lower()
        if co and pub and (co in pub or pub in co):
            reasons_d.append("게시자명과 회사명 일치")
        if len(reasons_a) >= 2:
            r["recruitment_type"], reason = "agency", reasons_a
        elif reasons_d and not reasons_a:
            r["recruitment_type"], reason = "direct", reasons_d
        else:
            r["recruitment_type"], reason = "unknown", reasons_a + reasons_d or ["근거 부족"]
        r["classification_reason"] = "; ".join(reason)
        r["notes"] = "" if r["hien_so_clickable"] else "Hiện số 버튼 없음"

    cols = ["title", "url", "publisher", "work_company", "location", "body_phone", "hien_so_clickable", "revealed_phone", "phone_request_detected",
            "recruitment_type", "classification_reason", "phone_duplicate_count", "same_phone_other_jobs", "same_publisher_other_companies",
            "account_warning", "notes"]
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter="\t", extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"\n저장: {OUT} ({len(rows)}건)")
    for r in rows:
        print(f"{r['recruitment_type']:8} | {r['title'][:40]} | 게시자 {r['publisher']} | 중복 {r['phone_duplicate_count']} | {r['classification_reason']}")

asyncio.run(main())
