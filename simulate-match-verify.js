import { chromium } from 'playwright';

async function simulateMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('Opening http://localhost:5173...');
  await page.goto('http://localhost:5173');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check current URL and page content
  console.log('Current URL:', page.url());
  const pageContent = await page.textContent('body');
  console.log('Page contains "New match":', pageContent?.includes('New match') || pageContent?.includes('New Match'));

  // Look for any existing matches
  const matchCards = page.locator('.match-card, [data-testid="match-card"], .match-item, article').first();
  const hasMatches = await matchCards.isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Existing matches visible:', hasMatches);

  // Check if we need to sign in
  const signInButton = page.locator('text=Sign in, text=Sign In, button:has-text("Sign")').first();
  const emailInput = page.locator('input[type="email"]').first();

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

  console.log('After sign in, current URL:', page.url());

  // Wait for home screen to load
  await page.waitForTimeout(3000);

  // Check for matches again
  const pageContent2 = await page.textContent('body');
  console.log('Page contains "New match":', pageContent2?.includes('New match') || pageContent2?.includes('New Match'));
  console.log('Page contains "Your matches":', pageContent2?.includes('Your matches') || pageContent2?.includes('Your Matches'));
  console.log('Page contains "Live now":', pageContent2?.includes('Live now') || pageContent2?.includes('Live Now'));

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

    const createBtn = page.locator('button:has-text("Create"), button:has-text("Start"), button[type="submit"]').first();
    await createBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  console.log('Match created! Current URL:', page.url());

  // Now we're on the scoring screen - simulate a few balls then go back to home
  await page.keyboard.press('1');
  await page.waitForTimeout(500);
  await page.keyboard.press('4');
  await page.waitForTimeout(500);
  await page.keyboard.press('0');
  await page.waitForTimeout(500);
  await page.keyboard.press('1');
  await page.waitForTimeout(500);
  await page.keyboard.press('6');
  await page.waitForTimeout(500);
  await page.keyboard.press('1');
  await page.waitForTimeout(500);

  console.log('Scored first over, going back to home...');
  // Go back to home - try clicking a home/logo link or pressing escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Check if we're back on home screen
  const pageContent3 = await page.textContent('body');
  console.log('Back on home screen, page contains "India":', pageContent3?.includes('India'));
  console.log('Page contains "Australia":', pageContent3?.includes('Australia'));

  // Keep browser open for viewing
  console.log('Keeping browser open for 60 seconds for you to inspect...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateMatch().catch(console.error);