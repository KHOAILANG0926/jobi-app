# JOBI P0 Foundation Security Design

## 목적

JOBI의 기존 국내 채용 흐름을 유지하면서 서버가 신뢰할 수 있는 계정 역할과 공고
소유권을 확정하고, 면접 흐름 및 계정 기반 Profile/CV 저장을 운영 Supabase에
연결한다. crawler 품질·재공고 처리는 회사 PC 전용 커밋
`f6918ba2b974999e075bdcc3bed6f49349e301d5`의 범위이므로 이번 작업에서 구현하지
않는다.

## 공통 제약

- 기존 운영 데이터는 삭제하거나 임의로 변경하지 않는다.
- 기존 사용자 역할이 불명확하거나 사용 이력과 충돌하면 자동 변환하지 않고 적용을
  중단해 대상만 보고한다.
- crawler는 service role, 관리자는 `app_metadata.role = 'admin'` 경로를 유지한다.
- Production 배포는 하지 않는다.
- 각 운영 DB 테스트에는 명시적인 합성 식별자를 사용하고 테스트가 끝나면 합성
  데이터만 삭제한다.
- 게스트 CV와 기존 localStorage는 유지하며 서버 저장 성공 전 로컬 데이터를
  삭제하지 않는다.

## 1. 신뢰 가능한 계정 역할

`public.account_roles`는 `user_id uuid primary key references auth.users(id) on delete
cascade`와 `role text not null check (role in ('seeker', 'employer'))`, 생성·갱신 시각을
가진다. 일반 클라이언트에는 자기 역할 SELECT만 허용하고 INSERT/UPDATE/DELETE는
허용하지 않는다.

신규 사용자는 `auth.users` INSERT 트리거가 `raw_user_meta_data.role`을 한 번 읽어
역할 행을 생성한다. 허용되지 않은 값은 `seeker`로 제한한다. 이후
`user_metadata.role` 변경은 `account_roles`에 영향을 주지 않는다.

기존 사용자는 적용 전에 다음 정보를 읽기 전용으로 비교한다.

- `auth.users.raw_user_meta_data.role`
- `local_jobs.employer_id` 소유 이력
- `applications.seeker_id` 지원 이력
- `applications/message_threads.employer_id` 기업 이력

메타데이터가 seeker인데 기업 소유 이력이 있거나, employer인데 구직 활동만 있는 등
충돌하는 계정은 자동 backfill에서 제외하고 migration을 중단한다. 충돌이 없는
계정만 기존 메타데이터 역할로 backfill한다.

## 2. local_jobs RLS와 소유권

`local_jobs`는 RLS를 활성화한다.

- anon/authenticated SELECT: 모든 공개 공고 허용
- employer INSERT: `account_roles.role = 'employer'`이고
  `employer_id = auth.uid()`인 행만 허용
- employer UPDATE/DELETE: 기존 행의 `employer_id = auth.uid()`이고 역할이 employer인
  경우만 허용
- admin INSERT/UPDATE/DELETE: JWT `app_metadata.role = 'admin'`인 경우 허용
- service role: Supabase 기본 RLS bypass를 유지해 crawler가 계속 동작

authenticated에는 필요한 테이블 권한을 주되 RLS로 행을 제한한다. anon에는 SELECT만
부여한다. employer의 UPDATE 열 권한에서 `id`, `employer_id`, 생성·source 소유권
필드는 제외해 소유권 변경을 차단한다. 기존 `employer_id is null` crawler/admin
공고는 employer가 변경할 수 없다.

운영 적용 전 실제 RLS, policy, grants를 읽고 이미 동등하게 안전하면 중복 변경하지
않는다. 적용 후 기업 A/B, seeker, 변조된 `user_metadata.role` 세션으로 positive 및
negative 테스트를 수행한다.

## 3. interviews

기존 `0003_interviews.sql`의 FK는 `local_jobs(id)`, `auth.users(id)`, 실제
`applications(job_id, seeker_id, employer_id)` 조합을 기준으로 다시 확인한다.
기업은 자기 직접등록 공고의 실제 지원자에게만 면접을 생성·수정할 수 있고
구직자와 해당 기업만 조회한다. 소유권 열은 열 권한으로 변경을 차단한다.

상태는 `pending`, `confirmed`, `cancelled`만 허용한다. Realtime publication을
등록한다. 적용 후 합성 기업 A/B·구직자·outsider로 생성, 조회, 상태 변경, 위조,
크롤링 공고, application 부재, Realtime을 검증하고 합성 데이터만 정리한다.

## 4. 계정 Profile

`public.user_profiles`는 `user_id uuid primary key references auth.users(id) on delete
cascade`, `full_name`, `phone`, `email`, `city`, `bio`, 생성·갱신 시각을 가진다.
RLS는 `user_id = auth.uid()`인 본인의 SELECT/INSERT/UPDATE만 허용한다. 클라이언트는
행을 삭제하지 않고 upsert한다.

## 5. 계정 CV

`public.user_cvs`는 `user_id uuid primary key references auth.users(id) on delete
cascade`, `cv_data jsonb not null`, `photo_path text`, 생성·갱신 시각을 가진다.
현재 `CvData`의 경력·학력·기술·참조 구조는 JSONB로 유지하고
`profilePhotoDataUrl`은 DB JSON에서 제거한다. RLS는 본인의 SELECT/INSERT/UPDATE만
허용한다.

## 6. CV 사진 Storage

private bucket `cv-photos`를 사용한다. 객체 경로는 `<auth.uid()>/profile.<확장자>`로
제한한다. `storage.objects` 정책은 경로 첫 segment가 `auth.uid()`인 경우에만
SELECT/INSERT/UPDATE/DELETE를 허용한다. DB에는 객체 경로만 저장하고 화면 표시 때
로그인 세션으로 다운로드하거나 짧은 signed URL을 생성한다. 허용 MIME과 크기를
클라이언트 및 bucket 설정에서 제한한다.

## 7. 프론트 데이터 흐름과 localStorage migration

게스트는 기존 동기식 localStorage CV/Profile 흐름을 그대로 사용한다. 로그인 사용자는
서버 데이터를 우선 로드하고 성공한 서버 저장 결과를 localStorage에 캐시한다.

서버 행이 없고 실제 localStorage 키에 사용자가 저장한 데이터가 존재할 때만 가져오기
확인 UI를 표시한다. 현재 `loadProfile()`의 데모 기본값은 migration 대상으로 보지
않는다. 사용자가 승인하면 서버에 저장하고 사진 업로드까지 모두 성공한 뒤 캐시를
갱신한다. 사용자가 거절하거나 일부가 실패하면 로컬 원본을 그대로 둔다.

계정별 migration 결정을 별도 scope 키로 기록해 계정 전환 시 다른 계정의 CV를 자동
제안하거나 귀속하지 않는다. 원본 localStorage는 이번 단계에서 삭제하지 않는다.

`Profile.tsx`와 `CvBuilder.tsx`의 PDF·미리보기·작성 UI는 유지하고 저장 계층만 비동기
서버 어댑터로 연결한다. 네트워크 실패 시 오류를 표시하며 성공으로 오인하지 않는다.

## 8. 적용 순서와 게이트

1. 기존 사용자 역할과 운영 local_jobs 정책을 읽기 전용으로 감사한다.
2. `account_roles`와 local_jobs RLS migration을 적용하고 격리 테스트한다.
3. interviews migration을 적용하고 E2E 후 합성 데이터를 정리한다.
4. user_profiles migration과 격리 테스트를 수행한다.
5. user_cvs migration과 격리 테스트를 수행한다.
6. private Storage bucket/policy와 파일 격리를 검증한다.
7. Profile/CV 프론트 서버 어댑터를 연결한다.
8. localStorage 가져오기 UX와 계정 전환 격리를 검증한다.

각 단계는 실패해도 독립적으로 가능한 다음 코드 작업을 막지 않지만, 운영 DDL이나
E2E가 확인되지 않은 단계는 완료로 표시하지 않는다.

## 9. 검증

- 역할 backfill 충돌 탐지 테스트
- seeker 및 변조된 user_metadata의 공고 쓰기 차단
- 기업 A/B 공고 소유권 격리
- admin/service 경로 보존
- interviews positive/negative/Realtime 테스트와 데이터 정리 확인
- profile/CV/Storage 본인 접근 및 타인 접근 차단
- 게스트 유지, 서버 우선, 명시적 가져오기, 계정 전환 혼입 방지
- 기존 PDF·미리보기·작성 기능 회귀
- 단계별 `npx tsc --noEmit`, `npm run build`

## 10. 완료 상태

코드 작성은 IMPLEMENTED, 로컬 및 격리 테스트는 VERIFIED, 원격 migration과 실제
운영 E2E까지 성공한 단계만 운영 적용 완료로 구분한다. commit/push는 작업 브랜치에만
수행하고 Production 배포는 별도 승인 전 금지한다.
