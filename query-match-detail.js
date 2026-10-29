import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function queryMatchDetail() {
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

  // Query the specific match
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', '83b863c3-320d-4e37-957b-229dc40fc2e4')
    .single()

  if (error) {
    console.error('Query error:', error)
    return
  }

  console.log('\nFull match record:')
  console.log(JSON.stringify(data, null, 2))
}

queryMatchDetail().catch(console.error)