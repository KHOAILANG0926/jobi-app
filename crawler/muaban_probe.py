"""
Muaban(muaban.net) 박닌 공고 읽기 시험 — DB 저장 없음(이슈 #1140, Chợ Tốt 시험 chotot_probe.py를 그대로 본뜸).

확인할 것(수집기를 만들기 전):
  1) VPS(베트남 IP)에서 로그인 없이 박닌 목록을 읽을 수 있는가(목록 화면 __NEXT_DATA__ / 상세 링크)
  2) 상세에서 제목·회사·주소·본문을 읽을 수 있는가
  3) 전화번호가 로그인 없이 보이는가(가려진 번호인지)
요청은 몇 번만(목록 1 + 상세 2), 사이 2~4초 간격. 차단 문구가 보이면 바로 멈춘다(우회 금지).
결과는 요약만 출력(번호는 끝 3자리만). 키·로그인 열쇠 없음.
"""

import json
import random
import re
import sys
import time
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BASE = "https://muaban.net"
LIST_URL = BASE + "/viec-lam/bac-ninh"
WARN = re.compile(r"tạm khóa|bị khóa|vượt quá giới hạn|quá nhiều lượt|captcha|robot|just a moment|access denied", re.I)
PHONE = re.compile(r"0\d{9,10}")
DETAIL_LINK = re.compile(r'href="(/[a-z0-9\-/]*viec-lam[a-z0-9\-/]*-id\d+)"', re.I)


def get(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:2000]
    except Exception as e:  # noqa: BLE001 — 시험: 원인만 출력
        return 0, f"{type(e).__name__}: {e}"


def block_phrase(status: int, text: str) -> str:
    """차단이면 이유(상태 코드 또는 걸린 낱말), 아니면 ''. 목록·상세가 실제로 담긴 페이지(__NEXT_DATA__ 또는 상세 링크)는
    머리말의 `<meta name="robots">`·captcha 스크립트 낱말 때문에 차단으로 보지 않는다(2026-11-27 첫 실행 200·141KB가 이 오판으로 중단됨)."""
    if status in (403, 429):
        return str(status)
    m = WARN.search(text[:5000])
    if not m:
        return ""
    if '<script id="__NEXT_DATA__"' in text or DETAIL_LINK.search(text):
        return ""
    return m.group(0)


def is_blocked(status: int, text: str) -> bool:
    return bool(block_phrase(status, text))


def next_data(html: str):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def find_ads(o, out, depth=0):
    """id와 title(또는 subject)이 같이 있는 객체(공고)를 모두 찾는다."""
    if depth > 12 or o is None:
        return
    if isinstance(o, dict):
        if "id" in o and ("title" in o or "subject" in o) and ("price" in o or "address" in o or "location" in o or "url" in o):
            out.append(o)
            return
        for v in o.values():
            find_ads(v, out, depth + 1)
    elif isinstance(o, list):
        for v in o:
            find_ads(v, out, depth + 1)


def mask(p) -> str:
    d = re.sub(r"\D", "", str(p or ""))
    return f"…{d[-3:]}({len(d)}자리)" if d else "없음"


def is_masked(p) -> bool:
    s = str(p or "")
    return "*" in s or "x" in s.lower()


def detail_links(html: str) -> list:
    seen: list = []
    for m in DETAIL_LINK.finditer(html):
        u = BASE + m.group(1)
        if u not in seen:
            seen.append(u)
    return seen


def url_ad_id(url: str) -> str:
    m = re.search(r"-id(\d+)$", url)
    return m.group(1) if m else ""


def summarize_detail(html: str, ad_id: str = "") -> dict:
    """상세 화면에서 제목·회사·주소·본문 길이·전화(끝 3자리만)를 뽑는다. 값은 요약만.
    ad_id(주소 끝 -id숫자)가 있으면 그 번호의 공고 객체만 쓴다 — 첫 객체를 쓰면 추천·옆 공고 정보를 그 공고 것으로 오인한다
    (2026-11-27 첫 읽기: 링크한 공고와 다른 제목·두 공고에서 같은 번호). 찾지 못하면 matched=False이고 전화·본문은 '판정 불가'로 둔다."""
    nd = next_data(html)
    ads: list = []
    if nd:
        find_ads(nd, ads)
    if ad_id:
        ad = next((a for a in ads if str(a.get("id")) == ad_id), {})
    else:
        ad = ads[0] if ads else {}
    matched = bool(ad)
    body = str(ad.get("body") or ad.get("description") or "") if matched else ""
    phone = (ad.get("phone") or ad.get("contact_phone") or "") if matched else ""
    # 페이지 전체의 tel: 링크는 사이트 공통 번호일 수 있어 공고 자신의 번호로 쓰지 않고 개수만 센다.
    tels = sorted(set(re.findall(r'href="tel:([^"]+)"', html)))
    title = ad.get("title") or ad.get("subject")
    if not title and not matched:
        t = re.search(r"<title>(.*?)</title>", html, re.S)
        title = t.group(1).strip() if t else ""
    return {
        "has_next_data": bool(nd),
        "matched": matched,
        "ad_ids": [str(a.get("id")) for a in ads[:5]],
        "title": str(title or "")[:80],
        "company": str(ad.get("company_name") or ad.get("shop_name") or ad.get("user_name") or "")[:60],
        "address": str(ad.get("address") or ad.get("location") or "")[:120],
        "body_len": len(body),
        "body_phone": mask((PHONE.findall(body) or [""])[0]),
        "phone": mask(phone),
        "phone_masked": is_masked(phone),
        "page_tel_links": len(tels),
        "ad_keys": sorted(ad.keys())[:60] if matched else [],
    }


def pause():
    time.sleep(2 + random.random() * 2)


def main() -> int:
    ok = True
    print("== 1) 목록 화면", LIST_URL)
    st, html = get(LIST_URL)
    print("  상태", st, "크기", len(html))
    if is_blocked(st, html):
        print("::error::목록 차단(로봇 확인) — 중단(우회하지 않음)", st, "걸린 낱말:", block_phrase(st, html))
        return 2
    ads: list = []
    nd = next_data(html) if st == 200 else None
    print("  __NEXT_DATA__", "있음" if nd else "없음")
    if nd:
        find_ads(nd, ads)
    links = detail_links(html) if st == 200 else []
    print("  목록 공고(__NEXT_DATA__)", len(ads), "건 | 상세 링크", len(links), "개")
    for a in ads[:5]:
        print("   -", a.get("id"), "|", str(a.get("title") or a.get("subject"))[:60], "| phone 칸", mask(a.get("phone")))
    if ads:
        print("  공고 키 목록:", sorted(ads[0].keys())[:60])
    if not ads and not links:
        ok = False

    for url in links[:2]:
        pause()
        print("== 2) 상세", url)
        st, body = get(url)
        print("  상태", st, "크기", len(body))
        if is_blocked(st, body):
            print("::error::상세 차단 — 중단(우회하지 않음)", st, "걸린 낱말:", block_phrase(st, body))
            return 2
        s = summarize_detail(body, url_ad_id(url))
        print("  __NEXT_DATA__", "있음" if s["has_next_data"] else "없음")
        print("  그 공고 객체", "찾음" if s["matched"] else "못 찾음(전화·본문 판정 불가)", "| 페이지 속 공고 번호", s["ad_ids"], "| 페이지 tel: 링크", s["page_tel_links"], "개")
        if s["ad_keys"]:
            print("  공고 키 목록:", s["ad_keys"])
        print("  제목", s["title"])
        print("  회사", s["company"] or "없음")
        print("  주소", s["address"] or "없음")
        print("  본문 길이", s["body_len"], "| 본문 속 번호", s["body_phone"])
        print("  phone", s["phone"], "| 가려짐" if s["phone_masked"] else "")
    print("== 결과:", "읽기 가능" if ok else "읽기 실패")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
