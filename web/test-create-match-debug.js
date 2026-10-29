import { chromium } from 'playwright';

async function testCreateMatchDebug() {
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
  await numberInputs.nth(0).fill('2');
  await numberInputs.nth(1).fill('3');

  // Check if there are player name inputs that need filling
  const playerInputs = page.locator('input[placeholder="Player name"]');
  const playerCount = await playerInputs.count();
  console.log(`Found ${playerCount} player name inputs`);

  // Fill player names for both teams
  for (let i = 0; i < playerCount; i++) {
    await playerInputs.nth(i).fill(`Player ${i + 1}`);
  }

  // Create match
  const createBtn = page.locator('button:has-text("Create match")').first();
  await createBtn.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const matchUrl = page.url();
  console.log('URL after create:', matchUrl);

  const pageText = await page.textContent('body');
  console.log('Page text:', pageText?.substring(0, 1000));

  await page.screenshot({ path: 'debug-create-match.png', fullPage: true });
  console.log('Screenshot saved as debug-create-match.png');

  await page.waitForTimeout(30000);
  await browser.close();
}

testCreateMatchDebug().catch(console.error);