import { describe, expect, it } from 'vitest'
import {
  goalAchieved,
  goalLabel,
  goalProgress,
  weekDistanceM,
  weekStartTs,
  type RunGoal,
} from './goals'

describe('goalProgress', () => {
  it('computes distance fraction, remaining and hit', () => {
    const goal: RunGoal = { kind: 'distance', targetM: 5000 }
    expect(goalProgress(goal, 2500, 0)).toEqual({
      fraction: 0.5,
      remainingM: 2500,
      hit: false,
    })
    expect(goalProgress(goal, 5000, 0).hit).toBe(true)
    expect(goalProgress(goal, 5000, 0).fraction).toBe(1)
  })

  it('clamps distance overshoot to a full bar', () => {
    const p = goalProgress({ kind: 'distance', targetM: 5000 }, 6200, 0)
    expect(p.fraction).toBe(1)
    expect(p.remainingM).toBe(0)
    expect(p.hit).toBe(true)
  })

  it('counts moving time only for duration goals', () => {
    const goal: RunGoal = { kind: 'duration', targetMs: 30 * 60_000 }
    // 40 min elapsed but only 15 min of it moving
    const p = goalProgress(goal, 100, 15 * 60_000)
    expect(p.fraction).toBeCloseTo(0.5)
    expect(p.remainingMs).toBe(15 * 60_000)
    expect(p.hit).toBe(false)

    const hit = goalProgress(goal, 100, 30 * 60_000)
    expect(hit.hit).toBe(true)
    expect(hit.remainingMs).toBe(0)
  })

  it('is inert for no goal', () => {
    const p = goalProgress({ kind: 'none' }, 10_000, 600_000)
    expect(p).toEqual({ fraction: 0, hit: false })
  })

  it('guards against zero/negative targets instead of producing NaN', () => {
    expect(goalProgress({ kind: 'distance', targetM: 0 }, 100, 0)).toEqual({
      fraction: 0,
      hit: false,
    })
    expect(
      goalProgress({ kind: 'duration', targetMs: -5 }, 0, 100_000).hit,
    ).toBe(false)
  })

  it('flags achievement on stored runs', () => {
    expect(goalAchieved({ kind: 'distance', targetM: 3000 }, 3100, 900_000)).toBe(
      true,
    )
    expect(goalAchieved({ kind: 'duration', targetMs: 600_000 }, 200, 599_999)).toBe(
      false,
    )
  })
})

describe('goalLabel', () => {
  it('formats round and fractional metric targets', () => {
    expect(goalLabel({ kind: 'distance', targetM: 5000 }, 'metric')).toBe('5K')
    expect(goalLabel({ kind: 'distance', targetM: 4500 }, 'metric')).toBe('4.5K')
  })

  it('formats imperial targets in miles', () => {
    expect(goalLabel({ kind: 'distance', targetM: 1609.344 }, 'imperial')).toBe(
      '1 MI',
    )
  })

  it('formats duration goals as clocks', () => {
    expect(goalLabel({ kind: 'duration', targetMs: 45 * 60_000 }, 'metric')).toBe(
      '45:00',
    )
    expect(goalLabel({ kind: 'none' }, 'metric')).toBeNull()
  })
})

describe('weekly windows', () => {
  it('maps any day to the Monday that starts its week', () => {
    // Wed Aug 26 2026 → Mon Aug 24; Sun Aug 30 → Mon Aug 24.
    const monday = new Date(2026, 7, 24).getTime()
    expect(weekStartTs(new Date(2026, 7, 26, 15, 41).getTime())).toBe(monday)
    expect(weekStartTs(new Date(2026, 7, 30, 23, 59).getTime())).toBe(monday)
    // Mon Aug 31 is its own week start.
    expect(weekStartTs(new Date(2026, 7, 31).getTime())).toBe(
      new Date(2026, 7, 31).getTime(),
    )
  })

  it('sums only runs inside the current week', () => {
    const monday = new Date(2026, 7, 24, 8).getTime() // this week
    const lastWeek = new Date(2026, 7, 17, 8).getTime()
    const nextWeek = new Date(2026, 7, 31, 8).getTime()

    const runs = [
      { startedAt: monday, distanceM: 4000 },
      { startedAt: monday + 86_400_000, distanceM: 6000 },
      { startedAt: lastWeek, distanceM: 99_000 },
      { startedAt: nextWeek, distanceM: 50_000 },
    ]
    const now = new Date(2026, 7, 26, 12).getTime()
    expect(weekDistanceM(runs, now)).toBe(10_000)
    expect(weekDistanceM([], now)).toBe(0)
  })
})
