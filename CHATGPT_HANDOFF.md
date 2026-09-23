# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**커뮤니티 게시판을 localStorage 전용 → Supabase 공용 DB 기반으로 전환 (Phase 1).**
"레딧처럼 실제로 공유되는 게시판" 요청에 따라 진행. 영상 업로드·리뷰 유도
알림 등은 Phase 2로 명시적으로 미룸(사용자 지시).

- **IMPLEMENTED + VERIFIED(로컬) + MASTER PUSHED + PRODUCTION DEPLOYED +
  PRODUCTION VERIFIED.** commit `4be84e8`, master push 완료,
  `viecganban.vn/cong-dong`에서 실제 반영 확인함(브라우저로 직접 확인,
  아래 테스트 결과 참고).

## 변경 내용

### 1. DB 전환 (Supabase, Production 적용 완료)
- 신규 테이블 `community_posts` / `community_comments` / `community_likes`
  — 읽기는 anon 포함 누구나 가능(공개), 쓰기(글/댓글/좋아요)는 로그인한
  본인 소유 행만 가능(RLS).
- `likes_count`/`comments_count`는 트리거로 자동 집계(비정규화).
- `views_count` 컬럼 + `community_increment_views(uuid)` RPC 함수 추가 —
  비로그인 사용자도 호출 가능하지만 조회수 증가 외 다른 컬럼은 못 건드림.
- 신규 storage 버킷 `community-photos` — public 버킷(사진은 누구나 열람),
  업로드/수정/삭제는 본인 폴더(`{userId}/...`)에만 허용. 이미지
  jpeg/png/webp, 장당 8MB 제한, 글당 최대 4장.
- 마이그레이션 3개: `20260921090000_community_board.sql`,
  `20260921091000_community_photos_storage.sql`,
  `20260923050000_community_views_count.sql`.

### 2. 프론트 전면 교체
- [communityStorage.ts](src/lib/communityStorage.ts): localStorage 함수를
  전부 Supabase 호출로 교체(`loadPosts`/`getPost`/`loadComments`/`addPost`
  /`addComment`/`toggleLike`/`loadLikedPostIds`/`incrementViews`). 기존
  SEED 더미 데이터 6개는 제거 — 게시판은 빈 상태로 시작.
- [Community.tsx](src/pages/Community.tsx) / [CommunityPostDetail.tsx](src/pages/CommunityPostDetail.tsx):
  글쓰기/댓글/좋아요는 로그인 필수(비로그인 시 `/dang-nhap?redirect=...`로
  이동, 원래 보던 글로 복귀).
- **목록 UI를 카드형에서 전통 게시판형 리스트로 재구성**(사용자가 카드형이
  "일반 게시판만도 못하다"고 명시적으로 반려 → mockup으로 A/B 비교 후 A
  선택): 분류·제목(댓글수 `[N]`/사진 아이콘/별점 인라인 표시)·글쓴이·조회·
  좋아요 컬럼의 `<table>`.
- **표시 이름(작성자 닉네임) 자동완성 제거** — 실명이 노출돼 "가짜처럼
  보인다"는 지적으로, 글쓰기/댓글 모두 빈칸에서 시작해 매번 직접 입력.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build`(SSR 포함): 전부 클린.
- 브라우저 실측(로컬 + Production 둘 다):
  - 비로그인 상태에서 글쓰기/좋아요 클릭 시 로그인 페이지로 정상 리다이렉트
    (원래 글로 돌아오는 redirect 파라미터 포함).
  - 로그인 계정으로 실제 글 작성(카테고리/별점 검증 포함) 성공, DB에 저장.
  - **다른 세션(비로그인)에서도 같은 글이 그대로 보임 — 공유 게시판 동작
    실측 확인.**
  - 상세페이지 진입 시 조회수 증가(RPC 호출) 확인, 목록·상세 조회수 일치.
  - Production(`viecganban.vn/cong-dong`)에서 동일하게 정상 렌더링 확인
    (리스트형 UI, 실제 저장된 글 노출).
- Supabase 보안 어드바이저 점검: 신규 트리거 함수 2개가 anon/authenticated에
  RPC로 직접 노출되던 것을 발견해 `revoke execute`로 조치 완료. 기존에 있던
  `spatial_ref_sys`(PostGIS 테이블) RLS 미설정 등은 이번 작업과 무관한
  기존 이슈라 손대지 않음(사용자에게 별도 보고).

## 발견된 문제

없음(이번 라운드 범위 내). 단, 초기 콘텐츠가 전혀 없어 게시판이 비어
보이는 문제는 코드로 해결할 범위가 아니라는 결론(사용자 논의 완료) —
운영자 직접 작성 또는 실사용자 유도로 채울 것.

## 다음 결정사항 (사용자 확인 필요)

1. **초기 콘텐츠 채우기**: 운영자가 직접 몇 개 작성(리뷰/팁/Q&A) 또는
   지인에게 요청 — 코드 작업 아님, 사용자가 직접 진행.
2. **Phase 2 기능**(이번엔 의도적으로 제외): 영상 업로드(직접 업로드,
   짧은 길이·용량 제한 + 외부 링크 병행하기로 방향은 합의됨, 구현은 안 함),
   합격자에게 후기 작성 유도 알림(기존 지원/합격 흐름 활용 아이디어만 논의).
3. **기업 공고 유료 상품 정책**: 별도 논의 진행 중 — 첫 제안(등급형 다중
   옵션)은 사용자가 반려하고 범위를 좁혀 재설계 요청함(urgent 비유료화,
   "기간제 우선 노출" 1개만, pledge성 배지는 유료와 절대 연결 금지,
   `local_jobs.employer_id` 실제 DB 상태 재확인 필요) — **재설계 진행 중,
   아직 결론 없음.**
4. **크롤러 재개**: "매일 저녁 8시 전체 크롤"로 재개 요청받았으나, AZDIGI
   VPS 접속 정보를 이 세션·이 PC에서 찾지 못함(과거 인수인계 기록상
   "VPS 실접속 미확인" 상태로 남아있던 것도 확인됨) — **사용자가 집 PC에서
   접속 정보 확인 후 재개하기로 보류.**
