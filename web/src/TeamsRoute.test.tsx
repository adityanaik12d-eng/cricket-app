import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseHash } from './routes'

// Mock Supabase
vi.mock('./supabase', () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } })
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null })
    }))
  }))
}))

import { getSupabase } from './supabase'

// Mock api
vi.mock('./api', () => ({
  api: {
    listMyTeams: vi.fn().mockResolvedValue([]),
    listMatches: vi.fn().mockResolvedValue([]),
    listOwnedMatches: vi.fn().mockResolvedValue([]),
    searchPlayers: vi.fn().mockResolvedValue({ players: [] }),
    createTeam: vi.fn(),
    createPlayer: vi.fn(),
    createMatch: vi.fn(),
    postEvent: vi.fn(),
    signOut: vi.fn(),
    deleteMatches: vi.fn(),
    deleteAllMyMatches: vi.fn()
  },
  ApiRequestError: class extends Error {}
}))

// Mock ownership
vi.mock('./ownership', () => ({
  createScorerToken: vi.fn().mockReturnValue('test-token'),
  storeScorerToken: vi.fn()
}))

// Mock admin
vi.mock('./admin', () => ({
  isCreatorAdminEmail: vi.fn(() => false)
}))

// Mock myMatches
vi.mock('./myMatches', () => ({
  myMatchIds: vi.fn(() => []),
  clearMyMatches: vi.fn(),
  rememberMatch: vi.fn()
}))

// Mock match module
vi.mock('./match', () => ({
  buildConfig: vi.fn(),
  computeBundle: vi.fn(),
  buildEvent: vi.fn()
}))

// Import App after mocks are set up
import { App } from './App'

describe('parseHash - teams route', () => {
  it('parses #/teams', () => {
    expect(parseHash('#/teams')).toEqual({ name: 'teams' })
  })
})

describe('App renders TeamsScreen at #/teams', () => {
  let originalHash: string

  beforeEach(() => {
    originalHash = window.location.hash
    window.location.hash = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    window.location.hash = originalHash
  })

  it('renders TeamsScreen when signed in', () => {
    // Mock signed in user
    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'test@test.com' } } } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'test@test.com' } } })
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      }))
    })

    window.location.hash = '#/teams'
    const html = renderToStaticMarkup(<App />)
    // In SSR, TeamsScreen shows loading state initially (useEffect doesn't run)
    // But we can verify the route works and TeamsScreen renders
    expect(html).toContain('My Teams')
    expect(html).toContain('Loading teams')
  })

  it('renders TeamsScreen when signed out (no console error)', () => {
    // Mock signed out user
    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } })
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      }))
    })

    window.location.hash = '#/teams'
    const html = renderToStaticMarkup(<App />)
    // In SSR, TeamsScreen shows loading state initially (useEffect doesn't run)
    // But we can verify the route works and TeamsScreen renders without error
    expect(html).toContain('My Teams')
    expect(html).toContain('Loading teams')
  })
})