import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals — register RTL cleanup manually.
afterEach(() => {
  cleanup()
})

// jsdom lacks matchMedia, which framer-motion's reduced-motion hook consults.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// Element.animate isn't implemented in jsdom; framer-motion can call it.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = (() => ({
    cancel: () => {},
    finished: Promise.resolve(),
    onfinish: null,
    oncancel: null,
  })) as unknown as typeof Element.prototype.animate
}
