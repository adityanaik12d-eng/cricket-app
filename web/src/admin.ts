export const CREATOR_ADMIN_EMAIL = 'adityanaik.12d@gmail.com'

export function isCreatorAdminEmail(email?: string | null): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === CREATOR_ADMIN_EMAIL.toLowerCase()
}