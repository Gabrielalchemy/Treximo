import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'record' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'run'; id: string }

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h === 'history') return { name: 'history' }
  if (h === 'settings') return { name: 'settings' }
  if (h.startsWith('run/')) return { name: 'run', id: decodeURIComponent(h.slice(4)) }
  return { name: 'record' }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const getSnapshot = () => location.hash

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return parse(hash)
}

export function navigate(to: string): void {
  location.hash = to
}

export function routeKey(r: Route): string {
  return r.name === 'run' ? `run-${r.id}` : r.name
}
