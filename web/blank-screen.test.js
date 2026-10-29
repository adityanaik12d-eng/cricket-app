import { test, expect } from '@playwright/test';

test.describe('Blank screen tests', () => {
  test('Home page loads without blank screen', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check if the header is visible
    const header = page.locator('h1:has-text("Cricket Scorer")');
    await expect(header).toBeVisible({ timeout: 10000 });

    // Check if the main content is visible
    const main = page.locator('main.board');
    await expect(main).toBeVisible({ timeout: 5000 });

    console.log('Home page loaded successfully');
  });

  test('Match page loads without blank screen', async ({ page }) => {
    // First, create a match to test with
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Click "New match"
    await page.click('button:has-text("+ New match")');
    await page.waitForURL('**/#/new');

    // Fill match form
    await page.fill('input[placeholder="India"]', 'Test Team A');
    await page.fill('input[placeholder="Australia"]', 'Test Team B');
    await page.fill('input[type="number"]:nth-of-type(1)', '2'); // 2 overs
    await page.fill('input[type="number"]:nth-of-type(2)', '3'); // 3 players

    // Quick fill both teams
    await page.click('button:has-text("Quick fill"):nth-of-type(1)');
    await page.click('button:has-text("Quick fill"):nth-of-type(2)');

    // Submit
    await page.click('button:has-text("Create match")');

    // Wait for toss screen
    await page.waitForURL('**/#/match/**');

    // Select toss
    await page.click('button:has-text("Bat"):nth-of-type(1)');

    // Wait for scoring screen
    await page.waitForURL('**/#/match/**/scoring');

    // Check if scoring screen loads
    const scoringHeader = page.locator('h1:has-text("Test Team A vs Test Team B")');
    await expect(scoringHeader).toBeVisible({ timeout: 10000 });

    // Click Report tab
    await page.click('button:has-text("Report")');

    // Check if report tab loads
    await page.waitForTimeout(1000);

    // Check for report content
    const reportContent = page.locator('.report, .card.report-headline, text="Match in progress"');
    await expect(reportContent.first()).toBeVisible({ timeout: 5000 });

    console.log('Match report tab loaded successfully');

    // Go back home
    await page.click('button:has-text("← Home")');
    await page.waitForURL('**/#/');

    // Check if home page loads again
    const homeHeader = page.locator('h1:has-text("Cricket Scorer")');
    await expect(homeHeader).toBeVisible({ timeout: 5000 });

    console.log('Home page loaded successfully after back navigation');
  });
});