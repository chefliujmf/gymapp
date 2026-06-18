import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Short beeps via Web Audio for countdown cues. The AudioContext is created
 * lazily and resumed on use, so the first call must happen after a user gesture
 * (entering the player counts). No-op if Web Audio is unavailable.
 */
export function useBeeper() {
  const ctxRef = useRef<AudioContext | null>(null)
  return useCallback((freq = 880, dur = 0.12, gain = 0.25) => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!ctxRef.current) ctxRef.current = new AC()
      const c = ctxRef.current
      if (c.state === 'suspended') c.resume()
      const o = c.createOscillator(); const g = c.createGain()
      o.type = 'sine'; o.frequency.value = freq
      o.connect(g); g.connect(c.destination)
      const t = c.currentTime
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t); o.stop(t + dur)
    } catch { /* no audio */ }
  }, [])
}

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

/** Spoken cues via the Web Speech API — for hands-free running guidance. */
export function useSpeech() {
  return useCallback((text: string) => {
    try {
      if (!('speechSynthesis' in window)) return
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch { /* no TTS */ }
  }, [])
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
