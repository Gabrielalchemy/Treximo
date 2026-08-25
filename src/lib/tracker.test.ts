import { describe, expect, it, vi } from 'vitest'
import { EARTH_RADIUS_M } from './geo'
import { TrackingEngine, type GeoWatch, type RawFix } from './tracker'

/** Exact meters per degree of latitude under our haversine model. */
const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180

/** Fake GPS: returns a watch whose fixes are driven manually. */
function fakeWatch() {
  let onFix: (f: RawFix) => void = () => {}
  const watch: GeoWatch = (cb) => {
    onFix = cb
    return () => {
      /* unsubscribed */
    }
  }
  const emit = (f: Partial<RawFix> & { lat: number; lng: number; t: number }) =>
    onFix({ acc: 5, ...f })
  return { watch, emit }
}

const M_PER_SEC = 3 // walking-ish pace for synthetic northward movement
const LAT_STEP = M_PER_SEC / M_PER_DEG

function movingFix(n: number, tMs: number): RawFix {
  return { lat: n * LAT_STEP, lng: 0, t: tMs, acc: 5 }
}

describe('TrackingEngine', () => {
  it('idle → acquiring → recording on the first accepted fix', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch)
    expect(e.snapshot.status).toBe('idle')

    e.start()
    expect(e.snapshot.status).toBe('acquiring')

    emit({ lat: 0, lng: 0, t: 1000 })
    expect(e.snapshot.status).toBe('recording')
    expect(e.snapshot.points).toHaveLength(1)
    expect(e.snapshot.startedAt).toBe(1000)
  })

  it('rejects low-accuracy and micro-displacement fixes', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch)
    e.start()

    emit({ lat: 0, lng: 0, t: 0 }) // anchor
    expect(e.snapshot.points).toHaveLength(1)

    emit({ lat: 0, lng: 0, t: 1000, acc: 99 }) // bad accuracy
    expect(e.snapshot.points).toHaveLength(1)

    emit({ lat: LAT_STEP / 4, lng: 0, t: 2000 }) // ~0.75 m jitter
    expect(e.snapshot.points).toHaveLength(1)
  })

  it('accrues distance and moving time only while recording', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch)
    e.start()

    for (let i = 1; i <= 10; i++) emit(movingFix(i, i * 1000))
    // 9 segments × 3 m = 27 m, 9 s moving
    expect(e.snapshot.distanceM).toBeCloseTo(27, 5)
    expect(e.snapshot.movingMs).toBe(9000)

    e.pause()
    expect(e.snapshot.status).toBe('paused')
    for (let i = 11; i <= 20; i++) emit(movingFix(i, i * 1000))
    expect(e.snapshot.distanceM).toBeCloseTo(27, 5)
    expect(e.snapshot.movingMs).toBe(9000)
    expect(e.snapshot.points).toHaveLength(10) // paused fixes dropped

    e.resume()
    for (let i = 21; i <= 25; i++) emit(movingFix(i, i * 1000))
    // resume re-anchors at fix #21; only segments 21→25 count
    expect(e.snapshot.distanceM).toBeCloseTo(27 + 4 * 3, 5)
    expect(e.snapshot.movingMs).toBe(9000 + 4000)
  })

  it('does not bridge across a pause gap', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch)
    e.start()
    emit({ lat: 0, lng: 0, t: 0 })
    emit({ lat: LAT_STEP, lng: 0, t: 1000 })
    e.pause()
    e.resume()
    // fix arrives 60s later — must not credit 60s or the long segment
    emit({ lat: 2 * LAT_STEP, lng: 0, t: 61_000 })
    expect(e.snapshot.movingMs).toBeLessThanOrEqual(30_000)
    expect(e.snapshot.points).toHaveLength(3)
  })

  it('stop() returns the run result, unsubscribes and resets to idle', () => {
    const onUnsub = vi.fn()
    let onFix: (f: RawFix) => void = () => {}
    const e = new TrackingEngine((cb) => {
      onFix = cb
      return onUnsub
    })
    e.start()
    onFix({ lat: 0, lng: 0, t: 0, acc: 5 })
    const res = e.stop()
    expect(res).not.toBeNull()
    expect(res!.distanceM).toBe(0)
    expect(onUnsub).toHaveBeenCalledOnce()
    expect(e.snapshot.status).toBe('idle')
    expect(e.stop()).toBeNull() // already idle
  })

  it('stop() before start is a no-op returning null', () => {
    const { watch } = fakeWatch()
    const e = new TrackingEngine(watch)
    expect(e.stop()).toBeNull()
    expect(e.snapshot.status).toBe('idle')
  })

  it('notifies subscribers on state changes', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch)
    const spy = vi.fn()
    e.subscribe(spy)
    e.start()
    emit({ lat: 0, lng: 0, t: 0 })
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('hydrate() restores a session after reload', () => {
    const { watch } = fakeWatch()
    const e = new TrackingEngine(watch)
    const pts = [movingFix(0, 0), movingFix(1, 1000)].map((f) => ({
      lat: f.lat,
      lng: f.lng,
      t: f.t,
      acc: f.acc,
    }))
    e.hydrate(pts, 5000, 'paused', 0)
    expect(e.snapshot.status).toBe('paused')
    expect(e.snapshot.distanceM).toBeCloseTo(3, 5)
    expect(e.snapshot.movingMs).toBe(5000)
    // hydrate ignored when not idle
    e.hydrate(pts, 1, 'recording', 0)
    expect(e.snapshot.movingMs).toBe(5000)
  })

  it('reports tracker errors through callback', () => {
    let onError: ((e: { code: number }) => void) | undefined
    const watch: GeoWatch = (_fix, err) => {
      onError = err as unknown as typeof onError
      return () => {}
    }
    const e = new TrackingEngine(watch)
    const seen: number[] = []
    e.onTrackerError((err) => seen.push(err.code))
    e.start()
    onError?.({ code: 1 })
    expect(seen).toContain(1)
  })

  it('auto-pauses on sustained stillness and auto-resumes on movement', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch, { isAutoPauseEnabled: () => true })
    e.start()

    // Run at 3 m/s for 6 seconds — clearly moving, no pause.
    for (let i = 1; i <= 6; i++) emit(movingFix(i, i * 1000))
    expect(e.snapshot.status).toBe('recording')
    expect(e.snapshot.autoPaused).toBe(false)

    // Stand still: same-position fixes every second (rejected by min-step,
    // but they must still feed the stillness detector).
    const stillLat = 6 * LAT_STEP
    for (let s = 7; s <= 13; s++) emit({ lat: stillLat, lng: 0, t: s * 1000 })
    expect(e.snapshot.status).toBe('paused')
    expect(e.snapshot.autoPaused).toBe(true)

    // Walk away: 3 m steps each second → sustained motion resumes the run.
    let resumed = false
    for (let m = 14; m <= 20 && !resumed; m++) {
      emit({ lat: stillLat + (m - 13) * LAT_STEP, lng: 0, t: m * 1000 })
      resumed = e.snapshot.status === 'recording'
    }
    expect(resumed).toBe(true)
    expect(e.snapshot.autoPaused).toBe(false)
    // The resume fix re-anchors: no phantom distance across the pause.
    expect(e.snapshot.movingMs).toBeLessThanOrEqual(5000 + 30_000)
  })

  it('manual pauses never auto-resume', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch, { isAutoPauseEnabled: () => true })
    e.start()
    for (let i = 1; i <= 4; i++) emit(movingFix(i, i * 1000))

    e.pause()
    expect(e.snapshot.status).toBe('paused')
    expect(e.snapshot.autoPaused).toBe(false)

    for (let i = 5; i <= 12; i++) emit(movingFix(i, i * 1000))
    expect(e.snapshot.status).toBe('paused')
  })

  it('auto-pause disabled leaves recording untouched during stillness', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch, { isAutoPauseEnabled: () => false })
    e.start()
    emit({ lat: 0, lng: 0, t: 0 })
    for (let s = 1; s <= 10; s++) emit({ lat: 0, lng: 0, t: s * 1000 })
    expect(e.snapshot.status).toBe('recording')
  })
})
