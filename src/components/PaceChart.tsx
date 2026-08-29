import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { GeoPoint } from '../lib/geo'
import { paceSeriesSecPerKm } from '../lib/pace'
import { formatPace } from '../lib/pace'
import { paceToDisplaySec } from '../lib/format'
import type { Units } from '../state/settings'

/**
 * Pace-over-distance area chart sampled every 100 m. Buckets spanning GPS
 * dropouts are null and split the line; extreme outliers are capped so one
 * bad fix doesn't flatten the whole profile. Draws itself on mount.
 */
export function PaceChart({
  points,
  units,
  width = 340,
  height = 120,
}: {
  points: readonly GeoPoint[]
  units: Units
  width?: number
  height?: number
}) {
  const chart = useMemo(() => buildChart(points), [points])

  if (!chart) return null
  const { paths, minSec, maxSec } = chart

  const fmt = (secPerKm: number) =>
    formatPace(paceToDisplaySec(secPerKm, units))

  return (
    <figure className="rounded-3xl border border-line bg-surface px-2 py-4" style={{ margin: 0 }}>
      <figcaption className="mb-1 flex items-baseline justify-between px-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
          Pace
        </span>
        <span className="text-[10px] tabular text-faint">
          <span className="text-volt">{fmt(minSec)}</span>
          {' · '}
          {fmt(maxSec)}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Pace over distance">
        <defs>
          <linearGradient id="pace-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4a8de" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f4a8de" stopOpacity="0" />
          </linearGradient>
        </defs>
        {paths.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="#f4a8de"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.2 }}
            style={{
              filter: 'drop-shadow(0 0 4px rgba(244,168,222,0.3))',
              transformOrigin: 'top',
            }}
          />
        ))}
      </svg>
    </figure>
  )
}

interface ChartData {
  paths: string[]
  minSec: number
  maxSec: number
}

function buildChart(points: readonly GeoPoint[]): ChartData | null {
  const W = 340
  const H = 120
  const PAD_X = 8
  const PAD_Y = 10
  // Raw 100 m buckets → light centered smoothing that skips gaps.
  const raw = paceSeriesSecPerKm(points, 100)
  if (raw.length < 3) return null

  const smooth = raw.map((_, i) => {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - 1); j <= Math.min(raw.length - 1, i + 1); j++) {
      const v = raw[j]
      if (v != null) {
        sum += v
        n++
      }
    }
    return n > 0 ? sum / n : null
  })

  const valid = smooth.filter((v): v is number => v != null)
  if (valid.length < 3) return null

  const sorted = [...valid].sort((a, b) => a - b)
  const min = sorted[0]!
  // Cap outliers at ~92nd percentile so one wild bucket can't flatten the rest.
  const max = Math.max(
    min * 1.05,
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.92))]!,
  )

  const n = smooth.length
  const x = (i: number) => PAD_X + (i / (n - 1)) * (W - PAD_X * 2)
  const y = (v: number) =>
    PAD_Y + (1 - (Math.min(Math.max(v, min), max) - min) / (max - min)) * (H - PAD_Y * 2)

  const paths: string[] = []
  let cur = ''
  for (let i = 0; i < n; i++) {
    const v = smooth[i]
    if (v == null) {
      if (cur) paths.push(cur)
      cur = ''
      continue
    }
    cur += `${cur === '' ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
  }
  if (cur) paths.push(cur)

  // Report the display range after capping.
  const shown = valid.map((v) => Math.min(Math.max(v, min), max))
  return {
    paths,
    minSec: Math.min(...shown),
    maxSec: Math.max(...shown),
  }
}
