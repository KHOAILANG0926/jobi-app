import rules from '../../policy/job-posting-rules.json' with { type: 'json' }

// Shared rule data with crawler/job_posting_policy.py. No network or DB access.
export const POLICY_VERSION = rules.version
export function normalizePolicyText(value) {
  return String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}
const matches = (name, text) => rules[name].some(pattern => new RegExp(pattern).test(text))
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function moneyReason(fields) {
  const title = fields.title, category = fields.category
  for (const text of [title, category]) {
    if (matches('debt_role', text)) return 'dedicated_debt_collection'
    for (const [root, targets, window] of rules.debt) {
      for (const target of targets) {
        const a = '\\b' + escape(root) + '\\b', b = '\\b' + escape(target) + '\\b'
        if (new RegExp(a + '.{0,' + window + '}' + b + '|' + b + '.{0,' + window + '}' + a).test(text))
          return 'dedicated_debt_collection'
      }
    }
  }
  if (matches('loan_role', title)) return 'dedicated_finance_sales'
  if (matches('sales_role', title)
      && (matches('loan_product', title) || matches('loan_duty', fields.description)
          || (matches('finance_company', fields.company) && !matches('retail_primary', title)))) return 'dedicated_finance_sales'
  return null
}
export function evaluateJobPostingPolicy(job = {}) {
  const fields = Object.fromEntries(['title', 'company', 'description', 'category', 'salary']
    .map(key => [key, normalizePolicyText(key === 'description'
      ? String(job[key] ?? '').replace(/\[source:[^\]]*\]/gi, '') : job[key])]))
  const result = (decision, reason) => ({ decision, reason, version: POLICY_VERSION })
  const money = moneyReason(fields)
  if (money) return result('exclude', money)
  if (!fields.title || !fields.description || matches('ambiguous_title', fields.title)) return result('review', 'incomplete_role_evidence')
  const sales = matches('sales_role', fields.title)
  const retail = matches('retail_primary', fields.title + ' ' + fields.description)
  const b2b = matches('b2b_primary', fields.title + ' ' + fields.description)
  if (sales && b2b) return retail
    ? result('review', 'mixed_retail_b2b')
    : result('exclude', 'primary_b2b_field_dealer_sales')
  if (sales && matches('b2b_signal', fields.title + ' ' + fields.description))
    return result('review', 'unclear_b2b_role')
  // Income never excludes a job. Store/mart/factory/QC salaries do not trigger this.
  if (sales && !retail && matches('professional_sales', fields.title)
      && matches('incentive', fields.description + ' ' + fields.salary)
      && matches('high_income', fields.description + ' ' + fields.salary))
    return result('review', 'professional_incentive_sales')
  if (sales && !retail) return result('review', 'unclear_sales_role')
  return result('allow', 'no_excluded_role_evidence')
}
export function hasExcludedMoneyRole(job) {
  return ['dedicated_finance_sales', 'dedicated_debt_collection']
    .includes(evaluateJobPostingPolicy(job).reason)
}
export function assertJobPublishable(job) {
  const result = evaluateJobPostingPolicy(job)
  if (result.decision !== 'allow') {
    const message = result.decision === 'review'
      ? 'Tin cần được xem xét hoặc bổ sung mô tả công việc trước khi đăng công khai.'
      : 'Công việc tài chính, thu hồi nợ hoặc kinh doanh B2B ngoài thị trường không phù hợp.'
    throw new Error(message)
  }
  return result
}
// Final-row check: an inactive/hidden edit can still be saved to correct a job.
export function assertPublicJobWrite(previous, patch = {}) {
  const next = { ...previous, ...patch }
  if (next.active === true && next.admin_hidden !== true) assertJobPublishable(next)
  return next
}
