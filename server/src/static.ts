import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import type { FastifyInstance } from 'fastify'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

interface StaticFile {
  data: Buffer
  type: string
}

async function readStaticFile(filePath: string): Promise<StaticFile | null> {
  try {
    const info = await stat(filePath)
    if (!info.isFile()) return null
    const data = await readFile(filePath)
    return { data, type: CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream' }
  } catch {
    return null
  }
}

/**
 * Serves the built web app (index.html + assets) from a static root and falls
 * back to index.html for unknown extensionless paths. Only registered when a
 * web root is configured, so API-only deployments keep their plain 404s.
 */
export function registerStatic(app: FastifyInstance, webRoot: string): void {
  const root = resolve(webRoot)

  const handler = async (url: string, reply: import('fastify').FastifyReply): Promise<unknown> => {
    const pathname = decodeURIComponent(url.split('?')[0] ?? '/')
    const relative = normalize(pathname).replace(/^[/\\]+/, '')
    const filePath = resolve(join(root, relative))

    if (filePath !== root && !filePath.startsWith(root + sep)) {
      return reply.code(404).send({ error: 'Not found' })
    }

    const file = await readStaticFile(filePath)
    if (file) return reply.type(file.type).send(file.data)

    const ext = extname(pathname)
    if (ext && ext !== '.html') return reply.code(404).send({ error: 'Not found' })

    const index = await readStaticFile(resolve(join(root, 'index.html')))
    if (!index) return reply.code(404).send({ error: 'Not found' })
    return reply.type(index.type).send(index.data)
  }

  app.get('/', (req, reply) => handler(req.url, reply))
  app.get('/*', (req, reply) => handler(req.url, reply))
}
