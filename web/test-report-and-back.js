import { chromium } from 'playwright';

async function testMatchReportAndBack() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Test the match that was created
  const matchId = 'caa2dc56-b391-435b-8ade-c2a880622d44';
  const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/report`;

  console.log('=== Going to report page ===');
  await page.goto(reportUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const reportText = await page.textContent('body');
  console.log('Report page content:', reportText?.substring(0, 1500));

  await page.screenshot({ path: `production-match-${matchId}-report.png`, fullPage: true });
  console.log('Screenshot saved as production-match-report.png');

  // Check for MatchResultScreen or completed status
  if (reportText?.includes('COMPLETED') || reportText?.includes('won by') || reportText?.includes('Match result')) {
    console.log('*** MATCH APPEARS COMPLETED ***');
  } else if (reportText?.includes('in progress') || reportText?.includes('Match in progress')) {
    console.log('*** MATCH IS IN PROGRESS ***');
  }

  // Go back to home
  console.log('\n=== Go back to home ===');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const homeText = await page.textContent('body');
  console.log('Home page after back:', homeText?.substring(0, 500));

  await page.screenshot({ path: 'production-home-after-back2.png', fullPage: true });
  console.log('Screenshot saved as production-home-after-back2.png');

  // Check if home page is blank/broken
  if (!homeText?.includes('Cricket Scorer') || !homeText?.includes('New match')) {
    console.log('*** HOME PAGE APPEARS BLANK/BROKEN ***');
  } else {
    console.log('*** HOME PAGE LOOKS OK ***');
  }

  // Try clicking the match card again
  console.log('\n=== Click match card again ===');
  const matchCard = page.locator('.match-card').first();
  if (await matchCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await matchCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const matchPageText = await page.textContent('body');
    console.log('Match page after re-click:', matchPageText?.substring(0, 500));

    // Go to report tab
    await page.goto(reportUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const reportText2 = await page.textContent('body');
    console.log('Report page after re-click:', reportText2?.substring(0, 500));
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

testMatchReportAndBack().catch(console.error);