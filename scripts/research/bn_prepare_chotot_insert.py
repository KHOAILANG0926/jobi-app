"""박닌 Chợ Tốt 채택분 → local_jobs / job_work_locations INSERT SQL 준비(DRY-RUN 전용, DB에 쓰지 않는다).

입력: scripts/research/out/bacninh_chotot_rows.json(bn_build_chotot_csv.mjs 산출, 채택분은 excluded=='') + ct_res_*.json(list_time)
출력(모두 gitignore된 out/):
  bn_chotot_insert_batchNN.sql  — 10건씩 한 트랜잭션. 사람이 승인하기 전에는 실행하지 않는다.
  bn_chotot_dedupe_keys.json    — DB 중복 확인용 키(md5·전화)
  bn_chotot_prepare_report.json — 컬럼별 채움 건수·검증 결과
실행: python scripts/research/bn_prepare_chotot_insert.py

정책(사용자 지시 2026-10-07):
- admin_hidden=true(비공개)로 넣는다. 공개는 별도 승인 후 admin_hidden=false로.
- 경쟁 사이트 원문 링크는 어떤 컬럼에도 넣지 않는다: source_url=NULL(anon이 source_url을 SELECT할 수 있어 공개 API로 새기 때문),
  description의 URL은 제거, 내부 추적용 광고 번호만 source='chotot:<광고번호>'(링크 아님)에 둔다.
- 좌표는 넣지 않는다(lat/lng NULL, geocode_status='pending', coordinate_accuracy='unresolved') — 반영 후 별도 작업.
- industrial_park는 공고 본문·주소가 KCN을 직접 말한 경우만(원문이 준 값만).
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "crawler"))
sys.stdout.reconfigure(encoding="utf-8")

import classifier  # noqa: E402
import job_quality as q  # noqa: E402

OUT = ROOT / "scripts" / "research" / "out"
VERSION = "2026-10-07.chotot-bacninh-v1"
SOURCE_TAG = "chotot"
TODAY = (datetime.now(timezone.utc) + timedelta(hours=7)).date().isoformat()
URL_RE = re.compile(r"(?:https?://|www\.)\S+|\b\S+\.(?:com|vn|net)\S*", re.I)
STREET_RE = re.compile(r"(?:\blô|\bsố|\bđường|\bngõ|\bphố)\s*[\w./-]*\d|\b\d+[a-z]?\s*(?:đường|phố|trần|lê|nguyễn)", re.I)
SITE_RE = re.compile(r"vieclamtot|chotot|chợ tốt|cho tot", re.I)


def tag(s: str) -> str:
    return "$q" + hashlib.md5(s.encode()).hexdigest()[:6] + "$"


def lit(v) -> str:
    """SQL 리터럴. 문자열은 달러 인용(내용에 같은 태그가 없도록 태그를 해시로 만든다)."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "array[" + ",".join(lit(x) for x in v) + "]::text[]"
    t = tag(str(v))
    return f"{t}{v}{t}"


def parse_salary(s: str):
    """'15.000.000 đ - 25.000.000 đ/tháng' 등 → (min, max, currency, period, negotiable). 해석 못 하면 전부 None."""
    t = (s or "").strip()
    if not t:
        return (None,) * 5
    if re.search(r"thương lượng|thỏa thuận|thoả thuận", t, re.I):
        return None, None, None, None, True
    nums = [int(n.replace(".", "")) for n in re.findall(r"(\d[\d.]*)\s*đ", t)]
    if not nums:
        return (None,) * 5
    period = "month" if "/tháng" in t else "day" if "/ngày" in t else "hour" if "/giờ" in t else None
    if period is None:
        return (None,) * 5
    if re.match(r"\s*đến\b", t, re.I):
        lo, hi = None, nums[0]
    elif re.match(r"\s*từ\b", t, re.I):
        lo, hi = nums[0], None
    elif len(nums) >= 2:
        lo, hi = nums[0], nums[1]
    else:
        lo = hi = nums[0]
    if lo is not None and hi is not None and lo > hi:
        return (None,) * 5
    return lo, hi, "VND", period, False


def posted_date(lt) -> str:
    try:
        d = (datetime.fromtimestamp(int(lt) / 1000, timezone.utc) + timedelta(hours=7)).date().isoformat()
        return min(d, TODAY)
    except Exception:
        return TODAY


def clean_body(body: str) -> str:
    lines = []
    for ln in (body or "").replace("\r", "").split("\n"):
        ln = URL_RE.sub("", ln)
        if SITE_RE.search(ln):
            continue
        lines.append(ln.rstrip())
    out = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", out).strip()


def build_jobs() -> tuple[list[dict], list[dict]]:
    rows = [r for r in json.loads((OUT / "bacninh_chotot_rows.json").read_text("utf-8")) if not r["excluded"]]
    raw = {}
    for f in sorted(OUT.glob("ct_res_*.json")):
        raw.update(json.loads(f.read_text("utf-8")))

    jobs, errors, seen = [], [], set()
    for r in rows:
        src = raw.get(r["id"], {})
        agency = r["agency"] == "Y"
        work = r["work"] if r["work"] and not r["work"].startswith("(") else ""
        company = q.normalize_whitespace(work or r["poster"])
        title = q.normalize_whitespace(r["title"])
        desc_body = clean_body(r.get("body", ""))
        description = f"[source:{SOURCE_TAG}] ## Mô tả\n{desc_body}" if desc_body else f"[source:{SOURCE_TAG}]"
        category = classifier.classify(title, company, desc_body)
        subcategory = classifier.classify_subcategory(category, title, company, desc_body)
        category, subcategory = classifier.map_to_new_taxonomy(category, subcategory)
        salary = q.normalize_salary(r["salary"]) if r["salary"] else ""
        smin, smax, scur, sper, sneg = parse_salary(salary)
        gate_ok, gate_reason = q.gate_auto_publish(True, bool(q.normalize_whitespace(r["contact"])))
        job = {
            "title": title, "company": company, "category": category, "subcategory": subcategory,
            "salary": salary or None, "location": "Bắc Ninh", "employer_phone": r["contact"],
            "urgent": q.detect_explicit_urgent_hiring(title, description), "description": description,
            "posted_at": posted_date(src.get("lt")), "active": gate_ok, "origin": "crawler", "admin_hidden": True,
            "source": f"{SOURCE_TAG}:{r['id']}", "source_url": None, "crawler_version": VERSION,
            "publish_gate_reason": gate_reason, "recruitment_regions": ["Bắc Ninh"],
            "recruitment_type": "agency" if agency else None,
            "salary_min": smin, "salary_max": smax, "salary_currency": scur, "salary_period": sper, "salary_negotiable": sneg,
            "_loc": {"raw_address": r["address"], "industrial_park": r["kcn"] or None,
                     # exact_text = 번지·도로 등 구체적 주소 텍스트가 있을 때만. 행정구역·KCN 이름만이면 region_only
                     "address_accuracy": "exact_text" if STREET_RE.search(r["address"]) else "region_only"},
            "_key": f"{q.ascii_key(company)}|{q.ascii_key(title)}|{r['contact']}",
        }
        errs = q.validate_job_payload(job, source=SOURCE_TAG, today=TODAY)
        if job["_key"] in seen:
            errs.append("batch duplicate (company+title+phone)")
        seen.add(job["_key"])
        if errs:
            errors.append({"id": r["id"], "title": title[:50], "errors": errs})
        jobs.append(job)

    return jobs, errors


def main() -> None:
    jobs, errors = build_jobs()
    # ── SQL 생성: 10건씩 한 트랜잭션, 광고 번호(source) 기준 재실행 안전(이미 있으면 건너뜀)
    cols = ["title", "company", "category", "subcategory", "salary", "location", "employer_phone", "urgent", "description",
            "posted_at", "active", "origin", "admin_hidden", "source", "source_url", "crawler_version", "publish_gate_reason",
            "recruitment_regions", "recruitment_type", "salary_min", "salary_max", "salary_currency", "salary_period", "salary_negotiable"]
    for old in OUT.glob("bn_chotot_insert_batch*.sql"):
        old.unlink()
    batches = [jobs[i:i + 10] for i in range(0, len(jobs), 10)]
    for bi, batch in enumerate(batches, 1):
        parts = [f"-- 박닌 Chợ Tốt 반영 batch {bi}/{len(batches)} — {VERSION} — admin_hidden=true(비공개). 승인 전 실행 금지.", "begin;"]
        for j in batch:
            vals = ", ".join(("date " + lit(j[c]) if c == "posted_at" else lit(j[c])) for c in cols)
            loc = j["_loc"]
            parts.append(
                f"with j as (\n  insert into public.local_jobs ({', '.join(cols)})\n  select {vals}\n"
                f"  where not exists (select 1 from public.local_jobs x where x.source = {lit(j['source'])})\n  returning id\n)\n"
                f"insert into public.job_work_locations (job_id, raw_address, country, province, geocode_status, location_verified, sort_order, "
                f"address_accuracy, coordinate_accuracy, matched_recruitment_regions, resolved_province, industrial_park)\n"
                f"select id, {lit(loc['raw_address'])}, 'VN', 'Bắc Ninh', 'pending', false, 0, {lit(loc['address_accuracy'])}, 'unresolved', "
                f"array['Bắc Ninh']::text[], 'Bắc Ninh', {lit(loc['industrial_park'])} from j;"
            )
        parts.append("commit;")
        (OUT / f"bn_chotot_insert_batch{bi:02d}.sql").write_text("\n".join(parts) + "\n", "utf-8")

    # ── DB 중복 확인(읽기 전용 SELECT) — 키: NFC·공백 정리·소문자 한 회사|제목 md5, 그리고 전화번호
    import unicodedata
    norm = lambda v: re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(v or ""))).strip().lower()
    md5 = lambda x: hashlib.md5(x.encode()).hexdigest()
    ck = sorted({md5(f"{norm(j['company'])}|{norm(j['title'])}") for j in jobs})
    phones = sorted({j["employer_phone"] for j in jobs})
    checksum = md5(",".join(ck)) + "/" + md5(",".join(phones))
    (OUT / "bn_chotot_dedupe_keys.json").write_text(json.dumps({"company_title_md5": ck, "phones": phones, "checksum": checksum}, indent=1), "utf-8")
    sql = (
        f"with k(h) as (select unnest(string_to_array('{','.join(ck)}', ','))), "
        f"p(ph) as (select unnest(string_to_array('{','.join(phones)}', ','))) "
        "select (select md5(string_agg(h, ',' order by h)) from k) h_md5, (select md5(string_agg(ph, ',' order by ph)) from p) p_md5, "
        "(select count(*) from k) nk, (select count(*) from p) np, "
        "(select count(*) from public.local_jobs j where exists (select 1 from p where p.ph = j.employer_phone)) phone_hits, "
        "(select count(*) from public.local_jobs j where exists (select 1 from k where k.h = md5(lower(btrim(regexp_replace(normalize(j.company, NFC), '[[:space:]]+', ' ', 'g'))) || '|' || lower(btrim(regexp_replace(normalize(j.title, NFC), '[[:space:]]+', ' ', 'g')))))) company_title_hits, "
        "(select count(*) from public.local_jobs j where j.source like 'chotot:%') already_chotot"
    )
    (OUT / "bn_chotot_dedupe_check.sql").write_text(sql, "utf-8")
    print("dedupe checksum", checksum)

    # ── 컬럼별 채움 건수
    fill = {c: sum(1 for j in jobs if j[c] not in (None, "", [])) for c in cols}
    fill["job_work_locations.industrial_park"] = sum(1 for j in jobs if j["_loc"]["industrial_park"])
    cat = {}
    for j in jobs:
        cat[j["category"]] = cat.get(j["category"], 0) + 1
    report = {"rows": len(jobs), "batches": len(batches), "fill": fill, "categories": cat,
              "active_true": sum(1 for j in jobs if j["active"]), "agency": sum(1 for j in jobs if j["recruitment_type"] == "agency"),
              "validation_errors": errors, "unique_company_title": len(ck), "unique_phones": len(phones)}
    (OUT / "bn_chotot_prepare_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), "utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
