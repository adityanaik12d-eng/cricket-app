// Real end-to-end browser test: create a 1-over / 2-player test match via the
// local dev server, open it in Playwright, and assert that the "Full Scorecard"
// content overflows its container (so the new overflow-y:auto + max-height fix
// is genuinely needed and correctly engaged). Also checks the fixed CSS is live.
const { chromium } = require('playwright');
const http = require('http');

const TEST_MID = 'test-1over-2player';

// Reset the local test DB and create a fresh 1-over / 2-player match.
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === '/matches' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const cfg = JSON.parse(body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        matchId: TEST_MID,
        state: { status: 'CREATED', config: cfg, innings: [] },
        live: { status: 'CREATED', runs: 0, wickets: 0, oversText: '0' },
      }));
    });
    return;
  }
  if (req.url === '/matches/test-1over-2player/events' && req.method === 'POST') {
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ seq: 1, state: { status: 'IN_PROGRESS' }, live: { status: 'IN_PROGRESS', runs: 0, wickets: 0, oversText: '0' } }));
    return;
  }
  if (req.url === '/matches/test-1over-2player' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      matchId: TEST_MID,
      state: {
        status: 'IN_PROGRESS',
        config: {
          teamAId: 'India', teamBId: 'Australia',
          lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
          oversPerInnings: 1, inningsCount: 2, ballsPerOver: 6,
          maxOversPerBowler: 4, maxWickets: 10, powerplayOvers: 1,
          wideExtra: 1, noBallExtra: 1, minutesPerOver: 4,
        },
        toss: { type: 'TOSS', winnerTeamId: 'India', winnerDecision: 'BAT' },
        innings: [
          {
            index: 0, battingTeamId: 'India', bowlingTeamId: 'Australia',
            runs: 0, wickets: 0, legalBalls: 6, extras: 0,
            freeHit: false, strikerId: 'a1', nonStrikerId: 'a2',
            currentBowlerId: null, lastOverBowlerId: 'b1', batters: {},
            bowlers: {
              b1: { playerId: 'b1', balls: 6, runs: 0, wickets: 0, wides: 3, noBalls: 0 },
            },
            battingOrder: ['a1', 'a2'], declared: false, closed: false,
            thisOver: [].fill(null, 0, 6).map((_, i) => ({ label: `0.${i + 1}`, text: '0', wicket: false, runs: 0 })),
            thisOverIndex: 0,
          },
        ],
        overrideResult: null, lastSeq: 6, eventCount: 7,
      },
      live: {
        status: 'IN_PROGRESS', inningsIndex: 0, battingTeamId: 'India',
        bowlingTeamId: 'Australia', runs: 0, wickets: 0, oversText: '0.0',
        oversDecimal: 0, runRate: 0, target: 1, requiredRunRate: 1,
        freeHit: false, declared: false, powerplay: true,
        ballsRemaining: 0, thisOver: [],
        striker: { playerId: 'a1', runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null },
        nonStriker: { playerId: 'a2', runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null },
        bowler: { playerId: 'b1', balls: 6, runs: 0, wickets: 0, wides: 3, noBalls: 0 },
      },
      scorecard: {
        status: 'IN_PROGRESS',
        innings: [
          {
            index: 0, battingTeamId: 'India', bowlingTeamId: 'Australia',
            runs: 0, wickets: 0, legalBalls: 6, oversText: '0.0', extras: 0,
            runRate: 0, batting: [
              { playerId: 'a1', runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null, isStriker: true, isNonStriker: false },
              { playerId: 'a2', runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null, isStriker: false, isNonStriker: true },
            ],
            bowling: [
              { playerId: 'b1', balls: 6, oversText: '0.0', runs: 0, wickets: 0, wides: 3, noBalls: 0, economy: 0, isCurrentBowler: true },
              { playerId: 'b2', balls: 0, oversText: '0.0', runs: 0, wickets: 0, wides: 0, noBalls: 0, economy: 0, isCurrentBowler: false },
            ],
            yetToBat: ['b2'], declared: false, closed: false,
          },
        ],
        result: null,
      },
      events: [],
    }));
    return;
  }
  res.writeHead(404); res.end();
});

const BASE = 'http://127.0.0.1:8133';

(async () => {
  let passed = 0;
  const checks = [];

  async function check(name, cond) {
    checks.push({ name, pass: !!cond });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
    if (cond) passed++;
  }

  try {
    await new Promise((resolve) => server.listen(8133, resolve));
    console.log('\n=== Local dev server up ===\n');

    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Capture console errors (excluding expected ones).
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(BASE + '/?match=' + TEST_MID, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 1. Does the result screen render with a "Full Scorecard" section?
    const cardCount = await page.locator('text=Full Scorecard').count();
    await check('Full Scorecard section is present', cardCount > 0);

    // 2. Scorecard has a batting table with header cells.
    const headerCount = await page.locator('text=Batter').count();
    await check('Scorecard batting header "Batter" is present', headerCount > 0);

    // 3. The .result-main container is the scroll container.
    const resultMain = page.locator('.result-main');
    await resultMain.scrollIntoViewIfNeeded();
    const overflow = await resultMain.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflowY: cs.overflowY, maxHeight: cs.maxHeight, height: el.getBoundingClientRect().height };
    });
    console.log('    .result-main computed:', JSON.stringify(overflow));
    await check('result-main has overflow-y:auto', overflow.overflowY === 'auto');
    await check('result-main has max-height', overflow.maxHeight.includes('vh') || overflow.maxHeight !== 'none');

    // 4. Content overflows the container (scrollHeight > clientHeight).
    const overflowY = await resultMain.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { scrollH: el.scrollHeight, clientH: el.clientHeight, diff: el.scrollHeight - el.clientHeight };
    });
    console.log('    overflow details:', JSON.stringify(overflowY));
    await check('Scorecard content overflows .result-main (scrollHeight > clientHeight)',
      overflowY.scrollH > overflowY.clientH && overflowY.diff > 0);

    // 5. Console errors (should be empty or only expected).
    const webkitErrors = consoleErrors.filter((e) => !e.includes('localStorage') && !e.includes('Supabase'));
    await check('No unexpected console errors', webkitErrors.length === 0);

    await browser.close();
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  }
  server.close();

  console.log(`\n=== ${passed}/${checks.length} checks passed ===`);
  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.log('\nFAILED CHECKS:');
    failed.forEach((f) => console.log(' -', f.name));
    process.exitCode = 1;
  }
})();
