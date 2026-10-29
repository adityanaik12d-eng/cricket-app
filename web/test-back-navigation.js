import { chromium } from 'playwright';

async function testBackNavigation() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Step 1: Open home page
  console.log('=== Step 1: Open home page ===');
  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const homeText1 = await page.textContent('body');
  console.log('Home page content:', homeText1?.substring(0, 200));

  // Step 2: Click on the live match
  console.log('\n=== Step 2: Click on live match ===');
  const matchCard = page.locator('.match-card').first();
  await matchCard.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const matchUrl = page.url();
  console.log('Match URL:', matchUrl);

  const matchText = await page.textContent('body');
  console.log('Match page content:', matchText?.substring(0, 300));

  // Step 3: Navigate to report tab if not already there
  if (!matchUrl.includes('/report')) {
    const matchIdMatch = matchUrl.match(/match\/([^\/]+)/);
    if (matchIdMatch) {
      const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchIdMatch[1]}/report`;
      console.log('Going to report tab:', reportUrl);
      await page.goto(reportUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const reportText = await page.textContent('body');
      console.log('Report tab content:', reportText?.substring(0, 300));
    }
  }

  // Step 4: Go back using browser back button (alt+left arrow equivalent)
  console.log('\n=== Step 4: Go back to home (browser back) ===');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const homeText2 = await page.textContent('body');
  console.log('Home page after back:', homeText2?.substring(0, 300));

  // Check for errors
  const bodyHtml = await page.content();
  console.log('Body contains "Cricket Scorer":', bodyHtml.includes('Cricket Scorer'));
  console.log('Body contains "New match":', bodyHtml.includes('New match'));
  console.log('Body contains "LIVE":', bodyHtml.includes('LIVE'));

  // Step 5: Try clicking home button in the app
  console.log('\n=== Step 5: Click Home button in app ===');
  const homeBtn = page.locator('button:has-text("Home"), a:has-text("Home"), [href="#/"]').first();
  if (await homeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await homeBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const homeText3 = await page.textContent('body');
    console.log('Home page after Home button:', homeText3?.substring(0, 300));
  }

  // Take screenshot
  await page.screenshot({ path: 'production-back-nav-test.png', fullPage: true });
  console.log('\nScreenshot saved as production-back-nav-test.png');

  // Keep browser open
  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testBackNavigation().catch(console.error);