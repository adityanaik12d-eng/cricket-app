import { chromium } from 'playwright';

async function testLocalReportAndBack() {
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
  if (!homeText?.includes('Cricket Scorer')) {
    console.log('*** HOME PAGE BLANK ON INITIAL LOAD ***');
  } else {
    console.log('*** HOME PAGE LOOKS OK ON INITIAL LOAD ***');
  }

  console.log('\n=== Step 2: Create new match ===');
  // Click "New match" button
  const newMatchBtn = page.locator('button:has-text("+ New match"), button:has-text("New match"), button:has-text("Create")').first();
  await newMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newMatchBtn.click();
  await page.waitForTimeout(2000);

  // Check current URL
  console.log('URL after clicking New match:', page.url());

  await page.waitForURL('**/#/new', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Check what's on the page
  const newMatchPageText = await page.textContent('body');
  console.log('New match page content:', newMatchPageText?.substring(0, 1000));

  // Fill match setup form
  const teamAInput = page.locator('input[placeholder="India"]').first();
  const teamBInput = page.locator('input[placeholder="Australia"]').first();
  await teamAInput.fill('Test Team A');
  await teamBInput.fill('Test Team B');

  // Set overs to 2
  const oversInput = page.locator('input[type="number"]').first();
  if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await oversInput.fill('2');
  }

  // Set players to 3
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
  console.log('Clicked Create match, waiting for toss screen...');

  // Wait for toss screen to appear (Bat/Bowl buttons)
  try {
    const batBtn = page.locator('button:has-text("Bat")').first();
    await batBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Toss screen appeared');
  } catch (e) {
    console.log('Toss screen did not appear, current URL:', page.url());
    const errorText = await page.textContent('body');
    console.log('Page content:', errorText?.substring(0, 1000));
    await page.screenshot({ path: 'error-create-match.png', fullPage: true });
    await browser.close();
    return;
  }

  await page.waitForTimeout(1000);

  // Record toss - click Bat for Team A
  const batBtn = page.locator('button:has-text("Bat")').first();
  await batBtn.click();
  console.log('Clicked Bat for toss');

  // Now wait for URL to change to match page
  try {
    await page.waitForURL('**/#/match/**', { timeout: 20000 });
    console.log('URL changed to match page:', page.url());
  } catch (e) {
    console.log('URL did not change after toss, current URL:', page.url());
    const errorText = await page.textContent('body');
    console.log('Page content after toss:', errorText?.substring(0, 1000));
    await page.screenshot({ path: 'error-after-toss.png', fullPage: true });
    await browser.close();
    return;
  }

  await page.waitForTimeout(2000);

  // Should now be on scoring screen
  // Get match ID from URL
  const matchUrl = page.url();
  const matchIdMatch = matchUrl.match(/\/match\/([^\/]+)/);
  const matchId = matchIdMatch ? matchIdMatch[1] : null;
  console.log('Match ID:', matchId);
  console.log('Current URL:', matchUrl);

  if (!matchId) {
    console.log('*** NO MATCH ID FOUND ***');
    await browser.close();
    return;
  }

  console.log('\n=== Step 3: Go to report tab ===');
  const reportUrl = `http://localhost:5173/#/match/${matchId}/report`;
  await page.goto(reportUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const reportText = await page.textContent('body');
  console.log('Report page content:', reportText?.substring(0, 1000));

  if (reportText?.includes('Loading') || reportText?.includes('Error') || reportText?.trim() === '') {
    console.log('*** REPORT TAB APPEARS BLANK/BROKEN ***');
  } else {
    console.log('*** REPORT TAB LOOKS OK ***');
  }

  await page.screenshot({ path: 'local-report-tab.png', fullPage: true });

  console.log('\n=== Step 4: Go back home using browser back ===');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const homeTextAfterBack = await page.textContent('body');
  console.log('Home page after back:', homeTextAfterBack?.substring(0, 500));

  await page.screenshot({ path: 'local-home-after-back.png', fullPage: true });

  if (!homeTextAfterBack?.includes('Cricket Scorer') || !homeTextAfterBack?.includes('New match')) {
    console.log('*** HOME PAGE APPEARS BLANK/BROKEN AFTER BACK ***');
  } else {
    console.log('*** HOME PAGE LOOKS OK AFTER BACK ***');
  }

  console.log('\n=== Step 5: Click match card again ===');
  const matchCard = page.locator('.match-card').first();
  if (await matchCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await matchCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const matchPageText = await page.textContent('body');
    console.log('Match page after re-click:', matchPageText?.substring(0, 500));

    // Go to report tab again
    await page.goto(reportUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const reportText2 = await page.textContent('body');
    console.log('Report page after re-click:', reportText2?.substring(0, 500));
  }

  await page.waitForTimeout(10000);
  await browser.close();
}

testLocalReportAndBack().catch(console.error);