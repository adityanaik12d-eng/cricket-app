import { chromium } from 'playwright';

async function testEndedMatch() {
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

  // Get all match cards on home page
  const matchCards = page.locator('.match-card, .card:has-text("vs")');
  const count = await matchCards.count();
  console.log(`Found ${count} match cards`);

  for (let i = 0; i < count; i++) {
    const card = matchCards.nth(i);
    const text = await card.textContent().catch(() => '');
    const classes = await card.getAttribute('class').catch(() => '');
    console.log(`Card ${i}: class="${classes}", text="${text?.substring(0, 100)}"`);
  }

  // Look for ended/completed matches (not LIVE)
  // The home page shows matches with different statuses
  // Let's click on the first non-LIVE match or any match
  for (let i = 0; i < count; i++) {
    const card = matchCards.nth(i);
    const text = await card.textContent().catch(() => '');
    if (text && text.includes('vs')) {
      console.log(`\nClicking match card ${i}: "${text?.substring(0, 50)}"`);
      await card.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      console.log('Navigated to:', page.url());

      // Extract match ID
      const matchIdMatch = page.url().match(/match\/([^\/]+)/);
      if (matchIdMatch) {
        const matchId = matchIdMatch[1];
        console.log('Match ID:', matchId);

        // Check if this is the user's match ID
        if (matchId === '42cde080-43ad-40ef-a2aa-5270affec4c9') {
          console.log('*** THIS IS THE USER\'S MATCH ID ***');
        }

        // Go to report tab if not already there
        if (!page.url().includes('/report')) {
          const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/report`;
          console.log('Going to report tab:', reportUrl);
          await page.goto(reportUrl);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(5000);
        }

        // Check report page
        const pageText = await page.textContent('body');
        console.log('Report page content:', pageText?.substring(0, 1000));

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
        await page.screenshot({ path: `production-match-${matchId}-report.png`, fullPage: true });
        console.log(`Screenshot saved as production-match-${matchId}-report.png`);

        break; // Just test the first match
      }
      break;
    }
  }

  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testEndedMatch().catch(console.error);