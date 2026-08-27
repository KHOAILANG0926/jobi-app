# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`feature/job-detail-redesign` 브랜치에서 공고 상세페이지(`/viec-lam/:id`)를 "5초 안에 핵심 판단"
기준으로 재구성했다. Home UI, DB 스키마, 인증 방식은 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 로컬 dev 서버에서 실제 AQUACO 공고
  (`sb-3888`, 필드 대부분 null)와 로고 없는 공고(`sb-3726`)로 데스크톱/모바일(375px) 검증 완료.
- `DEPLOYED`: 미완료 — 작업 브랜치 push까지만, Production 배포는 사용자 승인 전.

## 변경 내용

- `src/pages/JobDetail.tsx`: 헤더(상단 로고만 유지, 중복되던 중앙 대형 로고 블록 제거) →
  핵심 4항목 요약 줄(급여·지역·경력·근무형태, 있는 것만 " · "로 연결) → `ĐIỀU KIỆN LÀM VIỆC`/
  `ĐIỀU KIỆN TUYỂN DỤNG` 두 카드를 `THÔNG TIN TUYỂN DỤNG` 하나로 통합 → 설명(Mô tả/Yêu cầu/
  Quyền lợi, 기존 파서 재사용) → 지도 → 회사정보 → 리뷰 → sticky 사이드바 순으로 재배치.
- 빈 데이터 규칙: `local_jobs`의 salary/location/education/preference는 기존에
  `ensureJobFields`(`src/lib/jobUtils.ts`)가 비어 있으면 무조건 "Thỏa thuận"/"Không yêu cầu"
  등을 주입해, 원본이 실제로 그렇게 썼는지 단순히 비어 있는지 구분이 불가능했다. `Job` 타입에
  `rawSalary`/`rawLocation`/`rawEducation`/`rawPreference`/`rawLat`/`rawLng`를 추가하고
  `JobsContext.tsx`의 `rowToJob`에서 폴백 주입 전 원본 trim 값을 함께 실어 보내는 방식으로,
  기존 필드/기존 화면(홈 카드 등)의 동작은 전혀 바꾸지 않으면서 상세페이지만 "원본에 값이 있을
  때만 그 값 그대로 표시, 없으면 필드 자체를 숨김" 규칙을 지키게 했다.
- 지도: 실제 DB `lat`/`lng`(`rawLat`/`rawLng`)가 있을 때만 "Địa điểm làm việc" 섹션 자체를
  렌더링하고, 기본은 접힌 상태에서 `Xem bản đồ` 클릭 시에만 펼친다. 좌표가 없으면(현재 운영
  데이터는 전부 없음) 섹션 전체를 숨겨 지역명 추정치 기반의 부정확한 지도를 노출하지 않는다.
- `src/components/JobLocationMap.tsx`: Vite가 Leaflet 기본 마커 이미지 경로를 못 찾아 깨진
  아이콘으로 뜨던 문제를 `marker-icon(-2x)/marker-shadow` 자산을 직접 import해 고쳤다(로컬
  검증 시 해당 3개 이미지 200 OK 확인). tile 로드 실패 시 지도 대신 안내 문구만 보이게 함.
- `src/components/CompanyReviews.tsx`: 리뷰 0개일 때 리뷰 작성 폼을 기본 노출하지 않고
  `Viết đánh giá` 버튼 뒤로 접었다(기존 리뷰 기능 자체는 그대로 유지, 1개 이상이면 기존과 동일).
- `src/pages/JobDetail.tsx`의 "Images" 섹션은 `job.imageUrl`(헤더 로고와 동일 이미지)을 본문에
  다시 크게 그리던 부분을 제거하고, `job.images`에 로고와 다른 실제 사진이 있을 때만 표시한다.

## 테스트 결과

- `npx tsc --noEmit`: 통과
- `npm run build`: 통과 (JobDetail 청크 30.66kB gzip 13.47kB)
- 로컬 dev 서버 + 실제 운영 Supabase 데이터로 확인:
  - `sb-3888`(AQUACO, salary/location만 있고 나머지 전부 null): 중앙 대형 로고 없음, 헤더
    로고 정상 로드(naturalWidth 128), 학력/경력/근무시간/근무일/모집인원 필드 전부 숨김,
    Quyền lợi에서 원문에 실제로 등장한 BHXH/BHYT·Thưởng·Đào tạo·Khám sức khỏe·Du lịch만
    chip으로 추출(원문에 없는 Nghỉ phép은 미표시), 좌표 없어 지도 섹션 전체 숨김, 회사정보
    섹션 숨김(companyVerified/founded/hireCount 전부 없음), 리뷰 0개라 "Viết đánh giá" 버튼만
    노출.
  - `sb-3726`(로고 없음, 위치 텍스트 지저분함): 로고 자리에 회사명 이니셜 fallback, 깨진 이미지
    없음. salary/location 원문 자체가 "Thỏa thuận"/지저분한 텍스트라 그대로 표시(임의 가공 없음).
  - 모바일(375px) 두 케이스 모두 `document.documentElement.scrollWidth === innerWidth`로
    가로 스크롤 없음 확인. 데스크톱(1280px)에서 `.jd2-grid`가 `712px 300px` 2열, 사이드바
    `position: sticky` 확인.
- 운영 `local_jobs`에는 현재 `lat`/`lng`가 채워진 행이 0건이라, "Xem bản đồ" 펼침 상태의 실제
  지도 렌더링은 코드 리뷰 + 자산 200 OK 확인으로 대체했다(추후 좌표 있는 공고가 생기면 재확인 필요).

## 발견된 문제

- `local_jobs`에 좌표(`lat`/`lng`)가 있는 행이 현재 0건이라 지도 섹션이 실질적으로 항상 숨김
  상태다 — 버그 아님(의도된 동작), 다만 지도 기능 자체의 실사용 재확인은 좌표 있는 데이터가
  생긴 뒤에 필요.
- `sb-3726`처럼 크롤러가 location에 개행이 섞인 지저분한 텍스트를 넣는 경우가 있음 — 원본을
  그대로 표시하는 정책상 그대로 노출되며, 이번 작업 범위 밖(크롤러 데이터 정제 이슈)이라 손대지
  않았다.
- 이 컴퓨터에 `node`/`npm`이 PATH에 없고 `D:\새 폴더 (2)\node.exe`에만 존재해 tsc/build/dev
  서버 실행 시 해당 경로를 직접 지정해야 했다(`.claude/launch.json`은 검증 후 원래 `npx` 설정으로
  되돌려 커밋에는 포함하지 않음) — 다음 세션에서도 동일 증상이면 이 경로부터 확인.

## 다음 결정사항

1. `feature/job-detail-redesign` 브랜치를 PR로 올리고 Vercel Preview에서 실제 화면 재확인.
2. 사용자 승인 후 master merge → Production 배포.
3. 좌표 있는 공고가 생기면 "Xem bản đồ" 펼침 상태를 실제로 한 번 더 확인.
