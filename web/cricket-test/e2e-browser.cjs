// Real end-to-end Playwright test: verified the Full Scorecard scrolls on the
// 1-over / 2-player test match. Run this against the already-running local
// backend + vite dev server.

const { chromium } = require('playwright');

const TEST_MID = '7751759f-738a-4472-813d-05fb508f9d26';
const BASE = 'http://127.0.0.1:8133';
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
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(BASE + '/?match=' + TEST_MID, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 1. Full Scorecard section present
    const cardCount = await page.locator('text=Full Scorecard').count();
    await check('Full Scorecard section is present', cardCount > 0);

    // 2. Scorecard batting header
    const headerCount = await page.locator('text=Batter').count();
    await check('Scorecard batting header "Batter" present', headerCount > 0);

    // 3. .result-main is the scroll container
    const resultMain = page.locator('.result-main');
    const overflowY = await resultMain.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflowY: cs.overflowY, maxHeight: cs.maxHeight, height: el.getBoundingClientRect().height };
    });
    console.log('    .result-main computed:', JSON.stringify(overflowY));
    await check('result-main has overflow-y:auto', overflowY.overflowY === 'auto');
    await check('result-main has max-height', overflowY.maxHeight !== 'none');

    // 4. Content overflows
    const overflowY2 = await resultMain.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { scrollH: el.scrollHeight, clientH: el.clientHeight, diff: el.scrollHeight - el.clientHeight };
    });
    console.log('    overflow details:', JSON.stringify(overflowY2));
    await check('Scorecard content overflows .result-main (scrollHeight > clientHeight)',
      overflowY2.scrollH > overflowY2.clientH && overflowY2.diff > 0);

    // 5. Console errors
    const webkitErrors = consoleErrors.filter((e) => !e.includes('localStorage') && !e.includes('Supabase') && !e.includes('favicon'));
    await check('No unexpected console errors', webkitErrors.length === 0);

    await browser.close();
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  }
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n=== ${checks.length - failed.length}/${checks.length} checks passed ===`);
  if (failed.length) {
    console.log('\nFAILED CHECKS:');
    failed.forEach((f) => console.log(' -', f.name));
    process.exitCode = 1;
  }
})();
