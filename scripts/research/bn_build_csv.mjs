// 박닌 수집 JSON(out/bn_*.json) → 검토용 CSV. DB 쓰기 없음.
// 실행: node --import ./scripts/ts-extensionless-register.mjs scripts/research/bn_build_csv.mjs [--existing=id1,id2,..]
import fs from 'node:fs'
import { findIndustrialPark, foldText } from '../../src/lib/industrialPark.ts'

const existingIds = new Set((process.argv.find(a => a.startsWith('--existing=')) ?? '').slice(11).split(',').filter(Boolean))
const PLACEHOLDER = /nhà tuyển dụng|ẩn danh|không rõ/i
const OLD_BG = /Bắc Giang cũ|Thành phố Bắc Giang|Phường Bắc Giang|Huyện (?:Việt Yên|Yên Dũng|Hiệp Hòa|Tân Yên|Lạng Giang|Lục Nam|Lục Ngạn|Sơn Động|Yên Thế)/i
const isOldBG = s => /Bắc Giang cũ/i.test(s) ? true : /Bắc Ninh cũ/i.test(s) ? false : OLD_BG.test(s)
const dir = 'scripts/research/out/'
const rows = []
for (const f of fs.readdirSync(dir).filter(f => /^bn_.*\.json$/.test(f))) rows.push(...JSON.parse(fs.readFileSync(dir + f, 'utf8')))

const seen = new Set(), out = [], stats = {}
const bump = (src, k) => { (stats[src] ??= {}); stats[src][k] = (stats[src][k] ?? 0) + 1 }
for (const r of rows) {
  const segs = String(r.address || '').split('\n').map(s => s.trim()).filter(Boolean)
  const bnSegs = segs.filter(s => /^Bắc Ninh:/.test(s))
  const pureBn = bnSegs.filter(s => !isOldBG(s))
  const sid = (r.url_internal_only.match(/id(\d+)\.html/) || [])[1]
  let reason = ''
  if (!r.company?.trim() || PLACEHOLDER.test(r.company)) reason = '회사명 없음/자리표시자'
  else if (!bnSegs.length) reason = '박닌 근무지 아님'
  else if (!pureBn.length) reason = '옛 박장 지역(합병 신박닌)'
  else if (r.expired || (r.deadline && r.deadline <= new Date().toISOString().slice(0, 10))) reason = '마감'
  else if (existingIds.has(sid)) reason = '기존 DB 중복'
  const addr = (pureBn.length ? pureBn : bnSegs).map(s => s.replace(/^Bắc Ninh:/, '')).join(' || ')
  const key = foldText(r.company + '|' + r.title + '|' + (pureBn[0] ?? ''))
  if (!reason && seen.has(key)) reason = '수집분 내부 중복'
  if (!reason) seen.add(key)
  const park = findIndustrialPark(addr, r.title)
  out.push({ company: r.company, title: r.title, salary: r.salary, address: addr, kcn: park?.name ?? '', contact: (r.phones || []).join(' / '), source: r.source, hasContact: (r.phones||[]).length?'Y':'N', collected: new Date().toISOString().slice(0, 10), excluded: reason, deadline: r.deadline ?? '' })
  bump(r.source, reason ? 'x:' + reason : 'ok')
}
const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
const cols = ['company', 'title', 'salary', 'address', 'kcn', 'contact', 'hasContact', 'source', 'collected', 'deadline', 'excluded']
const head = ['회사명', '직무', '급여', '근무지 원문 주소', 'KCN 매칭', '연락처', '연락처 유무', '출처 사이트', '수집일', '마감일', '제외 사유']
fs.writeFileSync(dir + 'bacninh_review.csv', '﻿' + [head.join(','), ...out.map(o => cols.map(c => esc(o[c])).join(','))].join('\r\n'))
console.log(JSON.stringify(stats, null, 1))
console.log('included w/ contact (기준 건수):', out.filter(o => !o.excluded && o.contact).length)
console.log('included:', out.filter(o => !o.excluded).length, '/ with contact:', out.filter(o => !o.excluded && o.contact).length, '/ with KCN:', out.filter(o => !o.excluded && o.kcn).length)
