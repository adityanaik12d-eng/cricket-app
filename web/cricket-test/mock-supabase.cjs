// Minimal Supabase REST API mock — returns match data in the format the Supabase
// JS client expects, so the web app can be browser-tested without a real Supabase
// project. Env: PORT (default 3001).
const http = require('http');
const PORT = process.env.PORT || 3001;

const MOCK_DB = {
  matches: [
    {
      id: 'test-1over-2player',
      config: {
        teamAId: 'India', teamBId: 'Australia',
        lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
        oversPerInnings: 1, inningsCount: 2, ballsPerOver: 6,
        maxOversPerBowler: 4, maxWickets: 10, powerplayOvers: 1,
        wideExtra: 1, noBallExtra: 1, minutesPerOver: 4,
      },
      events: [],
      updated_at: '2026-10-29T12:00:00Z',
    },
  ],
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname.replace(/^\/rest\/v1\//, '');

  if (req.method === 'GET' && pathname.startsWith('matches')) {
    const matchId = (url.searchParams.get('id') || '').replace('eq.', '');
    const match = MOCK_DB.matches.find((m) => m.id === matchId);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
      return;
    }
    const row = { id: match.id, config: match.config, events: match.events, updated_at: match.updated_at };
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Location': `https://test.supabase.co/rest/v1/matches`,
    });
    res.end(JSON.stringify([row]));
    return;
  }
  if (req.method === 'GET' && pathname === '/auth/v1/user') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: { id: 'test-user', email: null, user_metadata: {} } }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'not found' } }));
});

server.listen(PORT, () => {
  console.log('Mock Supabase server up on http://localhost:' + PORT);
});
