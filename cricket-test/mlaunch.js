const { execSync } = require('child_process');
try {
  const r = execSync('npx playwright --version', { encoding: 'utf8', stdio: 'pipe' });
  console.log('playwright ok:', r.trim());
} catch (e) { console.error('err', e.message); }
