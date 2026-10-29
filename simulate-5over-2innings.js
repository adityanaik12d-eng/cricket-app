import { chromium } from 'playwright';

async function simulateMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Track bowler and batsman indices for modal selections
  // bowlerIndex = 2 because index 1 was used for the opening bowler in match start modal
  let bowlerIndex = 2; // Start with second bowler for Next Bowler modal (index 1 was opening bowler)
  let batsmanIndex = 3; // Start with third batsman (index 1 and 2 are openers)

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

  // Set overs to 5
  const oversInput = page.locator('input[type="number"]').first();
  if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await oversInput.fill('5');
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

  // Enable superover
  console.log('Enabling superover...');
  const superOverCheckbox = page.locator('input[type="checkbox"]').first();
  if (await superOverCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
    await superOverCheckbox.check();
    await page.waitForTimeout(500);
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

  // Wait for the match start modal (new innings start interface)
  await page.waitForTimeout(2000);

  // =========== FIRST INNINGS ===========
  console.log('\n========== FIRST INNINGS STARTING ==========\n');

  // Handle match start modal - Select striker (first player of Team A - batting team)
  console.log('Selecting striker for 1st innings...');
  const strikerSelect = page.locator('select').first();
  if (await strikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await strikerSelect.selectOption({ index: 1 }); // First option after "Select..."
    await page.waitForTimeout(500);
  }

  // Select non-striker (second player of Team A)
  console.log('Selecting non-striker for 1st innings...');
  const nonStrikerSelect = page.locator('select').nth(1);
  if (await nonStrikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nonStrikerSelect.selectOption({ index: 2 }); // Second player
    await page.waitForTimeout(500);
  }

  // Select bowler (first player of Team B - bowling team)
  console.log('Selecting bowler for 1st innings...');
  const bowlerSelect = page.locator('select').nth(2);
  if (await bowlerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await bowlerSelect.selectOption({ index: 1 }); // First option after "Select..."
    await page.waitForTimeout(500);
  }

  // Click Start Innings button
  console.log('Clicking Start Innings button...');
  const startInningsBtn = page.locator('button:has-text("Start Innings"), button:has-text("Start")').first();
  if (await startInningsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startInningsBtn.click();
    await page.waitForTimeout(1000);
  }

  console.log('1st innings openers and bowler selected. Pad should now be enabled.');

  // Wait a bit more for pad to enable
  await page.waitForTimeout(1000);

  // Now we're on the scoring screen - simulate 5 overs (30 balls) for 1st innings
  const firstInningsEvents = [
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
  ];

  console.log(`Simulating ${firstInningsEvents.length} balls (5 overs) for 1st innings...`);

  // Helper function to find a pad button by text (using native JS for reliability)
  async function findPadButton(btnText) {
    return await page.evaluate((text) => {
      const buttons = document.querySelectorAll('button.pad-btn');
      for (const btn of buttons) {
        if (btn.textContent.trim() === text) {
          return btn;
        }
      }
      return null;
    }, btnText);
  }

  // Helper function to wait for ball to be processed
  // For regular balls: wait for oversText change (primary) or pad enabled (fallback)
  // For wickets: wait for Next Batsman modal to appear
  async function waitForBallProcessed(prevOversText, isWicket = false, maxWaitMs = 30000) {
    const startTime = Date.now();
    let sawBusy = false;

    while (Date.now() - startTime < maxWaitMs) {
      // For wickets, check if Next Batsman modal appeared
      if (isWicket) {
        const nextBatsmanVisible = await page.evaluate(() => {
          const modals = document.querySelectorAll('.modal-overlay');
          for (const modal of modals) {
            const h2 = modal.querySelector('.modal h2');
            if (h2 && h2.textContent.includes('Next Batsman')) {
              return true;
            }
          }
          return false;
        });
        if (nextBatsmanVisible) {
          console.log(`  Next Batsman modal detected`);
          return prevOversText;
        }
      }

      const currentOversText = await page.evaluate(() => {
        const el = document.querySelector('.overs, [class*="overs"]');
        if (el) return el.textContent;
        // Try to find overs in live card
        const liveCard = document.querySelector('.live-card');
        if (liveCard) {
          const text = liveCard.textContent;
          const match = text?.match(/\(([\d.]+)\s*ov\)/);
          if (match) return match[1];
        }
        return null;
      });

      // Check if pad is disabled (busy) - this confirms ball submission started
      const padEnabled = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button.pad-btn');
        for (const btn of buttons) {
          if (!btn.disabled && btn.textContent.trim().match(/^[0-6]$/)) {
            return true;
          }
        }
        return false;
      });

      if (!padEnabled) {
        sawBusy = true;
      }

      // Primary: wait for overs text to change (means ball fully processed)
      if (currentOversText && currentOversText !== prevOversText) {
        console.log(`  Overs changed: ${prevOversText} -> ${currentOversText}`);
        return currentOversText;
      }

      // Fallback: if we saw busy state and now pad is enabled again, ball is processed
      // But only use this if overs text didn't change (e.g., wides/no-balls)
      if (sawBusy && padEnabled && !isWicket) {
        console.log(`  Pad enabled after busy (fallback)`);
        return currentOversText || prevOversText;
      }

      await page.waitForTimeout(500);
    }
    console.log(`  WARNING: Ball processing timeout after ${maxWaitMs}ms`);
    return prevOversText;
  }

  // Helper function to handle modals that may appear after a ball
  const handleModals = async (inningsName) => {
    // Wait a bit for modals to appear
    await page.waitForTimeout(2000);

    // Check for "Next Batsman" modal
    console.log(`${inningsName}: Checking for Next Batsman modal...`);
    const nextBatsmanModal = page.locator('.modal-overlay:has(.modal h2:has-text("Next Batsman"))').first();
    const nextBatsmanVisible = await nextBatsmanModal.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`${inningsName}: Next Batsman modal visible:`, nextBatsmanVisible);
    if (nextBatsmanVisible) {
      console.log(`${inningsName}: Next Batsman modal appeared, selecting next batsman (index ${batsmanIndex})...`);
      const batsmanSelect = nextBatsmanModal.locator('select').first();
      if (await batsmanSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await batsmanSelect.selectOption({ index: batsmanIndex });
        batsmanIndex++; // Increment for next wicket
        await page.waitForTimeout(500);
      }
      // The modal closes automatically when a batsman is selected via handleNextBatsman
      // Wait for modal to fully disappear
      await nextBatsmanModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => console.log(`${inningsName}: Next Batsman modal did not hide in time`));
      await page.waitForTimeout(500);
    }

    // Check for "Next Bowler" modal
    console.log(`${inningsName}: Checking for Next Bowler modal...`);
    const nextBowlerModal = page.locator('.modal-overlay:has(.modal h2:has-text("Next Bowler"))').first();
    const nextBowlerVisible = await nextBowlerModal.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`${inningsName}: Next Bowler modal visible:`, nextBowlerVisible);
    if (nextBowlerVisible) {
      console.log(`${inningsName}: Next Bowler modal appeared, selecting next bowler (index ${bowlerIndex})...`);
      const bowlerSelectModal = nextBowlerModal.locator('select').first();
      if (await bowlerSelectModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bowlerSelectModal.selectOption({ index: bowlerIndex });
        bowlerIndex++; // Increment for next over
        await page.waitForTimeout(500);
      }
      // Click "Start Next Over" button if available
      const startNextOverBtn = nextBowlerModal.locator('button:has-text("Start Next Over")').first();
      if (await startNextOverBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`${inningsName}: Clicking "Start Next Over" button...`);
        await startNextOverBtn.click();
        await page.waitForTimeout(500);
      }
      // Wait for modal to fully disappear
      await nextBowlerModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => console.log(`${inningsName}: Next Bowler modal did not hide in time`));
      await page.waitForTimeout(500);
    }
  }
;

// Helper function for superover modals
const handleSuperOverModals = async (inningsName) => {
  await page.waitForTimeout(2000);

  // Check for "Next Batsman" modal
  console.log(`${inningsName}: Checking for Next Batsman modal...`);
  const nextBatsmanModal = page.locator('.modal-overlay:has(.modal h2:has-text("Next Batsman"))').first();
  const nextBatsmanVisible = await nextBatsmanModal.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`${inningsName}: Next Batsman modal visible:`, nextBatsmanVisible);
  if (nextBatsmanVisible) {
    console.log(`${inningsName}: Next Batsman modal appeared, selecting next batsman...`);
    const batsmanSelect = nextBatsmanModal.locator('select').first();
    if (await batsmanSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batsmanSelect.selectOption({ index: soBatsmanIndex });
      soBatsmanIndex++;
      await page.waitForTimeout(500);
    }
    await nextBatsmanModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => console.log(`${inningsName}: Next Batsman modal did not hide in time`));
    await page.waitForTimeout(500);
  }

  // Check for "Next Bowler" modal
  console.log(`${inningsName}: Checking for Next Bowler modal...`);
  const nextBowlerModal = page.locator('.modal-overlay:has(.modal h2:has-text("Next Bowler"))').first();
  const nextBowlerVisible = await nextBowlerModal.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`${inningsName}: Next Bowler modal visible:`, nextBowlerVisible);
  if (nextBowlerVisible) {
    console.log(`${inningsName}: Next Bowler modal appeared, selecting next bowler...`);
    const bowlerSelectModal = nextBowlerModal.locator('select').first();
    if (await bowlerSelectModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bowlerSelectModal.selectOption({ index: soBowlerIndex });
      soBowlerIndex++;
      await page.waitForTimeout(500);
    }
    // Click "Start Next Over" button if available
    const startNextOverBtn = nextBowlerModal.locator('button:has-text("Start Next Over")').first();
    if (await startNextOverBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`${inningsName}: Clicking "Start Next Over" button...`);
      await startNextOverBtn.click();
      await page.waitForTimeout(500);
    }
    await nextBowlerModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => console.log(`${inningsName}: Next Bowler modal did not hide in time`));
    await page.waitForTimeout(500);
  }
};

// Get initial overs text
  let currentOversText = await page.evaluate(() => {
    const liveCard = document.querySelector('.live-card');
    if (liveCard) {
      const text = liveCard.textContent;
      const match = text?.match(/\(([\d.]+)\s*ov\)/);
      if (match) return match[1];
    }
    return '0.0';
  });
  console.log(`Initial overs: ${currentOversText}`);

  for (let i = 0; i < firstInningsEvents.length; i++) {
    const event = firstInningsEvents[i];
    const ballNum = i + 1;

    console.log(`\n--- Ball ${ballNum} ---`);

    if (event.wicket) {
      // Click W button (wicket)
      console.log('  Clicking W button...');
      const wicketBtn = page.locator('button.pad-btn.danger:has-text("W")').first();
      await wicketBtn.waitFor({ state: 'visible', timeout: 10000 });
      await wicketBtn.click();
      await page.waitForTimeout(500);

      // Select dismissal type (default to first one - BOWLED)
      console.log('  Selecting dismissal type...');
      const dismissalBtn = page.locator('button.pad-btn:has-text("BOWLED"), button.pad-btn:has-text("Bowled")').first();
      if (await dismissalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dismissalBtn.click();
        await page.waitForTimeout(1000);
        // Verify dismissal was selected by checking for "Selected: BOWLED" text
        const selectedText = await page.locator('text=Selected: BOWLED').isVisible({ timeout: 3000 }).catch(() => false);
        console.log('  Dismissal selected:', selectedText);
      } else {
        console.log('  WARNING: Dismissal button not found!');
      }

      // Click submit
      console.log('  Clicking Submit...');
      const submitBtn = page.locator('button.pad-btn:has-text("Submit")').first();
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.click();
      } else {
        console.log('  WARNING: Submit button not found!');
      }

      // Wait for ball to be processed (wicket - wait for Next Batsman modal)
      currentOversText = await waitForBallProcessed(currentOversText, true, 30000);

      // Handle modals after wicket (Next Batsman modal should appear)
      await handleModals('1st innings');
    } else {
      // Click run button
      console.log(`  Clicking ${event.run} button...`);

      // Wait for button to be visible and enabled
      const runBtn = page.locator(`button.pad-btn:has-text("${event.run}")`).first();
      await runBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => console.log(`  WARNING: Button ${event.run} not visible in time`));

      // Wait for button to be enabled
      await page.waitForFunction(
        (btnText) => {
          const buttons = document.querySelectorAll('button.pad-btn');
          for (const btn of buttons) {
            if (btn.textContent.trim() === btnText) {
              return !btn.disabled;
            }
          }
          return false;
        },
        event.run,
        { timeout: 20000 }
      ).catch(() => console.log(`  WARNING: Button ${event.run} did not become enabled in time`));

      // Click the button
      await runBtn.click();

      // Wait for ball to be processed (watch for oversText change)
      currentOversText = await waitForBallProcessed(currentOversText, false, 20000);

      // Handle modals after each ball (they may appear after over completion or wicket)
      await handleModals('1st innings');
    }

    if ((i + 1) % 6 === 0) {
      console.log(`Over ${Math.floor((i + 1) / 6)} completed`);
      await page.waitForTimeout(1000);
    }
  }

  console.log('1st innings (5 overs) completed!');

  // End 1st innings - press 'e' key or click end innings button
  await page.keyboard.press('e');
  await page.waitForTimeout(1000);
  const endBtn = page.locator('button:has-text("End"), button:has-text("Finish"), button:has-text("End Innings")').first();
  if (await endBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(1000);
  }

  // Reset bowler and batsman indices for second innings
  bowlerIndex = 2; // Team A now bowling - second bowler (index 1 was opening bowler)
  batsmanIndex = 3; // Team B now batting - third batsman (after openers)

  // =========== SECOND INNINGS ===========
  console.log('\n========== SECOND INNINGS STARTING ==========\n');

  // Wait for the new innings start modal
  await page.waitForTimeout(3000);

  // Handle match start modal for 2nd innings - Select striker (first player of Team B - now batting)
  console.log('Selecting striker for 2nd innings...');
  const strikerSelect2 = page.locator('select').first();
  if (await strikerSelect2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await strikerSelect2.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  }

  // Select non-striker (second player of Team B)
  console.log('Selecting non-striker for 2nd innings...');
  const nonStrikerSelect2 = page.locator('select').nth(1);
  if (await nonStrikerSelect2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nonStrikerSelect2.selectOption({ index: 2 });
    await page.waitForTimeout(500);
  }

  // Select bowler (first player of Team A - now bowling)
  console.log('Selecting bowler for 2nd innings...');
  const bowlerSelect2 = page.locator('select').nth(2);
  if (await bowlerSelect2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await bowlerSelect2.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  }

  // Click Start Innings button for 2nd innings
  console.log('Clicking Start Innings button for 2nd innings...');
  const startInningsBtn2 = page.locator('button:has-text("Start Innings"), button:has-text("Start")').first();
  if (await startInningsBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startInningsBtn2.click();
    await page.waitForTimeout(1000);
  }

  console.log('2nd innings openers and bowler selected. Pad should now be enabled.');

  // Wait a bit more for pad to enable and status to transition to IN_PROGRESS
  await page.waitForTimeout(2000);

  // Get current overs text (should reset for 2nd innings)
  currentOversText = await page.evaluate(() => {
    const liveCard = document.querySelector('.live-card');
    if (liveCard) {
      const text = liveCard.textContent;
      const match = text?.match(/\(([\d.]+)\s*ov\)/);
      if (match) return match[1];
    }
    return '0.0';
  });
  console.log(`2nd innings initial overs: ${currentOversText}`);

  // Now simulate 5 overs (30 balls) for 2nd innings
  const secondInningsEvents = [
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
  ];

  console.log(`Simulating ${secondInningsEvents.length} balls (5 overs) for 2nd innings...`);

  for (let i = 0; i < secondInningsEvents.length; i++) {
    const event = secondInningsEvents[i];
    const ballNum = i + 1;

    console.log(`\n--- 2nd Innings Ball ${ballNum} ---`);

    if (event.wicket) {
      // Click W button (wicket)
      console.log('  Clicking W button...');
      const wicketBtn = page.locator('button.pad-btn.danger:has-text("W")').first();
      await wicketBtn.waitFor({ state: 'visible', timeout: 10000 });
      await wicketBtn.click();
      await page.waitForTimeout(500);

      // Select dismissal type (default to first one - BOWLED)
      console.log('  Selecting dismissal type...');
      const dismissalBtn = page.locator('button.pad-btn:has-text("BOWLED"), button.pad-btn:has-text("Bowled")').first();
      if (await dismissalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dismissalBtn.click();
        await page.waitForTimeout(1000);
        // Verify dismissal was selected by checking for "Selected: BOWLED" text
        const selectedText = await page.locator('text=Selected: BOWLED').isVisible({ timeout: 3000 }).catch(() => false);
        console.log('  Dismissal selected:', selectedText);
      } else {
        console.log('  WARNING: Dismissal button not found!');
      }

      // Click submit
      console.log('  Clicking Submit...');
      const submitBtn = page.locator('button.pad-btn:has-text("Submit")').first();
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.click();
      } else {
        console.log('  WARNING: Submit button not found!');
      }

      // Wait for ball to be processed (wicket - wait for Next Batsman modal)
      currentOversText = await waitForBallProcessed(currentOversText, true, 30000);

      // Handle modals after wicket (Next Batsman modal should appear)
      await handleModals('2nd innings');
    } else {
      // Click run button
      console.log(`  Clicking ${event.run} button...`);

      // Wait for button to be visible and enabled
      const runBtn = page.locator(`button.pad-btn:has-text("${event.run}")`).first();
      await runBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => console.log(`  WARNING: Button ${event.run} not visible in time`));

      // Wait for button to be enabled
      await page.waitForFunction(
        (btnText) => {
          const buttons = document.querySelectorAll('button.pad-btn');
          for (const btn of buttons) {
            if (btn.textContent.trim() === btnText) {
              return !btn.disabled;
            }
          }
          return false;
        },
        event.run,
        { timeout: 20000 }
      ).catch(() => console.log(`  WARNING: Button ${event.run} did not become enabled in time`));

      // Click the button
      await runBtn.click();

      // Wait for ball to be processed (watch for oversText change)
      currentOversText = await waitForBallProcessed(currentOversText, false, 20000);

      // Handle modals after each ball (they may appear after over completion or wicket)
      await handleModals('2nd innings');
    }

    if ((i + 1) % 6 === 0) {
      console.log(`Over ${Math.floor((i + 1) / 6)} completed`);
      await page.waitForTimeout(1000);
    }
  }

  console.log('2nd innings (5 overs) completed! Match simulation finished.');

  // After 2nd innings - check if superover was triggered
  console.log('\n========== CHECKING FOR SUPER OVER ==========\n');

  // Wait for superover team selection modal
  await page.waitForTimeout(3000);

  // Check for superover team selection modal
  console.log('Checking for Superover Team Selection modal...');
  const superOverModal = page.locator('.modal-overlay:has(.modal h2:has-text("Superover"))').first();
  const superOverVisible = await superOverModal.isVisible({ timeout: 10000 }).catch(() => false);
  console.log('Superover modal visible:', superOverVisible);

  if (superOverVisible) {
    console.log('Superover modal appeared, selecting team to bat first...');
    const superOverTeamSelect = superOverModal.locator('select').first();
    if (await superOverTeamSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select the team that batted second (Team B / Australia)
      await superOverTeamSelect.selectOption({ index: 1 }); // Team B
      await page.waitForTimeout(500);
    }
    // Click Start Superover button
    const startSuperOverBtn = superOverModal.locator('button:has-text("Start Superover")').first();
    if (await startSuperOverBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startSuperOverBtn.click();
      // Wait for the superover modal to close
      await superOverModal.waitFor({ state: 'hidden', timeout: 20000 }).catch(async () => {
        console.log('Superover modal did not hide in time, clicking outside to force close...');
        // Click on the overlay (outside the modal) to force close
        await page.locator('.modal-overlay:has(.modal h2:has-text("Superover"))').click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(1000);
        // Wait again for it to be hidden
        await superOverModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => console.log('Superover modal still not hidden after force close'));
      });
      await page.waitForTimeout(2000);
    }
    console.log('Superover started!');
  }

  // =========== SUPER OVER FIRST INNINGS ===========
  console.log('\n========== SUPER OVER FIRST INNINGS ==========\n');

  // Wait for the new innings start modal for superover
  console.log('Waiting for match start modal for superover 1st innings...');
  const matchStartModal = page.locator('.modal-overlay:has(.modal h2:has-text("Start Innings"))').first();
  await matchStartModal.waitFor({ state: 'visible', timeout: 20000 }).catch(() => console.log('Match start modal did not appear in time'));
  await page.waitForTimeout(1000);

  // Handle match start modal for superover first innings
  console.log('Selecting striker for superover 1st innings...');
  const soStrikerSelect = matchStartModal.locator('select').first();
  if (await soStrikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await soStrikerSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  }

  console.log('Selecting non-striker for superover 1st innings...');
  const soNonStrikerSelect = matchStartModal.locator('select').nth(1);
  if (await soNonStrikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await soNonStrikerSelect.selectOption({ index: 2 });
    await page.waitForTimeout(500);
  }

  console.log('Selecting bowler for superover 1st innings...');
  const soBowlerSelect = matchStartModal.locator('select').nth(2);
  if (await soBowlerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await soBowlerSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  }

  console.log('Clicking Start Innings button for superover 1st innings...');
  const soStartInningsBtn = matchStartModal.locator('button:has-text("Start Innings")').first();
  if (await soStartInningsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await soStartInningsBtn.click();
    await page.waitForTimeout(1000);
  }

  // Wait for match start modal to close
  await matchStartModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => console.log('Match start modal did not hide in time'));
  await page.waitForTimeout(1000);

  console.log('Superover 1st innings openers and bowler selected.');
  await page.waitForTimeout(1000);

  // Get current overs text
  let soOversText = await page.evaluate(() => {
    const liveCard = document.querySelector('.live-card');
    if (liveCard) {
      const text = liveCard.textContent;
      const match = text?.match(/\(([\d.]+)\s*ov\)/);
      if (match) return match[1];
    }
    return '0.0';
  });
  console.log(`Superover 1st innings initial overs: ${soOversText}`);

  // Simulate 1 over (6 balls) for superover first innings
  const superOverFirstInningsEvents = [
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '0', wicket: false },
    { run: '1', wicket: false },
  ];

  // Reset bowler/batsman indices for superover
  let soBowlerIndex = 2;
  let soBatsmanIndex = 3;

  console.log(`Simulating ${superOverFirstInningsEvents.length} balls (1 over) for superover 1st innings...`);

  for (let i = 0; i < superOverFirstInningsEvents.length; i++) {
    const event = superOverFirstInningsEvents[i];
    const ballNum = i + 1;

    console.log(`\n--- Superover 1st Innings Ball ${ballNum} ---`);

    if (event.wicket) {
      console.log('  Clicking W button...');
      const wicketBtn = page.locator('button.pad-btn.danger:has-text("W")').first();
      await wicketBtn.waitFor({ state: 'visible', timeout: 10000 });
      await wicketBtn.click();
      await page.waitForTimeout(500);

      console.log('  Selecting dismissal type...');
      const dismissalBtn = page.locator('button.pad-btn:has-text("BOWLED"), button.pad-btn:has-text("Bowled")').first();
      if (await dismissalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dismissalBtn.click();
        await page.waitForTimeout(1000);
      }

      console.log('  Clicking Submit...');
      const submitBtn = page.locator('button.pad-btn:has-text("Submit")').first();
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.click();
      }

      soOversText = await waitForBallProcessed(soOversText, true, 30000);

      // Handle Next Batsman modal
      await handleSuperOverModals('Superover 1st');
    } else {
      console.log(`  Clicking ${event.run} button...`);
      const runBtn = page.locator(`button.pad-btn:has-text("${event.run}")`).first();
      await runBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => console.log(`  WARNING: Button ${event.run} not visible in time`));

      await page.waitForFunction(
        (btnText) => {
          const buttons = document.querySelectorAll('button.pad-btn');
          for (const btn of buttons) {
            if (btn.textContent.trim() === btnText) {
              return !btn.disabled;
            }
          }
          return false;
        },
        event.run,
        { timeout: 20000 }
      ).catch(() => console.log(`  WARNING: Button ${event.run} did not become enabled in time`));

      await runBtn.click();

      soOversText = await waitForBallProcessed(soOversText, false, 20000);

      // Handle Next Bowler modal with "Start Next Over" button
      await handleSuperOverModals('Superover 1st');
    }

    if ((i + 1) % 6 === 0) {
      console.log(`Superover 1st innings over completed`);
      await page.waitForTimeout(1000);
    }
  }

  console.log('Superover 1st innings (1 over) completed!');

  // =========== SUPER OVER SECOND INNINGS ===========
  console.log('\n========== SUPER OVER SECOND INNINGS ==========\n');

  // Wait for the new innings start modal for superover second innings
  console.log('Waiting for match start modal for superover 2nd innings...');
  const matchStartModal2 = page.locator('.modal-overlay:has(.modal h2:has-text("Start Innings"))').first();
  await matchStartModal2.waitFor({ state: 'visible', timeout: 20000 }).catch(() => console.log('Match start modal for 2nd innings did not appear in time'));
  await page.waitForTimeout(1000);

  // Debug: Log what's in the dropdowns
  const dropdownOptions = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    const result = [];
    selects.forEach((sel, idx) => {
      const options = Array.from(sel.options).map(opt => ({ value: opt.value, text: opt.text }));
      result.push({ index: idx, options });
    });
    return result;
  });
  console.log('Dropdown options for superover 2nd innings:', JSON.stringify(dropdownOptions, null, 2));

  console.log('Selecting striker for superover 2nd innings...');
  const so2StrikerSelect = matchStartModal2.locator('select').first();
  if (await so2StrikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    // In superover 2nd innings, Team A bats (since Team B batted first in superover)
    // Use index 2 to pick a different player (avoid collision with bowler)
    await so2StrikerSelect.selectOption({ index: 2 });
    await page.waitForTimeout(500);
  }

  console.log('Selecting non-striker for superover 2nd innings...');
  const so2NonStrikerSelect = matchStartModal2.locator('select').nth(1);
  if (await so2NonStrikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await so2NonStrikerSelect.selectOption({ index: 3 });
    await page.waitForTimeout(500);
  }

  console.log('Selecting bowler for superover 2nd innings...');
  const so2BowlerSelect = matchStartModal2.locator('select').nth(2);
  if (await so2BowlerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    // In superover 2nd innings, Team B bowls
    // Use index 2 to pick a different player
    await so2BowlerSelect.selectOption({ index: 2 });
    await page.waitForTimeout(500);
  }

  console.log('Clicking Start Innings button for superover 2nd innings...');
  // First handle any modals that might be intercepting (Next Bowler, Next Batsman)
  await handleSuperOverModals('Superover 2nd pre-start');

  // Wait for any OTHER modal overlays to fully close (not the match start modal itself)
  // The match start modal has "Start Innings" in its h2, so we exclude it
  await page.locator('.modal-overlay:not(:has(.modal h2:has-text("Start Innings")))').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => console.log('Other modal overlays may still be present'));
  await page.waitForTimeout(1000);

  // Use page.evaluate to click the button directly, bypassing Playwright's overlay detection
  // This ensures the React onClick handler (handleStartInnings) is triggered
  const clicked = await page.evaluate(() => {
    // Find the modal overlay containing "Start Innings" text
    const overlays = document.querySelectorAll('.modal-overlay');
    for (const overlay of overlays) {
      const modal = overlay.querySelector('.modal');
      if (modal) {
        const h2 = modal.querySelector('h2');
        if (h2 && h2.textContent.includes('Start Innings')) {
          const btn = overlay.querySelector('button');
          if (btn && btn.textContent.includes('Start Innings')) {
            btn.click();
            return true;
          }
        }
      }
    }
    return false;
  });

  if (clicked) {
    console.log('Start Innings button clicked via evaluate');
    await page.waitForTimeout(1000);
  } else {
    console.log('Start Innings button not found via evaluate');
    // Fallback to regular click
    const so2StartInningsBtn = matchStartModal2.locator('button:has-text("Start Innings")').first();
    if (await so2StartInningsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await so2StartInningsBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  // Wait for match start modal to close
  await matchStartModal2.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => console.log('Match start modal for 2nd innings did not hide in time'));
  await page.waitForTimeout(1000);

  console.log('Superover 2nd innings openers and bowler selected.');
  await page.waitForTimeout(1000);

  // Handle any modals that appear after the innings starts (e.g., Next Bowler modal)
  await handleSuperOverModals('Superover 2nd post-start');

  soOversText = await page.evaluate(() => {
    const liveCard = document.querySelector('.live-card');
    if (liveCard) {
      const text = liveCard.textContent;
      const match = text?.match(/\(([\d.]+)\s*ov\)/);
      if (match) return match[1];
    }
    return '0.0';
  });
  console.log(`Superover 2nd innings initial overs: ${soOversText}`);

  // Simulate 1 over (6 balls) for superover second innings
  const superOverSecondInningsEvents = [
    { run: '1', wicket: false },
    { run: '1', wicket: false },
    { run: '4', wicket: false },
    { run: '1', wicket: false },
    { run: '6', wicket: false },
    { run: '1', wicket: false },
  ];

  console.log(`Simulating ${superOverSecondInningsEvents.length} balls (1 over) for superover 2nd innings...`);

  for (let i = 0; i < superOverSecondInningsEvents.length; i++) {
    const event = superOverSecondInningsEvents[i];
    const ballNum = i + 1;

    console.log(`\n--- Superover 2nd Innings Ball ${ballNum} ---`);

    if (event.wicket) {
      console.log('  Clicking W button...');
      const wicketBtn = page.locator('button.pad-btn.danger:has-text("W")').first();
      await wicketBtn.waitFor({ state: 'visible', timeout: 10000 });
      await wicketBtn.click();
      await page.waitForTimeout(500);

      console.log('  Selecting dismissal type...');
      const dismissalBtn = page.locator('button.pad-btn:has-text("BOWLED"), button.pad-btn:has-text("Bowled")').first();
      if (await dismissalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dismissalBtn.click();
        await page.waitForTimeout(1000);
      }

      console.log('  Clicking Submit...');
      const submitBtn = page.locator('button.pad-btn:has-text("Submit")').first();
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.click();
      }

      soOversText = await waitForBallProcessed(soOversText, true, 30000);

      await handleSuperOverModals('Superover 2nd');
    } else {
      console.log(`  Clicking ${event.run} button...`);
      const runBtn = page.locator(`button.pad-btn:has-text("${event.run}")`).first();
      await runBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => console.log(`  WARNING: Button ${event.run} not visible in time`));

      await page.waitForFunction(
        (btnText) => {
          const buttons = document.querySelectorAll('button.pad-btn');
          for (const btn of buttons) {
            if (btn.textContent.trim() === btnText) {
              return !btn.disabled;
            }
          }
          return false;
        },
        event.run,
        { timeout: 20000 }
      ).catch(() => console.log(`  WARNING: Button ${event.run} did not become enabled in time`));

      // Use force click to bypass any modal overlay interception
      await runBtn.click({ force: true });

      soOversText = await waitForBallProcessed(soOversText, false, 20000);

      await handleSuperOverModals('Superover 2nd');
    }

    if ((i + 1) % 6 === 0) {
      console.log(`Superover 2nd innings over completed`);
      await page.waitForTimeout(1000);
    }
  }

  console.log('Superover 2nd innings (1 over) completed! Match simulation fully finished.');

  // End match
  await page.keyboard.press('e');
  await page.waitForTimeout(1000);
  const endBtn2 = page.locator('button:has-text("End"), button:has-text("Finish"), button:has-text("End Match")').first();
  if (await endBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await endBtn2.click();
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