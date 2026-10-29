import { chromium } from 'playwright';

async function simulateMatch() {
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

  // Create match
  console.log('Creating match...');
  await page.locator('button:has-text("New match"), button:has-text("New Match"), button:has-text("Create")').first().click();
  await page.waitForTimeout(1500);

  await page.locator('input[placeholder="India"]').first().fill('India');
  await page.locator('input[placeholder="Australia"]').first().fill('Australia');
  await page.locator('input[type="number"]').first().fill('20');

  const quickFills = page.locator('button:has-text("Quick fill")');
  for (let i = 0; i < await quickFills.count(); i++) {
    await quickFills.nth(i).click();
    await page.waitForTimeout(300);
  }

  await page.locator('button:has-text("Create match")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Toss
  console.log('Toss: India bats...');
  await page.locator('button:has-text("Bat")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Select openers & bowler
  console.log('Selecting openers & bowler...');
  const selects = page.locator('select');
  if (await selects.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await selects.nth(0).selectOption({ index: 1 }); // Striker
    await page.waitForTimeout(200);
    await selects.nth(1).selectOption({ index: 2 }); // Non-striker
    await page.waitForTimeout(200);
    await selects.nth(2).selectOption({ index: 1 }); // Bowler (index 1 for over 1)
    await page.waitForTimeout(500);
  }

  console.log('Starting 20 overs...');

  const events = [
    '1','0','4','1','0','1',  // Over 1
    '1','1','6','0','1','1',  // Over 2
    '0','4','1','W','1','0',  // Over 3
    '1','1','2','1','4','1',  // Over 4
    '6','0','1','1','0','1',  // Over 5
    '4','1','1','W','0','1',  // Over 6
    '1','2','1','4','1','0',  // Over 7
    '1','6','0','1','1','4',  // Over 8
    'W','1','0','1','1','1',  // Over 9
    '4','1','2','1','6','0',  // Over 10
    '1','1','4','0','1','1',  // Over 11
    '1','W','1','0','4','1',  // Over 12
    '2','1','1','4','1','0',  // Over 13
    '6','1','0','1','W','1',  // Over 14
    '1','4','1','1','2','1',  // Over 15
    '4','1','1','6','0','1',  // Over 16
    '1','0','W','1','4','1',  // Over 17
    '2','1','4','1','1','0',  // Over 18
    '1','6','0','4','1','1',  // Over 19
    '4','1','W','1','6','1',  // Over 20
  ];

  // Track bowler selection - use different bowler each over (rotate through indices 1, 2, 3, 4...)
  let bowlerIndex = 1; // Started with index 1 for over 1

  // Helper to click a run button - with longer wait to ensure API call completes
  async function clickRun(runs) {
    const btn = page.locator('button.pad-btn').filter({ hasText: String(runs) }).first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.click();
    // Wait longer for API call to complete
    await page.waitForTimeout(800);
  }

  // Helper to click wicket
  async function clickWicket() {
    await page.locator('button.pad-btn.danger:has-text("W")').first().click();
    await page.waitForTimeout(500);
    await page.locator('button.pad-btn:has-text("BOWLED")').first().click();
    await page.waitForTimeout(500);
    await page.locator('button.pad-btn:has-text("Submit")').first().click();
    // Wait longer for wicket API call
    await page.waitForTimeout(1500);

    // Verify wicket mode exited
    const dismissalBtns = await page.locator('button.pad-btn:has-text("BOWLED"), button.pad-btn:has-text("CAUGHT"), button.pad-btn:has-text("LBW")').count();
    if (dismissalBtns > 0) {
      console.log('  WARNING: Wicket mode still active after submit!');
    }
  }

  // Helper to select bowler at start of over - rotate through available bowlers
  async function ensureBowlerSelected(overNum) {
    if (overNum > 1) {
      const bowlerSelect = page.locator('label.bowler-select select').first();
      if (await bowlerSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Rotate to next bowler index (1, 2, 3, 4, ... wrap around)
        bowlerIndex = bowlerIndex + 1;
        // Get max options to wrap around
        const options = await bowlerSelect.locator('option').all();
        const maxIndex = options.length - 1; // -1 for "Select..." option
        if (bowlerIndex > maxIndex) bowlerIndex = 1;

        console.log(`  Over ${overNum}: Selecting bowler index ${bowlerIndex}...`);
        await bowlerSelect.selectOption({ index: bowlerIndex });
        await page.waitForTimeout(500);

        // Verify no error
        const errorEl = page.locator('p.error');
        const errorText = await errorEl.textContent({ timeout: 1000 }).catch(() => '');
        if (errorText && errorText.includes('consecutive')) {
          console.log(`  WARNING: Bowler error: ${errorText}. Trying next...`);
          // Try next bowler
          bowlerIndex = bowlerIndex + 1;
          if (bowlerIndex > maxIndex) bowlerIndex = 1;
          await bowlerSelect.selectOption({ index: bowlerIndex });
          await page.waitForTimeout(500);
        }
      }
    }
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const ballInOver = (i % 6) + 1;
    const overNum = Math.floor(i / 6) + 1;
    const ballNum = i + 1;

    // At start of new over (except first), ensure bowler is selected
    if (ballInOver === 1) {
      await ensureBowlerSelected(overNum);
    }

    try {
      if (event === 'W') {
        console.log(`  Ball ${ballNum} (Over ${overNum}.${ballInOver}): W`);
        await clickWicket();
      } else {
        console.log(`  Ball ${ballNum} (Over ${overNum}.${ballInOver}): ${event}`);
        await clickRun(event);
      }
    } catch (e) {
      console.log(`  ERROR on ball ${ballNum} (Over ${overNum}.${ballInOver}, ${event}):`, e.message);
      const allButtons = await page.locator('button').all();
      const allTexts = await Promise.all(allButtons.map(b => b.textContent()));
      console.log('  All buttons:', allTexts.filter(t => t?.trim()));

      const errorEl = page.locator('p.error');
      const errorText = await errorEl.textContent({ timeout: 1000 }).catch(() => '');
      if (errorText) console.log('  Page error:', errorText);

      throw e;
    }

    if (ballInOver === 6) {
      console.log(`  Over ${overNum} done`);
    }
  }

  console.log('20 overs completed!');

  // End match - wait for any pending API calls
  await page.waitForTimeout(2000);
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  const endBtn = page.locator('button:has-text("End"), button:has-text("Finish")').first();
  if (await endBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(2000);
  }

  // Go home & reload
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const content = await page.textContent('body');
  console.log('Home screen shows "india":', content?.toLowerCase().includes('india'));
  console.log('Home screen shows "australia":', content?.toLowerCase().includes('australia'));
  console.log('Home screen shows "18." or "19." or "20.":', content?.match(/1[89]\.|20\./));

  console.log('\nKeeping browser open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateMatch().catch(e => { console.error(e); process.exit(1); });