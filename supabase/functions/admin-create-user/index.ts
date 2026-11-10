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
  const password = body.password ? String(body.password) : undefined
  const profile = body.profile ?? {}
  if (!email) return err('email is required', 400, 'VALIDATION_ERROR')
  const opts: any = { email, email_confirm: true, user_metadata: { name: profile.name, mobile: profile.mobile, role: profile.role } }
  if (password) opts.password = password
  const { data, error } = password
    ? await service.auth.admin.createUser(opts)
    : await service.auth.admin.inviteUserByEmail(email, { data: opts.user_metadata })
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  const created = (data as any)?.user
  if (created?.id) {
    await service.from('profiles').upsert({
      id: created.id,
      email,
      name: profile.name ?? null,
      mobile: profile.mobile ?? null,
      role: profile.role ?? null,
      batting_hand: profile.batting_hand ?? null,
      bowling_style: profile.bowling_style ?? null,
      location: profile.location ?? null,
    })
    await audit(service, { actor_id: actor.id, actor_email: actor.email, action: 'user.create', target_user_id: created.id, target_email: email, details: { invited: !password } })
  }
  return json({ user: { id: created?.id, email } })
})
