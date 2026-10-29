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

  // Wait for the "New innings" section to appear
  await page.waitForTimeout(2000);

  // Select striker (first player of Team A - batting team)
  console.log('Selecting striker...');
  const strikerSelect = page.locator('select').first();
  if (await strikerSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await strikerSelect.selectOption({ index: 1 }); // First option after "Select..."
    await page.waitForTimeout(500);
  }

  // Select non-striker (second player of Team A)
  console.log('Selecting non-striker...');
  const nonStrikerSelect = page.locator('select').nth(1);
  if (await nonStrikerSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nonStrikerSelect.selectOption({ index: 2 }); // Second player
    await page.waitForTimeout(500);
  }

  // Select bowler (first player of Team B - bowling team)
  console.log('Selecting bowler...');
  const bowlerSelect = page.locator('select').nth(2);
  if (await bowlerSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await bowlerSelect.selectOption({ index: 1 }); // First option after "Select..."
    await page.waitForTimeout(500);
  }

  console.log('Openers and bowler selected. Pad should now be enabled.');

  // Wait a bit more for pad to enable
  await page.waitForTimeout(1000);

  // Now we're on the scoring screen - simulate 20 overs (120 balls)
  const scoringEvents = [
    // Over 1: 1, 0, 4, 1, 0, 1 (7 runs)
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    // Over 2: 1, 1, 6, 0, 1, 1 (10 runs)
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    // Over 3: 0, 4, 1, W, 1, 0 (wicket)
    { run: '0', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: 'W', wicket: true },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    // Over 4: 1, 1, 2, 1, 4, 1 (10 runs)
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '2', wicket: false },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    // Over 5: 6, 0, 1, 1, 0, 1 (9 runs)
    { run: '6', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    // Over 6: 4, 1, 1, W, 0, 1 (wicket)
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: 'W', wicket: true },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    // Over 7: 1, 2, 1, 4, 1, 0 (9 runs)
    { run: '1', wicket: false },
    { run: '2', wicket: false },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    // Over 8: 1, 6, 0, 1, 1, 4 (13 runs)
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    // Over 9: W, 1, 0, 1, 1, 1 (wicket)
    { run: 'W', wicket: true },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    // Over 10: 4, 1, 2, 1, 6, 0 (14 runs)
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '2', wicket: false },
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '0', wicket: false },
    // Over 11: 1, 1, 4, 0, 1, 1 (8 runs)
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    // Over 12: 1, W, 1, 0, 4, 1 (wicket)
    { run: '1', wicket: false },
    { run: 'W', wicket: true },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    // Over 13: 2, 1, 1, 4, 1, 0 (9 runs)
    { run: '2', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    // Over 14: 6, 1, 0, 1, W, 1 (wicket)
    { run: '6', wicket: false },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    { run: 'W', wicket: true },
    { run: '1', wicket: false },
    // Over 15: 1, 4, 1, 1, 2, 1 (10 runs)
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '2', wicket: false },
    { run: '1', wicket: false },
    // Over 16: 4, 1, 1, 6, 0, 1 (13 runs)
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
    // Over 17: 1, 0, W, 1, 4, 1 (wicket)
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    { run: 'W', wicket: true },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    // Over 18: 2, 1, 4, 1, 1, 0 (9 runs)
    { run: '2', wicket: false },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '0', wicket: false },
    // Over 19: 1, 6, 0, 4, 1, 1 (13 runs)
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '0', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    // Over 20: 4, 1, W, 1, 6, 1 (wicket)
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: 'W', wicket: true },
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '1', wicket: false },
  ];

  console.log(`Simulating ${scoringEvents.length} balls by clicking UI buttons...`);

  for (let i = 0; i < scoringEvents.length; i++) {
    const event = scoringEvents[i];

    if (event.wicket) {
      // Click W button (wicket)
      const wicketBtn = page.locator('button.pad-btn.danger:has-text("W")').first();
      if (await wicketBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await wicketBtn.click();
        await page.waitForTimeout(500);

        // Select dismissal type (default to first one - BOWLED)
        const dismissalBtn = page.locator('button.pad-btn:has-text("BOWLED"), button.pad-btn:has-text("Bowled")').first();
        if (await dismissalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dismissalBtn.click();
          await page.waitForTimeout(300);
        }

        // Click submit
        const submitBtn = page.locator('button.pad-btn:has-text("Submit")').first();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click();
          await page.waitForTimeout(500);
        }
      }
    } else {
      // Click run button - wait for it to be enabled
      const runBtn = page.locator(`button.pad-btn:has-text("${event.run}")`).first();
      // Wait for button to be enabled (not disabled)
      await page.waitForFunction(
        (text) => {
          const btn = document.querySelector(`button.pad-btn:has-text("${text}")`);
          return btn && !btn.disabled;
        },
        event.run,
        { timeout: 10000 }
      ).catch(() => console.log(`Warning: Button ${event.run} not enabled in time`));

      if (await runBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await runBtn.click();
        await page.waitForTimeout(400);
      }
    }

    if ((i + 1) % 6 === 0) {
      console.log(`Over ${Math.floor((i + 1) / 6)} completed`);
    }
  }

  console.log('20 overs completed! Match simulation finished.');

  // End match - press 'e' key or click end match button
  await page.keyboard.press('e');
  await page.waitForTimeout(1000);
  const endBtn = page.locator('button:has-text("End"), button:has-text("Finish")').first();
  if (await endBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(1000);
  }

  // Go back to home
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  // Refresh the page to ensure we get latest data
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

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