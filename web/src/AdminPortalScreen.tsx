import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminUserRow, type AdminAuditEntry, type AdminDeleteResult } from './adminApi'
import { ApiRequestError } from './api'
import { ThemeToggle } from './ui/ThemeToggle'

interface AdminPortalScreenProps {
  onBack?: () => void
}

type Tab = 'users' | 'create' | 'audit'

export function AdminPortalScreen({ onBack }: AdminPortalScreenProps) {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminUserRow | null>(null)
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([])

  const loadUsers = useCallback(async (q?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.listUsers(q ?? search, 1, 100)
      setUsers(res.users ?? [])
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [search])

  const loadAudit = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.auditLog(100)
      setAuditEntries(res.entries ?? [])
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'users') void loadUsers()
    if (tab === 'audit') void loadAudit()
  }, [tab, loadUsers, loadAudit])

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Admin Portal</h1>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => { if (onBack) onBack(); else window.location.hash = '#/' }}>Back</button>
          <ThemeToggle />
        </div>
      </header>
      <main className="card setup-card" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="ms-stepper" style={{ marginBottom: 16 }}>
          <button type="button" className={`ms-step ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            <span className="ms-step-num">1</span><span>Users</span>
          </button>
          <button type="button" className={`ms-step ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
            <span className="ms-step-num">2</span><span>Create</span>
          </button>
          <button type="button" className={`ms-step ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
            <span className="ms-step-num">3</span><span>Audit</span>
          </button>
        </div>

        {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

        {tab === 'users' && (
          <UsersTab
            users={users}
            loading={loading}
            search={search}
            onSearch={(v) => { setSearch(v); void loadUsers(v) }}
            selected={selected}
            onSelect={setSelected}
            onRefresh={() => void loadUsers(search)}
          />
        )}
        {tab === 'create' && <CreateUserTab onCreated={() => { setTab('users'); void loadUsers() }} />}
        {tab === 'audit' && <AuditTab entries={auditEntries} loading={loading} />}
      </main>
    </div>
  )
}

function UsersTab({
  users, loading, search, onSearch, selected, onSelect, onRefresh,
}: {
  users: AdminUserRow[]
  loading: boolean
  search: string
  onSearch: (v: string) => void
  selected: AdminUserRow | null
  onSelect: (u: AdminUserRow | null) => void
  onRefresh: () => void
}) {
  return (
    <div>
      <div className="field-row" style={{ alignItems: 'center' }}>
        <label style={{ flex: 1 }}>
          Search
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="name, email, mobile..." />
        </label>
        <button className="btn ghost" type="button" onClick={onRefresh} disabled={loading}>Refresh</button>
      </div>
      {loading && <p className="muted">Loading users...</p>}
      {!loading && users.length === 0 && <p className="muted">No users found.</p>}
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table className="points-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Mobile</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(u)}>
                <td>{u.email}</td>
                <td>{u.name || '-'}</td>
                <td>{u.role || '-'}</td>
                <td>{u.mobile || '-'}</td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                <td>
                  <button className="btn ghost" type="button" onClick={(e) => { e.stopPropagation(); onSelect(u) }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <UserDetailPanel user={selected} onClose={() => onSelect(null)} onSaved={() => { onSelect(null); onRefresh() }} />
      )}
    </div>
  )
}

function UserDetailPanel({ user, onClose, onSaved }: { user: AdminUserRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name)
  const [mobile, setMobile] = useState(user.mobile)
  const [role, setRole] = useState(user.role)
  const [battingHand, setBattingHand] = useState(user.batting_hand)
  const [bowlingStyle, setBowlingStyle] = useState(user.bowling_style)
  const [location, setLocation] = useState(user.location)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState<AdminDeleteResult | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      await adminApi.updateProfile({ userId: user.id, name, mobile, role, batting_hand: battingHand, bowling_style: bowlingStyle, location, email: user.email })
      setMsg('Profile updated.')
      onSaved()
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function resetPw() {
    setResetting(true)
    setErr(null)
    setMsg(null)
    try {
      await adminApi.resetPassword(user.email)
      setMsg('Password reset email sent.')
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : (e as Error).message)
    } finally {
      setResetting(false)
    }
  }

  async function doDelete() {
    setDeleting(true)
    setErr(null)
    setMsg(null)
    setDeleteBlocked(null)
    try {
      const res = await adminApi.deleteUser(user.id, deleteConfirm)
      if (res.blocked) {
        setDeleteBlocked(res)
        return
      }
      if (res.requiresConfirm && !deleteConfirm) {
        setDeleteConfirm(true)
        return
      }
      if (res.deleted) {
        setMsg('User deleted.')
        onSaved()
      }
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : (e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Edit: {user.email}</h3>
        <button className="btn ghost" type="button" onClick={onClose}>Close</button>
      </div>
      {err && <p className="error">{err}</p>}
      {msg && <p className="muted" style={{ color: 'var(--ms-accent, #0B3D2E)' }}>{msg}</p>}
      <div className="field-row">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Mobile<input value={mobile} onChange={(e) => setMobile(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label>Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">-</option>
            <option value="BATSMAN">Batsman</option>
            <option value="BOWLER">Bowler</option>
            <option value="KEEPER">Keeper</option>
            <option value="ALL_ROUNDER">All Rounder</option>
          </select>
        </label>
        <label>Batting hand
          <select value={battingHand} onChange={(e) => setBattingHand(e.target.value)}>
            <option value="">-</option>
            <option value="RHB">Right</option>
            <option value="LHB">Left</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label>Bowling style<input value={bowlingStyle} onChange={(e) => setBowlingStyle(e.target.value)} placeholder="e.g. Fast, Spin" /></label>
        <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
      </div>
      <div className="btn-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
        <button className="btn accent" type="button" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
        <button className="btn" type="button" onClick={() => void resetPw()} disabled={resetting}>
          {resetting ? 'Sending...' : 'Reset password'}
        </button>
        <button className="btn danger" type="button" onClick={() => { setDeleteConfirm(false); setDeleteBlocked(null); void doDelete() }} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete user'}
        </button>
      </div>
      {deleteBlocked && (
        <div className="card" style={{ marginTop: 12, background: 'var(--ms-surface)' }}>
          <p className="error" style={{ margin: 0 }}>Deletion blocked: user owns app data.</p>
          {deleteBlocked.blocking?.matches && deleteBlocked.blocking.matches.length > 0 && (
            <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              Blocking matches: {deleteBlocked.blocking.matches.map((m) => m.id).join(', ')}
            </p>
          )}
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>Reassign or remove ownership before deleting.</p>
        </div>
      )}
      {deleteConfirm && !deleteBlocked && (
        <div className="card" style={{ marginTop: 12, background: 'var(--ms-surface)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Confirm deletion of {user.email}?</p>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>This permanently removes the auth account and profile. Type confirm below is not required; click confirm to proceed.</p>
          <div className="btn-row" style={{ marginTop: 8, gap: 8 }}>
            <button className="btn danger" type="button" onClick={() => { setDeleteConfirm(false); void doDelete() }} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Confirm delete'}
            </button>
            <button className="btn ghost" type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateUserTab({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const pwd = password.trim()
      const res = await adminApi.createUser({
        email: email.trim(),
        ...(pwd ? { password: pwd } : {}),
        profile: { name: name.trim() || null, mobile: mobile.trim() || null, role: role || null },
      })
      setMsg(`Created user ${res.user?.email ?? email}`)
      setEmail('')
      setPassword('')
      setName('')
      setMobile('')
      setRole('')
      onCreated()
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="ms-reveal" style={{ maxWidth: 560 }}>
      <p className="muted" style={{ marginTop: 0 }}>Create a new auth account. If password is empty, an invite email is sent.</p>
      {err && <p className="error">{err}</p>}
      {msg && <p className="muted" style={{ color: 'var(--ms-accent, #0B3D2E)' }}>{msg}</p>}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password (optional)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave empty to invite" /></label>
      <div className="field-row">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Mobile<input value={mobile} onChange={(e) => setMobile(e.target.value)} /></label>
      </div>
      <label>Role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">-</option>
          <option value="BATSMAN">Batsman</option>
          <option value="BOWLER">Bowler</option>
          <option value="KEEPER">Keeper</option>
          <option value="ALL_ROUNDER">All Rounder</option>
        </select>
      </label>
      <button className="btn accent wide" type="submit" disabled={busy} style={{ marginTop: 12 }}>
        {busy ? 'Creating...' : 'Create user'}
      </button>
    </form>
  )
}

function AuditTab({ entries, loading }: { entries: AdminAuditEntry[]; loading: boolean }) {
  return (
    <div>
      {loading && <p className="muted">Loading audit log...</p>}
      {!loading && entries.length === 0 && <p className="muted">No audit entries.</p>}
      <div style={{ overflowX: 'auto' }}>
        <table className="points-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleString()}</td>
                <td>{e.action}</td>
                <td>{e.actor_email ?? e.actor_id ?? '-'}</td>
                <td>{e.target_email ?? e.target_user_id ?? '-'}</td>
                <td style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxWidth: 240 }}>{JSON.stringify(e.details ?? {})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
