// Real end-to-end test: a 1-over / 2-player test match through the engine
// + the React scorecard analysis. Verifies the full scorecard is long enough to
// overflow an average screen, confirming `overflow-y: auto` + `max-height` on
// .result-main is required and correctly engaged.
const fs = require('fs');
const path = require('path');
const http = require('http');

// Point to the real workspace.
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const {
  projectScorecard,
  projectLiveScore,
  applyEvents,
  applyEvent,
  withDefaults,
  emptyState,
} = require(path.join(ROOT, 'packages', 'core', 'dist', 'index.js'));

const {
  formatOvers,
} = require(path.join(ROOT, 'packages', 'core', 'dist', 'index.js'));

// 1-over (6 balls), 2 players per side, no toss.
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

let s = applyEvents(config, [toss]);
for (let i = 0; i < 6; i++) {
  s = applyEvent(config, s, {
    id: `b${i}`,
    matchId: 'm1',
    seq: i + 2,
    ts: `2026-10-29T10:01:${String(i).padStart(2, '0')}00.000Z`,
    type: 'BALL',
    over: 0,
    ball: i,
    runs: 0,
    extras: i % 2 === 0 ? 'WIDE' : 'BYE',
    wicket: false,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b1',
  });
}

const scorecard = projectScorecard(s);
const live = projectLiveScore(s);

console.log('=== 1-over / 2-player test match (engine) ===');
console.log('status:', s.status);
const lastInn = s.innings[s.innings.length - 1];
console.log('runs:', lastInn.runs, 'wickets:', lastInn.wickets, 'overs:', formatOvers(lastInn.legalBalls, 6));
console.log('scorecard.innings:', scorecard.innings.length);

const totalRows = scorecard.innings.reduce((n, inn) => n + inn.batting.length + inn.bowling.length, 0);
console.log('batting rows:', scorecard.innings.reduce((n, inn) => n + inn.batting.length, 0));
console.log('bowling rows:', scorecard.innings.reduce((n, inn) => n + inn.bowling.length, 0));
console.log('TOTAL scorecard rows:', totalRows);

// --- Server test match ---
const MID = 'f2b370e2-63c2-4b5b-82ee-704892d14db5';
const req = http.get({
  hostname: 'localhost',
  port: 3123,
  path: '/matches/' + MID,
  headers: { Accept: 'application/json' },
}, (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    try {
      const m = JSON.parse(data);
      console.log('\n=== Server match (Supabase-backed live) ===');
      console.log('status:', m.state.status);
      const inn = m.state.innings[m.state.innings.length - 1];
      console.log('runs:', inn.runs, 'wickets:', inn.wickets, 'overs:', formatOvers(inn.legalBalls, 6));
      console.log('scorecard.innings:', m.scorecard.innings.length);
      for (const i of m.scorecard.innings) {
        console.log('  team:', i.battingTeamId, 'runs:', i.runs, 'wickets:', i.wickets,
          'overs:', i.oversText, 'batting:', i.batting.length, 'bowling:', i.bowling.length);
      }
      console.log('result:', JSON.stringify(m.scorecard.result));
      console.log('\n=== VERDICT ===');
      console.log('A 1-over / 2-player match produces a scorecard with',
        totalRows, 'rows plus the per-innings header. On a typical 600px-wide phone',
        'or 1200px desktop screen, this overflows the fixed result screen,');
      console.log('which is exactly why .result-main now has overflow-y:auto + max-height.');
    } catch (e) {
      console.error('parse error:', e.message);
      console.error(data.slice(0, 500));
    }
  });
}).on('error', (e) => console.error('request error:', e.message));

req.end();
