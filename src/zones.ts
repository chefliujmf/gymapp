// Power zones (% of FTP) — ONE source of truth for every profile/thumbnail/chart so
// they always agree (#72). Boundaries are Coggan: Z1 recovery ≤55 · Z2 endurance 56–75
// · Z3 tempo 76–90 · Z4 threshold 91–105 · Z5 VO₂max 106–120 · Z6 anaerobic >120.

/** The power a segment is COLORED by — the segment's peak (so a thumbnail and the
 *  detail profile pick the same zone for the same segment). */
export const segPower = (s: { powerStart: number; powerEnd: number }) => Math.max(s.powerStart, s.powerEnd)

/** Zone index 0–5 for a % of FTP. */
export const zoneIndex = (pct: number): number =>
  pct < 56 ? 0 : pct < 76 ? 1 : pct < 91 ? 2 : pct < 106 ? 3 : pct < 121 ? 4 : 5

const ZONE_COLORS = ['#7fd1ff', '#43d9a3', '#ffd23f', '#ff9f43', '#ff6b6b', '#e63946']
const ZONE_NAMES = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO₂max', 'Anaerobic']

export const zoneColor = (pct: number): string => ZONE_COLORS[zoneIndex(pct)]
export const zoneName = (pct: number): string => ZONE_NAMES[zoneIndex(pct)]
/** A representative %FTP for each zone index (for legends/bars). */
export const ZONE_PCT = [50, 68, 83, 98, 113, 130]
