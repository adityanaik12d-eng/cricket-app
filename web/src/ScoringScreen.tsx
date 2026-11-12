import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { CommentaryLine, DeliveryCelebration, Dismissal, LiveScore, MatchState, BallEvent } from '@cricket-app/core'
import { editDeliveryFromLog } from '@cricket-app/core'
import { api, ApiRequestError } from './api'
import { useMatch } from './useMatch'
import { clearToken } from './token'
import { MatchReport } from './MatchReport'
import { ScorecardView } from './ScorecardView'
import { MatchResultScreen } from './MatchResultScreen'
import { EXTRA_GROUPS, buildBallPayload, celebrationForDelivery, extrasForGroup, formatBowlerFigures, formatWin, isScoringShot, parseOvers, playerName, requiresFielder, resolvePositions } from './scoring'
import type { BallKind, ExtraKind, ExtraOption } from './scoring'
import { ExtrasSheet } from './ExtrasSheet'
import { matchShareUrl } from './share'
import { getSupabase } from './supabase'
import { Celebration } from './ui/Celebration'
import { ThemeToggle } from './ui/ThemeToggle'
import { OverTimeline } from './ui/OverTimeline'
import { StickyScore } from './ui/StickyScore'
import { ShotPicker } from './ui/ShotPicker'
import { WagonWheel } from './ui/WagonWheel'
import { Beehive } from './ui/Beehive'
import { WatcherView } from './ui/WatcherView'
import { SettingsScreen } from './SettingsScreen'
import { PressureChart } from './ui/PressureChart'

const DISMISSALS: Dismissal[] = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'RUN_OUT',
  'STUMPED',
  'HIT_WICKET',
  'OBSTRUCTING_THE_FIELD',
]

function dismissalLabel(d: Dismissal): string {
  return d === 'HIT_WICKET' ? 'Hit wicket' : d === 'OBSTRUCTING_THE_FIELD' ? 'Obstructing the field' : d.replace('_', ' ')
}

const BATTING_STATUSES = new Set(['IN_PROGRESS', 'INNINGS_BREAK', 'SUPER_OVER'])

// The charts are the heaviest view, so they load only when the tab is opened.
const MatchCharts = lazy(() => import('./ui/charts/MatchCharts').then((m) => ({ default: m.MatchCharts })))

interface Props {
  matchId: string
  onLeave: () => void
  initialTab?: 'scoring' | 'report' | 'scorecard' | 'wheel' | 'charts' | 'settings'
}

type Tab = 'scoring' | 'watch' | 'report' | 'scorecard' | 'wheel' | 'charts' | 'settings'
type WheelView = 'wheel' | 'beehive'

export function ScoringScreen({ matchId, onLeave, initialTab = 'scoring' }: Props) {
  const { bundle, error, refresh, canScore, resolved } = useMatch(matchId)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [strikerPick, setStrikerPick] = useState('')
  const [nonStrikerPick, setNonStrikerPick] = useState('')
  const [bowlerPick, setBowlerPick] = useState('')
  const [wicketMode, setWicketMode] = useState(false)
  const [selectedDismissal, setSelectedDismissal] = useState<Dismissal | null>(null)
  const [fielderPick, setFielderPick] = useState('')
  const [padError, setPadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [commentary, setCommentary] = useState<CommentaryLine[]>([])
  const [copied, setCopied] = useState(false)
  const [extraKind, setExtraKind] = useState<ExtraKind | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [undone, setUndone] = useState(false)
  const [celebration, setCelebration] = useState<DeliveryCelebration | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [showMatchStartModal, setShowMatchStartModal] = useState(false)
  const [inningsStartConfirmed, setInningsStartConfirmed] = useState(false)
  const [showNextBatsmanModal, setShowNextBatsmanModal] = useState(false)
  const [dismissedPlayerId, setDismissedPlayerId] = useState<string | null>(null)
  const [showNextBowlerModal, setShowNextBowlerModal] = useState(false)
  const [showSuperOverTeamSelectModal, setShowSuperOverTeamSelectModal] = useState(false)
  const [superOverAcknowledged, setSuperOverAcknowledged] = useState<Set<number>>(new Set())
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTargetSeq, setEditTargetSeq] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{
    kind: BallKind
    runs: number
    dismissal?: Dismissal
    fielderId?: string
  } | null>(null)
  const prevOverBallRef = useRef<{ over: number; ball: number } | null>(null)

  // Sync tab state with initialTab prop (e.g. when hash changes via external navigation)
  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  // Track signed-in state.
  useEffect(() => {
    let alive = true
    const supabase = getSupabase()
    const check = async (): Promise<void> => {
      try {
        const { data } = await supabase.auth.getUser()
        if (alive) setSignedIn(Boolean(data.user))
      } catch {
        if (alive) setSignedIn(false)
      }
    }
    void check()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setSignedIn(Boolean(session?.user))
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut(): Promise<void> {
    try {
      await api.signOut()
      clearToken()
      onLeave()
    } catch {
      // Even if signOut fails remotely, clear local state
      clearToken()
      onLeave()
    }
  }

  function handleEditBall(seq: number): void {
    // Find the ball event to pre-fill the form
    const events = bundle?.events ?? []
    const ballEvent = events.find((e): e is BallEvent => e.type === 'BALL' && e.seq === seq)
    if (!ballEvent) return

    // Determine the kind based on the event
    let kind: BallKind = 'RUNS'
    if (ballEvent.extras === 'WIDE') kind = 'WIDE'
    else if (ballEvent.extras === 'NO_BALL') kind = 'NO_BALL'
    else if (ballEvent.extras === 'BYE') kind = 'BYE'
    else if (ballEvent.extras === 'LEG_BYE') kind = 'LEG_BYE'
    else if (ballEvent.wicket) kind = 'WICKET'

    // Pre-fill the form with current values
    const editFormData: { kind: BallKind; runs: number; dismissal?: Dismissal; fielderId?: string } = {
      kind,
      runs: ballEvent.runs,
    }
    if (ballEvent.dismissal) editFormData.dismissal = ballEvent.dismissal
    if (ballEvent.fielderId) editFormData.fielderId = ballEvent.fielderId
    setEditForm(editFormData)
    setEditTargetSeq(seq)
    setShowEditModal(true)
  }

  async function handleSaveEdit(): Promise<void> {
    if (!state || !bundle || editTargetSeq === null || !editForm) return

    try {
      setBusy(true)
      // Build the new ball payload
      const newBall: Omit<BallEvent, 'id' | 'matchId' | 'seq' | 'ts' | 'type'> = {
        over: 0, // Will be determined from the original event
        ball: 0,
        runs: editForm.runs,
        extras: editForm.kind === 'WIDE' ? 'WIDE'
          : editForm.kind === 'NO_BALL' ? 'NO_BALL'
          : editForm.kind === 'BYE' ? 'BYE'
          : editForm.kind === 'LEG_BYE' ? 'LEG_BYE'
          : 'NONE',
        wicket: editForm.kind === 'WICKET',
        dismissal: editForm.kind === 'WICKET' ? (editForm.dismissal ?? null) : null,
        dismissedPlayerId: editForm.kind === 'WICKET' ? '' : null, // Will be filled from original event
        batterId: '', // Will be filled from original event
        nonStrikerId: null,
        bowlerId: '', // Will be filled from original event
        fieldingCaptainId: '', // Will be filled from original event
        ...(editForm.fielderId ? { fielderId: editForm.fielderId } : {}),
      }

      // Get the original event to fill in the missing fields
      const originalEvent = bundle.events.find((e): e is BallEvent => e.type === 'BALL' && e.seq === editTargetSeq)
      if (originalEvent) {
        newBall.over = originalEvent.over
        newBall.ball = originalEvent.ball
        newBall.dismissedPlayerId = originalEvent.dismissedPlayerId
        newBall.batterId = originalEvent.batterId
        newBall.nonStrikerId = originalEvent.nonStrikerId
        newBall.bowlerId = originalEvent.bowlerId
        newBall.fieldingCaptainId = originalEvent.fieldingCaptainId
      }

      // Create correction event (following editDeliveryFromLog pattern)
      const lastSeq = Math.max(...bundle.events.map(e => e.seq), 0)
      const correction: CorrectionEvent = {
        id: crypto.randomUUID(),
        matchId: state.config.matchId,
        seq: lastSeq + 1,
        ts: new Date().toISOString(),
        type: 'CORRECTION',
        supersedes: originalEvent!.id,
        replacement: { kind: 'BALL', ball: newBall },
        reason: 'Manual edit via scorecard',
      }

      // Build new events array with correction
      const newEvents = [...bundle.events, correction]

      // Update the match state via API
      await api.putMatchState(matchId, newEvents)

      // Refresh the bundle
      await refresh()

      // Close modal
      setShowEditModal(false)
      setEditTargetSeq(null)
      setEditForm(null)
    } catch (err) {
      setPadError(err instanceof Error ? err.message : 'Failed to save edit')
    } finally {
      setBusy(false)
    }
  }

  const state = bundle?.state ?? null
  const live = bundle?.live ?? null
  // A watcher never sees the pad: the scoring tab becomes the watch view.
  const watching = resolved && !canScore
  const activeTab: Tab = watching && tab === 'scoring' ? 'watch' : tab
  const stickyRef = useRef<HTMLElement | null>(null)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [placementMode, setPlacementMode] = useState(false)
  const [pendingShot, setPendingShot] = useState<number | null>(null)
  const [wheelView, setWheelView] = useState<WheelView>('wheel')

  // New innings: forget the previous innings' opener/bowler picks.
  const inningsIndex = live?.inningsIndex ?? 0
  const [seenInnings, setSeenInnings] = useState(inningsIndex)

  // Handle innings change in useEffect to avoid setState during render
  useEffect(() => {
    if (inningsIndex !== seenInnings) {
      setSeenInnings(inningsIndex)
      setStrikerPick('')
      setNonStrikerPick('')
      setBowlerPick('')
      setSelectedDismissal(null)
      setFielderPick('')
      setExtraKind(null)
      setInningsStartConfirmed(false)
      // Only reset superOverAcknowledged if we're leaving the super over entirely
      // (i.e., the new innings is not a super over innings)
      const isSuperOverInnings = live?.status === 'SUPER_OVER'
      if (!isSuperOverInnings) {
        setSuperOverAcknowledged(prev => new Set())
      }
    }
  }, [inningsIndex, seenInnings, live?.status])

  const teamIds = useMemo(() => {
    if (!state) return { batting: [] as string[], bowling: [] as string[] }
    const cfg = state.config
    const battingKey = live?.battingTeamId === cfg.teamBId ? 'B' : 'A'
    const bowlingKey = battingKey === 'A' ? 'B' : 'A'
    return { batting: cfg.lineups[battingKey], bowling: cfg.lineups[bowlingKey] }
  }, [state, live?.battingTeamId])

  // Calculate inningsNotStarted early for useEffect
  const inningsNotStarted = live?.striker == null || live?.nonStriker == null

  // Debug: log padEnabled conditions
  const positions = useMemo(() => {
    if (!live) {
      return {
        strikerId: strikerPick,
        nonStrikerId: nonStrikerPick,
        bowlerId: bowlerPick,
      }
    }
    return resolvePositions(live, {
      strikerId: strikerPick,
      nonStrikerId: nonStrikerPick,
      bowlerId: bowlerPick,
    })
  }, [live, strikerPick, nonStrikerPick, bowlerPick])

  const padEnabledDebug = live ? (
    BATTING_STATUSES.has(live.status) &&
    positions.strikerId !== '' &&
    positions.nonStrikerId !== '' &&
    positions.bowlerId !== '' &&
    !busy
  ) : false

  useEffect(() => {
    console.log('[DEBUG] padEnabled:', padEnabledDebug, {
      status: live?.status,
      battingStatuses: Array.from(BATTING_STATUSES),
      hasStatus: live ? BATTING_STATUSES.has(live.status) : false,
      strikerPick,
      nonStrikerPick,
      bowlerPick,
      positions,
      busy,
    })
  }, [padEnabledDebug, live?.status, strikerPick, nonStrikerPick, bowlerPick, positions, busy])

  // Show match start modal when innings hasn't started and match is in a batting status
  // but only if the user hasn't already confirmed the innings start
  useEffect(() => {
    if (inningsNotStarted && BATTING_STATUSES.has(live?.status) && !inningsStartConfirmed) {
      setShowMatchStartModal(true)
    } else {
      setShowMatchStartModal(false)
    }
  }, [inningsNotStarted, live?.status, inningsStartConfirmed])

  async function handleStartInnings(): Promise<void> {
    // Validate all three are selected
    if (!strikerPick || !nonStrikerPick || !bowlerPick) {
      setPadError('Please select striker, non-striker, and bowler')
      return
    }
    if (strikerPick === nonStrikerPick) {
      setPadError('Striker and non-striker must be different players')
      return
    }
    setShowMatchStartModal(false)
    setInningsStartConfirmed(true)
    setPadError(null)
  }

  function handleNextBatsman(batsmanId: string): void {
    // Determine if the dismissed player was striker or non-striker
    // and replace with the new batsman
    if (live?.striker?.playerId === dismissedPlayerId) {
      setStrikerPick(batsmanId)
    } else if (live?.nonStriker?.playerId === dismissedPlayerId) {
      setNonStrikerPick(batsmanId)
    }
    setShowNextBatsmanModal(false)
    setDismissedPlayerId(null)
  }

  function handleNextBowler(bowlerId: string): void {
    setBowlerPick(bowlerId)
    // Don't close modal yet - wait for "Start Next Over" click
  }

  function handleStartNextOver(): void {
    // Actually set the bowler and close modal - this "starts" the next over
    setShowNextBowlerModal(false)
  }

  // Commentary is only shown on the scorecard tab; fetch it on demand and
  // refresh whenever a new event lands (eventCount changes) while it's open.
  const eventCount = bundle?.state.eventCount ?? 0
  useEffect(() => {
    if (activeTab === 'scoring') return
    let alive = true
    api
      .getCommentary(matchId)
      .then((r) => {
        if (alive) setCommentary(r.commentary)
      })
      .catch(() => {
        if (alive) setCommentary([])
      })
    return () => {
      alive = false
    }
  }, [activeTab, matchId, eventCount])

  // Reset the "Copied" label a moment after the link is copied.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  // Detect over completion and show next bowler modal
  useEffect(() => {
    if (!live || live.status !== 'IN_PROGRESS') return
    const { over, ball } = parseOvers(live.oversText)
    const prev = prevOverBallRef.current
    if (prev !== null) {
      // Over completed: over has incremented and we're at ball 0 of the new over
      // This detects the transition from the last ball of previous over (ball 5) to first ball of new over (ball 0)
      if (over > prev.over && ball === 0) {
        // Over completed, always show next bowler modal (a bowler cannot bowl consecutive overs)
        setShowNextBowlerModal(true)
      }
    }
    // Update ref with current over/ball for next comparison
    prevOverBallRef.current = { over, ball }
  }, [live?.oversText, live?.status])

  // Slide the compact score bar in once the full live card scrolls off the top.
  useEffect(() => {
    if (activeTab !== 'scoring' && activeTab !== 'watch') return
    const el = stickyRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setStickyVisible(!entry.isIntersecting && el.getBoundingClientRect().top < 0)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      setStickyVisible(false)
    }
  }, [activeTab])

  // Show superover team select modal when match enters superover and first innings hasn't started
  // Only show for the FIRST super over innings (index === config.inningsCount) and only if that innings hasn't started yet
  useEffect(() => {
    if (!bundle || !state || !live) return
    const isSuperOverActive = state.status === 'SUPER_OVER' && state.superOverState?.active
    const firstSuperOverInnings = state.innings[state.config.inningsCount]
    // Check if first super over innings exists and hasn't started (0 runs, 0 wickets, no striker)
    const firstInningsNotStarted = firstSuperOverInnings
      && firstSuperOverInnings.runs === 0
      && firstSuperOverInnings.wickets === 0
      && !firstSuperOverInnings.strikerId
    const superOverFirstInningsNotStarted = isSuperOverActive && firstInningsNotStarted
    const isAcknowledged = superOverAcknowledged.has('first-super-over')
    if (superOverFirstInningsNotStarted && state.config.superOverEnabled && !showSuperOverTeamSelectModal && !isAcknowledged) {
      setShowSuperOverTeamSelectModal(true)
    }
  }, [bundle?.result, state?.config?.superOverEnabled, state?.config?.inningsCount, state?.status, state?.superOverState?.active, state?.innings, showSuperOverTeamSelectModal, superOverAcknowledged])

  async function share(): Promise<void> {
    const url = matchShareUrl(matchId, window.location.origin)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard can be unavailable (insecure context, denied permission).
      window.prompt('Copy this match link to share it:', url)
    }
  }

  // Reset the "Undone" label a moment after the log is rewound.
  useEffect(() => {
    if (!undone) return
    const timer = setTimeout(() => setUndone(false), 2000)
    return () => clearTimeout(timer)
  }, [undone])

  async function undo(): Promise<void> {
    setPadError(null)
    setUndoing(true)
    try {
      await api.undoLast(matchId)
      void refresh()
      setUndone(true)
    } catch (e) {
      if (e instanceof ApiRequestError) setPadError(e.message)
      else setPadError(e instanceof Error ? e.message : 'Could not undo the last ball')
    } finally {
      setUndoing(false)
    }
  }

  function handleHome(): void {
    onLeave()
  }

  // When match completes, replace history entry so browser back goes to home
  useEffect(() => {
    if (!live || !state) return
    const completedStatuses = new Set(['COMPLETED', 'TIED', 'ABANDONED', 'SUPER_OVER_WINNER'])
    if (completedStatuses.has(live.status)) {
      // Replace current history entry with report tab URL
      // This ensures browser back from report tab goes to home, not scoring tab
      const reportUrl = `#/match/${matchId}/report`
      if (window.location.hash !== reportUrl) {
        history.replaceState(null, '', reportUrl)
      }
      // Also set the active tab to report so user sees the result immediately
      if (tab !== 'report') {
        setTab('report')
      }
    }
  }, [live?.status, matchId])

  // Handle home navigation from result screen
  if (!bundle || !state || !live || !resolved) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
            <button className="btn ghost" onClick={onLeave}>
              ← Home
            </button>
          </div>
        </header>
        <main className="card">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</main>
      </div>
    )
  }

  // The toss always stays, so anything past it can be rewound.
  const canUndo = state.eventCount > 1 && !busy
  const padEnabled =
    BATTING_STATUSES.has(live.status) &&
    positions.strikerId !== '' &&
    positions.nonStrikerId !== '' &&
    positions.bowlerId !== '' &&
    !busy

  async function submitBall(kind: BallKind, runs: number, dismissal?: Dismissal, fielderId?: string): Promise<boolean> {
    if (!live || !state) return false
    setPadError(null)
    setBusy(true)
    try {
      const { over, ball } = parseOvers(live.oversText)
      const payload = buildBallPayload({
        kind,
        runs,
        ...(dismissal ? { dismissal } : {}),
        ...(fielderId ? { fielderId } : {}),
        positions,
        over,
        ball,
      })
      console.log('[DEBUG] submitBall: posting wicket', { dismissal, positions, over, ball })
      const posted = await api.postEvent(matchId, payload)
      console.log('[DEBUG] submitBall: posted', { posted, live: posted.live })
      // The celebration follows the score the delivery actually produced.
      const earned = celebrationForDelivery(posted.live, payload, state.config)
      if (earned) setCelebration(earned)
      if (placementMode && isScoringShot(kind, runs)) setPendingShot(posted.seq)
      setWicketMode(false)
      setSelectedDismissal(null)
      setFielderPick('')
      // If a wicket fell, check if innings has ended before showing next batsman modal
      if (dismissal) {
        console.log('[DEBUG] submitBall: setting dismissedPlayerId', positions.strikerId)
        const liveAfterWicket = posted.live
        const isSuperOver = liveAfterWicket.status === 'SUPER_OVER'
        const maxWicketsForInnings = isSuperOver
          ? (state.config.superOverMaxWickets ?? 2)
          : state.config.maxWickets
        const inningsEnded = liveAfterWicket.wickets >= maxWicketsForInnings

        if (!inningsEnded) {
          console.log('[DEBUG] submitBall: setting dismissedPlayerId', positions.strikerId)
          setDismissedPlayerId(positions.strikerId)
          setShowNextBatsmanModal(true)
        }
        // If innings ended, don't show next batsman modal - innings will close automatically
      }
      return true
    } catch (e) {
      console.error('[DEBUG] submitBall error:', e)
      if (e instanceof ApiRequestError) setPadError(e.message)
      else setPadError(e instanceof Error ? e.message : 'Failed to record ball')
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Saves the optional shot placement against an already-recorded delivery. */
  async function recordPlacement(seq: number, angle: number, distance: number): Promise<void> {
    setBusy(true)
    setPadError(null)
    try {
      await api.patchEventShot(matchId, seq, { shotAngle: angle, shotDistance: distance })
      setPendingShot(null)
      void refresh()
    } catch (e) {
      setPadError(e instanceof ApiRequestError ? e.message : e instanceof Error ? e.message : 'Failed to save placement')
      setPendingShot(null)
    } finally {
      setBusy(false)
    }
  }

  // Extras live behind a sheet: pick a variant, and only close it once the
  // delivery is actually recorded, so a rejected ball keeps the sheet open.
  async function pickExtra(option: ExtraOption): Promise<void> {
    if (await submitBall(option.kind, option.runs)) setExtraKind(null)
  }

  function selectDismissal(d: Dismissal): void {
    setSelectedDismissal(d)
    setFielderPick(d === 'STUMPED' || d === 'OBSTRUCTING_THE_FIELD' ? (teamIds.bowling[0] ?? '') : '')
  }

  function cancelWicket(): void {
    setWicketMode(false)
    setSelectedDismissal(null)
    setFielderPick('')
  }

  function startWicket(): void {
    setSelectedDismissal(null)
    setFielderPick('')
    setWicketMode(true)
  }

  const resultText =
    bundle.result?.kind === 'WINNER'
      ? formatWin(bundle.result)
      : bundle.result?.kind === 'TIE'
        ? 'Match tied'
        : bundle.result?.kind === 'SUPER_OVER_WINNER'
          ? formatWin(bundle.result)
          : bundle.result?.kind === 'ABANDONED'
            ? `Match abandoned${bundle.result.reason ? `: ${bundle.result.reason}` : ''}`
            : null


  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>
            {state.config.teamAId} vs {state.config.teamBId}
          </h1>
          <p className="muted">
            {state.config.oversPerInnings} overs · {live.status.replace('_', ' ').toLowerCase()}
          </p>
        </div>
        <div className="topbar-actions">
          <button className={copied ? 'btn accent' : 'btn ghost'} onClick={() => void share()}>
            {copied ? '✓ Link copied' : 'Share'}
          </button>
          {canScore && (
            <button
              className={undone ? 'btn accent' : 'btn ghost'}
              disabled={!canUndo || undoing}
              onClick={() => void undo()}
            >
              {undone ? '✓ Undone' : '↶ Undo'}
            </button>
          )}
          <ThemeToggle />
          {signedIn && (
            <button className="btn ghost" onClick={handleSignOut}>
              Sign out
            </button>
          )}
          <button className="btn ghost" onClick={onLeave}>
            ← Home
          </button>
        </div>
      </header>

      {!bundle.result || state.status !== 'COMPLETED' && state.status !== 'TIED' && state.status !== 'ABANDONED' ? (
        <>
        <div className="paper-tabs match-tabs" role="tablist" aria-label="Match views">
          {watching ? (
            <button role="tab" className={activeTab === 'watch' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setTab('watch')}>
              Watch
            </button>
          ) : (
            <button role="tab" className={activeTab === 'scoring' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setTab('scoring')}>
              Scoring
            </button>
          )}
          <button role="tab" className={activeTab === 'report' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setTab('report')}>
            Report
          </button>
          <button role="tab" className={activeTab === 'scorecard' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setTab('scorecard')}>
            Scorecard
          </button>
          <button role="tab" className={activeTab === 'wheel' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setTab('wheel')}>
            Wheel
          </button>
          <button role="tab" className={activeTab === 'charts' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setTab('charts')}>
            Charts
          </button>
          {signedIn && (
            <button role="tab" className={activeTab === 'settings' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setTab('settings')}>
              Settings
            </button>
          )}
        </div>

        {activeTab === 'scoring' ? (
        <>
          <section className="card live-card" ref={stickyRef}>
            <div className="score-line">
              <span className="score">
                {live.runs}-{live.wickets}
              </span>
              <span className="overs">({live.oversText} ov)</span>
            </div>
            <div className="live-meta">
              <span>CRR {live.runRate.toFixed(2)}</span>
              {live.target != null && live.status === 'SUPER_OVER' && (
                <span className="super-over-target">
                  Super Over Target: {live.target} · {live.battingTeamId} need {Math.max(0, live.target - live.runs)} off {live.ballsRemaining} balls
                  {live.requiredRunRate != null && ` · RRR ${live.requiredRunRate.toFixed(2)}`}
                </span>
              )}
              {live.target != null && live.status !== 'SUPER_OVER' && (
                <span>
                  Target {live.target} · need {Math.max(0, live.target - live.runs)} off {live.ballsRemaining}
                  {live.requiredRunRate != null && ` · RRR ${live.requiredRunRate.toFixed(2)}`}
                </span>
              )}
            </div>
            <div className="players">
              <div className="player">
                <span className="muted">Strike</span>
                <strong>{live.striker ? playerName(state.config, live.striker.playerId) : '—'}</strong>
                <span className="player-runs">
                  {live.striker ? `${live.striker.runs} (${live.striker.balls})` : ''}
                </span>
              </div>
              <div className="player">
                <span className="muted">Non-strike</span>
                <strong>{live.nonStriker ? playerName(state.config, live.nonStriker.playerId) : '—'}</strong>
                <span className="player-runs">
                  {live.nonStriker ? `${live.nonStriker.runs} (${live.nonStriker.balls})` : ''}
                </span>
              </div>
              <div className="player">
                <span className="muted">Bowler</span>
                <strong>{playerName(state.config, live.bowler?.playerId ?? bowlerPick) || '—'}</strong>
                <span className="player-runs">
                  {live.bowler
                    ? `${formatBowlerFigures(live.bowler.balls, live.bowler.runs, live.bowler.wickets)}`
                    : ''}
                </span>
              </div>
            </div>
          </section>

          <section className="card over-ribbon" aria-label="Over by over">
            <div className="over-label">Current Over</div>
            <div className="over-balls">
              {(() => {
                const events = bundle.events.filter((e): e is BallEvent => e.type === 'BALL' && e.over === live.over);
                if (events.length === 0) {
                  return <span className="muted">No balls in this over yet</span>;
                }
                return events.map((e, idx) => {
                  let className = 'ball-mark';
                  if (e.extras === 'WIDE') className += ' wide';
                  else if (e.extras === 'NO_BALL') className += ' noball';
                  else if (e.extras === 'BYE') className += ' bye';
                  else if (e.extras === 'LEG_BYE') className += ' legbye';
                  else if (e.wicket) className += ' wicket';
                  else if (e.runs === 4) className += ' run-4';
                  else if (e.runs === 6) className += ' run-6';
                  else if (e.runs > 0) className += ` run-${e.runs}`;
                  else className += ' dot';
                  return <span key={e.seq} className={className}>{e.runs === 0 ? '●' : e.runs}</span>;
                });
              })()}
            </div>
          </section>

          {/* Match Tide - Pressure Indicator */}
          <section className="card match-tide" aria-label="Match pressure">
            <div className="tide-label pressure">Pressure</div>
            <div className="tide-label calm">Calm</div>
            <div className="tide-watermark">TIDE</div>
            <PressureChart live={live} events={bundle.events} />
          </section>

          <section className="scoring-pad">
            <button
              type="button"
              className={`btn ${placementMode ? 'accent' : 'ghost'} placement-toggle`}
              aria-pressed={placementMode}
              onClick={() => setPlacementMode((value) => !value)}
            >
              {placementMode ? 'Placement on' : 'Record placement'}
            </button>

            {(live.bowler == null || inningsNotStarted) && (
              <label className="form-field">
                <span className="form-label">Bowler</span>
                <select
                  value={bowlerPick}
                  onChange={(e) => setBowlerPick(e.target.value)}
                  disabled={live.bowler != null}
                >
                  <option value="">Select…</option>
                  {teamIds.bowling.map((p) => (
                    <option key={p} value={p}>
                      {playerName(state.config, p)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!wicketMode ? (
              <>
                <div className="pad-grid">
                  {[0, 1, 2, 3, 4, 6].map((r) => (
                    <button
                      key={r}
                      className={`pad-btn ${r === 4 || r === 6 ? 'highlight' : ''}`}
                      disabled={!padEnabled}
                      onClick={() => void submitBall('RUNS', r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="extras-row">
                  {EXTRA_GROUPS.map((group) => (
                    <button
                      key={group.kind}
                      className="extras-btn"
                      disabled={!padEnabled}
                      onClick={() => setExtraKind(group.kind)}
                    >
                      {group.label}
                    </button>
                  ))}
                  <button className="pad-btn wicket-btn btn-hold" disabled={!padEnabled} onClick={startWicket}>
                    W
                  </button>
                </div>
              </>
            ) : (
              <>
                {selectedDismissal ? (
                  <>
                    <p className="muted">Selected: {selectedDismissal.replace('_', ' ')}</p>
                    {requiresFielder(selectedDismissal) && (
                      <>
                        <p className="muted">Fielder</p>
                        <select
                          value={fielderPick}
                          disabled={busy}
                          onChange={(e) => setFielderPick(e.target.value)}
                        >
                          <option value="">Select fielder</option>
                          {teamIds.bowling.map((p) => (
                            <option key={p} value={p}>
                              {playerName(state.config, p)}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <button
                      className="pad-btn"
                      onClick={() => submitBall('WICKET', 0, selectedDismissal, fielderPick)}
                      disabled={busy || (requiresFielder(selectedDismissal) && !fielderPick)}
                    >
                      Submit
                    </button>
                    <button className="btn ghost" onClick={cancelWicket}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="pad-grid dismissals">
                      {DISMISSALS.map((d) => (
                        <button
                          key={d}
                          className="pad-btn"
                          disabled={busy}
                          onClick={() => void selectDismissal(d)}
                        >
                          {dismissalLabel(d)}
                        </button>
                      ))}
                    </div>
                    <button className="btn ghost" onClick={cancelWicket}>
                      Cancel
                    </button>
                  </>
                )}
              </>
            )}

            {padError && <p className="error">{padError}</p>}
          </section>

          {pendingShot !== null && (
            <ShotPicker
              busy={busy}
              onSkip={() => setPendingShot(null)}
              onPick={(angle, distance) => void recordPlacement(pendingShot, angle, distance)}
            />
          )}

          {extraKind && (
            <ExtrasSheet
              label={extrasForGroup(extraKind).label}
              options={extrasForGroup(extraKind).options}
              busy={busy}
              error={padError}
              onPick={(option) => void pickExtra(option)}
              onClose={() => setExtraKind(null)}
            />
          )}
        </>
      ) : activeTab === 'watch' ? (
        <WatcherView
          config={state.config}
          live={live}
          events={bundle.events}
          commentary={commentary}
          heroRef={stickyRef}
        />
      ) : activeTab === 'report' ? (
        <MatchReport bundle={bundle} commentary={commentary} />
      ) : activeTab === 'scorecard' ? (
        <ScorecardView bundle={bundle} commentary={commentary} events={bundle.events} />
      ) : activeTab === 'wheel' ? (
        <>
          <div className="wheel-view-toggle" role="group" aria-label="Wheel view">
            <button
              type="button"
              className={wheelView === 'wheel' ? 'toggle-btn active' : 'toggle-btn'}
              aria-pressed={wheelView === 'wheel'}
              onClick={() => setWheelView('wheel')}
            >
              Wheel
            </button>
            <button
              type="button"
              className={wheelView === 'beehive' ? 'toggle-btn active' : 'toggle-btn'}
              aria-pressed={wheelView === 'beehive'}
              onClick={() => setWheelView('beehive')}
            >
              Beehive
            </button>
          </div>
          {wheelView === 'wheel' ? <WagonWheel config={state.config} events={bundle.events} /> : <Beehive events={bundle.events} />}
        </>
      ) : activeTab === 'charts' ? (
        <Suspense fallback={<p className="muted chart-empty">Loading charts…</p>}>
          <MatchCharts config={state.config} events={bundle.events} />
        </Suspense>
      ) : activeTab === 'settings' ? (
        <SettingsScreen onBack={() => setTab('scoring')} />
      ) : (
        <Suspense fallback={<p className="muted chart-empty">Loading charts…</p>}>
          <MatchCharts config={state.config} events={bundle.events} />
        </Suspense>
      )}
    </>
  ) : null}

      {celebration && <Celebration celebration={celebration} onDone={() => setCelebration(null)} />}

      {(activeTab === 'scoring' || activeTab === 'watch') && <StickyScore live={live} visible={stickyVisible} />}

      {showMatchStartModal && (
        <div className="modal-overlay" onClick={() => setShowMatchStartModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Start Innings</h2>
            <p className="muted">Select the opening batters and bowler.</p>
            <div className="modal-fields">
              <label>
                Striker
                <select value={strikerPick} onChange={(e) => setStrikerPick(e.target.value)}>
                  <option value="">Select…</option>
                  {teamIds.batting
                    .filter((p) => p !== nonStrikerPick)
                    .map((p) => (
                      <option key={p} value={p}>
                        {playerName(state.config, p)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Non-striker
                <select value={nonStrikerPick} onChange={(e) => setNonStrikerPick(e.target.value)}>
                  <option value="">Select…</option>
                  {teamIds.batting
                    .filter((p) => p !== strikerPick)
                    .map((p) => (
                      <option key={p} value={p}>
                        {playerName(state.config, p)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Bowler
                <select value={bowlerPick} onChange={(e) => setBowlerPick(e.target.value)}>
                  <option value="">Select…</option>
                  {teamIds.bowling.map((p) => (
                    <option key={p} value={p}>
                      {playerName(state.config, p)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {padError && <p className="error">{padError}</p>}
            <div className="modal-actions">
              <button className="btn accent" onClick={handleStartInnings} disabled={busy}>
                Start Innings
              </button>
            </div>
          </div>
        </div>
      )}

      {showNextBatsmanModal && dismissedPlayerId && (
        <div className="modal-overlay" onClick={() => setShowNextBatsmanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Next Batsman</h2>
            <p className="muted">
              {live?.striker?.playerId === dismissedPlayerId
                ? 'Select the new striker'
                : 'Select the new non-striker'}
            </p>
            <div className="modal-fields">
              <label>
                Batsman
                <select
                  value={strikerPick}
                  onChange={(e) => handleNextBatsman(e.target.value)}
                >
                  <option value="">Select…</option>
                  {teamIds.batting
                    .filter((p) => !live?.batters?.[p]?.out && p !== dismissedPlayerId)
                    .filter((p) => p !== (live?.striker?.playerId === dismissedPlayerId ? live?.nonStriker?.playerId : live?.striker?.playerId))
                    .map((p) => (
                      <option key={p} value={p}>
                        {playerName(state.config, p)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {padError && <p className="error">{padError}</p>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowNextBatsmanModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNextBowlerModal && (
        <div className="modal-overlay" onClick={() => setShowNextBowlerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Next Bowler</h2>
            <p className="muted">Select the bowler for the next over.</p>
            <div className="modal-fields">
              <label>
                Bowler
                <select
                  value={bowlerPick}
                  onChange={(e) => handleNextBowler(e.target.value)}
                >
                  <option value="">Select…</option>
                  {teamIds.bowling
                    .filter((p) => p !== live?.lastOverBowlerId)
                    .map((p) => (
                      <option key={p} value={p}>
                        {playerName(state.config, p)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {padError && <p className="error">{padError}</p>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowNextBowlerModal(false)}>
                Cancel
              </button>
              {bowlerPick && (
                <button className="btn accent" onClick={handleStartNextOver}>
                  Start Next Over
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showSuperOverTeamSelectModal && (
        <div className="modal-overlay" onClick={() => setShowSuperOverTeamSelectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Superover</h2>
            <p className="muted">
              Match tied! {state.superOverState?.firstBattingTeamId
                ? `${state.superOverState.firstBattingTeamId} will bat first in the superover.`
                : 'A superover will be played to decide the winner.'}
            </p>
            {padError && <p className="error">{padError}</p>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowSuperOverTeamSelectModal(false)}>
                Cancel
              </button>
              <button className="btn accent" onClick={() => { setShowSuperOverTeamSelectModal(false); setSuperOverAcknowledged(prev => new Set(prev).add('first-super-over')); }}>
                Start Superover
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editTargetSeq !== null && editForm && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditTargetSeq(null); setEditForm(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Delivery</h2>
            <p className="muted">Editing delivery #{editTargetSeq}</p>

            <div className="form-group">
              <label>Type</label>
              <select
                value={editForm.kind}
                onChange={(e) => setEditForm({ ...editForm, kind: e.target.value as BallKind })}
                disabled={busy}
              >
                <option value="RUNS">Runs</option>
                <option value="WIDE">Wide</option>
                <option value="NO_BALL">No Ball</option>
                <option value="BYE">Bye</option>
                <option value="LEG_BYE">Leg Bye</option>
                <option value="WICKET">Wicket</option>
              </select>
            </div>

            <div className="form-group">
              <label>Runs</label>
              <input
                type="number"
                min="0"
                max="6"
                value={editForm.runs}
                onChange={(e) => setEditForm({ ...editForm, runs: Number(e.target.value) })}
                disabled={busy}
              />
            </div>

            {editForm.kind === 'WICKET' && (
              <>
                <div className="form-group">
                  <label>Dismissal</label>
                  <select
                    value={editForm.dismissal ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, dismissal: e.target.value as Dismissal || undefined })}
                    disabled={busy}
                  >
                    <option value="">Select dismissal</option>
                    {DISMISSALS.map((d) => (
                      <option key={d} value={d}>{dismissalLabel(d)}</option>
                    ))}
                  </select>
                </div>

                {editForm.dismissal && requiresFielder(editForm.dismissal) && (
                  <div className="form-group">
                    <label>Fielder</label>
                    <select
                      value={editForm.fielderId ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, fielderId: e.target.value || undefined })}
                      disabled={busy}
                    >
                      <option value="">Select fielder</option>
                      {teamIds.bowling.map((p) => (
                        <option key={p} value={p}>{playerName(state.config, p)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {padError && <p className="error">{padError}</p>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => { setShowEditModal(false); setEditTargetSeq(null); setEditForm(null); }}>
                Cancel
              </button>
              <button className="btn accent" onClick={handleSaveEdit} disabled={busy}>
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bundle?.result && (state.status === 'COMPLETED' || state.status === 'TIED' || state.status === 'ABANDONED' || state.status === 'SUPER_OVER_WINNER') && (
        <MatchResultScreen
          config={state.config}
          scorecard={bundle.scorecard}
          result={bundle.result}
          events={bundle.events}
          onHome={handleHome}
        />
      )}
    </div>
  )
}
