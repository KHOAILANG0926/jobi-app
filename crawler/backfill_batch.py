"""
지정된 local_jobs id 목록에 대해 실제 backfill을 실행한다.

1) title+company로 vieclam24h를 재검색해 source_url을 확정한다.
   EXACT(원문 완전 일치, 후보 1개)/HIGH(정규화 일치 + 마감일 ±1일, 후보 1개)만
   채택 — AMBIGUOUS/NOT_FOUND는 여기서 멈추고 그 공고는 건너뛴다.
2) 확정된 공고만 fetch_job_detail()을 실제로 돌려 title/company/salary/
   application_deadline/description/work_locations를 재추출한다(리스팅 페이지의
   title/company는 원본 상세페이지 <h1>/공고주 링크에서 별도로 다시 잡는다 —
   crawl_category()의 리스팅 파싱과는 별개 경로).
3) compute_job_updates()로 기존 local_jobs 행과 비교해 바뀐 필드만 UPDATE.
   source_url이 비어 있었으면 그것도 같이 채운다.
4) job_work_locations에 해당 job_id 행이 하나도 없으면 새로 INSERT(있으면 skip,
   중복 생성 안 함). geocoding(lat/lng)은 이번 단계에서 하지 않는다.

기본은 dry-run(무엇이 바뀔지만 출력). 실제로 DB에 쓰려면 --apply.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
import urllib.parse
from datetime import date, timedelta

sys.path.insert(0, ".")

from dotenv import load_dotenv
from pathlib import Path
from playwright.async_api import async_playwright
try:
    from playwright_stealth import stealth_async
except ImportError:
    async def stealth_async(page):
        pass

load_dotenv(Path(__file__).parent / ".env")

from supabase import create_client

from classifier import classify, is_blacklisted
from job_quality import (
    ascii_key,
    compute_job_updates,
    extract_salary_from_text,
    normalize_location,
    normalize_salary,
    normalize_whitespace,
    split_work_locations,
    validate_job_payload,
)
from crawl_topcv import fetch_job_detail, format_description, TODAY

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# anon key로는 local_jobs UPDATE / job_work_locations INSERT 권한이 없다(확인됨:
# information_schema.role_table_grants — anon은 두 테이블 모두 SELECT만 가능).
# 그래서 실제 쓰기는 이 세션 내내 써온 supabase CLI(`db query --linked`) 경로로
# 우회한다 — 여기서는 SQL을 만들기만 하고, 실행은 run()에서 subprocess로 한다.
SUPABASE_CLI = r"C:\Users\HP\AppData\Local\SupabaseCLI\supabase.exe"


def sql_str(value: object) -> str:
    """Postgres dollar-quoted literal — 따옴표/특수문자 이스케이프를 몽땅 피한다."""
    return f"$bfq${value}$bfq$"


def build_update_sql(job_id: int, field_updates: dict) -> str | None:
    if not field_updates:
        return None
    sets = ", ".join(f"{k} = {sql_str(v)}" for k, v in field_updates.items())
    return f"UPDATE local_jobs SET {sets} WHERE id = {job_id};"


def build_insert_wl_sql(job_id: int, addresses: list[str]) -> str | None:
    if not addresses:
        return None
    values = ", ".join(f"({job_id}, {sql_str(addr)}, {i})" for i, addr in enumerate(addresses))
    return (
        "INSERT INTO job_work_locations (job_id, raw_address, sort_order) "
        f"VALUES {values} ON CONFLICT (job_id, normalized_address) DO NOTHING;"
    )

SEARCH_LIST_JS = """() => {
    const items = []
    const seen = new Set()
    document.querySelectorAll("a[href]").forEach(el => {
        const href = el.getAttribute('href') || ''
        if (!href.includes('.html')) return
        if (!href.match(/id\\d+/)) return
        if (seen.has(href)) return
        seen.add(href)
        const lines = (el.innerText || '').split('\\n').map(s => s.trim()).filter(Boolean)
        if (!lines[0] || lines[0].length < 5) return
        const title = lines[0]
        const company = lines.find(l => l.length > 2 && l !== title) || ''
        const deadlineLine = lines.find(l => /^Còn\\s+\\d+\\s+ngày$/.test(l)) || ''
        const daysMatch = deadlineLine.match(/\\d+/)
        const fullHref = href.startsWith('http') ? href : 'https://vieclam24h.vn' + href
        items.push({
            title, company, href: fullHref,
            daysLeft: daysMatch ? parseInt(daysMatch[0], 10) : null,
        })
    })
    return items
}"""


def canonical(title: str, company: str) -> tuple[str, str]:
    return (ascii_key(title)[:80], ascii_key(company)[:60])


async def search_candidates(page, title: str) -> list[dict]:
    query = urllib.parse.quote(title)
    await page.goto(
        f"https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q={query}",
        wait_until="domcontentloaded", timeout=20000,
    )
    await page.wait_for_timeout(1500)
    try:
        return await page.evaluate(SEARCH_LIST_JS)
    except Exception:
        return []


def implied_deadline(days_left: int | None, today: date) -> str | None:
    if days_left is None:
        return None
    return (today + timedelta(days=days_left)).isoformat()


async def match_job(page, job: dict, today: date) -> dict:
    title = job.get("title") or ""
    company = job.get("company") or ""
    db_key = canonical(title, company)
    db_deadline = job.get("application_deadline")

    candidates = await search_candidates(page, title)
    normalized_matches = [c for c in candidates if canonical(c["title"], c["company"]) == db_key]

    if not normalized_matches:
        return {"job_id": job["id"], "confidence": "NOT_FOUND", "url": None}

    exact_matches = [c for c in normalized_matches if c["title"] == title and c["company"] == company]
    if len(exact_matches) == 1:
        return {"job_id": job["id"], "confidence": "EXACT", "url": exact_matches[0]["href"]}

    if len(normalized_matches) == 1:
        cand = normalized_matches[0]
        cand_deadline = implied_deadline(cand.get("daysLeft"), today)
        if db_deadline and cand_deadline:
            db_d = date.fromisoformat(db_deadline)
            cand_d = date.fromisoformat(cand_deadline)
            if abs((db_d - cand_d).days) <= 1:
                return {"job_id": job["id"], "confidence": "HIGH", "url": cand["href"]}
        return {"job_id": job["id"], "confidence": "AMBIGUOUS", "url": cand["href"]}

    return {"job_id": job["id"], "confidence": "AMBIGUOUS", "url": None}


async def reprocess_job(page, job_id: int, source_url: str) -> dict:
    """상세페이지를 실제로 다시 읽어 title/company/payload를 재구성한다.
    title은 <h1>, company는 '/nha-tuyen-dung/' 링크에서 — 리스팅 파싱과는
    독립된 경로라 title=배지/location=title 버그의 영향을 받지 않는다."""
    await page.goto(source_url, wait_until="domcontentloaded", timeout=20000)
    await page.wait_for_timeout(1200)
    header = await page.evaluate("""() => {
        const h1 = document.querySelector('h1')
        const title = h1 ? h1.innerText.trim() : ''
        const companyLink = Array.from(document.querySelectorAll('a'))
          .find(a => (a.getAttribute('href') || '').includes('/nha-tuyen-dung/')
            || (a.getAttribute('href') || '').match(/-ntd\\d+/))
        const company = companyLink ? companyLink.textContent.trim() : ''
        // "Khu vực tuyển" 라벨의 다음 형제 요소가 값(예: "TP.HCM") — 리스팅
        // 페이지의 location 추출과 완전히 다른, 독립된 상세페이지 소스라
        // listing의 title=location 버그 영향을 받지 않는다.
        let location = ''
        for (const el of document.querySelectorAll('*')) {
          if (el.children.length === 0 && (el.textContent || '').trim() === 'Khu vực tuyển') {
            location = el.nextElementSibling ? el.nextElementSibling.textContent.trim() : ''
            break
          }
        }
        return { title, company, location }
    }""")
    detail = await fetch_job_detail(page, source_url)
    title = normalize_whitespace(header.get("title") or "")
    company = normalize_whitespace(header.get("company") or "")
    desc_text = format_description(detail.get("sections", {}))
    description = f"[source:vieclam24h] {desc_text}" if desc_text else f"[source:vieclam24h] {source_url}"
    work_locations = split_work_locations(detail.get("sections", {}).get("Địa điểm làm việc", ""))
    category = classify(title, company, desc_text)

    location_raw = normalize_whitespace(header.get("location") or "")
    job = {
        "title": title,
        "company": company,
        "location": normalize_location(location_raw) if location_raw else None,
        "salary": extract_salary_from_text(desc_text),
        "description": description,
        "category": category,
        "application_deadline": detail.get("deadline"),
        "source_url": source_url,
        "work_locations": work_locations,
        "is_blacklisted": is_blacklisted(title, company),
    }
    return job


async def run(job_ids: list[int], apply: bool) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY(or ANON) 필요")

    rows = (
        supabase.table("local_jobs")
        .select("id,title,company,salary,application_deadline,description,location,source_url")
        .in_("id", job_ids)
        .execute()
        .data
        or []
    )
    by_id = {r["id"]: r for r in rows}
    today = date.today()

    match_results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="vi-VN",
        )
        await stealth_async(page)

        print("===== 1단계: 재검색 매칭 =====")
        for jid in job_ids:
            row = by_id.get(jid)
            if not row:
                print(f"id={jid}: DB에서 못 찾음(스킵)")
                continue
            result = await match_job(page, row, today)
            match_results.append(result)
            print(f"[{result['confidence']:10}] id={jid:<6} {row['title'][:60]}")

        confirmed = [r for r in match_results if r["confidence"] in ("EXACT", "HIGH")]
        print(f"\n확정(EXACT/HIGH): {len(confirmed)}건 / 제외(AMBIGUOUS/NOT_FOUND): {len(match_results) - len(confirmed)}건\n")

        print("===== 2단계: 재추출 + diff =====")
        sql_statements: list[str] = []
        applied_ids: list[int] = []
        for r in confirmed:
            jid = r["job_id"]
            old_row = by_id[jid]
            new_job = await reprocess_job(page, jid, r["url"])

            quality_errors = validate_job_payload(
                {**new_job, "origin": "crawler", "active": True, "admin_hidden": False},
                source="vieclam24h", today=TODAY,
            )
            if new_job["is_blacklisted"] or "excluded money/debt collection job" in quality_errors:
                print(f"id={jid}: 블랙리스트/품질 스킵")
                continue

            field_updates = compute_job_updates(old_row, new_job)
            if not old_row.get("source_url") and new_job.get("source_url"):
                field_updates["source_url"] = new_job["source_url"]

            print(f"--- id={jid} ({r['confidence']}) ---")
            print(f"  기존 title: {old_row['title'][:60]!r}")
            print(f"  신규 title: {new_job['title'][:60]!r}")
            if field_updates:
                print(f"  변경 필드: {list(field_updates.keys())}")
                for k, v in field_updates.items():
                    if k == "description":
                        print(f"    {k}: (길이 {len(str(v))}자로 갱신)")
                    else:
                        print(f"    {k}: {v!r}")
            else:
                print("  변경 없음")

            update_sql = build_update_sql(jid, field_updates) if field_updates else None
            if apply and update_sql:
                sql_statements.append(update_sql)
                applied_ids.append(jid)
                print("  -> UPDATE SQL 생성됨(CLI로 일괄 실행 예정)")
            elif field_updates:
                print("  -> (dry-run, UPDATE 안 함)")

            existing_wl = (
                supabase.table("job_work_locations").select("id").eq("job_id", jid).limit(1).execute().data
            )
            wl_to_insert = new_job.get("work_locations") or []
            if existing_wl:
                print(f"  work_locations: 이미 {len(existing_wl)}건+ 존재 — 건너뜀")
            elif wl_to_insert:
                print(f"  work_locations: 신규 {len(wl_to_insert)}건 발견: {wl_to_insert}")
                if apply:
                    insert_sql = build_insert_wl_sql(jid, wl_to_insert)
                    if insert_sql:
                        sql_statements.append(insert_sql)
                        if jid not in applied_ids:
                            applied_ids.append(jid)
                        print(f"  -> job_work_locations INSERT SQL 생성됨({len(wl_to_insert)}건)")
                else:
                    print("  -> (dry-run, INSERT 안 함)")
            else:
                print("  work_locations: 원본에 상세 근무지 섹션 없음")
            print()

        await browser.close()

        if apply and sql_statements:
            sql_path = Path(__file__).parent / "_batch_apply.sql"
            sql_path.write_text("\n".join(sql_statements), encoding="utf-8")
            print(f"===== SQL 생성 완료 (대상 id: {applied_ids}) =====")
            print(f"파일: {sql_path}")
            print("이 프로세스에서는 supabase CLI를 직접 실행하지 않는다 —")
            print("네이티브 Python subprocess로 supabase.exe를 못 띄우는 환경 문제가 있어,")
            print("호출자가 별도로 `supabase db query --linked -f` 로 실행해야 한다.")
        elif apply:
            print("적용할 변경 사항 없음(전부 변경 없음/스킵)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", type=str, required=True, help="쉼표로 구분된 job id 목록")
    parser.add_argument("--apply", action="store_true", help="실제 DB에 반영")
    args = parser.parse_args()
    ids = [int(x.strip()) for x in args.ids.split(",") if x.strip()]
    asyncio.run(run(ids, args.apply))
