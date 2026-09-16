// Minimal Node ESM resolve hook: when a relative TS import has no extension
// and doesn't resolve as-is, retry with `.ts` appended. This lets existing
// source files (which import sibling modules without an extension, e.g.
// `from '../data/jobRegions'`) run directly under Node's native TypeScript
// support (`node --experimental-strip-types`) for standalone `*.test.ts`
// files, without editing any of those files' import paths.
//
// Usage: node --experimental-strip-types --import ./scripts/ts-extensionless-loader.mjs src/lib/some.test.ts
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (
      specifier.startsWith('.') &&
      !/\.[a-zA-Z0-9]+$/.test(specifier) &&
      context.parentURL
    ) {
      const candidate = new URL(specifier + '.ts', context.parentURL)
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + '.ts', context)
      }
    }
    throw err
  }
}
