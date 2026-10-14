import { buildApp } from './app.ts'
import { MatchStore } from './store.ts'
import { openDb } from './db.ts'

const port = Number(process.env.PORT ?? 3000)
const db = openDb(process.env.DB_PATH ?? './cricket.db')
const store = new MatchStore(db)
const webRoot = process.env.WEB_ROOT
const app = await buildApp(store, webRoot ? { db, webRoot } : { db })
await app.listen({ port, host: '0.0.0.0' })
console.log(`cricket server listening on http://localhost:${port}`)
