import { describe, expect, it } from 'vitest'
import type { GeoPoint } from './geo'
import { EARTH_RADIUS_M } from './geo'
import {
  avgPaceSecPerKm,
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
