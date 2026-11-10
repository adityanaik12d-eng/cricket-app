import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, err } from './cors.ts'

export const CANONICAL_ADMIN_EMAIL = 'adityanaik.12d@gmail.com'

export async function requireCreatorAdmin(req: Request): Promise<
  | { preflight: Response }
  | { response: Response }
  | { user: { id: string; email: string }; service: any }
> {
  if (req.method === 'OPTIONS') {
    return { preflight: new Response('ok', { headers: corsHeaders }) }
  }
  const auth = req.headers.get('Authorization')
  if (!auth) {
    return { response: err('Missing authorization', 401, 'UNAUTHENTICATED') }
  }
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    return { response: err('Invalid session', 401, 'UNAUTHENTICATED') }
  }
  if ((user.email ?? '').toLowerCase() !== CANONICAL_ADMIN_EMAIL.toLowerCase()) {
    return { response: err('Admin access required', 403, 'FORBIDDEN') }
  }
  const service = createClient(url, serviceKey)
  return { user: { id: user.id, email: user.email! }, service }
}

export async function audit(service: any, entry: {
  actor_id: string
  actor_email: string
  action: string
  target_user_id?: string | null
  target_email?: string | null
  details?: unknown
}) {
  await service.from('admin_audit_log').insert({ ...entry, details: entry.details ?? {} })
}
