import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveScore } from '@cricket-app/core'
import { api, ApiRequestError } from './api'
import type { MatchBundle } from './api'

interface UseMatchResult {
  bundle: MatchBundle | null
  error: string | null
  refresh: () => void
}

/**
 * Loads a match bundle and keeps it live: SSE pushes the new score instantly,
 * then the full bundle (state + scorecard) is refetched so every view stays in
 * sync after each event.
 */
export function useMatch(matchId: string | null): UseMatchResult {
  const [bundle, setBundle] = useState<MatchBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const refreshRef = useRef<() => void>(() => {})

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), [])
  refreshRef.current = refresh

  // Initial load + full refetch whenever refresh is requested.
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

  // SSE subscription: snappy live updates + a bundle refresh per event.
  useEffect(() => {
    if (!matchId) return
    const es = new EventSource(`/matches/${matchId}/stream`)
    es.addEventListener('live', (ev) => {
      try {
        const live = JSON.parse((ev as MessageEvent<string>).data) as LiveScore
        setBundle((prev) => (prev ? { ...prev, live } : prev))
      } catch {
        // malformed frame: fall through to the refetch below
      }
      refreshRef.current()
    })
    es.onerror = () => {
      // EventSource retries automatically; keep the last known state.
    }
    return () => es.close()
  }, [matchId])

  return { bundle, error, refresh }
}
