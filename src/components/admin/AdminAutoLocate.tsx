import { AdminMapR1Locate } from './AdminMapR1Locate'

// MAP-R1 replaces separate company/street runs with one prioritized, durable worker.
// The existing ADDRESS_STRATEGY and COMPANY_STRATEGY remain the shared matching authority.
export function AdminAutoLocate({ onChanged }: { onChanged: () => Promise<void> }) {
  return <AdminMapR1Locate onChanged={onChanged} />
}
