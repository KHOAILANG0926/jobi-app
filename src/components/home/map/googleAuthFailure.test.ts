import { subscribeGoogleAuthFailure, type GoogleAuthFailureHost } from './googleAuthFailure.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

function testPreservesAndRestoresExistingHandler(): void {
  const calls: string[] = []
  const original = () => calls.push('original')
  const host: GoogleAuthFailureHost = { gm_authFailure: original }
  const cleanup = subscribeGoogleAuthFailure(host, () => calls.push('subscriber'))
  host.gm_authFailure?.()
  assert(calls.join(',') === 'original,subscriber', 'dispatcher invokes the preserved handler and subscriber')
  cleanup()
  assert(host.gm_authFailure === original, 'last cleanup restores the exact original handler')
}

function testMultipleSubscribersAndIdempotentCleanup(): void {
  const calls: string[] = []
  const host: GoogleAuthFailureHost = {}
  const cleanupA = subscribeGoogleAuthFailure(host, () => calls.push('a'))
  const cleanupB = subscribeGoogleAuthFailure(host, () => calls.push('b'))
  host.gm_authFailure?.()
  assert(calls.join(',') === 'a,b', 'two subscribers each receive one callback')
  cleanupA()
  cleanupA()
  host.gm_authFailure?.()
  assert(calls.join(',') === 'a,b,b', 'cleaning one subscriber leaves the other active and cleanup is idempotent')
  cleanupB()
  assert(host.gm_authFailure === undefined, 'last cleanup restores an absent original handler')
}

function testStrictModeSequenceDoesNotDuplicate(): void {
  let calls = 0
  const host: GoogleAuthFailureHost = {}
  const firstCleanup = subscribeGoogleAuthFailure(host, () => { calls += 1 })
  firstCleanup()
  const secondCleanup = subscribeGoogleAuthFailure(host, () => { calls += 1 })
  host.gm_authFailure?.()
  assert(calls === 1, 'subscribe-cleanup-subscribe sequence invokes one active listener')
  secondCleanup()
}

function testSameCallbackCanHaveIndependentSubscriptions(): void {
  let calls = 0
  const host: GoogleAuthFailureHost = {}
  const listener = () => { calls += 1 }
  const cleanupA = subscribeGoogleAuthFailure(host, listener)
  const cleanupB = subscribeGoogleAuthFailure(host, listener)
  host.gm_authFailure?.()
  assert(calls === 2, 'each subscription has its own identity even when callbacks match')
  cleanupA()
  host.gm_authFailure?.()
  assert(calls === 3, 'cleaning one matching callback leaves the other subscription active')
  cleanupB()
}

function testCleanupDoesNotOverwriteNewerGlobalHandler(): void {
  const host: GoogleAuthFailureHost = {}
  const cleanup = subscribeGoogleAuthFailure(host, () => undefined)
  const newerHandler = () => undefined
  host.gm_authFailure = newerHandler
  cleanup()
  assert(host.gm_authFailure === newerHandler, 'cleanup preserves a handler installed by another feature')
}

function testThrownHandlerDoesNotSuppressOthers(): void {
  let subscriberCalls = 0
  const host: GoogleAuthFailureHost = { gm_authFailure: () => { throw new Error('expected test error') } }
  const cleanup = subscribeGoogleAuthFailure(host, () => { subscriberCalls += 1 })
  host.gm_authFailure?.()
  assert(subscriberCalls === 1, 'a thrown preserved handler does not suppress subscribers')
  cleanup()
}

for (const test of [
  testPreservesAndRestoresExistingHandler,
  testMultipleSubscribersAndIdempotentCleanup,
  testStrictModeSequenceDoesNotDuplicate,
  testSameCallbackCanHaveIndependentSubscriptions,
  testCleanupDoesNotOverwriteNewerGlobalHandler,
  testThrownHandlerDoesNotSuppressOthers,
]) {
  test()
  console.log(`✅ ${test.name}`)
}
