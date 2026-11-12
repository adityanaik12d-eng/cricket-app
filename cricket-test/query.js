const http = require('http');

const MID = 'f2b370e2-63c2-4b5b-82ee-704892d14db5';

http.get({ hostname: 'localhost', port: 3123, path: '/matches/' + MID, headers: { Accept: 'application/json' } }, (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      const inn = j.state.innings[j.state.innings.length - 1];
      console.log('status:', j.state.status);
      console.log('runs:', inn.runs, 'wickets:', inn.wickets, 'overs:', inn.legalBalls);
      console.log('scorecard.innings:', j.scorecard.innings.length);
      for (const i of j.scorecard.innings) {
        console.log('  team:', i.battingTeamId, 'runs:', i.runs, 'wickets:', i.wickets, 'overs:', i.oversText, 'batting:', i.batting.length, 'bowling:', i.bowling.length);
      }
    } catch (e) {
      console.error('parse error:', e.message);
      console.error(data.slice(0, 500));
    }
  });
}).on('error', (e) => console.error('request error:', e.message));
