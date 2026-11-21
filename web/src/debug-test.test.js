import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

function HomeBoard({signedIn, isAdmin}) {
  return (
    <div className='shell home-shell'>
      <section className='feature-grid' aria-label='Quick actions'>
        <a href='#/standings' className='feature-card feature-runs'><span className='feature-icon'>📊</span><span className='feature-title'>Points Table</span><span className='feature-desc'>Standings, NRR & Smart NRR</span></a>
        <a href='#/dls' className='feature-card feature-wicket'><span className='feature-icon'>🌧️</span><span className='feature-title'>DLS / VJD</span><span className='feature-desc'>Revise targets with demos</span></a>
        <a href='#/tournaments' className='feature-card feature-boundary'><span className='feature-icon'>🏆</span><span className='feature-title'>Tournaments</span><span className='feature-desc'>Teams, fixtures & results</span></a>
        {signedIn && (
          <a href='#/teams' className='feature-card feature-teams'><span className='feature-icon'>👥</span><span className='feature-title'>My Teams</span><span className='feature-desc'>Rosters & players</span></a>
        )}
        {signedIn ? (
          <a href='#/settings' className='feature-card feature-six'><span className='feature-icon'>⚙️</span><span className='feature-title'>Settings</span><span className='feature-desc'>Profile & preferences</span></a>
        ) : (
          <a href='#/signup' className='feature-card feature-six'><span className='feature-icon'>✨</span><span className='feature-title'>Sign up</span><span className='feature-desc'>Save & sync your matches</span></a>
        )}
        {signedIn && isAdmin && (
          <a href='#/admin' className='feature-card feature-admin'><span className='feature-icon'>🛡️</span><span className='feature-title'>Admin Portal</span><span className='feature-desc'>Manage users & accounts</span></a>
        )}
      </section>
    </div>
  )
}

const html1 = renderToStaticMarkup(<HomeBoard signedIn={true} isAdmin={false} />)
console.log('=== SIGNED IN ===')
console.log(html1)

const html2 = renderToStaticMarkup(<HomeBoard signedIn={false} isAdmin={false} />)
console.log('=== SIGNED OUT ===')
console.log(html2)

const html3 = renderToStaticMarkup(<HomeBoard signedIn={true} isAdmin={true} />)
console.log('=== ADMIN ===')
console.log(html3)
