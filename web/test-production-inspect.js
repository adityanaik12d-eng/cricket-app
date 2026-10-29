import { chromium } from 'playwright';

async function testProductionInspect() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Open production home page
  await page.goto('https://cricket-scorer-gold.vercel.app/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Get all clickable elements
  const allElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('button, a, [onclick], [role="button"], .card');
    return Array.from(elements).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent?.trim().substring(0, 100),
      href: el.getAttribute?.('href'),
      onclick: el.getAttribute?.('onclick'),
      id: el.id
    }));
  });

  console.log('Clickable elements on home page:');
  allElements.forEach((el, i) => {
    if (el.text && (el.text.includes('india') || el.text.includes('australia') || el.text.includes('LIVE'))) {
      console.log(`${i}: tag=${el.tag}, class="${el.class}", text="${el.text}", href="${el.href}", onclick="${el.onclick}"`);
    }
  });

  // Try clicking on elements that might be the match
  // Look for elements with "india vs australia" text
  for (const el of allElements) {
    if (el.text && el.text.toLowerCase().includes('india') && el.text.toLowerCase().includes('australia')) {
      console.log('\nTrying to click element:', el);
      if (el.tag === 'A' && el.href) {
        await page.goto(el.href);
      } else {
        await page.locator(`button:has-text("${el.text.substring(0, 20)}")`).first().click().catch(() => {});
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      console.log('New URL:', page.url());
      break;
    }
  }

  // If still on home page, try other approaches
  if (page.url().endsWith('/')) {
    console.log('\nStill on home page, trying other click strategies...');

    // Try clicking any button or card that contains "LIVE" or "india"
    const buttons = page.locator('button:has-text("LIVE"), button:has-text("india"), button:has-text("australia")');
    const count = await buttons.count();
    console.log(`Found ${count} buttons with LIVE/india/australia`);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent().catch(() => '');
      console.log(`Trying button ${i}: "${text}"`);
      await btn.click().catch(() => {});
      await page.waitForTimeout(2000);
      if (!page.url().endsWith('/')) {
        console.log('Navigated to:', page.url());
        break;
      }
    }
  }

  // Check final URL
  console.log('Final URL:', page.url());

  const matchIdMatch = page.url().match(/match\/([^\/]+)/);
  if (matchIdMatch) {
    const matchId = matchIdMatch[1];
    console.log('Match ID:', matchId);

    // Go to report tab
    const reportUrl = `https://cricket-scorer-gold.vercel.app/#/match/${matchId}/report`;
    await page.goto(reportUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const pageText = await page.textContent('body');
    console.log('Report page content:', pageText?.substring(0, 500));

    await page.screenshot({ path: 'production-inspect-report.png', fullPage: true });
  }

  console.log('\nKeeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testProductionInspect().catch(console.error);