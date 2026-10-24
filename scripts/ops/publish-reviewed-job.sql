\set ON_ERROR_STOP on
begin;
create temporary table review_target on commit drop as
select j.id, job_publication_private.content_fingerprint(j) as content_hash
from public.local_jobs j
join job_publication_private.review_queue q on q.job_id = j.id
where j.id = :job_id
  and j.active and j.admin_hidden and q.auto_release
  and q.content_hash = :'expected'
  and job_publication_private.content_fingerprint(j) = :'expected';
do $$ begin
  if (select count(*) from review_target) <> 1 then
    raise exception 'review content changed, approval rejected';
  end if;
end $$;
insert into job_publication_private.approvals(job_id,content_hash,evidence)
select id, content_hash,
  jsonb_build_object('result','pass','browser_test','playwright-390-1280',
    'source_review','exact-job-structured-source-check',
    'git_sha', :'git_sha', 'reviewed_at', now())
from review_target
on conflict(job_id) do update set
  content_hash=excluded.content_hash, evidence=excluded.evidence, verified_at=now();
update public.local_jobs set admin_hidden=false, active=true
where id in (select id from review_target);
do $$ begin
  if exists (select 1 from review_target r join public.local_jobs j on j.id=r.id
            where not (j.active and not j.admin_hidden)) then
    raise exception 'R1-R8 did not permit publication';
  end if;
end $$;
delete from job_publication_private.review_queue
where job_id in (select id from review_target);
commit;
