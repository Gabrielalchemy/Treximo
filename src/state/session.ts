import {
  db,
  loadActiveRun,
  newRunId,
  persistActiveRun,
  saveCompletedRun,
} from '../db/db'
import type { GeoPoint } from '../lib/geo'
import { TrackingEngine, browserGeoWatch, type RunResult } from '../lib/tracker'
import { useSettings } from './settings'
import { useGoal } from './goal'

/** App-wide tracker singleton. */
export const engine = new TrackingEngine(browserGeoWatch(), {
  accuracyCutoffM: useSettings.getState().accuracyCutoffM,
  isAutoPauseEnabled: () => useSettings.getState().autoPause,
})

const PERSIST_EVERY_MS = 4_000

let activeId: string | null = null
let lastPersistAt = 0
let prevStatus = engine.snapshot.status

function buzz(pattern: number | number[]): void {
  if (useSettings.getState().haptics && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

engine.subscribe(() => {
  const s = engine.snapshot
  const statusChanged = s.status !== prevStatus
  prevStatus = s.status

  if (statusChanged) buzz(s.status === 'recording' ? 30 : [20, 60, 20])

  const live = s.status === 'recording' || s.status === 'paused'
  const now = Date.now()
  if (live && activeId && (statusChanged || now - lastPersistAt >= PERSIST_EVERY_MS)) {
    lastPersistAt = now
    void persistActiveRun({
      id: activeId,
      startedAt: s.startedAt ?? now,
      phase: s.status === 'paused' ? 'paused' : 'recording',
      autoPaused: s.autoPaused,
      distanceM: s.distanceM,
      movingMs: s.movingMs,
      points: s.points,
    })
  }
})

export function startRun(): void {
  if (engine.snapshot.status !== 'idle') return
  activeId = newRunId()
  lastPersistAt = 0
  buzz(30)
  engine.start()
}

export async function finishRun(): Promise<string | null> {
  const res: RunResult | null = engine.stop()
  if (!res) return null
  const id = activeId ?? newRunId()
  activeId = null
  await saveCompletedRun(id, res, useGoal.getState().runGoal)
  return id
}

export async function discardRun(): Promise<void> {
  engine.discard()
  if (activeId) {
    await db.runs.delete(activeId)
    activeId = null
  }
}

/**
 * Boot-time restore of an in-flight session (page reload mid-run).
 * Returns true when a session was revived.
 */
export async function restoreSession(): Promise<boolean> {
  const active = await loadActiveRun()
  if (!active || active.points.length === 0) return false

  activeId = active.id
  prevStatus = active.phase ?? 'paused'
  engine.hydrate(
    active.points,
    active.movingMs,
    prevStatus,
    active.startedAt,
    active.auto ?? false,
  )
  engine.reattach()
  return true
}

export async function addManualRun(input: {
  distanceM: number
  movingMs: number
  startedAt: number
  points?: readonly GeoPoint[]
}): Promise<string> {
  const id = newRunId()
  const points = (input.points ?? []).map((point) => ({ ...point, acc: point.acc ?? 0 }))
  await db.runs.add({
    id,
    status: 'completed',
    startedAt: input.startedAt,
    endedAt: input.startedAt + input.movingMs,
    distanceM: input.distanceM,
    movingMs: input.movingMs,
    points,
  })
  return id
}

export async function deleteRun(id: string): Promise<void> {
  await db.runs.delete(id)
}
