const base = 'http://localhost:3100'

const lineups = {
  A: Array.from({ length: 11 }, (_, i) => `a${i + 1}`),
  B: Array.from({ length: 11 }, (_, i) => `b${i + 1}`),
}

const created = await fetch(`${base}/matches`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ teamAId: 'teamA', teamBId: 'teamB', lineups, oversPerInnings: 2, powerplayOvers: 2 }),
})
const { matchId } = await created.json()
console.log('create:', created.status, matchId)

const toss = await fetch(`${base}/matches/${matchId}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' }),
})
console.log('toss:', toss.status, JSON.stringify((await toss.json()).live).slice(0, 160))

const ball = await fetch(`${base}/matches/${matchId}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    type: 'BALL', over: 0, ball: 0, runs: 4, extras: 'NONE', wicket: false,
    dismissal: null, dismissedPlayerId: null, batterId: 'a1', nonStrikerId: 'a2',
    bowlerId: 'b1', fieldingCaptainId: 'b1',
  }),
})
const ballBody = await ball.json()
console.log('ball:', ball.status, 'live runs =', ballBody.live.runs, 'seq =', ballBody.seq)

const bad = await fetch(`${base}/matches/${matchId}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    type: 'BALL', over: 0, ball: 1, runs: 0, extras: 'NONE', wicket: false,
    dismissal: null, dismissedPlayerId: null, batterId: 'a3', nonStrikerId: 'a2',
    bowlerId: 'b1', fieldingCaptainId: 'b1',
  }),
})
console.log('illegal ball:', bad.status, JSON.stringify(await bad.json()))

const scorecard = await fetch(`${base}/matches/${matchId}/scorecard`)
const sc = await scorecard.json()
console.log('scorecard:', scorecard.status, 'innings0 runs =', sc.innings[0].runs, 'striker =', sc.innings[0].batting[0].playerId)

const ctrl = new AbortController()
setTimeout(() => ctrl.abort(), 1500)
try {
  const res = await fetch(`${base}/matches/${matchId}/stream`, { signal: ctrl.signal })
  console.log('stream content-type:', res.headers.get('content-type'))
  const reader = res.body.getReader()
  const first = await reader.read()
  console.log('stream first chunk:', new TextDecoder().decode(first.value).slice(0, 120).replace(/\n/g, '|'))
} catch (e) {
  if (e.name !== 'AbortError') throw e
  console.log('stream: ok (timeout close)')
}
console.log('SMOKE DONE')
