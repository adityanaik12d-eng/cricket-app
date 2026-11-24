import { useEffect, useState } from 'react'
import { api, ApiRequestError } from './api'
import { buildConfig, computeBundle, type MatchBundle } from './match'
import type { MatchEvent, MatchConfig, LiveScore } from '@cricket-app/core'
import { renderToStaticMarkup } from 'react-dom/server'

interface EditMatchScreenProps {
  matchId: string
  onBack: () => void
  onSaved?: () => void
}

export function EditMatchScreen({ matchId, onBack, onSaved }: EditMatchScreenProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<MatchBundle | null>(null)
  const [config, setConfig] = useState<Partial<MatchConfig>>({})
  const [activeTab, setActiveTab] = useState<'setup' | 'lineups' | 'events'>('setup')
  const [isFinished, setIsFinished] = useState(false)
  const [matchVersion, setMatchVersion] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmPayload, setConfirmPayload] = useState<{ config: MatchConfig; events: MatchEvent[]; reason: string } | null>(null)
  const [confirmReason, setConfirmReason] = useState('')

  // Config form fields
  const [teamAName, setTeamAName] = useState('')
  const [teamBName, setTeamBName] = useState('')
  const [teamAShort, setTeamAShort] = useState('')
  const [teamBShort, setTeamBShort] = useState('')
  const [overs, setOvers] = useState(20)
  const [powerplay, setPowerplay] = useState(6)
  const [maxWickets, setMaxWickets] = useState(10)
  const [superOverEnabled, setSuperOverEnabled] = useState(false)
  const [superOverOvers, setSuperOverOvers] = useState(1)
  const [superOverMaxWickets, setSuperOverMaxWickets] = useState(2)

  useEffect(() => {
    loadMatch()
  }, [matchId])

  async function loadMatch() {
    setLoading(true)
    setError(null)
    try {
      const b = await api.getMatch(matchId)
      setBundle(b)
      // Check if match is finished
      const finished = await api.isMatchFinished(matchId)
      setIsFinished(finished)
      // Load match version for optimistic locking
      const versioned = await api.getMatchWithVersion(matchId)
      setMatchVersion(versioned.updatedAt)
      // Initialize form fields from config
      setTeamAName(b.config.teamAId)
      setTeamBName(b.config.teamBId)
      setTeamAShort(b.config.teamAId)
      setTeamBShort(b.config.teamBId)
      setOvers(b.config.oversPerInnings)
      setPowerplay(b.config.powerplayOvers)
      setMaxWickets(b.config.maxWickets)
      setSuperOverEnabled(b.config.superOverEnabled ?? false)
      setSuperOverOvers(b.config.superOverOvers ?? 1)
      setSuperOverMaxWickets(b.config.superOverMaxWickets ?? 2)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load match')
    } finally {
      setLoading(false)
    }
  }

  function buildNewConfig(): MatchConfig {
    if (!bundle) throw new Error('No bundle loaded')
    const newConfig = buildConfig(
      {
        teamAId: teamAName,
        teamBId: teamBName,
        lineups: bundle.config.lineups,
        oversPerInnings: overs,
        powerplayOvers: powerplay,
        maxWickets,
        superOverEnabled,
        superOverOvers,
        superOverMaxWickets,
      },
      matchId,
    )
    // Use updated playerRefs from config state (includes lineups tab edits)
    newConfig.playerRefs = config.playerRefs ?? bundle.config.playerRefs ?? {}
    return newConfig
  }

  async function handleSaveConfig() {
    if (!bundle || !matchVersion) return
    setError(null)
    const newConfig = buildNewConfig()
    if (isFinished) {
      // For finished matches, show confirm dialog with reason
      setConfirmPayload({ config: newConfig, events: bundle.events, reason: '' })
      setConfirmReason('')
      setShowConfirm(true)
    } else {
      // Live match path
      await doSaveConfig(newConfig)
    }
  }

  async function doSaveConfig(newConfig: MatchConfig) {
    setSaving(true)
    try {
      if (isFinished && matchVersion) {
        await api.editFinishedMatch(matchId, { config: newConfig, events: bundle!.events, reason: confirmReason, expectedUpdatedAt: matchVersion })
      } else {
        await api.replaceMatchConfig(matchId, newConfig)
      }
      await loadMatch()
      onSaved?.()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save config')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEvents() {
    if (!bundle || !matchVersion) return
    setError(null)
    if (isFinished) {
      // For finished matches, show confirm dialog with reason
      const newConfig = buildNewConfig()
      setConfirmPayload({ config: newConfig, events: bundle.events, reason: '' })
      setConfirmReason('')
      setShowConfirm(true)
    } else {
      // Live match path
      await doSaveEvents()
    }
  }

  async function doSaveEvents() {
    setSaving(true)
    try {
      if (isFinished && matchVersion) {
        const newConfig = buildNewConfig()
        await api.editFinishedMatch(matchId, { config: newConfig, events: bundle!.events, reason: confirmReason, expectedUpdatedAt: matchVersion })
      } else {
        await api.replaceMatchEvents(matchId, bundle!.events)
      }
      await loadMatch()
      onSaved?.()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save events')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmSave() {
    if (!confirmPayload || !confirmReason.trim()) {
      setError('Reason is required for editing finished matches')
      return
    }
    setShowConfirm(false)
    if (activeTab === 'setup' || activeTab === 'lineups') {
      await doSaveConfig(confirmPayload.config)
    } else {
      await doSaveEvents()
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Edit Match</h1>
          <button className="btn ghost" onClick={onBack}>Back</button>
        </header>
        <main className="card" style={{ maxWidth: 720, margin: '24px auto', textAlign: 'center', padding: 48 }}>
          Loading match…
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Edit Match</h1>
          <button className="btn ghost" onClick={onBack}>Back</button>
        </header>
        <main className="card" style={{ maxWidth: 720, margin: '24px auto' }}>
          <p className="error">{error}</p>
          <button className="btn accent" onClick={loadMatch}>Retry</button>
        </main>
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Edit Match</h1>
        <button className="btn ghost" onClick={onBack}>Back</button>
      </header>
      <main className="card" style={{ maxWidth: 720, margin: '24px auto' }}>
        {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

        {/* Tab navigation */}
        <div className="tab-bar" style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          {(['setup', 'lineups', 'events'] as const).map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeTab === tab ? 'var(--accent)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'setup' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Match Setup</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-field">
                <label className="form-label">Team A Name</label>
                <input value={teamAName} onChange={e => setTeamAName(e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Team B Name</label>
                <input value={teamBName} onChange={e => setTeamBName(e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Team A Short</label>
                <input value={teamAShort} onChange={e => setTeamAShort(e.target.value.toUpperCase().slice(0, 5))} maxLength={5} />
              </div>
              <div className="form-field">
                <label className="form-label">Team B Short</label>
                <input value={teamBShort} onChange={e => setTeamBShort(e.target.value.toUpperCase().slice(0, 5))} maxLength={5} />
              </div>
              <div className="form-field">
                <label className="form-label">Overs per Innings</label>
                <input type="number" min={1} max={50} value={overs} onChange={e => setOvers(Number(e.target.value) || 20)} />
              </div>
              <div className="form-field">
                <label className="form-label">Powerplay Overs</label>
                <input type="number" min={0} max={20} value={powerplay} onChange={e => setPowerplay(Number(e.target.value) || 6)} />
              </div>
              <div className="form-field">
                <label className="form-label">Max Wickets</label>
                <input type="number" min={1} max={10} value={maxWickets} onChange={e => setMaxWickets(Number(e.target.value) || 10)} />
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={superOverEnabled}
                  onChange={e => setSuperOverEnabled(e.target.checked)}
                />
                Enable Super Over
              </label>
              {superOverEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                  <div className="form-field">
                    <label className="form-label">Super Over Overs</label>
                    <input type="number" min={1} max={5} value={superOverOvers} onChange={e => setSuperOverOvers(Number(e.target.value) || 1)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Super Over Max Wickets</label>
                    <input type="number" min={1} max={10} value={superOverMaxWickets} onChange={e => setSuperOverMaxWickets(Number(e.target.value) || 2)} />
                  </div>
                </div>
              )}
            </div>

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn accent" onClick={handleSaveConfig} disabled={saving || (isFinished && !canEditFinished())}>
                {saving ? 'Saving…' : isFinished ? 'Save Match Setup (Requires Confirmation)' : 'Save Match Setup'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'lineups' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Lineups & Player Refs</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Edit batting order and player references. Player refs link lineup IDs to player directory entries.
            </p>
            {bundle && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {(['A', 'B'] as const).map(team => (
                  <div key={team} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ marginTop: 0 }}>{bundle.config[team === 'A' ? 'teamAId' : 'teamBId']} Lineup</h4>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {bundle.config.lineups[team].map((playerId: string, idx: number) => {
                        const playerRefs = bundle.config.playerRefs ?? {}
                        const ref = playerRefs[playerId]
                        return (
                          <li key={playerId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ width: 24, textAlign: 'right', color: 'var(--text-tertiary)' }}>{idx + 1}.</span>
                            <input
                              type="text"
                              value={ref?.name || playerId}
                              onChange={e => {
                                const newRefs = { ...playerRefs }
                                newRefs[playerId] = { ...newRefs[playerId], name: e.target.value }
                                setConfig(prev => ({ ...prev, playerRefs: newRefs }))
                              }}
                              style={{ flex: 1, padding: '6px 10px', fontSize: 14 }}
                              disabled={isFinished && !canEditFinished()}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn accent" onClick={handleSaveConfig} disabled={saving || (isFinished && !canEditFinished())}>
                {saving ? 'Saving…' : isFinished ? 'Save Lineups (Requires Confirmation)' : 'Save Lineups'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Ball-by-Ball Events</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              {bundle?.events.length ?? 0} events loaded. Full event editing requires a dedicated editor.
              <br />
              For now, you can reset the match to a specific state using the Scoring screen's undo feature.
            </p>
            {bundle && (
              <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.events.map((e, i) => (
                      <tr key={e.seq} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '4px 8px' }}>{e.seq}</td>
                        <td style={{ padding: '4px 8px', fontWeight: 500 }}>{e.type}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>
                          {e.type === 'BALL' ? `Over ${e.over}.${e.ball} · {e.runs} runs` : JSON.stringify(e).slice(0, 80)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn accent" onClick={handleSaveEvents} disabled={saving || (isFinished && !canEditFinished())}>
                {saving ? 'Saving…' : isFinished ? 'Save Events (Requires Confirmation)' : 'Save Events'}
              </button>
            </div>
          </div>
        )}

        {/* Confirm dialog for finished match edits */}
        {showConfirm && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}
            onClick={() => setShowConfirm(false)}
          >
            <div
              className="card"
              style={{ maxWidth: 500, width: '90%', padding: 24 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0 }}>Confirm Edit to Finished Match</h3>
              <p className="muted" style={{ marginBottom: 16 }}>
                This match is finished. Editing requires a reason and creates an audit trail.
              </p>
              <div className="form-field">
                <label className="form-label">Reason for edit (required)</label>
                <textarea
                  value={confirmReason}
                  onChange={e => setConfirmReason(e.target.value)}
                  placeholder="e.g., Corrected a scoring error in over 15.2"
                  style={{ minHeight: 80, width: '100%', padding: '8px 12px', fontSize: 14 }}
                />
              </div>
              {confirmPayload && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                  <strong>Changes summary:</strong>
                  <pre style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify({
                      configChanged: JSON.stringify(confirmPayload.config) !== JSON.stringify(bundle?.config),
                      eventsCount: confirmPayload.events.length,
                      reason: confirmReason || '(not provided)',
                    }, null, 2)}
                  </pre>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
                <button className="btn accent" onClick={handleConfirmSave} disabled={!confirmReason.trim()}>
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function canEditFinished(): boolean {
  // This will be checked server-side, but we can show the UI for signed-in users
  // The actual authorization happens in the RPC function
  return true
}