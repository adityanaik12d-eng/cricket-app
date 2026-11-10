import { describe, expect, it } from 'vitest'
import { AdminApiError } from './adminApi'

describe('AdminApiError', () => {
  it('carries message, code, status', () => {
    const e = new AdminApiError('boom', 'FORBIDDEN', 403)
    expect(e.message).toBe('boom')
    expect(e.code).toBe('FORBIDDEN')
    expect(e.status).toBe(403)
    expect(e.name).toBe('AdminApiError')
  })
  it('defaults code when not provided', () => {
    const e = new AdminApiError('x')
    expect(e.code).toBe('ADMIN_ERROR')
  })
})
