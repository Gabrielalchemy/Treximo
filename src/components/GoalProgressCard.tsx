import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSettings } from '../state/settings'
import {
  goalLabel,
  goalProgress,
  type RunGoal,
} from '../lib/goals'
import { formatClock } from '../lib/pace'
import { distanceLabel, formatDistance } from '../lib/format'

interface GoalProgressCardProps {
  goal: RunGoal
  distanceM: number
  movingMs: number
}

/**
 * Live goal tracking during a run: animated fill bar, remaining readout,
 * and a one-shot celebration (pulse + buzz) the moment the goal is hit.
 */
export function GoalProgressCard({
  goal,
  distanceM,
  movingMs,
}: GoalProgressCardProps) {
  const units = useSettings((s) => s.units)
  const haptics = useSettings((s) => s.haptics)
  const progress = goalProgress(goal, distanceM, movingMs)

  // Mount-time baseline: restoring a session that's already past its goal
  // must not fire the celebration retroactively.
  const wasHit = useRef(progress.hit)
  const [celebrated, setCelebrated] = useState(false)

  useEffect(() => {
    if (progress.hit && !wasHit.current) {
      setCelebrated(true)
      if (haptics && 'vibrate' in navigator) navigator.vibrate([50, 70, 50])
    }
    wasHit.current = progress.hit
  }, [progress.hit, haptics])

  if (goal.kind === 'none') return null

  let remaining = ''
  if (!celebrated) {
    if (goal.kind === 'duration') {
      remaining = `${formatClock(progress.remainingMs ?? 0)} TO GO`
    } else {
      remaining = `${formatDistance(progress.remainingM ?? 0, units)} ${distanceLabel(units).toUpperCase()} TO GO`
    }
  }

  return (
    <div className="relative w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          Goal · {goalLabel(goal, units)}
        </span>
        {celebrated ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            className="shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-volt"
          >
            Goal hit
          </motion.span>
        ) : (
          <span className="shrink-0 text-[10px] font-semibold tabular tracking-[0.16em] text-faint">
            {remaining}
          </span>
        )}
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          initial={false}
          animate={{ width: `${progress.fraction * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full bg-volt"
        />
      </div>

      {celebrated && (
        <motion.span
          aria-hidden
          key="pulse"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-volt"
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0, scale: 1.07 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      )}
    </div>
  )
}
