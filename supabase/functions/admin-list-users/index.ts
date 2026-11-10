import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { service } = gate
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50') || 50))
  const { data: { users }, error } = await service.auth.admin.listUsers({ page, perPage: limit })
  if (error) return err(error.message, 500, 'SUPABASE_ERROR')
  const ids = (users ?? []).map((u: any) => u.id)
  const { data: profiles } = ids.length
    ? await service.from('profiles').select('*').in('id', ids)
    : { data: [] as any[] }
  const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
  let rows = (users ?? []).map((u: any) => {
    const p: any = pmap.get(u.id) ?? {}
    return {
      id: u.id,
      email: u.email ?? p.email ?? '',
      name: p.name ?? u.user_metadata?.name ?? '',
      mobile: p.mobile ?? u.user_metadata?.mobile ?? u.phone ?? '',
      role: p.role ?? u.user_metadata?.role ?? '',
      batting_hand: p.batting_hand ?? '',
      bowling_style: p.bowling_style ?? '',
      location: p.location ?? '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }
  })
  if (q) {
    rows = rows.filter((r) => [r.email, r.name, r.mobile].join(' ').toLowerCase().includes(q))
  }
  return json({ users: rows, page, limit })
})
