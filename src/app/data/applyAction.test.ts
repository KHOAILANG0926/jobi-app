const assert = { equal(a: unknown, b: unknown, msg = '') { if (a !== b) throw new Error(msg || `${a} !== ${b}`) } }
import { appApplyButton } from './applyAction.ts'

assert.equal(appApplyButton({ employerId: 'e1' }).kind, 'internal', 'employer-account posting → in-app apply')
assert.equal(appApplyButton({ employerId: 'e1' }).label, 'Ứng tuyển', 'label')
const c = appApplyButton({ employerPhone: '0912 345 678' })
assert.equal(c.kind, 'contact', 'collected posting with a phone → contact')
assert.equal(c.label, 'Gọi', 'label')
assert.equal(c.href, 'tel:0912345678', 'tel link strips spaces')
assert.equal(appApplyButton({ zalo: '0912345678' }).label, 'Zalo', 'zalo only → Zalo button')
assert.equal(appApplyButton({}).kind, 'none', 'no contact → no button')
assert.equal(appApplyButton({}).label, '', 'no label')
console.log('app applyAction: internal / contact(phone, zalo) / none follow resolveApplyAction passed')
