import { useEffect, useRef } from 'react'

interface Props {
  busy?: boolean
  error?: string | null
  onPick: (runs: number) => void
  onClose: () => void
}

/**
 * Bottom sheet with a numeric keypad for custom runs entry (0-12).
 * Strike rotation follows cricket rules: odd runs swap ends, even runs stay.
 * Tapping the dimmed backdrop, the ✕, or Esc dismisses the sheet.
 * A rejected delivery keeps the sheet open and shows why inside it.
 */
export function CustomRunsSheet({ busy = false, error = null, onPick, onClose }: Props) {
  // Focus the first button on mount for accessibility
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstButtonRef.current?.focus()

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Generate run options 0-12
  const runOptions = Array.from({ length: 13 }, (_, i) => i)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet custom-runs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Custom runs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <strong>Custom runs</strong>
          <button className="btn ghost sheet-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-options keypad">
          {runOptions.map((runs) => (
            <button
              key={runs}
              ref={runs === 0 ? firstButtonRef : undefined}
              className="btn pad-btn keypad-btn"
              disabled={busy}
              onClick={() => onPick(runs)}
              aria-label={`${runs} run${runs !== 1 ? 's' : ''}`}
            >
              {runs}
            </button>
          ))}
        </div>
        {error && <p className="error sheet-error">{error}</p>}
        <p className="sheet-hint">
          Odd runs swap strike · Even runs retain strike
        </p>
      </div>
    </div>
  )
}