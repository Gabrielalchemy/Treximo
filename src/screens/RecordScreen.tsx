import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ControlDock } from '../components/ControlDock'
import { GpsPill, type GpsState } from '../components/GpsPill'
import { StatTile } from '../components/StatTile'
import { useGeoTracker } from '../hooks/useGeoTracker'
import { useWakeLock } from '../hooks/useWakeLock'
import {
  discardRun,
  engine,
  finishRun,
  startRun,
} from '../state/session'
import { navigate } from '../state/router'
import { useSettings } from '../state/settings'
import {
  distanceLabel,
  formatDistance,
  paceToDisplaySec,
  paceUnitLabel,
  splitLengthM,
} from '../lib/format'
import { formatClock, formatPace } from '../lib/pace'
import { geoErrorMessage, type TrackerError } from '../lib/tracker'
import {
  backdropVariants,
  pageEase,
  sheetVariants,
} from '../motion/variants'

export function RecordScreen() {
  const { snapshot, displayedMovingMs, currentPaceSecPerKm, live } = useGeoTracker()
  const units = useSettings((s) => s.units)
  const [confirming, setConfirming] = useState(false)
  const [trackerError, setTrackerError] = useState<TrackerError | null>(null)

  useWakeLock(live || snapshot.status === 'paused')

  useEffect(() => {
    const handler = (err: TrackerError) => setTrackerError(err)
    engine.onTrackerError(handler)
    return () => {
      engine.onTrackerError(() => {})
    }
  }, [])

  // A successful fix clears transient errors.
  useEffect(() => {
    if (snapshot.points.length > 0) setTrackerError(null)
  }, [snapshot.points.length])

  const splitLen = splitLengthM(units)
  const splitFraction =
    snapshot.distanceM > 0 ? (snapshot.distanceM % splitLen) / splitLen : 0

  const gpsState: GpsState =
    trackerError && trackerError.code !== 3
      ? 'error'
      : snapshot.status === 'acquiring'
        ? 'acquiring'
        : snapshot.status === 'idle' && snapshot.accuracyM == null
          ? 'off'
          : 'locked'

  const paused = snapshot.status === 'paused'

  async function onConfirmFinish() {
    setConfirming(false)
    const id = await finishRun()
    if (id) navigate(`#/run/${id}`)
  }

  return (
    <div className="flex h-full flex-col px-6 pt-safe">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <span className="font-display text-sm font-bold tracking-[0.28em] text-text">
          TREXIMO
        </span>
        <GpsPill state={gpsState} accuracyM={snapshot.accuracyM} />
      </header>

      {/* Error card */}
      <AnimatePresence>
        {trackerError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs leading-relaxed text-danger"
            role="alert"
          >
            {geoErrorMessage(trackerError)}
            {trackerError.code === 1 &&
              ' — allow location access in your browser settings, then press start again.'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <StatTile label="Time" value={formatClock(displayedMovingMs)} size="xl" />

        <div className="flex w-full max-w-xs items-start justify-between">
          <StatTile
            label="Distance"
            value={formatDistance(snapshot.distanceM, units)}
            unit={distanceLabel(units)}
            hero
            size="lg"
          />
          <StatTile
            label="Pace"
            value={
              formatPace(paceToDisplaySec(currentPaceSecPerKm, units))
            }
            unit={paceUnitLabel(units)}
            size="md"
          />
        </div>

        <AnimatePresence>
          {paused && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-xs font-bold tracking-[0.4em] text-muted"
            >
              {snapshot.autoPaused ? 'AUTO-PAUSED' : 'PAUSED'}
            </motion.p>
          )}
          {snapshot.status === 'idle' && !trackerError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={pageEase}
              className="max-w-[220px] text-center text-xs leading-relaxed text-faint"
            >
              Press start and go. Every meter saves to your device — no signal
              required.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="pb-safe">
        <ControlDock
          status={snapshot.status}
          splitFraction={splitFraction}
          onStart={() => startRun()}
          onPause={() => engine.pause()}
          onResume={() => engine.resume()}
          onStopRequest={() => setConfirming(true)}
        />
      </div>

      {/* Finish / discard sheet */}
      <AnimatePresence>
        {confirming && (
          <>
            <motion.button
              key="backdrop"
              type="button"
              aria-label="Cancel"
              variants={backdropVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={() => setConfirming(false)}
              className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              variants={sheetVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-x-0 bottom-0 z-40 rounded-t-[32px] border-t border-line bg-surface px-6 pb-safe pt-6"
            >
              <p className="font-display text-xl font-bold">Finish run?</p>
              <p className="mt-1 text-xs text-muted">
                {formatDistance(snapshot.distanceM, units)} {distanceLabel(units)} ·{' '}
                {formatClock(snapshot.movingMs)} moving
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void discardRun().then(() => setConfirming(false))}
                  className="rounded-2xl border border-danger/50 py-4 text-sm font-semibold text-danger outline-none focus-visible:ring-2 focus-visible:ring-volt"
                >
                  Discard
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void onConfirmFinish()}
                  className="rounded-2xl bg-volt py-4 text-sm font-bold text-base outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Finish & Save
                </motion.button>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setConfirming(false)}
                className="mt-3 w-full py-3 text-xs font-semibold tracking-widest text-muted"
              >
                KEEP RUNNING
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
