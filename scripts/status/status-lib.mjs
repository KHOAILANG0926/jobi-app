// STATUS.md 자동 생성용 순수 함수 모음 (네트워크 없음 → 테스트 가능).
// 이 파일과 generate-status.mjs는 "AI 보고 대신 볼 기계 기록"을 만든다.
// 값은 가공하지 않고 원본(DB·GitHub) 그대로 보여 주는 것이 원칙이다.

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export function fmtVN(iso) {
  if (!iso) return '—'
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' (VN)'
}

export function normVi(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

// 주소 문자열에서 첫 "번지 + 도로명"을 뽑는다. 예: "MEDIAMART - 37 Đ. LÝ THÁI TỔ, P. VÕ CƯỜNG" → { num: '37', street: 'ly thai to' }
export function extractHouse(address) {
  const t = normVi(address)
  const m = t.match(/(?:^|[\s,:;\-])(\d+[a-z]?(?:\/\d+)?)\s+(?:d\.\s*|duong\s+|dg\.?\s+)?([a-z]+(?:\s+[a-z]+){0,3})/)
  if (!m) return null
  const street = m[2]
    .split(/\s+/)
    .filter((w) => !['p', 'tp', 'phuong', 'xa', 'thi', 'quan', 'huyen', 'tinh'].includes(w))
    .slice(0, 3)
    .join(' ')
  if (!street) return null
  return { num: m[1], street }
}

// 승인 근거(evidence)에서 VietMap/POI 주소 줄과 POI 이름을 찾는다.
export function parseEvidence(evidence) {
  const lines = String(evidence ?? '').split('\n')
  const addrLine = lines.find((l) => /^Địa chỉ (VietMap|POI):/.test(l.trim()))
  const nameLine = lines.find((l) => /VietMap(?: tile)? POI:|Tìm theo địa chỉ chi tiết trên VietMap:/.test(l))
  const addr = addrLine ? addrLine.replace(/^.*?Địa chỉ (VietMap|POI):\s*/, '') : null
  const poiName = nameLine ? nameLine.replace(/^.*?:\s*/, '') : null
  return { addr, poiName }
}

const GENERIC = new Set(['cong', 'ty', 'tnhh', 'co', 'phan', 'cp', 'viet', 'nam', 'vn', 'chi', 'nhanh', 'tap', 'doan', 'mtv', 'thuong', 'mai', 'dich', 'vu', 'san', 'xuat', 'jsc', 'ltd', 'company', 'the'])

export function companyMatches(company, poiName) {
  if (!company || !poiName) return false
  const poi = normVi(poiName)
  const tokens = normVi(company)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w))
  return tokens.some((w) => poi.includes(w))
}

// 승인된 핀 1건 판정. 사람·AI 판단이 아니라 문자열 대조 결과다.
export function judgeApproval({ rawAddress, company, evidence }) {
  const job = extractHouse(rawAddress)
  const { addr, poiName } = parseEvidence(evidence)
  const ev = addr ? extractHouse(addr) : null
  const sameNum = !!(job && ev && job.num === ev.num)
  const sameStreet = !!(job && ev && (job.street.startsWith(ev.street) || ev.street.startsWith(job.street)))
  const company_ok = companyMatches(company, poiName)
  let verdict
  if (!job) verdict = 'NO_JOB_HOUSE'
  else if (!ev) verdict = 'NO_EVIDENCE_HOUSE'
  else if (!sameNum || !sameStreet) verdict = 'HOUSE_MISMATCH'
  else if (!company_ok) verdict = 'COMPANY_MISMATCH'
  else verdict = 'OK'
  return { verdict, jobHouse: job, evidenceHouse: ev, poiName, companyMatch: company_ok }
}

export const VERDICT_LABEL = {
  OK: '✅ 번지·도로·회사명 일치',
  COMPANY_MISMATCH: '⚠️ 번지·도로 일치, 회사명 불일치',
  HOUSE_MISMATCH: '❌ 번지·도로 불일치',
  NO_EVIDENCE_HOUSE: '⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)',
  NO_JOB_HOUSE: '❌ 공고 주소에 번지 없음',
}

export function parseTestSummary(output) {
  const m = String(output ?? '').match(/(\d+)\/(\d+) test files passed/)
  return m ? { passed: Number(m[1]), total: Number(m[2]) } : null
}

const esc = (s) => String(s ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function renderStatus(d) {
  const L = []
  const bad = []
  L.push('# STATUS — 자동 생성 기록')
  L.push('')
  L.push('> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**')
  L.push('> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.')
  L.push('')
  L.push(`- 생성 시각: **${fmtVN(d.generatedAt)}**`)
  L.push(`- 기준 커밋: \`${d.headSha?.slice(0, 7) ?? '—'}\` (${esc(d.headTitle)})`)
  L.push(`- 실행 기록: ${d.runUrl ?? '—'}`)
  L.push(`- 검증 스크립트 지문(SHA-256): \`${d.selfHash ?? '—'}\``)
  L.push('')

  // 1. 코드 검사
  L.push('## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)')
  L.push('')
  L.push('| 항목 | 결과 |')
  L.push('|---|---|')
  const ok = (v) => (v === 'success' ? '✅ 통과' : v ? `❌ ${v}` : '— 실행 안 함')
  L.push(`| 타입 검사 \`tsc --noEmit\` | ${ok(d.checks?.tsc)} |`)
  const ts = d.checks?.tests
  L.push(`| 테스트 \`npm test\` | ${ts ? `${ts.passed === ts.total ? '✅' : '❌'} ${ts.passed}/${ts.total} 파일 통과` : ok(d.checks?.testsOutcome)} |`)
  if (ts?.failed?.length) L.push(`| 실패한 테스트 | ${ts.failed.map((f) => `\`${f}\``).join(', ')} |`)
  L.push(`| 빌드 \`npm run build\` | ${ok(d.checks?.build)} |`)
  if (d.checks?.tsc && d.checks.tsc !== 'success') bad.push('타입 검사 실패')
  if (ts && ts.passed !== ts.total) bad.push(`테스트 ${ts.total - ts.passed}건 실패`)
  if (d.checks?.build && d.checks.build !== 'success') bad.push('빌드 실패')
  L.push('')

  // 2. 배포
  L.push('## 2. 배포 (GitHub에 기록된 Vercel 배포)')
  L.push('')
  const dep = d.production
  if (dep) {
    const same = dep.sha && d.headSha && dep.sha === d.headSha
    L.push(`- 마지막 Production 배포: \`${dep.sha?.slice(0, 7)}\` · 상태 **${dep.state ?? '—'}** · ${fmtVN(dep.createdAt)}`)
    L.push(`- master 최신 커밋과 ${same ? '✅ 같음' : '⚠️ 다름 (아직 배포 안 됐거나 다른 브랜치에서 배포됨)'}`)
    if (dep.state && dep.state !== 'success') bad.push(`Production 배포 상태 ${dep.state}`)
  } else {
    L.push('- ⚠️ GitHub에서 Production 배포 기록을 찾지 못함')
  }
  L.push(`- 사이트 응답 https://viecganban.vn/ : **${d.siteStatus ?? '—'}**`)
  if (d.siteStatus !== 200) bad.push(`사이트 응답 ${d.siteStatus}`)
  L.push('')

  // 3. 최근 병합
  L.push('## 3. 최근 병합된 PR')
  L.push('')
  if (d.mergedPrs?.length) {
    L.push('| PR | 병합 시각 | 커밋 | 제목 |')
    L.push('|---|---|---|---|')
    for (const p of d.mergedPrs) L.push(`| #${p.number} | ${fmtVN(p.mergedAt)} | \`${p.sha?.slice(0, 7)}\` | ${esc(p.title)} |`)
  } else L.push('- (조회 결과 없음)')
  L.push('')

  // 4. 공개 데이터
  L.push('## 4. 공개 중인 공고 (DB 직접 조회)')
  L.push('')
  const j = d.jobs
  if (j) {
    L.push(`- 공개 중: **${j.visible}건** (전체 ${j.total}건, 숨김·비활성 ${j.total - j.visible}건)`)
    L.push(`- 출처별: ${Object.entries(j.bySource).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`)
  } else L.push('- ❌ 조회 실패')
  L.push('')

  // 5. 승인 핀
  L.push('## 5. 지도에 핀으로 나가는 승인 좌표')
  L.push('')
  L.push('판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.')
  L.push('')
  if (d.approvals?.length) {
    L.push('| 공고 | 승인 시각 | 판정 | 공고 주소 번지 | 근거 번지 | 근거 POI |')
    L.push('|---|---|---|---|---|---|')
    for (const a of d.approvals) {
      const r = judgeApproval(a)
      const h = (x) => (x ? `${x.num} ${x.street}` : '—')
      L.push(`| #${a.jobId}${a.visible ? '' : ' (비공개)'} | ${fmtVN(a.reviewedAt)} | ${VERDICT_LABEL[r.verdict]} | ${esc(h(r.jobHouse))} | ${esc(h(r.evidenceHouse))} | ${esc(r.poiName)} |`)
      if (r.verdict !== 'OK' && a.visible) bad.push(`핀 #${a.jobId}: ${VERDICT_LABEL[r.verdict]}`)
    }
  } else L.push('- 승인된 핀 없음')
  L.push('')

  // 6. VietMap
  L.push('## 6. VietMap 호출 수 (서버 카운터)')
  L.push('')
  if (d.vietmap?.length) {
    L.push('| 날짜 | 호출 | 마지막 갱신 |')
    L.push('|---|---|---|')
    for (const u of d.vietmap) L.push(`| ${u.day} | ${u.calls} | ${fmtVN(u.updated_at)} |`)
  } else L.push('- 최근 7일 호출 기록 없음')
  L.push('')

  // 7. 관리자 기록
  L.push('## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)')
  L.push('')
  if (d.audit?.length) {
    L.push('| 시각 | 작업 | 대상 |')
    L.push('|---|---|---|')
    for (const a of d.audit) L.push(`| ${fmtVN(a.created_at)} | ${esc(a.action)} | ${esc(a.target_type)} ${esc(a.target_id)} |`)
  } else L.push('- 기록 없음')
  L.push('')

  // 8. 검증 장치 변경
  L.push('## 8. 검증 장치 변경 이력')
  L.push('')
  L.push('이 파일을 만드는 스크립트·워크플로가 바뀌면 여기에 나온다. 7일 이내 변경이 있으면 Lee가 직접 확인한다.')
  L.push('')
  if (d.systemChanges?.length) {
    for (const c of d.systemChanges) {
      L.push(`- ${fmtVN(c.date)} \`${c.sha.slice(0, 7)}\` ${esc(c.message)}`)
      if (c.recent) bad.push(`검증 장치가 최근 바뀜 (${c.sha.slice(0, 7)})`)
    }
  } else L.push('- 조회 결과 없음')
  L.push('')

  // 맨 위 요약은 나중에 끼워 넣는다
  const summary = ['## 한눈에 보기', '']
  if (bad.length) {
    summary.push(`**확인 필요 ${bad.length}건**`)
    summary.push('')
    for (const b of bad) summary.push(`- ${b}`)
  } else summary.push('✅ 확인 필요 항목 없음')
  summary.push('')
  const at = L.findIndex((l) => l.startsWith('## 1.'))
  L.splice(at, 0, ...summary)
  return { markdown: L.join('\n'), problems: bad }
}
