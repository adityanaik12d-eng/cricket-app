/**
 * DLS/VJD helpers (best-effort MVP).
 * Full DLS 5.0 requires official resource tables; this implements a practical
 * simplified resource-percentage model for common cases + supports manual/VJD input.
 */

export type DLSMethod = 'DLS_5_0' | 'VJD' | 'MANUAL'

export interface DLSRevisionInput {
  method: DLSMethod
  /** Team 1 (first innings) total runs */
  team1Runs: number
  /** Total overs scheduled per innings at start */
  totalOvers: number
  /** Overs completed in first innings (for interruptions) - MVP uses overs lost */
  oversLostFirstInnings?: number
  /** Overs available to team 2 at start of chase */
  oversAvailableTeam2?: number
  /** Manual revised target (VJD/manual) */
  manualTarget?: number
}

/**
 * Simplified DLS resource percentages for T20 (20 overs max) by overs remaining.
 * Source concept: standard DLS resource curves (approximate MVP values).
 * Index = overs remaining (0..20). Values are % resources remaining.
 */
const T20_RESOURCES: number[] = [
  0, 3.6, 7.2, 10.6, 13.9, 17.1, 20.2, 23.3, 26.2, 29.1,
  31.9, 34.6, 37.3, 39.9, 42.4, 44.9, 47.3, 49.6, 51.9, 54.1, 56.6,
]

/** 50-over simplified resource curve (0..50), approximate key points interpolated. */
function odiResource(oversRemaining: number): number {
  const o = Math.max(0, Math.min(50, oversRemaining))
  // Approximate anchors (MVP): 50->100, 40->89.3, 30->75.1, 20->56.6, 10->32.1, 0->0
  const anchors: Array<[number, number]> = [[0,0],[10,32.1],[20,56.6],[30,75.1],[40,89.3],[50,100]]
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]!, b = anchors[i]!
    if (o <= b[0]) {
      const t = (o - a[0]) / (b[0] - a[0])
      return a[1] + t * (b[1] - a[1])
    }
  }
  return 100
}

export function resourcePercent(totalOvers: number, oversRemaining: number): number {
  if (oversRemaining <= 0) return 0
  if (totalOvers <= 20) {
    const idx = Math.max(0, Math.min(20, Math.round(oversRemaining)))
    const base = T20_RESOURCES[idx] ?? 0
    // scale if totalOvers != 20
    if (totalOvers === 20) return base
    const scale = totalOvers / 20
    const scaledIdx = Math.max(0, Math.min(20, Math.round(oversRemaining / scale)))
    return T20_RESOURCES[scaledIdx] ?? base
  }
  if (totalOvers <= 50) return odiResource(Math.min(50, (oversRemaining / totalOvers) * 50))
  return Math.max(0, Math.min(100, (oversRemaining / totalOvers) * 100))
}

/** MVP: interruption before 2nd innings or simple overs-lost revision. */
export function calculateRevisedTarget(input: DLSRevisionInput): { revisedTarget: number; revisedOvers: number; note: string } {
  const total = Math.max(1, input.totalOvers)
  if (input.method === 'MANUAL' || input.method === 'VJD') {
    const target = Math.max(1, Math.floor(input.manualTarget ?? input.team1Runs + 1))
    const overs = Math.max(1, Math.floor(input.oversAvailableTeam2 ?? total))
    return { revisedTarget: target, revisedOvers: overs, note: `${input.method} manual target applied (MVP).` }
  }
  // DLS MVP: if 2nd innings overs reduced
  const overs2 = Math.max(1, Math.min(total, input.oversAvailableTeam2 ?? (total - (input.oversLostFirstInnings ?? 0))))
  const r1 = resourcePercent(total, total)
  const r2 = resourcePercent(total, overs2)
  const ratio = r1 > 0 ? r2 / r1 : overs2 / total
  const par = Math.floor(input.team1Runs * ratio)
  const target = par + 1
  return { revisedTarget: Math.max(1, target), revisedOvers: overs2, note: 'DLS simplified (MVP resource model). Verify for official matches.' }
}
