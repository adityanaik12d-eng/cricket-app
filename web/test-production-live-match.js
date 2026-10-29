import { chromium } from 'playwright';

async function testProductionLiveMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Open production home page
  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Find the live match and click it
  console.log('Looking for live match...');
  const liveMatchLink = page.locator('a:has-text("india vs australia"), button:has-text("india vs australia"), [href*="match"]').first();

  // Try to find the match link
  const matchLinks = await page.locator('a[href*="/match/"]').all();
  console.log(`Found ${matchLinks.length} match links`);

  for (let i = 0; i < matchLinks.length; i++) {
    const href = await matchLinks[i].getAttribute('href');
    const text = await matchLinks[i].textContent();
    console.log(`Link ${i}: href="${href}", text="${text}"`);
  }

  // Click the first match link that contains "india" or "australia"
  for (const link of matchLinks) {
    const text = await link.textContent();
    if (text && (text.toLowerCase().includes('india') || text.toLowerCase().includes('australia'))) {
      const href = await link.getAttribute('href');
      console.log(`Clicking match link: ${href}`);
      await link.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      break;
    }
  }

  // Check current URL
  const currentUrl = page.url();
  console.log('Current URL after click:', currentUrl);

  // Extract match ID from URL
  const matchIdMatch = currentUrl.match(/match\/([^\/]+)/);
  if (matchIdMatch) {
    const matchId = matchIdMatch[1];
    console.log('Match ID:', matchId);

    // Now navigate to report tab
    const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/report`;
    console.log('Navigating to report tab:', reportUrl);
    await page.goto(reportUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Check what's on the page
    const pageText = await page.textContent('body');
    console.log('\nPage content preview:', pageText?.substring(0, 1000));

    // Check for report elements
    const reportElement = page.locator('.report').first();
    const reportVisible = await reportElement.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Report element visible:', reportVisible);

    const headline = page.locator('.report-headline').first();
    const headlineText = await headline.textContent().catch(() => 'NOT FOUND');
    console.log('Headline text:', headlineText);

    const inningsSummaries = page.locator('.innings-summary');
    const inningsCount = await inningsSummaries.count();
    console.log('Innings summaries count:', inningsCount);

    // Take screenshot
    await page.screenshot({ path: 'production-live-match-report.png', fullPage: true });
    console.log('\nScreenshot saved as production-live-match-report.png');
  }

  // Keep browser open
  console.log('\nKeeping browser open for 60 seconds...');
  await page.waitForTimeout(60000);
  await browser.close();
}

testProductionLiveMatch().catch(console.error);