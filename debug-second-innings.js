import { chromium } from 'playwright';

async function debugSecondInnings() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Opening http://localhost:5173...');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Sign in
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Signing in...');
    await emailInput.fill('adityanaik.12d@gmail.com');
    await page.locator('input[type="password"]').first().fill('12345678');
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  // Click on the latest match text
  console.log('Opening latest match...');
  await page.locator('text=india vs australia').first().click();
  await page.waitForURL(/.*\/match\/.*/);
  await page.waitForTimeout(2000);

  // Go to scoring tab
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  if (currentUrl.includes('/report') || currentUrl.includes('/scorecard') || currentUrl.includes('/wheel') || currentUrl.includes('/charts')) {
    const baseUrl = currentUrl.replace(/\/report|\/scorecard|\/wheel|\/charts/, '');
    const scoringUrl = baseUrl.endsWith('/') ? baseUrl + 'scoring' : baseUrl + '/scoring';
    console.log('Navigating to scoring tab:', scoringUrl);
    await page.goto(scoringUrl);
    await page.waitForTimeout(3000);
  }

  console.log('Final URL:', page.url());
  console.log('Title:', await page.title());

  // Get full body text
  const bodyText = await page.textContent('body');
  console.log('=== BODY TEXT (first 3000 chars) ===');
  console.log(bodyText?.substring(0, 3000));
  console.log('=== END BODY TEXT ===');

  // Check for various status texts
  console.log('Contains "innings break":', bodyText?.toLowerCase().includes('innings break'));
  console.log('Contains "INNINGS_BREAK":', bodyText?.includes('INNINGS_BREAK'));
  console.log('Contains "IN_PROGRESS":', bodyText?.includes('IN_PROGRESS'));
  console.log('Contains "New innings":', bodyText?.includes('New innings'));
  console.log('Contains "Striker":', bodyText?.includes('Striker'));
  console.log('Contains "Non-striker":', bodyText?.includes('Non-striker'));
  console.log('Contains "Bowler":', bodyText?.includes('Bowler'));

  // Check tabs
  console.log('=== TABS ===');
  const tabButtons = await page.locator('nav.tabs button, .tabs button').all();
  for (const btn of tabButtons) {
    const text = await btn.textContent();
    const className = await btn.getAttribute('class');
    console.log('Tab:', text?.trim(), '| class:', className);
  }

  // Check selects
  console.log('=== SELECTS ===');
  const selects = await page.locator('select').all();
  console.log('Select count:', selects.length);
  for (let i = 0; i < selects.length; i++) {
    const options = await selects[i].locator('option').all();
    console.log(`Select ${i}: ${options.length} options`);
    for (const opt of options) {
      const text = await opt.textContent();
      console.log(`  Option: ${text?.trim()}`);
    }
  }

  // Check for pad buttons
  console.log('=== PAD BUTTONS ===');
  const padBtns = await page.locator('button.pad-btn').all();
  console.log('Pad button count:', padBtns.length);
  for (const btn of padBtns) {
    const text = await btn.textContent();
    console.log('Pad btn:', text?.trim());
  }

  // Check for watch view elements
  console.log('=== WATCH VIEW ===');
  const watchElements = await page.locator('text=Watch, text=watching, .watcher').all();
  console.log('Watch elements:', watchElements.length);

  console.log('\nKeeping browser open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

debugSecondInnings().catch(e => { console.error(e); process.exit(1); });