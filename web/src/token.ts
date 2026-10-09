const KEY = 'token'

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  window.localStorage.setItem(KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(KEY)
}
