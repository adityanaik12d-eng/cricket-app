import { describe, expect, it } from 'vitest'
import { applyEvents, projectScorecard } from '@cricket-app/core'
import type { MatchEvent } from '@cricket-app/core'
import {
  MatchError,
  appendEvent,
  buildConfig,
  buildEvent,
  computeBundle,
  nextSeq,
  summarize,
  summarizeRows,
  withoutLastEvent,
} from './match'

function setupBody() {
  const ids = (prefix: string): string[] => Array.from({ length: 11 }, (_, i) => `${prefix}${i + 1}`)
  return {
    teamAId: 'india',
    teamBId: 'australia',
    lineups: { A: ids('a'), B: ids('b') },
    playerRefs: {},
    oversPerInnings: 2,
    powerplayOvers: 1,
  }
}

const NOW = '2020-01-01T00:00:00.000Z'

describe('buildConfig', () => {
  it('fills engine defaults and sets the match id', () => {
    const config = buildConfig(setupBody(), 'm1')
    expect(config.matchId).toBe('m1')
    expect(config.ballsPerOver).toBe(6)
    expect(config.maxWickets).toBe(10)
    expect(config.inningsCount).toBe(2)
    expect(config.oversPerInnings).toBe(2)
  })

  it('rejects an invalid match with a MatchError', () => {
    const body = { ...setupBody(), teamBId: 'india' }
    expect(() => buildConfig(body, 'm1')).toThrow(MatchError)
    try {
      buildConfig(body, 'm1')
    } catch (err) {
      expect((err as MatchError).code).toBe('INVALID_FORMAT')
    }
  })
})

describe('nextSeq', () => {
  it('starts at 1', () => {
    expect(nextSeq([])).toBe(1)
  })

  it('continues after the last event', () => {
    const event = buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }, 'e1', NOW)
    expect(nextSeq([event])).toBe(2)
  })
})

describe('buildEvent', () => {
  it('stamps id, matchId, seq and ts', () => {
    const event = buildEvent('m1', 3, { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }, 'e1', NOW)
    expect(event).toMatchObject({ type: 'TOSS', id: 'e1', matchId: 'm1', seq: 3, ts: NOW })
  })

  it('rejects unknown event types', () => {
    expect(() => buildEvent('m1', 1, { type: 'NOPE' }, 'e1', NOW)).toThrow(MatchError)
  })
})

describe('appendEvent', () => {
  it('appends and projects the new state', () => {
    const config = buildConfig(setupBody(), 'm1')
    const first = appendEvent({
      matchId: 'm1',
      config,
      events: [],
      payload: { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' },
      uuid: 'e1',
      now: NOW,
    })
    expect(first.event.seq).toBe(1)
    expect(first.state.status).toBe('IN_PROGRESS')
    expect(first.events).toHaveLength(1)
    expect(first.live.runs).toBe(0)

    const ball = appendEvent({
      matchId: 'm1',
      config,
      events: first.events,
      payload: {
        type: 'BALL',
        over: 0,
        ball: 0,
        runs: 4,
        extras: 'NONE',
        wicket: false,
        dismissal: null,
        dismissedPlayerId: null,
        batterId: 'a1',
        nonStrikerId: 'a2',
        bowlerId: 'b1',
        fieldingCaptainId: 'b1',
      },
      uuid: 'e2',
      now: NOW,
    })
    expect(ball.event.seq).toBe(2)
    expect(ball.live.runs).toBe(4)
    expect(ball.state.eventCount).toBe(2)
  })

  it('rejects an illegal ball as a MatchError', () => {
    const config = buildConfig(setupBody(), 'm1')
    expect(() =>
      appendEvent({
        matchId: 'm1',
        config,
        events: [],
        payload: {
          type: 'BALL',
          over: 0,
          ball: 0,
          runs: 1,
          extras: 'NONE',
          wicket: false,
          dismissal: null,
          dismissedPlayerId: null,
          batterId: 'a1',
          nonStrikerId: 'a2',
          bowlerId: 'b1',
          fieldingCaptainId: 'b1',
        },
        uuid: 'e9',
        now: NOW,
      }),
    ).toThrow(MatchError)
  })
})

describe('computeBundle', () => {
  it('projects state, live, scorecard and result', () => {
    const config = buildConfig(setupBody(), 'm1')
    const events = [buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }, 'e1', NOW)]
    const bundle = computeBundle('m1', config, events)
    expect(bundle.matchId).toBe('m1')
    expect(bundle.state.eventCount).toBe(1)
    expect(bundle.live.status).toBe('IN_PROGRESS')
    expect(bundle.scorecard.innings).toHaveLength(1)
    expect(bundle.result).toBeNull()
  })
})

describe('withoutLastEvent', () => {
  it('drops the most recent delivery', () => {
    const toss = buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }, 'e1', NOW)
    const ball = buildEvent(
      'm1',
      2,
      {
        type: 'BALL',
        over: 0,
        ball: 0,
        runs: 4,
        extras: 'NONE',
        wicket: false,
        dismissal: null,
        dismissedPlayerId: null,
        batterId: 'a1',
        nonStrikerId: 'a2',
        bowlerId: 'b1',
        fieldingCaptainId: 'b1',
      },
      'e2',
      NOW,
    )
    expect(withoutLastEvent([toss, ball])).toEqual([toss])
    expect(withoutLastEvent([toss, ball])).not.toBe([toss])
  })

  it('never drops the toss, so a match cannot be left headless', () => {
    const toss = buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }, 'e1', NOW)
    expect(withoutLastEvent([toss])).toEqual([toss])
  })

  it('leaves an empty log alone', () => {
    expect(withoutLastEvent([])).toEqual([])
  })

  it('does not mutate the log it is given', () => {
    const toss = buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }, 'e1', NOW)
    const ball = buildEvent(
      'm1',
      2,
      {
        type: 'BALL',
        over: 0,
        ball: 0,
        runs: 1,
        extras: 'NONE',
        wicket: false,
        dismissal: null,
        dismissedPlayerId: null,
        batterId: 'a1',
        nonStrikerId: 'a2',
        bowlerId: 'b1',
        fieldingCaptainId: 'b1',
      },
      'e2',
      NOW,
    )
    const events = [toss, ball]
    withoutLastEvent(events)
    expect(events).toHaveLength(2)
  })

  it('rewinds the projected score when the replayed log is recomputed', () => {
    const config = buildConfig(setupBody(), 'm1')
    const toss = buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }, 'e1', NOW)
    const ball = buildEvent(
      'm1',
      2,
      {
        type: 'BALL',
        over: 0,
        ball: 0,
        runs: 4,
        extras: 'NONE',
        wicket: false,
        dismissal: null,
        dismissedPlayerId: null,
        batterId: 'a1',
        nonStrikerId: 'a2',
        bowlerId: 'b1',
        fieldingCaptainId: 'b1',
      },
      'e2',
      NOW,
    )
    expect(computeBundle('m1', config, [toss, ball]).live.runs).toBe(4)
    expect(computeBundle('m1', config, withoutLastEvent([toss, ball])).live.runs).toBe(0)
  })
})

const CONFIG_INPUT = {
  teamAId: 'India',
  teamBId: 'Australia',
  lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  oversPerInnings: 2,
  // Two-player lineups can only be legal when a single wicket ends the innings;
  // the powerplay must also fit inside a two-over innings.
  maxWickets: 1,
  powerplayOvers: 1,
}

const toss = (): MatchEvent =>
  buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'India', winnerDecision: 'BAT' }, 'e1', 't')

/**
 * A legal delivery. `over`/`ball` are labels only — the engine counts legal
 * balls itself — so copy the numbering from the BALL fixtures already in this
 * file if these values disagree with the engine's expectations.
 */
const ball = (seq: number, runs: number): MatchEvent =>
  buildEvent(
    'm1',
    seq,
    {
      type: 'BALL',
      over: 0,
      ball: seq - 1,
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
    't',
  )

const endMatch = (seq: number, outcome: unknown): MatchEvent =>
  buildEvent('m1', seq, { type: 'END_MATCH', outcome }, `e${seq}`, 't')

describe('summarize', () => {
  it('shows a created match as yet to start with no score', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    expect(summarize('m1', config, [])).toEqual({
      matchId: 'm1',
      teamAId: 'India',
      teamBId: 'Australia',
      label: 'India vs Australia',
      score: null,
      status: 'UPCOMING',
      statusText: 'Yet to start',
      resultText: null,
    })
  })

  it('shows a live match with the current score', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const summary = summarize('m1', config, [toss(), ball(2, 4), ball(3, 0)])
    expect(summary.status).toBe('LIVE')
    expect(summary.statusText).toBe('LIVE')
    expect(summary.score).toBe('4-0 (0.2 ov)')
    expect(summary.resultText).toBeNull()
  })

  it('replays a correction before summarising (review focus 4)', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const correction = buildEvent(
      'm1',
      3,
      {
        type: 'CORRECTION',
        supersedes: 'e2',
        replacement: {
          kind: 'BALL',
          ball: {
            over: 0,
            ball: 0,
            runs: 6,
            extras: 'NONE',
            wicket: false,
            dismissal: null,
            dismissedPlayerId: null,
            batterId: 'a1',
            nonStrikerId: 'a2',
            bowlerId: 'b1',
            fieldingCaptainId: 'b1',
          },
        },
        reason: 'miscounted',
      },
      'e3',
      't',
    )
    // Ball e2 was 4; the correction replaces it with 6.
    const summary = summarize('m1', config, [toss(), ball(2, 4), correction])
    expect(summary.score).toBe('6-0 (0.1 ov)')
  })

  it('reports a tied match as a result', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const summary = summarize('m1', config, [toss(), ball(2, 4), endMatch(3, { kind: 'TIE' })])
    expect(summary.status).toBe('DONE')
    expect(summary.statusText).toBe('Result')
    expect(summary.resultText).toBe('Match tied')
  })

  it('reports an abandoned match with its reason', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const summary = summarize('m1', config, [toss(), endMatch(2, { kind: 'ABANDONED', reason: 'Rain' })])
    expect(summary.status).toBe('DONE')
    expect(summary.resultText).toBe('Match abandoned: Rain')
  })

  it('uses the most recent innings that has any activity for the score', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const state = applyEvents(config, [toss(), ball(2, 4)])
    const card = projectScorecard(state)
    const summary = summarize('m1', config, [toss(), ball(2, 4)])
    const shown = card.innings[card.innings.length - 1]
    expect(shown).toBeDefined()
    expect(summary.score).toBe(`${shown?.runs}-${shown?.wickets} (${shown?.oversText} ov)`)
  })
})

describe('summarizeRows', () => {
  it('skips rows whose config no longer replays (review focus 1)', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const rows = [
      { id: 'm1', config, events: [toss(), ball(2, 4)] },
      { id: 'bad', config: { ping: 'probe' }, events: [{ type: 'BALL' }] },
      { id: 'missing', config, events: null },
    ]
    const summaries = summarizeRows(rows)
    expect(summaries.map((s) => s.matchId)).toEqual(['m1', 'missing'])
  })

  it('returns an empty list for no rows', () => {
    expect(summarizeRows([])).toEqual([])
  })
})
