import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin, audit } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { user: actor, service } = gate
  if (req.method !== 'POST') return err('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim()
  if (!email) return err('email is required', 400, 'VALIDATION_ERROR')
  const { error } = await service.auth.resetPasswordForEmail(email)
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  await audit(service, { actor_id: actor.id, actor_email: actor.email, action: 'user.reset_password', target_email: email, details: {} })
  return json({ ok: true })
})
