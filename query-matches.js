import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function queryMatches() {
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

  // Query matches
  const { data, error } = await supabase
    .from('matches')
    .select('id, config, events, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Query error:', error)
    return
  }

  console.log(`\nFound ${data.length} matches:`)
  for (const match of data) {
    const config = match.config
    console.log(`\nMatch: ${match.id}`)
    console.log(`  Teams: ${config.teamAId} vs ${config.teamBId}`)
    console.log(`  Owner: ${config.ownerId || 'none'}`)
    console.log(`  Events: ${Array.isArray(match.events) ? match.events.length : 0}`)
    console.log(`  Created: ${match.created_at}`)
    console.log(`  Updated: ${match.updated_at}`)
    console.log(`  Status: ${config.status || 'unknown'}`)
  }
}

queryMatches().catch(console.error)