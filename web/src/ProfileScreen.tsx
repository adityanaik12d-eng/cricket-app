import React, { useEffect, useState } from 'react'
import type { CareerStats, Player } from './api'
import { api, ApiRequestError } from './api'
import { clearToken } from './token'
import { roleLabel, validateProfilePatch } from './profile'
import type { ProfilePatch } from './profile'
import { ThemeToggle } from './ui/ThemeToggle'
import { HomeIcon } from './ui/HomeIcon'

const ROLES: Array<Player['role']> = ['BATSMAN', 'BOWLER', 'KEEPER', 'ALL_ROUNDER']

export function ProfileScreen({ onSignedOut }: { onSignedOut: () => void }): React.ReactElement {
  const [player, setPlayer] = useState<Player | null>(null)
  const [stats, setStats] = useState<CareerStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMe()
      .then(({ player }) => {
        setPlayer(player)
        return api.getPlayerStats(player.id)
      })
      .then(setStats)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.code === 'UNAUTHENTICATED') clearToken()
        setError(err instanceof ApiRequestError ? err.message : 'Failed to load profile')
      })
  }, [])

  async function save(patch: ProfilePatch): Promise<void> {
    setError(null)
    setNotice(null)
    const check = validateProfilePatch(patch)
    if (!check.ok) {
      setError(check.error)
      return
    }
    try {
      const { player: updated } = await api.patchMe(check.value)
      setPlayer(updated)
      setNotice('Saved')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Save failed')
    }
  }

  if (!player) {
    return (
      <div className="shell" style={{ maxWidth: 480, margin: '40px auto' }}>
        <div className="card">
          {error ? (
            <>
              <p className="error">{error}</p>
              <a className="btn btn-primary wide" href="#/signin">Sign in</a>
            </>
          ) : (
            <p className="muted">Loading…</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="shell" style={{ maxWidth: 480, margin: '0 auto', paddingBottom: '120px' }}>
      <header className="topbar">
        <div>
          <h1>My Scorebook</h1>
        </div>
        <div className="topbar-actions">
          <button className="btn ghost home-btn" onClick={() => window.location.hash = '#/'} aria-label="Back to home">
            <HomeIcon />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="card profile-header">
        <div className="profile-avatar avatar-xl">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>{player.name}</h2>
          <p className="muted">{player.location ?? 'Add your location'}</p>
        </div>
      </div>

      <div className="card career-strip">
        <div><strong>{stats?.matches ?? 0}</strong><span>Matches</span></div>
        <div><strong>{stats?.runs ?? 0}</strong><span>Runs</span></div>
        <div><strong>{stats?.wickets ?? 0}</strong><span>Wickets</span></div>
      </div>

      <section className="card">
        <h3>Playing role</h3>
        <div className="chip-row">
          {ROLES.map((role) => (
            <button
              key={role}
              className={`chip ${player.role === role ? 'active' : ''}`}
              onClick={() => void save({ role })}
            >
              {roleLabel(role)}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Batting style</h3>
        <div className="chip-row">
          {(['RHB', 'LHB'] as const).map((hand) => (
            <button
              key={hand}
              className={`chip ${player.batting_hand === hand ? 'active' : ''}`}
              onClick={() => void save({ batting_hand: hand })}
            >
              {hand}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Bowling style</h3>
        <input
          defaultValue={player.bowling_style ?? ''}
          placeholder="e.g. Right-arm medium"
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value !== (player.bowling_style ?? '')) {
              void save({ bowling_style: value.length > 0 ? value : null })
            }
          }}
        />
      </section>

      <section className="card">
        <h3>Location</h3>
        <input
          defaultValue={player.location ?? ''}
          placeholder="City"
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value !== (player.location ?? '')) void save({ location: value.length > 0 ? value : null })
          }}
        />
      </section>

      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h3>Career stats</h3>
        {stats && (
          <div className="stats-grid">
            <div><span>Batting</span> {stats.runs} runs ({stats.balls} balls), SR {stats.batting.strikeRate}, HS {stats.highest}, {stats.fours}×4, {stats.sixes}×6, avg {stats.batting.average}</div>
            <div><span>Bowling</span> {stats.wickets} wkts in {stats.oversBowled} ov, econ {stats.bowling.economy}, best {stats.bestBowling}</div>
            <div><span>Fielding</span> {stats.catches} catches, {stats.stumpings} stumpings, {stats.runOuts} run-outs</div>
          </div>
        )}
      </section>

      <button
        className="btn btn-ghost wide"
        onClick={() => {
          clearToken()
          onSignedOut()
        }}
        style={{ marginTop: '16px' }}
      >
        Sign out
      </button>
    </div>
  )
}