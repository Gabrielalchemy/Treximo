import { motion } from 'framer-motion'
import type { Split } from '../lib/pace'
import { formatPace } from '../lib/pace'
import type { Units } from '../state/settings'
import { splitLabel } from '../lib/format'
import { staggerParent, riseChild } from '../motion/variants'

/**
 * Per-split bars. Bar length encodes split duration (longer = slower);
 * the fastest split is highlighted in volt.
 */
export function SplitsBars({
  splits,
  units,
}: {
  splits: Split[]
  units: Units
}) {
  if (splits.length === 0) return null

  const fastest = Math.min(...splits.map((s) => s.sec))

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-2">
      {splits.map((s) => {
        const isFastest = !s.partial && s.sec === fastest
        const frac = Math.min(1, fastest / s.sec)
        return (
          <motion.div key={s.km} variants={riseChild} className="flex items-center gap-3">
            <span
              className={`w-14 text-[10px] font-semibold tracking-[0.16em] ${
                s.partial ? 'text-faint' : 'text-muted'
              }`}
              title={s.partial ? 'Partial interval' : undefined}
            >
              {splitLabel(s.km, units)}
              {s.partial ? '+' : ''}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className={`h-full rounded-full ${
                  isFastest ? 'bg-volt' : s.partial ? 'bg-[#262b31]' : 'bg-[#3a414b]'
                }`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: frac }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ originX: 0 }}
              />
            </div>
            <span
              className={`w-12 text-right text-sm tabular ${
                isFastest ? 'font-bold text-volt' : s.partial ? 'text-faint' : 'text-text'
              }`}
            >
              {formatPace(s.sec)}
            </span>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
