import { createGoogleMapsLoader } from './googleMapsLoader.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

async function assertRejects(promise: Promise<unknown>, label: string): Promise<void> {
  try {
    await promise
  } catch {
    return
  }
  throw new Error(label)
}

async function testSameKeySharesOneLoad(): Promise<void> {
  const options: unknown[] = []
  let imports = 0
  const library = { Map: class {} }
  const loader = createGoogleMapsLoader({
    setOptions: (value) => { options.push(value) },
    importLibrary: async () => { imports += 1; return library },
  })
  const first = loader('test-key')
  const second = loader('test-key')
  assert(first === second, 'same-key concurrent calls share one Promise')
  assert(await first as unknown === library, 'loader resolves the maps library')
  assert(options.length === 1 && imports === 1, 'same key configures and imports once')
  assert(JSON.stringify(options[0]) === JSON.stringify({ key: 'test-key', v: 'weekly', language: 'vi', region: 'VN' }), 'loader uses stable minimal options')
}

async function testEmptyKeyRejectsWithoutDependencies(): Promise<void> {
  let calls = 0
  const loader = createGoogleMapsLoader({
    setOptions: () => { calls += 1 },
    importLibrary: async () => { calls += 1; return {} },
  })
  await assertRejects(loader('  '), 'empty key must reject')
  assert(calls === 0, 'empty key never calls loader dependencies')
}

async function testConflictingKeyRejects(): Promise<void> {
  let imports = 0
  const loader = createGoogleMapsLoader({
    setOptions: () => undefined,
    importLibrary: async () => { imports += 1; return {} },
  })
  await loader('first-key')
  await assertRejects(loader('second-key'), 'conflicting key must reject')
  assert(imports === 1, 'conflicting key does not reconfigure or reimport')
}

for (const test of [testSameKeySharesOneLoad, testEmptyKeyRejectsWithoutDependencies, testConflictingKeyRejects]) {
  await test()
  console.log(`✅ ${test.name}`)
}
