#!/usr/bin/env node
/**
 * Test automation script for cricket scoring app
 * Verifies Task 9 features: player name references (playerRefs) and
 * fielder-by (fielderId) handling on wicket events.
 *
 * The script reads the authoritative striker / non-striker / bowler from the
 * state returned by each ball so strike rotation and end-of-over changes are
 * always respected.
 *
 * Usage: node test-match-automation.js
 */

import { pathToFileURL } from 'url'

// Configuration
const API_BASE = 'http://localhost:3000'
const BALLS_PER_OVER = 6

const TEAM_A = ['batter1', 'batter2', 'batter3', 'batter4', 'batter5', 'batter6', 'batter7', 'batter8', 'batter9', 'batter10', 'batter11']
const TEAM_B = ['bowler1', 'bowler2', 'bowler3', 'bowler4', 'bowler5', 'bowler6', 'bowler7', 'bowler8', 'bowler9', 'bowler10', 'bowler11']

const PLAYER_REFS = {
  batter1: { name: 'Virat Kohli', mobile: '1111111111', verified: true },
  batter2: { name: 'Rohit Sharma', mobile: '2222222222', verified: true },
  batter3: { name: 'Shubman Gill', mobile: '3333333333', verified: true },
  batter4: { name: 'KL Rahul', mobile: '4444444444', verified: true },
  batter5: { name: 'Suryakumar Yadav', mobile: '5555555555', verified: true },
  batter6: { name: 'Rishabh Pant', mobile: '6666666666', verified: false },
  batter7: { name: 'Ravindra Jadeja', mobile: '7777777777', verified: true },
  batter8: { name: 'Axar Patel', mobile: '8888888888', verified: true },
  batter9: { name: 'Kuldeep Yadav', mobile: '9999999999', verified: true },
  batter10: { name: 'Jasprit Bumrah', mobile: '1010101011', verified: true },
  batter11: { name: 'Mohammed Shami', mobile: '1111111112', verified: true },
  bowler1: { name: 'Pat Cummins', mobile: '2121212121', verified: true },
  bowler2: { name: 'Mitchell Starc', mobile: '3232323232', verified: true },
  bowler3: { name: 'Josh Hazlewood', mobile: '4343434343', verified: true },
  bowler4: { name: 'Adam Zampa', mobile: '5454545454', verified: true },
  bowler5: { name: 'Sean Abbott', mobile: '6565656565', verified: true },
  bowler6: { name: 'Steve Smith', mobile: '7676767676', verified: true },
  bowler7: { name: 'Marnus Labuschagne', mobile: '8787878787', verified: true },
  bowler8: { name: 'Travis Head', mobile: '9898989898', verified: true },
  bowler9: { name: 'David Warner', mobile: '1010101012', verified: true },
  bowler10: { name: 'Glenn Maxwell', mobile: '1121121121', verified: true },
  bowler11: { name: 'Alex Carey', mobile: '1231231232', verified: true },
}

const TEST_MATCH_CONFIG = {
  teamAId: 'test-team-a',
  teamBId: 'test-team-b',
  lineups: { A: TEAM_A, B: TEAM_B },
  playerRefs: PLAYER_REFS,
  oversPerInnings: 2,
  powerplayOvers: 1,
}

// Two overs (12 legal deliveries) that exercise every dismissal type. Wickets
// that require a fielder carry a fielderId; the others intentionally omit it.
const BALL_PLAN = [
  { desc: 'Dot ball', runs: 0, extras: 'NONE' },
  { desc: 'Single', runs: 1, extras: 'NONE' },
  { desc: 'Wicket - BOWLED (no fielder)', runs: 0, extras: 'NONE', wicket: true, dismissal: 'BOWLED' },
  { desc: 'Wicket - CAUGHT (fielder required)', runs: 0, extras: 'NONE', wicket: true, dismissal: 'CAUGHT', fielder: 'bowler3' },
  { desc: 'Wicket - LBW (no fielder)', runs: 0, extras: 'NONE', wicket: true, dismissal: 'LBW' },
  { desc: 'Wicket - HIT_WICKET (no fielder)', runs: 0, extras: 'NONE', wicket: true, dismissal: 'HIT_WICKET' },
  { desc: 'Wide', runs: 0, extras: 'WIDE' },
  { desc: 'No ball', runs: 0, extras: 'NO_BALL' },
  { desc: 'Wicket - OBSTRUCTING (fielder required)', runs: 0, extras: 'NONE', wicket: true, dismissal: 'OBSTRUCTING', fielder: 'bowler4' },
  { desc: 'Boundary (4 runs)', runs: 4, extras: 'NONE' },
  { desc: 'Wicket - STUMPED (fielder required)', runs: 0, extras: 'NONE', wicket: true, dismissal: 'STUMPED', fielder: 'bowler5' },
  { desc: 'Wicket - RUN_OUT (fielder required, non-striker out)', runs: 0, extras: 'NONE', wicket: true, dismissal: 'RUN_OUT', fielder: 'bowler6', out: 'nonStriker' },
  { desc: 'Bye', runs: 1, extras: 'BYE' },
  { desc: 'Leg bye', runs: 1, extras: 'LEG_BYE' },
]

const FIELDER_REQUIRED = ['CAUGHT', 'RUN_OUT', 'STUMPED', 'OBSTRUCTING']

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText.substring(0, 200)}`)
  }
  return response.json()
}

function currentInnings(state) {
  return state.innings[state.innings.length - 1]
}

async function runTestMatch() {
  console.log('Starting Test Match Automation for Task 9 Features')
  console.log('='.repeat(60))

  try {
    console.log('1) Creating test match...')
    const createRes = await fetchJson(`${API_BASE}/matches`, {
      method: 'POST',
      body: JSON.stringify(TEST_MATCH_CONFIG),
    })
    const matchId = createRes.matchId
    let state = createRes.state
    console.log(`   Match created: ${matchId} (status ${state.status})`)

    console.log('2) Transitioning match to IN_PROGRESS via toss...')
    const tossRes = await fetchJson(`${API_BASE}/matches/${matchId}/events`, {
      method: 'POST',
      body: JSON.stringify({ type: 'TOSS', winnerTeamId: TEST_MATCH_CONFIG.teamAId, winnerDecision: 'BAT' }),
    })
    state = tossRes.state
    console.log(`   Status after toss: ${state.status}`)

    console.log('3) Simulating deliveries...')
    let bowlerCursor = 0
    for (const [index, spec] of BALL_PLAN.entries()) {
      const inn = currentInnings(state)

      // Establish the opening pair and bowler on the very first delivery.
      const batterId = inn.strikerId ?? TEAM_A[0]
      const nonStrikerId = inn.strikerId ? inn.nonStrikerId : TEAM_A[1]

      let bowlerId = inn.currentBowlerId
      if (!bowlerId) {
        while (bowlerCursor < TEAM_B.length) {
          const candidate = TEAM_B[bowlerCursor++]
          if (candidate !== inn.lastOverBowlerId) {
            bowlerId = candidate
            break
          }
        }
        bowlerId = bowlerId ?? TEAM_B[0]
      }

      const payload = {
        type: 'BALL',
        over: Math.floor(inn.legalBalls / BALLS_PER_OVER),
        ball: inn.legalBalls % BALLS_PER_OVER,
        runs: spec.runs,
        extras: spec.extras,
        wicket: Boolean(spec.wicket),
        dismissal: spec.dismissal ?? null,
        dismissedPlayerId: spec.wicket ? (spec.out === 'nonStriker' ? nonStrikerId : batterId) : null,
        batterId,
        nonStrikerId,
        bowlerId,
        fieldingCaptainId: bowlerId,
      }
      if (spec.fielder) payload.fielderId = spec.fielder

      const eventRes = await fetchJson(`${API_BASE}/matches/${matchId}/events`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      state = eventRes.state

      const nextInn = currentInnings(state)
      const score = nextInn ? `${nextInn.runs}-${nextInn.wickets} (${Math.floor(nextInn.legalBalls / BALLS_PER_OVER)}.${nextInn.legalBalls % BALLS_PER_OVER})` : 'n/a'
      const fielderNote = spec.fielder ? ` fielder=${spec.fielder}` : ''
      console.log(`   ${index + 1}. ${spec.desc} -> ${score}${fielderNote}`)
    }

    console.log('4) Verifying final state...')
    const finalRes = await fetchJson(`${API_BASE}/matches/${matchId}`)
    const firstInnings = finalRes.state.innings[0]
    console.log(`   Innings closed: ${firstInnings.closed}`)
    console.log(`   Score: ${firstInnings.runs}-${firstInnings.wickets} in ${Math.floor(firstInnings.legalBalls / BALLS_PER_OVER)}.${firstInnings.legalBalls % BALLS_PER_OVER} overs`)
    console.log(`   Extras: ${firstInnings.extras}`)

    console.log('5) Verifying Task 9 player references...')
    const refs = finalRes.state.config.playerRefs ?? {}
    const refCount = Object.keys(refs).length
    if (refCount !== 22) throw new Error(`Expected 22 playerRefs, found ${refCount}`)
    for (const id of ['batter1', 'bowler1']) {
      if (!refs[id] || typeof refs[id].name !== 'string') {
        throw new Error(`Missing name for playerRef ${id}`)
      }
    }
    console.log(`   Found ${refCount} playerRefs; names available for playerName() helper`)
    console.log(`   Sample: batter1 -> ${refs.batter1.name}, bowler1 -> ${refs.bowler1.name}`)

    console.log('6) Verifying fielderId handling in stored events...')
    const eventsRes = await fetchJson(`${API_BASE}/matches/${matchId}/events`)
    const wickets = eventsRes.events.filter((e) => e.type === 'BALL' && e.wicket)
    for (const event of wickets) {
      const needsFielder = FIELDER_REQUIRED.includes(event.dismissal)
      if (needsFielder && !event.fielderId) {
        throw new Error(`${event.dismissal} is missing fielderId`)
      }
      if (!needsFielder && event.fielderId) {
        throw new Error(`${event.dismissal} should not carry a fielderId`)
      }
    }
    console.log(`   ${wickets.length} wickets verified; fielderId present exactly when required`)

    console.log('7) Verifying scorecard projection...')
    const card = finalRes.scorecard
    if (!card || !Array.isArray(card.innings) || card.innings.length === 0) {
      throw new Error('Scorecard projection is empty')
    }
    console.log(`   Scorecard innings: ${card.innings.length}, batting lines: ${card.innings[0].batting.length}`)

    console.log('\n' + '='.repeat(60))
    console.log('TEST MATCH AUTOMATION COMPLETED SUCCESSFULLY')
    console.log('='.repeat(60))
    console.log(`Match ID: ${matchId}`)
    console.log(`Deliveries processed: ${BALL_PLAN.length}`)
    console.log(`Wickets verified: ${wickets.length}`)
    console.log(`Player references verified: ${refCount}`)
    return true
  } catch (error) {
    console.error('\n' + '='.repeat(60))
    console.error('TEST MATCH AUTOMATION FAILED')
    console.error('='.repeat(60))
    console.error(`Error: ${error.message}`)
    console.error('\nTroubleshooting:')
    console.error('1. Ensure the backend is running: cd server; npm run dev')
    console.error('2. Check if another process is using port 3000')
    return false
  }
}

// Run the test if this file is executed directly (works on Windows too).
if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  runTestMatch()
    .then((success) => {
      process.exit(success ? 0 : 1)
    })
    .catch((err) => {
      console.error('Unexpected error:', err)
      process.exit(1)
    })
}

export { runTestMatch }
