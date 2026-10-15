// Diagnose Supabase Realtime postgres_changes delivery.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'https://tejjcfokgrbbkeueiuwy.supabase.co'
const KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlampjZm9rZ3JiYmtldWVpdXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzUzMzcsImV4cCI6MjEwNzU1MTMzN30.lu_INXdYADaAsxacRz2MFgF37DthG9PoR0R1QZEJfhs'

const client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
client.realtime.setAuth(KEY)

const { data, error } = await client.from('matches').select('id').limit(1)
if (error || !data?.length) throw new Error('no rows: ' + (error?.message ?? 'empty'))
const id = data[0].id
console.log('probe row =', id)

const ch = client.channel('probe-' + id)
ch.on(
  'postgres_changes',
  { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
  (p: any) => console.log('EVENT', p.eventType, JSON.stringify(p).slice(0, 160)),
)

const status = await new Promise<string>((resolve) => {
  ch.subscribe((s: string, err?: Error) => {
    console.log('STATUS', s, err ? String(err) : '')
    if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') resolve(s)
  })
  setTimeout(() => resolve('NO_STATUS'), 12000)
})
console.log('final status =', status)

await new Promise((r) => setTimeout(r, 3000))
console.log('-> triggering update')
const up = await client.from('matches').update({ updated_at: new Date().toISOString() }).eq('id', id)
console.log('update error =', up.error?.message ?? 'none')

await new Promise((r) => setTimeout(r, 15000))
await client.removeChannel(ch)
console.log('done')
process.exit(0)
