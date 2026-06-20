// Credit for content from sources whose licence asks for (or merits) attribution.
// Surfaced subtly on the relevant detail pages. Scraped personal-use sources
// (Centr, MuscleWiki) are intentionally not credited here — see content-manifest.json
// for the full per-source licence/commercial flags.
export interface Attribution { label: string; license: string; url?: string }

const MAP: Record<string, Attribution> = {
  'free-exercise-db': { label: 'free-exercise-db', license: 'Public Domain (Unlicense)', url: 'https://github.com/yuhonas/free-exercise-db' },
  'themealdb': { label: 'TheMealDB', license: 'Free API — attribution required', url: 'https://www.themealdb.com' },
}

export const attributionFor = (source?: string): Attribution | undefined => (source ? MAP[source] : undefined)
