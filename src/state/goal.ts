import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RunGoal } from '../lib/goals'

interface GoalState {
  /** the per-run goal applied to the next / current run */
  runGoal: RunGoal
  /** weekly distance target in meters; null when off */
  weeklyGoalM: number | null
  setRunGoal: (g: RunGoal) => void
  setWeeklyGoalM: (m: number | null) => void
}

export const useGoal = create<GoalState>()(
  persist(
    (set) => ({
      runGoal: { kind: 'none' },
      weeklyGoalM: null,
      setRunGoal: (runGoal) => set({ runGoal }),
      setWeeklyGoalM: (weeklyGoalM) => set({ weeklyGoalM }),
    }),
    { name: 'treximo-goal' },
  ),
)
