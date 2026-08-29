import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { db, type StoredRun } from '../db/db'
import { importGpxFiles } from '../lib/gpx'
import { UploadIcon } from '../components/icons'
import { WeeklyGoalCard } from '../components/WeeklyGoalCard'
import { useSettings } from '../state/settings'
import { addManualRun } from '../state/session'
import { navigate } from '../state/router'
import {
  distanceLabel,
  formatDistance,
  formatRelativeDate,
  paceToDisplaySec,
  paceUnitLabel,
} from '../lib/format'
import { avgPaceSecPerKm, formatClock, formatPace } from '../lib/pace'
import { pressSpring, riseChild, staggerParent } from '../motion/variants'

function RunCard({ run }: { run: StoredRun }) {
  const units = useSettings((s) => s.units)
  const pace = paceToDisplaySec(
    avgPaceSecPerKm(run.distanceM, run.movingMs),
    units,
  )

  return (
    <motion.button
      type="button"
      variants={riseChild}
      whileTap={{ scale: 0.97 }}
      transition={pressSpring}
      onClick={() => navigate(`#/run/${run.id}`)}
      className="w-full rounded-3xl border border-line bg-surface p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-volt"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {formatRelativeDate(run.startedAt)}
      </p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold tabular text-text">
          {formatDistance(run.distanceM, units)}
        </span>
        <span className="text-sm font-medium text-muted">{distanceLabel(units)}</span>
      </div>
      <div className="mt-2 flex gap-4 text-xs tabular text-muted">
        <span>{formatClock(run.movingMs)}</span>
        <span>
          {formatPace(pace)} {paceUnitLabel(units)}
        </span>
      </div>
    </motion.button>
  )
}

export function HistoryScreen() {
  const runs = useLiveQuery(
    () => db.runs.where('status').equals('completed').reverse().sortBy('startedAt'),
    [],
  )
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDistance, setManualDistance] = useState('5')
  const [manualMinutes, setManualMinutes] = useState('30')
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const res = await importGpxFiles([...files])
    if (res.imported > 0 && res.failed === 0) {
      setNotice(`Imported ${res.imported} run${res.imported > 1 ? 's' : ''}`)
    } else if (res.imported > 0) {
      setNotice(`${res.imported} imported · ${res.failed} failed`)
    } else {
      setNotice('No valid GPX runs found')
    }
    fileInput.current?.value && (fileInput.current.value = '')
  }

  async function onManualSubmit(e: FormEvent) {
    e.preventDefault()
    const distance = Number.parseFloat(manualDistance)
    const minutes = Number.parseFloat(manualMinutes)
    if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(minutes) || minutes <= 0) {
      setNotice('Enter a valid distance and duration')
      return
    }

    const unit = useSettings.getState().units
    const distanceM = unit === 'metric' ? distance * 1000 : distance * 1609.344
    const startedAt = new Date(`${manualDate}T${manualTime}:00`).getTime()
    await addManualRun({ distanceM, movingMs: minutes * 60_000, startedAt })
    setManualOpen(false)
    setNotice(`Logged ${distance.toFixed(1)} ${unit === 'metric' ? 'km' : 'mi'} run`)
  }

  return (
    <div className="h-full overflow-y-auto px-6 pt-safe">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">History</h1>
          <p className="text-xs text-muted">Every mile lives on this device.</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            aria-label="Quick log a run"
            whileTap={{ scale: 0.9 }}
            onClick={() => setManualOpen(true)}
            className="mt-1 flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-semibold uppercase tracking-[0.16em] text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
          >
            Quick log
          </motion.button>
          <motion.button
            type="button"
            aria-label="Import GPX files"
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInput.current?.click()}
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-muted outline-none focus-visible:ring-2 focus-visible:ring-volt"
          >
            <UploadIcon className="h-5 w-5" />
          </motion.button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".gpx,application/gpx+xml"
          multiple
          hidden
          onChange={(e) => void onFiles(e.target.files)}
        />
      </header>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className="mt-3 rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-xs font-medium text-volt"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <WeeklyGoalCard runs={runs} />

      {!runs ? (
        <div className="mt-10 space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyHistory />
      ) : (
        <motion.div
          variants={staggerParent}
          initial="initial"
          animate="animate"
          className="mt-6 space-y-3 pb-safe"
        >
          {runs.map((r) => (
            <RunCard key={r.id} run={r} />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {manualOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close quick log"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManualOpen(false)}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] border-t border-line bg-surface px-6 pb-safe pt-6"
            >
              <p className="font-display text-xl font-bold">Quick log a run</p>
              <form onSubmit={onManualSubmit} className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                    Distance
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={manualDistance}
                      onChange={(e) => setManualDistance(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-line bg-surface-2 px-3 py-3 text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                    Minutes
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-line bg-surface-2 px-3 py-3 text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                    Date
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-line bg-surface-2 px-3 py-3 text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                    Time
                    <input
                      type="time"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-line bg-surface-2 px-3 py-3 text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setManualOpen(false)}
                    className="rounded-2xl border border-line py-4 text-sm font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-2xl bg-volt py-4 text-sm font-bold text-base outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Save run
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function EmptyHistory() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-24 flex flex-col items-center text-center"
    >
      <svg viewBox="0 0 120 80" className="w-40 text-volt/70" aria-hidden>
        <motion.path
          d="M8 66 C 30 60 26 34 48 32 S 78 44 92 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }}
        />
        <circle cx="104" cy="18" r="5" fill="#C8FF2E" />
      </svg>
      <p className="mt-4 font-display text-lg font-bold">No runs yet</p>
      <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted">
        Your first run is one tap away — and it works with zero signal.
      </p>
    </motion.div>
  )
}
