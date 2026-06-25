import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Strava-style flyby (#51): the full route (dimmed) + a bright trace and a moving dot
// that replays the path. Real Leaflet/OSM map (#141). performance.now()-driven so the
// replay is smooth regardless of point count.
export default function FlybyMap({ track, height = 280, durationMs = 12000 }: { track: [number, number][]; height?: number; durationMs?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const dotRef = useRef<L.CircleMarker | null>(null)
  const traceRef = useRef<L.Polyline | null>(null)
  const rafRef = useRef(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!ref.current || track.length < 2) return
    const map = L.map(ref.current, { zoomControl: false, scrollWheelZoom: false })
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map)
    L.polyline(track, { color: '#34e07d', weight: 4, opacity: 0.45 }).addTo(map)
    traceRef.current = L.polyline([], { color: '#bfffe0', weight: 4, opacity: 0.95 }).addTo(map)
    L.circleMarker(track[0], { radius: 6, color: '#34e07d', fillColor: '#04110a', fillOpacity: 1, weight: 3 }).addTo(map)
    L.circleMarker(track[track.length - 1], { radius: 6, color: '#ffffff', fillColor: '#04110a', fillOpacity: 1, weight: 3 }).addTo(map)
    dotRef.current = L.circleMarker(track[0], { radius: 7, color: '#ffffff', fillColor: '#34e07d', fillOpacity: 1, weight: 3 }).addTo(map)
    map.fitBounds(L.latLngBounds(track), { padding: [24, 24] })
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => { clearTimeout(t); cancelAnimationFrame(rafRef.current); map.remove(); mapRef.current = null }
  }, [track])

  function play() {
    if (track.length < 2 || playing) return
    setPlaying(true)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const idx = Math.floor(t * (track.length - 1))
      dotRef.current?.setLatLng(track[idx])
      traceRef.current?.setLatLngs(track.slice(0, idx + 1))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else setPlaying(false)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
  }

  if (track.length < 2) return null
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }} />
      <button type="button" className="flyby-btn" onClick={play} disabled={playing}>{playing ? '● Replaying…' : '▶ Replay'}</button>
    </div>
  )
}
