import Dexie, { type EntityTable } from 'dexie'
import type { GeoPoint } from '../lib/geo'
import type { RunGoal } from '../lib/goals'

export interface StoredRun {
  id: string
  /** 'active' = in-flight session (survives reloads), 'completed' = finished */
  status: 'active' | 'completed'
  /** for active runs: which phase the tracker was in when last persisted */
  phase?: 'recording' | 'paused'
  /** for paused active runs: whether that pause was automatic */
  auto?: boolean
  startedAt: number
  endedAt?: number
  distanceM: number
  movingMs: number
  points: GeoPoint[]
  /** goal this run was attempted with, when one was set */
  goal?: RunGoal
}

class TreximoDB extends Dexie {
  runs!: EntityTable<StoredRun, 'id'>

  constructor() {
    super('treximo')
    this.version(1).stores({
      runs: 'id, status, startedAt',
    })
  }
}

export const db = new TreximoDB()

export async function loadActiveRun(): Promise<StoredRun | undefined> {
  return db.runs.where('status').equals('active').last()
}

export async function persistActiveRun(run: {
  id: string
  startedAt: number
  phase: 'recording' | 'paused'
  autoPaused?: boolean
  distanceM: number
  movingMs: number
  points: readonly GeoPoint[]
}): Promise<void> {
  await db.runs.put({
    id: run.id,
    status: 'active',
    phase: run.phase,
    ...(run.phase === 'paused' ? { auto: run.autoPaused ?? false } : {}),
    startedAt: run.startedAt,
    distanceM: run.distanceM,
    movingMs: run.movingMs,
    points: [...run.points],
  })
}

/** Finalize a run (or remove its active shadow after discard). */
export async function saveCompletedRun(
  id: string,
  result: {
    points: readonly GeoPoint[]
    distanceM: number
    movingMs: number
    startedAt: number
    endedAt: number
  },
  goal?: RunGoal,
): Promise<string> {
  await db.transaction('rw', db.runs, async () => {
    await db.runs.delete(id)
    await db.runs.add({
      id,
      status: 'completed',
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      distanceM: result.distanceM,
      movingMs: result.movingMs,
      points: [...result.points],
      ...(goal && goal.kind !== 'none' ? { goal } : {}),
    })
  })
  return id
}

export function newRunId(): string {
  return crypto.randomUUID()
}
