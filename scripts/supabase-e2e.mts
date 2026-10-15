// End-to-end check of the exact data path the web app uses now:
//   create a match -> score it -> read it back -> confirm Realtime pushes updates.
// Runs the real web/src/match.ts helpers against the live Supabase project.
import { createClient } from '@supabase/supabase-js'
import { appendEvent, buildConfig, computeBundle, computeCommentary } from '../web/src/match.ts'

const URL = process.env.SUPABASE_URL ?? 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
client.realtime.setAuth(KEY)

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
  )
}

const lineups = {
  A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
  B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
}

type Opts = { extras?: string; batterId?: string; nonStrikerId?: string; bowlerId?: string }
function ball(over: number, ballNo: number, runs: number, opts: Opts = {}) {
  return {
    type: 'BALL',
    over,
    ball: ballNo,
    runs,
    extras: opts.extras ?? 'NONE',
    wicket: false,
    dismissal: null,
    dismissedPlayerId: null,
    batterId: opts.batterId ?? 'a1',
    nonStrikerId: opts.nonStrikerId ?? 'a2',
    bowlerId: opts.bowlerId ?? 'b1',
    fieldingCaptainId: opts.bowlerId ?? 'b1',
  }
}

// --- create (same path as api.createMatch) ---------------------------------
const matchId = crypto.randomUUID()
const config = buildConfig(
  { teamAId: 'India', teamBId: 'Australia', lineups, oversPerInnings: 2, powerplayOvers: 1 },
  matchId,
)
{
  const { error } = await client.from('matches').insert({ id: matchId, config, events: [] })
  if (error) throw new Error('insert failed: ' + error.message)
  console.log('matchId =', matchId)
}

async function loadRow(id: string): Promise<{ config: any; events: any[] }> {
  const { data, error } = await client.from('matches').select('config,events').eq('id', id).maybeSingle()
  if (error) throw new Error('select failed: ' + error.message)
  if (!data) throw new Error('match not found')
  return data as { config: any; events: any[] }
}

async function score(id: string, payload: unknown) {
  const row = await loadRow(id)
  const { events } = appendEvent({
    matchId: id,
    config: row.config,
    events: row.events,
    payload,
    uuid: crypto.randomUUID(),
    now: new Date().toISOString(),
  })
  const { error } = await client
    .from('matches')
    .update({ events, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error('update failed: ' + error.message)
}

const live = async (id: string) => computeBundle(id, (await loadRow(id)).config, (await loadRow(id)).events).live

// --- score a tiny chase, mirroring the UI sequence -------------------------
await score(matchId, { type: 'TOSS', winnerTeamId: 'India', winnerDecision: 'BAT' })
await score(matchId, ball(0, 0, 4, { batterId: 'a1', nonStrikerId: 'a2', bowlerId: 'b1' })) // India 4
await score(matchId, { type: 'DECLARE' }) // Australia chase 5

let l = await live(matchId)
check('chase: target set', l.target, 5)
check('chase: powerplay at over 0', l.powerplay, true)
check('chase: no deliveries yet', l.thisOver, [])

await score(matchId, ball(0, 0, 0, { extras: 'WIDE', batterId: 'b1', nonStrikerId: 'b2', bowlerId: 'a1' }))
l = await live(matchId)
check('wide recorded in this over', l.thisOver.map((b: any) => b.text), ['wd'])

await score(matchId, ball(0, 0, 0, { batterId: 'b1', nonStrikerId: 'b2', bowlerId: 'a1' }))
l = await live(matchId)
check('this over accumulates', l.thisOver.map((b: any) => b.text), ['wd', '0'])
check('chase runs (wide penalty)', l.runs, 1)
check('chase: need 4 off 11', [l.target - l.runs, l.ballsRemaining], [4, 11])
check('chase: required run rate', l.requiredRunRate, 2.18)

for (let i = 1; i <= 5; i++) {
  await score(matchId, ball(0, i, 0, { batterId: 'b1', nonStrikerId: 'b2', bowlerId: 'a1' }))
}
l = await live(matchId)
check('this over holds the full over', l.thisOver.map((b: any) => b.text), ['wd', '0', '0', '0', '0', '0', '0'])

await score(matchId, ball(1, 0, 0, { batterId: 'b2', nonStrikerId: 'b1', bowlerId: 'a2' }))
l = await live(matchId)
check('this over resets each over', l.thisOver.map((b: any) => ({ t: b.text, l: b.label })), [{ t: '0', l: '1.1' }])
check('powerplay cleared after over 0', l.powerplay, false)

// --- Realtime: a spectator must receive the row update ----------------------
let gotUpdate = false
const channel = client
  .channel('e2e-' + matchId)
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
    () => {
      gotUpdate = true
    },
  )
const subscribed = await new Promise<boolean>((resolve) => {
  const t = setTimeout(() => resolve(false), 10000)
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      clearTimeout(t)
      resolve(true)
    }
  })
})
check('realtime: channel subscribed', subscribed, true)

await score(matchId, ball(1, 1, 0, { batterId: 'b2', nonStrikerId: 'b1', bowlerId: 'a2' }))
for (let i = 0; i < 40 && !gotUpdate; i++) await new Promise((r) => setTimeout(r, 250))
check('realtime: spectator got the update', gotUpdate, true)
await client.removeChannel(channel)

// --- commentary + final read ------------------------------------------------
const row = await loadRow(matchId)
const bundle = computeBundle(matchId, row.config, row.events)
const lines = computeCommentary(row.config, row.events)
console.log('---')
console.log('status =', bundle.state.status, '| score =', `${bundle.live.runs}/${bundle.live.wickets}`, bundle.live.oversText)
console.log('commentary lines =', lines.length, '| first =', lines[0]?.text)
console.log('SHARE  https://tejjcfokgrbbkeueiuwy.supabase.co (site)/#/match/' + matchId)
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
if (failures > 0) process.exitCode = 1
