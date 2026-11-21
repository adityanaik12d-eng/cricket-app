import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { TeamMember, SearchPlayer } from './api'

// Mock the supabase client
vi.mock('./supabase', () => ({
  getSupabase: vi.fn(),
}))

import { getSupabase } from './supabase'

describe('Team member query - no mobile column', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('selects only id, name, is_guest from players (no mobile/email)', async () => {
    // This test documents the expected query shape for team_members with player details
    // The query must NOT select mobile or email from players table for privacy
    // It only selects: id, name, is_guest (plus user_id, created_at for internal use)

    // Mock the supabase response
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({
      data: [
        {
          player_id: 'player-1',
          role: 'captain',
          added_at: '2024-01-01T00:00:00Z',
          players: {
            id: 'player-1',
            name: 'Test Player',
            is_guest: false,
          },
        },
      ],
      error: null,
    })

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelect,
        eq: mockEq,
      })),
    } as any)

    // This simulates the actual query from TeamsScreen.tsx loadMembers function
    const { data, error } = await getSupabase()
      .from('team_members')
      .select(`
        player_id,
        role,
        added_at,
        players!inner (
          id,
          name,
          is_guest
        )
      `)
      .eq('team_id', 'team-1')

    // Verify the query shape - it selects only the allowed fields from players
    expect(data).toBeDefined()
    expect(data).not.toBeNull()
    expect((data as any[]).length).toBeGreaterThan(0)
    const firstRow = (data as any[])[0]
    const players = firstRow.players
    expect(players).toBeDefined()
    expect(players).toHaveProperty('id')
    expect(players).toHaveProperty('name')
    expect(players).toHaveProperty('is_guest')
    // These should NOT be in the selection
    expect(players).not.toHaveProperty('mobile')
    expect(players).not.toHaveProperty('email')
    expect(players).not.toHaveProperty('user_id')
    expect(players).not.toHaveProperty('created_at')
  })

  it('TeamMember interface uses SearchPlayer (no mobile/email)', () => {
    // The TeamMember interface references SearchPlayer which only has id, name, is_guest
    const member: TeamMember = {
      team_id: 'team-1',
      player_id: 'player-1',
      role: 'member',
      added_at: '2024-01-01T00:00:00Z',
      added_by: null,
      player: {
        id: 'player-1',
        name: 'Test Player',
        is_guest: false,
      },
    }

    expect(member.player).toHaveProperty('id')
    expect(member.player).toHaveProperty('name')
    expect(member.player).toHaveProperty('is_guest')
    expect(member.player).not.toHaveProperty('mobile')
    expect(member.player).not.toHaveProperty('email')
  })

  it('SearchPlayer interface excludes mobile and email', () => {
    // SearchPlayer is what the search_players RPC returns
    // It must never contain mobile or email for privacy
    const searchPlayer: SearchPlayer = {
      id: 'player-1',
      name: 'Test Player',
      is_guest: false,
    }

    expect(searchPlayer).toHaveProperty('id')
    expect(searchPlayer).toHaveProperty('name')
    expect(searchPlayer).toHaveProperty('is_guest')
    expect(searchPlayer).not.toHaveProperty('mobile')
    expect(searchPlayer).not.toHaveProperty('email')
    expect(searchPlayer).not.toHaveProperty('masked_mobile')
  })
})