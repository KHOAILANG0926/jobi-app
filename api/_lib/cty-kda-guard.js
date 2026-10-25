// Deterministic, server-side defensive normalization AFTER the model response.
// It cannot prove semantic completeness; ambiguous cases are flagged rather than silently erased.
const BENEFITS = ['xang_xe', 'xe_dua_don', 'ky_tuc_xa', 'an_ca', 'chuyen_can', 'nha_o', 'nang_suat']
const CONDITIONS = ['salary', 'work_hours', 'working_days', 'days_off', 'shift', 'benefits_details']
const QUALIFICATIONS = ['recruitment_qty', 'gender', 'age', 'education', 'experience', 'requirements', 'required_documents']
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const normalized = (text) => String(text).normalize('NFKC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').replace(/[.。;,，:：!?！?]+$/g, '').trim()
// Conservative semantic fingerprints for condition-only sentences. Never remove a mixed task/condition line.
const foldVietnamese = (value) => normalized(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
const conditionClass = (value) => {
  const s = foldVietnamese(value)
  if (/\b(luong|thu nhap|salary)\b/.test(s)) return 'salary'
  if (/\b(gio lam|thoi gian lam|ca lam|lam viec tu)\b/.test(s)) return 'work_hours'
  if (/\b(tuoi|do tuoi)\b/.test(s)) return 'age'
  if (/\b(kinh nghiem)\b/.test(s)) return 'experience'
  if (/\b(gioi tinh|nam nu)\b/.test(s)) return 'gender'
  if (/\b(dia chi|dia diem lam viec)\b/.test(s)) return 'address'
  return ''
}
const numberTokens = (value) => [...foldVietnamese(value).matchAll(/\d+(?:[.,:]\d+)*/g)].map((m) => m[0]).join('|')
const asText = (value, where, violations) => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  violations.push('[형식 충돌] ' + where + ': 문자열이 아닌 값이 반환됨; 문자열로 보존')
  return String(value)
}
const asList = (value, where, violations) => {
  if (!Array.isArray(value)) {
    violations.push('[형식 충돌] ' + where + ': 배열이 아님')
    return typeof value === 'string' && value.trim() ? [value] : []
  }
  return value.map((item, index) => asText(item, where + '[' + index + ']', violations)).filter((x) => x.trim())
}
export function guardCtyKdaParserOutput(value) {
  const violations = []
  if (!isObject(value)) throw new TypeError('CTY KDA parser output must be a JSON object')
  if (Array.isArray(value.violations)) violations.push(...value.violations.filter((x) => typeof x === 'string'))
  else if (value.violations !== undefined) violations.push('[형식 충돌] violations는 배열이어야 함')
  const expected = new Set(['violations', 'dieu_kien', 'thong_tin', 'khu_vuc', 'mo_ta_list', 'thong_tin_khac'])
  const extras = Object.keys(value).filter((x) => !expected.has(x))
  if (extras.length) violations.push('[구조 충돌] 허용되지 않은 최상위 키: ' + extras.join(', ') + '; 원본 응답 검토 필요')
  const condition = isObject(value.dieu_kien) ? value.dieu_kien : {}
  const recruitment = isObject(value.thong_tin) ? value.thong_tin : {}
  const location = isObject(value.khu_vuc) ? value.khu_vuc : {}
  for (const [key, obj] of [['dieu_kien', value.dieu_kien], ['thong_tin', value.thong_tin], ['khu_vuc', value.khu_vuc]]) {
    if (!isObject(obj)) violations.push('[구조 충돌] ' + key + ': 누락 또는 객체 아님')
  }
  const dieu_kien = Object.fromEntries(CONDITIONS.map((key) => [key, asText(condition[key], 'dieu_kien.' + key, violations)]))
  dieu_kien.benefits_active = {}
  for (const key of BENEFITS) {
    const flag = condition.benefits_active?.[key]
    if (typeof flag !== 'boolean') violations.push('[Boolean 판정 불가] ' + key + ': true/false 미제공; 근거 재확인 필요')
    dieu_kien.benefits_active[key] = flag === true
  }
  const thong_tin = Object.fromEntries(QUALIFICATIONS.map((key) => [key, asText(recruitment[key], 'thong_tin.' + key, violations)]))
  const khu_vuc = { address: asText(location.address, 'khu_vuc.address', violations) }
  const structuredValues = [
    ...CONDITIONS.map((key) => dieu_kien[key]),
    ...QUALIFICATIONS.map((key) => thong_tin[key]),
    khu_vuc.address,
  ].filter((x) => x.trim()).map(normalized)
  // Only remove full exact duplicates, not substrings: partial removal can lose tasks, amounts, or conditions.
  const seen = new Set()
  const mo_ta_list = []
  for (const item of asList(value.mo_ta_list, 'mo_ta_list', violations)) {
    const key = normalized(item)
    if (structuredValues.includes(key) || seen.has(key)) {
      violations.push('[중복 제거] mo_ta_list에서 정확히 중복된 문장 제거: ' + item)
      continue
    }
    // Pure condition sentences may have different wording from the structured card.
    // Preserve cases with additional numeric details rather than risking data loss.
    const cls = conditionClass(item)
    const target = cls === 'address' ? khu_vuc.address : (dieu_kien[cls] || thong_tin[cls] || '')
    if (cls && target && numberTokens(item) === numberTokens(target) &&
        !/\b(lap rap|van hanh|kiem tra|dong goi|san xuat|assemble|operate)\b/.test(foldVietnamese(item))) {
      violations.push('[의미 중복 제거] 조건 전용 문장을 mo_ta_list에서 제거: ' + item)
      continue
    }
    if (structuredValues.some((field) => field && (key.includes(field) || field.includes(key)))) {
      violations.push('[부분 중복 의심] 업무 문장에 정형 필드 일부 포함: ' + item + '; 정보 손실 방지를 위해 원문 유지')
    }
    seen.add(key)
    mo_ta_list.push(item)
  }
  const thong_tin_khac = asList(value.thong_tin_khac, 'thong_tin_khac', violations)
  // Transport key is NOT a fifth visual section. Render only beneath section ④.
  return { violations: [...new Set(violations)], dieu_kien, thong_tin, khu_vuc, mo_ta_list, thong_tin_khac }
}
