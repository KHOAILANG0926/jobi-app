import { readFileSync } from 'node:fs'
import { evaluateJobPostingPolicy } from '../src/lib/jobPostingPolicy.mjs'
const cases = JSON.parse(readFileSync(new URL('../policy/job-posting-fixtures.json', import.meta.url), 'utf8'))
console.log(JSON.stringify(cases.map(fixture => evaluateJobPostingPolicy(fixture.input))))
