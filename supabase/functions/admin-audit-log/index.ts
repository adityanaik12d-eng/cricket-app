import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { service } = gate
  const url = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '100') || 100))
  const { data, error } = await service.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) return err(error.message, 500, 'SUPABASE_ERROR')
  return json({ entries: data ?? [] })
})
