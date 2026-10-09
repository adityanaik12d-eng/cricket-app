import React, { useState } from 'react'
import { api, ApiRequestError } from './api'
import { setToken } from './token'

type Step = 'mobile' | 'otp' | 'register'

export function SigninScreen({ onDone }: { onDone: () => void }): React.ReactElement {
  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function requestOtp(): Promise<void> {
    setError(null)
    if (!/^\d{10}$/.test(mobile)) {
      setError('Enter a 10-digit mobile number')
      return
    }
    setBusy(true)
    try {
      const res = await api.requestOtp(mobile)
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
        ? await api.register(mobile, otp, name.trim())
        : await api.verifyOtp(mobile, otp)
      setToken(res.token)
      onDone()
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'NO_ACCOUNT' && !register) {
        setStep('register')
        setError('No profile for this number — create one below')
      } else if (err instanceof ApiRequestError && err.code === 'OTP_MISMATCH') {
        setError('Incorrect OTP, try again')
      } else if (err instanceof ApiRequestError && err.code === 'OTP_MAX_ATTEMPTS') {
        setError('Too many attempts — request a new OTP')
        setStep('mobile')
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Verification failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Sign in</h2>
      {step === 'mobile' && (
        <div className="form-stack">
          <input
            inputMode="numeric"
            placeholder="Mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          <button onClick={() => void requestOtp()} disabled={busy}>
            Send OTP
          </button>
        </div>
      )}
      {step !== 'mobile' && (
        <div className="form-stack">
          {devOtp && <p className="muted">Dev OTP: <strong>{devOtp}</strong></p>}
          <input
            inputMode="numeric"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {step === 'register' && (
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <button
            onClick={() => void submitOtp(step === 'register')}
            disabled={busy || (step === 'register' && name.trim().length === 0)}
          >
            {step === 'register' ? 'Create profile' : 'Verify'}
          </button>
          <button className="ghost" onClick={() => setStep('mobile')} disabled={busy}>
            Change number
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
