import { useRef, type ReactNode, type CSSProperties } from 'react'

interface Props {
  children: ReactNode
  className?: string
  style?: CSSProperties
  maxTilt?: number
  as?: 'div' | 'article' | 'button' | 'a'
  href?: string
  onClick?: () => void
  role?: string
  tabIndex?: number
}

/** MotionSites animated-cards inspired interactive tilt (lightweight, respects reduced motion). */
export function TiltCard({ children, className = '', style, maxTilt = 8, as: Tag = 'div', href, onClick, role, tabIndex }: Props) {
  const ref = useRef<any>(null)
  const raf = useRef<number | null>(null)

  function setTilt(x: number, y: number, rect: DOMRect) {
    const px = (x - rect.left) / rect.width
    const py = (y - rect.top) / rect.height
    const rx = (0.5 - py) * maxTilt
    const ry = (px - 0.5) * maxTilt
    const el = ref.current
    if (!el) return
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`
    el.style.setProperty('--tilt-x', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--tilt-y', `${(py * 100).toFixed(1)}%`)
  }

  function onMove(e: React.PointerEvent) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX, y = e.clientY
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => setTilt(x, y, rect))
  }

  function onLeave() {
    if (raf.current) cancelAnimationFrame(raf.current)
    const el = ref.current
    if (!el) return
    el.style.transform = ''
  }

  return (
    <Tag
      ref={ref}
      className={`ms-tilt ${className}`.trim()}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      href={href}
      role={role}
      tabIndex={tabIndex}
    >
      <span className="ms-tilt-glare" aria-hidden="true" />
      {children}
    </Tag>
  )
}
