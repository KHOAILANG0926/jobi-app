-- 시험용 Google 요청량 따로 세기(Lee 2026-11-09 "현재 프로젝트에서 시험과 운영의 요청량을 분리하고 운영 몫을 우선 보호").
-- 같은 Google 프로젝트·같은 키라 Google 쪽 한도는 시험과 운영이 함께 쓴다(2026-11-09 시험 106회 뒤 429로 운영 위치 확인까지 막힘).
-- 시험 도구(location-ladder-compare)는 Text Search(Pro·IDs Only 모두 같은 SearchText 한도)를 부를 때마다 이 시험 몫을 먼저 예약하고,
-- Pro는 운영 몫(google_text_search 4,500)에도 함께 센다(무료 5,000은 같이 씀). 시험 몫에 닿으면 시험만 멈추고 운영은 그대로.
-- 표·함수 구조는 그대로(external_api_limits에 한 줄 추가만). 한도 값 변경은 migration으로만.
do $pre$
begin
  if to_regclass('public.external_api_limits') is null then raise exception 'google test quota: 한도 표 없음'; end if;
  if exists (select 1 from public.external_api_limits where api = 'google_text_search_test') then
    raise exception 'google test quota: 이미 적용됨';
  end if;
end $pre$;

insert into public.external_api_limits (api, monthly_limit, note) values
  ('google_text_search_test', 600, '시험 도구 Google Text Search(Pro+IDs Only) 월 몫. 운영 몫(google_text_search)과 별도, 하루 한 번·40회는 시험 워크플로가 지킴');
