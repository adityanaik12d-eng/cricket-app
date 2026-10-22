/** What a delivery earned, for the celebration overlay. */
export type CelebrationKind = 'none' | 'boundary' | 'six' | 'wicket' | 'milestone'

/** How loud the celebration should be. */
export type CelebrationTier = 'none' | 'small' | 'big' | 'huge'

/** The facts a delivery needs for the celebration engine. */
export interface CelebrationInput {
  /** Runs scored off the delivery. */
  runs: number
  /**
   * Total runs the delivery added to the team (penalty + bat runs + byes).
   * Defaults to `runs`; extras make the two differ.
   */
  totalRuns?: number
  /** True when the delivery took a wicket. */
  isWicket: boolean
  /** Team wickets after the delivery. */
  wickets: number
  /** Team runs AFTER the delivery. */
  teamRuns: number
}

/** The celebration a delivery earned. */
export interface DeliveryCelebration {
  kind: CelebrationKind
  label: string
  runs: number
  wickets: number
  /** The 50/100/… mark crossed by this delivery, else null. */
  milestone: number | null
  tier: CelebrationTier
}

/** The step between two milestones. */
export const MILESTONE_STEP = 50

/**
 * The next milestone strictly above `runs`.
 * A non-finite or negative score falls back to the first milestone.
 */
export function nextMilestone(runs: number): number {
  if (!Number.isFinite(runs)) return MILESTONE_STEP
  const next = Math.floor(runs / MILESTONE_STEP) * MILESTONE_STEP + MILESTONE_STEP
  return next > 0 ? next : MILESTONE_STEP
}

/**
 * The highest milestone that `newRuns` reached and `prevRuns` had not, else null.
 * Zero is never a milestone.
 */
export function milestoneReached(prevRuns: number, newRuns: number): number | null {
  if (!Number.isFinite(prevRuns) || !Number.isFinite(newRuns)) return null
  if (newRuns <= prevRuns) return null
  const milestone = Math.floor(newRuns / MILESTONE_STEP) * MILESTONE_STEP
  if (milestone <= 0) return null
  return milestone > prevRuns ? milestone : null
}

/** The label shown for a celebration kind. */
function labelFor(kind: CelebrationKind, runs: number, milestone: number | null): string {
  if (kind === 'wicket') return 'WICKET!'
  if (kind === 'six') return 'SIX!'
  if (kind === 'boundary') return 'FOUR!'
  if (kind === 'milestone') return `${milestone ?? runs} RUNS`
  return ''
}

/** The loudness of a celebration kind. */
function tierFor(kind: CelebrationKind, milestone: number | null): CelebrationTier {
  if (milestone !== null && milestone >= 100) return 'huge'
  if (kind === 'boundary') return 'small'
  if (kind === 'six' || kind === 'wicket' || kind === 'milestone') return 'big'
  return 'none'
}

/**
 * Derive the celebration for a delivery.
 *
 * `kind` precedence is wicket > six > milestone > boundary > none, but the
 * milestone is reported independently: a six from 48 to 54 is a six that also
 * crossed the 50.
 */
export function celebrateDelivery(input: CelebrationInput): DeliveryCelebration {
  const { runs, isWicket, wickets, teamRuns } = input
  // The milestone is about the team's score, so it uses the total the delivery
  // added; a wide that takes the team to fifty counts.
  const prevRuns = teamRuns - (input.totalRuns ?? runs)
  const milestone = milestoneReached(prevRuns, teamRuns)

  let kind: CelebrationKind = 'none'
  if (isWicket) kind = 'wicket'
  else if (runs === 6) kind = 'six'
  else if (milestone !== null) kind = 'milestone'
  else if (runs === 4) kind = 'boundary'

  return {
    kind,
    label: labelFor(kind, runs, milestone),
    runs,
    wickets,
    milestone,
    tier: tierFor(kind, milestone),
  }
}
