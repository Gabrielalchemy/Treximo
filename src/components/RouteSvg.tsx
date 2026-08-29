import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { toSvgPath, type GeoPoint } from '../lib/geo'

/**
 * Renders a run route as an animated SVG polyline — no map tiles, fully
 * offline. The path draws itself on mount (pathLength 0→1), then the start
 * and end markers pop in.
 */
export function RouteSvg({
  points,
  width = 340,
  height = 240,
  animate = true,
}: {
  points: readonly GeoPoint[]
  width?: number
  height?: number
  animate?: boolean
}) {
  const path = useMemo(() => toSvgPath(points, width, height, 22), [points, width, height])

  if (!path || points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-3xl border border-line bg-surface text-xs text-faint"
        style={{ width: '100%', maxWidth: width, height }}
      >
        Route not recorded
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-3xl border border-line bg-surface"
      style={{ maxHeight: height }}
      role="img"
      aria-label="Run route"
    >
      <motion.path
        d={path.d}
        fill="none"
        stroke="#f4a8de"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0, opacity: 0.6 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.8, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 0 6px rgba(244,168,222,0.35))' }}
      />
      <motion.circle
        cx={path.startX}
        cy={path.startY}
        r={5}
        fill="#F2F4F6"
        stroke="#f4a8de"
        strokeWidth={2.5}
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.7, type: 'spring', stiffness: 400, damping: 20 }}
      />
      <motion.g
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.85, type: 'spring', stiffness: 400, damping: 18 }}
        style={{ originX: `${path.endX}px`, originY: `${path.endY}px` }}
      >
        <circle cx={path.endX} cy={path.endY} r={9} fill="rgba(244,168,222,0.25)" />
        <circle cx={path.endX} cy={path.endY} r={4.5} fill="#f4a8de" />
      </motion.g>
    </svg>
  )
}
