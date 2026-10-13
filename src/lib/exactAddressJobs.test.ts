import { exactAddressEntries } from './exactAddressJobs.ts'
const rows = [
  { id: 1, title: 'A', company: 'Shop', active: true, admin_hidden: false, job_work_locations: [{ id: 11, raw_address: '1 Road', address_accuracy: 'exact_text' }, { id: 12, raw_address: '2 Road', address_accuracy: 'exact_text' }] },
  { id: 2, title: 'B', company: 'Shop', active: true, admin_hidden: false, job_work_locations: [{ id: 21, raw_address: '3 Road', address_accuracy: 'region_only' }] },
  { id: 3, title: 'Hidden', company: 'Shop', active: true, admin_hidden: true, job_work_locations: [{ id: 31, raw_address: '1 Road', address_accuracy: 'exact_text' }] },
]
const approvals = [
  { job_id: 1, work_location_id: 11, company_snapshot: 'Shop', address_snapshot: '1 Road', status: 'pending', lat: 21, lng: 106, place_precision: 'building' },
  { job_id: 1, work_location_id: 12, company_snapshot: 'Shop', address_snapshot: 'old address', status: 'approved', lat: 21, lng: 106, place_precision: 'building' },
]
const entries = exactAddressEntries(rows, approvals)
if (entries.length !== 1 || entries[0].locations.length !== 2) throw new Error('Must count public DB exact_text jobs once, without text reclassification')
if (entries[0].locations.some(l => l.point)) throw new Error('Pending or stale approvals must never become map pins')
const approved = exactAddressEntries(rows, [{ ...approvals[0], status: 'approved' }])
if (approved[0].locations[0].point?.lat !== 21) throw new Error('Matching approved coordinates must connect to the map')
console.log('exactAddressJobs: all assertions passed')
