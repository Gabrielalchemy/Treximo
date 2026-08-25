export interface GeoPoint {
  lat: number
  lng: number
  /** altitude in meters, when available */
  elev?: number
  /** epoch ms */
  t: number
  /** horizontal accuracy radius in meters */
  acc: number
}

export interface Bounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/** Mean Earth radius (IUGG), meters */
export const EARTH_RADIUS_M = 6371008.8

const RAD = Math.PI / 180

/** Great-circle distance between two coordinates, meters. */
export function haversineM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = (bLat - aLat) * RAD
  const dLng = (bLng - aLng) * RAD
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s))
}

export function pointDistanceM(a: GeoPoint, b: GeoPoint): number {
  return haversineM(a.lat, a.lng, b.lat, b.lng)
}

export interface AcceptOptions {
  /** Reject fixes whose accuracy radius exceeds this (meters). */
  accuracyCutoffM?: number
  /** Require at least this much displacement from the previous kept point. */
  minStepM?: number
}

/**
 * Decide whether a fix is worth keeping. The very first fix is accepted purely
 * on accuracy so a session always gets an anchor point.
 */
export function acceptPoint(
  prev: GeoPoint | null,
  next: GeoPoint,
  opts: AcceptOptions = {},
): boolean {
  const cutoff = opts.accuracyCutoffM ?? 25
  const minStep = opts.minStepM ?? 2
  if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return false
  if (next.acc > cutoff) return false
  if (!prev) return true
  return pointDistanceM(prev, next) >= minStep
}

/** Sum of segment distances, meters. */
export function totalDistanceM(points: readonly GeoPoint[]): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) {
    sum += pointDistanceM(points[i - 1]!, points[i]!)
  }
  return sum
}

export function boundsOf(points: readonly GeoPoint[]): Bounds | null {
  if (points.length === 0) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  return { minLat, maxLat, minLng, maxLng }
}

export interface SvgPath {
  d: string
  startX: number
  startY: number
  endX: number
  endY: number
}

/**
 * Project points onto an equirectangular plane (local tangent approximation:
 * longitude is scaled by cos(mean latitude)) and fit into a viewBox.
 */
export function toSvgPath(
  points: readonly GeoPoint[],
  width: number,
  height: number,
  pad = 16,
): SvgPath | null {
  if (points.length === 0) return null

  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const kx = Math.cos(meanLat * RAD)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const xs: number[] = []
  const ys: number[] = []
  for (const p of points) {
    const x = p.lng * kx
    const y = p.lat
    xs.push(x)
    ys.push(y)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const scale = Math.min(innerW / spanX, innerH / spanY)

  // Center the smaller axis within its padding box.
  const offX = (width - spanX * scale) / 2
  const offY = (height - spanY * scale) / 2

  let d = ''
  for (let i = 0; i < points.length; i++) {
    const px = offX + (xs[i]! - minX) * scale
    const py = offY + (maxY - ys[i]!) * scale // screen y grows downward
    d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`
  }

  const endIdx = points.length - 1
  const ex = offX + (xs[endIdx]! - minX) * scale
  const ey = offY + (maxY - ys[endIdx]!) * scale
  const sx = offX + (xs[0]! - minX) * scale
  const sy = offY + (maxY - ys[0]!) * scale

  return { d, startX: sx, startY: sy, endX: ex, endY: ey }
}
