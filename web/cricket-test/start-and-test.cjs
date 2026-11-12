// Start a test stack for the web app:
//   - Mock Supabase REST API on http://localhost:3001
//   - Vite dev server on http://localhost:8133 (proxy /matches + /auth -> 3333)
// Then run the Playwright browser test.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

// 1) Mock Supabase REST API.
const DB = [
  {
    id: '7751759f-738a-4472-813d-05fb508f9d26',
    config: {
      teamAId: 'India', teamBId: 'Australia',
      lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
      oversPerInnings: 1, inningsCount: 2, ballsPerOver: 6,
      maxOversPerBowler: 4, maxWickets: 10, powerplayOvers: 1,
      wideExtra: 1, noBallExtra: 1, minutesPerOver: 4,
    },
    events: [],
    updated_at: '2026-10-29T12:00:00Z',
  },
];
const mockSupabase = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, x-scorer-token');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/^\/rest\/v1\//, '');
  if (req.method === 'GET' && pathname.startsWith('matches')) {
    const idFilter = url.searchParams.get('id') || '';
    const matchId = idFilter.replace('eq.', '');
    const match = DB.find((m) => m.id === matchId);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
      return;
    }
    const row = { id: match.id, config: match.config, events: match.events, updated_at: match.updated_at };
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Location': `https://${url.searchParams.get('apikey') || 'test'}.supabase.co/rest/v1/matches`,
    });
    res.end(JSON.stringify([row]));
    return;
  }
  if (req.method === 'GET' && pathname === '/auth/v1/user') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: { id: 'test-user', email: null, user_metadata: {} } }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'not found' } }));
});

// 2) Vite dev server with a proxy to the local backend (3333) + mock Supabase env.
const vite = spawn('npx', ['vite', '--config', 'cricket-test/vite.config.test.ts', '--port', '8133', '--host', '127.0.0.1'], {
  stdio: 'pipe',
  env: { ...process.env, VITE_SUPABASE_URL: 'http://localhost:3001', VITE_SUPABASE_ANON_KEY: 'test' },
});

let out = '';
vite.stdout.on('data', (d) => { out += d; });
vite.stderr.on('data', (d) => { out += d; });
vite.on('close', (code) => console.error('vite exited with code', code));
vite.on('error', (e) => console.error('vite error:', e.message));

// 3) Playwright browser test.
const { chromium } = require('playwright');
const TEST_MID = '7751759f-738a-4472-813d-05fb508f9d26';
const checks = [];
function check(name, cond) {
  checks.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

(async () => {
  try {
    const browser = await chromium.launch({
      executablePath: 'C:/Users/IT/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await page.goto('http://127.0.0.1:8133/?match=' + TEST_MID, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const cardCount = await page.locator('text=Full Scorecard').count();
    await check('Full Scorecard section is present', cardCount > 0);

    const headerCount = await page.locator('text=Batter').count();
    await check('Scorecard batting header "Batter" present', headerCount > 0);

    const resultMain = page.locator('.result-main');
    const overflowY = await resultMain.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflowY: cs.overflowY, maxHeight: cs.maxHeight, height: el.getBoundingClientRect().height };
    });
    console.log('    .result-main computed:', JSON.stringify(overflowY));
    await check('result-main has overflow-y:auto', overflowY.overflowY === 'auto');
    await check('result-main has max-height', overflowY.maxHeight !== 'none');

    const overflowY2 = await resultMain.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { scrollH: el.scrollHeight, clientH: el.clientHeight, diff: el.scrollHeight - el.clientHeight };
    });
    console.log('    overflow details:', JSON.stringify(overflowY2));
    await check('Scorecard content overflows .result-main (scrollHeight > clientHeight)',
      overflowY2.scrollH > overflowY2.clientH && overflowY2.diff > 0);

    const webkitErrors = consoleErrors.filter((e) => !e.includes('Supabase') && !e.includes('localStorage') && !e.includes('favicon'));
    await check('No unexpected console errors', webkitErrors.length === 0);

    await browser.close();
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  }
  console.log(`\n=== ${checks.length - checks.filter((c) => !c.pass).length}/${checks.length} checks passed ===`);
  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.log('\nFAILED CHECKS:');
    failed.forEach((f) => console.log(' -', f.name));
    process.exitCode = 1;
  }
})();
