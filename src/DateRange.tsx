import { localISO } from './date'

// #226 tweak (JM 2026-06-30): every date filter shows always-editable From/To date pickers; the
// preset chips just PREFILL them. One shared control across all Stats pages + History.
export interface RangePreset { label: string; days: number }

// Per-context preset sets (#225): recovery is short-horizon, training trends want months.
export const RECOVERY_PRESETS: RangePreset[] = [{ label: '7 d', days: 7 }, { label: '30 d', days: 30 }, { label: '60 d', days: 60 }]
export const TRAINING_PRESETS: RangePreset[] = [{ label: '6 wk', days: 42 }, { label: '3 mo', days: 90 }, { label: '6 mo', days: 180 }, { label: '1 yr', days: 365 }]

export function DateRangeFilter({ presets, from, to, onChange }: { presets: RangePreset[]; from: string; to: string; onChange: (from: string, to: string) => void }) {
  const today = localISO()
  const activeDays = presets.find((p) => to === today && from === localISO(new Date(Date.now() - p.days * 86400000)))?.days ?? null
  return (
    <div className="drf">
      <div className="chips">
        {presets.map((p) => (
          <button key={p.days} className={'chip' + (activeDays === p.days ? ' chip--active' : '')} onClick={() => onChange(localISO(new Date(Date.now() - p.days * 86400000)), today)}>{p.label}</button>
        ))}
      </div>
      <div className="date-range">
        <label>From<input type="date" value={from} max={today} onChange={(e) => onChange(e.target.value, to)} /></label>
        <label>To<input type="date" value={to} max={today} onChange={(e) => onChange(from, e.target.value)} /></label>
      </div>
    </div>
  )
}
