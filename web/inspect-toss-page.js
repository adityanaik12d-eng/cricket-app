import { chromium } from 'playwright';

async function inspectTossPage() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click New match
  await page.locator('button:has-text("New match")').first().click();
  await page.waitForTimeout(1000);

  // Fill match form
  await page.fill('input[placeholder="India"]', 'Team A');
  await page.fill('input[placeholder="Australia"]', 'Team B');

  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill('2');
  await numberInputs.nth(1).fill('3');

  // Quick fill
  await page.locator('button:has-text("Quick fill")').first().click();
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Quick fill")').nth(1).click();
  await page.waitForTimeout(1000);

  // Create match (go to toss page)
  await page.locator('button:has-text("Create match")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Inspect toss page
  console.log('=== TOSS PAGE ===');

  // Get all inputs
  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  console.log(`Inputs: ${inputCount}`);
  for (let i = 0; i < inputCount; i++) {
    const el = inputs.nth(i);
    const type = await el.getAttribute('type').catch(() => '');
    const name = await el.getAttribute('name').catch(() => '');
    const value = await el.getAttribute('value').catch(() => '');
    console.log(`  ${i}: type="${type}" name="${name}" value="${value}"`);
  }

  // Get all buttons
  const buttons = page.locator('button');
  const btnCount = await buttons.count();
  console.log(`\nButtons: ${btnCount}`);
  for (let i = 0; i < btnCount; i++) {
    const btn = buttons.nth(i);
    const text = await btn.textContent().catch(() => '');
    const classes = await btn.getAttribute('class').catch(() => '');
    console.log(`  ${i}: "${text.trim()}" class="${classes}"`);
  }

  // Get all labels (for radio buttons)
  const labels = page.locator('label');
  const labelCount = await labels.count();
  console.log(`\nLabels: ${labelCount}`);
  for (let i = 0; i < labelCount; i++) {
    const text = await labels.nth(i).textContent().catch(() => '');
    console.log(`  ${i}: "${text.trim()}"`);
  }

  // Get page text
  const pageText = await page.textContent('body');
  console.log('\nPage text:', pageText?.substring(0, 1000));

  await page.screenshot({ path: 'debug-toss-page.png', fullPage: true });
  console.log('\nScreenshot saved as debug-toss-page.png');

  await page.waitForTimeout(30000);
  await browser.close();
}

inspectTossPage().catch(console.error);