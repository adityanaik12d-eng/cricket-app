import React, { useEffect, useState } from 'react'
import type { CareerStats, Player } from './api'
import { api, ApiRequestError } from './api'
import { clearToken } from './token'
import { roleLabel, validateProfilePatch } from './profile'
import type { ProfilePatch } from './profile'
import { HomeIcon } from './ui/HomeIcon'

const ROLES: Array<Player['role']> = ['BATSMAN', 'BOWLER', 'KEEPER', 'ALL_ROUNDER']

export function SettingsScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const [player, setPlayer] = useState<Player | null>(null)
  const [stats, setStats] = useState<CareerStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    api
      .getMe()
      .then(({ player }) => {
        setPlayer(player)
        setSignedIn(true)
        return api.getPlayerStats(player.id)
      })
      .then(setStats)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.code === 'UNAUTHENTICATED') {
          clearToken()
          setSignedIn(false)
        }
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
      <div className="card empty-state">
        {error ? (
          <>
            <p className="error">{error}</p>
            <a className="btn accent" href="#/signin">Sign in</a>
          </>
        ) : (
          <p className="empty-state-text">Loading…</p>
        )}
      </div>
    )
  }

  return (
    <div className="card settings-card">
      <div className="profile-header">
        <button className="btn ghost home-btn" onClick={onBack} aria-label="Back">
          <HomeIcon />
        </button>
        <div>
          <h2>Settings</h2>
          <p className="muted">Manage your profile and preferences</p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Profile</h3>
        <p className="muted">Mobile: {player.mobile}</p>
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
              {roleLabel(role)}
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
        <div className="form-field">
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
        </div>

        <h3>Location</h3>
        <div className="form-field">
          <input
            defaultValue={player.location ?? ''}
            placeholder="City"
            onBlur={(e) => {
              const value = e.target.value.trim()
              if (value !== (player.location ?? '')) void save({ location: value.length > 0 ? value : null })
            }}
          />
        </div>

        <h3>Mobile number</h3>
        <div className="form-field">
          <input
            type="tel"
            defaultValue={player.mobile ?? ''}
            placeholder="Mobile number"
            onBlur={(e) => {
              const value = e.target.value.trim()
              if (value && value !== player.mobile) void save({ mobile: value })
            }}
          />
        </div>

        {notice && <p className="success">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="settings-section">
        <h3>Account</h3>
        <button
          className="btn ghost danger wide"
          onClick={() => {
            clearToken()
            window.location.hash = '#/signin'
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}