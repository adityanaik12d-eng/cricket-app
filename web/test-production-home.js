import { chromium } from 'playwright';

async function testProductionHome() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Test the production home page
  const homeUrl = `https://cricket-scorer-gold.vercel.app/`;

  console.log('Opening production home URL:', homeUrl);
  await page.goto(homeUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // Check what's on the page
  const pageText = await page.textContent('body');
  console.log('\nPage content preview:', pageText?.substring(0, 1000));

  // Check for specific elements
  const homeElement = page.locator('text=Cricket Scorer').first();
  const homeVisible = await homeElement.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Home page title visible:', homeVisible);

  const newMatchBtn = page.locator('button:has-text("New match"), button:has-text("Create")').first();
  const newMatchVisible = await newMatchBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('New match button visible:', newMatchVisible);

  // Take a screenshot
  await page.screenshot({ path: 'production-home-debug.png', fullPage: true });
  console.log('\nScreenshot saved as production-home-debug.png');

  // Keep browser open
  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testProductionHome().catch(console.error);