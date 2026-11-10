import { getSupabase } from './supabase'
import { ApiRequestError } from './api'

export interface AdminUserRow {
  id: string
  email: string
  name: string
  mobile: string
  role: string
  batting_hand: string
  bowling_style: string
  location: string
  created_at: string
  last_sign_in_at: string | null
}

export interface AdminProfilePatch {
  userId: string
  name?: string | null
  mobile?: string | null
  role?: string | null
  batting_hand?: string | null
  bowling_style?: string | null
  location?: string | null
  email?: string | null
}

export interface AdminCreateUserPayload {
  email: string
  password?: string
  profile?: {
    name?: string | null
    mobile?: string | null
    role?: string | null
    batting_hand?: string | null
    bowling_style?: string | null
    location?: string | null
  }
}

export interface AdminAuditEntry {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  target_user_id: string | null
  target_email: string | null
  details: Record<string, unknown>
  created_at: string
}

export interface AdminListResult {
  users: AdminUserRow[]
  page: number
  limit: number
}

export interface AdminDeleteResult {
  deleted?: boolean
  blocked?: boolean
  requiresConfirm?: boolean
  code?: string
  message?: string
  blocking?: { matches?: Array<{ id: string; ownerId?: string }> }
}

export class AdminApiError extends Error {
  readonly code: string
  readonly status?: number
  constructor(message: string, code = 'ADMIN_ERROR', status?: number) {
    super(message)
    this.name = 'AdminApiError'
    this.code = code
    if (status !== undefined) this.status = status
  }
}

function normalizeError(error: unknown, data: any): AdminApiError {
  const message =
    (data?.error?.message as string | undefined) ||
    (error as any)?.message ||
    'Admin request failed'
  const code = (data?.error?.code as string | undefined) || 'ADMIN_ERROR'
  const status = (error as any)?.context?.status as number | undefined
  if (status === undefined) return new AdminApiError(message, code)
  return new AdminApiError(message, code, status)
}

async function invoke<T>(name: string, init?: { body?: unknown; method?: string; query?: Record<string, string> }): Promise<T> {
  let fn = name
  if (init?.query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null) params.set(k, String(v))
    }
    const qs = params.toString()
    if (qs) fn += '?' + qs
  }
  const { data, error } = await getSupabase().functions.invoke(fn, {
    body: init?.body as any,
    method: init?.method as any,
  })
  if (error) throw normalizeError(error, data)
  if (data?.error) throw normalizeError(null, data)
  return data as T
}

export const adminApi = {
  async listUsers(q?: string, page = 1, limit = 50): Promise<AdminListResult> {
    return invoke<AdminListResult>('admin-list-users', { query: { q: q ?? '', page: String(page), limit: String(limit) } })
  },
  async createUser(payload: AdminCreateUserPayload): Promise<{ user: { id: string; email: string } }> {
    return invoke('admin-create-user', { body: payload, method: 'POST' })
  },
  async resetPassword(email: string): Promise<{ ok: boolean }> {
    return invoke('admin-reset-password', { body: { email }, method: 'POST' })
  },
  async updateProfile(payload: AdminProfilePatch): Promise<{ profile: Record<string, unknown> }> {
    return invoke('admin-update-profile', { body: payload, method: 'POST' })
  },
  async deleteUser(userId: string, confirm = false): Promise<AdminDeleteResult> {
    return invoke<AdminDeleteResult>('admin-delete-user', { body: { userId, confirm }, method: 'POST' })
  },
  async auditLog(limit = 100): Promise<{ entries: AdminAuditEntry[] }> {
    return invoke<{ entries: AdminAuditEntry[] }>('admin-audit-log', { query: { limit: String(limit) } })
  },
}
