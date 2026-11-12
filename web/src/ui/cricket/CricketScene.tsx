import type { CSSProperties } from 'react'

export function CricketBall({ size = 44, className = '', style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <radialGradient id="ballGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ff8a80" />
          <stop offset="45%" stopColor="#e53935" />
          <stop offset="100%" stopColor="#8e0000" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#ballGrad)" />
      <path d="M14 22c10 6 26 6 36 0" stroke="#ffd7d7" strokeWidth="2.2" strokeLinecap="round" opacity=".85" />
      <path d="M14 42c10-6 26-6 36 0" stroke="#ffd7d7" strokeWidth="2.2" strokeLinecap="round" opacity=".85" />
      <path d="M18 24c8 4 20 4 28 0M18 40c8-4 20-4 28 0" stroke="#5d0000" strokeWidth="1.2" strokeLinecap="round" opacity=".35" />
      <ellipse cx="24" cy="23" rx="7" ry="5" fill="#fff" opacity=".18" />
    </svg>
  )
}

export function Stumps({ width = 54, className = '', style }: { width?: number; className?: string; style?: CSSProperties }) {
  const h = Math.round(width * 1.15)
  return (
    <svg className={className} style={style} width={width} height={h} viewBox="0 0 54 62" fill="none" aria-hidden>
      <defs>
        <linearGradient id="stumpWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="100%" stopColor="#d4a72c" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="6" height="46" rx="2" fill="url(#stumpWood)" />
      <rect x="24" y="8" width="6" height="46" rx="2" fill="url(#stumpWood)" />
      <rect x="40" y="8" width="6" height="46" rx="2" fill="url(#stumpWood)" />
      <rect x="6" y="2" width="14" height="4" rx="1.5" fill="#8d4b1f" />
      <rect x="34" y="2" width="14" height="4" rx="1.5" fill="#8d4b1f" />
      <rect x="4" y="54" width="46" height="4" rx="2" fill="#7cb342" opacity=".55" />
    </svg>
  )
}

export function CricketHeroScene({ className = '' }: { className?: string }) {
  return (
    <div className={`cricket-hero-scene ${className}`} aria-hidden>
      <div className="hero-orb hero-orb-a" />
      <div className="hero-orb hero-orb-b" />
      <div className="hero-orb hero-orb-c" />
      <svg className="hero-pitch" viewBox="0 0 800 220" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pitchG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ecb63" stopOpacity="0.0" />
            <stop offset="30%" stopColor="#65b84d" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2e7d32" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <ellipse cx="400" cy="210" rx="520" ry="140" fill="url(#pitchG)" />
        <rect x="360" y="118" width="80" height="88" rx="4" fill="#e8d5a3" opacity="0.18" />
        <ellipse cx="400" cy="210" rx="250" ry="62" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="2" />
      </svg>
      <div className="hero-float hero-float-ball"><CricketBall size={52} /></div>
      <div className="hero-float hero-float-stumps"><Stumps width={48} /></div>
      <div className="hero-sparkles">
        <span /><span /><span /><span /><span /><span />
      </div>
    </div>
  )
}
