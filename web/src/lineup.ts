import type { Player } from './api'

export interface LineupEntry {
  id: string
  name: string
  mobile?: string
  verified: boolean
}

const issuedLocalIds = new Set<string>()

// Clear ids handed out by newLocalEntry. SetupFlow calls this on mount so a
// fresh setup session can reuse predictable quick-fill ids; within one session
// ids stay unique (which is what keeps team A and team B from colliding).
export function resetLocalIds(): void {
  issuedLocalIds.clear()
}

export function newLocalEntry(name: string, takenIds: string[]): LineupEntry {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('name required')
  const base = `local-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'}`
  let id = base
  let n = 2
  while (takenIds.includes(id) || issuedLocalIds.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  issuedLocalIds.add(id)
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
