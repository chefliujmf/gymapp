/** Local-date key YYYY-MM-DD. Uses LOCAL components, not UTC — `toISOString()`
 * rolls to the next day in the evening (UTC ahead of the Americas). */
export const localISO = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
