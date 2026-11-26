-- 통합 운영 정상화 J그룹 2순위(Lee 2026-11-26): 지원·공개의 DB 저장 시점 규칙 두 가지. 새 표·RPC 없음(트리거 1개 추가 + 기존 공개 판정 트리거 함수 한 줄 패치).
--  ① 마감·숨김 공고에는 새로 지원할 수 없다 — 지원 저장(INSERT) 순간에 공고 행을 읽고 잠가(FOR SHARE) 판정한다. 화면·서버의 사전 확인이 오래된 상태를 봤어도,
--     같은 순간 공고를 닫는 수정(행 잠금)은 이 판정과 순서대로 처리된다. 기존 지원 내역은 건드리지 않는다(새 INSERT만 막음 — 삭제·수정·조회 정책 그대로).
--     열린 공고 기준 = 화면(isJobOpen)·만료 cron과 같다: active=true, admin_hidden=false, 마감일이 없거나 베트남 날짜 기준 오늘 이상(마감 당일은 열림).
--  ② 공개 중인 기업(employer) 공고에서 연락처(전화·Zalo)나 주소 글자(위치 글자·모집지역·근무지 행)를 모두 없애는 수정은 거부한다. 수집 공고에 이미 적용 중인 공개 판정(연락처 없음 → 비공개)을
--     같은 기준(job_publish_gate_reason)으로 기업 경로에도 적용하되, '공개 중이던 공고가 판정을 통과하다가 못 통과하게 되는 수정'만 막는다 — 새로 등록하는 공고·이미 비어 있던 옛 공고·
--     위치가 확정되지 않았다는 이유는 이 규칙의 대상이 아니다(위치 미확정 공개 정책은 그대로, 새 공개 차단 규칙 없음). 관리자 공고는 기존 결정(2026-10-14 A: 계산 기록만)대로 그대로.
--     기업 경로는 계산값(publish_gate_reason)도 기록한다(관리자와 같은 방식).
--     ※ 공개 판정 트리거 함수는 부른 사람 권한(invoker)이라 기업·게스트 계정(authenticated·anon)이 job_publish_gate_reason 실행 권한이 없어(20261101190000이 회수) 이 줄을 넣으면
--     기업·게스트 등록·수정이 모두 'permission denied'로 실패한다(실제 PostgreSQL 연결 2개 이상 시험으로 확인 — 최고 권한 한 계정인 PGlite는 못 봄). 그래서 같은 함수를 definer로 바꾼다:
--     본문은 NEW로 계산만 하고 호출 계정을 보지 않으므로(수집·관리자 줄 포함) 결과는 같고, 위치 행(job_work_locations)을 RLS 없이 정확히 읽는다.
-- 데이터 변경 없음. 되돌리기: 트리거 삭제 + 공개 판정 함수를 이전 본문으로(이전 20261101190000 그대로, invoker).
begin;

create or replace function public.applications_job_open_gate() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare j record;
begin
  select l.active, l.admin_hidden, l.application_deadline into j from public.local_jobs l where l.id = new.job_id for share;
  if not found
     or not coalesce(j.active, false)
     or coalesce(j.admin_hidden, false)
     or (j.application_deadline is not null and j.application_deadline < (now() at time zone 'Asia/Ho_Chi_Minh')::date)
  then
    raise exception 'applications: 마감·숨김 공고에는 새로 지원할 수 없음' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.applications_job_open_gate() from public, anon, authenticated;

drop trigger if exists applications_job_open_gate on public.applications;
create trigger applications_job_open_gate before insert on public.applications
for each row execute function public.applications_job_open_gate();

do $patch$
declare definition text;
 old_line text := 'if coalesce(new.origin, '''') not in (''crawler'', ''admin'') then return new; end if;';
 new_line text := 'if coalesce(new.origin, '''') = ''employer'' then
    new.publish_gate_reason := public.job_publish_gate_reason(new);
    -- 쓰기 보호(2026-11-26): 공개 중이던 기업 공고가 연락처·주소 글자를 잃는 수정은 거부(새 공고·옛 빈 공고·위치 미확정은 대상 아님)
    if tg_op = ''UPDATE'' and coalesce(new.active, false) and coalesce(old.active, false)
       and public.job_publish_gate_reason(old) = ''ok'' and new.publish_gate_reason <> ''ok'' then
      raise exception ''publish gate: 공개 중인 공고에서 연락처·주소를 없앨 수 없음(%)'', new.publish_gate_reason using errcode = ''check_violation'';
    end if;
    return new;
  end if;
  if coalesce(new.origin, '''') not in (''crawler'', ''admin'') then return new; end if;';
begin
 select pg_get_functiondef('public.enforce_job_publish_gate()'::regprocedure) into definition;
 if position('publish gate: 공개 중인 공고에서' in definition) > 0 then raise exception 'apply/contact gate: 이미 적용됨'; end if;
 if position(old_line in definition) = 0 then raise exception 'apply/contact gate: 공개 판정 함수의 대상 줄을 찾지 못함'; end if;
 if position(old_line in substr(definition, position(old_line in definition) + 1)) > 0 then raise exception 'apply/contact gate: 공개 판정 함수의 대상 줄이 둘 이상'; end if;
 execute replace(definition, old_line, new_line);
 alter function public.enforce_job_publish_gate() security definer;
end $patch$;

commit;
