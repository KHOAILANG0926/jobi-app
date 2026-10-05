import { sanitizeVietMapError } from './vietMapError.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

const sanitized = sanitizeVietMapError('Failed https://maps.vietmap.vn/maps/tiles/12/1/2.pbf?apikey=secret-value&x=1')
assert(!sanitized.includes('secret-value'), 'redacts the Tilemap key from diagnostic messages')
assert(sanitized.includes('apikey=[REDACTED]'), 'keeps a safe marker for the redacted key')
assert(sanitized.includes('/maps/tiles/12/1/2.pbf'), 'keeps the failing resource path')

console.log('vietMapError.test.ts: diagnostic redaction assertions passed')
