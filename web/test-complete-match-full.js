import { chromium } from 'playwright';

async function testCompleteMatchFull() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Step 1: Create match
  console.log('=== Step 1: Create match ===');
  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.locator('button:has-text("New match")').first().click();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="India"]', 'Team A');
  await page.fill('input[placeholder="Australia"]', 'Team B');

  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill('2');
  await numberInputs.nth(1).fill('3');

  await page.locator('button:has-text("Quick fill")').first().click();
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Quick fill")').nth(1).click();
  await page.waitForTimeout(1000);

  await page.locator('button:has-text("Create match")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Toss - click Bat for Team A
  await page.locator('button:has-text("Bat")').first().click();
  await page.waitForTimeout(2000);

  // Now at scoring screen
  const matchUrl = page.url();
  console.log('Match URL:', matchUrl);

  const matchIdMatch = matchUrl.match(/match\/([^\/]+)/);
  const matchId = matchIdMatch[1];
  console.log('Match ID:', matchId);

  // Step 2: Start 1st innings
  console.log('\n=== Step 2: Start 1st innings ===');

  // Select striker (Player 1)
  await page.locator('select').first().selectOption({ index: 1 });
  // Select non-striker (Player 2)
  await page.locator('select').nth(1).selectOption({ index: 2 });
  // Select bowler (Player 1 from Team B)
  await page.locator('select').nth(2).selectOption({ index: 1 });

  // Click Start Innings
  await page.locator('button:has-text("Start Innings")').first().click();
  await page.waitForTimeout(2000);

  // Step 3: Score 1st innings (2 overs = 12 balls)
  console.log('\n=== Step 3: Score 1st innings (2 overs) ===');

  for (let over = 0; over < 2; over++) {
    for (let ball = 0; ball < 6; ball++) {
      // Click "1" run button
      const runBtn = page.locator('button.pad-btn:has-text("1")').first();
      if (await runBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await runBtn.click();
        await page.waitForTimeout(500);
      } else {
        console.log(`  Warning: Could not click run 1 for ball ${ball + 1} of over ${over + 1}`);
      }
    }
    console.log(`  Completed over ${over + 1}`);
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(3000);

  // Check status after 1st innings
  let pageText = await page.textContent('body');
  console.log('After 1st innings:', pageText?.substring(0, 500));

  // Step 4: Start 2nd innings if needed
  console.log('\n=== Step 4: Start 2nd innings ===');

  if (pageText?.includes('Start Innings') || pageText?.toLowerCase().includes('innings break')) {
    console.log('Starting 2nd innings...');

    // Select batters for Team B (now batting)
    await page.locator('select').first().selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 2 });
    // Select bowler from Team A
    await page.locator('select').nth(2).selectOption({ index: 1 });

    await page.locator('button:has-text("Start Innings")').first().click();
    await page.waitForTimeout(2000);

    // Score 2nd innings (2 overs = 12 balls)
    console.log('Scoring 2nd innings...');
    for (let over = 0; over < 2; over++) {
      for (let ball = 0; ball < 6; ball++) {
        const runBtn = page.locator('button.pad-btn:has-text("1")').first();
        if (await runBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await runBtn.click();
          await page.waitForTimeout(500);
        } else {
          console.log(`  Warning: Could not click run 1 for ball ${ball + 1} of over ${over + 1}`);
        }
      }
      console.log(`  Completed over ${over + 1}`);
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(3000);
  }

  // Step 5: Check completed match and go to report
  console.log('\n=== Step 5: Check completed match and go to report ===');

  pageText = await page.textContent('body');
  console.log('Final page text:', pageText?.substring(0, 1000));

  if (pageText?.includes('COMPLETED') || pageText?.includes('won by') || pageText?.includes('Match result')) {
    console.log('*** MATCH APPEARS COMPLETED ***');
  }

  // Go to report tab
  const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/report`;
  console.log('Going to report tab:', reportUrl);
  await page.goto(reportUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const reportText = await page.textContent('body');
  console.log('Report page content:', reportText?.substring(0, 1500));

  await page.screenshot({ path: `production-completed-match-${matchId}-report.png`, fullPage: true });
  console.log(`Screenshot saved as production-completed-match-${matchId}-report.png`);

  // Step 6: Go back to home
  console.log('\n=== Step 6: Go back to home ===');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const homeText = await page.textContent('body');
  console.log('Home page after back:', homeText?.substring(0, 500));

  await page.screenshot({ path: `production-home-after-back.png`, fullPage: true });
  console.log('Screenshot saved as production-home-after-back.png');

  // Step 7: Click the match card again to see if it works
  console.log('\n=== Step 7: Click match card again ===');
  const matchCard = page.locator('.match-card').first();
  if (await matchCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await matchCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const matchPageText = await page.textContent('body');
    console.log('Match page after re-click:', matchPageText?.substring(0, 500));

    // Go to report tab
    await page.goto(reportUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const reportText2 = await page.textContent('body');
    console.log('Report page after re-click:', reportText2?.substring(0, 500));
  }

  // Keep browser open
  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testCompleteMatchFull().catch(console.error);