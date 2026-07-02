import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { authApi } from './auth/api'

// Equipment the user owns — drives the Train filters (#20) AND the coach's exercise picks (#32).
// Stored on the profile (info.equipment). #320: lives on PROFILE (a coaching input like sports/diet/
// availability), not Settings. Bodyweight is always available. Values match the catalog equipment tags.
const EQUIPMENT = ['Bodyweight', 'Dumbbell', 'Barbell', 'Kettlebell', 'Bands', 'Bench', 'Pull-up bar', 'Cable', 'Machine', 'Ball', 'Plate', 'TRX', 'Trainer / bike']

export default function EquipmentPicker() {
  const { user, refresh } = useAuth()
  const [sel, setSel] = useState<string[]>(() => { const e = (user?.info as { equipment?: string[] } | undefined)?.equipment; return Array.isArray(e) && e.length ? e : ['Bodyweight'] })
  const [saved, setSaved] = useState(false)
  const toggle = (e: string) => {
    if (e === 'Bodyweight') return
    const next = sel.includes(e) ? sel.filter((x) => x !== e) : [...sel, e]
    setSel(next)
    // refresh so the onboarding checklist/step ticks off once equipment is set (#307/#310)
    authApi.saveProfile({ equipment: next }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 1500); refresh().catch(() => {}) }).catch(() => {})
  }
  return (
    <>
      <div className="section-title" id="ob-equipment">My equipment{saved && <span className="meta" style={{ fontWeight: 400 }}> · Saved ✓</span>}</div>
      <p className="meta" style={{ margin: '0 2px 8px' }}>Tick what you have — filters the library and the coach to what you can actually do.</p>
      <div className="chips">{EQUIPMENT.map((e) => <button key={e} className={'chip' + ((e === 'Bodyweight' || sel.includes(e)) ? ' chip--active' : '')} onClick={() => toggle(e)}>{e}</button>)}</div>
    </>
  )
}
