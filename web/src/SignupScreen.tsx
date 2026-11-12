import React, { useState } from 'react'
import { api, ApiRequestError } from './api'
import { setToken } from './token'

export function SignupScreen({ onDone }: { onDone: () => void }): React.ReactElement {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSignUp(): Promise<void> {
    setError(null)
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    if (!name.trim()) {
      setError('Enter your name')
      return
    }
    if (!mobile.trim()) {
      setError('Enter your mobile number')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const res = await api.signUpWithPassword(email.trim(), password, name.trim(), mobile.trim())
      setToken(res.token)
      onDone()
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'EMAIL_CONFIRMATION_REQUIRED') {
        setError(err.message)
      } else if (err instanceof ApiRequestError && err.code === 'SIGNUP_FAILED') {
        setError(err.message)
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Sign up failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ms-auth-wrap ms-reveal">
      <div className="card ms-auth-card">
        <div className="ms-auth-hero">
          <h2>Create account</h2>
          <p>Join Cricket Scorer to save matches, sync stats, and score with style.</p>
        </div>

      <div className="form-stack">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <input
          type="tel"
          placeholder="Mobile number (required)"
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 15))}
          autoComplete="tel"
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button className="btn accent" onClick={() => void handleSignUp()} disabled={busy}>
          {busy ? 'Creating...' : 'Create account'}
        </button>
        <button className="btn ghost" onClick={() => (window.location.hash = '#/signin')} disabled={busy}>
          Already have an account? Sign in
        </button>
        <button className="btn ghost" onClick={() => (window.location.hash = '#/signin?otp=1')} disabled={busy}>
          Use OTP instead
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
