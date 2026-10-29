import { chromium } from 'playwright';

async function testCreateMatchFixed() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click New match
  const newMatchBtn = page.locator('button:has-text("New match")').first();
  await newMatchBtn.click();
  await page.waitForTimeout(1000);

  // Fill match form
  await page.fill('input[placeholder="India"]', 'Team A');
  await page.fill('input[placeholder="Australia"]', 'Team B');

  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill('2'); // overs
  await numberInputs.nth(1).fill('3'); // players per team

  // Use "Quick fill" for Team A
  console.log('Quick filling Team A...');
  const quickFillA = page.locator('button:has-text("Quick fill")').first();
  await quickFillA.click();
  await page.waitForTimeout(1000);

  // Use "Quick fill" for Team B
  console.log('Quick filling Team B...');
  const quickFillB = page.locator('button:has-text("Quick fill")').nth(1);
  await quickFillB.click();
  await page.waitForTimeout(1000);

  // Create match
  const createBtn = page.locator('button:has-text("Create match")').first();
  await createBtn.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const matchUrl = page.url();
  console.log('URL after create:', matchUrl);

  const pageText = await page.textContent('body');
  console.log('Page text:', pageText?.substring(0, 1000));

  await page.screenshot({ path: 'debug-create-match-fixed.png', fullPage: true });
  console.log('Screenshot saved as debug-create-match-fixed.png');

  await page.waitForTimeout(30000);
  await browser.close();
}

testCreateMatchFixed().catch(console.error);