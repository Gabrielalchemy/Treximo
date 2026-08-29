import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { db, type StoredRun } from '../db/db'
import { computeRecords, type PaceRecord } from '../lib/records'
import { weekStartTs } from '../lib/goals'
import { useSettings } from '../state/settings'
import { useGoal } from '../state/goal'
import { navigate } from '../state/router'
import {
  distanceLabel,
  formatDistance,
  formatRelativeDate,
} from '../lib/format'
import { formatClock } from '../lib/pace'
import { pressSpring, riseChild, staggerParent } from '../motion/variants'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const BAR_WEEKS = 10

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Distances for the last N weeks, oldest first, current week last. */
function weeklySeries(runs: readonly StoredRun[]): { start: number; distanceM: number }[] {
  const thisWeek = weekStartTs()
  return Array.from({ length: BAR_WEEKS }, (_, i) => {
    const start = thisWeek - (BAR_WEEKS - 1 - i) * WEEK_MS
    let d = 0
    for (const r of runs) {
      if (r.startedAt >= start && r.startedAt < start + WEEK_MS) d += r.distanceM
    }
    return { start, distanceM: d }
  })
}

/**
 * Consecutive weeks meeting the goal. The open current week never breaks a
 * streak — it just isn't counted until the goal is met.
 */
function goalStreak(runs: readonly StoredRun[], weeklyGoalM: number): number {
  let w = weekStartTs()
  if (weekSum(runs, w) < weeklyGoalM) w -= WEEK_MS
  let streak = 0
  while (weekSum(runs, w) >= weeklyGoalM) {
    streak++
    w -= WEEK_MS
  }
  return streak
}

function weekSum(runs: readonly StoredRun[], start: number): number {
  let d = 0
  for (const r of runs) {
    if (r.startedAt >= start && r.startedAt < start + WEEK_MS) d += r.distanceM
  }
  return d
}

export function StatsScreen() {
  const units = useSettings((s) => s.units)
  const weeklyGoalM = useGoal((s) => s.weeklyGoalM)
  const runs = useLiveQuery(
    () => db.runs.where('status').equals('completed').sortBy('startedAt'),
    [],
  )

  const totals = useMemo(() => {
    if (!runs) return null
    let dist = 0
    let time = 0
    for (const r of runs) {
      dist += r.distanceM
      time += r.movingMs
    }
    return { dist, time, count: runs.length }
  }, [runs])

  const records = useMemo(() => computeRecords(runs ?? []), [runs])
  const series = useMemo(() => weeklySeries(runs ?? []), [runs])

  return (
    <div className="h-full overflow-y-auto px-6 pt-safe pb-safe">
      <header className="mt-2 rounded-[28px] border border-white/8 bg-white/[0.02] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <h1 className="font-display text-2xl font-bold tracking-tight">Stats</h1>
        <p className="text-xs text-muted">Progress you can feel.</p>
      </header>

      {!runs ? (
        <div className="mt-6 space-y-3" aria-hidden>
          <div className="h-20 animate-pulse rounded-3xl bg-surface" />
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyStats />
      ) : (
        <motion.div
          variants={staggerParent}
          initial="initial"
          animate="animate"
          className="mt-6 space-y-6"
        >
          {/* All-time hero */}
          <motion.div
            variants={riseChild}
            className="grid grid-cols-3 divide-x divide-line rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(21,25,31,0.88),rgba(17,20,25,0.86))] py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <HeroMetric
              label="Distance"
              value={formatDistance(totals!.dist, units)}
              unit={distanceLabel(units)}
            />
            <HeroMetric label="Runs" value={String(totals!.count)} />
            <HeroMetric label="Time" value={formatClock(totals!.time)} small />
          </motion.div>

          {/* Records */}
          <motion.section variants={riseChild}>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
              Records
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <PaceCard label="Fastest mile" rec={records.mile} />
              <PaceCard label="Fastest 5K" rec={records.fiveK} />
              <PaceCard label="Fastest 10K" rec={records.tenK} />

              {records.longestRun ? (
                <RecordCard
                  label="Longest run"
                  value={formatDistance(records.longestRun.distanceM, units)}
                  unit={distanceLabel(units)}
                  sub={formatRelativeDate(records.longestRun.startedAt)}
                  onClick={() => navigate(`#/run/${records.longestRun!.runId}`)}
                />
              ) : (
                <MissingCard label="Longest run" />
              )}

              {records.biggestWeek ? (
                <RecordCard
                  label="Biggest week"
                  value={formatDistance(records.biggestWeek.distanceM, units)}
                  unit={distanceLabel(units)}
                  sub={`Week of ${shortDate(records.biggestWeek.weekStartTs)}`}
                />
              ) : (
                <MissingCard label="Biggest week" />
              )}
            </div>
          </motion.section>

          {/* Weekly volume */}
          <motion.section variants={riseChild}>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
              Last {BAR_WEEKS} weeks
            </h2>
            <div className="rounded-3xl border border-line bg-surface p-5">
              <div className="flex h-32 items-end gap-1.5">
                {series.map((w, i) => {
                  const max = Math.max(...series.map((x) => x.distanceM), 1)
                  const pct = Math.min(100, (w.distanceM / max) * 100)
                  const isCurrent = i === series.length - 1
                  const metGoal =
                    weeklyGoalM != null && w.distanceM >= weeklyGoalM
                  return (
                    <div key={w.start} className="flex h-full flex-1 flex-col justify-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(pct, w.distanceM > 0 ? 4 : 1.5)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 + i * 0.04 }}
                        title={`${formatDistance(w.distanceM, units)} ${distanceLabel(units)} · week of ${shortDate(w.start)}`}
                        className={`w-full rounded-t-md ${
                          metGoal
                            ? 'bg-volt'
                            : isCurrent
                              ? 'bg-volt/40'
                              : w.distanceM > 0
                                ? 'bg-surface-2'
                                : 'bg-surface-2/50'
                        }`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex justify-between text-[9px] font-semibold uppercase tracking-[0.18em] text-faint">
                <span>{shortDate(series[0]!.start)}</span>
                <span>Now</span>
              </div>
            </div>
          </motion.section>

          {/* Streak */}
          <motion.section variants={riseChild}>
            {weeklyGoalM != null ? (
              <div className="flex items-center justify-between rounded-3xl border border-volt/30 bg-volt/10 p-5">
                <div>
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
                    Streak
                  </h2>
                  <p className="mt-1 text-[11px] text-faint">
                    Weeks hitting your{' '}
                    {formatDistance(weeklyGoalM, units, 0)}{' '}
                    {distanceLabel(units)} goal.
                  </p>
                </div>
                <span className="font-display text-5xl font-bold tabular leading-none text-volt">
                  {goalStreak(runs, weeklyGoalM)}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('#/settings')}
                className="flex w-full items-center justify-between rounded-3xl border border-dashed border-line px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-volt"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
                    Streak
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    Set a weekly goal to track streaks.
                  </p>
                </div>
                <ChevronGlyph />
              </button>
            )}
          </motion.section>
        </motion.div>
      )}
    </div>
  )
}

function HeroMetric({
  label,
  value,
  unit,
  small,
}: {
  label: string
  value: string
  unit?: string
  small?: boolean
}) {
  return (
    <div className="flex flex-col items-center px-1">
      <span
        className={`font-display font-bold tabular ${small ? 'text-lg' : 'text-2xl'}`}
      >
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-muted">{unit}</span>}
      </span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
    </div>
  )
}

function PaceCard({
  label,
  rec,
}: {
  label: string
  rec?: PaceRecord | undefined
}) {
  if (!rec) return <MissingCard label={label} />
  return (
    <RecordCard
      label={label}
      value={formatClock(rec.sec * 1000)}
      sub={formatRelativeDate(rec.startedAt)}
      onClick={() => navigate(`#/run/${rec.runId}`)}
    />
  )
}

function RecordCard({
  label,
  value,
  unit,
  sub,
  onClick,
}: {
  label: string
  value: string
  unit?: string
  sub: string
  onClick?: () => void
}) {
  return (
    <motion.button
      type="button"
      {...(onClick ? { whileTap: { scale: 0.97 } } : {})}
      transition={pressSpring}
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-3xl border border-line bg-surface p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-volt ${
        onClick ? '' : 'cursor-default'
      }`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-bold tabular leading-none text-text">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </p>
      <p className="mt-1.5 truncate text-[10px] tabular text-faint">{sub}</p>
    </motion.button>
  )
}

function MissingCard({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line p-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-faint">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-bold leading-none text-faint">
        —
      </p>
      <p className="mt-1.5 text-[10px] text-faint">Run one to set it.</p>
    </div>
  )
}

function ChevronGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 rotate-180 text-faint" aria-hidden>
      <path d="m14.5 5.5-7 6.5 7 6.5" />
    </svg>
  )
}

function EmptyStats() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-24 flex flex-col items-center text-center"
    >
      <svg viewBox="0 0 120 80" className="w-40 text-volt/70" aria-hidden>
        <motion.line
          x1="14" y1="66" x2="34" y2="52"
          stroke="currentColor" strokeWidth="4" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        />
        <motion.line
          x1="50" y1="66" x2="70" y2="36"
          stroke="currentColor" strokeWidth="4" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.55 }}
        />
        <motion.line
          x1="86" y1="66" x2="106" y2="20"
          stroke="#f4a8de" strokeWidth="4" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.8 }}
        />
      </svg>
      <p className="mt-4 font-display text-lg font-bold">No stats yet</p>
      <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted">
        Records, weekly volume and streaks appear after your first run.
      </p>
    </motion.div>
  )
}
