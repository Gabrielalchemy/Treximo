// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { GeoPoint } from './geo'
import { totalDistanceM } from './geo'
import { buildGpx, gpxFileName, importGpxFiles, parseGpx } from './gpx'
import { db } from '../db/db'
import { EARTH_RADIUS_M } from './geo'

const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180

function samplePoints(): GeoPoint[] {
  return [
    { lat: 52.52, lng: 13.405, t: Date.UTC(2026, 7, 1, 6, 0, 0), acc: 4, elev: 42.5 },
    { lat: 52.5201, lng: 13.4052, t: Date.UTC(2026, 7, 1, 6, 0, 10), acc: 4, elev: 43.1 },
    { lat: 52.5202, lng: 13.4054, t: Date.UTC(2026, 7, 1, 6, 0, 20), acc: 4 },
  ]
}

describe('buildGpx', () => {
  it('produces valid GPX with trkpts in order', () => {
    const xml = buildGpx(samplePoints(), { name: 'Morning <Run> & Chill' })
    expect(xml).toContain('<gpx version="1.1"')
    expect(xml).toContain('lat="52.520000" lon="13.405000"')
    expect(xml).toContain('<ele>42.5</ele>')
    expect(xml).toContain('2026-08-01T06:00:00.000Z')
    // XML escaping
    expect(xml).toContain('Morning &lt;Run&gt; &amp; Chill')
    expect(xml.match(/<trkpt /g)).toHaveLength(3)
  })
})

describe('parseGpx', () => {
  it('round-trips coordinates and timestamps', () => {
    const src = samplePoints()
    const parsed = parseGpx(buildGpx(src))
    expect(parsed).not.toBeNull()
    expect(parsed!.points).toHaveLength(3)
    for (let i = 0; i < src.length; i++) {
      expect(parsed!.points[i]!.lat).toBeCloseTo(src[i]!.lat, 5)
      expect(parsed!.points[i]!.lng).toBeCloseTo(src[i]!.lng, 5)
      expect(parsed!.points[i]!.t).toBe(src[i]!.t)
    }
    expect(parsed!.name).toBe('Treximo Run')
  })

  it('returns null for garbage and for tracks without timestamps', () => {
    expect(parseGpx('this is not xml')).toBeNull()
    expect(parseGpx('<gpx><trkpt lat="1" lon="2"/></gpx>')).toBeNull()

    const noTime =
      '<gpx><trk><trkseg>' +
      '<trkpt lat="1" lon="2"/><trkpt lat="3" lon="4"/>' +
      '</trkseg></trk></gpx>'
    expect(parseGpx(noTime)).toBeNull()
  })

  it('skips individual bad points but keeps good ones', () => {
    const mixed =
      '<gpx><trk><trkseg>' +
      '<trkpt lat="nan" lon="2"><time>2026-08-01T06:00:00Z</time></trkpt>' +
      '<trkpt lat="52.5" lon="13.4"><time>2026-08-01T06:00:10Z</time></trkpt>' +
      '<trkpt lat="52.5001" lon="13.4002"><time>not-a-date</time></trkpt>' +
      '<trkpt lat="52.5002" lon="13.4004"><time>2026-08-01T06:00:20Z</time></trkpt>' +
      '</trkseg></trk></gpx>'
    const parsed = parseGpx(mixed)
    expect(parsed).not.toBeNull()
    expect(parsed!.points).toHaveLength(2)
  })

  it('preserves distance through a round-trip', () => {
    const pts: GeoPoint[] = Array.from({ length: 30 }, (_, i) => ({
      lat: (i * 10) / M_PER_DEG,
      lng: 0,
      t: Date.UTC(2026, 7, 1, 6) + i * 1000,
      acc: 5,
    }))
    const parsed = parseGpx(buildGpx(pts))!
    // buildGpx rounds to 6 decimals (~0.1 m), so allow generous tolerance.
    expect(Math.abs(totalDistanceM(parsed.points) - 290)).toBeLessThan(2)
  })
})

describe('gpxFileName', () => {
  it('formats the file name', () => {
    const ts = new Date(2026, 7, 25, 7, 30).getTime()
    expect(gpxFileName(ts)).toBe('treximo-20260825-0730.gpx')
  })
})

describe('importGpxFiles', () => {
  it('imports valid files into history and counts failures', async () => {
    const good = new File(
      [buildGpx(samplePoints())],
      'run.gpx',
      { type: 'application/gpx+xml' },
    )
    const bad = new File(['definitely not gpx'], 'bad.gpx', { type: 'application/gpx+xml' })

    const before = await db.runs.count()
    const res = await importGpxFiles([good, bad])
    expect(res).toEqual({ imported: 1, failed: 1 })

    const after = await db.runs.count()
    expect(after).toBe(before + 1)

    const stored = await db.runs.toArray()
    const importedRun = stored[stored.length - 1]!
    expect(importedRun.status).toBe('completed')
    expect(importedRun.distanceM).toBeGreaterThan(20)
    expect(importedRun.movingMs).toBeGreaterThan(15_000)
    await db.runs.delete(importedRun.id)
  })
})
