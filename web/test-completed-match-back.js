import { chromium } from 'playwright';

async function testCompletedMatchFlow() {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('=== Step 1: Load home page ===');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  let homeText = await page.textContent('body');
  console.log('Home page content:', homeText?.substring(0, 500));

  console.log('\n=== Step 2: Create new match ===');
  const newMatchBtn = page.locator('button:has-text("+ New match"), button:has-text("New match"), button:has-text("Create")').first();
  await newMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newMatchBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForURL('**/#/new', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Fill match setup form
  const teamAInput = page.locator('input[placeholder="India"]').first();
  const teamBInput = page.locator('input[placeholder="Australia"]').first();
  await teamAInput.fill('Test Team A');
  await teamBInput.fill('Test Team B');

  const oversInput = page.locator('input[type="number"]').first();
  if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await oversInput.fill('2');
  }

  const playersInput = page.locator('input[type="number"]').nth(1);
  if (await playersInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await playersInput.fill('3');
  }

  // Quick fill both teams
  const quickFillA = page.locator('button:has-text("Quick fill")').first();
  await quickFillA.click();
  await page.waitForTimeout(1000);
  const quickFillB = page.locator('button:has-text("Quick fill")').nth(1);
  await quickFillB.click();
  await page.waitForTimeout(1000);

  // Submit
  const createBtn = page.locator('button:has-text("Create match")');
  await createBtn.waitFor({ state: 'visible', timeout: 5000 });
  await createBtn.click();

  // Wait for toss screen
  const batBtn = page.locator('button:has-text("Bat")').first();
  await batBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Toss screen appeared');
  await page.waitForTimeout(1000);

  // Record toss
  await batBtn.click();
  console.log('Clicked Bat for toss');

  // Wait for scoring screen
  await page.waitForURL('**/#/match/**', { timeout: 20000 });
  console.log('URL changed to match page:', page.url());
  await page.waitForTimeout(2000);

  const matchUrl = page.url();
  const matchIdMatch = matchUrl.match(/\/match\/([^\/]+)/);
  const matchId = matchIdMatch ? matchIdMatch[1] : null;
  console.log('Match ID:', matchId);

  if (!matchId) {
    console.log('*** NO MATCH ID FOUND ***');
    await browser.close();
    return;
  }

  // Get scorer token from localStorage (stored under 'cricket.scorerTokens')
  const scorerToken = await page.evaluate((matchId) => {
    const raw = localStorage.getItem('cricket.scorerTokens');
    if (!raw) return null;
    try {
      const tokens = JSON.parse(raw);
      return tokens[matchId] || null;
    } catch {
      return null;
    }
  }, matchId);
  console.log('Scorer token:', scorerToken ? 'found' : 'not found');

  console.log('\n=== Step 3: Complete the match via app\'s supabase client ===');
  // Use the app's getSupabase function via dynamic import
  await page.evaluate(async ({ matchId }) => {
    // Import the app's supabase module
    const { getSupabase } = await import('/src/supabase.ts');
    const supabase = getSupabase();

    // First load the current match
    const { data: match, error } = await supabase
      .from('matches')
      .select('config, events')
      .eq('id', matchId)
      .maybeSingle();

    if (error || !match) {
      console.error('Failed to load match:', error);
      return;
    }

    console.log('Loaded match config:', match.config);
    console.log('Current events:', match.events?.length || 0);

    // Build completed match events
    const events = match.events || [];
    const now = new Date().toISOString();
    let seq = events.length > 0 ? Math.max(...events.map(e => e.seq)) + 1 : 0;

    // If no events, add toss
    if (events.length === 0) {
      events.push({
        type: 'TOSS',
        seq: seq++,
        timestamp: now,
        payload: { winner: 'A', decision: 'bat' }
      });
    }

    // Add INNINGS_START for innings 1 (Team A)
    events.push({
      type: 'INNINGS_START',
      seq: seq++,
      timestamp: now,
      payload: { inningsNumber: 1, battingTeam: 'A' }
    });

    // 12 balls for Team A (2 overs)
    const aBatsmen = ['player-1', 'player-2', 'player-3'];
    const bBowlers = ['player-4', 'player-5', 'player-6'];

    for (let over = 1; over <= 2; over++) {
      const bowler = bBowlers[over - 1];
      for (let ball = 1; ball <= 6; ball++) {
        const striker = aBatsmen[(over + ball) % 2];
        const nonStriker = aBatsmen[(over + ball + 1) % 2];
        const runs = ball === 6 ? 4 : (ball % 2 === 0 ? 1 : 0);

        events.push({
          type: 'BALL',
          seq: seq++,
          timestamp: now,
          payload: {
            inningsNumber: 1,
            overNumber: over,
            ballNumber: ball,
            batter: striker,
            nonStriker: nonStriker,
            bowler: bowler,
            runs: { batter: runs, extras: 0, total: runs },
            extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
            wicket: null,
            isLastBallOfOver: ball === 6
          }
        });
      }
    }

    // Innings 1 complete
    events.push({
      type: 'INNINGS_END',
      seq: seq++,
      timestamp: now,
      payload: { inningsNumber: 1, battingTeam: 'A', totalRuns: 20, totalWickets: 0, overs: '2.0' }
    });

    // Innings 2: Team B bats
    events.push({
      type: 'INNINGS_START',
      seq: seq++,
      timestamp: now,
      payload: { inningsNumber: 2, battingTeam: 'B' }
    });

    const bBatsmen = ['player-4', 'player-5', 'player-6'];
    const aBowlers = ['player-1', 'player-2', 'player-3'];

    for (let over = 1; over <= 2; over++) {
      const bowler = aBowlers[over - 1];
      for (let ball = 1; ball <= 6; ball++) {
        const striker = bBatsmen[(over + ball) % 2];
        const nonStriker = bBatsmen[(over + ball + 1) % 2];
        const runs = ball === 6 ? 6 : (ball % 2 === 0 ? 2 : 1);

        events.push({
          type: 'BALL',
          seq: seq++,
          timestamp: now,
          payload: {
            inningsNumber: 2,
            overNumber: over,
            ballNumber: ball,
            batter: striker,
            nonStriker: nonStriker,
            bowler: bowler,
            runs: { batter: runs, extras: 0, total: runs },
            extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
            wicket: null,
            isLastBallOfOver: ball === 6
          }
        });
      }
    }

    // Innings 2 complete
    events.push({
      type: 'INNINGS_END',
      seq: seq++,
      timestamp: now,
      payload: { inningsNumber: 2, battingTeam: 'B', totalRuns: 36, totalWickets: 0, overs: '2.0' }
    });

    // Match complete
    events.push({
      type: 'MATCH_COMPLETE',
      seq: seq++,
      timestamp: now,
      payload: { winner: 'B', margin: { type: 'runs', value: 16 } }
    });

    // Update the match in database
    const { error: updateError } = await supabase
      .from('matches')
      .update({ events: events, updated_at: now })
      .eq('id', matchId);

    if (updateError) {
      console.error('Failed to update match:', updateError);
    } else {
      console.log('Match completed successfully! Events:', events.length);
    }
  }, { matchId });

  await page.waitForTimeout(3000);

  console.log('\n=== Step 4: Go to report tab for completed match ===');
  const reportUrl = `http://localhost:5173/#/match/${matchId}/report`;
  await page.goto(reportUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const reportText = await page.textContent('body');
  console.log('Report page content:', reportText?.substring(0, 1500));

  if (reportText?.includes('Match Result') || reportText?.includes('won by') || reportText?.includes('COMPLETED') || reportText?.includes('Test Team B won')) {
    console.log('*** MATCH RESULT SCREEN DISPLAYED ***');
  } else if (reportText?.includes('Loading') || reportText?.includes('Error') || reportText?.trim() === '') {
    console.log('*** REPORT TAB APPEARS BLANK/BROKEN ***');
  } else {
    console.log('*** REPORT TAB SHOWS REGULAR REPORT (not completed) ***');
  }

  await page.screenshot({ path: 'completed-report-tab.png', fullPage: true });

  console.log('\n=== Step 5: Go back home using browser back ===');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const homeTextAfterBack = await page.textContent('body');
  console.log('Home page after back:', homeTextAfterBack?.substring(0, 500));

  await page.screenshot({ path: 'completed-home-after-back.png', fullPage: true });

  if (!homeTextAfterBack?.includes('Cricket Scorer') || !homeTextAfterBack?.includes('New match')) {
    console.log('*** HOME PAGE APPEARS BLANK/BROKEN AFTER BACK ***');
  } else {
    console.log('*** HOME PAGE LOOKS OK AFTER BACK ***');
  }

  console.log('\n=== Step 6: Click match card again ===');
  const matchCard = page.locator('.match-card').filter({ hasText: 'Test Team A' }).first();
  if (await matchCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await matchCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const matchPageText = await page.textContent('body');
    console.log('Match page after re-click:', matchPageText?.substring(0, 500));
  }

  await page.waitForTimeout(10000);
  await browser.close();
}

testCompletedMatchFlow().catch(console.error);