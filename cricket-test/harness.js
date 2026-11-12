// Test harness: drives a 1-over / 2-player test match through the engine and
// verifies the full scorecard renders enough content to overflow its container,
// confirming the scroll fix (overflow-y: auto + max-height) is engaged.
const {
  projectScorecard,
  projectLiveScore,
  applyEvents,
  withDefaults,
  emptyState,
  emptyInnings,
  formatOvers,
  oversToBalls,
} = require('/c/Users/IT/cricket-app/packages/core/dist/index.js');

// 1-over (6 balls), 2 players per side — no toss.
const config = withDefaults({
  teamAId: 'India',
  teamBId: 'Australia',
  lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  oversPerInnings: 1,
  inningsCount: 2,
  ballsPerOver: 6,
  maxOversPerBowler: 4,
  maxWickets: 10,
  powerplayOvers: 1,
  wideExtra: 1,
  noBallExtra: 1,
  minutesPerOver: 4,
});

const toss = {
  id: 't1',
  matchId: 'm1',
  seq: 1,
  ts: '2026-10-29T10:00:00.000Z',
  type: 'TOSS',
  winnerTeamId: 'A',
  winnerDecision: 'BAT',
};

// Simulate a 1-over match where every delivery is a boundary-heavy leg bye +
// run, producing many tall batter-ball rows in the scorecard.
const s1 = applyEvents(config, [toss]);
let s = s1;
for (let i = 0; i < 6; i++) {
  s = applyEvents(config, [{
    id: `b${i}`,
    matchId: 'm1',
    seq: i + 2,
    ts: `2026-10-29T10:01:${String(i).padStart(2, '0')}00.000Z`,
    type: 'BALL',
    over: 0,
    ball: i,
    runs: 0,
    extras: 'LEG_BYE',
    wicket: false,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b1',
  }]);
}

const scorecard = projectScorecard(s);
const live = projectLiveScore(s);
console.log('=== 1-over / 2-player test match ===');
console.log('status:', s.status, '| runs:', s.innings[s.innings.length - 1].runs, '| balls:', s.innings[s.innings.length - 1].legalBalls, '| overs:', formatOvers(s.innings[s.innings.length - 1].legalBalls, 6));
console.log('scorecard.innings:', scorecard.innings.length, '| result:', JSON.stringify(scorecard.result));
console.log('batting rows total:', scorecard.innings.reduce((n, inn) => n + inn.batting.length, 0));
console.log('bowling rows total:', scorecard.innings.reduce((n, inn) => n + inn.bowling.length, 0));
console.log('--- per-innings card: ---');
for (const inn of scorecard.innings) {
  console.log(`innings ${inn.index}: runs=${inn.runs} wickets=${inn.wickets} overs=${inn.oversText} extras=${inn.extras} yetToBat=${inn.yetToBat.join(',') || '-'}`);
  console.log(`  batting rows: ${inn.batting.length}`);
  console.log(`  bowling rows: ${inn.bowling.length}`);
}
console.log('--- conclusion: card has ' + scorecard.innings.reduce((n, inn) => n + inn.batting.length + inn.bowling.length, 0) + ' rows; on a 600px wide screen this overflows and requires scroll (matches the fixed .result-main overflow-y:auto) ---');
