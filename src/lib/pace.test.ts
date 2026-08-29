import { describe, expect, it } from 'vitest'
import type { GeoPoint } from './geo'
import { EARTH_RADIUS_M } from './geo'
import {
  avgPaceSecPerKm,
  bestEffortSec,
  formatClock,
  formatKm,
  formatPace,
  paceSeriesSecPerKm,
  rollingPaceSecPerKm,
  splitsOf,
} from './pace'

/** Exact meters per degree of latitude under our haversine model. */
const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180

/** Build a straight-line track moving `speed` m/s northward, one fix per second. */
function track(fixes: number, speed = 3): GeoPoint[] {
  return Array.from({ length: fixes }, (_, i) => ({
    lat: (i * speed) / M_PER_DEG,
    lng: 0,
    t: i * 1000,
    acc: 5,
  }))
}

describe('formatClock', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(59_999)).toBe('0:59')
    expect(formatClock(61_000)).toBe('1:01')
  })

  it('formats over an hour as H:MM:SS', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00')
    expect(formatClock((3600 + 60 + 5) * 1000)).toBe('1:01:05')
  })

  it('clamps negatives', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})

describe('formatKm / formatPace', () => {
  it('formats kilometers', () => {
    expect(formatKm(1234)).toBe('1.23')
    expect(formatKm(10_000, 1)).toBe('10.0')
  })

  it('formats pace and handles nulls', () => {
    expect(formatPace(342)).toBe('5:42')
    expect(formatPace(60)).toBe('1:00')
    expect(formatPace(null)).toBe('--:--')
    expect(formatPace(0)).toBe('--:--')
  })
})

describe('avgPaceSecPerKm', () => {
  it('computes pace or null for junk input', () => {
    expect(avgPaceSecPerKm(1000, 300_000)).toBeCloseTo(300)
    expect(avgPaceSecPerKm(0, 300_000)).toBeNull()
    expect(avgPaceSecPerKm(1000, 0)).toBeNull()
  })
})

describe('rollingPaceSecPerKm', () => {
  it('returns null when stationary or too few points', () => {
    expect(rollingPaceSecPerKm([])).toBeNull()
    expect(rollingPaceSecPerKm(track(1))).toBeNull()
    // standing still: same location repeated
    const still: GeoPoint[] = Array.from({ length: 30 }, (_, i) => ({
      lat: 0,
      lng: 0,
      t: i * 1000,
      acc: 5,
    }))
    expect(rollingPaceSecPerKm(still)).toBeNull()
  })

  it('recovers the true pace on a constant-speed track', () => {
    // 3 m/s → 333.33 s/km; use long window so all fixes are in-window
    expect(rollingPaceSecPerKm(track(30, 3), 60_000)).toBeCloseTo(333.33, 0)
  })
})

describe('splitsOf', () => {
  it('produces exact 1km splits by linear interpolation', () => {
    // 10 m/s for 200 s = 2000 m → two perfect 1km splits of 100 s each.
    const pts: GeoPoint[] = Array.from({ length: 201 }, (_, i) => ({
      lat: (i * 10) / M_PER_DEG,
      lng: 0,
      t: i * 1000,
      acc: 5,
    }))
    const splits = splitsOf(pts)
    expect(splits).toHaveLength(2)
    expect(splits[0]!.km).toBe(1)
    expect(splits[0]!.partial).toBe(false)
    expect(splits[0]!.sec).toBeCloseTo(100, 5)
    expect(splits[1]!.km).toBe(2)
    expect(splits[1]!.sec).toBeCloseTo(100, 5)
    expect(splits[1]!.partial).toBe(false)
  })

  it('interpolates the boundary mid-segment', () => {
    // 12 s per 100 m fix → crosses 1 km at t=120s and 2 km at t=240s
    const pts: GeoPoint[] = Array.from({ length: 21 }, (_, i) => ({
      lat: (i * 100) / M_PER_DEG,
      lng: 0,
      t: i * 12_000,
      acc: 5,
    }))
    const splits = splitsOf(pts)
    expect(splits).toHaveLength(2)
    expect(splits[0]!.sec).toBeCloseTo(120, 5)
    expect(splits[0]!.partial).toBe(false)
    expect(splits[1]!.sec).toBeCloseTo(120, 5)
    expect(splits[1]!.partial).toBe(false)
  })

  it('flags the trailing remainder as a partial split', () => {
    // 10 m/s for 250 s = 2500 m → two full km + 500 m partial.
    const pts: GeoPoint[] = Array.from({ length: 251 }, (_, i) => ({
      lat: (i * 10) / M_PER_DEG,
      lng: 0,
      t: i * 1000,
      acc: 5,
    }))
    const splits = splitsOf(pts)
    expect(splits).toHaveLength(3)
    expect(splits.map((s) => s.partial)).toEqual([false, false, true])
    expect(splits[2]!.km).toBe(3)
    expect(splits[2]!.sec).toBeCloseTo(50, 5)
  })

  it('returns [] for tiny runs', () => {
    expect(splitsOf(track(10, 3))).toEqual([])
  })
})

describe('paceSeriesSecPerKm', () => {
  it('samples constant pace across buckets', () => {
    // 10 m/s → every 100 m bucket is 10 s → 100 s/km.
    const pts: GeoPoint[] = Array.from({ length: 51 }, (_, i) => ({
      lat: (i * 10) / M_PER_DEG,
      lng: 0,
      t: i * 1000,
      acc: 5,
    }))
    const series = paceSeriesSecPerKm(pts, 100)
    expect(series).toHaveLength(5)
    for (const v of series) expect(v).toBeCloseTo(100, 5)
  })

  it('marks buckets spanning a dropout as null', () => {
    const pts: GeoPoint[] = []
    for (let i = 0; i <= 20; i++) {
      pts.push({ lat: (i * 10) / M_PER_DEG, lng: 0, t: i * 1000, acc: 5 })
    }
    // GPS comes back 60s later; position kept advancing.
    for (let i = 21; i <= 40; i++) {
      pts.push({
        lat: (i * 10) / M_PER_DEG,
        lng: 0,
        t: 20_000 + (i - 20) * 60_000 + i * 1000,
        acc: 5,
      })
    }
    const series = paceSeriesSecPerKm(pts, 100)
    expect(series.some((v) => v == null)).toBe(true)
    expect(series.filter((v) => v != null).length).toBeGreaterThan(0)
  })

  it('returns [] for tiny tracks', () => {
    expect(paceSeriesSecPerKm(track(3, 3), 100)).toEqual([])
  })
})

describe('bestEffortSec', () => {
  /** Piecewise track: consecutive segments at their own speeds (1 s fixes). */
  function piecewise(segs: { dist: number; speed: number }[]): GeoPoint[] {
    let d = 0
    let t = 0
    const pts: GeoPoint[] = [{ lat: 0, lng: 0, t: 0, acc: 5 }]
    for (const s of segs) {
      const steps = s.dist / s.speed
      for (let k = 1; k <= steps; k++) {
        d += s.speed
        t += 1000
        pts.push({ lat: d / M_PER_DEG, lng: 0, t, acc: 5 })
      }
    }
    return pts
  }

  it('finds the fastest window in a uniform track', () => {
    // 3 m/s everywhere → any exact 1000 m window takes 1000/3 s.
    expect(bestEffortSec(track(400, 3), 1000)).toBeCloseTo(1000 / 3, 5)
  })

  it('isolates a fast middle stretch', () => {
    const pts = piecewise([
      { dist: 500, speed: 2 },
      { dist: 1000, speed: 5 },
      { dist: 500, speed: 2 },
    ])
    // The 1000 m fast stretch is covered in exactly 200 s.
    expect(bestEffortSec(pts, 1000)).toBeCloseTo(200, 5)
    // Any 1500 m window drags in 500 m of slow running on top.
    expect(bestEffortSec(pts, 1500)).toBeCloseTo(450, 5)
  })

  it('handles two-point tracks with an interpolated start', () => {
    // Single 100 m / 50 s segment: a 90 m window starts 10 % in → 45 s.
    const pts: GeoPoint[] = [
      { lat: 0, lng: 0, t: 0, acc: 5 },
      { lat: 100 / M_PER_DEG, lng: 0, t: 50_000, acc: 5 },
    ]
    expect(bestEffortSec(pts, 90)).toBeCloseTo(45, 3)
    expect(bestEffortSec(pts, 500)).toBeNull()
  })

  it('returns null for sub-target and degenerate inputs', () => {
    expect(bestEffortSec(track(334, 3), 5000)).toBeNull() // 999 m total
    expect(bestEffortSec(track(10, 3), 0)).toBeNull()
    expect(bestEffortSec(track(10, 3), -5)).toBeNull()
    expect(bestEffortSec([], 100)).toBeNull()
    expect(bestEffortSec([track(5, 3)[0]!], 100)).toBeNull()
  })

  it('interpolates mid-segment window edges', () => {
    // 300 m at 2 m/s (150 s), then 600 m at 6 m/s (100 s): 900 m in 250 s.
    const pts = piecewise([
      { dist: 300, speed: 2 },
      { dist: 600, speed: 6 },
    ])
    // Fastest 700 m must start at the 200 m mark (t = 100 s) and run to
    // the finish — only that window fits, and its start falls mid-segment.
    expect(bestEffortSec(pts, 700)).toBeCloseTo(150, 5)
    // The full 900 m takes the whole run.
    expect(bestEffortSec(pts, 900)).toBeCloseTo(250, 5)
  })
})
