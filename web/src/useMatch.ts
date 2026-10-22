import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { api, ApiRequestError } from './api'
import type { MatchBundle } from './api'
import { getSupabase } from './supabase'
import { ownsMatchLocally, resolveScorerStatus } from './scorerControl'

interface UseMatchResult {
  bundle: MatchBundle | null
  error: string | null
  refresh: () => void
  /** True when this browser may score the match. */
  canScore: boolean
  /** True once scoring rights have been worked out. */
  resolved: boolean
}

/**
 * Loads a match from Supabase and keeps it live. Each scorer's write updates
 * the single `matches` row; Realtime pushes that change to every open viewer,
 * so a shared link stays in sync without any polling. Viewers need no account.
 */
export function useMatch(matchId: string | null): UseMatchResult {
  const [bundle, setBundle] = useState<MatchBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const refreshRef = useRef<() => void>(() => {})
  const [canScore, setCanScore] = useState(false)
  const [resolved, setResolved] = useState(false)

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), [])
  refreshRef.current = refresh

  // Initial load + full refetch whenever an update is signalled.
  useEffect(() => {
    if (!matchId) return
    let alive = true
    api
      .getMatch(matchId)
      .then((b) => {
        if (alive) {
          setBundle(b)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiRequestError ? e.message : 'Failed to load match')
      })
    return () => {
      alive = false
    }
  }, [matchId, refreshToken])

  // Scoring rights: the browser that created the match may score it, everyone
  // else is a watcher. The database has the last word when another device has
  // taken over the match.
  useEffect(() => {
    if (!matchId) {
      setCanScore(false)
      setResolved(false)
      return
    }
    let alive = true
    setResolved(false)
    resolveScorerStatus(matchId)
      .then((status) => {
        if (!alive) return
        setCanScore(status.canScore)
        setResolved(true)
      })
      .catch(() => {
        if (!alive) return
        setCanScore(ownsMatchLocally(matchId))
        setResolved(true)
      })
    return () => {
      alive = false
    }
  }, [matchId])

  // Realtime subscription: any UPDATE to this row triggers a refetch.
  useEffect(() => {
    if (!matchId) return
    let client: SupabaseClient
    try {
      client = getSupabase()
    } catch {
      return
    }
    const channel = client
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => refreshRef.current(),
      )
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [matchId])

  return { bundle, error, refresh, canScore, resolved }
}
