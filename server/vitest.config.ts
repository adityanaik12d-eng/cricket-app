import { defineConfig } from 'vitest/config'

// vite-node 2.1.1 does not recognise `node:sqlite` as a builtin (it is a
// `node:`-only builtin, so it is absent from `module.builtinModules`), and
// strips the `node:` prefix before resolution. Vite then sees a bare `sqlite`
// import and fails. This shim maps that specifier to a tiny virtual module
// that loads the real builtin through `createRequire`.
const NODE_SQLITE_ID = '\0virtual:node-sqlite'

export default defineConfig({
  plugins: [
    {
      name: 'node-sqlite-shim',
      enforce: 'pre',
      resolveId(source) {
        if (source === 'sqlite' || source === 'node:sqlite' || source === NODE_SQLITE_ID) {
          return NODE_SQLITE_ID
        }
      },
      load(id) {
        if (id === NODE_SQLITE_ID) {
          return [
            "import { createRequire } from 'node:module'",
            'const require = createRequire(import.meta.url)',
            "const mod = require('node:sqlite')",
            'export const DatabaseSync = mod.DatabaseSync',
            'export const StatementSync = mod.StatementSync',
            'export default mod',
          ].join('\n')
        }
      },
    },
  ],
})
