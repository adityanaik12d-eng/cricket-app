/**
 * Scorer ownership for a match.
 *
 * A match link is public: everyone who has it can watch the match. Only the
 * device that created the match may score it. The authority is a per-match
 * secret token that lives in this browser's localStorage; the database only
 * ever stores its SHA-256 hash, so a watcher who reads the match row still
 * cannot forge a score.
 *
 * Everything here is defensive: a blocked, poisoned or missing store must
 * never break the app. Losing the token only costs the scorer their pad.
 */

const TOKEN_KEY = 'cricket.scorerTokens'
const LEGACY_KEY = 'cricket.myMatches'

/** The slice of the Storage API this module needs. */
export interface TokenStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStore(): TokenStore | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function defaultRandom(): number {
  try {
    const c = globalThis.crypto
    if (c && typeof c.getRandomValues === 'function') {
      const buf = new Uint8Array(1)
      c.getRandomValues(buf)
      return (buf[0] ?? 0) / 256
    }
  } catch {
    // fall through to Math.random
  }
  return Math.random()
}

/** 32 hex characters of entropy, one nibble per call to `random`. */
export function createScorerToken(random: () => number = defaultRandom): string {
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += (Math.floor(random() * 16) & 15).toString(16)
  }
  return token
}

/** Every token this browser holds, newest data wins. Never throws. */
export function readScorerTokens(store?: TokenStore): Record<string, string> {
  try {
    const s = store ?? defaultStore()
    if (!s) return {}
    const raw = s.getItem(TOKEN_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const tokens: Record<string, string> = {}
    for (const [matchId, token] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof token === 'string' && token.length > 0) tokens[matchId] = token
    }
    return tokens
  } catch {
    return {}
  }
}

/** The token for a match, or null when this browser has never claimed it. */
export function readScorerToken(matchId: string, store?: TokenStore): string | null {
  if (!matchId) return null
  return readScorerTokens(store)[matchId] ?? null
}

/** Claims (or re-claims) a match for this browser. Never throws. */
export function storeScorerToken(matchId: string, token: string, store?: TokenStore): void {
  try {
    if (!matchId || !token) return
    const s = store ?? defaultStore()
    if (!s) return
    const tokens = readScorerTokens(s)
    tokens[matchId] = token
    s.setItem(TOKEN_KEY, JSON.stringify(tokens))
  } catch {
    // No storage (private mode, quota): the match still works, the claim is lost.
  }
}

/**
 * Matches created before tokens existed. They are remembered by id only, so
 * they keep working as "mine" but can be claimed by anyone who knows the id —
 * the owner browser upgrades them to a real token on the next open.
 */
export function legacyMatchIds(store?: TokenStore): string[] {
  try {
    const s = store ?? defaultStore()
    if (!s) return []
    const raw = s.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

/** True when this browser may score the match. */
export function isScorerMatch(matchId: string, store?: TokenStore): boolean {
  if (!matchId) return false
  if (readScorerToken(matchId, store)) return true
  return legacyMatchIds(store).includes(matchId)
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0
}

/**
 * SHA-256 of a string as lowercase hex — the same encoding Postgres'
 * `encode(digest(text, 'sha256'), 'hex')` produces.
 *
 * Implemented here rather than with `crypto.subtle` because the subtle
 * crypto API only exists in secure contexts, and this hash has to work when
 * the app is opened over plain http on a local network.
 */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const bitLength = bytes.length * 8
  const blockCount = Math.ceil((bytes.length + 9) / 64)
  const padded = new Uint8Array(blockCount * 64)
  padded.set(bytes)
  padded[bytes.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(padded.length - 4, bitLength >>> 0)

  const h = new Uint32Array(INITIAL)
  const w = new Uint32Array(64)

  for (let block = 0; block < blockCount; block++) {
    const offset = block * 64
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }

    let a = h[0]!
    let b = h[1]!
    let c = h[2]!
    let d = h[3]!
    let e = h[4]!
    let f = h[5]!
    let g = h[6]!
    let hh = h[7]!

    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + s1 + ch + K[i]! + w[i]!) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h[0] = (h[0]! + a) >>> 0
    h[1] = (h[1]! + b) >>> 0
    h[2] = (h[2]! + c) >>> 0
    h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0
    h[5] = (h[5]! + f) >>> 0
    h[6] = (h[6]! + g) >>> 0
    h[7] = (h[7]! + hh) >>> 0
  }

  let hex = ''
  for (const word of h) hex += word.toString(16).padStart(8, '0')
  return hex
}

/** The value stored in the database for a token. An empty token never stores. */
export async function hashScorerToken(token: string): Promise<string> {
  if (!token) return ''
  return sha256Hex(token)
}
