import type { Transition, Variants } from 'framer-motion'

/** Snappy press feedback */
export const pressSpring: Transition = { type: 'spring', stiffness: 520, damping: 30 }

/** Softer element entrances */
export const softSpring: Transition = { type: 'spring', stiffness: 280, damping: 26 }

/** Page-level easing (expo-out feel) */
export const pageEase: Transition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] }

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

/** Parent that staggers its children */
export const staggerParent: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.06 } },
}

/** Child rising into place */
export const riseChild: Variants = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: pageEase },
}

/** Bottom sheet */
export const sheetVariants: Variants = {
  initial: { y: '100%' },
  animate: { y: 0, transition: { type: 'spring', stiffness: 380, damping: 36 } },
  exit: { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
}

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}
