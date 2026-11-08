import { CATEGORY_LABELS } from './categories.ts'
import { SUBCATEGORY_LABELS } from './subcategories.ts'
import {
  JOB_SECTIONS, JOB_CATEGORIES, JOB_FIELDS, NEW_DDL_COLUMNS, NEW_DDL_COLUMNS_2,
  SALARY_BASES, EMPLOYMENT_TYPES, ROTATING_SHIFTS, SALARY_PERIODS, SHIFT_TYPES,
} from './jobSchema.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const same = (a: readonly unknown[], b: readonly unknown[]) => JSON.stringify(a) === JSON.stringify(b)

assert(same(JOB_SECTIONS, ['conditions', 'recruit', 'location', 'description', 'company']), 'section order is fixed')
assert(same([...JOB_CATEGORIES].sort(), Object.keys(CATEGORY_LABELS).sort()), 'categories match CATEGORY_LABELS')
assert(JOB_CATEGORIES.length === 13, '13 major categories')
for (const k of Object.keys(SUBCATEGORY_LABELS)) assert((JOB_CATEGORIES as readonly string[]).includes(k), `subcategory group ${k} is a known category`)

assert(same(SALARY_BASES, ['base', 'total_with_overtime']), 'salary basis values')
assert(same(EMPLOYMENT_TYPES, ['full_time', 'seasonal', 'part_time']), 'employment type values')
assert(same(ROTATING_SHIFTS, [2, 3]), 'rotating shift values')
assert(same(SALARY_PERIODS, ['hour', 'day', 'month', 'other']), 'salary period values')
assert(same(SHIFT_TYPES, ['day', 'night', 'rotating', 'other']), 'shift type values')

assert(JOB_FIELDS.length === 36, `field count is fixed at 36 (got ${JOB_FIELDS.length}) — update docs/DB/screen together`)
const keys = JOB_FIELDS.map((x) => x.key)
assert(new Set(keys).size === keys.length, 'field keys are unique')
const cols = JOB_FIELDS.map((x) => x.column)
assert(new Set(cols).size === cols.length, 'field columns are unique')
for (const x of JOB_FIELDS) assert((JOB_SECTIONS as readonly string[]).includes(x.section), `${x.key} has a valid section`)
assert(NEW_DDL_COLUMNS.length === 9, '9 DDL columns')
for (const c of NEW_DDL_COLUMNS) assert(cols.includes(c), `new DDL column ${c} is registered as a field`)
assert(NEW_DDL_COLUMNS_2.length === 2, '2 more DDL columns (language, business trip)')
for (const c of NEW_DDL_COLUMNS_2) assert(cols.includes(c), `new DDL column ${c} is registered as a field`)
console.log('jobSchema.test.ts: all assertions passed')
