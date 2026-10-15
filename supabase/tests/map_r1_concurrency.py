"""Disposable DB: CONTAINER DATABASE, or --local map_r1_DATABASE PORT (psycopg).
Local mode fixes host to 127.0.0.1 and never reads connection environment variables.
"""
import concurrent.futures
import subprocess
import sys
import time

if sys.argv[1] == '--local':
    import psycopg
    database, port = sys.argv[2:]
    if not database.startswith('map_r1_'):
        raise ValueError('disposable map_r1_ database required')
    def query(sql):
        with psycopg.connect(host='127.0.0.1', port=int(port), dbname=database,
                             user='postgres', autocommit=True, connect_timeout=5) as db:
            with db.cursor() as cur:
                cur.execute(sql)
                result = ''
                while True:
                    if cur.description:
                        result = '\n'.join('|'.join('t' if v is True else 'f' if v is False else str(v)
                                                  for v in row) for row in cur.fetchall())
                    if not cur.nextset():
                        return result
else:
    container, database = sys.argv[1:]
    base = ['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', database,
            '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
    def query(sql):
        return subprocess.check_output(base + ['-c', sql], text=True).strip()

for phase in ('before_update', 'after_update'):
    query("""
insert into local_jobs(id,company,location) values(201,'Concurrency fixture','Concurrent address');
insert into job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence)
 values(201,'Concurrency fixture','Concurrent address',21,106,'building','map_listing','human candidate');
set role service_role;
select * from map_r1_claim_batch(10,'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
""")
    cid = query('select id from job_location_candidates where job_id=201')
    review = f"set local role authenticated; select admin_review_location_candidate({cid},'reject','concurrent human decision');"
    # The definer RPC holds this RowShareLock/row lock before acquiring its UPDATE lock.
    before = f'select id from job_location_candidates where id={cid} for update;'
    sql = 'begin; set local statement_timeout=8000; ' + (
        before + 'select pg_sleep(2);' + review if phase == 'before_update'
        else review + 'select pg_sleep(2);') + 'commit;'
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        writer = pool.submit(query, sql)
        try:
            lock = 'RowShareLock' if phase == 'before_update' else 'RowExclusiveLock'
            deadline = time.monotonic() + 5
            while query("select count(*) from pg_locks where relation='job_location_candidates'::regclass "
                        f"and mode='{lock}' and granted") == '0':
                if writer.done():
                    writer.result()
                    raise AssertionError('administrator finished before lock observed')
                if time.monotonic() >= deadline:
                    raise AssertionError('admin write lock not observed')
                time.sleep(.02)
            result = query("""set role service_role; set statement_timeout=8000;
select map_r1_complete(201,'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
'{"kind":"exact","lat":21.01,"lng":106.01,"source":"VietMap fixture","checkedAt":"2026-10-15","address":"Concurrent address","evidence":"synthetic validated evidence"}');""")
            writer.result(timeout=10)
            assert result == 'f', (phase, result)
            assert query("select count(*) from job_location_candidates where job_id=201 and status='approved'") == '0'
            assert query('select status from job_location_candidates where id=' + cid) == 'rejected'
            assert query('select result is null from map_r1_location_jobs where job_id=201') == 't'
            print('MAP-R1 concurrency PASS:', phase, '- administrator rejection preserved')
        finally:
            writer.result(timeout=10)
            query('delete from job_location_candidates where job_id=201; delete from local_jobs where id=201;')
