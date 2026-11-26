import rulesData from '../../data/occupations/occupation_rules.json' with { type: 'json' }
import candidatesData from '../../data/occupations/subcategory_candidates.json' with { type: 'json' }

// 공식 직업코드 읽기(#717 B, Lee 2026-11-25) — 규칙은 수집기(crawler/occupation_classifier.py)와 같은 파일 한 곳(data/occupations/occupation_rules.json).
// 판정 방식도 수집기와 같다: 성조·대소문자를 뺀 글자에서 규칙 순서대로 찾고, 근거는 원문 글자 그대로 잘라 낸다.
// 제목에서 먼저, 없으면 원문 앞부분(title_only 규칙은 제목에서만). 모르면 null(기본값 없음). 같은 결과인지는 occupationReader.test.ts가
// 수집기 시험과 같은 사례 파일(data/occupations/occupation_rule_cases.json)로 고정한다.
const COMPILED = rulesData.rules.map((r) => ({ code: r.code, titleOnly: r.title_only === true, re: new RegExp(r.pattern) }))

function fold(text) {
  const nfc = String(text ?? '').normalize('NFC')
  let out = ''
  const index = []
  let offset = 0
  for (const ch of nfc) {
    const base = ch === 'đ' || ch === 'Đ' ? 'd' : ch.normalize('NFD').replace(/\p{Mn}/gu, '')
    const lower = base.toLowerCase()
    for (let i = 0; i < lower.length; i++) index.push(offset)
    out += lower
    offset += ch.length
  }
  return { nfc, out, index }
}

function find(text, allowTitleOnly) {
  const { nfc, out, index } = fold(text)
  for (const rule of COMPILED) {
    if (rule.titleOnly && !allowTitleOnly) continue
    const m = rule.re.exec(out)
    if (m) {
      const start = index[m.index]
      const last = index[m.index + m[0].length - 1]
      const end = last + (nfc.codePointAt(last) > 0xffff ? 2 : 1)
      return { occupation_code: rule.code, occupation_evidence: nfc.slice(start, end) }
    }
  }
  return null
}

/** {occupation_code, occupation_evidence} 또는 null(미분류). 회사명·공단명은 넘기지 않는다(수집기와 같음). */
export function classifyOccupation(title, sourceText = '') {
  return find(title, true) || find(String(sourceText ?? '').slice(0, rulesData.body_scan_chars), false)
}

/** 작성 화면 소분류의 공식 코드 후보(대응표 A·B·C 줄). 업장 종류(D)·후보 없는 소분류는 빈 목록. */
export function occupationCandidates(category, subcategory) {
  return (subcategory && candidatesData.candidates[category]?.[subcategory]) || []
}

/** 고용주 공고의 직업코드(#717 B ①): 고용주가 쓴 제목·업무 내용에서 규칙이 찾은 코드가 고른 소분류의 후보 안(같거나 그 하위)일 때만.
 *  선택만으로는 확정하지 않는다 — 업무 내용 근거가 없거나 후보 밖이면 null(기존 보류·관리자 확인 절차). 근거는 원문 글자 그대로. */
export function occupationForPost({ category, subcategory, title, description }) {
  const candidates = occupationCandidates(category, subcategory)
  if (!candidates.length) return null
  const hit = classifyOccupation(title, description)
  if (!hit) return null
  return candidates.some((c) => hit.occupation_code.startsWith(c.code) || c.code.startsWith(hit.occupation_code)) ? hit : null
}

/** 규칙 파일의 공식 명칭(작성 화면 안내 줄용). */
export function occupationName(code) {
  return rulesData.rules.find((r) => r.code === code)?.name_vi ?? null
}
