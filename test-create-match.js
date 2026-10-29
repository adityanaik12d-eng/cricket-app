import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})

async function testCreateMatch() {
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

  // Now test getUser()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  console.log('\ngetUser() result:')
  console.log('Error:', userError)
  console.log('User:', userData.user ? { id: userData.user.id, email: userData.user.email } : null)

  // Try to create a match directly via the same logic as api.createMatch
  const matchId = crypto.randomUUID()
  const config = {
    matchId,
    teamAId: 'india',
    teamBId: 'australia',
    lineups: { A: ['p1', 'p2'], B: ['p3', 'p4'] },
    playerRefs: {},
    oversPerInnings: 20,
    powerplayOvers: 6,
    ballsPerOver: 6,
    maxWickets: 10,
    wideExtra: 1,
    noBallExtra: 1,
    inningsCount: 2,
    minutesPerOver: 4,
    maxOversPerBowler: 4,
  }

  const ownerId = userData.user?.id ?? null
  console.log('\nOwner ID to set:', ownerId)

  const configWithOwner = ownerId ? { ...config, ownerId } : config
  console.log('Config with owner:', JSON.stringify(configWithOwner, null, 2))

  // Insert into matches
  const { data, error } = await supabase
    .from('matches')
    .insert({ id: matchId, config: configWithOwner, events: [] })
    .select()
    .single()

  if (error) {
    console.error('Insert error:', error)
    return
  }

  console.log('\nMatch created:', data.id)
  console.log('Config saved:', JSON.stringify(data.config, null, 2))
}

testCreateMatch().catch(console.error)