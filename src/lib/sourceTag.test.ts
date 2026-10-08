import { hasSourceTag, stripSourceTags, toPublicJobs } from './sourceTag.ts'
import { parseDescription } from './jobRows.ts'
import type { Job } from '../types/job.ts'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(stripSourceTags('[source:chotot] Cần tuyển') === 'Cần tuyển', 'leading tag removed')
assert(stripSourceTags('Cần tuyển [Source: facebook] gấp') === 'Cần tuyển  gấp', 'mid-text, mixed case, spaced tag removed')
assert(stripSourceTags('[source:a] x [source:b] y').includes('[source') === false, 'every tag removed, not only the first')
assert(stripSourceTags(undefined) === '' && stripSourceTags(null) === '', 'null-safe')
assert(hasSourceTag('x [source:topcv]') && !hasSourceTag('Cần tuyển'), 'hasSourceTag')

const parsed = parseDescription('[source:chotot] ## Mô tả\nLàm ca ngày [source:chotot]')
assert(!parsed.description.includes('source:'), 'parseDescription strips all tags')
assert(parsed.source === 'chotot', 'parseDescription still reports source internally')

const jobs = [{ id: 'sb-1', title: 'A [source:x]', company: 'B', description: '[source:chotot] mô tả', source: 'chotot' }] as unknown as Job[]
const pub = toPublicJobs(jobs)
assert(!('source' in pub[0]), 'public jobs drop the source field')
assert(!JSON.stringify(pub).includes('source:') && !JSON.stringify(pub).includes('chotot'), 'public JSON has no source tag or source name')

console.log('sourceTag tests: all assertions passed')
