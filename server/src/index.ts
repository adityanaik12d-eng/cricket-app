import { buildApp } from './app.ts'

const port = Number(process.env.PORT ?? 3000)
const app = await buildApp()
await app.listen({ port, host: '0.0.0.0' })
console.log(`cricket server listening on http://localhost:${port}`)
