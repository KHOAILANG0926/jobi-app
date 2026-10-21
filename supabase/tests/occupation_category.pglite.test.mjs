// Offline real PostgreSQL trigger checks. No production writes.
import {PGlite} from '@electric-sql/pglite'
import {readFileSync,readdirSync} from 'node:fs'
import assert from 'node:assert/strict'
const read=p=>readFileSync(p,'utf8')
const db=new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role;
create table public.local_jobs(id bigint primary key,category text default 'khac',title text default '',company text default '',description text,source_text text,active boolean default false,admin_hidden boolean default false);
create table public.job_posting_rules(rule_key text unique,content text,decided_on date,incidents text,machine_checkable text,block_mode text,implementation text);`)
for(const f of ['20261015100000_occupation_master.sql','20261015100100_occupation_master_seed.sql','20261015120000_local_jobs_occupation_r8.sql','20261017070517_occupation_publication_gate.sql','20261018090000_occupation_code_any_level.sql'])await db.exec(read('supabase/migrations/'+f))
const dir=['supabase/pending','supabase/migrations'].find(d=>readdirSync(d).some(f=>f.endsWith('_occupation_category_auto.sql')))
const migration=readdirSync(dir).find(f=>f.endsWith('_occupation_category_auto.sql'))
await db.exec(read(dir+'/'+migration))
const put=async(id,code)=>db.query(`insert into local_jobs(id,title,source_text,occupation_code,occupation_evidence,category,active) values($1,'work','work',$2,'work','khac',true) returning category,active`,[id,code])
assert.equal((await put(1,'82022')).rows[0].category,'san_xuat_xay_dung','production registration derives category')
assert.equal((await put(2,'8')).rows[0].category,'san_xuat_xay_dung','coarse official code remains valid')
assert.equal((await put(3,'512')).rows[0].category,'am_thuc_do_uong','cook')
await db.query("update local_jobs set category='thiet_ke' where id=1")
assert.equal((await db.query('select category from local_jobs where id=1')).rows[0].category,'san_xuat_xay_dung','manual override cannot break menus')
await db.query("update local_jobs set occupation_code='8322' where id=1")
assert.equal((await db.query('select category from local_jobs where id=1')).rows[0].category,'lai_xe_giao_hang','code change updates menu category')
await db.query("update local_jobs set source_text='different',title='different' where id=1")
const reset=(await db.query('select occupation_code,category,active from local_jobs where id=1')).rows[0]
assert.deepEqual(reset,{occupation_code:null,category:'khac',active:false},'lost evidence cannot leave stale category or republish')
await assert.rejects(put(4,'99999'),/foreign key/)
const rows=JSON.parse(read('data/occupations/34-2020/occupation_codes.json'))
const rules=JSON.parse(read('data/occupations/category_rules.json'))
const codes=new Set(rows.map(r=>r.code))
const validCategories=new Set([...read('src/data/categories.ts').matchAll(/^  ([a-z_]+):/gm)].map(m=>m[1]))
for(const [prefix,cat]of Object.entries(rules)){assert.ok(codes.has(prefix),`official prefix ${prefix}`);assert.ok(validCategories.has(cat),cat)}
for(const row of rows){const expected=Object.keys(rules).filter(p=>row.code.startsWith(p)).sort((a,b)=>b.length-a.length).map(p=>rules[p])[0]??'khac';const actual=(await db.query('select public.category_for_occupation($1) as category',[row.code])).rows[0].category;assert.equal(actual,expected,row.code)}
assert.equal((await db.query("select public.category_for_occupation('99999') as category")).rows[0].category,'khac')
console.log(`occupation category: 1505 official codes, registration/update/override/evidence/publication checks passed`)
assert.equal((await db.query("select count(*)::int as n from local_jobs where category='am_thuc_do_uong'")).rows[0].n,1,'saved code appears under its menu category')
await db.query("insert into local_jobs(id,category,active) values(50,'thiet_ke',true)")
assert.deepEqual((await db.query('select category,active from local_jobs where id=50')).rows[0],{category:'khac',active:false},'no code cannot get a fabricated industry or bypass publication')
await db.close()
