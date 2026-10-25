// Shared by the admin review queue and its four production-shape regression tests.
const normal = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const valid = (lat,lng) => typeof lat==='number' && typeof lng==='number' && Number.isFinite(lat) && Number.isFinite(lng) && lat>=8 && lat<=24 && lng>=102 && lng<=110
export function needsAdminLocationReview(job,locations=[],approvals=[]) {
  if(job.active!==true || job.admin_hidden===true)return false
  const keys=[job.location,...locations.map(w=>w.raw_address)].map(normal).filter(Boolean)
  const approved=approvals.some(c=>c.status==='approved' && normal(c.company_snapshot)===normal(job.company) && keys.includes(normal(c.address_snapshot)) && valid(c.lat,c.lng))
  if(approved)return false
  return !locations.some(w=>w.location_verified===true && valid(w.lat,w.lng))
}
