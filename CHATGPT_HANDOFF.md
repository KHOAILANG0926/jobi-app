# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

2026-09-04 사용자 지시("1차 표준 마감 전 모순 수정") 반영 완료. **길찾기
항상 유지 + 반복주소 대표값 선정 기준 정정(구체성 우선) + recruitment_regions
저장 위치를 local_jobs(공고 전체)/job_work_locations.matched_recruitment_
regions(위치별 매칭)로 분리 + location_verified=true인 ward UI 라벨 정정 +
지도 타일 404 원인 재현.** 커밋 [80661ec](https://github.com/KHOAILANG0926/jobi-app/commit/80661ec704781fc5e0c548043e2df8ee830a28c5),
master push 완료, VPS `/root/jobi`도 동일 커밋으로 동기화 완료. 운영 재개
(cron/GHA)는 여전히 비승인 — DB 쓰기 없음, migration 미실행.

## 완료 항목

1. **길찾기 정책 수정**: `googleMapsLinks()`를 `JobDetail.tsx`에서
   `src/lib/jobCoords.ts`로 이동(export). 이 함수는 텍스트 쿼리만 받고
   좌표/coordinateAccuracy/locationVerified를 아예 파라미터로도 받지
   않는다 — `JobDetail.tsx`의 근무지 목록 렌더링에서 "Chỉ đường"/"Xem trên
   bản đồ lớn" 링크를 더 이상 `trusted` 조건으로 감싸지 않고 **항상**
   표시하도록 수정. 내부 지도 마커·정확한 거리 계산(`mappableWorkLocations`
   /`resolveMapLocations`)만 계속 exact 또는 `locationVerified===true`인
   ward로 제한된다(변경 없음 — `loc.lat`/`lng` 자체가 `JobsContext.tsx`에서
   이미 그렇게 걸러짐). 라이브 확인: sb-4369(coordinate_accuracy=
   'unresolved')에서 이제 "Chỉ đường" 링크가 실제로 뜨고, href의
   `destination` 파라미터가 좌표가 아니라 URL 인코딩된 주소 텍스트임을
   직접 확인.
2. **반복주소 대표값 선정 기준 정정**: 이전 라운드는 "그룹 내 최단 문자열"을
   그대로 저장할 raw_address로 썼는데, 이는 실제로는 틀리지 않았지만(같은
   그룹 멤버는 정의상 specificity가 항상 동점이라 결과적으로 최단이 이겼음)
   "왜" 최단을 고르는지가 코드에 명시적으로 드러나 있지 않았다. 이번에
   `_specificity_score()`(번지/도로/Lô/건물/공장 등 실제 특정 장소 신호가
   있는 comma-segment 개수)를 1순위 기준으로, 최단 문자열은 동점일 때만
   보조 기준으로 쓰도록 `_select_group_representative()`를 명시적으로
   분리했다. 그룹핑 자체도 `_facility_key`/`_is_region_suffix_variant`
   방식에서 `_strip_recruitment_region_suffix()`(뒤에서부터 특정 장소
   신호가 없는 segment만 반복 제거) 기반 core 비교로 재설계 — **같은 KCN
   이름이라도 서로 다른 Lô/도로가 있으면 더 이상 병합되지 않는다**(신규
   회귀 테스트로 확인).
3. **geocode 검색어 vs 저장값 분리**: 병합된 그룹(멤버 2개 이상)만 geocode
   검색어에서 "알려진 모집지역 접미사"를 제거한 core를 보낸다(단일 후보는
   원문 그대로 — 불필요하게 행정구역 상세를 잃지 않기 위함). 저장할
   raw_address/normalized_address는 이 정리와 무관하게 항상 대표 원문
   그대로 보존.
4. **recruitment_regions 저장 위치 분리**(사용자 지시로 재설계):
   - `local_jobs.recruitment_regions`(신규, draft) — **공고 전체**가 밝힌
     모집지역 라벨 전부. `split_work_locations()`의 원본 후보 전체 기준
     (`_compute_job_recruitment_regions()`)이라 job_work_locations 행이
     0건이어도 절대 사라지지 않는다. 크롤러는 이 값을 `job["_job_
     recruitment_regions"]`(`_`-prefix 임시 필드)로만 들고 있다 —
     **중요**: `local_jobs` insert/update는 job_work_locations의 RPC와
     달리 `upsert_job_record()`가 dict를 그대로
     `supabase.table("local_jobs").insert(...)`에 보내는 직접 REST
     호출이라, 컬럼이 없는 지금 실제 페이로드 키에 넣으면 즉시 에러가
     난다 — 그래서 아직 payload에는 안 넣었고, migration 0018 실행 +
     `insert_payload`/`UPDATE_TRACKED_FIELDS` 코드 변경까지 마쳐야 실제로
     저장되기 시작한다(다음 라운드 작업, 이번엔 실행 안 함).
   - `job_work_locations.matched_recruitment_regions`(이전 이름
     `recruitment_regions`에서 개명) — 이 근무구역 1곳에 **실제로
     매칭된** 라벨의 부분집합만. RPC(job_work_locations)는 이미 JSONB
     경유라 payload에 넣어도 안전(현재 RPC가 조용히 무시).
   - "미확인 지역"은 별도 컬럼으로 저장하지 않는다 — 필요할 때
     `local_jobs.recruitment_regions - ∪(job_work_locations.matched_
     recruitment_regions)` 차집합으로 계산하는 것을 전제로 설계만
     해뒀다(실제 계산/표시 UI는 이번 라운드에서 구현하지 않음 — 컬럼
     자체가 없어서 지금은 계산할 데이터가 없음).
5. **location_verified=true인 ward**: 지도 마커는 계속 쓸 수 있지만
   "exact"로 표시하지 않는다 — UI 라벨을 "Khu vực làm việc đã xác nhận"
   (근무구역 확인, `.jd2-map-verified-ward-note`)으로 분리해 exact와
   시각적으로 구분. 정확한 거리라고 단정하는 문구는 없음(원래도 없었음).
6. **로컬 preview 표현 정정**: 이 문서를 포함해 이번 라운드의 모든 "확인"은
   **로컬 dev preview + 코드 검토**로만 이루어졌고, **운영(viecganban.vn)
   라이브 UI 확인은 하지 않았다**(migration 미실행 + 실제 데이터 없음이
   근본 이유 — 확인할 대상 자체가 운영 DB에 없음). "운영 라이브 확인
   완료"라는 표현은 어디에도 쓰지 않음.
7. **지도 타일 404/ERR_FAILED 원인 재현**: `MapView.tsx`(`/ban-do`)는
   `L.tileLayer('https://{s}.tile.openstreetmap.org/...')`(무료 공개
   OSM 타일, API 키 없음)를 직접 쓴다 — 반면 `JobLocationMap.tsx`(공고
   상세 지도)는 Geoapify 타일(`maps.geoapify.com`, API 키 필요)을 쓴다.
   브라우저에서 직접 `fetch()`로 재현한 결과: `tile.openstreetmap.org`만
   `TypeError: Failed to fetch`(네트워크 레벨 실패, HTTP 404 응답이
   아니라 연결 자체가 안 됨)로 실패하고, 같은 세션에서 Geoapify 타일
   엔드포인트·Supabase REST·Google 등 다른 외부 도메인은 전부 정상
   도달(opaque 200 상당) — 즉 **이 오류는 앱 코드 버그가 아니라
   `tile.openstreetmap.org`라는 특정 도메인만 이 로컬 sandbox 환경에서
   접근이 막혀 있는 것으로 재현·확인됨**(OSM 자체가 자동화/데이터센터성
   트래픽을 차단하는 정책이 있음 — 실제 운영 배포 환경/일반 사용자
   브라우저에서도 동일하게 재현되는지는 **확인 못함**, 이 세션에서는
   viecganban.vn 운영 사이트에 접근해 직접 확인하지 않았음). 별도로
   기록할 점(수정 안 함, 관찰만): `MapView.tsx`가 `JobLocationMap.tsx`와
   다른 타일 공급자(raw OSM vs Geoapify)를 쓰는 것 자체가 기존 코드의
   일관성 이슈로 남아있음 — 이번 라운드 범위 밖.
8. **테스트**: `test_address_pipeline_integration.py`에 9건 추가(핵심
   신규분: KCN 실사례 core-strip 검증, 대표값이 specificity 우선임을
   직접 증명하는 테스트, 같은 KCN 안의 다른 Lô/도로 오병합 방지, 단일
   후보는 원문 그대로 geocode, matched_recruitment_regions RPC 전달,
   local_jobs.recruitment_regions가 0건 근무지에서도 보존) — 크롤러 전체
   **43/43** 통과(job_quality 15 + address_pipeline_integration 28).
   `jobCoords.test.ts`에 "모든 좌표 상태에서 길찾기 링크가 항상 생성됨"을
   exhaustive하게 증명하는 테스트 추가 — **2/2** 통과. 프론트
   `tsc --noEmit`+`npm run build` 통과.
9. **실측 재검증(write-guard dry-run, DB 쓰기 없음, VPS 격리 환경 —
   종료 후 삭제)**: KCN Hiệp Phước 공고를 새 코드로 재실행 — 4행이 아닌
   **1행**으로 병합, raw_address는 대표 원문 그대로("Khu Công nghiệp
   Hiệp Phước, xã Hiệp Phước, Nhà Bè") 보존, `matched_recruitment_
   regions=['TP.HCM','Long An']`, `_job_recruitment_regions=['TP.HCM',
   'Long An']` 정상 계산. DB 매핑 leak 없음, `active`/`publish_gate_
   reason` 모순 없음.

## Migration 0018 최종 SQL diff

파일: `supabase/migrations/0018_replace_job_work_locations_wire_location_verified_draft.sql`
(draft, **미실행**)

**변경된 테이블·컬럼 요약**:

| 테이블 | 컬럼 | 타입 | 상태 |
|---|---|---|---|
| `local_jobs` | `recruitment_regions` | `text[]` | 신규 추가(이번 라운드에서 draft에 반영) |
| `job_work_locations` | `location_verified` | `boolean` | 컬럼은 이미 존재(migration 0010) — 이 migration은 RPC의 INSERT 목록에 배선만 추가 |
| `job_work_locations` | `matched_recruitment_regions` | `text[]` | 신규 추가(이번 라운드에서 `recruitment_regions`→`matched_recruitment_regions`로 개명 확정) |

**함수 변경**: `replace_job_work_locations(p_job_id bigint, p_rows jsonb)` —
INSERT 컬럼 목록에 `location_verified`, `matched_recruitment_regions` 추가.
`local_jobs.recruitment_regions`은 이 RPC와 무관(별도 직접 insert/update
경로 — 아직 코드에서 payload에 안 넣음, 위 4번 항목 참고). 그 외 로직
(origin='crawler' 아니면 예외 발생시켜 기업 직접 등록 공고 보호)은 이전과
동일, 변경 없음.

전체 SQL은 파일에 있음 — 요지만 발췌:
```sql
alter table public.local_jobs
  add column if not exists recruitment_regions text[];

alter table public.job_work_locations
  add column if not exists matched_recruitment_regions text[];

create or replace function public.replace_job_work_locations(...)
  ...
  insert into public.job_work_locations (
    job_id, raw_address, normalized_address, lat, lng,
    geocode_status, geocode_source, address_accuracy, coordinate_accuracy, address_evidence,
    location_verified, matched_recruitment_regions, sort_order
  )
  select ... coalesce((r->>'location_verified')::boolean, false),
         coalesce((select array_agg(x) from jsonb_array_elements_text(r->'matched_recruitment_regions') as x), '{}'),
         ...
```

## 운영 전 필요한 단계 (실행 안 함, 사용자 승인 대기)

1. draft migration 0018 검토 후 승인 → 운영 DB 실행(위 2개 컬럼 추가 +
   RPC 배선, additive만).
2. migration 실행 후, `local_jobs.recruitment_regions`을 실제로 채우려면
   `upsert_job_record()`의 `insert_payload`/`compute_job_updates()`의
   `UPDATE_TRACKED_FIELDS`에 `recruitment_regions`을 추가하는 별도 코드
   변경이 한 번 더 필요(이번 라운드에서 안 함 — 컬럼 없는 채로 넣으면
   즉시 insert 에러).
3. 검증용 소규모 저장(3~5건): `--process-url --confirm-write`로 이미
   원문 대조까지 끝난 공고 3~5건만 실제로 저장 → `location_verified`/
   `matched_recruitment_regions`/`recruitment_regions`이 실제로 채워지는지,
   DB CHECK 위반 없이 insert되는지 확인. 이번 라운드에서는 실행하지 않음.
4. 3번이 확인되면 cron/GHA 재개 여부는 별도 승인 필요(계속 비승인 상태).

## 발견됐으나 이번 라운드 범위 밖(수정 안 함, 기록만)

- `MapView.tsx`가 raw OpenStreetMap 타일을, `JobLocationMap.tsx`가
  Geoapify 타일을 쓰는 공급자 불일치(위 7번 참고) — 통일 여부는 사용자
  판단 필요.
- "미확인 지역"(local_jobs.recruitment_regions와 matched_recruitment_
  regions 합집합의 차집합)을 실제로 계산해 보여주는 UI — 데이터 모델만
  설계, 구현 안 함.
- `local_jobs.origin != 'crawler'`인 기존 행의 비-게이트 필드 우연 충돌
  가능성 — 이전 라운드부터 기록, 여전히 범위 밖.
- 분류 체계의 `work_mode`(이동·순회근무) 축 — 별도 필드/컬럼 없음,
  추가하지 않음.

## 다음 결정사항

- 운영 재개(cron/GHA) 계속 비승인.
- draft migration 0018 승인 여부 대기.
- 승인 시 위 "운영 전 필요한 단계" 1→2→3→4 순서로 진행.
