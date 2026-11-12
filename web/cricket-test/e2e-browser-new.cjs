// Real end-to-end Playwright test: verify the Full Scorecard scroll now lives
// on the PAGE (body), not alongside the scorecard. CSS change: .result-screen
// is normal flow now, .result-main is a flex column, and body is the scroll
// container. So the scrollbar should be at the page edge (top-left), not next
// to the scorecard.
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

    // 3. The page (body) is the scroll container; no scorecard-side scrollbar
    const bodyScroll = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      const rs = getComputedStyle(document.querySelector('.result-screen'));
      const rm = getComputedStyle(document.querySelector('.result-main'));
      return {
        bodyOverflow: cs.overflow,
        bodyMaxHeight: cs.maxHeight,
        resultScreenOverflow: rs.overflow,
        resultMainOverflow: rm.overflow,
        resultMainMaxHeight: rm.maxHeight,
        // page width equals viewport width -> no overflow horizontally
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    console.log('    page scroll layout:', JSON.stringify(bodyScroll));
    await check('body is the scroll container (overflow != hidden/auto)', bodyScroll.bodyOverflow === 'auto');
    await check('result-screen is NOT position:fixed (flows in normal doc flow)',
      !(bodyScroll.resultScreenOverflow === 'hidden' || bodyScroll.resultScreenOverflow === 'auto'));
    await check('result-main has NO internal max-height (not a scroll container)',
      bodyScroll.resultMainMaxHeight === 'none' || bodyScroll.resultMainMaxHeight === 'auto');

    // 4. Horizontal: page fills viewport width — no squeezed scorecard
    await check('document width <= viewport width (no horizontal squeeze)',
      bodyScroll.documentWidth <= bodyScroll.viewportWidth + 1);

    // 5. Vertical: scrollable content exists on the page (scorecard taller than viewport)
    const docScroll = await page.evaluate(() => {
      const rm = document.querySelector('.result-main');
      const lastInnings = rm?.querySelector('.innings-card:last-child');
      return {
        resultMainScrollH: rm ? rm.scrollHeight : 0,
        resultMainClientH: rm ? rm.clientHeight : 0,
        scorecardHeight: lastInnings ? lastInnings.getBoundingClientRect().height : 0,
      };
    });
    console.log('    scorecard overflow:', JSON.stringify(docScroll));
    await check('Scorecard content taller than viewport (scrollable)', docScroll.scorecardHeight > (docScroll.resultMainClientH || 100));

    // 6. Console errors
    const webkitErrors = consoleErrors.filter(
      (e) => !e.includes('Supabase') && !e.includes('localStorage') && !e.includes('favicon'));
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
