import { chromium } from 'playwright';

async function testUserMatchScoring() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Test the user's specific match URL - scoring tab
  const matchId = '42cde080-43ad-40ef-a2aa-5270affec4c9';
  const scoringUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/scoring`;

  console.log('Opening production scoring URL:', scoringUrl);
  await page.goto(scoringUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // Check what's on the page
  const pageText = await page.textContent('body');
  console.log('\nPage content preview:', pageText?.substring(0, 1000));

  // Take screenshot
  await page.screenshot({ path: 'production-user-match-scoring.png', fullPage: true });
  console.log('\nScreenshot saved as production-user-match-scoring.png');

  // Keep browser open
  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testUserMatchScoring().catch(console.error);