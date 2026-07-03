// #341 — turn a day's forecast into COACHING guidance (heat derating, hydration, cold, wind, rain), so
// the coach can adjust an outdoor session ("32°C → ease intensity / hydrate / move indoors"). Pure +
// unit-tested (weather.test.js). Temps in °C, wind in km/h, precip probability in %.

export function weatherGuidance({ tMax = null, tApparentMax = null, tMin = null, precipProb = null, windMax = null } = {}) {
  const feels = tApparentMax != null ? tApparentMax : tMax
  const flags = []
  const notes = []

  // Heat is the big one — the coach should DERATE quality when it's hot (pace/power hold at a higher HR cost).
  let heat = 'none'
  if (feels != null) {
    if (feels >= 35) {
      heat = 'extreme'
      notes.push('Extreme heat — move the session indoors or to the coolest hour (early AM), or make it easy/short. Cut quality targets; go by feel/HR, not pace/power. Aggressive hydration + electrolytes; stop on any heat-illness sign (dizzy, chills, goosebumps).')
    } else if (feels >= 30) {
      heat = 'high'
      notes.push('Hot — trim intensity: ease target pace ~10–20 s/km (or hold power/pace by FEEL, expecting HR ~5–10 bpm higher). Prefer shade/early AM or indoors for anything hard. Pre-hydrate + carry fluid with electrolytes.')
    } else if (feels >= 26) {
      heat = 'moderate'
      notes.push('Warm — HR will read higher for the same pace/power; judge easy days by FEEL, keep them easy, and hydrate. Fine for quality with a good warm-up and fluid.')
    }
  }
  if (heat !== 'none') flags.push(`heat:${heat}`)

  if (tMin != null && tMin <= 0) { flags.push('cold'); notes.push('Freezing — layer up, extend the warm-up, protect the airways; watch for ice underfoot/on descents.') }
  else if (tMin != null && tMin <= 5) { flags.push('chilly'); notes.push('Cold start — a longer warm-up and a layer you can shed.') }

  if (windMax != null && windMax >= 30) { flags.push('windy'); notes.push('Windy — on the bike, ride to EFFORT not speed (splits into the wind will look slow); on foot, expect the headwind stretch to feel harder.') }

  if (precipProb != null && precipProb >= 60) { flags.push('wet'); notes.push('Likely rain — mind grip/visibility; consider moving a quality session indoors.') }

  const parts = []
  if (feels != null) parts.push(`feels like ${Math.round(feels)}°C`)
  if (tMax != null && tApparentMax != null && Math.round(tMax) !== Math.round(tApparentMax)) parts.push(`air ${Math.round(tMax)}°C`)
  if (windMax != null) parts.push(`wind ${Math.round(windMax)} km/h`)
  if (precipProb != null) parts.push(`${Math.round(precipProb)}% rain`)
  const summary = parts.join(' · ')

  return { feels, heat, flags, notes, summary }
}
