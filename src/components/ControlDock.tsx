import { AnimatePresence, motion } from 'framer-motion'
import { PauseIcon, PlayIcon, StopIcon } from './icons'
import type { TrackerStatus } from '../lib/tracker'
import { pressSpring } from '../motion/variants'

interface ControlDockProps {
  status: TrackerStatus
  /** 0..1 progress into the current kilometer/mile */
  splitFraction: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStopRequest: () => void
}

const R = 52
const CIRC = 2 * Math.PI * R

function TapButton({
  onPress,
  label,
  children,
  className,
}: {
  onPress: () => void
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onPress}
      whileTap={{ scale: 0.88 }}
      transition={pressSpring}
      className={`flex items-center justify-center rounded-full shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-volt ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function ControlDock({
  status,
  splitFraction,
  onStart,
  onPause,
  onResume,
  onStopRequest,
}: ControlDockProps) {
  return (
    <div className="grid h-44 grid-cols-3 items-center justify-items-center rounded-[28px] border border-white/6 bg-white/[0.015] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <AnimatePresence mode="popLayout" initial={false}>
        {status === 'idle' ? (
          <motion.div key="start" className="col-start-2" {...swap()}>
            <TapButton
              onPress={onStart}
              label="Start run"
              className="h-28 w-28 bg-[linear-gradient(180deg,#f5c2e7,#f0a2d7)] text-base text-base shadow-[0_16px_36px_rgba(244,175,217,0.18)]"
            >
              <PlayIcon className="ml-1.5 h-11 w-11" />
            </TapButton>
            <p className="mt-3 text-center text-[10px] font-semibold tracking-[0.24em] text-muted">
              START RUN
            </p>
          </motion.div>
        ) : status === 'recording' ? (
          <>
            <motion.div key="stop" {...swap()}>
              <TapButton
                onPress={onStopRequest}
                label="Stop run"
                className="h-16 w-16 border-2 border-danger/70 bg-surface text-danger shadow-[0_12px_24px_rgba(255,84,73,0.18)]"
              >
                <StopIcon className="h-6 w-6" />
              </TapButton>
              <p className="mt-2 text-center text-[10px] font-semibold tracking-[0.24em] text-faint">
                STOP
              </p>
            </motion.div>

            <motion.div key="pause-wrap" className="relative" {...swap()}>
              <svg viewBox="0 0 120 120" className="absolute -inset-0 h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                <motion.circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke="#f4afd9"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  initial={false}
                  animate={{ strokeDashoffset: CIRC * (1 - Math.min(1, Math.max(0, splitFraction))) }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </svg>

              <TapButton
                onPress={onPause}
                label="Pause run"
                className="m-4 h-24 w-24 bg-[linear-gradient(180deg,#f5c2e7,#f0a2d7)] text-base text-base shadow-[0_16px_36px_rgba(244,175,217,0.18)]"
              >
                <PauseIcon className="h-9 w-9" />
              </TapButton>

              <motion.span
                aria-hidden
                className="absolute inset-4 rounded-full border border-volt/60"
                animate={{ scale: [1, 1.12], opacity: [0.7, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />

              <p className="mt-3 text-center text-[10px] font-semibold tracking-[0.24em] text-muted">
                PAUSE
              </p>
            </motion.div>

            <div key="spacer-r" />
          </>
        ) : (
          <>
            <motion.div key="finish" {...swap()} className="col-start-1">
              <TapButton
                onPress={onStopRequest}
                label="Finish run"
                className="h-16 w-16 bg-danger text-base shadow-[0_12px_24px_rgba(255,84,73,0.22)]"
              >
                <StopIcon className="h-6 w-6" />
              </TapButton>
              <p className="mt-2 text-center text-[10px] font-semibold tracking-[0.24em] text-faint">
                FINISH
              </p>
            </motion.div>

            <motion.div key="resume" {...swap()}>
              <TapButton
                onPress={onResume}
                label="Resume run"
                className="h-24 w-24 bg-[linear-gradient(180deg,#f5c2e7,#f0a2d7)] text-base text-base shadow-[0_16px_36px_rgba(244,175,217,0.18)]"
              >
                <PlayIcon className="ml-1 h-10 w-10" />
              </TapButton>
              <p className="mt-3 text-center text-[10px] font-semibold tracking-[0.24em] text-muted">
                RESUME
              </p>
            </motion.div>

            <div key="spacer-p" />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Shared enter/exit for dock state swaps */
function swap() {
  return {
    initial: { opacity: 0, scale: 0.7 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.7 },
    transition: { type: 'spring' as const, stiffness: 420, damping: 28 },
  }
}
