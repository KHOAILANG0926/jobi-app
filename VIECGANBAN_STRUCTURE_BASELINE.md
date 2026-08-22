# Viecganban 현재 구조 기준서

작성일: 2026-08-19 · 최종 갱신: 2026-08-21(사실관계만 갱신, 구조 재설계 없음).
표기: **[확인된 현재 구조]** 코드·DB·로그 직접 확인 / **[미완성]** 구조는 있으나 미동작 / **[확인 불가]** 근거 부족

---

## 1. 현재 페이지/메뉴 구조

**[확인된 현재 구조]**

전체 라우트(`src/App.tsx`):

| URL | 페이지 |
|---|---|
| `/` | Home |
| `/viec-lam/:id` | JobDetail |
| `/dang-tin` | PostJob (기업 전용 가드) |
| `/ho-so` | Profile |
| `/tinh-luong` | SalaryCalculator |
| `/bang-dieu-khien` | EmployerDashboard (기업 전용 가드) |
| `/cong-dong`, `/cong-dong/:id` | Community, CommunityPostDetail |
| `/dang-nhap`, `/dang-ky` | Login, Signup |
| `/ban-do` | MapView |
| `/viec-han-quoc` | KoreaJobs |
| `/franchise-jobs` | FranchiseJobs(정적 브랜드 목록) |
| `/zalo-callback` | ZaloCallback |
| `/cau-hoi-phong-van` | InterviewTips |
| `/chinh-sach-bao-mat`, `/dieu-khoan` | 정책 페이지 |
| `/admin` | AdminDashboard (관리자 전용 가드, Layout 밖 독립 라우트) |
| `*` | `/`로 리다이렉트 |

헤더: 로고 / `Việc làm`(대인기·지역별 5곳·업종별 7종+한국행) / `Thương hiệu`(브랜드 카드 4개) / `Công cụ`(급여계산기·면접질문) / `Cộng đồng` / 로그인·회원가입·CV등록·공고등록 버튼 / 알림벨. 공고 검색은 홈 Hero에만 배치한다.
메인(홈): 국내 구직과 한국 취업 연결 메시지를 함께 보여주는 실제 서울 이미지 기반 반응형 Hero(키워드·지역·업종 검색), 한국 상담·스킬업·로그인 안내 카드, 업종 카테고리, 실제 추천 공고, 최신 공고 필터, 기존 브랜드 캐러셀·지역 패널·퀵필터. 모든 검색/필터는 기존 실제 공고 상태와 결과 목록을 사용한다.
푸터: `Tìm việc làm`(`/`)·`Đăng tuyển`(`/dang-tin`)·`Cộng đồng`(`/cong-dong`)·`Điều khoản`(`/dieu-khoan`)·`Chính sách bảo mật`(`/chinh-sach-bao-mat`)는 실제 라우트 연결됨. **`Thông báo`/`Liên hệ 1:1`/`Câu hỏi thường gặp`/`Chính sách quảng cáo` 4개는 대응 라우트가 없어 홈으로 튕김.**

---

## 2. 구직자 전체 흐름

**[확인된 현재 구조]**: 회원가입(이메일)→로그인→공고 검색/필터/상세조회→저장(찜)→CV작성 까지는 실제 동작. 마감임박 알림도 동작. 크롤링 공고(`employer_id` NULL)는 "지원" 버튼을 눌러도 내부 지원을 시도하지 않고 원문 URL로 이동시키거나(추출 가능한 경우) 안내 토스트만 띄움(`JobDetail.tsx`의 `canApplyInternally` 분기) — 이 경로는 DB 테이블 없이도 의도대로 동작.
**[확인된 현재 구조]**: 기업이 직접 등록한 공고(`employer_id` 있음)에 대한 지원 생성·중복 차단·기업 조회·상태 변경·구직자 상태 조회·지원 취소는 `applications` 테이블과 RLS를 실제 적용하고 격리 E2E로 검증 완료. 크롤링 공고의 내부 application 생성도 DB 정책에서 차단됨.
**[확인된 현재 구조]**: 기업 직접등록 공고의 구직자↔해당 기업 메시지 흐름은 운영 DB 적용 및 격리 E2E 22개 항목(양방향 송수신·Realtime·타인 접근/소유권/역할 위조/빈 본문/크롤링 공고 차단·실패 UI) 검증 완료.
**[확인된 현재 구조]**: 면접 일정은 운영 `interviews` 테이블과 RLS/Realtime에 연결됐고, 소유 기업·해당 seeker 허용 및 outsider·타 기업·크롤링 공고·application 없는 조합 차단을 격리 E2E로 검증했다.
**[확인 불가]**: Zalo 소셜 로그인 실제 인증 성공 여부.

---

## 3. 기업 전체 흐름

**[확인된 현재 구조]**: 회원가입(기업)/로그인은 동작. 공고 등록(`/dang-tin`)은 `local_jobs.employer_id` 컬럼이 DB에 추가되고(`0004` migration 실행 완료) `PostJob.tsx`가 `employerId`를 전송하도록 수정되면서 정상 동작으로 전환됨(구직자/기업 양쪽 테스트 계정으로 등록→조회 end-to-end 확인 완료). 대시보드의 "내 공고" 목록도 `employer_id` 기준으로 정상 표시됨.
**[확인된 현재 구조]**: 지원자 조회와 reviewing/interview/accepted/rejected 상태 변경은 `applications` RLS E2E로 검증 완료.
**[확인된 현재 구조]**: 메시지 탭은 운영 DB와 연결되어 해당 기업 공고의 지원자 스레드만 조회·송수신함.
**[확인된 현재 구조]**: 면접 생성·조회·pending/confirmed/cancelled 변경과 Realtime 수신은 운영 격리 E2E를 통과했다.
(참고) `/admin`의 공고 등록 도구는 `employer_id`를 쓰지 않아 이 문제와 무관하게 동작하지만, 이는 기업 셀프서비스 흐름이 아님.

---

## 4. 관리자 구조

**[확인된 현재 구조]**: `/admin`은 Layout 밖 독립 라우트. `RequireAdmin` 가드와 모든 관리자 write RPC가 Supabase Auth의 `app_metadata.role === 'admin'`을 각각 검증한다. 작업 브랜치의 관리자 화면은 Dashboard / Jobs / Users / Reports / Audit Logs 5개 탭이며 기존 통계와 수동 등록을 유지한다. 운영 DB에는 공고 hide/unhide, 사용자 active/suspended, 신고 처리, append-only 감사 로그 구조가 적용됐다. 관리자 프론트/API는 Production 배포 전이다.
**[미완성/확인 불가]**: 수동 등록 폼의 "AI 자동 파싱"(Claude API 직접 호출)은 코드상 인증 헤더(`x-api-key`)가 없어 구조적으로 실패할 가능성이 높으나, 실제 실행 결과는 **[확인 불가]**.

---

## 5. 공고 데이터 구조

**[확인된 현재 구조]**: `local_jobs` 테이블(`employer_id` 포함 27개 컬럼, PK `id` bigint)이 유일한 국내(베트남) 공고 저장소. 소스 3곳: ① VPS 크롤러(`crawl_topcv.py`, vieclam24h.vn 대상, 실제 매일 자동 수집 중), ② 관리자 수동 등록, ③ 기업 셀프 등록(3번 참고, 정상 동작). `Job.id`는 앱 전역에서 `"sb-<local_jobs.id>"` 문자열로 취급됨. 카테고리는 7종(factory/cafe/restaurant/delivery/cleaning/retail/office) 체계로 크롤러 분류기·필터 UI·실 데이터가 일관되게 맞춰져 있음.

---

## 6. CV/프로필 구조

**[확인된 현재 구조]**: 게스트 CV/Profile은 기존 localStorage를 유지한다. 로그인 구직자는 운영 `user_profiles`/`user_cvs`를 서버 우선으로 사용하고 계정별 localStorage를 캐시·복구본으로 유지한다. 기존 로컬 데이터는 서버가 비어 있을 때 명시적 승인 후에만 가져오며 성공 전 삭제하지 않는다. 사진은 private `cv-photos` Storage의 사용자별 경로에 저장되고 타 사용자 접근 차단 E2E를 통과했다. 프론트 코드는 작업 브랜치 상태로 Production 배포 전이다.

---

## 7. 지원 → 메시지 → 면접 구조

**[확인된 현재 구조]**: 설계는 완료됨 — `applications`/`message_threads`/`messages`/`interviews` 4개 테이블 스키마와 RLS 정책을 담은 migration SQL(`supabase/migrations/0001~0003`)이 작성돼 있고, 프론트 코드(`applicationsStorage.ts`/`messagesStorage.ts`/`interviewStorage.ts`)도 이 구조를 전제로 전부 Supabase 비동기 방식으로 이미 재작성돼 있음. 지원 1건당 스레드 1개, 스레드는 (공고,지원자) 조합 1개당 1개로 설계됨.
**[확인된 현재 구조]**: `applications` 테이블은 실제 DB에 적용됐고, 구직자/기업 격리 계정으로 생성·조회·4단계 상태 변경·취소·권한 차단을 검증 완료.
**[확인된 현재 구조]**: `message_threads`/`messages`는 운영 DB에 적용됐고 실제 인증 계정 E2E 22/22를 통과함.
**[확인된 현재 구조]**: `interviews`는 운영 적용 완료. 기업 소유 직접등록 공고+실제 application 조합만 생성/수정하고 소유권 열을 불변으로 유지하며 RLS/Realtime E2E를 통과했다.

---

## 8. 인증/권한 구조

**[확인된 현재 구조]**: Supabase Auth 이메일 인증. 구직자/기업 구분은 `user_metadata.role`(가입 시 선택, 클라이언트가 값을 정할 수 있는 필드). 라우트 가드는 클라이언트 사이드(`RequireEmployer`/`RequireAdmin`)로 구현. 관리자만 `app_metadata.role`(서버/service_role만 쓸 수 있는 필드) 기준으로 별도 검증. 별도 `profiles` 테이블은 없음.
**[확인된 현재 구조]**: 게스트 CV 체험을 위해 `/ho-so`는 공개 라우트지만, applications/messages/interviews 조회·Realtime 구독은 구직자 역할에서만 시작된다. 기업은 전용 대시보드 흐름만 사용한다.
**[확인된 현재 구조]**: 구직자/기업 권한은 운영 `account_roles`에 가입 시 고정된다. local_jobs RLS는 이 DB 역할과 `employer_id = auth.uid()`를 함께 요구하므로 클라이언트 `user_metadata.role` 위조로 우회되지 않으며 격리 E2E를 통과했다. `account_statuses`와 공통 `is_account_active(uuid)`가 기존 Foundation 소유권 정책에 추가되어 suspended 사용자의 민감 조회·쓰기는 정지 전에 발급된 JWT로도 즉시 차단된다. 공개 공고 조회는 유지한다.

---

## 9. `local_jobs`와 `korea_jobs`의 현재 역할

**[확인된 현재 구조]**: 스키마가 서로 다름 — `local_jobs`(26컬럼: category/lat·lng/employer_phone/urgent/images 등)는 국내 상시채용 공고, `korea_jobs`(8컬럼: id/created_at/title/company/region/salary/deadline/source_url/description)는 한국행 해외취업 정보. `KoreaJobs.tsx`는 순수 조회+번역+표시 전용이며, 각 카드 CTA는 `source_url`로의 외부 링크(WorkNet 등 원본 사이트 이동)일 뿐 앱 내부 동작이 아님. **지원/메시지/면접 파이프라인은 `local_jobs`만 참조하며 `korea_jobs`와는 전혀 연결돼 있지 않음.**
**[확인 불가]**: `korea_jobs`를 채우는 크롤러/수집 스크립트의 소재.

---

## 10. 현재 DB와 localStorage가 각각 담당하는 영역

**[확인된 현재 구조]**

| 영역 | 저장소 | 상태 |
|---|---|---|
| 공고 데이터(국내) | Supabase `local_jobs` | 동작 |
| 공고 데이터(한국행) | Supabase `korea_jobs` | 동작 |
| 인증/세션 | Supabase Auth(`auth.users`) | 동작 |
| 지원 | Supabase `applications` | 동작(E2E 검증 완료) |
| 메시지 | Supabase `message_threads`/`messages` | 동작(E2E 22/22) |
| 면접 | Supabase `interviews` | 운영 적용 및 RLS/Realtime E2E 완료 |
| CV/기본 프로필 | 게스트·캐시: localStorage / 로그인 계정: Supabase | 운영 DB·RLS·Storage 격리 E2E 완료, 프론트 Production 배포 전 |
| 공고 저장(찜) | localStorage | 동작(로컬 한정) |
| 커뮤니티 게시글 | localStorage | 동작(로컬 한정, 타 사용자와 공유 안 됨) |
| 회사 리뷰 | localStorage | 동작(로컬 한정) |
| 알림 | localStorage | 부분 동작(마감임박만) |
| 한국 상담 리드 | localStorage | 동작(로컬 한정) |
| 추천/매칭 설정 | localStorage | 코드는 있으나 UI 미노출(11번 참고) |

---

## 11. 이미 만들어졌지만 아직 연결되지 않은 기능

**[확인된 현재 구조]**
- `RecommendSection.tsx` + `recommendStorage.ts`(점수 기반 매칭 로직) — 완성된 코드지만 어디서도 렌더링되지 않는 미사용 상태(import하는 곳 0곳).
- `notificationsStorage.ts`는 구직자 세션의 `applications` 상태 변화를 60초 주기와 앱 이벤트로 확인해 브라우저 로컬 알림을 생성함. 기업 세션에서는 지원자 목록을 상태 알림으로 잘못 처리하지 않도록 조회를 차단함.
- 메시지와 면접 Supabase 연동은 운영 DB 적용 및 격리 E2E 완료. 면접 Realtime과 소유권 불변 정책도 검증됐다.
- `KoreaBanner.tsx`/`KoreaConsultModal.tsx`/`koreaLeadsStorage.ts` — 한국 취업 상담 리드 수집용 신규 컴포넌트. `korea_jobs`의 개별 공고와는 연결되지 않은 별도의 localStorage 기반 리드캡처(홈 화면 배너 클릭 → 상담 신청 모달 → localStorage 저장).
- `0001_applications.sql`·`0002_messages.sql`·`0003_interviews.sql`·`0004_local_jobs_employer_id.sql`·`0005_account_roles_local_jobs_rls.sql`·`0006_user_profiles.sql`·`0007_user_cvs.sql`·`0008_cv_photos_storage.sql`·`0009_admin_operations.sql` — **운영 DB 적용 완료**. Foundation 및 관리자 운영 RLS/E2E와 합성 데이터 0건 정리 확인 완료.

---

## 12. 향후 구조 변경 시 영향을 받는 핵심 의존관계

**[확인된 현재 구조]**
- `Job.id = "sb-<local_jobs.id>"` 문자열 규칙 — 프론트 전역이 이 포맷에 의존. 변경 시 전체 영향.
- `job_id bigint → local_jobs(id)` FK — `applications`/`message_threads`/`interviews` 설계가 전부 이 참조 하나에 고정돼 있음. `korea_jobs` 연동을 시도하면 이 지점부터 다시 설계해야 함.
- RLS 소유권 모델(`seeker_id = auth.uid() or employer_id = auth.uid()`) — 4개 미생성 테이블 설계 전체의 전제.
- 7대 카테고리 체계 — 크롤러 분류기·필터 UI·기존 362건+ 데이터가 이 값에 맞춰 정렬돼 있음. `AdminDashboard.tsx`의 `office` 누락은 수정 완료.
- Supabase anon 키/클라이언트 인스턴스 — `lib/supabase.ts` 외 3개 파일(`JobsContext.tsx`/`PostJob.tsx`/`KoreaJobs.tsx`)에 개별 하드코딩 중복. 키 교체 시 4곳 모두 손대야 함.
- VPS 크롤러(crontab + `.env`) — 실제 운영 파이프라인. GitHub Actions 크롤러는 별도로 존재하나 현재 매번 0건 수집(Cloudflare로 추정)이라 VPS가 사실상 유일한 데이터 공급원.
