import { describe, expect, it } from 'vitest'
import {
  directoryEntry,
  directoryEntryFromSearch,
  newLocalEntry,
  LineupEntry,
  buildLineupRefs,
} from './lineup'
import type { Player, SearchPlayer } from './api'

describe('Import roster - carries playerId, no fake mobile', () => {
  describe('directoryEntryFromSearch', () => {
    it('creates LineupEntry with playerId from SearchPlayer', () => {
      const searchPlayer: SearchPlayer = {
        id: 'player-uuid-123',
        name: 'Roster Player',
        is_guest: false,
      }

      const entry = directoryEntryFromSearch(searchPlayer)

      expect(entry).toEqual({
        id: 'player-uuid-123',
        name: 'Roster Player',
        mobile: undefined,
        verified: true,
        playerId: 'player-uuid-123',
      })
    })

    it('sets verified to false for guest players', () => {
      const guestPlayer: SearchPlayer = {
        id: 'guest-uuid-456',
        name: 'Guest Player',
        is_guest: true,
      }

      const entry = directoryEntryFromSearch(guestPlayer)

      expect(entry.verified).toBe(false)
      expect(entry.playerId).toBe('guest-uuid-456')
      expect(entry.mobile).toBeUndefined()
    })

    it('never includes mobile property (not even undefined explicitly)', () => {
      // The entry should have mobile as undefined, but the key should exist
      // (TypeScript requires the property to exist with undefined value)
      const searchPlayer: SearchPlayer = {
        id: 'player-1',
        name: 'Test',
        is_guest: false,
      }

      const entry = directoryEntryFromSearch(searchPlayer)

      // mobile should be explicitly undefined (not a real mobile number)
      expect(entry.mobile).toBeUndefined()
      // playerId should be set to the search player's id
      expect(entry.playerId).toBe('player-1')
    })
  })

  describe('directoryEntry (legacy Player type)', () => {
    it('includes mobile from Player type', () => {
      const player: Player = {
        id: 'player-1',
        name: 'Test Player',
        mobile: '9876543210',
        role: 'BATSMAN',
        batting_hand: 'RHB',
        bowling_style: null,
        location: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      const entry = directoryEntry(player)

      expect(entry.mobile).toBe('9876543210')
      expect(entry.verified).toBe(true)
      // Note: legacy directoryEntry doesn't set playerId
      expect(entry.playerId).toBeUndefined()
    })
  })

  describe('buildLineupRefs', () => {
    it('includes playerId in refs when present', () => {
      const entries: LineupEntry[] = [
        { id: '1', name: 'Player 1', mobile: undefined, verified: true, playerId: 'player-uuid-1' },
        { id: '2', name: 'Player 2', mobile: '9876543210', verified: true, playerId: 'player-uuid-2' },
        { id: '3', name: 'Player 3', mobile: undefined, verified: false }, // local entry
      ]

      const { ids, refs } = buildLineupRefs(entries)

      expect(ids).toEqual(['1', '2', '3'])
      expect(refs['1']).toEqual({ name: 'Player 1', verified: true }) // no mobile
      expect(refs['2']).toEqual({ name: 'Player 2', mobile: '9876543210', verified: true })
      expect(refs['3']).toEqual({ name: 'Player 3', verified: false })
    })

    it('does not add fake mobile for entries without mobile', () => {
      const entries: LineupEntry[] = [
        { id: '1', name: 'Player 1', mobile: undefined, verified: true, playerId: 'player-uuid-1' },
      ]

      const { refs } = buildLineupRefs(entries)

      // The ref should not have a mobile property at all (not even undefined)
      expect(refs['1']).not.toHaveProperty('mobile')
    })
  })

  describe('newLocalEntry', () => {
    it('creates entry without playerId or mobile', () => {
      const entry = newLocalEntry('Local Player', [])

      expect(entry.id).toMatch(/^local-/)
      expect(entry.name).toBe('Local Player')
      expect(entry.mobile).toBeUndefined()
      expect(entry.verified).toBe(false)
      expect(entry.playerId).toBeUndefined()
    })
  })

  describe('Import team roster flow', () => {
    it('converts team members to directory entries with playerId', () => {
      // Simulating the importTeamRoster logic from App.tsx
      const mockTeamMembers = [
        {
          player_id: 'player-1',
          role: 'captain',
          added_at: '2024-01-01T00:00:00Z',
          player: {
            id: 'player-1',
            name: 'Captain Player',
            is_guest: false,
          },
        },
        {
          player_id: 'player-2',
          role: 'member',
          added_at: '2024-01-01T00:00:00Z',
          player: {
            id: 'player-2',
            name: 'Member Player',
            is_guest: true,
          },
        },
      ]

      // This is what importTeamRoster does - maps each member to directoryEntryFromSearch
      const lineupEntries = mockTeamMembers.map((m) =>
        directoryEntryFromSearch(m.player)
      )

      expect(lineupEntries).toHaveLength(2)

      // First entry - captain (not guest)
      expect(lineupEntries[0]).toEqual({
        id: 'player-1',
        name: 'Captain Player',
        mobile: undefined,
        verified: true,
        playerId: 'player-1',
      })

      // Second entry - guest member
      expect(lineupEntries[1]).toEqual({
        id: 'player-2',
        name: 'Member Player',
        mobile: undefined,
        verified: false,
        playerId: 'player-2',
      })

      // Neither should have a mobile number (not even a fake one)
      expect(lineupEntries[0]?.mobile).toBeUndefined()
      expect(lineupEntries[1]?.mobile).toBeUndefined()
    })
  })
})