import { chromium } from 'playwright';

async function debugMatchNavigation() {
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

  // Check what links are on the home page
  console.log('=== Home page links ===');
  const allLinks = await page.locator('a').all();
  for (const link of allLinks) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();
    if (href && href.includes('match')) {
      console.log('Match link:', href, '| text:', text?.trim());
    }
  }

  // Check what text elements contain "india"
  console.log('=== Text elements with "india" ===');
  const indiaElements = await page.locator('text=india').all();
  for (const el of indiaElements) {
    const text = await el.textContent();
    console.log('Found:', text?.trim());
  }

  // Click on the first match link
  console.log('Clicking first match link...');
  const matchLink = page.locator('a[href*="/match/"]').first();
  if (await matchLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await matchLink.getAttribute('href');
    console.log('Match link href:', href);
    await matchLink.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('Match link not found, trying text click...');
    await page.locator('text=india vs australia').first().click();
    await page.waitForTimeout(3000);
  }

  console.log('=== After click ===');
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  const bodyText = await page.textContent('body');
  console.log('Body contains INNINGS_BREAK:', bodyText?.includes('INNINGS_BREAK'));
  console.log('Body contains IN_PROGRESS:', bodyText?.includes('IN_PROGRESS'));
  console.log('Body preview:', bodyText?.substring(0, 2000));

  // Check for selects
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

  console.log('\nKeeping browser open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

debugMatchNavigation().catch(e => { console.error(e); process.exit(1); });