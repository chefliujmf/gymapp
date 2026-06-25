import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Real route map (#141): the GPS track on OpenStreetMap tiles (free, no API key).
// Tiles load live from OSM — a runtime map service, not bundled catalog media, so it
// doesn't touch the media-independence gate. Polyline + start/end pins, no markers
// images (circleMarkers are SVG) so Vite's broken-default-icon issue is avoided.
export default function RouteMapLeaflet({ track, height = 220 }: { track: [number, number][]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || track.length < 2) return
    const map = L.map(ref.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map)
    const line = L.polyline(track, { color: '#34e07d', weight: 4, opacity: 0.95 }).addTo(map)
    L.circleMarker(track[0], { radius: 6, color: '#34e07d', fillColor: '#04110a', fillOpacity: 1, weight: 3 }).addTo(map)
    L.circleMarker(track[track.length - 1], { radius: 6, color: '#ffffff', fillColor: '#04110a', fillOpacity: 1, weight: 3 }).addTo(map)
    map.fitBounds(line.getBounds(), { padding: [22, 22] })
    // the card may mount before layout settles → resize the map once it's measured
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => { clearTimeout(t); map.remove() }
  }, [track])
  if (track.length < 2) return null
  return <div ref={ref} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }} />
}
