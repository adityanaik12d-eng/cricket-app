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

    // Check lineup counts
    const lineupAChips = page.locator('.chip-row').first().locator('.chip');
    const lineupBChips = page.locator('.chip-row').nth(1).locator('.chip');
    console.log('Team A lineup count before quick fill:', await lineupAChips.count());
    console.log('Team B lineup count before quick fill:', await lineupBChips.count());

    // Quick fill lineups for both teams
    console.log('Quick filling lineups...');
    const quickFillA = page.locator('button:has-text("Quick fill")').first();
    const quickFillB = page.locator('button:has-text("Quick fill")').nth(1);

    if (await quickFillA.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickFillA.click();
      await page.waitForTimeout(500);
      console.log('Team A lineup count after quick fill:', await lineupAChips.count());
    }
    if (await quickFillB.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickFillB.click();
      await page.waitForTimeout(500);
      console.log('Team B lineup count after quick fill:', await lineupBChips.count());
    }

    // Check lineup counts again
    console.log('Final Team A lineup count:', await lineupAChips.count());
    console.log('Final Team B lineup count:', await lineupBChips.count());

    const createBtn = page.locator('button:has-text("Create match"), button:has-text("Create"), button[type="submit"]').first();
    console.log('Clicking create match button...');
    await createBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait longer for API call
  }

  console.log('After create, URL:', page.url());

  // Check for error messages
  const errorMsg = page.locator('.error, [class*="error"], text=/error/i, text=/failed/i, text=/could not/i').first();
  const hasError = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasError) {
    console.log('Error message found:', await errorMsg.textContent());
  }

  // Check page content
  const pageContent = await page.textContent('body');
  console.log('Page contains "Toss":', pageContent?.includes('Toss'));
  console.log('Page contains "Bat":', pageContent?.includes('Bat'));
  console.log('Page contains "Bowl":', pageContent?.includes('Bowl'));
  console.log('Page contains "Create match":', pageContent?.includes('Create match'));

  // Keep browser open for viewing
  console.log('Keeping browser open for 60 seconds for you to inspect...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateMatch().catch(console.error);