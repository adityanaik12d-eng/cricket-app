import { json, err } from '../_shared/cors.ts'
import { requireCreatorAdmin, audit } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const gate = await requireCreatorAdmin(req)
  if ('preflight' in gate) return gate.preflight
  if ('response' in gate) return gate.response
  const { user: actor, service } = gate
  if (req.method !== 'POST') return err('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
  const body = await req.json().catch(() => ({}))
  const userId = String(body.userId ?? '')
  const confirm = body.confirm === true
  if (!userId) return err('userId is required', 400, 'VALIDATION_ERROR')
  if (userId === actor.id) return err('Cannot delete the current admin account', 400, 'VALIDATION_ERROR')

  const { data: ownedMatches } = await service.from('matches').select('id, config').filter('config->>ownerId', 'eq', userId)
  const blocking = {
    matches: (ownedMatches ?? []).map((m: any) => ({ id: m.id, ownerId: m.config?.ownerId ?? userId })),
  }
  if ((blocking.matches?.length ?? 0) > 0) {
    return json({ blocked: true, code: 'OWNS_DATA', message: 'User owns app data; reassign or remove ownership before deleting.', blocking }, 409)
  }
  if (!confirm) {
    return json({ requiresConfirm: true, message: 'Pass confirm:true to delete this user.' }, 409)
  }
  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) return err(error.message, 400, 'SUPABASE_ERROR')
  await service.from('profiles').delete().eq('id', userId)
  await audit(service, { actor_id: actor.id, actor_email: actor.email, action: 'user.delete', target_user_id: userId, details: {} })
  return json({ deleted: true })
})
