import { motion } from 'framer-motion'
import { useSettings } from '../state/settings'
import { useGoal } from '../state/goal'
import { navigate } from '../state/router'
import { weekDistanceM, weekStartTs } from '../lib/goals'
import { distanceLabel, formatDistance } from '../lib/format'
import { ChevronLeftIcon } from './icons'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * History-header card for the weekly mileage goal. Shows a CTA when no
 * target is set, otherwise this week's progress with an animated fill.
 */
export function WeeklyGoalCard({
  runs,
}: {
  runs?: readonly { startedAt: number; distanceM: number }[] | undefined
}) {
  const units = useSettings((s) => s.units)
  const weeklyGoalM = useGoal((s) => s.weeklyGoalM)

  if (!weeklyGoalM) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate('#/settings')}
        className="mt-4 flex w-full items-center justify-between rounded-3xl border border-dashed border-line px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-volt"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
            Weekly goal
          </p>
          <p className="mt-1 text-xs text-faint">
            Set a weekly distance to chase.
          </p>
        </div>
        <ChevronLeftIcon className="h-4 w-4 rotate-180 text-faint" />
      </motion.button>
    )
  }

  if (!runs) {
    return (
      <div className="mt-4 h-[104px] animate-pulse rounded-3xl bg-surface" aria-hidden />
    )
  }

  const doneM = weekDistanceM(runs)
  const start = weekStartTs()
  const runCount = runs.filter(
    (r) => r.startedAt >= start && r.startedAt < start + WEEK_MS,
  ).length
  const pct = Math.min(100, (doneM / weeklyGoalM) * 100)
  const complete = doneM >= weeklyGoalM

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className={`mt-4 rounded-3xl border p-5 ${
        complete ? 'border-volt/40 bg-volt/10' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
          This week
        </h2>
        <p className="text-sm tabular">
          <span
            className={`font-display font-bold ${
              complete ? 'text-volt' : 'text-text'
            }`}
          >
            {formatDistance(doneM, units)}
          </span>
          <span className="text-muted">
            {' '}
            / {formatDistance(weeklyGoalM, units, 0)} {distanceLabel(units)}
          </span>
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
          className={`h-full rounded-full ${complete ? 'bg-volt' : 'bg-volt/80'}`}
        />
      </div>

      <p className="mt-2.5 text-[11px] text-faint">
        {complete ? (
          <span className="font-semibold text-volt">Weekly goal hit</span>
        ) : (
          `${formatDistance(Math.max(0, weeklyGoalM - doneM), units)} ${distanceLabel(units)} to go`
        )}
        {' · '}
        {runCount} run{runCount === 1 ? '' : 's'}
      </p>
    </motion.section>
  )
}
