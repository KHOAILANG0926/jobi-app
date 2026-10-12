import spec from './job-posting-v1.json' with { type: 'json' }

export const POLICY_VERSION = spec.version
export function normalizePolicyText(value) {
  return typeof value === 'string' ? value.toLowerCase().normalize('NFD')
    .replace(/đ/g, 'd').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/[^a-z0-9가-힣\s]/g, ' ').replace(/\s+/g, ' ').trim() : ''
}
const matches = (pattern, text) => new RegExp(`(^|[^a-z0-9])(?:${pattern})(?=$|[^a-z0-9])`, 'u').test(text)
const result = (decision, reason) => ({decision, reason, version: POLICY_VERSION})

/** Advisory application gate. DB trigger is required for direct REST/SQL atomic enforcement. */
export function evaluateJobPolicy(input) {
  try {
    if (!input || typeof input !== 'object') return result('review', 'missing_content')
    const fields = Object.fromEntries(['title','description','category'].map(k => [k, normalizePolicyText(input[k])]))
    const role = `${fields.title} ${fields.description}`
    const localWork = matches(spec.local_work, fields.title) || matches(spec.local_duty, fields.description)
    let review
    for (const rule of spec.rules) {
      if (rule.unless === 'local_work' && localWork) continue
      if (rule.requires === 'sales' && !matches(spec.sales, role)) continue
      for (const field of rule.fields) {
        if (!matches(rule.pattern, fields[field])) continue
        // A negated or mixed duty is ambiguous, never affirmative exclusion evidence.
        if (matches(spec.negation, fields[field])) { review = 'ambiguous_role'; continue }
        if (rule.decision === 'exclude') return result('exclude', rule.id)
        review ??= rule.id
      }
    }
    if (!fields.title || !fields.description) return result('review', 'missing_content')
    if (review) return result('review', review)
    if (matches(spec.generic_title, fields.title) && !matches(spec.substantive_duty, fields.description)) return result('review', 'ambiguous_role')
    if (matches(spec.sales, role) && !localWork) return result('review', 'unclear_sales')
    return result('allow', 'allowed')
  } catch { return result('review', 'policy_unavailable') }
}

export function policyMessage(decision) {
  return spec.messages[decision.reason] || spec.messages.policy_unavailable
}
export function assertJobPolicy(input) {
  const decision = evaluateJobPolicy(input)
  if (decision.decision !== 'allow') throw new Error(policyMessage(decision))
  return decision
}

export function assertJobChange(current, patch = {}) {
  if (!current || typeof current !== 'object') throw new Error(spec.messages.policy_unavailable)
  const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
  return assertJobPolicy({ ...current, ...definedPatch })
}
