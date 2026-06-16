import { useEffect, useRef, useState } from 'react'

/**
 * Ticking clock that is correct after the screen has been off.
 * It ticks every `intervalMs`, AND forces a recompute whenever the tab becomes
 * visible again — so a rest timer based on an absolute end-time shows the right
 * value the instant you reopen the PWA, with no drift.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs])
  return now
}

/**
 * Optional screen wake lock — keeps the display on while a workout is active,
 * for users who prefer not to lock between sets. Re-acquires on visibility.
 * No-op on browsers without the API.
 */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let released = false
    const acquire = async () => {
      try {
        lockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        /* user gesture / permission may be required; ignore */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [enabled])
}
