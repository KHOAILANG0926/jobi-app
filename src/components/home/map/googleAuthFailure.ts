export interface GoogleAuthFailureHost {
  gm_authFailure?: () => void
}

let activeHost: GoogleAuthFailureHost | null = null
let originalHandler: (() => void) | undefined
const listeners = new Set<() => void>()

function invokeSafely(callback: (() => void) | undefined): void {
  try {
    callback?.()
  } catch {
    // Authentication failure listeners are independent; one consumer must not block fallback.
  }
}

function dispatcher(): void {
  invokeSafely(originalHandler)
  for (const listener of [...listeners]) invokeSafely(listener)
}

export function subscribeGoogleAuthFailure(host: GoogleAuthFailureHost, listener: () => void): () => void {
  if (activeHost && activeHost !== host) {
    throw new Error('gm_authFailure registry is already attached to another host')
  }
  if (!activeHost) {
    activeHost = host
    originalHandler = host.gm_authFailure
    host.gm_authFailure = dispatcher
  }
  const subscription = () => listener()
  listeners.add(subscription)
  let cleaned = false

  return () => {
    if (cleaned) return
    cleaned = true
    listeners.delete(subscription)
    if (listeners.size > 0 || activeHost !== host) return
    if (host.gm_authFailure === dispatcher) host.gm_authFailure = originalHandler
    activeHost = null
    originalHandler = undefined
  }
}
