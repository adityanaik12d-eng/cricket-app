// Start the web dev server, proxying /matches and /auth to the local backend.
process.chdir('/c/Users/IT/cricket-app/web');
const { spawn } = require('child_process');

const vite = spawn('npx', ['vite', '--port', '8133', '--host', '127.0.0.1'], {
  stdio: 'pipe',
  env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
});

let out = '';
vite.stdout.on('data', (d) => { out += d; });
vite.stderr.on('data', (d) => { out += d; });

vite.on('close', (code) => { console.error('vite exited with code', code); });
vite.on('error', (e) => { console.error('vite error:', e.message); });

setTimeout(() => {
  console.log('--- vite output ---');
  console.log(out);
  console.log('\n=== web vite dev server started on http://127.0.0.1:8133 ===');
  console.log('Now running the browser test...');
}, 2500);
