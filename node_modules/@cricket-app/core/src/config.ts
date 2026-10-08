import type { ValidationResult } from './errors.js'
import { oversToBalls } from './overs.js'
import type { MatchConfig } from './types.js'

export const DEFAULT_MATCH_CONFIG = {
  oversPerInnings: 20,
  inningsCount: 2,
  ballsPerOver: 6,
  maxOversPerBowler: 4,
  maxWickets: 10,
  powerplayOvers: 6,
  wideExtra: 1,
  noBallExtra: 1,
  minutesPerOver: 4,
} as const

type DefaultKey = keyof typeof DEFAULT_MATCH_CONFIG
export type MatchConfigInput = Omit<MatchConfig, DefaultKey> & Partial<Pick<MatchConfig, DefaultKey>>

export function withDefaults(input: MatchConfigInput): MatchConfig {
  return { ...DEFAULT_MATCH_CONFIG, ...input }
}

function fail(code: any, message: string): ValidationResult {
  return { ok: false, error: { code, message } }
}

export function validateMatchConfig(config: MatchConfig): ValidationResult {
  if (config.oversPerInnings <= 0) {
    return fail('INVALID_FORMAT', 'oversPerInnings must be greater than 0')
  }
  if (config.inningsCount < 1) {
    return fail('INVALID_FORMAT', 'inningsCount must be at least 1')
  }
  if (config.ballsPerOver < 1) {
    return fail('INVALID_FORMAT', 'ballsPerOver must be at least 1')
  }
  if (config.maxWickets < 1 || config.maxWickets > 10) {
    return fail('INVALID_FORMAT', 'maxWickets must be between 1 and 10')
  }
  if (config.powerplayOvers < 0) {
    return fail('INVALID_FORMAT', 'powerplayOvers must be non-negative')
  }
  if (config.powerplayOvers > config.oversPerInnings) {
    return fail('INVALID_FORMAT', 'powerplayOvers must not exceed oversPerInnings')
  }
  if (config.teamAId === config.teamBId) {
    return fail('INVALID_FORMAT', 'a match needs two different teams')
  }

  const minSquad = config.maxWickets + 1
  const teamAPlayers = config.lineups.A
  const teamBPlayers = config.lineups.B
  if (teamAPlayers.length < minSquad) {
    return fail('LINEUP_TOO_SHORT', `${config.teamAId} has ${teamAPlayers.length} players, needs ${minSquad}`)
  }
  if (teamBPlayers.length < minSquad) {
    return fail('LINEUP_TOO_SHORT', `${config.teamBId} has ${teamBPlayers.length} players, needs ${minSquad}`)
  }

  const seenA = new Set<string>()
  for (const pid of teamAPlayers) {
    if (seenA.has(pid)) {
      return fail('DUPLICATE_PLAYER', `${pid} appears twice in the lineup for ${config.teamAId}`)
    }
    seenA.add(pid)
  }
  const seenB = new Set<string>()
  for (const pid of teamBPlayers) {
    if (seenB.has(pid)) {
      return fail('DUPLICATE_PLAYER', `${pid} appears twice in the lineup for ${config.teamBId}`)
    }
    seenB.add(pid)
  }
  for (const pid of teamAPlayers) {
    if (seenB.has(pid)) {
      return fail('DUPLICATE_PLAYER', `${pid} plays for both teams`)
    }
  }

  const balls = oversToBalls(config.oversPerInnings, config.ballsPerOver)
  const capacity = teamAPlayers.length * oversToBalls(config.maxOversPerBowler, config.ballsPerOver)
  if (capacity < balls) {
    return fail('QUOTA_UNCOVERABLE', `${config.maxOversPerBowler} over per bowler covers ${Math.floor(capacity / config.ballsPerOver)} overs of ${config.oversPerInnings}`)
  }

  return { ok: true }
}