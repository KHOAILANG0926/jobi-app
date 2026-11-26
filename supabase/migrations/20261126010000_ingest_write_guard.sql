-- 통합 운영 정상화 J그룹 2순위(Lee 2026-11-26): 공고 쓰기 정식 입구(ingest_job)의 우회·덮어쓰기 구멍을 기존 입구 본문 안에서 닫는다.
-- 새 표·새 RPC·새 트리거 없음 — ingest_job 본문의 줄 세 곳만 바꾼다(20261112020000·20261124000000과 같은 방식: 줄이 없거나 둘이면 RAISE로 전체 취소).
--  ① 기업(employer) 경로는 source_url을 받지 않는다 — 공고 원문 주소는 수집·관리자 경로만 쓴다. 임의 주소로 입구를 불러 그 주소를 선점해 나중에 들어오는 같은 주소의 수집 공고가
--     '중복'으로 걸러지게 만드는 길을 막는다(기업 화면은 source_url을 보내지 않는다 — src/ 전체 검색으로 확인).
--  ② 수집(crawler_*) 경로는 기업·관리자 공고의 칸을 다시 수집으로 덮어쓰지 않는다 — job_id 지정 또는 다시 수집(refresh)에서 대상 공고의 origin이 crawler가 아니면 쓸 칸을 비운다.
--     (이미 active·공개 판정 칸은 origin이 다르면 빼고 있었다 — 같은 원칙을 나머지 칸으로 넓힘. 기업·관리자 공고는 자기 경로로만 고친다.)
--  ③ 같은 내용의 동시 등록은 한 줄씩 순서대로 — 내용 해시로 거는 DB 잠금(트랜잭션 끝까지)을 원문 보존 앞에 둔다. 두 요청이 거의 동시에 들어와 둘 다 '없음'으로 보고 둘 다 새 공고가 되던
--     경쟁(같은 해시)을 막는다: 뒤 요청은 앞 요청이 끝난 뒤 '같은 공고'를 찾아 duplicate_of로 돌아간다. 다른 내용·다른 지점 공고는 서로 기다리지 않는다(해시가 다름).
--     같은 원문 주소(source_url)가 있으면 그 주소로도 한 번 더 건다 — 내용이 다른 글(수정본·재수집)이 같은 주소로 동시에 와도 공고가 둘로 갈라지거나 일부 칸만 바뀐 채 남지 않는다
--     (잠금은 해시 → 원문 주소 순서로만 잡아 서로 얽혀 멈추지 않는다).
-- 위치(work_locations)는 그대로: 수집 경로가 비수집 공고에 보내면 replace_job_work_locations가 이미 거부한다(20261026231445).
-- 데이터 변경 없음(함수 본문 교체만). 운영 DB 데이터·기존 공고는 바뀌지 않는다.
begin;
do $patch$
declare definition text;
 old_origin text := 'origin_v := case when ch like ''crawler_%'' then ''crawler'' when ch = ''employer'' then ''employer'' else ''admin'' end;';
 new_origin text := 'origin_v := case when ch like ''crawler_%'' then ''crawler'' when ch = ''employer'' then ''employer'' else ''admin'' end;
  -- 쓰기 입구 보호(2026-11-26): 기업 경로는 원문 주소(source_url)를 받지 않는다 — 임의 주소 선점 차단
  if ch = ''employer'' then p := p - ''source_url''; end if;';
 old_raw text := 'raw_id := ingest_private.open_raw(';
 new_raw text := 'perform pg_advisory_xact_lock(hashtextextended(hash, 0));
  -- 같은 원문 주소(source_url)의 동시 수집도 한 줄씩(내용이 달라 해시가 다른 재수집·수정본 포함). 지점이 다른 형제 공고는 순서만 지킬 뿐 서로 막지 않는다(find_existing이 지점 위치로 가름).
  if nullif(p->>''source_url'', '''') is not null then perform pg_advisory_xact_lock(hashtextextended(p->>''source_url'', 1)); end if;
  raw_id := ingest_private.open_raw(';
 old_gate text := 'if st.origin is distinct from origin_v or st.admin_hidden then';
 new_gate text := 'if ch like ''crawler_%'' and st.origin is distinct from ''crawler'' then
        -- 쓰기 입구 보호(2026-11-26): 수집 경로는 기업·관리자 공고의 칸을 다시 수집으로 덮어쓰지 않는다
        fields := ''{}''::jsonb;
        perform ingest_private.log(raw_id, ''dedup'', ''refresh_skipped:origin:'' || coalesce(st.origin, ''?''));
      end if;
      if st.origin is distinct from origin_v or st.admin_hidden then';
begin
 select pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure) into definition;
 if position('refresh_skipped:origin' in definition) > 0 then raise exception 'ingest write guard: 이미 적용됨'; end if;
 if position(old_origin in definition) = 0 then raise exception 'ingest write guard: ingest_job origin 줄을 찾지 못함'; end if;
 if position(old_origin in substr(definition, position(old_origin in definition) + 1)) > 0 then raise exception 'ingest write guard: ingest_job origin 줄이 둘 이상'; end if;
 if position(old_raw in definition) = 0 then raise exception 'ingest write guard: ingest_job 원문 보존 줄을 찾지 못함'; end if;
 if position(old_raw in substr(definition, position(old_raw in definition) + 1)) > 0 then raise exception 'ingest write guard: ingest_job 원문 보존 줄이 둘 이상'; end if;
 if position(old_gate in definition) = 0 then raise exception 'ingest write guard: ingest_job 갱신 칸 보호 줄을 찾지 못함'; end if;
 if position(old_gate in substr(definition, position(old_gate in definition) + 1)) > 0 then raise exception 'ingest write guard: ingest_job 갱신 칸 보호 줄이 둘 이상'; end if;
 execute replace(replace(replace(definition, old_origin, new_origin), old_gate, new_gate), old_raw, new_raw);
end $patch$;
commit;
