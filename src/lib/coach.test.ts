import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_M } from './geo'
import { TrackingEngine, type GeoWatch, type RawFix } from './tracker'
import {
  coachUpdate,
  cueText,
  initialCoachState,
  initCoach,
  type CoachState,
} from './coach'
import type { RunGoal } from './goals'
import { useSettings } from '../state/settings'

const KM = 1000

const NO_GOAL: RunGoal = { kind: 'none' }

function advance(
  st: CoachState,
  distanceM: number,
  movingMs = 0,
  opts?: Partial<{ splitLenM: number; goal: RunGoal }>,
) {
  return coachUpdate(st, { distanceM, movingMs }, {
    splitLenM: KM,
    goal: NO_GOAL,
    ...opts,
  })
}

describe('coachUpdate — splits', () => {
  it('announces each full split exactly once', () => {
    let st = initialCoachState()

    st = advance(st, 999).state
    expect(advance(st, 999).cues).toEqual([])

    const crossed = advance(st, 1001)
    expect(crossed.cues).toEqual([{ kind: 'split', idx: 1 }])
    st = crossed.state

    // Same split again → silent.
    expect(advance(st, 1200).cues).toEqual([])
    // Next boundary → one more cue.
    expect(advance(st, 2005).cues).toEqual([{ kind: 'split', idx: 2 }])
  })

  it('collapses a jump across several boundaries into a single cue', () => {
    const { state, cues } = advance(initialCoachState(), 2500)
    expect(cues).toEqual([{ kind: 'split', idx: 2 }])
    expect(state.splitIdx).toBe(2)
  })

  it('honours imperial mile boundaries', () => {
    const { cues } = advance(initialCoachState(), 1610, 0, {
      splitLenM: 1609.344,
    })
    expect(cues).toEqual([{ kind: 'split', idx: 1 }])
  })
})

describe('coachUpdate — goals', () => {
  it('fires halfway once, then the hit once (duration goal)', () => {
    const goal: RunGoal = { kind: 'duration', targetMs: 60 * 60_000 }
    let st = initialCoachState()

    st = advance(st, 10, 29 * 60_000, { goal }).state
    expect(st.halfAnnounced).toBe(false)

    const half = advance(st, 10, 30 * 60_000, { goal })
    expect(half.cues).toEqual([
      { kind: 'halfway', remainingMs: 30 * 60_000 },
    ])
    st = half.state
    expect(advance(st, 10, 35 * 60_000, { goal }).cues).toEqual([])

    const hit = advance(st, 10, 61 * 60_000, { goal })
    expect(hit.cues).toEqual([{ kind: 'goal-hit' }])
    expect(advance(hit.state, 10, 70 * 60_000, { goal }).cues).toEqual([])
  })

  it('suppresses halfway once the goal is already hit', () => {
    const goal: RunGoal = { kind: 'distance', targetM: 400 }
    let st = initialCoachState()
    st = advance(st, 500, 0, { goal }).state // instant hit, no halfway
    expect(st.announcedHit).toBe(true)
    expect(st.halfAnnounced).toBe(false)
  })

  it('can emit split + goal cue on the same tick, split first', () => {
    const goal: RunGoal = { kind: 'distance', targetM: 3000 }
    const { cues } = advance(initialCoachState(), 3001, 0, { goal })
    expect(cues).toEqual([{ kind: 'split', idx: 3 }, { kind: 'goal-hit' }])
  })

  it('never emits goal cues without a goal', () => {
    let st = initialCoachState()
    st = advance(st, 5500, 600_000).state
    expect(st.announcedHit).toBe(false)
    expect(st.halfAnnounced).toBe(false)
  })
})

describe('cueText', () => {
  it('phrases metric splits with pace', () => {
    expect(
      cueText({ kind: 'split', idx: 2 }, { units: 'metric', splitSec: 342 }),
    ).toBe('Kilometre 2. 5:42.')
  })

  it('does not double-convert imperial split paces', () => {
    // splitSec is already seconds-per-mile here.
    expect(
      cueText({ kind: 'split', idx: 1 }, { units: 'imperial', splitSec: 1500 }),
    ).toBe('Mile 1. 25:00.')
  })

  it('omits pace when unavailable', () => {
    expect(
      cueText({ kind: 'split', idx: 3 }, { units: 'metric', splitSec: null }),
    ).toBe('Kilometre 3.')
  })

  it('phrases halfway for distance and duration goals', () => {
    expect(
      cueText(
        { kind: 'halfway', remainingM: 2500 },
        { units: 'metric', splitSec: null },
      ),
    ).toBe('2.5 kilometres to go.')
    expect(
      cueText(
        { kind: 'halfway', remainingMs: 15 * 60_000 },
        { units: 'metric', splitSec: null },
      ),
    ).toBe('15 minutes to go.')
  })

  it('phrases the finish fanfare', () => {
    expect(cueText({ kind: 'goal-hit' }, { units: 'metric', splitSec: null })).toBe(
      'Goal complete.',
    )
  })
})

describe('initCoach integration', () => {
  /** Exact meters per degree of latitude under our haversine model. */
  const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180
  const LAT_STEP = 3 / M_PER_DEG // 3 m per fix at 1 s cadence

  function fakeWatch() {
    let onFix: (f: RawFix) => void = () => {}
    const watch: GeoWatch = (cb) => {
      onFix = cb
      return () => {}
    }
    const emit = (f: { lat: number; lng: number; t: number }) =>
      onFix({ acc: 5, ...f })
    return { watch, emit }
  }

  it('speaks splits through the engine stream, gated by the voice setting', () => {
    const { watch, emit } = fakeWatch()
    const e = new TrackingEngine(watch)
    const said: string[] = []
    const stop = initCoach(e, (t) => said.push(t))

    useSettings.setState({ voice: true })

    e.start()
    emit({ lat: 0, lng: 0, t: 1000 }) // anchor → recording

    // Walk just past 1 km in 1-second fixes.
    let i = 1
    for (; i <= 340; i++) emit({ lat: i * LAT_STEP, lng: 0, t: 1000 + i * 1000 })
    expect(e.snapshot.status).toBe('recording')
    expect(said.some((t) => t.startsWith('Kilometre 1'))).toBe(true)

    // Voice off → silence.
    said.length = 0
    useSettings.setState({ voice: false })
    for (; i <= 700; i++) emit({ lat: i * LAT_STEP, lng: 0, t: 1000 + i * 1000 })
    expect(said).toEqual([])

    stop()
    useSettings.setState({ voice: false })
  })
})
