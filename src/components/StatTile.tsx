import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { riseChild } from '../motion/variants'
import { AnimatedNumber } from './AnimatedNumber'

interface StatTileProps {
  label: string
  value: string
  unit?: string
  /** Volt glow for the hero metric */
  hero?: boolean
  size?: 'md' | 'lg' | 'xl'
  children?: ReactNode
}

const SIZES = {
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-6xl sm:text-7xl',
} as const

export function StatTile({ label, value, unit, hero, size = 'lg' }: StatTileProps) {
  return (
    <motion.div variants={riseChild} className="flex flex-col items-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1.5">
        <AnimatedNumber
          text={value}
          className={`font-display font-bold leading-none tracking-tight tabular ${
            SIZES[size]
          } ${hero ? 'text-volt drop-shadow-[0_0_24px_rgba(200,255,46,0.25)]' : 'text-text'}`}
        />
        {unit && (
          <span className="text-sm font-medium text-muted">{unit}</span>
        )}
      </div>
    </motion.div>
  )
}
