import { useEffect } from 'react'

interface WakeLockSentinel {
  release: () => Promise<void>
}

/**
 * Keep the screen awake while `active` is true. Re-acquires automatically
 * when the tab becomes visible again (browsers drop the lock when hidden).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (released) {
          void lock.release()
          return
        }
        sentinel = lock as unknown as WakeLockSentinel
      } catch {
        // Denied or unsupported — not critical.
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && sentinel === null) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
