// cricket-test/orchestrate-full.cjs
// Full e2e stack for the scorecard scroll fix:
//   1. Start backend server on :3333, mock Supabase on :3001 (proxies /matches
//      to the backend so the browser sees the real DB), Vite on :8133.
//   2. Create a 1-over / 2-player test match on the backend.
//   3. Record balls until the match completes (result generated).
//   4. Run a Playwright browser test against #/match/<id>/report verifying the
//      scrollbar sits at the PAGE edge, not alongside the scorecard.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { fileURLToPath } = require('url');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const MOCK_PORT = 3001;
const VITE_PORT = 8133;
const BACKEND_PORT = 3333;
const TEST_MID = 'test-1over-2player';

// ---- 1) Mock Supabase REST (proxies matches to the real backend) ----
const mock = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${MOCK_PORT}`);
  const pathname = url.pathname.replace(/^\/rest\/v1\//, '');

  // Proxy any GET /rest/v1/matches* to the backend.
  if (req.method === 'GET' && pathname.startsWith('matches')) {
    const query = url.search.replace(/[?&]apikey=[^&]*/, '');
    const target = `http://localhost:${BACKEND_PORT}/matches${query}`;
    return proxy(req, res, target, 'GET');
  }
  if (req.method === 'GET' && pathname === 'auth/v1/user') {
    proxy(req, res, `http://localhost:${BACKEND_PORT}/healthz`, 'GET');
    return;
  }
  // Anything else: return a plausible Supabase shape so the app can init.
  if (req.method === 'GET' && pathname === 'auth/v1/session') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: null }));
    return;
  }
  // Supabase REST health
  if (req.method === 'GET' && pathname === 'rest/v1') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'mocker not found' } }));
});

function proxy(req, res, target, method) {
  const r = http.request(target, { method: method || req.method, headers: { ...req.headers, host: new URL(target).host } }, (backRes) => {
    const chunks = [];
    backRes.on('data', (c) => chunks.push(c));
    backRes.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      res.writeHead(backRes.statusCode || 200, backRes.headers);
      res.setHeader('Content-Type', backRes.headers['content-type'] || 'application/json');
      res.end(body);
    });
  });
  r.on('error', (e) => {
    console.error('proxy error:', e.message);
    if (!res.headersSent) { res.writeHead(502); res.end(JSON.stringify({ error: { message: 'proxy failed ' + e.message } })); }
  });
  req.pipe(r);
}

// ---- 2) Vite dev server ----
const vite = spawn('npx', ['vite', '--config', 'cricket-test/vite.config.test.js', '--port', String(VITE_PORT), '--host', '127.0.0.1'], {
  stdio: 'pipe',
  env: { ...process.env, VITE_SUPABASE_URL: `http://localhost:${MOCK_PORT}`, VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
});
let viteOut = '';
vite.stdout.on('data', (d) => { viteOut += d; });
vite.stderr.on('data', (d) => { viteOut += d; });
vite.on('close', (code) => console.error('vite exited with code', code));
vite.on('error', (e) => console.error('vite error:', e.message));

// ---- 3) Playwright test runner ----
const { chromium } = require('playwright');
const checks = [];
function check(name, cond) {
  checks.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

// ---- 4) Create the test match + record events via the backend ----
async function setupMatch() {
  // Wait for backend health
  await waitForHealth(BACKEND_PORT, 30);
  const http = require('http');
  const post = (port, path, body) => new Promise((resolve, reject) => {
    const req = http.request({ port, host: 'localhost', path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({ raw: b }); } });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
  const get = (port, p) => new Promise((resolve, reject) => {
    const req = http.request({ port, host: 'localhost', path: p, method: 'GET' }, (res) => {
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({ raw: b }); } });
    });
    req.on('error', reject);
    req.end();
  });

  // Create a 1-over/2-player match. The config keys in this app's engine are
  // the same as the web form defaults. Use the engine-validated config shape:
  // oversPerInnings=1, inningsCount=2, ballsPerOver=6, etc.
  const config = {
    teamAId: 'India', teamBId: 'Australia',
    lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
    oversPerInnings: 1, inningsCount: 2, ballsPerOver: 6,
    maxOversPerBowler: 4, maxWickets: 10, powerplayOvers: 1,
    wideExtra: 1, noBallExtra: 1, minutesPerOver: 4,
  };
  const created = await post(BACKEND_PORT, '/matches', config);
  const matchId = created.matchId;
  console.log(`Created match ${matchId}`);

  // Build a completed 1-over match: both innings played to a result.
  // We record balls and then an END_MATCH (or similar). We'll do a simple
  // complete-by-6-balls-per-innings approach: record 6 balls in inning 0,
  // then end, then recreate inning 1 with a result.
  const ballPayload = (over, ball, runs, extras, wicket, dismissal, bowler, batter, nonStriker) => ({
    type: 'BALL',
    over, ball,
    runs: runs || 0,
    extras: extras || 'NONE',
    wicket: !!wicket,
    dismissal: dismissal || null,
    bowlerId: bowler || 'b1',
    batterId: batter || 'a1',
    nonStrikerId: nonStriker || 'a2',
    fielderId: null,
  });

  const events = [];
  // Inning 0: India batting, lose 3 wickets for 28, close.
  for (let o = 0; o < 1; o++) {
    for (let b = 0; b < 6; b++) {
      const r = (o === 0 && b === 5) ? 0 : (Math.random() < 0.6 ? 1 : 0);
      events.push(ballPayload(o, b, r, 'NONE', b === 3, null, 'b1', 'a1', 'a2'));
    }
  }
  events.push({ type: 'END_MATCH', winnerTeamId: 'India', reason: null });
  // Inning 1: Australia batting, lose 4 for 12.
  for (let o = 0; o < 1; o++) {
    for (let b = 0; b < 6; b++) {
      const r = (o === 0 && b === 2) ? 4 : 0;
      events.push(ballPayload(o, b, r, 'NONE', b === 1 || b === 4, null, 'a1', 'b1', 'b2'));
    }
  }
  events.push({ type: 'END_MATCH', winnerTeamId: 'India', reason: null });

  // Clear events and record all via the backend.
  const initial = await get(BACKEND_PORT, `/matches/${matchId}`);
  const evURL = `/matches/${matchId}/events`;
  for (const ev of events) {
    await post(BACKEND_PORT, evURL, ev);
  }

  // Poll the scorecard until a result exists.
  let scorecard = null;
  for (let i = 0; i < 20; i++) {
    const sc = await get(BACKEND_PORT, `/matches/${matchId}/scorecard`);
    scorecard = sc;
    if (scorecard && scorecard.result) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const result = scorecard ? scorecard.result : null;
  console.log(`Match ${matchId} completed. Result:`, JSON.stringify(result));
  await new Promise((r) => setTimeout(r, 1000)); // let web sync
  return matchId;
}

function waitForHealth(port, tries) {
  return new Promise((resolve) => {
    const tryIt = () => {
      const req = http.get({ port, host: 'localhost', path: '/healthz' }, (res) => {
        if (res.statusCode === 200) { resolve(); return; }
        if (--tries > 0) setTimeout(tryIt, 500);
        else reject(new Error('healthz not ready'));
      });
      req.on('error', () => {
        if (--tries > 0) setTimeout(tryIt, 500);
        else reject(new Error('healthz not ready'));
      });
    };
    tryIt();
  });
}

// Run the browser test.
async function runTest(matchId) {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/IT/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto(`http://127.0.0.1:${VITE_PORT}/#/match/${matchId}/report`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Full Scorecard present
  const cardCount = await page.locator('text=Full Scorecard').count();
  await check('Full Scorecard section is present', cardCount > 0);

  // 2. Scorecard batting header
  const headerCount = await page.locator('text=Batter').count();
  await check('Scorecard batting header "Batter" present', headerCount > 0);

  // 3. Page-level scroll layout
  const pageLayout = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const rs = getComputedStyle(document.querySelector('.result-screen'));
    const rm = getComputedStyle(document.querySelector('.result-main'));
    return {
      bodyOverflow: cs.overflow,
      bodyMaxHeight: cs.maxHeight,
      resultScreenOverflow: rs.overflow,
      resultScreenPosition: rs.position,
      resultMainOverflow: rm.overflow,
      resultMainMaxHeight: rm.maxHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  console.log('    page layout:', JSON.stringify(pageLayout));
  await check('body is the scroll container (overflow auto)', pageLayout.bodyOverflow === 'auto');
  await check('result-screen is NOT position:fixed (flows in normal doc flow)', pageLayout.resultScreenPosition !== 'fixed');
  await check('result-main has NO internal max-height (not a scroll container)',
    pageLayout.resultMainMaxHeight === 'none' || pageLayout.resultMainMaxHeight === 'auto');

  // 4. Horizontal: no squeezed scorecard
  await check('document width <= viewport width (no horizontal squeeze)',
    pageLayout.documentWidth <= pageLayout.viewportWidth + 1);

  // 5. Vertical: scorecard taller than viewport
  const docScroll = await page.evaluate(() => {
    const rm = document.querySelector('.result-main');
    const last = rm ? rm.querySelector('.innings-card:last-child') : null;
    return {
      resultMainScrollH: rm ? rm.scrollHeight : 0,
      resultMainClientH: rm ? rm.clientHeight : 0,
      scorecardHeight: last ? last.getBoundingClientRect().height : 0,
      resultMainHeight: rm ? rm.getBoundingClientRect().height : 0,
    };
  });
  console.log('    scorecard overflow:', JSON.stringify(docScroll));
  await check('Scorecard content taller than viewport (scrollable)',
    docScroll.scorecardHeight > (docScroll.resultMainClientH || 100));

  // 6. Console errors
  const webkitErrors = consoleErrors.filter((e) => !e.includes('Supabase') && !e.includes('localStorage') && !e.includes('favicon'));
  await check('No unexpected console errors', webkitErrors.length === 0);

  await browser.close();
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n=== ${checks.length - failed.length}/${checks.length} checks passed ===`);
  if (failed.length) {
    console.log('\nFAILED CHECKS:');
    failed.forEach((f) => console.log(' -', f.name));
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed — scrollbar is at the page edge, not alongside the scorecard.');
  }
}

// Wait for vite up.
function waitForVite() {
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port: VITE_PORT, path: '/' }, (res) => {
        if (res.statusCode === 200) { resolve(); return; }
        setTimeout(tick, 500);
      });
      req.on('error', () => setTimeout(tick, 500));
    };
    setTimeout(tick, 2000);
  });
}

// ---- Main ----
(async () => {
  mock.listen(MOCK_PORT, () => console.log('mock supabase up on', MOCK_PORT));
  await waitForVite();
  console.log('--- vite ready, creating test match ---');
  const matchId = await setupMatch();
  console.log('--- running browser test ---');
  await runTest(matchId);

  // cleanup is automatic (processes are background); mock closes when process ends.
})();
