import { chromium } from 'playwright';

async function simulateSecondInnings() {
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

  // Click on the latest match text (first "india vs australia")
  console.log('Opening latest match on scoring tab...');
  await page.locator('text=india vs australia').first().click();

  // Wait for hash navigation
  await page.waitForURL(/.*\/match\/.*/);
  await page.waitForTimeout(2000);

  // Navigate to scoring tab (the default or explicit scoring tab)
  // The URL might be /report, /scorecard, etc. - we need /scoring or base
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // If on report/scorecard/wheel/charts tab, go to scoring tab
  if (currentUrl.includes('/report') || currentUrl.includes('/scorecard') || currentUrl.includes('/wheel') || currentUrl.includes('/charts')) {
    // Replace the tab part with /scoring
    const baseUrl = currentUrl.replace(/\/report|\/scorecard|\/wheel|\/charts/, '');
    const scoringUrl = baseUrl.endsWith('/') ? baseUrl + 'scoring' : baseUrl + '/scoring';
    console.log('Navigating to scoring tab:', scoringUrl);
    await page.goto(scoringUrl);
    await page.waitForTimeout(2000);
  }

  // Wait for the scoring tab to load
  await page.waitForURL(/.*\/match\/.*(scoring|$)/);
  await page.waitForTimeout(2000);

  // Check current status
  const bodyText = await page.textContent('body');
  console.log('Current status:', bodyText?.includes('INNINGS_BREAK') || bodyText?.includes('innings break') ? 'INNINGS_BREAK' :
             bodyText?.includes('IN_PROGRESS') ? 'IN_PROGRESS' : 'UNKNOWN');
  console.log('Page title:', await page.title());
  console.log('URL:', page.url());

  // Wait for innings break screen - the select dropdowns should be visible on scoring tab
  console.log('Waiting for second innings setup...');
  await page.waitForTimeout(2000);

  // Wait for the select dropdowns to be visible
  await page.locator('select').first().waitFor({ state: 'visible', timeout: 15000 });

  const selects = page.locator('select');
  const selectCount = await selects.count();
  console.log(`Found ${selectCount} select elements`);

  if (selectCount >= 3) {
    console.log('Selecting openers and bowler for 2nd innings...');
    await selects.nth(0).selectOption({ index: 1 }); // Striker
    await page.waitForTimeout(200);
    await selects.nth(1).selectOption({ index: 2 }); // Non-striker
    await page.waitForTimeout(200);
    await selects.nth(2).selectOption({ index: 1 }); // Bowler
    await page.waitForTimeout(500);
    console.log('Selected openers and bowler for 2nd innings');
  } else {
    console.log('ERROR: Not enough select elements found!');
    // Debug: show what's on the page
    const allText = await page.textContent('body');
    console.log('Page content:', allText?.substring(0, 2000));
    throw new Error('Innings break screen not found on scoring tab');
  }

  console.log('Starting 2nd innings (20 overs)...');

  // Second innings events - Australia chasing
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

  // Track bowler selection - rotate through available bowlers
  let bowlerIndex = 1;

  // Helper to click a run button
  async function clickRun(runs) {
    const btn = page.locator('button.pad-btn').filter({ hasText: String(runs) }).first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(800);
  }

  // Helper to click wicket
  async function clickWicket() {
    await page.locator('button.pad-btn.danger:has-text("W")').first().click();
    await page.waitForTimeout(500);
    await page.locator('button.pad-btn:has-text("BOWLED")').first().click();
    await page.waitForTimeout(500);
    await page.locator('button.pad-btn:has-text("Submit")').first().click();
    await page.waitForTimeout(1500);

    const dismissalBtns = await page.locator('button.pad-btn:has-text("BOWLED"), button.pad-btn:has-text("CAUGHT"), button.pad-btn:has-text("LBW")').count();
    if (dismissalBtns > 0) {
      console.log('  WARNING: Wicket mode still active after submit!');
    }
  }

  // Helper to select bowler at start of over
  async function ensureBowlerSelected(overNum) {
    if (overNum > 1) {
      const bowlerSelect = page.locator('label.bowler-select select').first();
      if (await bowlerSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        bowlerIndex = bowlerIndex + 1;
        const options = await bowlerSelect.locator('option').all();
        const maxIndex = options.length - 1;
        if (bowlerIndex > maxIndex) bowlerIndex = 1;

        console.log(`  Over ${overNum}: Selecting bowler index ${bowlerIndex}...`);
        await bowlerSelect.selectOption({ index: bowlerIndex });
        await page.waitForTimeout(500);

        const errorEl = page.locator('p.error');
        const errorText = await errorEl.textContent({ timeout: 1000 }).catch(() => '');
        if (errorText && errorText.includes('consecutive')) {
          console.log(`  WARNING: Bowler error: ${errorText}. Trying next...`);
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
      const errorEl = page.locator('p.error');
      const errorText = await errorEl.textContent({ timeout: 1000 }).catch(() => '');
      if (errorText) console.log('  Page error:', errorText);
      throw e;
    }

    if (ballInOver === 6) {
      console.log(`  Over ${overNum} done`);
    }
  }

  console.log('2nd innings 20 overs completed!');

  // End match
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

  console.log('\nKeeping browser open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateSecondInnings().catch(e => { console.error(e); process.exit(1); });