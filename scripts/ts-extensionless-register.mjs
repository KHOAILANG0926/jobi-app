// Registers ts-extensionless-loader.mjs's resolve hook. Passed via --import.
import { register } from 'node:module'
register('./ts-extensionless-loader.mjs', import.meta.url)
