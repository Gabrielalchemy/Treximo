import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { rollingPaceSecPerKm } from '../lib/pace'
import { engine } from '../state/session'
import type { TrackerSnapshot } from '../lib/tracker'

/** Segments longer than this are treated as dropout — never interpolate past it. */
const MAX_INTERP_MS = 30_000

function subscribe(cb: () => void) {
  return engine.subscribe(cb)
}
function getSnapshot(): TrackerSnapshot {
  return engine.snapshot
}

/**
 * Live view of the tracking engine. While recording, the clock keeps ticking
 * between GPS fixes by interpolating up to MAX_INTERP_MS — so the timer never
 * visibly stalls during short signal dropouts.
 */
export function useGeoTracker() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const live = snap.status === 'recording'

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [live])

  const displayedMovingMs = useMemo(() => {
    if (live && snap.lastFixT != null) {
      const gap = Math.max(0, now - snap.lastFixT)
      return snap.movingMs + Math.min(gap, MAX_INTERP_MS)
    }
    return snap.movingMs
  }, [live, snap.movingMs, snap.lastFixT, now])

  const currentPaceSecPerKm = useMemo(
    () => rollingPaceSecPerKm(snap.points),
    [snap.points],
  )

  return { snapshot: snap, displayedMovingMs, currentPaceSecPerKm, live }
}
