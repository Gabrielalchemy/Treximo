import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { db, type StoredRun } from '../db/db'
import { importGpxFiles } from '../lib/gpx'
import { UploadIcon } from '../components/icons'
import { useSettings } from '../state/settings'
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

  return (
    <div className="h-full overflow-y-auto px-6 pt-safe">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">History</h1>
          <p className="text-xs text-muted">Every mile lives on this device.</p>
        </div>
        <motion.button
          type="button"
          aria-label="Import GPX files"
          whileTap={{ scale: 0.9 }}
          onClick={() => fileInput.current?.click()}
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-muted outline-none focus-visible:ring-2 focus-visible:ring-volt"
        >
          <UploadIcon className="h-5 w-5" />
        </motion.button>
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
