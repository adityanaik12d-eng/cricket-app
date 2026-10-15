import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MatchReport } from './MatchReport'
import { buildConfig, buildEvent, computeBundle, computeCommentary } from './match'
import type { MatchEvent } from '@cricket-app/core'

const config = buildConfig(
  {
    teamAId: 'India',
    teamBId: 'Australia',
    lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
    oversPerInnings: 2,
    // Fixture-only fix (mirrors Task 1): a two-player lineup is only legal when a
    // single wicket ends the innings, and the powerplay must fit the two overs.
    // No wicket is taken and the powerplay does not affect the score, so no
    // assertion is weakened.
    maxWickets: 1,
    powerplayOvers: 1,
  },
  'm1',
)

const toss = buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'India', winnerDecision: 'BAT' }, 'e1', 't')

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

describe('MatchReport', () => {
  it('summarises both innings with a top score and best bowling', () => {
    const events = [toss, ball(2, 4), ball(3, 2)]
    const html = renderToStaticMarkup(
      <MatchReport bundle={computeBundle('m1', config, events)} commentary={computeCommentary(config, events)} />,
    )
    expect(html).toContain('India')
    expect(html).toContain('6-0')
    expect(html).toContain('Top score')
    expect(html).toContain('Best bowling')
    expect(html).toContain('Commentary')
  })

  it('shows the result line for a finished match', () => {
    const events = [
      toss,
      ball(2, 4),
      buildEvent('m1', 3, { type: 'END_MATCH', outcome: { kind: 'ABANDONED', reason: 'Rain' } }, 'e3', 't'),
    ]
    const html = renderToStaticMarkup(
      <MatchReport bundle={computeBundle('m1', config, events)} commentary={computeCommentary(config, events)} />,
    )
    expect(html).toContain('Match abandoned: Rain')
  })

  it('says the match is in progress before anything has happened', () => {
    const html = renderToStaticMarkup(<MatchReport bundle={computeBundle('m1', config, [])} commentary={[]} />)
    expect(html).toContain('Match in progress.')
  })
})
