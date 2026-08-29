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
      className="relative z-20 rounded-[28px] border border-white/6 bg-surface/75 pb-safe shadow-[0_-12px_28px_rgba(6,10,22,0.18)] backdrop-blur-2xl"
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1 px-2 py-2">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={pressSpring}
              onClick={() => onSelect(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 rounded-2xl py-2 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-volt ${
                active ? 'text-volt' : 'text-faint'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-1 rounded-2xl bg-[linear-gradient(180deg,rgba(244,175,217,0.12),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
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
              <span className="relative text-[10px] font-semibold tracking-[0.16em] uppercase">{t.label}</span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
