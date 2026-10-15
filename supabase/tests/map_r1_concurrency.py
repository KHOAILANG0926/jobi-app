"""Disposable Docker database only. Pass container and database; no network credentials."""
import subprocess
import sys
import time

container, database = sys.argv[1:]
base = ['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
def query(sql):
    return subprocess.check_output(base + ['-c', sql], text=True).strip()

query("""
insert into local_jobs(id,company,location) values(201,'Concurrency fixture','Concurrent address');
insert into job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(201,'Concurrency fixture','Concurrent address',21,106,'building','map_listing','human candidate');
set role service_role;
select * from map_r1_claim_batch(10,'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
""")
cid = query('select id from job_location_candidates where job_id=201')
writer = subprocess.Popen(base + ['-c', f"""
begin;
set local role authenticated;
select admin_review_location_candidate({cid},'reject','concurrent human decision');
select pg_sleep(2);
commit;
"""], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    # Wait for the actual administrator write lock; avoid a timing-only test.
    deadline = time.monotonic() + 5
    while query("select count(*) from pg_locks where relation='job_location_candidates'::regclass and mode='RowExclusiveLock' and granted") == '0':
        if time.monotonic() >= deadline:
            raise AssertionError('admin write lock not observed')
        time.sleep(.02)
    result = query("""set role service_role;
select map_r1_complete(201,'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
'{"kind":"exact","lat":21.01,"lng":106.01,"source":"VietMap fixture","checkedAt":"2026-10-15","address":"Concurrent address","evidence":"synthetic validated evidence"}');""")
    out, err = writer.communicate(timeout=5)
    assert writer.returncode == 0, err
    assert result == 'f', result
    assert query("select count(*) from job_location_candidates where job_id=201 and status='approved'") == '0'
    assert query("select status from job_location_candidates where id=" + cid) == 'rejected'
    assert query("select result is null from map_r1_location_jobs where job_id=201") == 't'
    print('MAP-R1 concurrency: committed admin rejection wins over waiting automatic approval')
finally:
    if writer.poll() is None:
        writer.terminate()
        writer.communicate()
    query('delete from job_location_candidates where job_id=201; delete from local_jobs where id=201;')
