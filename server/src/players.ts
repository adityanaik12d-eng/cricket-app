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
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

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
