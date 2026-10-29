import { chromium } from 'playwright';

async function testCreateMatchFinal() {
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

  // Quick fill
  await page.locator('button:has-text("Quick fill")').first().click();
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Quick fill")').nth(1).click();
  await page.waitForTimeout(1000);

  // Create match (go to toss page)
  await page.locator('button:has-text("Create match")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // On toss page - Team A is toss winner, click Bat
  console.log('Selecting Bat for Team A (toss winner)...');
  await page.locator('button:has-text("Bat")').first().click();
  await page.waitForTimeout(2000);

  // Check for Create/Start button
  const pageText = await page.textContent('body');
  console.log('Page text after toss selection:', pageText?.substring(0, 1000));

  // Look for Create/Start match button
  const buttons = page.locator('button');
  const btnCount = await buttons.count();
  console.log(`\nButtons after toss: ${btnCount}`);
  for (let i = 0; i < btnCount; i++) {
    const btn = buttons.nth(i);
    const text = await btn.textContent().catch(() => '');
    const classes = await btn.getAttribute('class').catch(() => '');
    console.log(`  ${i}: "${text.trim()}" class="${classes}"`);
  }

  // Click Create match / Start match
  const startBtn = page.locator('button:has-text("Create match"), button:has-text("Start match"), button:has-text("Start")').first();
  if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
  } else {
    console.log('No start button found, waiting...');
    await page.waitForTimeout(5000);
  }

  const matchUrl = page.url();
  console.log('Final URL:', matchUrl);

  const finalText = await page.textContent('body');
  console.log('Final page text:', finalText?.substring(0, 1000));

  await page.screenshot({ path: 'debug-create-match-final.png', fullPage: true });
  console.log('Screenshot saved as debug-create-match-final.png');

  await page.waitForTimeout(30000);
  await browser.close();
}

testCreateMatchFinal().catch(console.error);