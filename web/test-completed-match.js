import { chromium } from 'playwright';

async function testCompletedMatchFlow() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
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

  // Get scorer token from localStorage
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

  console.log('\n=== Step 3: Complete the match using app internal API ===');

  // Use the app's internal api.postEvent to properly score balls
  await page.evaluate(async ({ matchId }) => {
    // Import the app's supabase and api modules
    const { getSupabase } = await import('/src/supabase.ts');
    const { api } = await import('/src/api.ts');

    // Load the match row directly to get config
    const supabase = getSupabase();
    const { data: matchRow, error } = await supabase
      .from('matches')
      .select('config, events')
      .eq('id', matchId)
      .maybeSingle();

    if (error || !matchRow) {
      console.error('Failed to load match:', error);
      return;
    }

    const config = matchRow.config;
    const events = matchRow.events || [];

    console.log('Match config:', config);
    console.log('Current events:', events.length);

    const playerRefs = config.playerRefs || {};

    // Get player IDs for both teams (from lineups)
    const teamAPlayers = config.lineups?.A || [];
    const teamBPlayers = config.lineups?.B || [];

    console.log('Team A players:', teamAPlayers);
    console.log('Team B players:', teamBPlayers);

    // Helper to post event
    const post = async (event) => {
      console.log('Posting event:', JSON.stringify(event));
      const result = await api.postEvent(matchId, event);
      console.log('Posted event:', event.type, 'seq:', result.seq, 'status:', result.live?.status);
      return result;
    };

    // First, let's check the current state by loading the match
    const bundle = await api.getMatch(matchId);
    console.log('Match state status:', bundle.state.status);
    console.log('Match state innings:', JSON.stringify(bundle.state.innings, null, 2));

    // Build the match - just post BALL events sequentially
    // Engine handles innings transitions automatically
    // 2 overs per innings = 12 balls per innings = 24 total balls
    // 3 players per team, rotate bowlers each over
    // Track striker/non-striker for each innings

    let strikerIdx = 0;
    let nonStrikerIdx = 1;
    let matchCompleted = false;

    // Innings 1: Team A bats, Team B bowls
    // 2 overs = 12 balls
    for (let over = 1; over <= 2 && !matchCompleted; over++) {
      // Different bowler each over (from team B)
      const bowlerId = teamBPlayers[(over - 1) % teamBPlayers.length];

      for (let ball = 1; ball <= 6 && !matchCompleted; ball++) {
        const strikerId = teamAPlayers[strikerIdx];
        const nonStrikerId = teamAPlayers[nonStrikerIdx];

        // Score some runs - rotate strike on odd runs
        const runs = ball === 6 ? 4 : (ball % 2 === 0 ? 1 : 0);

        const result = await post({
          type: 'BALL',
          over: over,
          ball: ball,
          batterId: strikerId,
          nonStrikerId: nonStrikerId,
          bowlerId: bowlerId,
          runs: runs,
          extras: 'NONE',
          wicket: false,
          dismissal: null,
          dismissedPlayerId: null,
          fieldingCaptainId: bowlerId,
        });

        // Check if match completed
        if (result.live?.status === 'COMPLETED' || result.live?.status === 'TIED') {
          matchCompleted = true;
          console.log('Match completed after ball:', over, '.', ball);
          break;
        }

        // Rotate strike on odd runs
        if (runs % 2 === 1) {
          [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        }

        // Small delay to avoid overwhelming
        await new Promise(r => setTimeout(r, 100));
      }
      // End of over - swap strike
      if (!matchCompleted) {
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      }
    }

    // If match not completed after innings 1, wait for innings break and continue with innings 2
    if (!matchCompleted) {
      // Wait a bit for the engine to process innings transition
      await new Promise(r => setTimeout(r, 500));

      // Innings 2: Team B bats, Team A bowls
      // Reset strike for new innings
      strikerIdx = 0;
      nonStrikerIdx = 1;

      // 2 overs = 12 balls
      for (let over = 1; over <= 2 && !matchCompleted; over++) {
        // Different bowler each over (from team A)
        const bowlerId = teamAPlayers[(over - 1) % teamAPlayers.length];

        for (let ball = 1; ball <= 6 && !matchCompleted; ball++) {
          const strikerId = teamBPlayers[strikerIdx];
          const nonStrikerId = teamBPlayers[nonStrikerIdx];

          // Score runs to chase - Team B should win
          const runs = ball === 6 ? 6 : (ball % 2 === 0 ? 2 : 1);

          const result = await post({
            type: 'BALL',
            over: over,
            ball: ball,
            batterId: strikerId,
            nonStrikerId: nonStrikerId,
            bowlerId: bowlerId,
            runs: runs,
            extras: 'NONE',
            wicket: false,
            dismissal: null,
            dismissedPlayerId: null,
            fieldingCaptainId: bowlerId,
          });

          // Check if match completed
          if (result.live?.status === 'COMPLETED' || result.live?.status === 'TIED') {
            matchCompleted = true;
            console.log('Match completed after ball:', over, '.', ball);
            break;
          }

          // Rotate strike on odd runs
          if (runs % 2 === 1) {
            [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
          }

          await new Promise(r => setTimeout(r, 100));
        }
        // End of over - swap strike
        if (!matchCompleted) {
          [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        }
      }
    }

    console.log('Match completed successfully!');
  }, { matchId });

  // Wait for events to process and real-time to update
  await page.waitForTimeout(5000);

  console.log('\n=== Step 4: Go to report tab for completed match ===');
  // Check current URL first
  const currentUrl = page.url();
  console.log('Current URL before goto:', currentUrl);
  const reportUrl = `http://localhost:5173/#/match/${matchId}/report`;
  if (!currentUrl.includes('/report')) {
    await page.goto(reportUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  } else {
    console.log('Already on report tab, waiting for content...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  const reportText = await page.textContent('body');
  console.log('Report page content:', reportText?.substring(0, 2000));

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

  await page.waitForTimeout(5000);
  await browser.close();
}

testCompletedMatchFlow().catch(console.error);