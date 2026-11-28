"""보류함 공고 1건의 위치 확정 가능 여부만 읽기로 확인한다(Lee 2026-11-28 단건 게시 후보 사전 검증).
기존 위치 확인 경로(ingest_gateway.PRECHECK = 서버 위치 hook, 수집·보류 재확인과 같은 함수)를 그대로 쓴다 — 새 판정 규칙·새 위치 경로 없음.
DB에는 아무것도 쓰지 않는다(등록·상태 변경 없음, 보류 줄 그대로). 서버 hook이 하는 일(기존 Google 월 한도 안의 조회·결과 보관)은 수집 때와 같다.
실행 로그(공개 저장소)에는 전화·원문·주소·좌표를 찍지 않는다: 찾음 여부·종류·사유 코드·외부 호출 시도 횟수만.
사용: HOLD_COMPANY="회사 이름(정확히 그 한 곳)" SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… python crawler/hold_precheck_probe.py"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ingest_gateway as g  # noqa: E402

HOLD_STATES = ("unfound", "held")


def pick_one(rows: list[dict], company: str) -> dict | None:
    """보류 줄 중 회사 이름이 정확히 같은(대소문자·앞뒤 공백만 무시) 줄이 딱 하나일 때만 돌려준다."""
    key = company.strip().lower()
    hit = [r for r in rows if str((r.get("payload") or {}).get("company") or "").strip().lower() == key]
    return hit[0] if len(hit) == 1 else None


def probe(client, company: str, precheck=None) -> int:
    """종료 코드: 0 = 확인함(찾음·못 찾음 모두 정상 결과), 2 = 대상이 정확히 한 줄이 아님, 3 = 위치 서버에 닿지 못함."""
    precheck = precheck or g.PRECHECK
    rows = (client.table("research_artifacts").select("name,payload,meta").eq("kind", g.HOLD_KIND)
            .in_("meta->>status", list(HOLD_STATES)).execute().data) or []
    row = pick_one(rows, company)
    if row is None:
        print(f"대상 보류 줄이 정확히 1개가 아님(후보 {len(rows)}개 중 일치 0 또는 2 이상) — 확인하지 않음")
        return 2
    payload = dict(row.get("payload") or {})
    payload["_recheck"] = True  # 저장된 결과를 다시 쓰지 않고 새로 묻는다(보류함 재확인과 같은 방식)
    verdict = precheck(payload) or {}
    reason = str(verdict.get("reason") or "-")[:60]
    meta = row.get("meta") or {}
    print(f"보류 상태 {meta.get('status')} · 사유 {meta.get('reason')} · 확인 횟수 {meta.get('attempts')} → 지금 위치 확인: "
          f"{'확정 좌표 확보 가능' if verdict.get('findable') else '찾지 못함'} · 종류 {str(verdict.get('kind') or '-')[:20]} · 사유 {reason}")
    if reason in g.HOOK_UNAVAILABLE:
        return 3
    return 0


def main() -> int:
    url, key, company = os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""), os.getenv("HOLD_COMPANY", "")
    if not (url and key and company.strip()):
        print("SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·HOLD_COMPANY 필요")
        return 1
    from supabase import create_client
    return probe(create_client(url, key), company)


if __name__ == "__main__":
    raise SystemExit(main())
