const { chromium } = require('playwright');

async function exploreCricHeroes() {
  console.log('🚀 Launching Chromium in headed mode...');
  console.log('📝 Please log in to CricHeroes in the browser window that opens');
  console.log('⏳ I will wait 90 seconds for you to complete login...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null
  });

  const page = await context.newPage();

  // Navigate to the tournament creation page
  await page.goto('https://organiser.cricheroes.com/organiser-admin/add-new-tournament', {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  console.log('✅ Page loaded. Waiting 90 seconds for manual login...');
  console.log('   (You can now log in in the browser window)\n');

  // Wait for user to log in manually
  await page.waitForTimeout(90000);

  console.log('⏰ Login wait complete. Exploring page...');

  // Check if we're logged in by looking for common logged-in elements
  const pageContent = await page.content();
  const url = page.url();

  console.log(`Current URL: ${url}`);
  console.log(`Page title: ${await page.title()}`);

  // Take a screenshot for reference
  await page.screenshot({ path: 'cricheroes-after-login.png', fullPage: true });
  console.log('📸 Screenshot saved: cricheroes-after-login.png');

  // Try to find scoring-related links/buttons
  const scoringLinks = await page.$$eval('a, button', elements =>
    elements
      .map(el => ({ text: el.innerText.trim(), href: el.href, tag: el.tagName }))
      .filter(el => el.text && (
        el.text.toLowerCase().includes('score') ||
        el.text.toLowerCase().includes('match') ||
        el.text.toLowerCase().includes('tournament') ||
        el.text.toLowerCase().includes('create') ||
        el.text.toLowerCase().includes('new')
      ))
  );

  console.log('\n🔍 Potential scoring/match creation elements:');
  scoringLinks.forEach(link => {
    console.log(`  - [${link.tag}] "${link.text}" -> ${link.href || 'no href'}`);
  });

  // Look for navigation/menu items
  const navItems = await page.$$eval('nav a, .menu a, [role="navigation"] a, header a', elements =>
    elements.map(el => ({ text: el.innerText.trim(), href: el.href })).filter(el => el.text)
  );

  console.log('\n🧭 Navigation items:');
  navItems.forEach(item => {
    console.log(`  - "${item.text}" -> ${item.href || 'no href'}`);
  });

  // Keep browser open for manual exploration
  console.log('\n🔄 Browser staying open for 5 minutes for manual exploration...');
  console.log('   You can now navigate around CricHeroes manually');
  console.log('   Press Ctrl+C in terminal to close when done\n');

  await page.waitForTimeout(300000); // 5 minutes

  await browser.close();
  console.log('✅ Done');
}

exploreCricHeroes().catch(console.error);