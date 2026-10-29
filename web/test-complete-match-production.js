import { chromium } from 'playwright';

async function testCompleteMatchProduction() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Step 1: Create a new match
  console.log('=== Step 1: Create new match ===');
  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click New match
  const newMatchBtn = page.locator('button:has-text("New match")').first();
  await newMatchBtn.click();
  await page.waitForTimeout(1000);

  // Fill match form using placeholder-based selectors
  console.log('Filling match form...');

  // Team A name (placeholder "India")
  await page.fill('input[placeholder="India"]', 'Team A');

  // Team B name (placeholder "Australia")
  await page.fill('input[placeholder="Australia"]', 'Team B');

  // Get number inputs - overs and players per team
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill('2'); // overs
  await numberInputs.nth(1).fill('3'); // players per team

  // No need to select toss - defaults should work

  // Create match
  const createBtn = page.locator('button:has-text("Create match")').first();
  await createBtn.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const matchUrl = page.url();
  console.log('Match created at:', matchUrl);

  const matchIdMatch = matchUrl.match(/match\/([^\/]+)/);
  if (!matchIdMatch) {
    console.error('Could not extract match ID!');
    await browser.close();
    return;
  }
  const matchId = matchIdMatch[1];
  console.log('Match ID:', matchId);

  // Step 2: Start first innings - select batters and bowler
  console.log('\n=== Step 2: Start 1st innings ===');

  // Wait for scoring screen to load
  await page.waitForSelector('.scoring-screen, .pad-container', { timeout: 10000 });

  // Select striker (Player 1)
  const strikerSelect = page.locator('select').first();
  await strikerSelect.selectOption({ index: 1 }); // Player 1

  // Select non-striker (Player 2)
  const nonStrikerSelect = page.locator('select').nth(1);
  await nonStrikerSelect.selectOption({ index: 2 }); // Player 2

  // Select bowler (Player 3 from Team B)
  const bowlerSelect = page.locator('select').nth(2);
  await bowlerSelect.selectOption({ index: 1 }); // Player 1 (from Team B)

  // Click Start Innings
  const startInningsBtn = page.locator('button:has-text("Start Innings")').first();
  await startInningsBtn.click();
  await page.waitForTimeout(2000);

  // Step 3: Score 2 overs (12 balls) for 1st innings
  console.log('\n=== Step 3: Score 1st innings (2 overs) ===');

  for (let over = 0; over < 2; over++) {
    for (let ball = 0; ball < 6; ball++) {
      // Try to click run button "1"
      let clicked = false;

      // First try the visible "1" button
      const runBtn = page.locator('button:has-text("1")').first();
      if (await runBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await runBtn.click();
        clicked = true;
      } else {
        // Look for run buttons in the pad
        const runButtons = page.locator('.pad button, .scoring-pad button, button[class*="run"]');
        const count = await runButtons.count();
        for (let i = 0; i < count; i++) {
          const btn = runButtons.nth(i);
          const text = await btn.textContent().catch(() => '');
          if (text?.trim() === '1') {
            await btn.click();
            clicked = true;
            break;
          }
        }
      }

      if (!clicked) {
        console.log(`  Warning: Could not click run 1 for ball ${ball + 1} of over ${over + 1}`);
      }
      await page.waitForTimeout(500);
    }
    console.log(`  Completed over ${over + 1}`);
    await page.waitForTimeout(1000);
  }

  // Wait for innings break or end of innings
  await page.waitForTimeout(3000);

  // Check status
  const pageText = await page.textContent('body');
  console.log('After 1st innings page text:', pageText?.substring(0, 500));

  // Step 4: Start 2nd innings if needed
  console.log('\n=== Step 4: Start 2nd innings ===');

  // Check if we need to start 2nd innings
  if (pageText?.includes('Start Innings') || pageText?.toLowerCase().includes('innings break')) {
    console.log('Need to start 2nd innings...');

    // Select batters for Team B (now batting)
    const strikerSelect2 = page.locator('select').first();
    await strikerSelect2.selectOption({ index: 1 });

    const nonStrikerSelect2 = page.locator('select').nth(1);
    await nonStrikerSelect2.selectOption({ index: 2 });

    // Select bowler from Team A
    const bowlerSelect2 = page.locator('select').nth(2);
    await bowlerSelect2.selectOption({ index: 1 });

    const startInningsBtn2 = page.locator('button:has-text("Start Innings")').first();
    await startInningsBtn2.click();
    await page.waitForTimeout(2000);

    // Score 2 overs for 2nd innings
    console.log('Scoring 2nd innings...');
    for (let over = 0; over < 2; over++) {
      for (let ball = 0; ball < 6; ball++) {
        let clicked = false;

        const runBtn = page.locator('button:has-text("1")').first();
        if (await runBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await runBtn.click();
          clicked = true;
        } else {
          const runButtons = page.locator('.pad button, .scoring-pad button, button[class*="run"]');
          const count = await runButtons.count();
          for (let i = 0; i < count; i++) {
            const btn = runButtons.nth(i);
            const text = await btn.textContent().catch(() => '');
            if (text?.trim() === '1') {
              await btn.click();
              clicked = true;
              break;
            }
          }
        }

        if (!clicked) {
          console.log(`  Warning: Could not click run 1 for ball ${ball + 1} of over ${over + 1}`);
        }
        await page.waitForTimeout(500);
      }
      console.log(`  Completed over ${over + 1}`);
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(3000);
  }

  // Step 5: Check if match is complete and go to report tab
  console.log('\n=== Step 5: Check completed match and go to report ===');

  const finalText = await page.textContent('body');
  console.log('Final page text:', finalText?.substring(0, 1000));

  // Check for MatchResultScreen or completed status
  if (finalText?.includes('COMPLETED') || finalText?.includes('won by') || finalText?.includes('Match result')) {
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

  // Take screenshot
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

  // Keep browser open
  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testCompleteMatchProduction().catch(console.error);