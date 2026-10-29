import { chromium } from 'playwright';

async function testNonExistentMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Test a clearly non-existent match ID
  const matchId = '00000000-0000-0000-0000-000000000000';
  const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/report`;

  console.log('Opening non-existent match report URL:', reportUrl);
  await page.goto(reportUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // Check what's on the page
  const pageText = await page.textContent('body');
  console.log('\nPage content preview:', pageText?.substring(0, 1000));

  // Take screenshot
  await page.screenshot({ path: 'production-nonexistent-match.png', fullPage: true });
  console.log('\nScreenshot saved as production-nonexistent-match.png');

  // Keep browser open
  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testNonExistentMatch().catch(console.error);