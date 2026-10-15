import { useEffect } from 'react'
import type { ExtraOption } from './scoring'

interface Props {
  label: string
  options: readonly ExtraOption[]
  busy?: boolean
  error?: string | null
  onPick: (option: ExtraOption) => void
  onClose: () => void
}

/**
 * Bottom sheet holding one extras group's run variants. Tapping an option
 * records that delivery; tapping the dimmed backdrop, the ✕, or Esc dismisses
 * it. A rejected delivery keeps the sheet open and shows why inside it, so the
 * scorer does not lose their place.
 */
export function ExtrasSheet({ label, options, busy = false, error = null, onPick, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <strong>{label}</strong>
          <button className="btn ghost sheet-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-options">
          {options.map((option) => (
            <button
              key={option.label}
              className="btn pad-btn"
              disabled={busy}
              onClick={() => onPick(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {error && <p className="error sheet-error">{error}</p>}
      </div>
    </div>
  )
}
