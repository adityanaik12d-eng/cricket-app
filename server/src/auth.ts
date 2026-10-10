import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { ApiError } from './store.ts'
import { PlayerRepo } from './players.ts'

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 3
const TOKEN_TTL_S = 30 * 24 * 60 * 60

export class OtpService {
  private readonly db: DatabaseSync
  private readonly now: () => Date

  constructor(db: DatabaseSync, now: () => Date = () => new Date()) {
    this.db = db
    this.now = now
  }

  request(mobile: string): string {
    if (typeof mobile !== 'string' || !/^\d{10}$/.test(mobile)) {
      throw new ApiError(400, 'INVALID_MOBILE', 'Mobile number must be exactly 10 digits')
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const expiresAt = new Date(this.now().getTime() + OTP_TTL_MS).toISOString()
    this.db
      .prepare(
        `INSERT INTO otp_codes (mobile, code, expires_at, attempts) VALUES (?, ?, ?, 0)
         ON CONFLICT(mobile) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, attempts = 0`,
      )
      .run(mobile, code, expiresAt)
    console.log(`OTP ${code} for ${mobile}`)
    return code
  }

  verify(mobile: string, code: string): void {
    const row = this.db.prepare('SELECT code, expires_at, attempts FROM otp_codes WHERE mobile = ?').get(mobile) as
      | { code: string; expires_at: string; attempts: number | bigint }
      | undefined
    if (!row) {
      throw new ApiError(404, 'OTP_NOT_FOUND', 'Request an OTP first')
    }
    if (Number(row.attempts) >= MAX_ATTEMPTS) {
      throw new ApiError(400, 'OTP_MAX_ATTEMPTS', 'Too many attempts, request a new OTP')
    }
    if (this.now().getTime() > new Date(row.expires_at).getTime()) {
      this.db.prepare('DELETE FROM otp_codes WHERE mobile = ?').run(mobile)
      throw new ApiError(400, 'OTP_EXPIRED', 'OTP expired, request a new one')
    }
    if (row.code !== code) {
      this.db
        .prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE mobile = ?')
        .run(mobile)
      const attempts = Number(row.attempts) + 1
      throw new ApiError(
        400,
        attempts >= MAX_ATTEMPTS ? 'OTP_MAX_ATTEMPTS' : 'OTP_MISMATCH',
        attempts >= MAX_ATTEMPTS ? 'Too many attempts, request a new OTP' : 'Incorrect OTP',
      )
    }
    // Valid — but do NOT consume here. The caller consumes only after the
    // request fully succeeds, so an OTP that passes verification yet hits
    // NO_ACCOUNT stays reusable for the immediate register call.
  }

  consume(mobile: string): void {
    this.db.prepare('DELETE FROM otp_codes WHERE mobile = ?').run(mobile)
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

export function signToken(playerId: string, secret: string, now: number = Date.now()): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ sub: playerId, exp: Math.floor(now / 1000) + TOKEN_TTL_S }))
  return `${header}.${payload}.${hmac(`${header}.${payload}`, secret)}`
}

export function verifyToken(token: string, secret: string, now: number = Date.now()): string {
  function throw401(): never {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required')
  }
  if (typeof token !== 'string') throw401()
  const parts = token.split('.')
  if (parts.length !== 3) throw401()
  const [header, payload, sig] = parts as [string, string, string]
  const expected = hmac(`${header}.${payload}`, secret)
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) throw401()
  let claims: { sub?: unknown; exp?: unknown }
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: unknown; exp?: unknown }
  } catch {
    throw401()
  }
  if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') throw401()
  if (now / 1000 >= claims.exp) throw401()
  return claims.sub
}

export interface AuthDeps {
  db: DatabaseSync
  otp: OtpService
  secret: string
  repo?: PlayerRepo
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const repo = deps.repo ?? new PlayerRepo(deps.db)

  const bearer = (header: unknown): string => {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required')
    }
    return verifyToken(header.slice('Bearer '.length), deps.secret)
  }

  app.post('/auth/otp', async (req) => {
    const { mobile } = (req.body ?? {}) as { mobile?: unknown }
    if (typeof mobile !== 'string') {
      throw new ApiError(400, 'INVALID_MOBILE', 'Mobile number must be exactly 10 digits')
    }
    const devOtp = deps.otp.request(mobile)
    const provider = process.env.OTP_PROVIDER || 'dev'
    return provider === 'dev' ? { ok: true, devOtp } : { ok: true }
  })

  app.post('/auth/verify', async (req) => {
    const { mobile, otp } = (req.body ?? {}) as { mobile?: unknown; otp?: unknown }
    if (typeof mobile !== 'string' || typeof otp !== 'string') {
      throw new ApiError(400, 'INVALID_MOBILE', 'mobile and otp are required')
    }
    deps.otp.verify(mobile, otp)
    const player = repo.byMobile(mobile)
    if (!player) {
      // Intentionally NOT consumed: the client switches to the register
      // step and must be able to reuse this same verified OTP.
      throw new ApiError(404, 'NO_ACCOUNT', 'No profile for this number — register first')
    }
    deps.otp.consume(mobile)
    return { token: signToken(player.id, deps.secret), player }
  })

  app.post('/auth/register', async (req, reply) => {
    const { mobile, otp, name } = (req.body ?? {}) as { mobile?: unknown; otp?: unknown; name?: unknown }
    if (typeof mobile !== 'string' || typeof otp !== 'string' || typeof name !== 'string') {
      throw new ApiError(400, 'INVALID_PROFILE', 'mobile, otp and name are required')
    }
    deps.otp.verify(mobile, otp)
    const player = repo.create({ mobile, name })
    deps.otp.consume(mobile)
    reply.status(201)
    return { token: signToken(player.id, deps.secret), player }
  })

  app.get('/me', async (req) => {
    const playerId = bearer(req.headers.authorization)
    const player = repo.get(playerId)
    if (!player) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required')
    return { player }
  })

  app.patch('/me', async (req) => {
    const playerId = bearer(req.headers.authorization)
    const patch = (req.body ?? {}) as Record<string, unknown>
    const allowed: Record<string, unknown> = {}
    for (const key of ['name', 'role', 'batting_hand', 'bowling_style', 'location']) {
      if (key in patch) allowed[key] = patch[key]
    }
    const player = repo.update(playerId, allowed)
    return { player }
  })
}
