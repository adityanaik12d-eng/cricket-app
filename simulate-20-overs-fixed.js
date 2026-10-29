import { chromium } from 'playwright';

async function simulateMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Opening http://localhost:5173...');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Sign in if needed
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Signing in...');
    await emailInput.fill('adityanaik.12d@gmail.com');
    await page.locator('input[type="password"]').first().fill('12345678');
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  // Create new match
  console.log('Creating new match...');
  await page.locator('button:has-text("New match"), button:has-text("New Match"), button:has-text("Create")').first().click();
  await page.waitForTimeout(1500);

  // Fill form
  await page.locator('input[placeholder="India"]').first().fill('India');
  await page.locator('input[placeholder="Australia"]').first().fill('Australia');
  await page.locator('input[type="number"]').first().fill('20');

  // Quick fill both teams
  const quickFills = page.locator('button:has-text("Quick fill")');
  for (let i = 0; i < await quickFills.count(); i++) {
    await quickFills.nth(i).click();
    await page.waitForTimeout(300);
  }

  await page.locator('button:has-text("Create match")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Toss - India bats
  console.log('Recording toss...');
  await page.locator('button:has-text("Bat")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Select openers and bowler
  console.log('Selecting openers and bowler...');
  const selects = page.locator('select');
  if (await selects.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await selects.nth(0).selectOption({ index: 1 }); // Striker
    await page.waitForTimeout(200);
    await selects.nth(1).selectOption({ index: 2 }); // Non-striker
    await page.waitForTimeout(200);
    await selects.nth(2).selectOption({ index: 1 }); // Bowler
    await page.waitForTimeout(500);
  }

  console.log('Pad enabled. Starting 20 overs...');

  // Scoring events - 20 overs x 6 balls
  const events = [
    // Over 1: 1,0,4,1,0,1
    '1','0','4','1','0','1',
    // Over 2: 1,1,6,0,1,1
    '1','1','6','0','1','1',
    // Over 3: 0,4,1,W,1,0
    '0','4','1','W','1','0',
    // Over 4: 1,1,2,1,4,1
    '1','1','2','1','4','1',
    // Over 5: 6,0,1,1,0,1
    '6','0','1','1','0','1',
    // Over 6: 4,1,1,W,0,1
    '4','1','1','W','0','1',
    // Over 7: 1,2,1,4,1,0
    '1','2','1','4','1','0',
    // Over 8: 1,6,0,1,1,4
    '1','6','0','1','1','4',
    // Over 9: W,1,0,1,1,1
    'W','1','0','1','1','1',
    // Over 10: 4,1,2,1,6,0
    '4','1','2','1','6','0',
    // Over 11: 1,1,4,0,1,1
    '1','1','4','0','1','1',
    // Over 12: 1,W,1,0,4,1
    '1','W','1','0','4','1',
    // Over 13: 2,1,1,4,1,0
    '2','1','1','4','1','0',
    // Over 14: 6,1,0,1,W,1
    '6','1','0','1','W','1',
    // Over 15: 1,4,1,1,2,1
    '1','4','1','1','2','1',
    // Over 16: 4,1,1,6,0,1
    '4','1','1','6','0','1',
    // Over 17: 1,0,W,1,4,1
    '1','0','W','1','4','1',
    // Over 18: 2,1,4,1,1,0
    '2','1','4','1','1','0',
    // Over 19: 1,6,0,4,1,1
    '1','6','0','4','1','1',
    // Over 20: 4,1,W,1,6,1
    '4','1','W','1','6','1',
  ];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event === 'W') {
      // Click W button
      await page.locator('button.pad-btn.danger:has-text("W")').first().click();
      await page.waitForTimeout(400);

      // Select first dismissal type (BOWLED)
      await page.locator('button.pad-btn:has-text("BOWLED")').first().click();
      await page.waitForTimeout(200);

      // Click Submit
      await page.locator('button.pad-btn:has-text("Submit")').first().click();
      await page.waitForTimeout(500);
    } else {
      // Click run button - wait for enabled
      const btn = page.locator(`button.pad-btn:has-text("${event}")`).first();
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      // Wait for it to be enabled
      await page.waitForFunction(
        (text) => {
          const buttons = document.querySelectorAll('button.pad-btn');
          for (const b of buttons) {
            if (b.textContent?.trim() === text && !b.disabled) return true;
          }
          return false;
        },
        event,
        { timeout: 10000 }
      ).catch(() => {});
      await btn.click();
      await page.waitForTimeout(350);
    }

    if ((i + 1) % 6 === 0) {
      console.log(`  Over ${(i + 1) / 6} done`);
    }
  }

  console.log('20 overs completed!');

  // End match
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  const endBtn = page.locator('button:has-text("End"), button:has-text("Finish")').first();
  if (await endBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(1000);
  }

  // Go home
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  // Reload to refresh
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const content = await page.textContent('body');
  console.log('Home screen shows India:', content?.includes('India'));
  console.log('Home screen shows Australia:', content?.includes('Australia'));

  console.log('\nKeeping browser open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateMatch().catch(e => { console.error(e); process.exit(1); });