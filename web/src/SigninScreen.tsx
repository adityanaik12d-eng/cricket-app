import React, { useState } from 'react'
import { api, ApiRequestError } from './api'
import { setToken } from './token'

type Step = 'email' | 'otp' | 'register' | 'password'

export function SigninScreen({ onDone }: { onDone: () => void }): React.ReactElement {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function requestOtp(): Promise<void> {
    setError(null)
    const trimmed = email.trim().replace(/[​-‍﻿]/g, '')
    if (trimmed.length === 0) {
      setError('Enter your email address')
      return
    }
    setBusy(true)
    try {
      const res = await api.requestOtp(email.trim())
      setDevOtp(res.devOtp ?? null)
      setStep('otp')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send OTP')
    } finally {
      setBusy(false)
    }
  }

  async function submitOtp(register: boolean): Promise<void> {
    setError(null)
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP')
      return
    }
    setBusy(true)
    try {
      const res = register
        ? await api.register(email.trim(), otp, name.trim())
        : await api.verifyOtp(email.trim(), otp)
      setToken(res.token)
      onDone()
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'NO_ACCOUNT' && !register) {
        setStep('register')
        setError('No profile for this email — create one below')
      } else if (err instanceof ApiRequestError && err.code === 'OTP_MISMATCH') {
        setError('Incorrect OTP, try again')
      } else if (err instanceof ApiRequestError && err.code === 'OTP_MAX_ATTEMPTS') {
        setError('Too many attempts — request a new OTP')
        setStep('email')
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Verification failed')
      }
    } finally {
      setBusy(false)
    }
  }

  async function signInWithPassword(): Promise<void> {
    setError(null)
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    if (!password) {
      setError('Enter your password')
      return
    }
    setBusy(true)
    try {
      const res = await api.signInWithPassword(email.trim(), password)
      setToken(res.token)
      onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  function showPasswordSignin(): void {
    setStep('password')
    setError(null)
    setOtp('')
    setName('')
    setDevOtp(null)
    setPassword('')
  }

  function showOtpFlow(): void {
    setStep('email')
    setError(null)
    setPassword('')
    setName('')
  }

  return (
    <div className="card">
      <h2>Sign in</h2>

      {step === 'email' && (
        <div className="form-stack">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button onClick={() => void requestOtp()} disabled={busy}>
            Send OTP
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="form-stack">
          {devOtp && <p className="muted">Dev OTP: <strong>{devOtp}</strong></p>}
          <input
            inputMode="numeric"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
          />
          <button onClick={() => void submitOtp(false)} disabled={busy}>
            Verify
          </button>
          <button className="ghost" onClick={() => setStep('email')} disabled={busy}>
            Change email
          </button>
        </div>
      )}

      {step === 'register' && (
        <div className="form-stack">
          {devOtp && <p className="muted">Dev OTP: <strong>{devOtp}</strong></p>}
          <input
            inputMode="numeric"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
          />
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <button onClick={() => void submitOtp(true)} disabled={busy || name.trim().length === 0}>
            Create profile
          </button>
          <button className="ghost" onClick={() => setStep('email')} disabled={busy}>
            Change email
          </button>
        </div>
      )}

      {step === 'password' && (
        <div className="form-stack">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button onClick={() => void signInWithPassword()} disabled={busy}>
            Sign in
          </button>
          <button className="ghost" onClick={showOtpFlow} disabled={busy}>
            Use OTP instead
          </button>
        </div>
      )}

      <div className="auth-links">
        <button className="ghost" onClick={showPasswordSignin} disabled={busy}>
          Sign in with password
        </button>
        <button className="ghost" onClick={() => (window.location.hash = '#/signup')} disabled={busy}>
          Create account
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  )
}