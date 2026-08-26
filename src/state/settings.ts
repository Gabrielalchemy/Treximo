import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Units = 'metric' | 'imperial'

interface SettingsState {
  units: Units
  /** fixes with accuracy worse than this are rejected (meters) */
  accuracyCutoffM: number
  haptics: boolean
  /** pause automatically when the runner stops; resume on movement */
  autoPause: boolean
  /** read splits and goal milestones aloud while recording */
  voice: boolean
  setUnits: (u: Units) => void
  setAccuracyCutoffM: (m: number) => void
  setHaptics: (on: boolean) => void
  setAutoPause: (on: boolean) => void
  setVoice: (on: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      units: 'metric',
      accuracyCutoffM: 25,
      haptics: true,
      autoPause: true,
      voice: false,
      setUnits: (units) => set({ units }),
      setAccuracyCutoffM: (accuracyCutoffM) => set({ accuracyCutoffM }),
      setHaptics: (haptics) => set({ haptics }),
      setAutoPause: (autoPause) => set({ autoPause }),
      setVoice: (voice) => set({ voice }),
    }),
    { name: 'treximo-settings' },
  ),
)
