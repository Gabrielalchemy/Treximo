import { motion } from 'framer-motion'

export type GpsState = 'off' | 'acquiring' | 'locked' | 'error'

const LABELS: Record<GpsState, string> = {
  off: 'GPS OFF',
  acquiring: 'ACQUIRING',
  locked: 'LOCKED',
  error: 'NO SIGNAL',
}

export function GpsPill({ state, accuracyM }: { state: GpsState; accuracyM?: number | null }) {
  const isError = state === 'error'
  const isLive = state === 'locked'

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1.5 backdrop-blur"
      role="status"
    >
      <motion.span
        className={`h-2 w-2 rounded-full ${
          isError ? 'bg-danger' : isLive ? 'bg-volt' : 'bg-muted'
        }`}
        animate={
          isLive
            ? { opacity: [1, 0.45, 1], scale: [1, 1.25, 1] }
            : state === 'acquiring'
              ? { opacity: [0.3, 1, 0.3] }
              : { opacity: 0.5 }
        }
        {...(isLive || state === 'acquiring'
          ? { transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const } }
          : {})}
      />
      <span className="text-[10px] font-semibold tracking-[0.18em] text-muted">
        {LABELS[state]}
        {isLive && accuracyM != null ? ` ±${Math.round(accuracyM)}M` : ''}
      </span>
    </div>
  )
}
