import { chromium } from 'playwright';

async function testSecondInningsAfterReload() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('=== STEP 1: Sign in ===');
  await page.goto('http://localhost:5173/#/signin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Signing in with password...');
    const passwordSignInBtn = page.locator('button:has-text("Sign in with password")').first();
    if (await passwordSignInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passwordSignInBtn.click();
      await page.waitForTimeout(500);
    }
    await emailInput.fill('adityanaik.12d@gmail.com');
    await page.locator('input[type="password"]').first().fill('12345678');
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    await signInBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  console.log('=== STEP 2: Check localStorage after sign in ===');
  const lsAfterSignIn = await page.evaluate(() => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) result[key] = localStorage.getItem(key);
    }
    return result;
  });
  console.log('Keys in localStorage:', Object.keys(lsAfterSignIn));

  console.log('=== STEP 3: Navigate to match ===');
  // Go to home first to see matches
  await page.goto('http://localhost:5173/#/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click on the match
  const matchLink = page.locator('a[href*="/match/"]').first();
  if (await matchLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await matchLink.getAttribute('href');
    console.log('Match link href:', href);
    if (href) {
      await page.goto('http://localhost:5173' + href);
    } else {
      await matchLink.click();
    }
  } else {
    await page.locator('text=india vs australia').first().click();
  }

  await page.waitForURL(/.*\/match\/.*/);
  await page.waitForTimeout(3000);

  console.log('Current URL:', page.url());

  // Check if we can see the scoring tab
  console.log('=== STEP 4: Check scoring tab ===');
  await page.goto(page.url().replace(/\/report|\/scorecard|\/wheel|\/charts/, '') + '/scoring');
  await page.waitForTimeout(3000);

  const bodyText = await page.textContent('body');
  console.log('Contains "innings break":', bodyText?.toLowerCase().includes('innings break'));
  console.log('Contains "New innings":', bodyText?.includes('New innings'));
  console.log('Contains "Striker":', bodyText?.includes('Striker'));

  // Check tabs
  const tabButtons = await page.locator('nav.tabs button, .tabs button').all();
  console.log('=== TABS ===');
  for (const btn of tabButtons) {
    const text = await btn.textContent();
    const className = await btn.getAttribute('class');
    console.log('Tab:', text?.trim(), '| class:', className);
  }

  // Check selects
  const selects = await page.locator('select').all();
  console.log('=== SELECTS ===', selects.length);
  for (let i = 0; i < selects.length; i++) {
    const options = await selects[i].locator('option').all();
    console.log(`Select ${i}: ${options.length} options`);
    for (const opt of options) {
      const text = await opt.textContent();
      console.log(`  Option: ${text?.trim()}`);
    }
  }

  // Check pad buttons
  const padBtns = await page.locator('button.pad-btn').all();
  console.log('=== PAD BUTTONS ===', padBtns.length);

  console.log('\nKeeping browser open for 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testSecondInningsAfterReload().catch(e => { console.error(e); process.exit(1); });