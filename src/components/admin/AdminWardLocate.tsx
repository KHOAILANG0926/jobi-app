import { AdminMapR1Locate } from './AdminMapR1Locate'

// The same job budget and exact → gate → area fallback apply from either admin entry.
// pickWardHit/checkWardPlace remain shared with the historical ward cache tooling.
export function AdminWardLocate() {
  return <AdminMapR1Locate label="Tìm khu vực xã/phường (MAP-R1)" />
}
