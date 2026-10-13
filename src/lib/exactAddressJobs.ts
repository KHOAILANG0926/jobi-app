export interface ExactAddressEntry {
  id: number
  title: string
  company: string
  locations: { id: number; address: string; point?: { lat: number; lng: number } }[]
}
const normalize = (value: unknown) => String(value ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

/** Uses stored DB accuracy, never the UI's inferred address classification. */
export function exactAddressEntries(rows: Record<string, unknown>[], approvals: Record<string, unknown>[]): ExactAddressEntry[] {
  return rows.filter(r => r.active === true && r.admin_hidden === false).flatMap(r => {
    const locations = ((r.job_work_locations ?? []) as Record<string, unknown>[])
      .filter(l => l.address_accuracy === 'exact_text')
      .map(l => {
        const approved = approvals.find(a => a.status === 'approved' && a.job_id === r.id && a.work_location_id === l.id
          && normalize(a.company_snapshot) === normalize(r.company) && normalize(a.address_snapshot) === normalize(l.raw_address)
          && ['entrance', 'building', 'site'].includes(String(a.place_precision))
          && typeof a.lat === 'number' && Number.isFinite(a.lat) && a.lat >= 8 && a.lat <= 24
          && typeof a.lng === 'number' && Number.isFinite(a.lng) && a.lng >= 102 && a.lng <= 110)
        return { id: Number(l.id), address: String(l.raw_address ?? ''),
          ...(approved ? { point: { lat: Number(approved.lat), lng: Number(approved.lng) } } : {}) }
      })
    return locations.length ? [{ id: Number(r.id), title: String(r.title ?? ''), company: String(r.company ?? ''), locations }] : []
  })
}
