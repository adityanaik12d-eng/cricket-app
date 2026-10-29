import { chromium } from 'playwright';

async function simulateMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
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

  // Fill match setup form - EXPLICITLY fill team names
  console.log('Setting up match...');
  const teamAInput = page.locator('input[placeholder="India"]').first();
  const teamBInput = page.locator('input[placeholder="Australia"]').first();

  await teamAInput.fill('India');
  await teamBInput.fill('Australia');

  // Set overs
  const oversInput = page.locator('input[type="number"]').first();
  if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await oversInput.fill('20');
  }

  // Manually add 11 players to Team A
  console.log('Adding 11 players to Team A...');
  const nameAInput = page.locator('input[placeholder="Player name"]').first();
  const addAButton = page.locator('button:has-text("Add")').first();

  for (let i = 1; i <= 11; i++) {
    await nameAInput.fill(`Player A${i}`);
    await addAButton.click();
    await page.waitForTimeout(150);
  }

  // Manually add 11 players to Team B
  console.log('Adding 11 players to Team B...');
  const nameBInput = page.locator('input[placeholder="Player name"]').nth(1);
  const addBButton = page.locator('button:has-text("Add")').nth(1);

  for (let i = 1; i <= 11; i++) {
    await nameBInput.fill(`Player B${i}`);
    await addBButton.click();
    await page.waitForTimeout(150);
  }

  const createBtn = page.locator('button:has-text("Create match")').first();
  console.log('Clicking create match button...');
  await createBtn.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Record toss - India bats
  console.log('Recording toss: India bats...');
  const batBtn = page.locator('button:has-text("Bat")').first();
  if (await batBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await batBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  console.log('Now on scoring screen, URL:', page.url());

  // Now we're on the scoring screen - simulate 20 overs (120 balls)
  const scoringEvents = [
    // Over 1
    '1', '0', '4', '1', '0', '1',  // 7 runs
    // Over 2
    '1', '1', '6', '0', '1', '1',  // 10 runs
    // Over 3
    '0', '4', '1', 'w', '1', '0',  // wicket
    // Over 4
    '1', '1', '2', '1', '4', '1',  // 10 runs
    // Over 5
    '6', '0', '1', '1', '0', '1',  // 9 runs
    // Over 6
    '4', '1', '1', 'w', '0', '1',  // wicket
    // Over 7
    '1', '2', '1', '4', '1', '0',  // 9 runs
    // Over 8
    '1', '6', '0', '1', '1', '4',  // 13 runs
    // Over 9
    'w', '1', '0', '1', '1', '1',  // wicket
    // Over 10
    '4', '1', '2', '1', '6', '0',  // 14 runs
    // Over 11
    '1', '1', '4', '0', '1', '1',  // 8 runs
    // Over 12
    '1', 'w', '1', '0', '4', '1',  // wicket
    // Over 13
    '2', '1', '1', '4', '1', '0',  // 9 runs
    // Over 14
    '6', '1', '0', '1', 'w', '1',  // wicket
    // Over 15
    '1', '4', '1', '1', '2', '1',  // 10 runs
    // Over 16
    '4', '1', '1', '6', '0', '1',  // 13 runs
    // Over 17
    '1', '0', 'w', '1', '4', '1',  // wicket
    // Over 18
    '2', '1', '4', '1', '1', '0',  // 9 runs
    // Over 19
    '1', '6', '0', '4', '1', '1',  // 13 runs
    // Over 20
    '4', '1', 'w', '1', '6', '1',  // wicket
  ];

  console.log(`Simulating ${scoringEvents.length} balls...`);

  for (let i = 0; i < scoringEvents.length; i++) {
    const event = scoringEvents[i];
    await page.keyboard.press(event);
    await page.waitForTimeout(400); // Slower so you can watch

    if ((i + 1) % 6 === 0) {
      console.log(`Over ${Math.floor((i + 1) / 6)} completed`);
    }
  }

  console.log('20 overs completed! Match simulation finished.');

  // End match
  await page.keyboard.press('e'); // End match
  await page.waitForTimeout(1000);
  const endBtn = page.locator('button:has-text("End"), button:has-text("Finish")').first();
  if (await endBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(1000);
  }

  // Go back to home
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  // Check if match appears on home screen
  const pageContent = await page.textContent('body');
  console.log('Back on home screen, page contains "India":', pageContent?.includes('India'));
  console.log('Page contains "Australia":', pageContent?.includes('Australia'));

  // Keep browser open for viewing
  console.log('Keeping browser open for 60 seconds for you to inspect...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateMatch().catch(console.error);