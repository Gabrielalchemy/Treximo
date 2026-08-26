import type { Units } from '../state/settings'
import { formatClock } from './pace'

/** A per-run target. Stored in canonical units (meters / milliseconds). */
export type RunGoal =
  | { kind: 'none' }
  | { kind: 'distance'; targetM: number }
  | { kind: 'duration'; targetMs: number }

export interface GoalProgress {
  /** 0..1 completion of the goal, clamped */
  fraction: number
  /** meters left (distance goals) */
  remainingM?: number
  /** milliseconds of moving time left (duration goals) */
  remainingMs?: number
  /** true once the target has been reached */
  hit: boolean
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * Live progress toward a run goal. Duration goals count moving time only,
 * so pauses and auto-pauses never eat into the target.
 */
export function goalProgress(
  goal: RunGoal,
  distanceM: number,
  movingMs: number,
): GoalProgress {
  if (goal.kind === 'distance') {
    if (!(goal.targetM > 0)) return { fraction: 0, hit: false }
    return {
      fraction: clamp01(distanceM / goal.targetM),
      remainingM: Math.max(0, goal.targetM - distanceM),
      hit: distanceM >= goal.targetM,
    }
  }
  if (goal.kind === 'duration') {
    if (!(goal.targetMs > 0)) return { fraction: 0, hit: false }
    return {
      fraction: clamp01(movingMs / goal.targetMs),
      remainingMs: Math.max(0, goal.targetMs - movingMs),
      hit: movingMs >= goal.targetMs,
    }
  }
  return { fraction: 0, hit: false }
}

/** Short human label for a goal ("10K", "45:00"); null when no goal set. */
export function goalLabel(goal: RunGoal, units: Units): string | null {
  if (goal.kind === 'none') return null
  if (goal.kind === 'duration') return formatClock(goal.targetMs)
  if (units === 'metric') {
    const km = goal.targetM / 1000
    return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)}K`
  }
  const mi = goal.targetM / 1609.344
  return `${mi % 1 === 0 ? mi.toFixed(0) : mi.toFixed(1)} MI`
}

/** Whether a stored run achieved the goal it was stamped with. */
export function goalAchieved(
  goal: RunGoal,
  distanceM: number,
  movingMs: number,
): boolean {
  return goalProgress(goal, distanceM, movingMs).hit
}

/** Local midnight on Monday of the week containing ts. */
export function weekStartTs(ts = Date.now()): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Total distance from runs started within the current week (Mon–Sun). */
export function weekDistanceM(
  runs: readonly { startedAt: number; distanceM: number }[],
  now = Date.now(),
): number {
  const start = weekStartTs(now)
  let sum = 0
  for (const r of runs) {
    if (r.startedAt >= start && r.startedAt < start + WEEK_MS) sum += r.distanceM
  }
  return sum
}
