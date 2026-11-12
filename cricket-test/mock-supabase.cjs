// Minimal Supabase REST API mock — returns match data in the format the Supabase
// JS client expects, so the web app can be browser-tested without a real Supabase project.
const http = require('http');

const DB = {
  matches: [{
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
  }],
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Supabase REST API: GET /rest/v1/<table_name>?select=...&id=eq.<match_id>&apikey=...
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/^\/rest\/v1\//, '');
  const query = url.searchParams;

  if (req.method === 'GET' && pathname.startsWith('matches')) {
    const select = query.get('select') || '*';
    const idFilter = query.get('id') || '';
    const matchId = idFilter.replace('eq.', '');
    const match = DB.matches.find((m) => m.id === matchId);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
      return;
    }
    // Rebuild the match row in Supabase format
    const row = {
      id: match.id,
      config: match.config,
      events: match.events,
      updated_at: match.updated_at,
    };
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Location': `https://${query.get('apikey') || 'test'}.supabase.co/rest/v1/matches`,
    });
    res.end(JSON.stringify([row]));
    return;
  }

  // Auth endpoint (not needed for scorecard)
  if (req.method === 'GET' && pathname === '/auth/v1/user') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: { id: 'test-user', email: null, user_metadata: {} } }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'not found' } }));
});

server.listen(3001, () => {
  console.log('Mock Supabase server up on http://localhost:3001');
});
