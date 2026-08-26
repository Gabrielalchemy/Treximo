import { motion } from 'framer-motion'
import { useSettings, type Units } from '../state/settings'
import { useGoal } from '../state/goal'
import { distanceLabel, formatDistance } from '../lib/format'
import { staggerParent, riseChild } from '../motion/variants'

const UNIT_OPTIONS: { id: Units; label: string; hint: string }[] = [
  { id: 'metric', label: 'KM', hint: 'Kilometers' },
  { id: 'imperial', label: 'MI', hint: 'Miles' },
]

const M_PER_MI = 1609.344

export function SettingsScreen() {
  const {
    units,
    accuracyCutoffM,
    haptics,
    autoPause,
    voice,
    setUnits,
    setAccuracyCutoffM,
    setHaptics,
    setAutoPause,
    setVoice,
  } = useSettings()
  const weeklyGoalM = useGoal((s) => s.weeklyGoalM)
  const setWeeklyGoalM = useGoal((s) => s.setWeeklyGoalM)

  const weeklyStepM = units === 'metric' ? 5000 : Math.round(5 * M_PER_MI)
  const weeklyMinM = units === 'metric' ? 5000 : Math.round(3 * M_PER_MI)
  const weeklyMaxM = units === 'metric' ? 150_000 : Math.round(100 * M_PER_MI)

  function toggleWeeklyGoal() {
    if (weeklyGoalM != null) {
      setWeeklyGoalM(null)
    } else {
      setWeeklyGoalM(units === 'metric' ? 30_000 : Math.round(20 * M_PER_MI))
    }
  }

  function stepWeeklyGoal(dir: 1 | -1) {
    const raw = (weeklyGoalM ?? 0) + dir * weeklyStepM
    setWeeklyGoalM(Math.min(weeklyMaxM, Math.max(weeklyMinM, Math.round(raw / 10) * 10)))
  }

  return (
    <div className="h-full overflow-y-auto px-6 pt-safe pb-safe">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-2"
      >
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-muted">Tuned to you, stored on you.</p>
      </motion.header>

      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        className="mt-8 space-y-4"
      >
        {/* Units */}
        <motion.section
          variants={riseChild}
          className="rounded-3xl border border-line bg-surface p-5"
        >
          <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
            Units
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {UNIT_OPTIONS.map((opt) => {
              const active = units === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUnits(opt.id)}
                  aria-pressed={active}
                  className={`relative rounded-2xl px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-volt ${
                    active ? 'bg-volt/10' : 'bg-surface-2'
                  }`}
                >
                  <span
                    className={`font-display text-lg font-bold ${
                      active ? 'text-volt' : 'text-muted'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-[10px] text-faint">{opt.hint}</span>
                </button>
              )
            })}
          </div>
        </motion.section>

        {/* Weekly goal */}
        <motion.section
          variants={riseChild}
          className="rounded-3xl border border-line bg-surface p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
                Weekly goal
              </h2>
              <p className="mt-1 text-[11px] text-faint">
                A distance to hit every week.
              </p>
            </div>
            <Switch on={weeklyGoalM != null} onToggle={toggleWeeklyGoal} />
          </div>
          {weeklyGoalM != null && (
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2">
              <motion.button
                type="button"
                aria-label="Decrease weekly goal"
                whileTap={{ scale: 0.88 }}
                onClick={() => stepWeeklyGoal(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-xl font-bold text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
              >
                −
              </motion.button>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold tabular text-volt">
                  {formatDistance(weeklyGoalM, units, 0)}
                </span>
                <span className="text-sm text-muted">{distanceLabel(units)}</span>
              </div>
              <motion.button
                type="button"
                aria-label="Increase weekly goal"
                whileTap={{ scale: 0.88 }}
                onClick={() => stepWeeklyGoal(1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-xl font-bold text-text outline-none focus-visible:ring-2 focus-visible:ring-volt"
              >
                +
              </motion.button>
            </div>
          )}
        </motion.section>

        {/* GPS accuracy cutoff */}
        <motion.section
          variants={riseChild}
          className="rounded-3xl border border-line bg-surface p-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
              GPS filter
            </h2>
            <span className="font-display text-lg font-bold tabular text-volt">
              ±{accuracyCutoffM}m
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            Fixes less accurate than this are ignored. Applies to your next run.
          </p>
          <input
            type="range"
            min={10}
            max={50}
            step={5}
            value={accuracyCutoffM}
            onChange={(e) => setAccuracyCutoffM(Number(e.target.value))}
            aria-label="GPS accuracy cutoff in meters"
            className="mt-3 w-full accent-[#C8FF2E]"
          />
        </motion.section>

        {/* Auto-pause */}
        <motion.section
          variants={riseChild}
          className="flex items-center justify-between rounded-3xl border border-line bg-surface p-5"
        >
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
              Auto-pause
            </h2>
            <p className="mt-1 text-[11px] text-faint">
              Stops the clock at lights, pauses you again when you move.
            </p>
          </div>
          <Switch on={autoPause} onToggle={() => setAutoPause(!autoPause)} />
        </motion.section>

        {/* Voice */}
        <motion.section
          variants={riseChild}
          className="flex items-center justify-between rounded-3xl border border-line bg-surface p-5"
        >
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
              Voice
            </h2>
            <p className="mt-1 text-[11px] text-faint">
              Reads splits and goal milestones aloud.
            </p>
          </div>
          <Switch on={voice} onToggle={() => setVoice(!voice)} />
        </motion.section>

        {/* Haptics */}
        <motion.section
          variants={riseChild}
          className="flex items-center justify-between rounded-3xl border border-line bg-surface p-5"
        >
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
              Haptics
            </h2>
            <p className="mt-1 text-[11px] text-faint">Buzz on start, stop and resume.</p>
          </div>
          <Switch on={haptics} onToggle={() => setHaptics(!haptics)} />
        </motion.section>

        {/* About */}
        <motion.section
          variants={riseChild}
          className="rounded-3xl border border-line bg-surface p-5"
        >
          <div className="flex items-center justify-between">
            <span className="font-display font-bold tracking-[0.22em]">TREXIMO</span>
            <span className="text-xs tabular text-faint">v0.1.0</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Offline-first GPS run tracker. Your routes never leave this device.
          </p>
        </motion.section>
      </motion.div>
    </div>
  )
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-8 w-14 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-volt ${
        on ? 'bg-volt' : 'bg-surface-2'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-1 h-6 w-6 rounded-full ${
          on ? 'right-1 bg-base' : 'left-1 bg-muted'
        }`}
      />
    </button>
  )
}
