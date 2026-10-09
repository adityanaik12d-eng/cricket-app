import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import { buildApp } from './app.ts'
import { openDb } from './db.ts'
import { OtpService, signToken, verifyToken } from './auth.ts'
import { ApiError, MatchStore } from './store.ts'
import { PlayerRepo } from './players.ts'

describe('auth', () => {
  let app: FastifyInstance
  let db: DatabaseSync
  let clock: Date

  beforeEach(async () => {
    db = openDb(':memory:')
    clock = new Date('2026-10-08T10:00:00.000Z')
    const otp = new OtpService(db, () => clock)
    app = await buildApp(new MatchStore(db), { db, otp, secret: 'test-secret' })
  })

  afterEach(async () => {
    await app.close()
  })

  async function requestOtp(mobile: string) {
    return app.inject({ method: 'POST', url: '/auth/otp', payload: { mobile } })
  }

  async function verify(mobile: string, otp: string) {
    return app.inject({ method: 'POST', url: '/auth/verify', payload: { mobile, otp } })
  }

  async function register(mobile: string, otp: string, name: string) {
    return app.inject({ method: 'POST', url: '/auth/register', payload: { mobile, otp, name } })
  }

  it('rejects a non-10-digit mobile', async () => {
    const res = await requestOtp('12345')
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: string }).code).toBe('INVALID_MOBILE')
  })

  it('returns a 6-digit devOtp', async () => {
    const res = await requestOtp('9876543210')
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; devOtp: string }
    expect(body.ok).toBe(true)
    expect(body.devOtp).toMatch(/^\d{6}$/)
  })

  it('verify fails for unknown OTP, wrong code, then locks after 3 attempts', async () => {
    expect((await verify('9876543210', '000000')).statusCode).toBe(404)
    expect((await verify('9876543210', '000000')).json()).toMatchObject({ code: 'OTP_NOT_FOUND' })

    const { devOtp } = (await requestOtp('9876543210')).json() as { devOtp: string }
    for (let i = 0; i < 3; i++) {
      const wrong = devOtp === '000000' ? '111111' : '000000'
      const res = await verify('9876543210', wrong)
      expect(res.statusCode).toBe(400)
      expect((res.json() as { code: string }).code).toBe(i < 2 ? 'OTP_MISMATCH' : 'OTP_MAX_ATTEMPTS')
    }
    // even the correct code is rejected once locked
    const after = await verify('9876543210', devOtp)
    expect(after.statusCode).toBe(400)
    expect((after.json() as { code: string }).code).toBe('OTP_MAX_ATTEMPTS')
  })

  it('rejects an expired OTP after 5 minutes', async () => {
    const { devOtp } = (await requestOtp('9876543210')).json() as { devOtp: string }
    clock = new Date(clock.getTime() + 5 * 60 * 1000 + 1)
    const res = await verify('9876543210', devOtp)
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: string }).code).toBe('OTP_EXPIRED')
  })

  it('a new OTP request overwrites the previous code', async () => {
    const { devOtp: setup } = (await requestOtp('9876543210')).json() as { devOtp: string }
    await register('9876543210', setup, 'Aditya')

    const first = ((await requestOtp('9876543210')).json() as { devOtp: string }).devOtp
    const second = ((await requestOtp('9876543210')).json() as { devOtp: string }).devOtp
    if (first !== second) {
      const stale = await verify('9876543210', first)
      expect(stale.statusCode).toBe(400)
      expect((stale.json() as { code: string }).code).toBe('OTP_MISMATCH')
    }
    const fresh = await verify('9876543210', second)
    expect(fresh.statusCode).toBe(200)
    expect((fresh.json() as { token: string }).token.split('.')).toHaveLength(3)
  })

  it('an OTP that passes verification but has no account stays usable for register', async () => {
    const { devOtp } = (await requestOtp('9876543210')).json() as { devOtp: string }
    const noAccount = await verify('9876543210', devOtp)
    expect(noAccount.statusCode).toBe(404)
    expect((noAccount.json() as { code: string }).code).toBe('NO_ACCOUNT')

    // Same OTP must still work for the register call that follows.
    const created = await register('9876543210', devOtp, 'Aditya')
    expect(created.statusCode).toBe(201)
  })

  it('verify returns a token only for registered numbers', async () => {
    expect((await verify('9876543210', '000000')).json()).toMatchObject({ code: 'OTP_NOT_FOUND' })
    const { devOtp } = (await requestOtp('9876543210')).json() as { devOtp: string }
    const unregistered = await verify('9876543210', devOtp)
    expect(unregistered.statusCode).toBe(404)
    expect((unregistered.json() as { code: string }).code).toBe('NO_ACCOUNT')

    // OTP is still valid after NO_ACCOUNT — register reuses it directly.
    const created = await register('9876543210', devOtp, 'Aditya')
    expect(created.statusCode).toBe(201)
    const { token, player } = created.json() as { token: string; player: { name: string } }
    expect(token.split('.')).toHaveLength(3)
    expect(player.name).toBe('Aditya')
  })

  it('register rejects duplicate mobile with 409', async () => {
    const { devOtp } = (await requestOtp('9876543210')).json() as { devOtp: string }
    await register('9876543210', devOtp, 'One')
    const { devOtp: otp2 } = (await requestOtp('9876543210')).json() as { devOtp: string }
    const dup = await register('9876543210', otp2, 'Two')
    expect(dup.statusCode).toBe(409)
  })

  it('GET /me requires a valid token', async () => {
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401)
    expect(
      (await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer abc' } }))
        .statusCode,
    ).toBe(401)

    const { devOtp } = (await requestOtp('9876543210')).json() as { devOtp: string }
    const { token } = (await register('9876543210', devOtp, 'Aditya')).json() as { token: string }
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } })
    expect(me.statusCode).toBe(200)
    expect((me.json() as { player: { name: string } }).player.name).toBe('Aditya')
  })

  it('PATCH /me validates and applies profile edits', async () => {
    const { devOtp } = (await requestOtp('9876543210')).json() as { devOtp: string }
    const { token } = (await register('9876543210', devOtp, 'Aditya')).json() as { token: string }
    const headers = { authorization: `Bearer ${token}` }

    const bad = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers,
      payload: { role: 'WIZARD' },
    })
    expect(bad.statusCode).toBe(400)
    expect((bad.json() as { code: string }).code).toBe('INVALID_PROFILE')

    const ok = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers,
      payload: { role: 'KEEPER', batting_hand: 'LHB', bowling_style: 'Right-arm medium', location: 'Chandigarh' },
    })
    expect(ok.statusCode).toBe(200)
    expect((ok.json() as { player: Record<string, string> }).player).toMatchObject({
      role: 'KEEPER',
      batting_hand: 'LHB',
      location: 'Chandigarh',
    })
  })

  it('rejects tampered and expired tokens with 401', () => {
    const token = signToken('p-1', 'test-secret', new Date('2026-10-08T10:00:00Z').getTime())
    expect(verifyToken(token, 'test-secret', new Date('2026-10-08T10:00:00Z').getTime())).toBe('p-1')

    const rejects = (fn: () => unknown): void => {
      try {
        fn()
        throw new Error('expected verifyToken to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).statusCode).toBe(401)
        expect((err as ApiError).code).toBe('UNAUTHENTICATED')
      }
    }

    const tampered = `${token.slice(0, -1)}x`
    rejects(() => verifyToken(tampered, 'test-secret'))
    rejects(() => verifyToken(token, 'other-secret'))

    const expired = signToken('p-1', 'test-secret', new Date('2026-10-08T10:00:00Z').getTime())
    rejects(() => verifyToken(expired, 'test-secret', new Date('2026-11-08T10:00:01Z').getTime()))
  })
})
