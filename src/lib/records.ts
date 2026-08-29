import type { StoredRun } from '../db/db'
import { bestEffortSec } from './pace'
import { weekStartTs } from './goals'

/** Fastest effort over a fixed distance within a single run. */
export interface PaceRecord {
  /** seconds needed to cover the target distance */
  sec: number
  runId: string
  startedAt: number
}

export interface LongestRunRecord {
  runId: string
  startedAt: number
  distanceM: number
}

export interface BiggestWeekRecord {
  /** local Monday midnight starting the week */
  weekStartTs: number
  distanceM: number
}

export interface Records {
  mile?: PaceRecord
  fiveK?: PaceRecord
  tenK?: PaceRecord
  longestRun?: LongestRunRecord
  biggestWeek?: BiggestWeekRecord
}

const MILE_M = 1609.344

const PACE_TARGETS: { key: 'mile' | 'fiveK' | 'tenK'; targetM: number }[] = [
  { key: 'mile', targetM: MILE_M },
  { key: 'fiveK', targetM: 5000 },
  { key: 'tenK', targetM: 10_000 },
]

/**
 * Derive all-time records from completed runs. Runs must be sorted by
 * startedAt ascending — ties then resolve to the earliest effort.
 */
export function computeRecords(runs: readonly StoredRun[]): Records {
  const out: Records = {}

  for (const { key, targetM } of PACE_TARGETS) {
    let best: PaceRecord | undefined
    for (const run of runs) {
      if (run.distanceM < targetM || run.points.length < 2) continue
      const sec = bestEffortSec(run.points, targetM)
      if (sec != null && (!best || sec < best.sec)) {
        best = { sec, runId: run.id, startedAt: run.startedAt }
      }
    }
    if (best) out[key] = best
  }

  let longest: LongestRunRecord | undefined
  const weekSums = new Map<number, number>()
  for (const run of runs) {
    if (!longest || run.distanceM > longest.distanceM) {
      longest = {
        runId: run.id,
        startedAt: run.startedAt,
        distanceM: run.distanceM,
      }
    }
    const wk = weekStartTs(run.startedAt)
    weekSums.set(wk, (weekSums.get(wk) ?? 0) + run.distanceM)
  }
  if (longest) out.longestRun = longest

  let bigWeek: BiggestWeekRecord | undefined
  for (const [weekStartTs, distanceM] of weekSums) {
    // Map iteration order = insertion order = ascending startedAt,
    // so strict > keeps the earliest week on ties.
    if (!bigWeek || distanceM > bigWeek.distanceM) {
      bigWeek = { weekStartTs, distanceM }
    }
  }
  if (bigWeek) out.biggestWeek = bigWeek

  return out
}
