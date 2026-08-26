import { goalProgress, type RunGoal } from './goals'
import { formatPace, splitsOf } from './pace'
import {
  formatDistance,
  paceToDisplaySec,
  splitLengthM,
} from './format'
import type { Units } from '../state/settings'
import type { GeoPoint } from './geo'
import type { TrackingEngine } from './tracker'
import { speak } from './voice'
import { useSettings } from '../state/settings'
import { useGoal } from '../state/goal'

/**
 * Voice coach: announces completed splits and goal milestones during a run.
 *
 * The decision logic (`coachUpdate`) is pure and unit-tested; `initCoach`
 * merely wires it to the engine's snapshot stream and speaks the results.
 */

export interface CoachState {
  /** highest full split already announced */
  splitIdx: number
  halfAnnounced: boolean
  announcedHit: boolean
}

export interface SplitCue {
  kind: 'split'
  idx: number
}
export interface HalfwayCue {
  kind: 'halfway'
  remainingM?: number
  remainingMs?: number
}
export interface GoalHitCue {
  kind: 'goal-hit'
}
export type CoachCue = SplitCue | HalfwayCue | GoalHitCue

const EMPTY_CUES: CoachCue[] = []

export function initialCoachState(): CoachState {
  return { splitIdx: 0, halfAnnounced: false, announcedHit: false }
}

/**
 * Advance the coach through one snapshot. Emits at most one split plus one
 * goal cue per update; goal-hit outranks halfway so finishing runs always
 * get the fanfare.
 */
export function coachUpdate(
  st: CoachState,
  input: { distanceM: number; movingMs: number },
  opts: { splitLenM: number; goal: RunGoal },
): { state: CoachState; cues: CoachCue[] } {
  const next = { ...st }
  const cues: CoachCue[] = []

  const idx = Math.floor(input.distanceM / opts.splitLenM)
  if (idx > next.splitIdx && idx > 0) {
    cues.push({ kind: 'split', idx })
    next.splitIdx = idx
  }

  const p = goalProgress(opts.goal, input.distanceM, input.movingMs)
  if (opts.goal.kind !== 'none') {
    if (p.hit && !next.announcedHit) {
      cues.push({ kind: 'goal-hit' })
      next.announcedHit = true
    } else if (!next.halfAnnounced && p.fraction >= 0.5) {
      cues.push({
        kind: 'halfway',
        ...(p.remainingM != null ? { remainingM: p.remainingM } : {}),
        ...(p.remainingMs != null ? { remainingMs: p.remainingMs } : {}),
      })
      next.halfAnnounced = true
    }
  }

  return { state: next, cues: cues.length > 0 ? cues : EMPTY_CUES }
}

/** Natural-language phrasing for a cue. English by design (TTS-friendly). */
export function cueText(
  cue: CoachCue,
  ctx: { units: Units; splitSec: number | null },
): string {
  switch (cue.kind) {
    case 'split': {
      const noun = ctx.units === 'metric' ? 'Kilometre' : 'Mile'
      // Imperial splits are already seconds-per-mile; never re-convert.
      const displaySec =
        ctx.splitSec == null
          ? null
          : ctx.units === 'metric'
            ? paceToDisplaySec(ctx.splitSec, ctx.units)
            : ctx.splitSec
      return displaySec == null
        ? `${noun} ${cue.idx}.`
        : `${noun} ${cue.idx}. ${formatPace(displaySec)}.`
    }
    case 'halfway': {
      if (cue.remainingMs != null) {
        return `${Math.max(1, Math.round(cue.remainingMs / 60_000))} minutes to go.`
      }
      const n = parseFloat(formatDistance(cue.remainingM ?? 0, 'metric', 2))
      return `${n} ${ctx.units === 'metric' ? 'kilometres' : 'miles'} to go.`
    }
    case 'goal-hit':
      return 'Goal complete.'
  }
}

/** Seconds taken for full split #idx, interpolated across fixes. */
function splitSecondsFor(
  points: readonly GeoPoint[],
  splitLenM: number,
  idx: number,
): number | null {
  const match = splitsOf(points, splitLenM).find(
    (sp) => sp.km === idx && !sp.partial,
  )
  return match?.sec ?? null
}

/**
 * Subscribe the coach to a tracking engine. Returns an unsubscribe fn.
 * `say` is injectable for testing; production uses Web Speech.
 */
export function initCoach(
  engine: TrackingEngine,
  say: (text: string) => void = speak,
): () => void {
  let st = initialCoachState()
  let startedThisRun = false

  return engine.subscribe(() => {
    const s = engine.snapshot

    // Stop/discard ends the run; the next start re-arms from zero.
    if (s.status === 'idle') {
      startedThisRun = false
      return
    }
    if (s.status !== 'recording') return

    // Fresh run: reset counters so nothing leaks across sessions.
    if (!startedThisRun) {
      startedThisRun = true
      st = initialCoachState()
    }

    const cfg = useSettings.getState()
    if (!cfg.voice) return

    const splitLenM = splitLengthM(cfg.units)
    const { state, cues } = coachUpdate(st, s, {
      splitLenM,
      goal: useGoal.getState().runGoal,
    })
    st = state

    let splitSec: number | null = null
    for (const cue of cues) {
      if (cue.kind === 'split') {
        // O(n) boundary interpolation — only on the rare crossing tick.
        splitSec = splitSecondsFor(s.points, splitLenM, cue.idx)
      }
      say(cueText(cue, { units: cfg.units, splitSec }))
    }
  })
}
