/**
 * A tiny, dependency-free "blip" used to make live score changes noticeable.
 * Created lazily so nothing plays until the first real score change, and wrapped
 * in a try/catch because audio is a nice-to-have — it must never break scoring.
 */
let ctx: AudioContext | null = null

export function playScoreBlip(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    ctx = ctx ?? new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.2)
  } catch {
    // Ignore — a blocked AudioContext should not affect the board.
  }
}
