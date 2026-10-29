import { chromium } from 'playwright';

async function simulateMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Opening http://localhost:5173...');
  await page.goto('http://localhost:5173');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check if we need to sign in
  const emailInput = page.locator('input[type="email"]').first();
  const signInButton = page.locator('text=Sign in, text=Sign In, button:has-text("Sign")').first();

  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Signing in...');
    await emailInput.fill('adityanaik.12d@gmail.com');
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('12345678');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  } else if (await signInButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Clicking sign in button...');
    await signInButton.click();
    await page.waitForTimeout(1000);
    const emailInput2 = page.locator('input[type="email"]').first();
    await emailInput2.fill('adityanaik.12d@gmail.com');
    const passwordInput2 = page.locator('input[type="password"]').first();
    await passwordInput2.fill('12345678');
    const submitBtn2 = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first();
    await submitBtn2.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  console.log('Looking for "New match" button...');
  const newMatchBtn = page.locator('button:has-text("New match"), button:has-text("New Match"), button:has-text("Create")').first();
  await newMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newMatchBtn.click();
  await page.waitForTimeout(1500);

  // Print all visible buttons and inputs
  const allButtons = await page.locator('button').allTextContents();
  console.log('All buttons:', allButtons);

  const allInputs = await page.locator('input').all();
  for (const input of allInputs) {
    const placeholder = await input.getAttribute('placeholder');
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    const type = await input.getAttribute('type');
    console.log('Input:', { placeholder, name, id, type });
  }

  // Fill match setup form
  console.log('Setting up match...');
  const teamAInput = page.locator('input[placeholder*="Team A" i], input[name*="teamA" i], input[id*="teamA" i]').first();
  const teamBInput = page.locator('input[placeholder*="Team B" i], input[name*="teamB" i], input[id*="teamB" i]').first();

  if (await teamAInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await teamAInput.fill('India');
    await teamBInput.fill('Australia');

    const oversInput = page.locator('input[type="number"][placeholder*="over" i], input[name*="over" i], input[id*="over" i]').first();
    if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await oversInput.fill('20');
    }

    // Try to find quick fill buttons more broadly
    const quickFillButtons = page.locator('button:has-text("Quick")');
    console.log('Quick fill buttons count:', await quickFillButtons.count());

    // Try clicking quick fill for team A
    for (let i = 0; i < await quickFillButtons.count(); i++) {
      const btn = quickFillButtons.nth(i);
      const text = await btn.textContent();
      console.log(`Quick fill button ${i}:`, text);
      if (text?.includes('Quick')) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }

    // Check chip counts
    const chips = page.locator('.chip');
    console.log('Chip count:', await chips.count());
    const chipTexts = await chips.allTextContents();
    console.log('Chip texts:', chipTexts);

    const createBtn = page.locator('button:has-text("Create match"), button:has-text("Create"), button[type="submit"]').first();
    console.log('Clicking create match button...');
    await createBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
  }

  console.log('After create, URL:', page.url());

  // Check for error messages
  const pageContent = await page.textContent('body');
  console.log('Page contains "Toss":', pageContent?.includes('Toss'));
  console.log('Page contains "Bat":', pageContent?.includes('Bat'));
  console.log('Page contains "Bowl":', pageContent?.includes('Bowl'));
  console.log('Page contains "Create match":', pageContent?.includes('Create match'));

  // Check for any error text
  const errorElements = await page.locator('.error, [class*="error" i]').all();
  for (const el of errorElements) {
    console.log('Error element:', await el.textContent());
  }

  // Keep browser open for viewing
  console.log('Keeping browser open for 60 seconds for you to inspect...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateMatch().catch(console.error);