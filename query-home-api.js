import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function queryHomeAPI() {
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
  console.log('User ID:', authData.user?.id)

  // Get session for API calls
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  // Call the listMatches API equivalent - just query matches table
  const { data, error } = await supabase
    .from('matches')
    .select('id, config, events, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Query error:', error)
    return
  }

  console.log(`\nFound ${data.length} matches for home screen:`)
  for (const match of data) {
    const config = match.config
    const events = match.events || []
    console.log(`\n---`)
    console.log(`ID: ${match.id}`)
    console.log(`Teams: ${config.teamAId} vs ${config.teamBId}`)
    console.log(`Owner: ${config.ownerId || 'none'}`)
    console.log(`Events: ${events.length}`)
    console.log(`Status: ${config.status || 'unknown'}`)
    console.log(`Updated: ${match.updated_at}`)

    // Determine match status like the summarize function would
    if (events.length > 1) {
      // Has balls bowled
      const ballEvents = events.filter(e => e.type === 'BALL')
      console.log(`  Ball events: ${ballEvents.length}`)
      if (ballEvents.length > 0) {
        const lastBall = ballEvents[ballEvents.length - 1]
        console.log(`  Last ball: over ${lastBall.over}.${lastBall.ball}, runs: ${lastBall.runs}, wicket: ${lastBall.wicket}`)
      }
    }
  }
}

queryHomeAPI().catch(console.error)