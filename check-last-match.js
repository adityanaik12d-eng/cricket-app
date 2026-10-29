import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkLastMatch() {
  // Sign in first
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'adityanaik.12d@gmail.com',
    password: '12345678'
  })

  if (authError) {
    console.error('Auth error:', authError)
    return
  }

  console.log('Signed in as:', authData.user?.email)

  // Get the last match
  const { data, error } = await supabase
    .from('matches')
    .select('id, config, events, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Query error:', error)
    return
  }

  const match = data[0]
  const config = match.config
  const events = match.events || []

  console.log('\n=== LAST MATCH ===')
  console.log('ID:', match.id)
  console.log('Teams:', config.teamAId, 'vs', config.teamBId)
  console.log('Owner:', config.ownerId || 'none')
  console.log('Total events:', events.length)
  console.log('Status:', config.status || 'unknown')
  console.log('Updated:', match.updated_at)

  const ballEvents = events.filter(e => e.type === 'BALL')
  console.log('Ball events:', ballEvents.length)

  if (ballEvents.length > 0) {
    const lastBall = ballEvents[ballEvents.length - 1]
    console.log('Last ball: over', lastBall.over + '.' + lastBall.ball, 'runs:', lastBall.runs, 'wicket:', lastBall.wicket)

    // Count wickets
    const wickets = ballEvents.filter(e => e.wicket).length
    console.log('Total wickets:', wickets)

    // Count runs
    const totalRuns = ballEvents.reduce((sum, e) => sum + (e.runs || 0), 0)
    console.log('Total runs:', totalRuns)

    // Show overs
    const overs = Math.floor(ballEvents.length / 6) + '.' + (ballEvents.length % 6)
    console.log('Overs bowled:', overs)
  }
}

checkLastMatch().catch(console.error)