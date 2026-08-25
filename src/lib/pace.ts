import type { GeoPoint } from './geo'
import { pointDistanceM } from './geo'

/** "1:02:03" for >= 1h, otherwise "MM:SS". */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Distance as kilometers with fixed decimals. */
export function formatKm(meters: number, decimals = 2): string {
  return (meters / 1000).toFixed(decimals)
}

/** Pace string like "5:42" from seconds-per-km; null-safe. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '--:--'
  const sec = Math.round(secPerKm)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) {
    const ss = String(s).padStart(2, '0')
    const rest = String(m).padStart(2, '0')
    return `${h}:${rest}:${ss}`
  }
  const ss = String(s).padStart(2, '0')
  return `${m}:${ss}`
}

export function avgPaceSecPerKm(
  distanceM: number,
  movingMs: number,
): number | null {
  if (distanceM < 5 || movingMs <= 0) return null
  return movingMs / 1000 / (distanceM / 1000)
}

/**
 * Current pace over a trailing time window of recorded points.
 * Returns seconds per km, or null when there isn't enough movement
 * to trust the number (stationary or just-started).
 */
export function rollingPaceSecPerKm(
  points: readonly GeoPoint[],
  trailingMs = 20_000,
  minDistM = 10,
): number | null {
  if (points.length < 2) return null

  let i = points.length - 1
  const lastT = points[i]!.t
  while (i > 0 && lastT - points[i - 1]!.t <= trailingMs) i--

  // Need at least two fixes inside the window.
  if (points.length - i < 2) {
    i = points.length - 2
  }

  let dist = 0
  for (let j = i + 1; j < points.length; j++) {
    dist += pointDistanceM(points[j - 1]!, points[j]!)
  }
  const durMs = lastT - points[i]!.t
  if (durMs <= 0 || dist < minDistM) return null
  return durMs / 1000 / (dist / 1000)
}

export interface Split {
  /** 1-based kilometer/mile index */
  km: number
  /** seconds taken for this interval */
  sec: number
  /** true when this is the trailing, not-quite-full interval */
  partial: boolean
}

/**
 * Epoch-ms timestamps where cumulative distance crosses each multiple of
 * `intervalM`, interpolating linearly between fixes. The workhorse behind
 * splits and the pace series.
 */
function boundaryCrossingTimes(
  points: readonly GeoPoint[],
  intervalM: number,
): number[] {
  if (points.length < 2) return []
  const times: number[] = []

  let acc = 0 // absolute cumulative distance at points[i]
  let nextAt = intervalM

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const seg = pointDistanceM(a, b)
    if (seg === 0) continue

    const start = acc
    const end = acc + seg
    // Sub-millimeter epsilon: a boundary that falls exactly on a fix must
    // still register despite accumulated floating-point drift.
    const EPS_M = 1e-6
    while (nextAt <= end + EPS_M) {
      const ratio = Math.min(1, Math.max(0, (nextAt - start) / seg))
      times.push(a.t + (b.t - a.t) * ratio)
      nextAt += intervalM
    }
    acc = end
  }
  return times
}

/**
 * Per-distance splits by walking cumulative distance and interpolating
 * timestamps across segments that straddle boundaries. A meaningful trailing
 * remainder is returned flagged as partial.
 */
export function splitsOf(
  points: readonly GeoPoint[],
  splitLenM = 1000,
  minFinalM = 50,
): Split[] {
  if (points.length < 2) return []

  const startT = points[0]!.t
  const endT = points[points.length - 1]!.t
  const times = boundaryCrossingTimes(points, splitLenM)

  const splits: Split[] = times.map((t, i) => ({
    km: i + 1,
    sec: (t - (i === 0 ? startT : times[i - 1]!)) / 1000,
    partial: false,
  }))

  const lastBoundaryT = times.length > 0 ? times[times.length - 1]! : startT
  const doneM = times.length * splitLenM
  let totalM = 0
  for (let i = 1; i < points.length; i++) {
    totalM += pointDistanceM(points[i - 1]!, points[i]!)
  }
  const tailSec = (endT - lastBoundaryT) / 1000

  if (times.length === 0) return []

  if (totalM - doneM >= minFinalM && tailSec > 0) {
    splits.push({ km: times.length + 1, sec: tailSec, partial: true })
  }
  return splits
}

/**
 * Pace sampled every `bucketM` of distance: seconds-per-km per bucket, or
 * null for buckets spanning a dropout/gap (chart connects across them).
 */
export function paceSeriesSecPerKm(
  points: readonly GeoPoint[],
  bucketM = 100,
  maxBucketMs = 30_000,
): (number | null)[] {
  if (points.length < 2) return []

  const times = boundaryCrossingTimes(points, bucketM)
  const edges = [points[0]!.t, ...times]

  return times.map((t, i) => {
    const durMs = t - edges[i]!
    if (durMs <= 0 || durMs > maxBucketMs) return null
    return durMs / 1000 / (bucketM / 1000)
  })
}
