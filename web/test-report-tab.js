import { chromium } from 'playwright';

async function testReportTab() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
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
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('12345678');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")').first();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  console.log('Creating a new match...');
  // Click "New match" button
  const newMatchBtn = page.locator('button:has-text("New match"), button:has-text("Create")').first();
  await newMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newMatchBtn.click();
  await page.waitForTimeout(1500);

  // Fill match setup form
  const teamAInput = page.locator('input[placeholder="India"]').first();
  const teamBInput = page.locator('input[placeholder="Australia"]').first();
  await teamAInput.fill('India');
  await teamBInput.fill('Australia');

  // Set overs to 5
  const oversInput = page.locator('input[type="number"]').first();
  if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await oversInput.fill('5');
  }

  // Quick fill both teams
  const quickFillA = page.locator('button:has-text("Quick fill")').first();
  await quickFillA.click();
  await page.waitForTimeout(500);
  const quickFillB = page.locator('button:has-text("Quick fill")').nth(1);
  await quickFillB.click();
  await page.waitForTimeout(500);

  // Create match
  const createBtn = page.locator('button:has-text("Create match")').first();
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

  // Wait for match start modal and select openers
  await page.waitForTimeout(2000);
  const strikerSelect = page.locator('select').first();
  if (await strikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await strikerSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  }
  const nonStrikerSelect = page.locator('select').nth(1);
  if (await nonStrikerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nonStrikerSelect.selectOption({ index: 2 });
    await page.waitForTimeout(500);
  }
  const bowlerSelect = page.locator('select').nth(2);
  if (await bowlerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await bowlerSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
  }
  const startInningsBtn = page.locator('button:has-text("Start Innings")').first();
  if (await startInningsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startInningsBtn.click();
    await page.waitForTimeout(1000);
  }

  // Wait for the match to be in progress
  await page.waitForTimeout(3000);

  // Get the match ID from the URL
  const url = page.url();
  console.log('Current URL:', url);
  const matchIdMatch = url.match(/match\/([^\/]+)/);
  let matchId = null;
  if (matchIdMatch) {
    matchId = matchIdMatch[1];
    console.log('Match ID:', matchId);
  }

  // Now navigate directly to the report tab via URL hash
  if (matchId) {
    const reportUrl = `http://localhost:5173/#/match/${matchId}/report`;
    console.log('\n========== NAVIGATING TO REPORT TAB ==========');
    console.log('Report URL:', reportUrl);

    await page.goto(reportUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check what's on the page
    const pageText = await page.textContent('body');
    console.log('\nPage content preview:', pageText?.substring(0, 500));

    // Check for specific elements
    const reportElement = page.locator('.report').first();
    const reportVisible = await reportElement.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Report element visible:', reportVisible);

    const headline = page.locator('.report-headline').first();
    const headlineText = await headline.textContent().catch(() => 'NOT FOUND');
    console.log('Headline text:', headlineText);

    const inningsSummaries = page.locator('.innings-summary');
    const inningsCount = await inningsSummaries.count();
    console.log('Innings summaries count:', inningsCount);

    // Check if there's any error or loading state
    const loadingElement = page.locator('text=Loading');
    const loadingVisible = await loadingElement.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Loading visible:', loadingVisible);

    const errorElement = page.locator('.error');
    const errorVisible = await errorElement.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Error visible:', errorVisible);

    // Check for JavaScript errors in console
    console.log('\nChecking for any visible content...');
    const bodyHtml = await page.content();
    console.log('Body contains "report":', bodyHtml.includes('report'));
    console.log('Body contains "Match in progress":', bodyHtml.includes('Match in progress'));
    console.log('Body contains "India":', bodyHtml.includes('India'));
    console.log('Body contains "innings-summary":', bodyHtml.includes('innings-summary'));
    console.log('Body contains "commentary":', bodyHtml.includes('commentary'));

    // Take a screenshot for debugging
    await page.screenshot({ path: 'report-tab-debug.png', fullPage: true });
    console.log('\nScreenshot saved as report-tab-debug.png');
  }

  // Keep browser open for viewing
  console.log('\nKeeping browser open for 60 seconds for you to inspect...');
  await page.waitForTimeout(60000);
  await browser.close();
}

testReportTab().catch(console.error);