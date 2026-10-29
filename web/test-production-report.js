import { chromium } from 'playwright';

async function testProductionReport() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Test the user's specific match URL
  const matchId = '42cde080-43ad-40ef-a2aa-5270affec4c9';
  const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/report`;

  console.log('Opening production report URL:', reportUrl);
  await page.goto(reportUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // Check what's on the page
  const pageText = await page.textContent('body');
  console.log('\nPage content preview:', pageText?.substring(0, 1000));

  // Check for specific elements
  const reportElement = page.locator('.report').first();
  const reportVisible = await reportElement.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Report element visible:', reportVisible);

  const headline = page.locator('.report-headline').first();
  const headlineText = await headline.textContent().catch(() => 'NOT FOUND');
  console.log('Headline text:', headlineText);

  const inningsSummaries = page.locator('.innings-summary');
  const inningsCount = await inningsSummaries.count();
  console.log('Innings summaries count:', inningsCount);

  // Check if there's any error or loading state
  const loadingElement = page.locator('text=Loading');
  const loadingVisible = await loadingElement.isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Loading visible:', loadingVisible);

  const errorElement = page.locator('.error');
  const errorVisible = await errorElement.isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Error visible:', errorVisible);

  // Check for JavaScript errors in console
  console.log('\nChecking for any visible content...');
  const bodyHtml = await page.content();
  console.log('Body contains "report":', bodyHtml.includes('report'));
  console.log('Body contains "Match in progress":', bodyHtml.includes('Match in progress'));
  console.log('Body contains "innings-summary":', bodyHtml.includes('innings-summary'));
  console.log('Body contains "commentary":', bodyHtml.includes('commentary'));
  console.log('Body contains "Match created":', bodyHtml.includes('Match created'));
  console.log('Body contains "Superover":', bodyHtml.includes('Superover'));

  // Take a screenshot for debugging
  await page.screenshot({ path: 'production-report-tab-debug.png', fullPage: true });
  console.log('\nScreenshot saved as production-report-tab-debug.png');

  // Keep browser open for viewing
  console.log('\nKeeping browser open for 60 seconds for you to inspect...');
  await page.waitForTimeout(60000);
  await browser.close();
}

testProductionReport().catch(console.error);