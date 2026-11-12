import type { Player } from './api'

const ROLES = new Set(['BATSMAN', 'BOWLER', 'KEEPER', 'ALL_ROUNDER'])
const HANDS = new Set(['RHB', 'LHB'])

export function roleLabel(role: string): string {
  if (role === 'KEEPER') return 'Wicketkeeper'
  if (role === 'ALL_ROUNDER') return 'All-rounder'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export type ProfilePatch = Partial<
  Pick<Player, 'name' | 'role' | 'batting_hand' | 'bowling_style' | 'location'>
> & { mobile?: string }

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
  if ('mobile' in patch && patch.mobile != null && patch.mobile.trim().length === 0) {
    return { ok: false, error: 'Mobile number cannot be blank' }
  }
  const value: ProfilePatch = {}
  if (patch.name !== undefined) value.name = patch.name.trim()
  if (patch.role !== undefined) value.role = patch.role
  if (patch.batting_hand !== undefined) value.batting_hand = patch.batting_hand
  if ('bowling_style' in patch) value.bowling_style = patch.bowling_style
  if ('location' in patch) value.location = patch.location === null ? null : (patch.location ?? undefined)
  if ('mobile' in patch) value.mobile = patch.mobile?.trim()
  return { ok: true, value }
}
