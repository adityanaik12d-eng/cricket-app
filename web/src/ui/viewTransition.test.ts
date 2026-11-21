import { describe, expect, it } from 'vitest'
import { withViewTransition } from './viewTransition'

describe('withViewTransition', () => {
  it('runs the update directly when there is no host', () => {
    let ran = 0
    withViewTransition(() => {
      ran += 1
    })
    expect(ran).toBe(1)
  })

  it('runs the update directly when the host cannot start a transition', () => {
    let ran = 0
    withViewTransition(
      () => {
        ran += 1
      },
      {},
    )
    expect(ran).toBe(1)
  })

  it('runs the update directly when the host is null', () => {
    let ran = 0
    withViewTransition(
      () => {
        ran += 1
      },
      null,
    )
    expect(ran).toBe(1)
  })

  it('hands the update to the host when it can start a transition', () => {
    let ran = 0
    let started = 0
    withViewTransition(
      () => {
        ran += 1
      },
      {
        startViewTransition: (update) => {
          started += 1
          update()
          return null
        },
      },
    )
    expect(started).toBe(1)
    expect(ran).toBe(1)
  })

  it('does not reach for the document when there is no host', () => {
    // The function must not access `document` directly when no host is provided.
    // It should just run the update synchronously.
    expect(() =>
      withViewTransition(() => {
        /* nothing */
      }),
    ).not.toThrow()
  })
})
