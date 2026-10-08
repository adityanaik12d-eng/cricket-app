import type { MatchResult, MatchState } from '../types.js'

export function projectResult(state: MatchState): MatchResult | null {
  if (state.overrideResult) return state.overrideResult
  return null
}