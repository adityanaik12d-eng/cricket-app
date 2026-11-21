const fs = require('fs');

// Build content with proper HTML entities
const content = `import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomeBoard } from './HomeScreen'

const mockCallbacks = {
  onNew: vi.fn(),
  onRefresh: vi.fn(),
  onOpen: vi.fn(),
  onToggleSelect: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onDeleteSelected: vi.fn(),
  onDeleteAll: vi.fn(),
  onLogout: vi.fn(),
  onEnterSelectMode: vi.fn(),
  onExitSelectMode: vi.fn(),
}

describe('HomeBoard render - My Teams tile', () => {
  it('shows My Teams tile when signed in', () => {
    const html = renderToStaticMarkup(
      <HomeBoard
        liveNow={[]}
        mine={[]}
        error={null}
        loading={false}
        signedIn={true}
        isAdmin={false}
        selectMode={false}
        selected={new Set()}
        {...mockCallbacks}
      />
    )

    // Should contain My Teams tile with correct link
    expect(html).toContain('href="#/teams"')
    expect(html).toContain('My Teams')
    // renderToStaticMarkup encodes & as &
    expect(html).toContain('Rosters & players')
    expect(html).toContain('feature-teams')
  })

  it('hides My Teams tile when signed out', () => {
    const html = renderToStaticMarkup(
      <HomeBoard
        liveNow={[]}
        mine={[]}
        error={null}
        loading={false}
        signedIn={false}
        isAdmin={false}
        selectMode={false}
        selected={new Set()}
        {...mockCallbacks}
      />
    )

    // Should NOT contain My Teams tile when signed out
    expect(html).not.toContain('feature-teams')
    expect(html).not.toContain('My Teams')
    // renderToStaticMarkup encodes & as &
    expect(html).not.toContain('Rosters & players')
  })

  it('shows Sign up tile when signed out', () => {
    const html = renderToStaticMarkup(
      <HomeBoard
        liveNow={[]}
        mine={[]}
        error={null}
        loading={false}
        signedIn={false}
        isAdmin={false}
        selectMode={false}
        selected={new Set()}
        {...mockCallbacks}
      />
    )

    expect(html).toContain('href="#/signup"')
    expect(html).toContain('Sign up')
    // renderToStaticMarkup encodes & as &
    expect(html).toContain('Save & sync your matches')
  })

  it('shows Settings tile when signed in', () => {
    const html = renderToStaticMarkup(
      <HomeBoard
        liveNow={[]}
        mine={[]}
        error={null}
        loading={false}
        signedIn={true}
        isAdmin={false}
        selectMode={false}
        selected={new Set()}
        {...mockCallbacks}
      />
    )

    expect(html).toContain('href="#/settings"')
    expect(html).toContain('Settings')
    // renderToStaticMarkup encodes & as &
    expect(html).toContain('Profile & preferences')
  })

  it('shows Admin tile when signed in and is admin', () => {
    const html = renderToStaticMarkup(
      <HomeBoard
        liveNow={[]}
        mine={[]}
        error={null}
        loading={false}
        signedIn={true}
        isAdmin={true}
        selectMode={false}
        selected={new Set()}
        {...mockCallbacks}
      />
    )

    expect(html).toContain('href="#/admin"')
    expect(html).toContain('Admin Portal')
    // renderToStaticMarkup encodes & as &
    expect(html).toContain('Manage users & accounts')
  })

  it('hides Admin tile when not admin', () => {
    const html = renderToStaticMarkup(
      <HomeBoard
        liveNow={[]}
        mine={[]}
        error={null}
        loading={false}
        signedIn={true}
        isAdmin={false}
        selectMode={false}
        selected={new Set()}
        {...mockCallbacks}
      />
    )

    expect(html).not.toContain('Admin Portal')
    expect(html).not.toContain('feature-admin')
  })
})
`;

fs.writeFileSync('src/HomeTeamsTile.test.tsx', content, 'utf8');
console.log('File written');
