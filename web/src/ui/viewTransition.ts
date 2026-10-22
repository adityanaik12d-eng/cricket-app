/**
 * The part of the browser the View Transition API needs.
 * Anything with a `startViewTransition` method can host a transition; the
 * `Document` does in browsers that support the API.
 */
export interface ViewTransitionHost {
  startViewTransition?: (update: () => void) => unknown
}

/**
 * Run a route update inside a view transition when the browser supports one.
 *
 * Without a host - or in a browser without the API - the update runs straight
 * away. The document is never touched here, so the helper is safe to call
 * outside a browser.
 */
export function withViewTransition(update: () => void, host?: ViewTransitionHost | null): void {
  if (host && typeof host.startViewTransition === 'function') {
    host.startViewTransition(update)
    return
  }
  update()
}
