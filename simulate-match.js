import { chromium } from 'playwright';

async function simulateMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('Opening http://localhost:5173...');
  await page.goto('http://localhost:5173');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

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
    await page.waitForTimeout(2000);
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
    await page.waitForTimeout(2000);
  }

  console.log('Looking for "New match" button...');
  const newMatchBtn = page.locator('button:has-text("New match"), button:has-text("New Match"), button:has-text("Create")').first();
  await newMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newMatchBtn.click();
  await page.waitForTimeout(1000);

  // Fill match setup form
  console.log('Setting up match...');
  const teamAInput = page.locator('input[placeholder*="Team A" i], input[name*="teamA" i], input[id*="teamA" i]').first();
  const teamBInput = page.locator('input[placeholder*="Team B" i], input[name*="teamB" i], input[id*="teamB" i]').first();

  if (await teamAInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await teamAInput.fill('India');
    await teamBInput.fill('Australia');

    // Overs - try to find and set to 20
    const oversInput = page.locator('input[type="number"][placeholder*="over" i], input[name*="over" i], input[id*="over" i]').first();
    if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await oversInput.fill('20');
    }

    const createBtn = page.locator('button:has-text("Create"), button:has-text("Start"), button[type="submit"]').first();
    await createBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  console.log('Match created! Starting 20-over simulation...');

  // Now we're on the scoring screen - simulate 20 overs (120 balls)
  // We'll use keyboard shortcuts: 0-6 for runs, w for wicket, u for undo, p for penalty, e for extras

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
  console.log('You can now view the scorecard, wagon wheel, charts, etc.');

  // Keep browser open for viewing
  await page.waitForTimeout(30000);
  await browser.close();
}

simulateMatch().catch(console.error);