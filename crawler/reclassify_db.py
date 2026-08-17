"""
기존 DB 공고 일괄 재분류 스크립트
- local_jobs 테이블의 모든 공고를 읽어 classifier로 카테고리를 재계산하고 UPDATE
- 실행: python3 reclassify_db.py [--dry-run]
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from classifier import classify

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ .env에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 설정 필요")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
DRY_RUN = "--dry-run" in sys.argv


def fetch_all_jobs() -> list[dict]:
    """local_jobs 전체 조회 (페이지네이션)."""
    all_jobs = []
    page = 0
    page_size = 1000
    while True:
        res = supabase.table("local_jobs") \
            .select("id,title,company,category,description") \
            .range(page * page_size, (page + 1) * page_size - 1) \
            .execute()
        batch = res.data or []
        all_jobs.extend(batch)
        if len(batch) < page_size:
            break
        page += 1
    return all_jobs


def reclassify_all():
    print("📥 DB에서 공고 불러오는 중...")
    jobs = fetch_all_jobs()
    print(f"   총 {len(jobs)}개 공고")

    # 카테고리별 집계
    old_counts: dict[str, int] = {}
    new_counts: dict[str, int] = {}
    updates: list[dict] = []

    for j in jobs:
        old_cat = j.get("category") or "other"
        old_counts[old_cat] = old_counts.get(old_cat, 0) + 1

        desc = j.get("description") or ""
        # description에서 [source:xxx] 태그 및 URL 제거 후 본문만 추출
        desc_clean = desc.split("]", 1)[-1].strip() if "]" in desc else desc

        new_cat = classify(
            title=j.get("title") or "",
            company=j.get("company") or "",
            description=desc_clean,
        )
        new_counts[new_cat] = new_counts.get(new_cat, 0) + 1

        if new_cat != old_cat:
            updates.append({"id": j["id"], "old": old_cat, "new": new_cat})

    print(f"\n📊 기존 분류:")
    for cat, cnt in sorted(old_counts.items(), key=lambda x: -x[1]):
        print(f"   {cat:15} {cnt:4}개")

    print(f"\n📊 재분류 결과:")
    for cat, cnt in sorted(new_counts.items(), key=lambda x: -x[1]):
        print(f"   {cat:15} {cnt:4}개")

    print(f"\n🔄 변경 대상: {len(updates)}개")
    if not updates:
        print("   변경 없음.")
        return

    # 샘플 출력
    for u in updates[:10]:
        print(f"   id={u['id']} | {u['old']} → {u['new']}")
    if len(updates) > 10:
        print(f"   ... 외 {len(updates) - 10}개")

    if DRY_RUN:
        print("\n⚠️  --dry-run 모드: DB 업데이트 건너뜀")
        return

    # 배치 UPDATE (50개씩)
    updated = 0
    for i in range(0, len(updates), 50):
        batch = updates[i:i+50]
        for u in batch:
            supabase.table("local_jobs") \
                .update({"category": u["new"]}) \
                .eq("id", u["id"]) \
                .execute()
        updated += len(batch)
        print(f"   ✅ 업데이트: {updated}/{len(updates)}개")

    print(f"\n✨ 완료! {len(updates)}개 공고 카테고리 재분류됨.")


if __name__ == "__main__":
    reclassify_all()
