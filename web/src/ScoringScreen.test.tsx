import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScoringScreen } from './ScoringScreen'
import { buildConfig, computeBundle, buildEvent } from './match'
import type { MatchEvent } from '@cricket-app/core'

// Mock the useMatch hook to return a valid bundle after toss
vi.mock('./useMatch', () => ({
  useMatch: vi.fn(),
}))

import { useMatch } from './useMatch'

const mockOnLeave = vi.fn()

const baseConfig = buildConfig(
  {
    teamAId: 'India',
    teamBId: 'Australia',
    lineups: { A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'] },
    oversPerInnings: 20,
    maxWickets: 10,
    powerplayOvers: 6,
  },
  'test-match',
)

const toss = buildEvent(
  'test-match',
  1,
  { type: 'TOSS', winnerTeamId: 'India', winnerDecision: 'BAT' },
  'e1',
  '2024-01-01T00:00:00Z',
)

const ball = (seq: number, runs: number): MatchEvent =>
  buildEvent(
    'test-match',
    seq,
    {
      type: 'BALL',
      over: 0,
      ball: seq - 2,
      runs,
      extras: 'NONE',
      wicket: false,
      dismissal: null,
      dismissedPlayerId: null,
      batterId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
      fieldingCaptainId: 'b1',
    },
    `e${seq}`,
    '2024-01-01T00:00:00Z',
  )

// Create a bundle with innings started (after toss, one ball bowled)
const eventsAfterToss = [toss, ball(2, 1)]
const bundleAfterToss = computeBundle('test-match', baseConfig, eventsAfterToss)

describe('ScoringScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMatch).mockReturnValue({
      bundle: bundleAfterToss,
      error: null,
      refresh: vi.fn(),
      canScore: true,
      resolved: true,
    })
  })

  it('renders without temporal dead zone error after toss', () => {
    // This test would have thrown "Cannot access 'ct' before initialization"
    // before the fix for the useEffect dependency array referencing isSingleBatter
    // before its declaration.
    const html = renderToStaticMarkup(
      <ScoringScreen matchId="test-match" onLeave={mockOnLeave} />,
    )

    // Verify key scoring UI elements are present
    // Note: With canScore=true, the "Watch" tab is hidden and "Scoring" tab is shown
    expect(html).toContain('India vs Australia')
    expect(html).toContain('20 overs')
    expect(html).toContain('Scoring')
    expect(html).toContain('Report')
  })

  it('renders live score with batters and bowler', () => {
    const html = renderToStaticMarkup(
      <ScoringScreen matchId="test-match" onLeave={mockOnLeave} />,
    )

    // Check that the live score shows runs/wickets
    expect(html).toContain('1-0')
    // Check that overs are shown in the live card
    expect(html).toContain('(0.1 ov)')
  })

  it('shows scoring pad when innings is in progress', () => {
    const html = renderToStaticMarkup(
      <ScoringScreen matchId="test-match" onLeave={mockOnLeave} />,
    )

    // Check key buttons exist in the scoring pad
    expect(html).toContain('Custom')
    expect(html).toContain('Wide')
    expect(html).toContain('No ball')
    expect(html).toContain('Bye')
    expect(html).toContain('Leg bye')
    expect(html).toContain('>W</button>') // Wicket button
  })
})