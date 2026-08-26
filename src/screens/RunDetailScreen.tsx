import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { db } from '../db/db'
import { deleteRun } from '../state/session'
import { navigate } from '../state/router'
import { useSettings } from '../state/settings'
import { ChevronLeftIcon, CheckIcon, ShareIcon, TrashIcon } from '../components/icons'
import { RouteSvg } from '../components/RouteSvg'
import { SplitsBars } from '../components/SplitsBars'
import { PaceChart } from '../components/PaceChart'
import { goalAchieved, goalLabel } from '../lib/goals'
import { exportRunGpx } from '../lib/gpx'
import {
  distanceLabel,
  formatDistance,
  formatRelativeDate,
  paceToDisplaySec,
  paceUnitLabel,
  splitLengthM,
} from '../lib/format'
import { avgPaceSecPerKm, formatClock, formatPace, splitsOf } from '../lib/pace'
import {
  backdropVariants,
  sheetVariants,
  staggerParent,
  riseChild,
} from '../motion/variants'

export function RunDetailScreen({ id }: { id: string }) {
  const units = useSettings((s) => s.units)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exported, setExported] = useState(false)
  const run = useLiveQuery(() => db.runs.get(id), [id])

  if (!run) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-surface" />
      </div>
    )
  }

  const pace = paceToDisplaySec(avgPaceSecPerKm(run.distanceM, run.movingMs), units)
  const splits = splitsOf(run.points, splitLengthM(units))

  async function onDelete() {
    await deleteRun(id)
    navigate('#/history')
  }

  async function onExport() {
    if (!run) return
    await exportRunGpx(run)
    setExported(true)
    setTimeout(() => setExported(false), 2500)
  }

  return (
    <div className="h-full overflow-y-auto px-6 pt-safe pb-safe">
      <header className="flex items-center gap-3 pt-2">
        <motion.button
          type="button"
          aria-label="Back"
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('#/history')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </motion.button>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {formatRelativeDate(run.startedAt)}
        </p>
      </header>

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-6">
        {/* Hero distance */}
        <motion.div variants={riseChild} className="flex items-baseline gap-2">
          <span className="font-display text-7xl font-bold tabular leading-none text-volt drop-shadow-[0_0_28px_rgba(200,255,46,0.22)]">
            {formatDistance(run.distanceM, units)}
          </span>
          <span className="text-lg font-medium text-muted">{distanceLabel(units)}</span>
        </motion.div>

        {/* Goal badge */}
        {run.goal && (
          <motion.div variants={riseChild} className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${
                goalAchieved(run.goal, run.distanceM, run.movingMs)
                  ? 'border-volt/40 bg-volt/10 text-volt'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              {goalAchieved(run.goal, run.distanceM, run.movingMs) && (
                <CheckIcon className="h-3.5 w-3.5" />
              )}
              {goalAchieved(run.goal, run.distanceM, run.movingMs)
                ? `Goal hit · ${goalLabel(run.goal, units)}`
                : `Target ${goalLabel(run.goal, units)}`}
            </span>
          </motion.div>
        )}

        {/* Secondary stats */}
        <motion.div
          variants={staggerParent}
          className="mt-5 grid grid-cols-3 divide-x divide-line rounded-3xl border border-line bg-surface py-4"
        >
          <Metric label="Time" value={formatClock(run.movingMs)} />
          <Metric label={`Pace ${paceUnitLabel(units)}`} value={formatPace(pace)} />
          <Metric
            label="Splits"
            value={
              splits.length > 0
                ? String(splits.length)
                : '—'
            }
          />
        </motion.div>

        {/* Route */}
        <motion.div variants={riseChild} className="mt-5">
          <RouteSvg points={run.points} height={230} />
        </motion.div>

        {/* Pace profile */}
        <motion.div variants={riseChild} className="mt-5">
          <PaceChart points={run.points} units={units} />
        </motion.div>

        {/* Splits */}
        {splits.length > 0 && (
          <motion.section variants={riseChild} className="mt-6">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
              Splits
            </h2>
            <SplitsBars splits={splits} units={units} />
          </motion.section>
        )}

        {/* Actions */}
        <motion.div variants={riseChild} className="mt-8 grid grid-cols-2 gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => void onExport()}
            className={`flex items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-volt ${
              exported
                ? 'border-volt bg-volt/10 text-volt'
                : 'border-line text-text'
            }`}
          >
            <ShareIcon className="h-4 w-4" />
            {exported ? 'GPX saved' : 'Export GPX'}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setConfirmDelete(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-danger/40 py-4 text-sm font-semibold text-danger outline-none focus-visible:ring-2 focus-visible:ring-volt"
          >
            <TrashIcon className="h-4 w-4" /> Delete
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.button
              key="bd"
              type="button"
              aria-label="Cancel delete"
              variants={backdropVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={() => setConfirmDelete(false)}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              variants={sheetVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] border-t border-line bg-surface px-6 pb-safe pt-6"
            >
              <p className="font-display text-xl font-bold">Delete this run?</p>
              <p className="mt-1 text-xs text-muted">This cannot be undone.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-2xl border border-line py-4 text-sm font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
                >
                  Keep it
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void onDelete()}
                  className="rounded-2xl bg-danger py-4 text-sm font-bold text-base outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <motion.div variants={riseChild} className="flex flex-col items-center px-1">
      <span className="font-display text-xl font-bold tabular">{value}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
    </motion.div>
  )
}
