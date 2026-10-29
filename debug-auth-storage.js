import { chromium } from 'playwright';

async function debugAuthStorage() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Opening http://localhost:5173/#/signin...');
  await page.goto('http://localhost:5173/#/signin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check localStorage before sign in
  console.log('=== LOCALSTORAGE BEFORE SIGN IN ===');
  const lsBefore = await page.evaluate(() => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) result[key] = localStorage.getItem(key);
    }
    return result;
  });
  console.log(JSON.stringify(lsBefore, null, 2));

  // Sign in with password flow
  const emailInput = page.locator('input[type="email"]').first();
  console.log('Email input visible:', await emailInput.isVisible({ timeout: 2000 }).catch(() => false));
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Signing in with password...');

    // First, click "Sign in with password" to switch to password form
    const passwordSignInBtn = page.locator('button:has-text("Sign in with password")').first();
    console.log('"Sign in with password" button visible:', await passwordSignInBtn.isVisible({ timeout: 2000 }).catch(() => false));
    if (await passwordSignInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicking "Sign in with password" button...');
      await passwordSignInBtn.click();
      await page.waitForTimeout(500);
    }

    // Check what buttons are visible now
    const buttons = await page.locator('button').all();
    console.log('Buttons after clicking password sign in:');
    for (const btn of buttons) {
      const text = await btn.textContent();
      const visible = await btn.isVisible().catch(() => false);
      console.log('  Button:', text?.trim(), '| visible:', visible);
    }

    // Now fill email and password
    await emailInput.fill('adityanaik.12d@gmail.com');
    await page.locator('input[type="password"]').first().fill('12345678');

    // Click the "Sign in" button in the password form
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    console.log('"Sign in" button visible:', await signInBtn.isVisible({ timeout: 2000 }).catch(() => false));
    console.log('Clicking "Sign in" button...');
    await signInBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  // Check localStorage after sign in
  console.log('=== LOCALSTORAGE AFTER SIGN IN ===');
  const lsAfterSignIn = await page.evaluate(() => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) result[key] = localStorage.getItem(key);
    }
    return result;
  });
  console.log(JSON.stringify(lsAfterSignIn, null, 2));

  // Check for error messages
  console.log('=== ERROR MESSAGES ===');
  const errors = await page.locator('.error, p.error').all();
  for (const err of errors) {
    const text = await err.textContent();
    console.log('Error:', text?.trim());
  }

  // Check cookies
  console.log('=== COOKIES ===');
  const cookies = await context.cookies();
  console.log(JSON.stringify(cookies, null, 2));

  console.log('\nKeeping browser open for 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
}

debugAuthStorage().catch(e => { console.error(e); process.exit(1); });