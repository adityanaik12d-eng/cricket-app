import React, { useEffect, useState } from 'react'
import type { CareerStats, Player } from './api'
import { api, ApiRequestError } from './api'
import { clearToken } from './token'
import { validateProfilePatch } from './profile'
import type { ProfilePatch } from './profile'

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
      <div className="card">
        {error ? (
          <>
            <p className="error">{error}</p>
            <a className="btn" href="#/signin">Sign in</a>
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <h2>{player.name}</h2>
      <p className="muted">{player.location ?? 'Add your location'}</p>
      <div className="career-strip">
        <div><strong>{stats?.matches ?? 0}</strong><span>Matches</span></div>
        <div><strong>{stats?.runs ?? 0}</strong><span>Runs</span></div>
        <div><strong>{stats?.wickets ?? 0}</strong><span>Wickets</span></div>
      </div>

      <h3>Playing role</h3>
      <div className="chip-row">
        {ROLES.map((role) => (
          <button
            key={role}
            className={player.role === role ? 'chip active' : 'chip'}
            onClick={() => void save({ role })}
          >
            {role === 'KEEPER' ? 'Wicketkeeper' : role.charAt(0) + role.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <h3>Batting style</h3>
      <div className="chip-row">
        {(['RHB', 'LHB'] as const).map((hand) => (
          <button
            key={hand}
            className={player.batting_hand === hand ? 'chip active' : 'chip'}
            onClick={() => void save({ batting_hand: hand })}
          >
            {hand}
          </button>
        ))}
      </div>

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

      <h3>Location</h3>
      <input
        defaultValue={player.location ?? ''}
        placeholder="City"
        onBlur={(e) => {
          const value = e.target.value.trim()
          if (value !== (player.location ?? '')) void save({ location: value.length > 0 ? value : null })
        }}
      />

      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      <h3>Career stats <span className="free-badge">FREE</span></h3>
      {stats && (
        <div className="stats-grid">
          <div><span>Batting</span> {stats.runs} runs ({stats.balls} balls), SR {stats.batting.strikeRate}, HS {stats.highest}, {stats.fours}×4, {stats.sixes}×6, avg {stats.batting.average}</div>
          <div><span>Bowling</span> {stats.wickets} wkts in {stats.oversBowled} ov, econ {stats.bowling.economy}, best {stats.bestBowling}</div>
          <div><span>Fielding</span> {stats.catches} catches, {stats.stumpings} stumpings, {stats.runOuts} run-outs</div>
        </div>
      )}

      <button
        className="ghost"
        onClick={() => {
          clearToken()
          onSignedOut()
        }}
      >
        Sign out
      </button>
    </div>
  )
}
