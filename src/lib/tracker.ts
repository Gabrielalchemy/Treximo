import { haversineM, pointDistanceM, totalDistanceM, type GeoPoint } from './geo'
import { avgPaceSecPerKm, rollingPaceSecPerKm } from './pace'

export type TrackerStatus = 'idle' | 'acquiring' | 'recording' | 'paused'

export interface TrackerSnapshot {
  status: TrackerStatus
  /** true when the current pause was triggered by auto-pause */
  autoPaused: boolean
  points: readonly GeoPoint[]
  distanceM: number
  movingMs: number
  startedAt: number | null
  /** accuracy of the most recent fix (meters), null before first lock */
  accuracyM: number | null
  /** epoch ms of the most recent fix */
  lastFixT: number | null
}

export interface RawFix {
  lat: number
  lng: number
  acc: number
  t: number
  elev?: number | null
}

export interface TrackerOptions {
  accuracyCutoffM?: number
  minStepM?: number
  /**
   * Segments longer than this are treated as signal dropout: neither time nor
   * distance is accrued across them.
   */
  maxSegmentMs?: number
  /** Live toggle consulted on every fix (lets settings apply mid-run). */
  isAutoPauseEnabled?: () => boolean
  /** Below this net speed (m/s) the runner counts as stopped. */
  autoPauseBelowMps?: number
  /** Above this speed (m/s) the runner counts as moving again. */
  autoResumeAboveMps?: number
  /** Stopped this long before we auto-pause. */
  autoPauseAfterMs?: number
  /** Moving this long before we auto-resume (jitter guard). */
  autoResumeAfterMs?: number
}

/** Injectable replacement for navigator.geolocation.watchPosition. */
export type GeoWatch = (
  onFix: (fix: RawFix) => void,
  onError: (err: GeolocationPositionError) => void,
) => () => void

const DEFAULTS = {
  accuracyCutoffM: 25,
  minStepM: 2,
  maxSegmentMs: 30_000,
  autoPauseBelowMps: 0.5,
  autoResumeAboveMps: 0.8,
  autoPauseAfterMs: 5_000,
  autoResumeAfterMs: 2_500,
} as const

export function browserGeoWatch(): GeoWatch {
  return (onFix, onError) => {
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        onFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
          t: pos.timestamp,
          elev: pos.coords.altitude,
        })
      },
      onError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }
}

export interface RunResult {
  points: readonly GeoPoint[]
  distanceM: number
  movingMs: number
  startedAt: number
  endedAt: number
}

type Listener = () => void

/** Minimal structural type so tests can inject plain objects. */
export interface TrackerError {
  code: number
}

function asPoint(f: RawFix): GeoPoint {
  return {
    lat: f.lat,
    lng: f.lng,
    t: f.t,
    acc: f.acc,
    ...(f.elev != null ? { elev: f.elev } : {}),
  }
}

/**
 * Recording state machine:
 *   idle → acquiring → recording ⇄ paused → idle
 * Auto-pause flips recording→paused automatically when net displacement over
 * a sustained window says the runner stopped, and resumes on sustained
 * movement. Manual pauses never auto-resume.
 *
 * Speed judgments use NET displacement over time windows — not summed
 * segments — so standing GPS jitter can't masquerade as movement.
 */
export class TrackingEngine {
  private opts: Required<Omit<TrackerOptions, 'isAutoPauseEnabled'>> & {
    isAutoPauseEnabled: () => boolean
  }
  private watch: GeoWatch

  private listeners = new Set<Listener>()
  private snap: TrackerSnapshot
  /** Last point added to the track; anchor for distance/time accrual. */
  private anchor: GeoPoint | null = null
  /** Most recent accuracy-passing fix, regardless of other filters/state. */
  private lastGoodFix: GeoPoint | null = null
  private stopWatch: (() => void) | null = null
  private errorCb: ((err: TrackerError) => void) | null = null

  // Auto-pause bookkeeping
  private slowRef: { pos: GeoPoint; t: number } | null = null
  private fastRef: { pos: GeoPoint; t: number } | null = null

  constructor(watch: GeoWatch, options: TrackerOptions = {}) {
    this.watch = watch
    this.opts = {
      ...DEFAULTS,
      ...options,
      isAutoPauseEnabled: options.isAutoPauseEnabled ?? (() => false),
    }
    this.snap = {
      status: 'idle',
      autoPaused: false,
      points: [],
      distanceM: 0,
      movingMs: 0,
      startedAt: null,
      accuracyM: null,
      lastFixT: null,
    }
  }

  get snapshot(): TrackerSnapshot {
    return this.snap
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onTrackerError(cb: (err: TrackerError) => void): void {
    this.errorCb = cb
  }

  start(): void {
    if (this.snap.status !== 'idle') return
    this.set({ status: 'acquiring', autoPaused: false })
    this.stopWatch = this.watch(
      (fix) => this.handleFix(fix),
      (err) => this.errorCb?.(err),
    )
  }

  pause(): void {
    if (this.snap.status !== 'recording') return
    this.anchor = null
    this.slowRef = null
    this.fastRef = null
    this.set({ status: 'paused', autoPaused: false })
  }

  resume(): void {
    if (this.snap.status !== 'paused') return
    this.anchor = null
    this.slowRef = null
    this.fastRef = null
    this.set({ status: 'recording', autoPaused: false })
  }

  stop(): RunResult | null {
    const s = this.snap
    if (s.status !== 'recording' && s.status !== 'paused') return null
    this.stopWatch?.()
    this.stopWatch = null
    const result: RunResult = {
      points: s.points,
      distanceM: s.distanceM,
      movingMs: s.movingMs,
      startedAt: s.startedAt ?? Date.now(),
      endedAt: Date.now(),
    }
    this.reset()
    return result
  }

  discard(): void {
    this.stopWatch?.()
    this.stopWatch = null
    this.reset()
  }

  /** Restore an in-flight session (e.g. after page reload). */
  hydrate(
    points: readonly GeoPoint[],
    movingMs: number,
    status: TrackerStatus,
    startedAt: number,
    autoPaused = false,
  ): void {
    if (this.snap.status !== 'idle') return
    const last = points.length > 0 ? points[points.length - 1]! : null
    this.anchor = last
    this.lastGoodFix = last
    this.set({
      points: [...points],
      movingMs,
      distanceM: totalDistanceM(points),
      startedAt,
      status,
      autoPaused: status === 'paused' ? autoPaused : false,
      accuracyM: last?.acc ?? null,
      lastFixT: last?.t ?? null,
    })
  }

  /**
   * Re-subscribe the geolocation stream after hydrate() — used when an
   * in-flight session is restored from IndexedDB following a page reload.
   */
  reattach(): void {
    const s = this.snap
    if ((s.status !== 'recording' && s.status !== 'paused') || this.stopWatch) return
    this.stopWatch = this.watch(
      (fix) => this.handleFix(fix),
      (err) => this.errorCb?.(err),
    )
  }

  private handleFix(fix: RawFix): void {
    const accuracyM = fix.acc
    let status = this.snap.status

    // Accuracy gate applies everywhere.
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || fix.acc > this.opts.accuracyCutoffM) {
      this.set({ accuracyM })
      return
    }

    const pt = asPoint(fix)

    // ── Paused: only auto-resume can leave this state ────────────────────
    if (status === 'paused') {
      const prev = this.lastGoodFix
      this.lastGoodFix = pt
      if (
        this.snap.autoPaused &&
        this.opts.isAutoPauseEnabled() &&
        prev != null &&
        this.considerMotion(prev, pt)
      ) {
        this.anchor = null
        this.slowRef = null
        this.fastRef = null
        status = 'recording'
        // fall through — this fix becomes the fresh track anchor
      } else {
        this.set({ accuracyM })
        return
      }
    }

    if (status === 'acquiring') {
      this.anchor = pt
      this.lastGoodFix = pt
      this.commit({
        ...this.snap,
        status: 'recording',
        autoPaused: false,
        points: [pt],
        accuracyM,
        lastFixT: pt.t,
        startedAt: pt.t,
      })
      return
    }

    // ── Recording ────────────────────────────────────────────────────────
    const stepM = this.anchor ? pointDistanceM(this.anchor, pt) : Infinity

    if (stepM < this.opts.minStepM) {
      // Too close to the previous track point to add — but it's evidence of
      // standing still, which is exactly what auto-pause listens for.
      this.lastGoodFix = pt
      if (this.opts.isAutoPauseEnabled() && this.considerStillness(pt)) {
        this.anchor = null
        this.slowRef = null
        this.fastRef = null
        this.set({ status: 'paused', autoPaused: true, accuracyM })
        return
      }
      this.set({ accuracyM })
      return
    }

    let dM = this.snap.distanceM
    let ms = this.snap.movingMs
    if (this.anchor) {
      const dt = pt.t - this.anchor.t
      if (dt > 0 && dt <= this.opts.maxSegmentMs) {
        ms += dt
        dM += stepM
      }
      // else: dropout — re-anchor without crediting the gap
    }
    this.anchor = pt
    this.lastGoodFix = pt

    const next: TrackerSnapshot = {
      ...this.snap,
      status: 'recording',
      autoPaused: false,
      points: [...this.snap.points, pt],
      distanceM: dM,
      movingMs: ms,
      accuracyM,
      lastFixT: pt.t,
      startedAt: this.snap.startedAt ?? pt.t,
    }

    if (this.opts.isAutoPauseEnabled() && this.considerStillness(pt)) {
      this.anchor = null
      this.slowRef = null
      this.fastRef = null
      next.status = 'paused'
      next.autoPaused = true
    }

    this.commit(next)
  }

  /**
   * Sustained-stillness detector fed by every accuracy-passing fix (added to
   * the track or not). Uses net displacement from where the slow streak began.
   * Returns true when the runner has been effectively stopped for long enough.
   */
  private considerStillness(pt: GeoPoint): boolean {
    if (this.slowRef == null) {
      this.slowRef = { pos: pt, t: pt.t }
      return false
    }

    const dtMs = pt.t - this.slowRef.t
    if (dtMs <= 0) return false
    const netM = haversineM(this.slowRef.pos.lat, this.slowRef.pos.lng, pt.lat, pt.lng)
    const netMps = netM / (dtMs / 1000)

    if (netMps < this.opts.autoPauseBelowMps) {
      return dtMs >= this.opts.autoPauseAfterMs
    }
    if (netMps > this.opts.autoResumeAboveMps) {
      // Clearly moving again — restart the stillness clock.
      this.slowRef = { pos: pt, t: pt.t }
    }
    // Hysteresis middle zone: keep watching from the original reference.
    return false
  }

  /**
   * Jitter-guarded movement detector while auto-paused: requires sustained
   * per-fix speed above the resume threshold AND net displacement from where
   * the fast streak began — standing noise can't fake a resume.
   */
  private considerMotion(prev: GeoPoint, pt: GeoPoint): boolean {
    const dt = (pt.t - prev.t) / 1000
    const movingFast =
      dt > 0 && dt < this.opts.maxSegmentMs / 1000 &&
      pointDistanceM(prev, pt) / dt > this.opts.autoResumeAboveMps

    if (!movingFast) {
      this.fastRef = null
      return false
    }

    this.fastRef ??= { pos: pt, t: pt.t }
    const netM = haversineM(this.fastRef.pos.lat, this.fastRef.pos.lng, pt.lat, pt.lng)
    return pt.t - this.fastRef.t >= this.opts.autoResumeAfterMs && netM >= 4
  }

  private reset(): void {
    this.anchor = null
    this.lastGoodFix = null
    this.slowRef = null
    this.fastRef = null
    this.set({
      status: 'idle',
      autoPaused: false,
      points: [],
      distanceM: 0,
      movingMs: 0,
      startedAt: null,
      accuracyM: null,
      lastFixT: null,
    })
  }

  /** Replace the snapshot and notify subscribers. */
  private set(patch: Partial<TrackerSnapshot>): void {
    this.commit({ ...this.snap, ...patch })
  }

  private commit(next: TrackerSnapshot): void {
    this.snap = next
    for (const l of this.listeners) l()
  }
}

/** Live pace + derived values computed from a snapshot on demand. */
export function currentPaceOf(s: TrackerSnapshot): number | null {
  return rollingPaceSecPerKm(s.points)
}

export function avgPaceOf(s: TrackerSnapshot): number | null {
  return avgPaceSecPerKm(s.distanceM, s.movingMs)
}

export function geoErrorMessage(err: GeolocationPositionError | { code: number }): string {
  // Numeric codes mirror GeolocationPositionError's constants.
  switch (err.code) {
    case 1: // PERMISSION_DENIED
      return 'Location permission denied'
    case 2: // POSITION_UNAVAILABLE
      return 'Location unavailable'
    case 3: // TIMEOUT
      return 'Waiting for GPS…'
    default:
      return 'GPS error'
  }
}
