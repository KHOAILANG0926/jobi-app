// 직업분류 공개 조건 회귀 시험 (PGlite, 운영 DB 접속 없음). 실제 공식 직업분류 데이터 + 실제 운영 공고 사례.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/occupation_publication.pglite.test.mjs
// 규칙(2026-10-18): 원문 근거로 확인 가능한 단계까지 코드. 세부 코드 미확정만으로 비공개 금지.
//                   코드 없음(업무 불명확)·근거 누락·근거가 원문에 없음은 계속 비공개.
// 새 공고 사례가 생기면 아래 CASES에 원문 그대로 추가한다(버그 하나 = 시험 하나).
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const db = new PGlite()
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create table public.local_jobs (id bigint primary key, title text not null default '', company text not null default '', description text,
  source_text text, active boolean default false, admin_hidden boolean not null default false, category text default 'khac');
create table public.job_posting_rules(rule_key text unique, content text, decided_on date, incidents text, machine_checkable text, block_mode text, implementation text);`)
for (const f of ['20261015100000_occupation_master.sql', '20261015100100_occupation_master_seed.sql',
  '20261015120000_local_jobs_occupation_r8.sql', '20261017070517_occupation_publication_gate.sql',
  '20261018090000_occupation_code_any_level.sql']) await db.exec(read(`../migrations/${f}`))
// Validate the rule-table update and its read-only production assertions locally.
await db.exec(read('../pending/fushan-20261027/rules.sql'))
await db.exec(read('../pending/fushan-20261027/rules_production_check.sql'))

const active = async (id) => (await db.query('select active from public.local_jobs where id = $1', [id])).rows[0].active
const insert = (id, title, source, code, evidence) => db.query(
  `insert into public.local_jobs (id, title, source_text, occupation_code, occupation_evidence, active) values ($1,$2,$3,$4,$5,true)`,
  [id, title, source, code, evidence])

// ── 실제 운영 공고 사례 ──
// #4824 CTY KDA: 5단계 코드, 원문 근거 → 공개
await insert(4824, 'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong',
  'KCN YÊN PHONG\nCTY KDA\nTUYỂN FULL\nNAM , NỮ (14-50t)\nLàm ngồi linh kiện tai nghe', '82022', 'linh kiện tai nghe')
assert.equal(await active(4824), true, '#4824 공개 유지')

// #4827: "ĐT + Máy tính"만 있고 실제 업무 불명확 → 코드를 붙일 근거 없음 → 비공개
await insert(4827, 'Tuyển 1 bạn trẻ làm trên ĐT + Máy tính',
  'Công việc nhẹ nhàng\nLàm trên ĐT + Máy tính\nCông việc ko Cty + ĐC sử dụng ĐT\nLàm linh hoạt', null, null)
assert.equal(await active(4827), false, '#4827 업무 불명확 → 비공개')
await db.query('update public.local_jobs set active = true where id = 4827')
assert.equal(await active(4827), false, '#4827 active만 켜서 우회 불가')

// #4828: 업무 명확(데이터·네트워크 케이블 생산), 조립/기계 운전은 미기재 → 1단계 '8'까지만 → 공개
await insert(4828, 'Tuyển công nhân sản xuất dây truyền dữ liệu, dây mạng',
  'TUYỂN CÔNG NHÂN\nCHÍNH THỨC & THỜI VỤ\nCÔNG VIỆC\nSản xuất dây truyền dữ liệu, dây mạng.', '8', 'Sản xuất dây truyền dữ liệu, dây mạng')
assert.equal(await active(4828), true, '#4828 세부 코드 미확정만으로 차단하지 않음')

// 2026-10-27 Lee: 공단 공장임이 확인된 FUSHAN, 실제 업무는 미기재.
// 가장 상위 공식 코드만 사용. 공단명 자체가 공장 확인을 자동 증명하는 시험은 아니다.
const fushanSource = `CTY - FUSHAN THƯỞNG 13.000.000Đ
Tuyển: Chính Thức và Thời Vụ
Cty Thưởng 10.000.000đ
nhà thầu thưởng 3.000.000đ
LCB + PC: 7.200.000đ
Thu nhập: 12 -> 17 triệu
Hỗ trợ hồ sơ
Công việc: Làm ngồi, phòng thường
Địa chỉ: VSIP - Bắc Ninh (Có KTX và hỗ trợ tìm trọ)
Liên hệ Zalo: 0388492985`
const fushanEvidence = 'Làm ngồi, phòng thường\nĐịa chỉ: VSIP'
const master = (await db.query("select level, name_vi from public.occupation_master where code='9'")).rows[0]
assert.equal(master.level, 1, '새 코드가 아닌 실제 최상위 공식 코드')
assert.equal(master.name_vi, 'Lao động giản đơn')
await insert(20, 'FUSHAN — Chính Thức và Thời Vụ', fushanSource, '9', fushanEvidence)
assert.equal(await active(20), true, 'Lee가 확인한 공단 공장: 업무 미기재만으로 비공개하지 않음')
await db.query(`update public.local_jobs set description = $1 where id = 20`,
  ['Công việc\nCông việc cụ thể: chưa ghi trong tin gốc'])
assert.equal(await active(20), true, '미기재 안내를 추가해도 원문 근거 유지')
// 확정 맥락이 없는 공고에 임의 코드를 붙이지 않는 기존 등록 판단을 유지한다.
await insert(21, 'Công việc tại Bắc Ninh', 'Làm ngồi, phòng thường\nĐịa chỉ: Bắc Ninh', null, null)
assert.equal(await active(21), false, '공단 밖·업무 불명은 기존 미분류 보류')
await insert(22, 'Công việc tại VSIP', 'Địa chỉ: VSIP - Bắc Ninh', null, null)
assert.equal(await active(22), false, '공단명만 있고 공장 여부 불명인 공고는 보류')
await db.query(`update public.local_jobs set source_text = replace(source_text, 'VSIP', 'Bắc Ninh'), active = true where id = 20`)
assert.equal(await active(20), false, '공단 원문 근거가 사라지면 공개 불가')
await assert.rejects(insert(23, 'FUSHAN', fushanSource, '9', 'lắp ráp điện tử'), /job_rule_R8/,
  '회사명만으로 전자 조립 근거를 만들지 않음')

// Bomunttl: one announcement, two explicit roles. Single stored code is the
// first role only. Each role was separately compared with the official definitions.
await insert(30, 'Bomunttl', 'Bomunttl\nCÔ RỬA BÁT FULL TIME\nNHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME', '9402', 'CÔ RỬA BÁT')
assert.equal(await active(30), true, 'Bomunttl dishwasher supported by official kitchen-helper code')
await insert(31, 'Bomunttl occupation-only fixture', 'NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME', '5131', 'CHẠY BÀN')
assert.equal(await active(31), true, 'separate local fixture checks waiter classification, not a second production announcement')

// ── 유지돼야 하는 차단 ──
await assert.rejects(insert(10, 'x', 'Sản xuất dây mạng', '99999', 'dây mạng'), /foreign key/, '없는 코드')
await assert.rejects(insert(11, 'x', 'Sản xuất dây mạng', '8', 'thợ hàn'), /job_rule_R8/, '원문에 없는 근거')
await assert.rejects(insert(12, 'x', 'Sản xuất dây mạng', '8', null), /job_rule_R8/, '근거 누락')
// 제목에만 있는 말(가공된 글)은 원문 근거로 인정하지 않음 → R8은 통과하지만 공개 게이트가 비공개
await insert(13, 'Tuyển thợ hàn', 'Công việc nhẹ nhàng', '7212', 'thợ hàn')
assert.equal(await active(13), false, '원문(source_text)에 없는 근거 → 비공개')
// 원문이 바뀌어 근거가 사라지면 비공개
await db.query(`update public.local_jobs set source_text = 'Nội dung đã thay đổi', active = true where id = 4828`)
assert.equal(await active(4828), false, '원문 변경으로 근거 소실 → 비공개')

console.log('occupation publication pglite: all real-case assertions passed')
await db.close()
