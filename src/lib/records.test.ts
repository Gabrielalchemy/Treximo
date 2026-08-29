import { describe, expect, it } from 'vitest'
import type { GeoPoint } from './geo'
import { EARTH_RADIUS_M } from './geo'
import type { StoredRun } from '../db/db'
import { computeRecords } from './records'

const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180

/** Two-point run covering `distM` over `durMs`. */
function run(
  id: string,
  startedAt: number,
  distM: number,
  durMs: number,
): StoredRun {
  const points: GeoPoint[] = [
    { lat: 0, lng: 0, t: startedAt, acc: 5 },
    { lat: distM / M_PER_DEG, lng: 0, t: startedAt + durMs, acc: 5 },
  ]
  return {
    id,
    status: 'completed',
    startedAt,
    endedAt: startedAt + durMs,
    distanceM: distM,
    movingMs: durMs,
    points,
  }
}

// Mon Aug 24 2026 and the following weeks, morning runs.
const W1 = new Date(2026, 7, 24, 7).getTime()
const W2 = W1 + 7 * 86_400_000
const W3 = W2 + 7 * 86_400_000

describe('computeRecords', () => {
  it('finds pace records across runs and skips short ones', () => {
    const runs = [
      run('a', W1, 5010, 1500_000),
      run('b', W2, 10_050, 3000_000), // even 30:00 10K beats everything
      run('c', W3, 800, 400_000), // too short for anything
    ]
    const recs = computeRecords(runs)

    expect(recs.fiveK?.runId).toBe('b')
    expect(recs.tenK?.runId).toBe('b')
    expect(recs.mile?.runId).toBe('b')
    // Longer targets can't be faster than shorter ones.
    expect(recs.mile!.sec).toBeLessThan(recs.fiveK!.sec)
    expect(recs.fiveK!.sec).toBeLessThan(recs.tenK!.sec)
    expect(recs.tenK!.sec).toBeLessThanOrEqual(3000)
  })

  it('breaks pace ties by earliest run', () => {
    const runs = [
      run('early', W1, 6000, 1800_000),
      run('late', W2, 6000, 1800_000),
    ]
    expect(computeRecords(runs).fiveK?.runId).toBe('early')
  })

  it('omits records that no run can support', () => {
    const recs = computeRecords([run('s', W1, 3000, 900_000)])
    expect(recs.mile).toBeDefined() // 3 km covers a mile
    expect(recs.fiveK).toBeUndefined()
    expect(recs.tenK).toBeUndefined()
  })

  it('returns empty for no runs', () => {
    expect(computeRecords([])).toEqual({})
  })

  it('tracks longest run, earliest on ties', () => {
    const runs = [
      run('a', W1, 4200, 1200_000),
      run('b', W2, 5100, 1500_000),
      run('c', W2 + 3600_000, 5100, 1400_000), // same distance, later
    ]
    const recs = computeRecords(runs)
    expect(recs.longestRun?.runId).toBe('b')
    expect(recs.longestRun?.distanceM).toBe(5100)
  })

  it('sums biggest week across multiple runs', () => {
    const runs = [
      run('w1a', W1, 3000, 900_000),
      run('w1b', W1 + 86_400_000, 2500, 750_000), // week 1 total: 5.5 km
      run('w2', W2, 5000, 1500_000), // week 2: 5 km
      run('w3', W3 + 3 * 86_400_000, 1000, 300_000),
    ]
    const recs = computeRecords(runs)
    expect(recs.biggestWeek?.distanceM).toBe(5500)
    expect(recs.biggestWeek?.weekStartTs).toBe(
      new Date(2026, 7, 24).getTime(),
    )
  })

  it('keeps the biggest week when a later week merely ties', () => {
    const runs = [
      run('a', W1, 5000, 1500_000),
      run('b', W3, 5000, 1400_000),
    ]
    expect(computeRecords(runs).biggestWeek?.weekStartTs).toBe(
      new Date(2026, 7, 24).getTime(),
    )
  })
})
