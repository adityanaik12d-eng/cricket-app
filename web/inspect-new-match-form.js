import { chromium } from 'playwright';

async function inspectNewMatchForm() {
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
  await page.waitForTimeout(2000);

  // Get all form elements
  const inputs = page.locator('input, select, textarea');
  const count = await inputs.count();
  console.log(`Found ${count} form elements:`);

  for (let i = 0; i < count; i++) {
    const el = inputs.nth(i);
    const tag = await el.evaluate(e => e.tagName.toLowerCase());
    const type = await el.getAttribute('type').catch(() => '');
    const name = await el.getAttribute('name').catch(() => '');
    const placeholder = await el.getAttribute('placeholder').catch(() => '');
    const id = await el.getAttribute('id').catch(() => '');
    const classes = await el.getAttribute('class').catch(() => '');
    console.log(`  ${i}: <${tag} type="${type}" name="${name}" placeholder="${placeholder}" id="${id}" class="${classes}">`);
  }

  // Get all buttons
  const buttons = page.locator('button');
  const btnCount = await buttons.count();
  console.log(`\nFound ${btnCount} buttons:`);
  for (let i = 0; i < btnCount; i++) {
    const btn = buttons.nth(i);
    const text = await btn.textContent().catch(() => '');
    const classes = await btn.getAttribute('class').catch(() => '');
    console.log(`  ${i}: "${text.trim()}" class="${classes}"`);
  }

  // Take screenshot
  await page.screenshot({ path: 'production-new-match-form.png', fullPage: true });
  console.log('\nScreenshot saved as production-new-match-form.png');

  await page.waitForTimeout(30000);
  await browser.close();
}

inspectNewMatchForm().catch(console.error);