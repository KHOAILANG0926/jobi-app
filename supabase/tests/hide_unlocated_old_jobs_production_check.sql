-- 20261111210000: 3건이 지워지지 않고 남아 있는지(삭제 금지) 확인한다.
-- 숨김 여부는 검사하지 않는다 — 나중에 위치를 찾아 ops-publish-jobs로 다시 공개하면 정상이기 때문.
do $t$ begin
 if (select count(*) from public.local_jobs where id in (4828,5421,5437)) <> 3 then raise exception 'hidden jobs must not be deleted'; end if;
end $t$;
