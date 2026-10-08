# scripts/research — 저장 원칙 (2026-10-08 사용자 지시)

- 이 PC(특히 회사 PC)에는 키·수집 데이터·결과 파일을 저장하지 않는다. PC `.env` 저장도 안내하지 않는다.
- 서비스 키(VIETMAP_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY 등)는 **Vercel 환경변수에만** 둔다. 이 폴더의 스크립트는 키를 읽지 않는다.
- 수집·검토 데이터·백업·캐시는 Supabase 비공개 테이블 `research_artifacts`(RLS로 공개 접근 차단)에 둔다. CSV·바탕화면·`out/`·`backups/` 폴더는 쓰지 않는다.
- 인증은 관리자 로그인 세션(터미널에서 입력, 저장 안 함) 또는 `ADMIN_ACCESS_TOKEN` 환경변수(해당 터미널 세션에만).
- VietMap Search/Place는 서버 API `/api/admin-vietmap`(관리자 전용, 하루 250회)로만 호출한다.
- 위 테이블·함수 DDL은 `supabase/pending/20261008000000_private_research_store.sql` — **사용자 승인 후 적용**(적용 전에는 저장 시 RPC 없음 오류).

## 현재 쓰는 도구

| 파일 | 용도 |
|---|---|
| `lib/privateStore.mjs` | 비공개 저장소 읽기/쓰기·서버 API 호출 공용 헬퍼 |
| `migrate_out_to_private_store.mjs` | 이 PC에 이미 있는 `out/`·`backups/` 파일을 비공개 저장소로 옮기고 대조(`--delete-local`로 로컬 삭제) |
| `backup_to_private_store.mjs` | 삭제·대량 수정 전 테이블 백업을 비공개 저장소에 저장 |
| `bn_vietmap_search_dryrun.mjs` | chotot 좌표 후보 VietMap 검색 dry-run(서버 API 경유, 결과는 비공개 저장소) |
| `../generate-location-candidates.ts` | 새 공고 좌표 후보 생성(서버 API + 관리자 RPC) |

## 이미 실행이 끝난 1회용 스크립트(다시 실행하지 말 것)

`bn_apply_*.py`, `bn_prepare_chotot_insert.py`, `bn_collect_*`, `bn_build_*`, `bn_poi_*`, `bn_overpass_fetch.mjs`, `cleanup_local_jobs_delete.sql`은
2026-10-07 박닌 chotot 수집·반영 때 쓴 도구로, 로컬 `out/` 파일과 `crawler/.env` 키를 전제로 한다. 저장 원칙에 어긋나므로 **재실행 금지** —
같은 일이 다시 필요하면 위 비공개 저장소 방식으로 새로 만든다(이 파일들을 고쳐 쓰지 말고 교체).
