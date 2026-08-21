export type LocalImportDecision = 'accepted' | 'declined'

const IMPORT_KEY_PREFIX = 'vgb_account_import:'
const CLAIMED_BY_KEY = 'vgb_local_profile_cv_claimed_by'

function importKey(userId: string): string {
  return `${IMPORT_KEY_PREFIX}${userId}`
}

export function loadLocalImportDecision(userId: string): LocalImportDecision | null {
  const value = localStorage.getItem(importKey(userId))
  return value === 'accepted' || value === 'declined' ? value : null
}

export function shouldOfferLocalImport(
  userId: string,
  serverHasData: boolean,
  localHasData: boolean,
): boolean {
  const claimedBy = localStorage.getItem(CLAIMED_BY_KEY)
  return !serverHasData
    && localHasData
    && (!claimedBy || claimedBy === userId)
    && loadLocalImportDecision(userId) === null
}

export function markLocalImportDecision(
  userId: string,
  decision: LocalImportDecision,
): void {
  localStorage.setItem(importKey(userId), decision)
  if (decision === 'accepted') localStorage.setItem(CLAIMED_BY_KEY, userId)
}
