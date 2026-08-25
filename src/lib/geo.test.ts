import { describe, expect, it } from 'vitest'
import {
  acceptPoint,
  boundsOf,
  EARTH_RADIUS_M,
  haversineM,
  pointDistanceM,
  toSvgPath,
  totalDistanceM,
  type GeoPoint,
} from './geo'

/** Exact meters per degree under our haversine model. */
const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180

const pt = (lat: number, lng: number, t = 0, acc = 5): GeoPoint => ({
  lat,
  lng,
  t,
  acc,
})

describe('haversineM', () => {
  it('one degree of latitude ≈ 111.19 km', () => {
    const d = haversineM(0, 0, 1, 0)
    expect(d).toBeCloseTo(111_195, -2)
  })

  it('one degree of longitude at the equator ≈ 111.19 km', () => {
    const d = haversineM(0, 0, 0, 1)
    expect(d).toBeCloseTo(111_195, -2)
  })

  it('zero distance for identical points', () => {
    expect(haversineM(52.1, 13.4, 52.1, 13.4)).toBe(0)
  })
})

describe('acceptPoint', () => {
  it('rejects fixes worse than the accuracy cutoff', () => {
    expect(acceptPoint(null, pt(0, 0, 0, 30), { accuracyCutoffM: 25 })).toBe(false)
    expect(acceptPoint(null, pt(0, 0, 0, 25), { accuracyCutoffM: 25 })).toBe(true)
  })

  it('rejects non-finite coordinates', () => {
    expect(acceptPoint(null, pt(Number.NaN, 0))).toBe(false)
  })

  it('requires min displacement after the anchor', () => {
    const a = pt(0, 0, 0)
    // ~0.00001 deg lat ≈ 1.1 m → below default 2 m
    expect(acceptPoint(a, pt(0.00001, 0, 1000))).toBe(false)
    // ~0.00005 deg lat ≈ 5.6 m → above
    expect(acceptPoint(a, pt(0.00005, 0, 1000))).toBe(true)
  })
})

describe('totalDistanceM', () => {
  it('sums segments of an open square path (3 × ~100 m)', () => {
    const dLat = 100 / M_PER_DEG
    const dLng = 100 / M_PER_DEG // equator → same scale
    const sq: GeoPoint[] = [
      pt(0, 0),
      pt(0, dLng),
      pt(dLat, dLng),
      pt(dLat, 0),
    ]
    expect(totalDistanceM(sq)).toBeCloseTo(300, -1)
  })

  it('empty path has zero distance', () => {
    expect(totalDistanceM([])).toBe(0)
  })
})

describe('boundsOf', () => {
  it('returns null for empty input and correct envelope otherwise', () => {
    expect(boundsOf([])).toBeNull()
    const b = boundsOf([pt(10, 20), pt(-5, 40)])
    expect(b).toEqual({ minLat: -5, maxLat: 10, minLng: 20, maxLng: 40 })
  })
})

describe('toSvgPath', () => {
  it('fits points inside the viewBox with padding', () => {
    const pts = [pt(0, 0), pt(0.001, 0.002)]
    const path = toSvgPath(pts, 300, 200, 16)
    expect(path).not.toBeNull()
    expect(path!.d.startsWith('M')).toBe(true)
    for (const v of [path!.startX, path!.endX]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(300)
    }
    for (const v of [path!.startY, path!.endY]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(200)
    }
  })

  it('handles collinear single-point paths', () => {
    const path = toSvgPath([pt(1, 1)], 100, 100)
    expect(path).not.toBeNull()
  })
})

describe('pointDistanceM vs haversine consistency', () => {
  it('matches direct computation', () => {
    const a = pt(52.52, 13.405)
    const b = pt(48.8566, 2.3522) // Berlin → Paris ≈ 878 km
    expect(pointDistanceM(a, b)).toBeCloseTo(haversineM(52.52, 13.405, 48.8566, 2.3522), 6)
    expect(pointDistanceM(a, b)).toBeGreaterThan(850_000)
    expect(pointDistanceM(a, b)).toBeLessThan(900_000)
  })
})
