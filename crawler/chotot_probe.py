"""
Chợ Tốt(vieclamtot.com) 박닌 공고 읽기 시험 — DB 저장 없음(Lee 2026-11-06 "2번(Chợ Tốt) 먼저 하자").

확인할 것(수집기를 만들기 전):
  1) VPS에서 로그인 없이 박닌 목록을 읽을 수 있는가(목록 화면 __NEXT_DATA__ / 공개 gateway API)
  2) 상세에서 제목·회사·주소·본문을 읽을 수 있는가
  3) 전화번호가 로그인 없이 보이는가(가려진 번호인지)
요청은 몇 번만, 사이 2~4초 간격. 차단 문구가 보이면 바로 멈춘다. 결과는 요약만 출력(번호는 끝 3자리만).
"""

import json
import random
import re
import sys
import time
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
LIST_URL = "https://www.vieclamtot.com/viec-lam-bac-ninh"
GATEWAY = "https://gateway.chotot.com/v1/public/ad-listing"
WARN = re.compile(r"tạm khóa|bị khóa|vượt quá giới hạn|quá nhiều lượt|captcha|robot", re.I)
PHONE = re.compile(r"0\d{9,10}")


def get(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:2000]
    except Exception as e:  # noqa: BLE001 — 시험: 원인만 출력
        return 0, f"{type(e).__name__}: {e}"


def next_data(html: str):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def find_ads(o, out, depth=0):
    """list_id·subject가 있는 객체(공고)를 모두 찾는다."""
    if depth > 12 or o is None:
        return
    if isinstance(o, dict):
        if "list_id" in o and "subject" in o:
            out.append(o)
            return
        for v in o.values():
            find_ads(v, out, depth + 1)
    elif isinstance(o, list):
        for v in o:
            find_ads(v, out, depth + 1)


def mask(p: str) -> str:
    d = re.sub(r"\D", "", str(p or ""))
    return f"…{d[-3:]}({len(d)}자리)" if d else "없음"


def pause():
    time.sleep(2 + random.random() * 2)


def main() -> int:
    ok = True
    print("== 1) 목록 화면", LIST_URL)
    st, html = get(LIST_URL)
    print("  상태", st, "크기", len(html))
    if WARN.search(html[:5000]):
        print("::error::차단 문구 감지 — 중단")
        return 2
    ads: list[dict] = []
    nd = next_data(html) if st == 200 else None
    print("  __NEXT_DATA__", "있음" if nd else "없음")
    if nd:
        find_ads(nd, ads)
    print("  목록 공고", len(ads), "건")
    for a in ads[:5]:
        print("   -", a.get("list_id"), "|", str(a.get("subject"))[:60], "|", str(a.get("company_name") or a.get("account_name") or "")[:40],
              "| 지역", a.get("region_name") or a.get("region_name_v3"), a.get("area_name"), "| phone 칸", mask(a.get("phone")))
    if ads:
        print("  공고 키 목록:", sorted(ads[0].keys())[:60])
    region = next((a.get("region_v2") or a.get("region") for a in ads if a.get("region_v2") or a.get("region")), None)
    cg = next((a.get("category") for a in ads if a.get("category")), None)

    pause()
    print("== 2) 공개 gateway 목록 (지역", region, "분류", cg, ")")
    q = f"{GATEWAY}?limit=5&o=0" + (f"&region_v2={region}" if region else "") + (f"&cg={cg}" if cg else "&cg=13000")
    st, body = get(q)
    print("  상태", st, "크기", len(body))
    gw_ads = []
    try:
        gw_ads = json.loads(body).get("ads") or []
    except (json.JSONDecodeError, AttributeError):
        print("  JSON 아님:", body[:200].replace("\n", " "))
    print("  gateway 공고", len(gw_ads), "건")
    for a in gw_ads[:5]:
        print("   -", a.get("list_id"), "|", str(a.get("subject"))[:60], "| 지역", a.get("region_name"), a.get("area_name"), "| phone 칸", mask(a.get("phone")))
    if not ads and not gw_ads:
        ok = False

    sample = [a.get("list_id") for a in (ads or gw_ads)[:2] if a.get("list_id")]
    for lid in sample:
        pause()
        print("== 3) 상세", lid)
        st, body = get(f"{GATEWAY}/{lid}")
        print("  gateway 상세 상태", st, "크기", len(body))
        try:
            d = json.loads(body)
            ad = d.get("ad") or d
            print("  제목", str(ad.get("subject"))[:80])
            print("  회사", str(ad.get("company_name") or ad.get("account_name"))[:60])
            print("  주소", ", ".join(str(x) for x in [ad.get("detail_address") or ad.get("address"), ad.get("ward_name"), ad.get("area_name"), ad.get("region_name")] if x))
            print("  본문 길이", len(str(ad.get("body") or "")), "| 본문 속 번호", mask((PHONE.findall(str(ad.get("body") or "")) or [""])[0]))
            print("  phone 칸", mask(ad.get("phone")), "| 가려짐" if "*" in str(ad.get("phone") or "") or "x" in str(ad.get("phone") or "").lower() else "")
            print("  상세 키:", sorted(ad.keys())[:70])
        except (json.JSONDecodeError, AttributeError):
            print("  JSON 아님:", body[:200].replace("\n", " "))
    print("== 결과:", "읽기 가능" if ok else "읽기 실패")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
