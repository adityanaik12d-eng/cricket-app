import { describe, expect, it } from 'vitest'
import { CREATOR_ADMIN_EMAIL, isCreatorAdminEmail } from './admin'

describe('admin identity', () => {
  it('uses the canonical creator email', () => {
    expect(CREATOR_ADMIN_EMAIL).toBe('adityanaik.12d@gmail.com')
  })
  it('matches canonical email case-insensitively', () => {
    expect(isCreatorAdminEmail('AdityaNaik.12d@gmail.com')).toBe(true)
    expect(isCreatorAdminEmail('someone@example.com')).toBe(false)
    expect(isCreatorAdminEmail(null)).toBe(false)
  })
})