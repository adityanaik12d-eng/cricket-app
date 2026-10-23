import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

/**
 * The browser Supabase client. Uses the public (anon/publishable) key; the
 * database rules in supabase/schema.sql protect the data. Sessions are
 * persisted so a signed-in scorer stays signed in across reloads.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see web/.env.example).',
    )
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}