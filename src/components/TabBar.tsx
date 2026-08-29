import { motion } from 'framer-motion'
import { useGeoTracker } from '../hooks/useGeoTracker'
import { GearIcon, RouteIcon, StatsIcon } from './icons'
import { pressSpring } from '../motion/variants'

export type Tab = 'record' | 'history' | 'stats' | 'settings'

const TABS: { id: Tab; label: string; icon: (c: string) => React.ReactNode }[] = [
  { id: 'record', label: 'Run', icon: () => <span className="block h-2.5 w-2.5 rounded-full bg-current" /> },
  { id: 'history', label: 'History', icon: (c) => <RouteIcon className={c} /> },
  { id: 'stats', label: 'Stats', icon: (c) => <StatsIcon className={c} /> },
  { id: 'settings', label: 'Settings', icon: (c) => <GearIcon className={c} /> },
]

export function TabBar({
  tab,
  onSelect,
}: {
  tab: Tab
  onSelect: (t: Tab) => void
}) {
  const { live } = useGeoTracker()

  return (
    <nav
      className="relative z-20 border-t border-line bg-surface/90 pb-safe backdrop-blur-xl"
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1.5">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.9 }}
              transition={pressSpring}
              onClick={() => onSelect(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 rounded-2xl py-2 outline-none focus-visible:ring-2 focus-visible:ring-volt ${
                active ? 'text-volt' : 'text-faint'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-x-3 inset-y-0 rounded-2xl bg-volt/10"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative flex h-6 w-6 items-center justify-center">
                {t.id === 'record' ? (
                  <span className="relative flex h-6 w-6 items-center justify-center">
                    {live && !active && (
                      <motion.span
                        className="absolute h-2.5 w-2.5 rounded-full bg-volt/60"
                        animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        live ? 'bg-volt' : 'bg-current'
                      }`}
                    />
                  </span>
                ) : (
                  t.icon('h-6 w-6')
                )}
              </span>
              <span className="text-[10px] font-semibold tracking-wider">{t.label}</span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
