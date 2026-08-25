import type { GeoPoint } from './geo'
import { totalDistanceM } from './geo'
import { db, newRunId } from '../db/db'

const GPX_TYPE = 'application/gpx+xml'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Serialize a track to GPX 1.1. Coordinates are rounded to ~0.1 m. */
export function buildGpx(
  points: readonly GeoPoint[],
  opts: { name?: string } = {},
): string {
  const rows = points
    .map((p) => {
      const ele =
        p.elev != null ? `<ele>${p.elev.toFixed(1)}</ele>` : ''
      return (
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">` +
        ele +
        `<time>${new Date(p.t).toISOString()}</time></trkpt>`
      )
    })
    .join('\n')

  const name = esc(opts.name ?? 'Treximo Run')
  const metaTime =
    points.length > 0 ? new Date(points[0]!.t).toISOString() : new Date().toISOString()

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Treximo" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><time>${metaTime}</time></metadata>`,
    '  <trk>',
    `    <name>${name}</name>`,
    '    <trkseg>',
    rows,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n')
}

export interface ParsedGpx {
  points: GeoPoint[]
  name?: string
}

/**
 * Parse a GPX track. Points without valid coordinates or timestamps are
 * skipped; returns null when fewer than two usable points remain.
 */
export function parseGpx(xml: string): ParsedGpx | null {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml')
  } catch {
    return null
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return null

  const nameEl = doc.getElementsByTagName('name')[0]
  const name = nameEl?.textContent ?? undefined

  const points: GeoPoint[] = []
  const trkpts = doc.getElementsByTagName('trkpt')
  for (let i = 0; i < trkpts.length; i++) {
    const el = trkpts[i]!
    const lat = Number.parseFloat(el.getAttribute('lat') ?? '')
    const lng = Number.parseFloat(el.getAttribute('lon') ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const timeText = el.getElementsByTagName('time')[0]?.textContent?.trim()
    const t = timeText ? Date.parse(timeText) : Number.NaN
    if (!Number.isFinite(t)) continue

    const eleText = el.getElementsByTagName('ele')[0]?.textContent
    const elev = eleText != null ? Number.parseFloat(eleText) : Number.NaN

    points.push({
      lat,
      lng,
      t,
      acc: 0,
      ...(Number.isFinite(elev) ? { elev } : {}),
    })
  }

  if (points.length < 2) return null

  // Timestamps must be monotonically non-decreasing; drop violators.
  const sorted = points.filter((p, i) => i === 0 || p.t >= points[i - 1]!.t)
  if (sorted.length < 2) return null

  return { points: sorted, name }
}

/** "treximo-20260825-0730.gpx" */
export function gpxFileName(startedAt: number): string {
  const d = new Date(startedAt)
  const p = (n: number) => String(n).padStart(2, '0')
  return `treximo-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.gpx`
}

/**
 * Share via the native sheet when possible (mobile), otherwise trigger a
 * classic file download.
 */
export async function exportRunGpx(run: {
  points: readonly GeoPoint[]
  startedAt: number
}): Promise<'shared' | 'downloaded'> {
  const fileName = gpxFileName(run.startedAt)
  const xml = buildGpx(run.points, { name: `Treximo Run — ${fileName}` })

  const file = new File([xml], fileName, { type: GPX_TYPE })
  const canShare =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShare) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'shared'
    } catch (err) {
      // User cancelled or the sheet failed — fall through to download,
      // unless it was an explicit cancel we should respect quietly.
      if ((err as DOMException)?.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(new Blob([xml], { type: GPX_TYPE }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
  return 'downloaded'
}

export interface ImportResult {
  imported: number
  failed: number
}

/** Moving time using the same dropout rule as live tracking (30 s cap). */
function movingTimeMs(points: readonly GeoPoint[], maxSegmentMs = 30_000): number {
  let ms = 0
  for (let i = 1; i < points.length; i++) {
    const dt = points[i]!.t - points[i - 1]!.t
    if (dt > 0 && dt <= maxSegmentMs) ms += dt
  }
  return ms
}

/** Parse and persist GPX files into history. Never throws per-file. */
export async function importGpxFiles(files: File[]): Promise<ImportResult> {
  let imported = 0
  let failed = 0

  for (const file of files) {
    try {
      const parsed = parseGpx(await file.text())
      if (!parsed) {
        failed++
        continue
      }
      const pts = parsed.points
      await db.runs.add({
        id: newRunId(),
        status: 'completed',
        startedAt: pts[0]!.t,
        endedAt: pts[pts.length - 1]!.t,
        distanceM: totalDistanceM(pts),
        movingMs: movingTimeMs(pts),
        points: pts,
      })
      imported++
    } catch {
      failed++
    }
  }
  return { imported, failed }
}
