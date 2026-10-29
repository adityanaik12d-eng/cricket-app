import { chromium } from 'playwright';

async function testUserMatchAPI() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Try to call the API directly from the browser console
  const matchId = '42cde080-43ad-40ef-a2aa-5270affec4c9';

  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Try to fetch the match via the API from the browser
  const apiResult = await page.evaluate(async (id) => {
    try {
      // Try to call the internal API
      const response = await fetch(`https://cricket-scorer-gold.vercel.app/api/match/${id}`);
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  }, matchId);

  console.log('API result:', apiResult);

  // Also check if the match appears on home page
  const pageText = await page.textContent('body');
  const hasMatch = pageText?.includes(matchId) || pageText?.includes('42cde080');
  console.log('Match ID appears on home page:', hasMatch);

  // Take screenshot
  await page.screenshot({ path: 'production-api-test.png', fullPage: true });
  console.log('\nScreenshot saved as production-api-test.png');

  // Keep browser open
  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testUserMatchAPI().catch(console.error);