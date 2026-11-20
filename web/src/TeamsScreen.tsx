import { useEffect, useState } from 'react'
import { api, ApiRequestError } from './api'
import { getSupabase } from './supabase'
import type { Team, SearchPlayer } from './api'

export function TeamsScreen({ onBack }: { onBack: () => void }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newShortName, setNewShortName] = useState('')
  const [newColour, setNewColour] = useState('#3b82f6')
  const [creating, setCreating] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<Record<string, SearchPlayer[]>>({})
  const [membersLoading, setMembersLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listMyTeams()
      setTeams(data)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load teams')
    } finally {
      setLoading(false)
    }
  }

  async function createTeam() {
    if (!newName.trim() || !newShortName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await api.createTeam(newName, newShortName, newColour)
      setShowCreate(false)
      setNewName('')
      setNewShortName('')
      setNewColour('#3b82f6')
      await loadTeams()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create team')
    } finally {
      setCreating(false)
    }
  }

  async function loadMembers(teamId: string) {
    setMembersLoading(prev => ({ ...prev, [teamId]: true }))
    try {
      const { data, error } = await getSupabase()
        .from('team_members')
        .select(`
          player_id,
          role,
          added_at,
          players!inner (
            id,
            name,
            is_guest,
            masked_mobile:mobile
          )
        `)
        .eq('team_id', teamId)
      if (error) throw error
      // Transform the data
      const members = (data ?? []).map((row: any) => ({
        id: row.players.id,
        name: row.players.name,
        is_guest: row.players.is_guest,
        masked_mobile: row.players.masked_mobile,
        role: row.role,
        added_at: row.added_at,
      }))
      setTeamMembers(prev => ({ ...prev, [teamId]: members }))
    } catch (err) {
      console.error('Failed to load team members:', err)
    } finally {
      setMembersLoading(prev => ({ ...prev, [teamId]: false }))
    }
  }

  function toggleTeam(teamId: string) {
    setExpandedTeam(prev => prev === teamId ? null : teamId)
    if (expandedTeam !== teamId) {
      loadMembers(teamId)
    }
  }

  async function deleteTeam(teamId: string) {
    if (!confirm('Delete this team and all its members?')) return
    setError(null)
    try {
      const { error } = await api.getSupabase()
        .from('teams')
        .delete()
        .eq('id', teamId)
      if (error) throw error
      await loadTeams()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete team')
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>My Teams</h1>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={onBack}>Back</button>
          <button className="btn accent" onClick={() => setShowCreate(true)}>New Team</button>
        </div>
      </header>
      <main className="card" style={{ maxWidth: 720, margin: '24px auto' }}>
        {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <p className="muted" style={{ textAlign: 'center', padding: 32 }}>Loading teams…</p>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p className="muted" style={{ marginBottom: 16 }}>No teams yet</p>
            <button className="btn accent" onClick={() => setShowCreate(true)}>Create your first team</button>
          </div>
        ) : (
          <ul className="team-list">
            {teams.map(team => (
              <li key={team.id} className="team-card">
                <div className="team-header" onClick={() => toggleTeam(team.id)} style={{ cursor: 'pointer' }}>
                  <div className="team-colour" style={{ background: team.colour }} />
                  <div className="team-info">
                    <div className="team-name-row">
                      <strong>{team.name}</strong>
                      <span className="team-short">({team.short_name})</span>
                    </div>
                    <span className="muted" style={{ fontSize: 13 }}>
                      Created {new Date(team.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="team-actions">
                    <span className="expand-icon">{expandedTeam === team.id ? '▲' : '▼'}</span>
                    <button
                      className="btn ghost sm"
                      onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }}
                      title="Delete team"
                    >Delete</button>
                  </div>
                </div>

                {expandedTeam === team.id && (
                  <div className="team-members">
                    {membersLoading[teamId] ? (
                      <p className="muted" style={{ padding: 16, textAlign: 'center' }}>Loading members…</p>
                    ) : teamMembers[teamId]?.length === 0 ? (
                      <p className="muted" style={{ padding: 16, textAlign: 'center' }}>No members yet</p>
                    ) : (
                      <ul className="member-list">
                        {teamMembers[teamId]?.map(member => (
                          <li key={member.id} className="member-row">
                            <span className="member-name">{member.name}</span>
                            {member.is_guest && <span className="member-badge guest">Guest</span>}
                            {member.masked_mobile && <span className="member-mobile">{member.masked_mobile}</span>}
                            <span className="member-role">{member.role}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {showCreate && (
          <div className="create-team-modal" style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <h3 style={{ marginTop: 0 }}>Create New Team</h3>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label className="form-label">Team Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Mumbai Indians" required />
            </div>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label className="form-label">Short Name (3–5 chars)</label>
              <input value={newShortName} onChange={e => setNewShortName(e.target.value.toUpperCase().slice(0, 5))} placeholder="MI" maxLength={5} required />
            </div>
            <div className="form-field" style={{ marginBottom: 16 }}>
              <label className="form-label">Colour</label>
              <input type="color" value={newColour} onChange={e => setNewColour(e.target.value)} style={{ width: 60, height: 36, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => { setShowCreate(false); setNewName(''); setNewShortName(''); }}>Cancel</button>
              <button className="btn accent" onClick={createTeam} disabled={creating || !newName.trim() || !newShortName.trim()}>
                {creating ? 'Creating…' : 'Create Team'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}