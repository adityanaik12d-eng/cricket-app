import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin, audit } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { user: actor, service } = gate
  if (req.method !== 'PUT' && req.method !== 'POST') return err('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
  const body = await req.json().catch(() => ({}))
  const id = String(body.userId ?? body.id ?? '')
  if (!id) return err('userId is required', 400, 'VALIDATION_ERROR')
  const patch = {
    name: body.name ?? null,
    mobile: body.mobile ?? null,
    role: body.role ?? null,
    batting_hand: body.batting_hand ?? null,
    bowling_style: body.bowling_style ?? null,
    location: body.location ?? null,
    email: body.email ?? null,
  }
  const { data, error } = await service.from('profiles').upsert({ id, ...patch }).select('*').single()
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  if (body.name || body.mobile || body.role) {
    await service.auth.admin.updateUserById(id, { user_metadata: { name: body.name, mobile: body.mobile, role: body.role } })
  }
  await audit(service, { actor_id: actor.id, actor_email: actor.email, action: 'profile.update', target_user_id: id, target_email: body.email ?? null, details: { fields: Object.keys(patch) } })
  return json({ profile: data })
})
