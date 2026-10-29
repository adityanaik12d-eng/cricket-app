import { chromium } from 'playwright';

async function simulateMatch() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Opening http://localhost:5173...');
  await page.goto('http://localhost:5173');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check if we need to sign in
  const emailInput = page.locator('input[type="email"]').first();
  const signInButton = page.locator('text=Sign in, text=Sign In, button:has-text("Sign")').first();

  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Signing in...');
    await emailInput.fill('adityanaik.12d@gmail.com');
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('12345678');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  } else if (await signInButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Clicking sign in button...');
    await signInButton.click();
    await page.waitForTimeout(1000);
    const emailInput2 = page.locator('input[type="email"]').first();
    await emailInput2.fill('adityanaik.12d@gmail.com');
    const passwordInput2 = page.locator('input[type="password"]').first();
    await passwordInput2.fill('12345678');
    const submitBtn2 = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first();
    await submitBtn2.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  console.log('Looking for "New match" button...');
  const newMatchBtn = page.locator('button:has-text("New match"), button:has-text("New Match"), button:has-text("Create")').first();
  await newMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newMatchBtn.click();
  await page.waitForTimeout(1500);

  // Fill match setup form - EXPLICITLY fill team names
  console.log('Setting up match...');
  const teamAInput = page.locator('input[placeholder="India"]').first();
  const teamBInput = page.locator('input[placeholder="Australia"]').first();

  // Check current values
  const teamAValue = await teamAInput.inputValue();
  const teamBValue = await teamBInput.inputValue();
  console.log('Team A value before fill:', teamAValue);
  console.log('Team B value before fill:', teamBValue);

  await teamAInput.fill('India');
  await teamBInput.fill('Australia');

  const teamAValue2 = await teamAInput.inputValue();
  const teamBValue2 = await teamBInput.inputValue();
  console.log('Team A value after fill:', teamAValue2);
  console.log('Team B value after fill:', teamBValue2);

  // Set overs
  const oversInput = page.locator('input[type="number"]').first();
  if (await oversInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await oversInput.fill('20');
  }

  // Manually add 11 players to Team A
  console.log('Adding 11 players to Team A...');
  const nameAInput = page.locator('input[placeholder="Player name"]').first();
  const addAButton = page.locator('button:has-text("Add")').first();

  for (let i = 1; i <= 11; i++) {
    await nameAInput.fill(`Player A${i}`);
    await addAButton.click();
    await page.waitForTimeout(200);
  }

  // Manually add 11 players to Team B
  console.log('Adding 11 players to Team B...');
  const nameBInput = page.locator('input[placeholder="Player name"]').nth(1);
  const addBButton = page.locator('button:has-text("Add")').nth(1);

  for (let i = 1; i <= 11; i++) {
    await nameBInput.fill(`Player B${i}`);
    await addBButton.click();
    await page.waitForTimeout(200);
  }

  // Check chip counts
  const chips = page.locator('.chip');
  console.log('Chip count after manual add:', await chips.count());

  // Check form validity
  const form = page.locator('form').first();
  console.log('Form found:', await form.count());

  const createBtn = page.locator('button:has-text("Create match")').first();
  console.log('Clicking create match button...');
  await createBtn.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  console.log('After create, URL:', page.url());

  // Check for error messages
  const pageContent = await page.textContent('body');
  console.log('Page contains "Toss":', pageContent?.includes('Toss'));
  console.log('Page contains "Bat":', pageContent?.includes('Bat'));
  console.log('Page contains "Bowl":', pageContent?.includes('Bowl'));
  console.log('Page contains "Create match":', pageContent?.includes('Create match'));

  // Check for any error text
  const errorElements = await page.locator('.error, [class*="error" i]').all();
  for (const el of errorElements) {
    console.log('Error element:', await el.textContent());
  }

  // Check if there's a validation message
  const validationMessage = await page.locator(':invalid').first().evaluate(el => el.validationMessage).catch(() => null);
  if (validationMessage) {
    console.log('HTML5 validation message:', validationMessage);
  }

  // If on toss screen, record toss
  if (pageContent?.includes('Toss')) {
    const batBtn = page.locator('button:has-text("Bat")').first();
    if (await batBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Recording toss: India bats...');
      await batBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
  }

  // Keep browser open for viewing
  console.log('Keeping browser open for 60 seconds for you to inspect...');
  await page.waitForTimeout(60000);
  await browser.close();
}

simulateMatch().catch(console.error);