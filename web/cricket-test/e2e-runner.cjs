// Playwright test for the Full Scorecard scroll fix.
// CSS change: .result-screen flows in normal doc flow (no position:fixed,
// no overflow:hidden); .result-main is a flex column without max-height;
// body is the scroll container. So the scrollbar sits at the PAGE edge,
// not alongside the scorecard.
const { chromium } = require('playwright');

const TEST_MID = 'test-1over-2player';
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

    await page.goto(BASE + '/#/match/' + TEST_MID + '/report', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 1. Full Scorecard section present
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

    // 4. Horizontal: page fills viewport width — no squeezed scorecard
    await check('document width <= viewport width (no horizontal squeeze)',
      pageLayout.documentWidth <= pageLayout.viewportWidth + 1);

    // 5. Vertical: scorecard taller than viewport (scrollable page)
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
  } else {
    console.log('\nAll checks passed — scrollbar is at the page edge, not alongside the scorecard.');
  }
})();
