# Accounts, Player Profiles & Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give players a mobile-number account with an OTP sign-in, an editable cricket profile, and free career stats, and let scorers add lineup players by name or by mobile-number lookup.

**Architecture:** SQLite (`node:sqlite`, file `cricket.db`) behind a `PlayerRepo` and a now-persistent `MatchStore`; JWT auth routes + directory/stats routes on the existing Fastify app; web gains sign-in/profile screens, a two-mode lineup adder, and name/fielder resolution from `config.playerRefs`. The scoring engine is untouched except two optional type additions (`playerRefs`, `fielderId`).

**Tech Stack:** Node 24 (`node:sqlite`, `node --experimental-strip-types`, `node:crypto` for HMAC JWT — no new dependencies), Fastify 5, React 19 + Vite, Vitest.

**Spec:** `docs/specs/2026-10-08-accounts-player-directory-design.md` (approved)

## Global Constraints

- OTP: dev mode now, SMS later — 6-digit code, 5-minute expiry, 3 attempts max; code returned as `devOtp` in the `POST /auth/otp` response (default `OTP_PROVIDER=dev`) and logged as `OTP <code> for <mobile>`.
- Storage: SQLite via Node built-in `node:sqlite`; `DB_PATH` env, default `./cricket.db`; tests always use `':memory:'`.
- JWT HS256, 30-day expiry, `JWT_SECRET` env, dev default `dev-secret-change-me`.
- Everything CricHeroes gates behind PRO in stats is FREE here — no paid tiers, no upsell UI.
- Scoring must work without signing in; by-name lineup entries never require an account.
- Server runs `node --experimental-strip-types src/index.ts` — relative server imports MUST use the `.ts` extension (`./app.ts`).
- Rebuild core dist after core changes: `cd packages/core; node ..\..\node_modules\typescript\bin\tsc -p tsconfig.json`.
- PowerShell: NO `&&`, NO `tail`/`grep`/`wc` — use `;`, `if ($?)`, `Select-Object`.
- TDD everywhere: failing test first, watch it fail, minimal implementation, watch it pass, commit.
- Dark theme unchanged (`--bg #0b0f13`, `--accent #22c55e`); touch targets ≥48px.
- Do not touch anything VCL-related when browsing CricHeroes; never create/save data on the user's account.

## Review Focus

Inputs/conditions the spec implies but no single task fully pins — each has a test in the owning task:

1. **Tampered or expired JWT** → must yield 401 `UNAUTHENTICATED`, never a 500 (Task 4 test: tampered signature + token past `exp`).
2. **OTP abuse/overwrite** → 3 wrong attempts invalidates the code; a new OTP request overwrites the previous code (Task 4 tests).
3. **Server restart mid-innings** → replayed state from `match_events` must equal the pre-restart state including `lastSeq`/`eventCount`, and the next appended event must get `lastSeq + 1` (Task 3 test).
4. **Old matches (no `playerRefs`) and old wicket events (no `fielderId`)** → scorecard renders ids exactly as today; stats fold counts no fielding dismissals and never throws (Tasks 1, 5 tests).
5. **Directory search input** (`q` = empty, 1 digit, SQL wildcard `%`) → parameterized query, no crash, ≤10 rows (Task 5 test).

---

### Task 1: Core — `playerRefs` and `fielderId` type additions

**Files:**
- Modify: `packages/core/src/types.ts` (BallEvent ~line 48, MatchConfig ~line 120)
- Modify: `packages/core/src/config.test.ts`
- Modify: `packages/core/src/apply.test.ts`
- Rebuild: `packages/core/dist` (tsc -p)

**Interfaces:**
- Consumes: existing `withDefaults` (`{ ...DEFAULT_MATCH_CONFIG, ...input }` — already spreads unknown keys through, so preservation is free once typed).
- Produces: `PlayerRef { name: string; mobile?: string; verified?: boolean }`; `MatchConfig.playerRefs?: Record<string, PlayerRef>`; `BallEvent.fielderId?: string`. Exported from `@cricket-app/core` index (already re-exports `./types.js`).

- [ ] **Step 1: Write the failing tests**

In `config.test.ts` append:

```ts
it('withDefaults preserves playerRefs', () => {
  const playerRefs = { 'p-1': { name: 'Virat', mobile: '9876543210', verified: true } }
  const cfg = withDefaults({
    matchId: 'm1',
    teamAId: 'A',
    teamBId: 'B',
    lineups: {
      A: Array.from({ length: 11 }, (_, i) => `a${i + 1}`),
      B: Array.from({ length: 11 }, (_, i) => `b${i + 1}`),
    },
    playerRefs,
  } satisfies MatchConfigInput)
  expect(cfg.playerRefs).toEqual(playerRefs)
})
```

In `apply.test.ts` append (uses the module-level `started()`, `ballAt` helpers):

```ts
it('fielderId on a ball event does not change scoring', () => {
  const before = started()
  const plain = ballAt(before, {})
  const plainState = applyEvent(before.config, before, plain)

  const other = started()
  const withFielder = ballAt(other, { fielderId: 'b2' })
  const fielderState = applyEvent(other.config, other, withFielder)

  expect(withFielder.fielderId).toBe('b2')
  expect(fielderState).toEqual(plainState)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\IT\cricket-app\packages\core; node ..\..\node_modules\vitest\vitest.mjs run --reporter=basic`
Expected: FAIL — `playerRefs` unknown property / `fielderId` not on `BallEvent` (type errors in test compile via esbuild still fail the assertion or the suite errors).

- [ ] **Step 3: Write minimal implementation**

In `types.ts` add:

```ts
export interface PlayerRef {
  name: string
  mobile?: string
  verified?: boolean
}
```

On `BallEvent` add: `fielderId?: string`.
On `MatchConfig` add: `playerRefs?: Record<string, PlayerRef>`.

No runtime changes — `withDefaults` already spreads input, engine already ignores unknown event fields.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command as Step 2. Expected: all core tests pass (51 + 2 new).

- [ ] **Step 5: Rebuild core dist and typecheck**

```powershell
cd C:\Users\IT\cricket-app\packages\core
node ..\..\node_modules\typescript\bin\tsc -p tsconfig.json
node ..\..\node_modules\typescript\bin\tsc --noEmit
```
Expected: no output (clean).

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\IT\cricket-app add packages/core
git -C C:\Users\IT\cricket-app commit -m "Add playerRefs and fielderId types to core"
```

---

### Task 2: Server — SQLite db module + PlayerRepo

**Files:**
- Create: `server/src/db.ts`
- Create: `server/src/players.ts`
- Create: `server/src/players.test.ts`
- Conditional: `server/src/sqlite.d.ts` (only if tsc cannot resolve `node:sqlite`)

**Interfaces:**
- Consumes: `ApiError` from `store.ts`.
- Produces: `openDb(path: string): DatabaseSync` (creates all 4 tables idempotently); `PlayerRepo` with `create(input): Player`, `byMobile(mobile): Player | undefined`, `get(id): Player | undefined`, `search(q): Player[]`, `update(id, patch): Player`; `Player { id, mobile, name, role, batting_hand, bowling_style, location, created_at }`.

- [ ] **Step 1: Write the failing test**

Create `server/src/players.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.ts'
import { PlayerRepo } from './players.ts'
import { ApiError } from './store.ts'

describe('PlayerRepo', () => {
  let db: DatabaseSync
  let repo: PlayerRepo

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new PlayerRepo(db)
  })

  it('creates a player and finds them by mobile', () => {
    const p = repo.create({ mobile: '9876543210', name: 'Virat K' })
    expect(p.id).toMatch(/^p-/)
    expect(repo.byMobile('9876543210')?.name).toBe('Virat K')
    expect(p.role).toBe('BATSMAN')
    expect(p.batting_hand).toBe('RHB')
  })

  it('rejects a duplicate mobile with 409 MOBILE_TAKEN', () => {
    repo.create({ mobile: '9876543210', name: 'A' })
    try {
      repo.create({ mobile: '9876543210', name: 'B' })
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).statusCode).toBe(409)
      expect((err as ApiError).code).toBe('MOBILE_TAKEN')
    }
  })

  it('rejects invalid input with 400 INVALID_PROFILE', () => {
    expect(() => repo.create({ mobile: '12345', name: 'X' })).toThrow(ApiError)
    expect(() => repo.create({ mobile: '9876543210', name: '' })).toThrow(ApiError)
    expect(() => repo.create({ mobile: '9876543211', name: 'Y', role: 'WIZARD' as never })).toThrow(ApiError)
  })

  it('searches by mobile prefix and by name prefix (case-insensitive)', () => {
    repo.create({ mobile: '9876543210', name: 'Virat K' })
    repo.create({ mobile: '9876500001', name: 'rohit s' })
    repo.create({ mobile: '9111111111', name: 'MSD' })

    expect(repo.search('987654').map((p) => p.name)).toEqual(['Virat K'])
    expect(repo.search('vir').map((p) => p.name)).toEqual(['Virat K'])
    expect(repo.search('ROH').map((p) => p.name)).toEqual(['rohit s'])
  })

  it('caps search results at 10 and treats wildcard chars literally', () => {
    for (let i = 0; i < 15; i++) {
      repo.create({ mobile: `98${String(i).padStart(8, '0')}`, name: `Player${i}` })
    }
    expect(repo.search('98')).toHaveLength(10)
    expect(repo.search('%')).toHaveLength(0)
    expect(repo.search('')).toHaveLength(0)
  })

  it('updates profile fields and validates enums', () => {
    const p = repo.create({ mobile: '9876543210', name: 'Ravi' })
    const upd = repo.update(p.id, {
      role: 'KEEPER',
      batting_hand: 'LHB',
      bowling_style: 'Left-arm fast',
      location: 'Pune',
    })
    expect(upd.role).toBe('KEEPER')
    expect(upd.batting_hand).toBe('LHB')
    expect(upd.bowling_style).toBe('Left-arm fast')

    expect(() => repo.update(p.id, { role: 'NOPE' as never })).toThrow(ApiError)
    expect(() => repo.update('p-missing', { name: 'X' })).toThrow(ApiError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\IT\cricket-app\server; node ..\node_modules\vitest\vitest.mjs run --reporter=basic`
Expected: FAIL — cannot resolve `./db.ts` / `./players.ts`.

- [ ] **Step 3: Write the implementation**

Create `server/src/db.ts`:

```ts
import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  mobile        TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('BATSMAN','BOWLER','KEEPER','ALL_ROUNDER')),
  batting_hand  TEXT NOT NULL DEFAULT 'RHB' CHECK (batting_hand IN ('RHB','LHB')),
  bowling_style TEXT,
  location      TEXT,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS match_events (
  match_id     TEXT NOT NULL REFERENCES matches(id),
  seq          INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  ts           TEXT NOT NULL,
  PRIMARY KEY (match_id, seq)
);
CREATE TABLE IF NOT EXISTS otp_codes (
  mobile     TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);
`

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  return db
}
```

Create `server/src/players.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { ApiError } from './store.ts'

export type PlayerRole = 'BATSMAN' | 'BOWLER' | 'KEEPER' | 'ALL_ROUNDER'
export type BattingHand = 'RHB' | 'LHB'

export interface Player {
  id: string
  mobile: string
  name: string
  role: PlayerRole
  batting_hand: BattingHand
  bowling_style: string | null
  location: string | null
  created_at: string
}

export interface CreatePlayerInput {
  mobile: string
  name: string
  role?: PlayerRole
  batting_hand?: BattingHand
  bowling_style?: string | null
  location?: string | null
}

export interface ProfilePatch {
  name?: string
  role?: PlayerRole
  batting_hand?: BattingHand
  bowling_style?: string | null
  location?: string | null
}

const ROLES: ReadonlySet<string> = new Set(['BATSMAN', 'BOWLER', 'KEEPER', 'ALL_ROUNDER'])
const HANDS: ReadonlySet<string> = new Set(['RHB', 'LHB'])

function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: String(row.id),
    mobile: String(row.mobile),
    name: String(row.name),
    role: String(row.role) as PlayerRole,
    batting_hand: String(row.batting_hand) as BattingHand,
    bowling_style: row.bowling_style === null ? null : String(row.bowling_style),
    location: row.location === null ? null : String(row.location),
    created_at: String(row.created_at),
  }
}

function validateProfile(p: { name?: unknown; role?: unknown; batting_hand?: unknown }): void {
  if (p.name !== undefined && (typeof p.name !== 'string' || p.name.trim().length === 0)) {
    throw new ApiError(400, 'INVALID_PROFILE', 'name must be a non-empty string')
  }
  if (p.role !== undefined && (typeof p.role !== 'string' || !ROLES.has(p.role))) {
    throw new ApiError(400, 'INVALID_PROFILE', 'role must be BATSMAN, BOWLER, KEEPER or ALL_ROUNDER')
  }
  if (p.batting_hand !== undefined && (typeof p.batting_hand !== 'string' || !HANDS.has(p.batting_hand))) {
    throw new ApiError(400, 'INVALID_PROFILE', 'batting_hand must be RHB or LHB')
  }
}

export class PlayerRepo {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreatePlayerInput): Player {
    if (typeof input.mobile !== 'string' || !/^\d{10}$/.test(input.mobile)) {
      throw new ApiError(400, 'INVALID_PROFILE', 'mobile must be 10 digits')
    }
    validateProfile(input)
    const role = input.role ?? 'BATSMAN'
    if (!ROLES.has(role)) {
      throw new ApiError(400, 'INVALID_PROFILE', 'role must be BATSMAN, BOWLER, KEEPER or ALL_ROUNDER')
    }
    const hand = input.batting_hand ?? 'RHB'
    if (!HANDS.has(hand)) {
      throw new ApiError(400, 'INVALID_PROFILE', 'batting_hand must be RHB or LHB')
    }
    const player: Player = {
      id: `p-${randomUUID()}`,
      mobile: input.mobile,
      name: input.name.trim(),
      role: role as PlayerRole,
      batting_hand: hand as BattingHand,
      bowling_style: input.bowling_style ?? null,
      location: input.location ?? null,
      created_at: new Date().toISOString(),
    }
    try {
      this.db
        .prepare(
          `INSERT INTO players (id, mobile, name, role, batting_hand, bowling_style, location, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          player.id,
          player.mobile,
          player.name,
          player.role,
          player.batting_hand,
          player.bowling_style,
          player.location,
          player.created_at,
        )
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('UNIQUE') || message.includes('players.mobile')) {
        throw new ApiError(409, 'MOBILE_TAKEN', 'A player with this mobile number already exists')
      }
      throw err
    }
    return player
  }

  byMobile(mobile: string): Player | undefined {
    const row = this.db.prepare('SELECT * FROM players WHERE mobile = ?').get(mobile)
    return row ? rowToPlayer(row) : undefined
  }

  get(id: string): Player | undefined {
    const row = this.db.prepare('SELECT * FROM players WHERE id = ?').get(id)
    return row ? rowToPlayer(row) : undefined
  }

  search(q: string): Player[] {
    const term = q.trim()
    if (term.length === 0) return []
    if (/^\d+$/.test(term)) {
      const rows = this.db
        .prepare('SELECT * FROM players WHERE mobile LIKE ? LIMIT 10')
        .all(`${term}%`)
      return rows.map(rowToPlayer)
    }
    const rows = this.db
      .prepare('SELECT * FROM players WHERE name LIKE ? ESCAPE \'\\\' COLLATE NOCASE LIMIT 10')
      .all(`${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
    return rows.map(rowToPlayer)
  }

  update(id: string, patch: ProfilePatch): Player {
    validateProfile(patch)
    const existing = this.get(id)
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', `Player ${id} not found`)
    }
    if (patch.role !== undefined && !ROLES.has(patch.role)) {
      throw new ApiError(400, 'INVALID_PROFILE', 'role must be BATSMAN, BOWLER, KEEPER or ALL_ROUNDER')
    }
    if (patch.batting_hand !== undefined && !HANDS.has(patch.batting_hand)) {
      throw new ApiError(400, 'INVALID_PROFILE', 'batting_hand must be RHB or LHB')
    }
    const next: Player = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      role: patch.role !== undefined ? patch.role : existing.role,
      batting_hand: patch.batting_hand !== undefined ? patch.batting_hand : existing.batting_hand,
      bowling_style: patch.bowling_style !== undefined ? patch.bowling_style : existing.bowling_style,
      location: patch.location !== undefined ? patch.location : existing.location,
    }
    this.db
      .prepare(
        `UPDATE players SET name = ?, role = ?, batting_hand = ?, bowling_style = ?, location = ? WHERE id = ?`,
      )
      .run(next.name, next.role, next.batting_hand, next.bowling_style, next.location, next.id)
    return next
  }
}
```

If `tsc` reports `TS2307: Cannot find module 'node:sqlite'`, create `server/src/sqlite.d.ts` exactly as:

```ts
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
  export interface StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
    get(...params: unknown[]): Record<string, unknown> | undefined
    all(...params: unknown[]): Record<string, unknown>[]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: PASS (6 tests). Existing suite (11 app tests) still passes.

- [ ] **Step 5: Typecheck**

Run: `node ..\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\IT\cricket-app add server/src
git -C C:\Users\IT\cricket-app commit -m "Add SQLite db module and PlayerRepo"
```

---

### Task 3: Server — persistent MatchStore

**Files:**
- Modify: `server/src/store.ts` (constructor, `create`, `append`, new `all()`)
- Modify: `server/src/app.test.ts` (constructor call)
- Modify: `server/src/index.ts` (open real db)
- Create: `server/src/store.test.ts`

**Interfaces:**
- Consumes: `openDb` from Task 2.
- Produces: `new MatchStore(db: DatabaseSync)` (loads all persisted matches on construction), `store.all(): MatchRecord[]` (used by Task 5 stats). Existing `create/get/mustGet/append/emit('update')` signatures unchanged.

- [ ] **Step 1: Write the failing test**

Create `server/src/store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { openDb } from './db.ts'
import { MatchStore } from './store.ts'

const config = {
  teamAId: 'teamA',
  teamBId: 'teamB',
  lineups: {
    A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
    B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
  },
  oversPerInnings: 2,
  powerplayOvers: 2,
}

const toss = { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' }

describe('MatchStore persistence', () => {
  it('replays persisted matches on a store restart', () => {
    const db = openDb(':memory:')
    const s1 = new MatchStore(db)
    const record = s1.create(config)
    s1.append(record.matchId, toss)

    const s2 = new MatchStore(db)
    const again = s2.mustGet(record.matchId)
    expect(again.state.status).toBe('IN_PROGRESS')
    expect(again.state.eventCount).toBe(1)
    expect(again.state.lastSeq).toBe(1)
    expect(again.events).toHaveLength(1)
  })

  it('keeps seq monotonic across restarts', () => {
    const db = openDb(':memory:')
    const s1 = new MatchStore(db)
    const record = s1.create(config)
    s1.append(record.matchId, toss)

    const s2 = new MatchStore(db)
    const next = s2.append(record.matchId, {
      type: 'BALL',
      over: 0,
      ball: 0,
      runs: 1,
      extras: 'NONE',
      wicket: false,
      dismissal: null,
      dismissedPlayerId: null,
      batterId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
      fieldingCaptainId: 'b1',
    })
    expect(next.event.seq).toBe(2)
    expect(s2.get(record.matchId)?.state.lastSeq).toBe(2)
  })

  it('all() returns every record with events and state', () => {
    const db = openDb(':memory:')
    const store = new MatchStore(db)
    const r1 = store.create(config)
    store.append(r1.matchId, toss)
    store.create({ ...config, teamAId: 'x1', teamBId: 'x2' })
    const all = store.all()
    expect(all).toHaveLength(2)
    expect(all.find((r) => r.matchId === r1.matchId)?.events).toHaveLength(1)
  })

  it('unknown match is still 404 after restart', () => {
    const db = openDb(':memory:')
    new MatchStore(db)
    const s2 = new MatchStore(db)
    expect(() => s2.mustGet('nope')).toThrow('not found')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\IT\cricket-app\server; node ..\node_modules\vitest\vitest.mjs run --reporter=basic`
Expected: FAIL — `MatchStore constructor expects 0 arguments` / `store.all is not a function`.

- [ ] **Step 3: Write the implementation**

In `store.ts`:

- Add imports: `import type { DatabaseSync } from 'node:sqlite'`.
- Change the class head and add loading:

```ts
export class MatchStore extends EventEmitter {
  private readonly matches = new Map<string, MatchRecord>()

  constructor(private readonly db: DatabaseSync) {
    super()
    this.load()
  }

  private load(): void {
    const rows = this.db.prepare('SELECT id, config_json FROM matches').all() as {
      id: string
      config_json: string
    }[]
    for (const row of rows) {
      const config = JSON.parse(row.config_json) as MatchConfig
      const eventRows = this.db
        .prepare('SELECT payload_json FROM match_events WHERE match_id = ? ORDER BY seq')
        .all(row.id) as { payload_json: string }[]
      const events = eventRows.map((r) => JSON.parse(r.payload_json) as MatchEvent)
      this.matches.set(row.id, {
        matchId: row.id,
        config,
        events,
        state: applyEvents(config, events),
      })
    }
  }

  all(): MatchRecord[] {
    return [...this.matches.values()]
  }
```

In `create`, after `this.matches.set(...)`:

```ts
    this.db
      .prepare('INSERT INTO matches (id, config_json, created_at) VALUES (?, ?, ?)')
      .run(record.matchId, JSON.stringify(config), new Date().toISOString())
```

In `append`, after `record.state = state` and before `emit`:

```ts
    this.db
      .prepare('INSERT INTO match_events (match_id, seq, payload_json, ts) VALUES (?, ?, ?, ?)')
      .run(matchId, event.seq, JSON.stringify(event), event.ts)
```

In `app.test.ts` beforeEach:

```ts
import { openDb } from './db.ts'
// ...
store = new MatchStore(openDb(':memory:'))
```

In `index.ts`, after imports:

```ts
import { openDb } from './db.ts'
// ...
const db = openDb(process.env.DB_PATH ?? './cricket.db')
const store = new MatchStore(db)
```
(wire the existing `buildApp(store)` call to use it — check current index.ts and keep PORT/host behavior identical.)

- [ ] **Step 4: Run tests to verify they pass**

Run: same as Step 2. Expected: PASS — new store tests (4) + existing 11 app tests + 6 player tests all green.

- [ ] **Step 5: Typecheck + smoke**

```powershell
node ..\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit
node --experimental-strip-types src/index.ts
```
Expected: typecheck clean; server starts (kill it after it binds, or run `Get-NetTCPConnection -LocalPort 3000` then `Stop-Process`). Note: a `cricket.db` file will appear in `server/` — do NOT commit it (add `cricket.db` + `*.db` to root `.gitignore` in this step).

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\IT\cricket-app add server/src C:\Users\IT\cricket-app\.gitignore
git -C C:\Users\IT\cricket-app commit -m "Persist match store to SQLite"
```

---

### Task 4: Server — OTP auth, JWT, profile routes

**Files:**
- Create: `server/src/auth.ts`
- Create: `server/src/auth.test.ts`
- Modify: `server/src/app.ts` (accept deps, register routes)

**Interfaces:**
- Consumes: `openDb`, `PlayerRepo` (Task 2), `ApiError`.
- Produces: `OtpService { request(mobile): string; verify(mobile, code): void }` (constructor `(db, now = () => new Date())`); `signToken(playerId, secret, now?): string`; `verifyToken(token, secret, now?): string` (throws `ApiError 401 UNAUTHENTICATED`); `registerAuthRoutes(app, deps)`; `buildApp(store, deps?: { db?, otp?, secret? })` — defaults keep existing tests working.

Routes produced:
- `POST /auth/otp` `{mobile}` → 200 `{ok:true, devOtp}` (dev provider) — 400 `INVALID_MOBILE`
- `POST /auth/verify` `{mobile, otp}` → 200 `{token, player}` — 404 `OTP_NOT_FOUND` / `NO_ACCOUNT`, 400 `OTP_EXPIRED` / `OTP_MAX_ATTEMPTS` / `OTP_MISMATCH`
- `POST /auth/register` `{mobile, otp, name}` → 201 `{token, player}` — same OTP errors, 409 `MOBILE_TAKEN`
- `GET /me` → 200 `{player}` — 401 `UNAUTHENTICATED`
- `PATCH /me` `{...}` → 200 `{player}` — 401, 400 `INVALID_PROFILE`, 404 `NOT_FOUND`

- [ ] **Step 1: Write the failing tests**

Create `server/src/auth.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import { buildApp } from './app.ts'
import { openDb } from './db.ts'
import { OtpService, signToken, verifyToken } from './auth.ts'
import { MatchStore } from './store.ts'
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

    const tampered = `${token.slice(0, -1)}x`
    expect(() => verifyToken(tampered, 'test-secret')).toThrow('UNAUTHENTICATED')
    expect(() => verifyToken(token, 'other-secret')).toThrow('UNAUTHENTICATED')

    const expired = signToken('p-1', 'test-secret', new Date('2026-10-08T10:00:00Z').getTime())
    expect(() => verifyToken(expired, 'test-secret', new Date('2026-11-08T10:00:01Z').getTime())).toThrow(
      'UNAUTHENTICATED',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\IT\cricket-app\server; node ..\node_modules\vitest\vitest.mjs run --reporter=basic`
Expected: FAIL — cannot resolve `./auth.ts`; `buildApp` accepts only one argument.

- [ ] **Step 3: Write the implementation**

Create `server/src/auth.ts`:

```ts
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { ApiError } from './store.ts'
import { PlayerRepo } from './players.ts'
import type { Player } from './players.ts'

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 3
const TOKEN_TTL_S = 30 * 24 * 60 * 60

export class OtpService {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => Date = () => new Date(),
  ) {}

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
  const throw401 = (): never => {
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
  if (now / 1000 > claims.exp) throw401()
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
    const provider = process.env.OTP_PROVIDER ?? 'dev'
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
```

In `app.ts`:

```ts
import { openDb } from './db.ts'
import { OtpService, registerAuthRoutes } from './auth.ts'

export interface AppDeps {
  db?: ReturnType<typeof openDb>
  otp?: OtpService
  secret?: string
}

export async function buildApp(
  store: MatchStore = new MatchStore(openDb(':memory:')),
  deps: AppDeps = {},
): Promise<FastifyInstance> {
  const db = deps.db ?? openDb(':memory:')
  const otp = deps.otp ?? new OtpService(db)
  const secret = deps.secret ?? process.env.JWT_SECRET ?? 'dev-secret-change-me'
  registerAuthRoutes(app, { db, otp, secret })
  // ...existing routes unchanged
```

(Careful: when `deps.db` is absent the default store and auth routes could get different dbs — when `buildApp` is called with only a store, use a single fresh `:memory:` db for auth; that is fine because existing match tests never touch auth. When both are passed — as in `auth.test.ts` — they share `db`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: same as Step 2. Expected: PASS — 11 auth tests + all previous tests.

- [ ] **Step 5: Typecheck**

Run: `node ..\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\IT\cricket-app add server/src
git -C C:\Users\IT\cricket-app commit -m "Add OTP auth, JWT tokens and profile endpoints"
```

---

### Task 5: Server — directory routes + career stats

**Files:**
- Create: `server/src/stats.ts`
- Create: `server/src/stats.test.ts`
- Modify: `server/src/app.ts` (three routes)

**Interfaces:**
- Consumes: `store.all()`, `PlayerRepo` (Task 2), `projectScorecard`, `formatOvers`, `round2` from `@cricket-app/core`.
- Produces: `computeCareerStats(records: MatchRecord[], playerId: string): CareerStats` (pure); routes `GET /players?q=`, `POST /players`, `GET /players/:id/stats`.

`CareerStats` shape (matches the spec's example JSON):

```ts
export interface CareerStats {
  matches: number
  runs: number
  balls: number
  fours: number
  sixes: number
  highest: number
  notOuts: number
  wickets: number
  oversBowled: string
  runsConceded: number
  bestBowling: string
  catches: number
  stumpings: number
  runOuts: number
  batting: { innings: number; outCount: number; average: number; strikeRate: number }
  bowling: { innings: number; economy: number; average: number }
  fielding: { dismissals: number }
}
```

- [ ] **Step 1: Write the failing test**

Create `server/src/stats.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.ts'
import { MatchStore } from './store.ts'
import { computeCareerStats } from './stats.ts'

const lineups = {
  A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
  B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
}

const config = {
  teamAId: 'teamA',
  teamBId: 'teamB',
  lineups,
  oversPerInnings: 2,
  powerplayOvers: 2,
}

function ball(over: number, ball: number, runs: number, extra: Record<string, unknown> = {}) {
  return {
    type: 'BALL',
    over,
    ball,
    runs,
    extras: 'NONE',
    wicket: false,
    dismissal: null,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b1',
    ...extra,
  }
}

describe('computeCareerStats', () => {
  let db: DatabaseSync
  let store: MatchStore

  beforeEach(() => {
    db = openDb(':memory:')
    store = new MatchStore(db)
  })

  it('folds batting and bowling numbers across matches', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    store.append(m1.matchId, ball(0, 0, 4))
    store.append(m1.matchId, ball(0, 1, 6))
    store.append(
      m1.matchId,
      ball(0, 2, 0, {
        wicket: true,
        dismissal: 'CAUGHT',
        dismissedPlayerId: 'a1',
        fielderId: 'b3',
      }),
    )

    const a1 = computeCareerStats(store.all(), 'a1')
    expect(a1).toMatchObject({
      matches: 1,
      runs: 10,
      balls: 3,
      fours: 1,
      sixes: 1,
      highest: 10,
      notOuts: 0,
      catches: 0,
    })
    expect(a1.batting).toEqual({ innings: 1, outCount: 1, average: 10, strikeRate: 333.33 })

    const b1 = computeCareerStats(store.all(), 'b1')
    expect(b1).toMatchObject({ matches: 1, wickets: 1, runsConceded: 10, oversBowled: '0.3', bestBowling: '1/10' })
    expect(b1.bowling).toEqual({ innings: 1, economy: 20, average: 10 })

    const b3 = computeCareerStats(store.all(), 'b3')
    expect(b3).toMatchObject({ matches: 1, catches: 1 })
    expect(b3.fielding).toEqual({ dismissals: 1 })
  })

  it('only counts matches the player is in the lineup of', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })

    const other = store.create({ ...config, teamAId: 'x1', teamBId: 'x2' })
    store.append(other.matchId, { type: 'TOSS', winnerTeamId: 'x1', winnerDecision: 'BAT' })

    expect(computeCareerStats(store.all(), 'a1').matches).toBe(2)
    expect(computeCareerStats(store.all(), 'zzz').matches).toBe(0)
  })

  it('returns zeros for a player with no matches', () => {
    const stats = computeCareerStats(store.all(), 'nobody')
    expect(stats).toMatchObject({
      matches: 0,
      runs: 0,
      highest: 0,
      notOuts: 0,
      wickets: 0,
      oversBowled: '0.0',
      bestBowling: '-',
    })
    expect(stats.batting).toEqual({ innings: 0, outCount: 0, average: 0, strikeRate: 0 })
    expect(stats.fielding).toEqual({ dismissals: 0 })
  })

  it('never throws on matches without playerRefs or fielderId', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    store.append(m1.matchId, ball(0, 0, 1))
    expect(() => computeCareerStats(store.all(), 'a1')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\IT\cricket-app\server; node ..\node_modules\vitest\vitest.mjs run --reporter=basic`
Expected: FAIL — cannot resolve `./stats.ts`.

- [ ] **Step 3: Write the implementation**

Create `server/src/stats.ts`:

```ts
import { formatOvers, projectScorecard, round2 } from '@cricket-app/core'
import type { MatchEvent } from '@cricket-app/core'
import type { MatchRecord } from './store.ts'

export interface CareerStats {
  matches: number
  runs: number
  balls: number
  fours: number
  sixes: number
  highest: number
  notOuts: number
  wickets: number
  oversBowled: string
  runsConceded: number
  bestBowling: string
  catches: number
  stumpings: number
  runOuts: number
  batting: { innings: number; outCount: number; average: number; strikeRate: number }
  bowling: { innings: number; economy: number; average: number }
  fielding: { dismissals: number }
}

function emptyStats(): CareerStats {
  return {
    matches: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highest: 0,
    notOuts: 0,
    wickets: 0,
    oversBowled: '0.0',
    runsConceded: 0,
    bestBowling: '-',
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    batting: { innings: 0, outCount: 0, average: 0, strikeRate: 0 },
    bowling: { innings: 0, economy: 0, average: 0 },
    fielding: { dismissals: 0 },
  }
}

function isFielderCredit(ev: MatchEvent, playerId: string): 'CAUGHT' | 'STUMPED' | 'RUN_OUT' | null {
  if (ev.type !== 'BALL' || ev.fielderId !== playerId) return null
  if (ev.dismissal === 'CAUGHT') return 'CAUGHT'
  if (ev.dismissal === 'STUMPED') return 'STUMPED'
  if (ev.dismissal === 'RUN_OUT') return 'RUN_OUT'
  return null
}

export function computeCareerStats(records: MatchRecord[], playerId: string): CareerStats {
  const stats = emptyStats()
  let bowledBalls = 0
  let ballsPerOver = 6
  let best: { wickets: number; runs: number } | null = null

  for (const record of records) {
    ballsPerOver = record.config.ballsPerOver || 6
    const inLineup =
      record.config.lineups.A.includes(playerId) || record.config.lineups.B.includes(playerId)
    if (!inLineup) continue
    stats.matches += 1

    const card = projectScorecard(record.state)
    for (const inn of card.innings) {
      const bat = inn.batting.find((b) => b.playerId === playerId)
      if (bat) {
        stats.batting.innings += 1
        stats.runs += bat.runs
        stats.balls += bat.balls
        stats.fours += bat.fours
        stats.sixes += bat.sixes
        if (bat.runs > stats.highest) stats.highest = bat.runs
        if (bat.out) stats.batting.outCount += 1
        else stats.notOuts += 1
      }
      const bowl = inn.bowling.find((b) => b.playerId === playerId)
      if (bowl) {
        stats.bowling.innings += 1
        stats.wickets += bowl.wickets
        stats.runsConceded += bowl.runs
        bowledBalls += bowl.balls
        if (!best || bowl.wickets > best.wickets || (bowl.wickets === best.wickets && bowl.runs < best.runs)) {
          best = { wickets: bowl.wickets, runs: bowl.runs }
        }
      }
    }

    for (const ev of record.events) {
      const credit = isFielderCredit(ev, playerId)
      if (credit === 'CAUGHT') stats.catches += 1
      else if (credit === 'STUMPED') stats.stumpings += 1
      else if (credit === 'RUN_OUT') stats.runOuts += 1
    }
  }

  stats.oversBowled = formatOvers(bowledBalls, ballsPerOver)
  if (best) stats.bestBowling = `${best.wickets}/${best.runs}`
  stats.batting.average = stats.batting.outCount > 0 ? round2(stats.runs / stats.batting.outCount) : 0
  stats.batting.strikeRate = stats.balls > 0 ? round2((stats.runs * 100) / stats.balls) : 0
  stats.bowling.economy = bowledBalls > 0 ? round2((stats.runsConceded * 6) / bowledBalls) : 0
  stats.bowling.average = stats.wickets > 0 ? round2(stats.runsConceded / stats.wickets) : 0
  stats.fielding.dismissals = stats.catches + stats.stumpings + stats.runOuts
  return stats
}
```

In `app.ts` add (importing `PlayerRepo` and `computeCareerStats`):

```ts
  app.get('/players', async (req) => {
    const { q } = req.query as { q?: unknown }
    if (typeof q !== 'string') throw new ApiError(400, 'INVALID_FORMAT', 'q query parameter is required')
    return { players: repo.search(q) }
  })

  app.post('/players', async (req, reply) => {
    const body = (req.body ?? {}) as { mobile?: unknown; name?: unknown }
    if (typeof body.mobile !== 'string' || typeof body.name !== 'string') {
      throw new ApiError(400, 'INVALID_PROFILE', 'mobile and name are required')
    }
    const player = repo.create({ mobile: body.mobile, name: body.name })
    reply.status(201)
    return { player }
  })

  app.get('/players/:id/stats', async (req) => {
    const { id } = req.params as { id: string }
    if (!repo.get(id)) throw new ApiError(404, 'NO_PLAYER', `Player ${id} not found`)
    return computeCareerStats(store.all(), id)
  })
```

`repo` here is the same instance auth uses — create it once in `buildApp` and pass into `registerAuthRoutes` (extend `AuthDeps` with `repo`).

- [ ] **Step 4: Run tests to verify they pass**

Run: same as Step 2. Expected: PASS — 4 stats tests + all previous (auth, players, store, app).

- [ ] **Step 5: Typecheck**

Run: `node ..\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` — clean.

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\IT\cricket-app add server/src
git -C C:\Users\IT\cricket-app commit -m "Add player directory search and career stats"
```

---

### Task 6: Web — auth/lineup/profile logic modules

**Files:**
- Create: `web/src/lineup.ts` + `web/src/lineup.test.ts`
- Create: `web/src/profile.ts` + `web/src/profile.test.ts`
- Modify: `web/src/api.ts` (player/auth/stats endpoints, token header)
- Create: `web/src/token.ts`

**Interfaces:**
- Consumes: existing `request<T>` + `ApiRequestError` in `api.ts`.
- Produces:
  - `token.ts`: `getToken(): string | null`, `setToken(t: string): void`, `clearToken(): void` (localStorage key `'token'`).
  - `lineup.ts`: `LineupEntry { id, name, mobile?, verified }`, `newLocalEntry(name, takenIds): LineupEntry`, `directoryEntry(p: Player): LineupEntry`, `buildLineupRefs(entries: LineupEntry[]): { ids: string[]; refs: Record<string, { name: string; mobile?: string; verified: boolean }> }`.
  - `profile.ts`: `validateProfilePatch(patch): { ok: true; value: Partial<Profile> } | { ok: false; error: string }`.
  - `api.ts`: `Player`, `CareerStats`, `AuthResponse`, `api.requestOtp`, `api.verifyOtp`, `api.register`, `api.getMe`, `api.patchMe`, `api.searchPlayers(q)`, `api.createPlayer(mobile, name)`, `api.getPlayerStats(id)` — all attaching `Authorization` when a token exists (except requestOtp/verifyOtp/register).

- [ ] **Step 1: Write the failing tests**

`web/src/lineup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildLineupRefs, directoryEntry, newLocalEntry } from './lineup'
import type { Player } from './api'

const player: Player = {
  id: 'p-1',
  mobile: '9876543210',
  name: 'Virat K',
  role: 'BATSMAN',
  batting_hand: 'RHB',
  bowling_style: null,
  location: null,
  created_at: '2026-10-08T00:00:00.000Z',
}

describe('lineup', () => {
  it('newLocalEntry is unverified, carries the name, and gets a unique id', () => {
    const a = newLocalEntry('Rohit', [])
    const b = newLocalEntry('Rohit', [a.id])
    expect(a.verified).toBe(false)
    expect(a.name).toBe('Rohit')
    expect(a.mobile).toBeUndefined()
    expect(b.id).not.toBe(a.id)
    expect(a.id.startsWith('local-')).toBe(true)
  })

  it('newLocalEntry trims and rejects empty names', () => {
    expect(() => newLocalEntry('   ', [])).toThrow('name required')
  })

  it('directoryEntry links the mobile and marks verified', () => {
    const e = directoryEntry(player)
    expect(e).toEqual({ id: 'p-1', name: 'Virat K', mobile: '9876543210', verified: true })
  })

  it('buildLineupRefs returns ids plus a refs map for every entry', () => {
    const local = newLocalEntry('Rohit', [])
    const dir = directoryEntry(player)
    const { ids, refs } = buildLineupRefs([local, dir])
    expect(ids).toEqual([local.id, 'p-1'])
    expect(refs[local.id]).toEqual({ name: 'Rohit', verified: false })
    expect(refs['p-1']).toEqual({ name: 'Virat K', mobile: '9876543210', verified: true })
  })
})
```

`web/src/profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateProfilePatch } from './profile'

describe('validateProfilePatch', () => {
  it('accepts a valid patch', () => {
    const res = validateProfilePatch({ role: 'KEEPER', batting_hand: 'LHB', location: 'Pune' })
    expect(res.ok).toBe(true)
  })

  it('rejects unknown roles and hands', () => {
    expect(validateProfilePatch({ role: 'WIZARD' as never })).toMatchObject({ ok: false })
    expect(validateProfilePatch({ batting_hand: 'MIDDLE' as never })).toMatchObject({ ok: false })
  })

  it('rejects empty name and whitespace-only location', () => {
    expect(validateProfilePatch({ name: '  ' })).toMatchObject({ ok: false })
    expect(validateProfilePatch({ location: '   ' })).toMatchObject({ ok: false })
  })

  it('allows empty patch and null clears', () => {
    expect(validateProfilePatch({}).ok).toBe(true)
    expect(validateProfilePatch({ bowling_style: null, location: null }).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\IT\cricket-app\web; node ..\node_modules\vitest\vitest.mjs run --reporter=basic`
Expected: FAIL — cannot resolve `./lineup` / `./profile`.

- [ ] **Step 3: Write the implementation**

`web/src/token.ts`:

```ts
const KEY = 'token'

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  window.localStorage.setItem(KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(KEY)
}
```

`web/src/lineup.ts`:

```ts
import type { Player } from './api'

export interface LineupEntry {
  id: string
  name: string
  mobile?: string
  verified: boolean
}

export function newLocalEntry(name: string, takenIds: string[]): LineupEntry {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('name required')
  const base = `local-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'}`
  let id = base
  let n = 2
  while (takenIds.includes(id)) {
    id = `${base}-${n}`
    n += 1
  }
  return { id, name: trimmed, verified: false }
}

export function directoryEntry(p: Player): LineupEntry {
  return { id: p.id, name: p.name, mobile: p.mobile, verified: true }
}

export function buildLineupRefs(entries: LineupEntry[]): {
  ids: string[]
  refs: Record<string, { name: string; mobile?: string; verified: boolean }>
} {
  const ids: string[] = []
  const refs: Record<string, { name: string; mobile?: string; verified: boolean }> = {}
  for (const e of entries) {
    ids.push(e.id)
    refs[e.id] = e.mobile
      ? { name: e.name, mobile: e.mobile, verified: e.verified }
      : { name: e.name, verified: e.verified }
  }
  return { ids, refs }
}
```

`web/src/profile.ts`:

```ts
import type { Player } from './api'

const ROLES = new Set(['BATSMAN', 'BOWLER', 'KEEPER', 'ALL_ROUNDER'])
const HANDS = new Set(['RHB', 'LHB'])

export type ProfilePatch = Partial<
  Pick<Player, 'name' | 'role' | 'batting_hand' | 'bowling_style' | 'location'>
>

export function validateProfilePatch(
  patch: ProfilePatch,
): { ok: true; value: ProfilePatch } | { ok: false; error: string } {
  if ('name' in patch && (typeof patch.name !== 'string' || patch.name.trim().length === 0)) {
    return { ok: false, error: 'Name cannot be empty' }
  }
  if (patch.role !== undefined && !ROLES.has(patch.role)) {
    return { ok: false, error: 'Pick a valid role' }
  }
  if (patch.batting_hand !== undefined && !HANDS.has(patch.batting_hand)) {
    return { ok: false, error: 'Batting hand must be RHB or LHB' }
  }
  if ('location' in patch && patch.location != null && patch.location.trim().length === 0) {
    return { ok: false, error: 'Location cannot be blank' }
  }
  if ('bowling_style' in patch && patch.bowling_style != null && patch.bowling_style.trim().length === 0) {
    return { ok: false, error: 'Bowling style cannot be blank' }
  }
  const value: ProfilePatch = {}
  if (patch.name !== undefined) value.name = patch.name.trim()
  if (patch.role !== undefined) value.role = patch.role
  if (patch.batting_hand !== undefined) value.batting_hand = patch.batting_hand
  if ('bowling_style' in patch) value.bowling_style = patch.bowling_style
  if ('location' in patch) value.location = patch.location === null ? null : (patch.location ?? undefined)
  return { ok: true, value }
}
```

`api.ts` additions (keep existing code; add — note web uses **extensionless** relative imports, matching `./scoring` style):

```ts
import { getToken } from './token'

export interface Player {
  id: string
  mobile: string
  name: string
  role: 'BATSMAN' | 'BOWLER' | 'KEEPER' | 'ALL_ROUNDER'
  batting_hand: 'RHB' | 'LHB'
  bowling_style: string | null
  location: string | null
  created_at: string
}

export interface CareerStats {
  matches: number
  runs: number
  balls: number
  fours: number
  sixes: number
  highest: number
  notOuts: number
  wickets: number
  oversBowled: string
  runsConceded: number
  bestBowling: string
  catches: number
  stumpings: number
  runOuts: number
  batting: { innings: number; outCount: number; average: number; strikeRate: number }
  bowling: { innings: number; economy: number; average: number }
  fielding: { dismissals: number }
}

export interface AuthResponse {
  token: string
  player: Player
}
```

`request` gains automatic auth (final form — build headers once, keep `init` spread semantics for callers passing `body`/`method`):

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = getToken()
  if (token && !path.startsWith('/auth/')) headers.authorization = `Bearer ${token}`
  const res = await fetch(path, {
    ...init,
    headers: { ...headers, ...((init?.headers as Record<string, string> | undefined) ?? {}) },
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body as { error?: string; code?: string } | null
    throw new ApiRequestError(err?.error ?? res.statusText, err?.code ?? `HTTP_${res.status}`)
  }
  return body as T
}
```

api object additions:

```ts
  requestOtp(mobile: string): Promise<{ ok: true; devOtp?: string }> {
    return request('/auth/otp', { method: 'POST', body: JSON.stringify({ mobile }) })
  },
  verifyOtp(mobile: string, otp: string): Promise<AuthResponse> {
    return request('/auth/verify', { method: 'POST', body: JSON.stringify({ mobile, otp }) })
  },
  register(mobile: string, otp: string, name: string): Promise<AuthResponse> {
    return request('/auth/register', { method: 'POST', body: JSON.stringify({ mobile, otp, name }) })
  },
  getMe(): Promise<{ player: Player }> {
    return request('/me')
  },
  patchMe(patch: Record<string, unknown>): Promise<{ player: Player }> {
    return request('/me', { method: 'PATCH', body: JSON.stringify(patch) })
  },
  searchPlayers(q: string): Promise<{ players: Player[] }> {
    return request(`/players?q=${encodeURIComponent(q)}`)
  },
  createPlayer(mobile: string, name: string): Promise<{ player: Player }> {
    return request('/players', { method: 'POST', body: JSON.stringify({ mobile, name }) })
  },
  getPlayerStats(id: string): Promise<CareerStats> {
    return request(`/players/${id}/stats`)
  },
```

Note: `vite.config.ts` proxy only forwards `/matches` — extend to proxy `/auth`, `/me`, `/players`:

```ts
const target = 'http://localhost:3000'
server: {
  proxy: {
    '/matches': { target, changeOrigin: true },
    '/auth': { target, changeOrigin: true },
    '/me': { target, changeOrigin: true },
    '/players': { target, changeOrigin: true },
  },
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: same as Step 2. Expected: PASS — 8 new tests + 14 existing.

- [ ] **Step 5: Typecheck**

Run: `node ..\node_modules\typescript\bin\tsc --noEmit` — clean. (If `import './token.ts'` style is rejected, use `'./token'` — web uses bundler resolution and accepts extensionless; match whatever style existing files use: they are extensionless, so use `'./token'`.)

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\IT\cricket-app add web/src web/vite.config.ts
git -C C:\Users\IT\cricket-app commit -m "Add web auth, lineup and profile logic"
```

---

### Task 7: Web — sign-in and profile screens

**Files:**
- Create: `web/src/SigninScreen.tsx`
- Create: `web/src/ProfileScreen.tsx`
- Modify: `web/src/App.tsx` (routes `#/signin`, `#/profile`, header link)

**Interfaces:**
- Consumes: `api.*`, `token.setToken/clearToken`, `validateProfilePatch`, `getToken/getMe`.
- Produces: hash routes `#/signin` and `#/profile`; header shows "Sign in" (no token) or player name (token) linking to `#/profile`.

- [ ] **Step 1: Write the sign-in screen**

`SigninScreen.tsx` — three steps in one component (`mobile` → `otp` → `register` if `NO_ACCOUNT`):

```tsx
import React, { useState } from 'react'
import { api, ApiRequestError } from './api'
import { setToken } from './token'

type Step = 'mobile' | 'otp' | 'register'

export function SigninScreen({ onDone }: { onDone: () => void }): React.ReactElement {
  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function requestOtp(): Promise<void> {
    setError(null)
    if (!/^\d{10}$/.test(mobile)) {
      setError('Enter a 10-digit mobile number')
      return
    }
    setBusy(true)
    try {
      const res = await api.requestOtp(mobile)
      setDevOtp(res.devOtp ?? null)
      setStep('otp')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send OTP')
    } finally {
      setBusy(false)
    }
  }

  async function submitOtp(register: boolean): Promise<void> {
    setError(null)
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP')
      return
    }
    setBusy(true)
    try {
      const res = register
        ? await api.register(mobile, otp, name.trim())
        : await api.verifyOtp(mobile, otp)
      setToken(res.token)
      onDone()
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'NO_ACCOUNT' && !register) {
        setStep('register')
        setError('No profile for this number — create one below')
      } else if (err instanceof ApiRequestError && err.code === 'OTP_MISMATCH') {
        setError('Incorrect OTP, try again')
      } else if (err instanceof ApiRequestError && err.code === 'OTP_MAX_ATTEMPTS') {
        setError('Too many attempts — request a new OTP')
        setStep('mobile')
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Verification failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Sign in</h2>
      {step === 'mobile' && (
        <div className="form-stack">
          <input
            inputMode="numeric"
            placeholder="Mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          <button onClick={() => void requestOtp()} disabled={busy}>
            Send OTP
          </button>
        </div>
      )}
      {step !== 'mobile' && (
        <div className="form-stack">
          {devOtp && <p className="muted">Dev OTP: <strong>{devOtp}</strong></p>}
          <input
            inputMode="numeric"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {step === 'register' && (
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <button
            onClick={() => void submitOtp(step === 'register')}
            disabled={busy || (step === 'register' && name.trim().length === 0)}
          >
            {step === 'register' ? 'Create profile' : 'Verify'}
          </button>
          <button className="ghost" onClick={() => setStep('mobile')} disabled={busy}>
            Change number
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write the profile screen**

`ProfileScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react'
import type { CareerStats, Player } from './api'
import { api, ApiRequestError } from './api'
import { clearToken } from './token'
import { validateProfilePatch } from './profile'
import type { ProfilePatch } from './profile'

const ROLES: Array<Player['role']> = ['BATSMAN', 'BOWLER', 'KEEPER', 'ALL_ROUNDER']

export function ProfileScreen({ onSignedOut }: { onSignedOut: () => void }): React.ReactElement {
  const [player, setPlayer] = useState<Player | null>(null)
  const [stats, setStats] = useState<CareerStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMe()
      .then(({ player }) => {
        setPlayer(player)
        return api.getPlayerStats(player.id)
      })
      .then(setStats)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.code === 'UNAUTHENTICATED') clearToken()
        setError(err instanceof ApiRequestError ? err.message : 'Failed to load profile')
      })
  }, [])

  async function save(patch: ProfilePatch): Promise<void> {
    setError(null)
    setNotice(null)
    const check = validateProfilePatch(patch)
    if (!check.ok) {
      setError(check.error)
      return
    }
    try {
      const { player: updated } = await api.patchMe(check.value)
      setPlayer(updated)
      setNotice('Saved')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Save failed')
    }
  }

  if (!player) {
    return (
      <div className="card">
        {error ? (
          <>
            <p className="error">{error}</p>
            <a className="btn" href="#/signin">Sign in</a>
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <h2>{player.name}</h2>
      <p className="muted">{player.location ?? 'Add your location'}</p>
      <div className="career-strip">
        <div><strong>{stats?.matches ?? 0}</strong><span>Matches</span></div>
        <div><strong>{stats?.runs ?? 0}</strong><span>Runs</span></div>
        <div><strong>{stats?.wickets ?? 0}</strong><span>Wickets</span></div>
      </div>

      <h3>Playing role</h3>
      <div className="chip-row">
        {ROLES.map((role) => (
          <button
            key={role}
            className={player.role === role ? 'chip active' : 'chip'}
            onClick={() => void save({ role })}
          >
            {role === 'KEEPER' ? 'Wicketkeeper' : role.charAt(0) + role.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <h3>Batting style</h3>
      <div className="chip-row">
        {(['RHB', 'LHB'] as const).map((hand) => (
          <button
            key={hand}
            className={player.batting_hand === hand ? 'chip active' : 'chip'}
            onClick={() => void save({ batting_hand: hand })}
          >
            {hand}
          </button>
        ))}
      </div>

      <h3>Bowling style</h3>
      <input
        defaultValue={player.bowling_style ?? ''}
        placeholder="e.g. Right-arm medium"
        onBlur={(e) => {
          const value = e.target.value.trim()
          if (value !== (player.bowling_style ?? '')) {
            void save({ bowling_style: value.length > 0 ? value : null })
          }
        }}
      />

      <h3>Location</h3>
      <input
        defaultValue={player.location ?? ''}
        placeholder="City"
        onBlur={(e) => {
          const value = e.target.value.trim()
          if (value !== (player.location ?? '')) void save({ location: value.length > 0 ? value : null })
        }}
      />

      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      <h3>Career stats <span className="free-badge">FREE</span></h3>
      {stats && (
        <div className="stats-grid">
          <div><span>Batting</span> {stats.runs} runs ({stats.balls} balls), SR {stats.batting.strikeRate}, HS {stats.highest}, {stats.fours}×4, {stats.sixes}×6, avg {stats.batting.average}</div>
          <div><span>Bowling</span> {stats.wickets} wkts in {stats.oversBowled} ov, econ {stats.bowling.economy}, best {stats.bestBowling}</div>
          <div><span>Fielding</span> {stats.catches} catches, {stats.stumpings} stumpings, {stats.runOuts} run-outs</div>
        </div>
      )}

      <button
        className="ghost"
        onClick={() => {
          clearToken()
          onSignedOut()
        }}
      >
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Wire routes and header in App.tsx**

In `parseHash` add routes: `#/signin` → `{ name: 'signin' }`, `#/profile` → `{ name: 'profile' }` (extend the `Route` union). Render `SigninScreen` (onDone → `location.hash = '#/profile'`) and `ProfileScreen` (onSignedOut → `location.hash = '#/'`). In the top bar, render a link: token present → player's cached name or "Profile" → `#/profile`; else "Sign in" → `#/signin`. Use `getToken()` from `token.ts` (re-render on hash change — the app already re-renders on hash changes).

- [ ] **Step 4: Verify (typecheck + manual)**

```powershell
cd C:\Users\IT\cricket-app\web
node ..\node_modules\typescript\bin\tsc --noEmit
node ..\node_modules\vitest\vitest.mjs run --reporter=basic
```
Expected: clean + all green. (UI is covered by Task 10 e2e — no DOM test framework installed; pure logic was TDD'd in Task 6.)

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\IT\cricket-app add web/src
git -C C:\Users\IT\cricket-app commit -m "Add sign-in and profile screens"
```

---

### Task 8: Web — lineup add-by-name / add-by-number in setup

**Files:**
- Modify: `web/src/App.tsx` (`SetupFlow` lineup section)
- Modify: `web/src/api.ts` (`CreateMatchBody.playerRefs`)

**Interfaces:**
- Consumes: `LineupEntry`, `newLocalEntry`, `directoryEntry`, `buildLineupRefs` (Task 6); `api.searchPlayers`, `api.createPlayer`.
- Produces: `createMatch` POST body gains `playerRefs` alongside `lineups` (server already preserves it via `withDefaults` spread).

- [ ] **Step 1: Extend CreateMatchBody**

```ts
export interface CreateMatchBody {
  teamAId: string
  teamBId: string
  lineups: { A: string[]; B: string[] }
  playerRefs: Record<string, { name: string; mobile?: string; verified: boolean }>
  oversPerInnings: number
  powerplayOvers: number
}
```

- [ ] **Step 2: Rework SetupFlow lineups**

Replace `makeLineup(teamId, players)` usage:

- State: `const [lineupA, setLineupA] = useState<LineupEntry[]>([])`, same for B; keep the "players" spinner as a **quick-fill** that fills each side with `newLocalEntry('Player ' + (i+1), taken)` up to the chosen count (replaces placeholder ids; keep names as `Player N`).
- Each side gets a mode toggle: **By name** — text input + Add → `newLocalEntry(name, taken)`. **By number** — digit input; when `value.length >= 4`, call `api.searchPlayers(value)` (debounced 200ms) and render suggestions `{name} · {role} · {mobile}`; tapping a suggestion → `directoryEntry(p)` added; if no results, show `Add '<number>' as new player` button that prompts for a name inline and calls `api.createPlayer(mobile, name)` then adds the returned entry.
- Entries render as removable chips (× removes) — so a quick-filled placeholder can be swapped for a real name.
- On submit:

```ts
const a = buildLineupRefs(lineupA)
const b = buildLineupRefs(lineupB)
await api.createMatch({
  teamAId, teamBId,
  lineups: { A: a.ids, B: b.ids },
  playerRefs: { ...a.refs, ...b.refs },
  oversPerInnings, powerplayOvers,
})
```

- Validation before submit: each side must have at least 11 entries (engine enforces `maxWickets + 1`) — show inline error.

- [ ] **Step 3: Verify**

```powershell
cd C:\Users\IT\cricket-app\web
node ..\node_modules\vitest\vitest.mjs run --reporter=basic
node ..\node_modules\typescript\bin\tsc --noEmit
```
Expected: green + clean (logic tests already exist from Task 6; e2e covers the interaction).

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\IT\cricket-app add web/src
git -C C:\Users\IT\cricket-app commit -m "Add by-name and by-number lineup entry"
```

---

### Task 9: Web — player names + fielded-by picker

**Files:**
- Modify: `web/src/scoring.ts` + `scoring.test.ts` (TDD: `playerName`, `fielderId` in payload)
- Modify: `web/src/ScoringScreen.tsx` (names + fielded-by select)
- Modify: `web/src/ScorecardView.tsx` (names)

**Interfaces:**
- Consumes: `MatchConfig.playerRefs` (Task 1), `LineupEntry` display data in `App.tsx` state.
- Produces: `playerName(config: MatchConfig, id: string): string` (falls back to `id` when `playerRefs` missing — old matches render exactly as today); `buildBallPayload` gains optional `fielderId` → included in payload only when set.

- [ ] **Step 1: Write the failing tests**

Append to `scoring.test.ts`:

```ts
import type { MatchConfig } from '@cricket-app/core'

const cfgWithRefs = {
  playerRefs: {
    'p-1': { name: 'Virat K', mobile: '9876543210', verified: true },
    'india-3': { name: 'Rohit', verified: false },
  },
} as MatchConfig

describe('playerName', () => {
  it('resolves directory and local names', () => {
    expect(playerName(cfgWithRefs, 'p-1')).toBe('Virat K')
    expect(playerName(cfgWithRefs, 'india-3')).toBe('Rohit')
  })

  it('falls back to the raw id for old matches and unknown players', () => {
    const empty = {} as MatchConfig
    expect(playerName(empty, 'india-1')).toBe('india-1')
    expect(playerName(cfgWithRefs, 'zzz')).toBe('zzz')
  })
})

describe('buildBallPayload with fielderId', () => {
  it('includes fielderId when a fielder is credited', () => {
    const payload = buildBallPayload({
      kind: 'WICKET',
      runs: 0,
      dismissal: 'CAUGHT',
      positions: { strikerId: 'a1', nonStrikerId: 'a2', bowlerId: 'b1' },
      over: 0,
      ball: 2,
      fielderId: 'b3',
    })
    expect(payload).toMatchObject({ dismissal: 'CAUGHT', fielderId: 'b3', dismissedPlayerId: 'a1' })
  })

  it('omits fielderId when not credited', () => {
    const payload = buildBallPayload({
      kind: 'WICKET',
      runs: 0,
      dismissal: 'BOWLED',
      positions: { strikerId: 'a1', nonStrikerId: 'a2', bowlerId: 'b1' },
      over: 0,
      ball: 2,
    })
    expect('fielderId' in payload).toBe(false)
  })
})
```

(`buildBallPayload` options type gains `fielderId?: string`; export `playerName` from `scoring.ts`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\IT\cricket-app\web; node ..\node_modules\vitest\vitest.mjs run --reporter=basic`
Expected: FAIL — `playerName` not exported / `fielderId` unknown option.

- [ ] **Step 3: Implement**

In `scoring.ts`:

```ts
export function playerName(config: MatchConfig, id: string): string {
  return config.playerRefs?.[id]?.name ?? id
}
```

`buildBallPayload`: add `fielderId?: string` to the options; in the WICKET branch, when `opts.fielderId` is set and truthy, include `fielderId: opts.fielderId` in the returned payload object.

In `ScoringScreen.tsx`:

- Import `playerName`; use it for striker/nonStriker/bowler boxes, opener-panel select labels, and the fielded-by select.
- Dismissal picker: when selected dismissal is one of `CAUGHT`, `STUMPED`, `RUN_OUT`, `OBSTRUCTING`, render a `select` "fielded by" whose options are the **fielding side** players (the innings' bowling team lineup from `state.config.lineups`), labels via `playerName`. Default: first option for `STUMPED`/`OBSTRUCTING` (keeper-ish), else empty ("Select fielder") — pad submission for wickets of those types requires a fielder choice. Pass the chosen id as `fielderId` into `buildBallPayload` and reset the choice after submit.

In `ScorecardView.tsx`: replace raw `line.playerId` rendering with `playerName(config, line.playerId)` in batting and bowling tables (needs `config` passed in or read from the bundle — ScorecardView already receives the bundle; thread `state.config` through).

- [ ] **Step 4: Run tests to verify they pass**

Run: same as Step 2. Expected: green (14 + new).

- [ ] **Step 5: Typecheck + Commit**

```powershell
cd C:\Users\IT\cricket-app\web
node ..\node_modules\typescript\bin\tsc --noEmit
git -C C:\Users\IT\cricket-app add web/src
git -C C:\Users\IT\cricket-app commit -m "Resolve player names and credit fielders on wickets"
```

---

### Task 10: End-to-end verification, docs, cleanup

**Files:**
- Modify: `TODO.md`
- No production code (verification + docs only)

- [ ] **Step 1: Run every suite and typecheck**

```powershell
cd C:\Users\IT\cricket-app\packages\core; node ..\..\node_modules\vitest\vitest.mjs run; node ..\..\node_modules\typescript\bin\tsc --noEmit
cd C:\Users\IT\cricket-app\server; node ..\node_modules\vitest\vitest.mjs run; node ..\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit
cd C:\Users\IT\cricket-app\web; node ..\node_modules\vitest\vitest.mjs run; node ..\node_modules\typescript\bin\tsc --noEmit
```
Expected: all green (core 53+, server ~36, web 22+), all typechecks clean. Report any failure by name.

- [ ] **Step 2: Restart the stack on fresh code**

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Then start background shells: server `cd C:\Users\IT\cricket-app\server; $env:PORT=3000; node --experimental-strip-types src/index.ts` and web `cd C:\Users\IT\cricket-app\web; node ..\node_modules\vite\bin\vite.js`.

- [ ] **Step 3: Playwright e2e against http://localhost:5173**

Walk through (DOM/snapshot assertions, not screenshots — model cannot view images):

1. **Register**: `#/signin` → enter 10-digit number → OTP shown on screen → verify → lands on profile with name entered.
2. **Edit profile**: set role chip Wicketkeeper, batting hand LHB, bowling style, location → "Saved" → reload page → values persist (PATCH worked).
3. **New match setup**: Team A quick-fill 11 via spinner; Team B: quick-fill, then swap one placeholder — **by name** add "Suresh" (chip appears), **by number** type ≥4 digits of the registered number → suggestion with real name → select (chip shows real name + ✓). Submit → toss → match starts.
4. **Score**: bowl 2 deliveries; score a **CAUGHT** wicket choosing the fielded-by player → 201, no 4xx.
5. **Scorecard tab**: batting/bowling rows show real names (registered player's name, "Suresh") — not raw ids.
6. **Profile**: career strip shows Matches 1 / Runs > 0 after the over; stats line renders (batting SR etc.).
7. **Restart persistence**: stop the server shell, restart it, revisit `#/match/<id>` → match still present with events intact; profile stats still present.
8. **Signed-out scoring**: open a fresh match without signing out? (Sign out first, then create a match by-name only → scoring pad works — confirms constraint "scoring works without login".)

Record outcomes; fix any bug found by returning to the owning task's TDD cycle (failing test first).

- [ ] **Step 4: Update TODO.md**

Mark Phase 4 (accounts/directory/stats) complete with test counts; note dev-OTP and SMS-later.

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\IT\cricket-app add TODO.md
git -C C:\Users\IT\cricket-app commit -m "Complete accounts phase: e2e verified"
git -C C:\Users\IT\cricket-app log --oneline -8
```

