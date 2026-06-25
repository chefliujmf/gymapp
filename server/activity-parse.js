// Parse an uploaded activity file (.fit / .gpx / .tcx) into one normalized summary
// + a downsampled GPS track, so manual-entry can prefill the form and draw a route.
// FIT is binary (Garmin/Wahoo); GPX/TCX are XML. All optional fields stay undefined
// when the file doesn't carry them (e.g. an indoor ride has no GPS → no map).
import { XMLParser } from 'fast-xml-parser'
import FitParserPkg from 'fit-file-parser'

const FitParser = FitParserPkg.default || FitParserPkg
const toArr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x])
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : undefined }
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : undefined)
const sportFrom = (s) => { s = String(s || '').toLowerCase(); return /cycl|bike|biking|ride|virtualride/.test(s) ? 'ride' : /run/.test(s) ? 'run' : /swim/.test(s) ? 'swim' : /walk|hik/.test(s) ? 'walk' : 'other' }

// Keep the route light for the UI — at most ~300 points.
function downsample(track, max = 300) {
  if (track.length <= max) return track
  const step = track.length / max
  const out = []
  for (let i = 0; i < max; i++) out.push(track[Math.floor(i * step)])
  return out
}

function finalize({ format, sport, startIso, durationSec, distanceM, avgHr, avgPower, elevationM, kcal, track, hrs, powers }) {
  const t = (track || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  return {
    format,
    sport: sport || 'other',
    startIso: startIso || null,
    durationSec: durationSec ? Math.round(durationSec) : undefined,
    distanceM: distanceM != null ? Math.round(distanceM) : undefined,
    avgHr: avgHr != null ? Math.round(avgHr) : (hrs && hrs.length ? Math.round(avg(hrs)) : undefined),
    avgPower: avgPower != null ? Math.round(avgPower) : (powers && powers.length ? Math.round(avg(powers)) : undefined),
    elevationM: elevationM != null ? Math.round(elevationM) : undefined,
    kcal: kcal != null ? Math.round(kcal) : undefined,
    hasGps: t.length > 1,
    track: downsample(t),
  }
}

function parseFit(buffer) {
  return new Promise((resolve, reject) => {
    const fp = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true, mode: 'list' })
    fp.parse(buffer, (err, data) => {
      if (err) return reject(new Error('FIT parse failed: ' + err))
      const recs = toArr(data.records)
      const ses = toArr(data.sessions)[0] || {}
      const track = [], hrs = [], powers = []
      for (const r of recs) {
        const lat = num(r.position_lat), lng = num(r.position_long)
        if (lat != null && lng != null) track.push([lat, lng])
        if (r.heart_rate != null) hrs.push(num(r.heart_rate))
        if (r.power != null) powers.push(num(r.power))
      }
      const start = ses.start_time || (recs[0] && recs[0].timestamp)
      resolve(finalize({
        format: 'fit', sport: sportFrom(ses.sport),
        startIso: start ? new Date(start).toISOString() : null,
        durationSec: num(ses.total_timer_time) ?? num(ses.total_elapsed_time),
        distanceM: num(ses.total_distance),
        avgHr: num(ses.avg_heart_rate), avgPower: num(ses.avg_power),
        elevationM: num(ses.total_ascent), kcal: num(ses.total_calories),
        track, hrs, powers,
      }))
    })
  })
}

function deepFindHr(ext) {
  // GPX HR lives under a namespaced TrackPointExtension; find any *hr key.
  if (!ext || typeof ext !== 'object') return undefined
  for (const [k, v] of Object.entries(ext)) {
    if (/hr$/i.test(k) || /heartrate/i.test(k)) { const n = num(v); if (n != null) return n }
    if (typeof v === 'object') { const f = deepFindHr(v); if (f != null) return f }
  }
  return undefined
}

function parseXml(xml) {
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = p.parse(xml)
  if (doc.gpx) return parseGpx(doc.gpx)
  if (doc.TrainingCenterDatabase) return parseTcx(doc.TrainingCenterDatabase)
  throw new Error('Unrecognized XML (not GPX or TCX)')
}

function parseGpx(gpx) {
  const trks = toArr(gpx.trk)
  const track = [], hrs = [], times = [], eles = []
  let name = ''
  for (const trk of trks) {
    if (!name && trk.name) name = String(trk.name)
    for (const seg of toArr(trk.trkseg)) for (const pt of toArr(seg.trkpt)) {
      const lat = num(pt['@_lat']), lng = num(pt['@_lon'])
      if (lat != null && lng != null) track.push([lat, lng])
      if (pt.time) times.push(new Date(pt.time).getTime())
      if (pt.ele != null) eles.push(num(pt.ele))
      const hr = deepFindHr(pt.extensions); if (hr != null) hrs.push(hr)
    }
  }
  let elevationM
  if (eles.length > 1) { elevationM = 0; for (let i = 1; i < eles.length; i++) { const d = eles[i] - eles[i - 1]; if (d > 0) elevationM += d } }
  const durationSec = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 1000 : undefined
  return finalize({
    format: 'gpx', sport: sportFrom(name || gpx.trk?.type),
    startIso: times.length ? new Date(Math.min(...times)).toISOString() : null,
    durationSec, elevationM, track, hrs,
  })
}

function parseTcx(db) {
  const acts = toArr(db.Activities && db.Activities.Activity)
  const a = acts[0] || {}
  const laps = toArr(a.Lap)
  const track = [], hrs = [], powers = []
  let durationSec = 0, distanceM = 0, kcal = 0
  for (const lap of laps) {
    durationSec += num(lap.TotalTimeSeconds) || 0
    distanceM += num(lap.DistanceMeters) || 0
    kcal += num(lap.Calories) || 0
    for (const tp of toArr(lap.Track && lap.Track.Trackpoint)) {
      const lat = num(tp.Position && tp.Position.LatitudeDegrees)
      const lng = num(tp.Position && tp.Position.LongitudeDegrees)
      if (lat != null && lng != null) track.push([lat, lng])
      const hr = num(tp.HeartRateBpm && tp.HeartRateBpm.Value); if (hr != null) hrs.push(hr)
      const w = tp.Extensions && deepFindWatts(tp.Extensions); if (w != null) powers.push(w)
    }
  }
  const lapAvgHr = avg(laps.map((l) => num(l.AverageHeartRateBpm && l.AverageHeartRateBpm.Value)).filter((x) => x != null))
  return finalize({
    format: 'tcx', sport: sportFrom(a['@_Sport']),
    startIso: a.Id ? new Date(a.Id).toISOString() : (laps[0] && laps[0]['@_StartTime'] ? new Date(laps[0]['@_StartTime']).toISOString() : null),
    durationSec: durationSec || undefined, distanceM: distanceM || undefined, kcal: kcal || undefined,
    avgHr: lapAvgHr, track, hrs, powers,
  })
}
function deepFindWatts(ext) {
  if (!ext || typeof ext !== 'object') return undefined
  for (const [k, v] of Object.entries(ext)) {
    if (/watts$/i.test(k)) { const n = num(v); if (n != null) return n }
    if (typeof v === 'object') { const f = deepFindWatts(v); if (f != null) return f }
  }
  return undefined
}

/** Parse a Buffer of an activity file by extension/content → normalized summary. */
export async function parseActivityFile(name, buffer) {
  const ext = String(name || '').toLowerCase().split('.').pop()
  if (ext === 'fit') return parseFit(buffer)
  const xml = buffer.toString('utf8')
  if (ext === 'gpx' || ext === 'tcx' || /^<\?xml|<gpx|<TrainingCenterDatabase/.test(xml.slice(0, 200))) return parseXml(xml)
  throw new Error('Unsupported file type: .' + ext + ' (use .fit, .gpx or .tcx)')
}
