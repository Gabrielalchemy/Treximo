import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettings } from '../state/settings'
import { useGoal } from '../state/goal'
import type { RunGoal } from '../lib/goals'
import {
  backdropVariants,
  pressSpring,
  sheetVariants,
} from '../motion/variants'
import { distanceLabel } from '../lib/format'

const M_PER_MI = 1609.344

const PRESETS: { goal: RunGoal; label: string }[] = [
  { goal: { kind: 'none' }, label: 'None' },
  { goal: { kind: 'distance', targetM: 5000 }, label: '5K' },
  { goal: { kind: 'distance', targetM: 10000 }, label: '10K' },
]

const DIST_STEP_M = 500
const DIST_MIN_M = 500
const DIST_MAX_M = 100_000
const DUR_STEP_MS = 5 * 60_000
const DUR_MIN_MS = 5 * 60_000
const DUR_MAX_MS = 8 * 3_600_000

/**
 * Pre-run goal selection: preset chips plus a custom distance/duration
 * sheet. Rendered only while the tracker is idle.
 */
export function GoalPicker() {
  const units = useSettings((s) => s.units)
  const runGoal = useGoal((s) => s.runGoal)
  const setRunGoal = useGoal((s) => s.setRunGoal)
  const [editing, setEditing] = useState(false)

  const active =
    runGoal.kind !== 'none' &&
    PRESETS.some((p) => goalsEqual(p.goal, runGoal))

  return (
    <>
      <div className="flex items-center justify-center gap-2">
        {PRESETS.map((p) => {
          const selected = goalsEqual(p.goal, runGoal)
          return (
            <Chip
              key={p.label}
              label={p.label}
              selected={selected}
              onPress={() => setRunGoal(p.goal)}
            />
          )
        })}
        <Chip
          label="Custom"
          selected={!active}
          onPress={() => setEditing(true)}
        />
      </div>

      <AnimatePresence>
        {editing && (
          <>
            <motion.button
              key="backdrop"
              type="button"
              aria-label="Close goal editor"
              variants={backdropVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={() => setEditing(false)}
              className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <GoalSheet
              key="sheet"
              onClose={() => setEditing(false)}
              onApply={(g) => {
                setRunGoal(g)
                setEditing(false)
              }}
              units={units}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      transition={pressSpring}
      onClick={onPress}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-volt ${
        selected
          ? 'border-volt/50 bg-volt/10 text-volt'
          : 'border-line bg-surface text-muted'
      }`}
    >
      {label}
    </motion.button>
  )
}

function GoalSheet({
  units,
  onClose,
  onApply,
}: {
  units: 'metric' | 'imperial'
  onClose: () => void
  onApply: (g: RunGoal) => void
}) {
  const [mode, setMode] = useState<'distance' | 'duration'>('distance')
  const [distM, setDistM] = useState(units === 'metric' ? 7500 : 5 * M_PER_MI)
  const [durMs, setDurMs] = useState(30 * 60_000)

  const distStep = units === 'metric' ? DIST_STEP_M : M_PER_MI / 2
  const distMin = units === 'metric' ? DIST_MIN_M : M_PER_MI

  function apply() {
    onApply(
      mode === 'distance'
        ? { kind: 'distance', targetM: distM }
        : { kind: 'duration', targetMs: durMs },
    )
  }

  return (
    <motion.div
      variants={sheetVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute inset-x-0 bottom-0 z-40 rounded-t-[32px] border-t border-line bg-surface px-6 pb-safe pt-6"
    >
      <p className="font-display text-xl font-bold">Set a goal</p>
      <p className="mt-1 text-xs text-muted">
        Live progress tracks you toward it mid-run.
      </p>

      {/* Mode toggle */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        {(['distance', 'duration'] as const).map((m) => {
          const on = mode === m
          return (
            <motion.button
              key={m}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setMode(m)}
              aria-pressed={on}
              className={`relative rounded-2xl py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-volt ${
                on ? 'bg-volt/10 text-volt' : 'bg-surface-2 text-muted'
              }`}
            >
              {m === 'distance' ? 'Distance' : 'Duration'}
            </motion.button>
          )
        })}
      </div>

      {/* Stepper */}
      {mode === 'distance' ? (
        <StepperRow
          value={
            units === 'metric' ? trim(distM / 1000) : trim(distM / M_PER_MI)
          }
          unit={distanceLabel(units)}
          onDec={() =>
            setDistM((v) => Math.max(distMin, v - distStep))
          }
          onInc={() => setDistM((v) => Math.min(DIST_MAX_M, v + distStep))}
          decLabel="Decrease distance goal"
          incLabel="Increase distance goal"
        />
      ) : (
        <StepperRow
          value={`${Math.round(durMs / 60_000)}`}
          unit="MIN"
          onDec={() => setDurMs((v) => Math.max(DUR_MIN_MS, v - DUR_STEP_MS))}
          onInc={() => setDurMs((v) => Math.min(DUR_MAX_MS, v + DUR_STEP_MS))}
          decLabel="Decrease duration goal"
          incLabel="Increase duration goal"
        />
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 pb-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="rounded-2xl border border-line py-4 text-sm font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
        >
          Cancel
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={apply}
          className="rounded-2xl bg-volt py-4 text-sm font-bold text-base outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Set Goal
        </motion.button>
      </div>
    </motion.div>
  )
}

function StepperRow({
  value,
  unit,
  onDec,
  onInc,
  decLabel,
  incLabel,
}: {
  value: string
  unit: string
  onDec: () => void
  onInc: () => void
  decLabel: string
  incLabel: string
}) {
  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-3">
      <motion.button
        type="button"
        aria-label={decLabel}
        whileTap={{ scale: 0.88 }}
        onClick={onDec}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-xl font-bold text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
      >
        −
      </motion.button>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold tabular text-text">
          {value}
        </span>
        <span className="text-sm font-medium text-muted">{unit}</span>
      </div>
      <motion.button
        type="button"
        aria-label={incLabel}
        whileTap={{ scale: 0.88 }}
        onClick={onInc}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-xl font-bold text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
      >
        +
      </motion.button>
    </div>
  )
}

function goalsEqual(a: RunGoal, b: RunGoal): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'distance' && b.kind === 'distance') {
    return a.targetM === b.targetM
  }
  if (a.kind === 'duration' && b.kind === 'duration') {
    return a.targetMs === b.targetMs
  }
  return true
}

function trim(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
}
