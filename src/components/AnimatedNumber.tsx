import { AnimatePresence, motion } from 'framer-motion'

/**
 * Text whose digits slide vertically when they change. Separators keep their
 * key position so only real digits animate. Pair with `.tabular` for stable
 * widths.
 */
export function AnimatedNumber({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <span className={className} aria-label={text}>
      {[...text].map((char, i) => {
        const isDigit = /\d/.test(char)
        const key = isDigit ? `${i}-${char}` : `sep-${i}`
        return (
          <span
            key={key}
            className="relative inline-block overflow-hidden align-baseline"
            aria-hidden
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {isDigit ? (
                <motion.span
                  key={key}
                  className="inline-block will-change-transform"
                  initial={{ y: '70%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '-70%', opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {char}
                </motion.span>
              ) : (
                <span className="inline-block">{char}</span>
              )}
            </AnimatePresence>
          </span>
        )
      })}
    </span>
  )
}
