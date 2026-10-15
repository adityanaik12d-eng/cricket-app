import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

/**
 * The browser Supabase client. Only ever uses the public (anon/publishable)
 * key — the database rules in supabase/schema.sql are what protect the data.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see web/.env.example).',
    )
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // v1 has no signed-in user, so Realtime would otherwise carry no token and
    // silently drop postgres_changes. Hand it the public key explicitly.
    client.realtime.setAuth(anonKey)
  }
  return client
}
