\set ON_ERROR_STOP on
insert into job_publication_private.review_attempts(job_id,content_hash,verdict,reason,verifier_commit)
select j.id, :'expected', 'failed', left(:'reason',1000), :'git_sha'
from public.local_jobs j
where j.id = :job_id
  and job_publication_private.content_fingerprint(j) = :'expected'
  and exists (select 1 from job_publication_private.review_queue q
              where q.job_id=j.id and q.content_hash=:'expected');
