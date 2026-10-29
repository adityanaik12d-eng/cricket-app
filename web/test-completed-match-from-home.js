import { chromium } from 'playwright';

async function testCompletedMatchFromHome() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('=== Step 1: Load home page ===');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // First, let's create a completed match to test with
  console.log('\n=== Step 2: Create and complete a match ===');
  const newMatchBtn = page.locator('button:has-text("+ New match"), button:has-text("New match"), button:has-text("Create")').first();
  await newMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newMatchBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForURL('**/#/new', { timeout: 15000 });
  await page.waitForTimeout(1000);

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

  const quickFillA = page.locator('button:has-text("Quick fill")').first();
  await quickFillA.click();
  await page.waitForTimeout(1000);
  const quickFillB = page.locator('button:has-text("Quick fill")').nth(1);
  await quickFillB.click();
  await page.waitForTimeout(1000);

  const createBtn = page.locator('button:has-text("Create match")');
  await createBtn.waitFor({ state: 'visible', timeout: 5000 });
  await createBtn.click();

  const batBtn = page.locator('button:has-text("Bat")').first();
  await batBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Toss screen appeared');
  await page.waitForTimeout(1000);
  await batBtn.click();
  console.log('Clicked Bat for toss');

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

  // Complete the match using app internal API
  await page.evaluate(async ({ matchId }) => {
    const { getSupabase } = await import('/src/supabase.ts');
    const { api } = await import('/src/api.ts');

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

    const teamAPlayers = config.lineups?.A || [];
    const teamBPlayers = config.lineups?.B || [];

    console.log('Team A players:', teamAPlayers);
    console.log('Team B players:', teamBPlayers);

    const post = async (event) => {
      console.log('Posting event:', JSON.stringify(event));
      const result = await api.postEvent(matchId, event);
      console.log('Posted event:', event.type, 'seq:', result.seq, 'status:', result.live?.status);
      return result;
    };

    let strikerIdx = 0;
    let nonStrikerIdx = 1;
    let matchCompleted = false;

    // Innings 1: Team A bats, Team B bowls
    for (let over = 1; over <= 2 && !matchCompleted; over++) {
      const bowlerId = teamBPlayers[(over - 1) % teamBPlayers.length];

      for (let ball = 1; ball <= 6 && !matchCompleted; ball++) {
        const strikerId = teamAPlayers[strikerIdx];
        const nonStrikerId = teamAPlayers[nonStrikerIdx];
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

        if (result.live?.status === 'COMPLETED' || result.live?.status === 'TIED') {
          matchCompleted = true;
          console.log('Match completed after ball:', over, '.', ball);
          break;
        }

        if (runs % 2 === 1) {
          [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        }

        await new Promise(r => setTimeout(r, 100));
      }
      if (!matchCompleted) {
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      }
    }

    if (!matchCompleted) {
      await new Promise(r => setTimeout(r, 500));
      strikerIdx = 0;
      nonStrikerIdx = 1;

      for (let over = 1; over <= 2 && !matchCompleted; over++) {
        const bowlerId = teamAPlayers[(over - 1) % teamAPlayers.length];

        for (let ball = 1; ball <= 6 && !matchCompleted; ball++) {
          const strikerId = teamBPlayers[strikerIdx];
          const nonStrikerId = teamBPlayers[nonStrikerIdx];
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

          if (result.live?.status === 'COMPLETED' || result.live?.status === 'TIED') {
            matchCompleted = true;
            console.log('Match completed after ball:', over, '.', ball);
            break;
          }

          if (runs % 2 === 1) {
            [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
          }

          await new Promise(r => setTimeout(r, 100));
        }
        if (!matchCompleted) {
          [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        }
      }
    }

    console.log('Match completed successfully!');
  }, { matchId });

  await page.waitForTimeout(5000);

  // Go back to home page
  console.log('\n=== Step 3: Go back to home page ===');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  let homeText = await page.textContent('body');
  console.log('Home page content:', homeText?.substring(0, 500));

  // Click on the completed match from home
  console.log('\n=== Step 4: Click on completed match from home ===');
  const matchCard = page.locator('.match-card').filter({ hasText: 'completed' }).first();
  if (await matchCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Found match card, clicking...');
    await matchCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const matchPageUrl = page.url();
    console.log('Match page URL:', matchPageUrl);

    const matchPageText = await page.textContent('body');
    console.log('Match page content:', matchPageText?.substring(0, 2000));

    if (matchPageText?.includes('Match Result') || matchPageText?.includes('won by') || matchPageText?.includes('COMPLETED') || matchPageText?.includes('Test Team B won')) {
      console.log('*** MATCH RESULT SCREEN DISPLAYED FROM HOME ***');
    } else if (matchPageText?.includes('Loading') || matchPageText?.includes('Error') || matchPageText?.trim() === '') {
      console.log('*** REPORT TAB APPEARS BLANK/BROKEN ***');
    } else {
      console.log('*** REPORT TAB SHOWS REGULAR REPORT (not completed) ***');
    }

    await page.screenshot({ path: 'completed-match-from-home.png', fullPage: true });

    // Click browser back
    console.log('\n=== Step 5: Go back home using browser back ===');
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const homeTextAfterBack = await page.textContent('body');
    console.log('Home page after back:', homeTextAfterBack?.substring(0, 500));

    await page.screenshot({ path: 'home-after-back-from-match.png', fullPage: true });

    if (homeTextAfterBack?.includes('Cricket Scorer') && (homeTextAfterBack?.includes('New match') || homeTextAfterBack?.includes('Create match'))) {
      console.log('*** HOME PAGE LOOKS OK AFTER BACK FROM MATCH ***');
    } else {
      console.log('*** HOME PAGE APPEARS BLANK/BROKEN AFTER BACK ***');
    }
  } else {
    console.log('*** MATCH CARD NOT FOUND ON HOME PAGE ***');
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

testCompletedMatchFromHome().catch(console.error);