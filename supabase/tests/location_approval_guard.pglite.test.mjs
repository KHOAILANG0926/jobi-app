// supabase/pending/20261011120000_location_approval_evidence_guard.sql 검증(PGlite, 실제 Supabase 대신 아님).
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/location_approval_guard.pglite.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const db = new PGlite()
let pass=0, fail=0
const ok=(c,m)=>{ if(c){pass++;console.log('✅',m)}else{fail++;console.log('❌',m)} }
async function tryq(sql){ try{ await db.exec(sql); return null } catch(e){ return e.message.split('\n')[0] } }
await db.exec(`
create table public.job_work_locations(id bigserial primary key, job_id bigint, industrial_park text);
create table public.job_location_candidates(id bigserial primary key, job_id bigint, status text, evidence text not null, evidence_urls text[] not null default '{}');
insert into job_work_locations(job_id, industrial_park) values (1,null),(2,null),(3,'vsip-bac-ninh'),(4,null);
`)
await db.exec(readFileSync(new URL('../pending/20261011120000_location_approval_evidence_guard.sql', import.meta.url),'utf8'))
const ADDR = "[Tự động] Tìm theo địa chỉ chi tiết trên VietMap: Pizza Hut Bắc Ninh\nĐịa chỉ trong tin: x\nĐịa chỉ VietMap: Pizza Hut Bắc Ninh 1A Lê Thái Tổ, Phường Võ Cường\nVietMap ref: geocode:ABC"
const NAME = "[Tự động] VietMap POI: Pizza Hut\nĐịa chỉ POI: Pizza Hut, Phường Từ Sơn\nVietMap ref: geocode:XYZ"
const sq = (s)=>"E'"+s.replace(/'/g,"''").replace(/\n/g,'\\n')+"'"
await db.exec(`insert into job_location_candidates(job_id,status,evidence) values (1,'pending',${sq(ADDR)}),(2,'pending',${sq(NAME)}),(3,'pending',${sq(NAME)}),(4,'pending','Chọn thủ công trên bản đồ'),(4,'pending','Chọn thủ công trên bản đồ')`)
await db.exec(`update job_location_candidates set evidence_urls='{https://example.com/proof}' where id=5`)
ok(await tryq(`update job_location_candidates set status='approved' where id=1`)===null, 'A1 주소 번지 근거 있음 → 승인 허용 (#4713 유형)')
const e2=await tryq(`update job_location_candidates set status='approved' where id=2`); ok(!!e2 && e2.includes('approval rejected'), 'KCN 밖 회사명만 → 승인 거부 (#4702 유형)')
ok(await tryq(`update job_location_candidates set status='approved' where id=3`)===null, 'A2 KCN 근무지 + VietMap 근거 → 승인 허용')
const e4=await tryq(`update job_location_candidates set status='approved' where id=4`); ok(!!e4 && e4.includes('evidence URL'), '수동 승인 근거 링크 없음 → 거부')
ok(await tryq(`update job_location_candidates set status='approved' where id=5`)===null, '수동 승인 + 근거 링크 → 허용')
const e6=await tryq(`insert into job_location_candidates(job_id,status,evidence) values (2,'approved',${sq(NAME)})`); ok(!!e6, '처음부터 approved로 INSERT해도 같은 검사')
ok(await tryq(`update job_location_candidates set status='revoked' where id=1`)===null, '철회는 항상 허용')
ok(await tryq(`update job_location_candidates set evidence='x' where id=3`)===null, '이미 승인된 행의 다른 컬럼 수정은 검사 안 함')
console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0)
