import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function queryAllMatches() {
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

  // Query all matches
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Query error:', error)
    return
  }

  console.log(`\nFound ${data.length} total matches:`)
  for (const match of data) {
    console.log(`\n---`)
    console.log(`ID: ${match.id}`)
    console.log(`Config: ${JSON.stringify(match.config)}`)
    console.log(`Events: ${JSON.stringify(match.events)}`)
    console.log(`Created: ${match.created_at}`)
    console.log(`Updated: ${match.updated_at}`)
  }
}

queryAllMatches().catch(console.error)