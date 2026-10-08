/**
 * A manual defibrillator: pads, SYNC, energy, charge, "all clear", shock. Pure, so the test can score a run.
 * Rhythms: `af` and `vt` (with a pulse) need a synchronised shock; `vf` needs an unsynchronised one — and a
 * synchronised shock in VF never fires, because there is no R wave to wait for.
 */

export type Rhythm = 'af' | 'vt' | 'vf'
export type Pt = { x: number; y: number }

/**
 * Front of the chest, 200 × 200: the nipples are at y 104, the chest edge (mid-axillary line) at x ≈ 165–170.
 * The two antero-lateral pad sites: below the right clavicle, and the left mid-axillary line at V6 (about nipple
 * level, 5th space), clear of the breast.
 */
export const SITES = {
  sternal: { x: 70, y: 62, r: 26, name: 'right infraclavicular' },
  apical: { x: 160, y: 114, r: 24, name: 'apex, left mid-axillary line (V6)' },
} as const

/** `refractory`: done right, the rhythm still does not change (the first shocks of a VF arrest). */
export type DefibSpec = { rhythm: Rhythm; sync: boolean; energy: [number, number]; label: string; why: string; refractory?: boolean; padsOn?: boolean }

export function defibSpec(pose?: string): DefibSpec {
  // AHA: 100 J synchronised for monomorphic VT; RCUK: 120–150 J. Either passes.
  if (pose === 'vt') return { rhythm: 'vt', sync: true, energy: [100, 200], label: 'VT with a pulse', why: 'Monomorphic VT with a pulse: synchronised, 100 J (AHA) or 120–150 J biphasic, escalating.' }
  // AHA: 120–200 J biphasic as the maker advises (or the maximum); RCUK: at least 150 J. Either passes.
  // A later shock in the same arrest: the pads are already on.
  if (pose === 'vf-again') return { rhythm: 'vf', sync: false, energy: [120, 360], label: 'VF at the rhythm check', why: 'Still VF: unsynchronised, the same or a higher energy; resume CPR at once.', refractory: true, padsOn: true }
  if (pose === 'vf-arrest') return { rhythm: 'vf', sync: false, energy: [120, 360], label: 'VF arrest', why: 'VF: unsynchronised, 120–200 J biphasic (as the maker advises) or the maximum; resume CPR at once.', refractory: true }
  if (pose === 'vf') return { rhythm: 'vf', sync: false, energy: [120, 360], label: 'VF', why: 'VF: unsynchronised, 120–200 J biphasic (as the maker advises) or the maximum.' }
  return { rhythm: 'af', sync: true, energy: [150, 200], label: 'AF with adverse features', why: 'AF: synchronised, a high first energy (150–200 J biphasic).' }
}

export type DefibRun = {
  pads: Pt[]
  sync: boolean
  energy: number
  charged: boolean
  clearCalled: boolean
  shocked: boolean
  /** Shocks attempted with SYNC on in VF: nothing happens. */
  syncStalls: number
  unsafe: boolean
  converted: boolean
}

export function freshDefib(spec?: DefibSpec): DefibRun {
  const pads = spec?.padsOn ? [{ x: SITES.sternal.x, y: SITES.sternal.y }, { x: SITES.apical.x, y: SITES.apical.y }] : []
  return { pads, sync: false, energy: spec?.padsOn ? 200 : 150, charged: false, clearCalled: false, shocked: false, syncStalls: 0, unsafe: false, converted: false }
}

export const ENERGIES = [50, 70, 100, 120, 150, 200, 300, 360]

export function padSites(pads: Pt[]) {
  const near = (p: Pt, s: { x: number; y: number; r: number }) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r
  const sternal = pads.some((p) => near(p, SITES.sternal))
  const apical = pads.some((p) => near(p, SITES.apical))
  return { sternal, apical, ok: pads.length === 2 && sternal && apical }
}

/** Press SHOCK. Returns what happened. */
export function shock(run: DefibRun, spec: DefibSpec): { patch: Partial<DefibRun>; event: 'no-charge' | 'no-pads' | 'waits' | 'fired' } {
  if (!run.charged) return { patch: {}, event: 'no-charge' }
  if (run.pads.length < 2) return { patch: {}, event: 'no-pads' }
  if (run.sync && spec.rhythm === 'vf') return { patch: { syncStalls: run.syncStalls + 1 }, event: 'waits' }
  const unsafe = !run.clearCalled
  const works = !spec.refractory && padSites(run.pads).ok && (spec.rhythm === 'vf' ? !run.sync : run.sync) && run.energy >= spec.energy[0]
  return { patch: { shocked: true, charged: false, unsafe: run.unsafe || unsafe, converted: run.converted || works }, event: 'fired' }
}

export type DefibCheck = { key: 'pads' | 'sync' | 'energy' | 'safety'; label: string; value: string; range: string; ok: boolean; why: string }

export function checkDefib(run: DefibRun, spec: DefibSpec): DefibCheck[] {
  const pads = padSites(run.pads)
  return [
    { key: 'pads', label: 'Pads', value: pads.ok ? 'Antero-lateral' : run.pads.length < 2 ? 'Not both on' : 'Misplaced', range: 'Right infraclavicular + apex (V6, mid-axillary)', ok: pads.ok, why: 'The current must cross the heart; the apical pad goes low and lateral, not on the breast.' },
    { key: 'sync', label: 'SYNC', value: run.sync ? 'On' : 'Off', range: spec.sync ? 'On' : 'Off', ok: run.sync === spec.sync, why: spec.sync ? 'With a pulse, the shock must land on the R wave, not the T wave (R-on-T causes VF).' : 'VF has no R waves: a synchronised shock never fires.' },
    { key: 'energy', label: 'Energy', value: `${run.energy} J`, range: `${spec.energy[0]}–${spec.energy[1]} J biphasic`, ok: run.energy >= spec.energy[0] && run.energy <= spec.energy[1], why: spec.why },
    { key: 'safety', label: 'Safety', value: run.unsafe ? 'Shocked without "all clear"' : run.shocked ? '"All clear, oxygen away"' : 'No shock', range: '"All clear, oxygen away" before every shock', ok: run.shocked && !run.unsafe, why: 'Everyone off the bed and the oxygen away before the shock.' },
  ]
}

/** The station's marks for this bench, in the order they are written on the option. */
export const DEFIB_MARKS = ['pads', 'sync', 'energy', 'safety'] as const

export function scoreDefib(run: DefibRun, spec: DefibSpec) {
  const rows = checkDefib(run, spec)
  const earned = rows.filter((r) => r.ok).map((r) => r.key)
  const faults = rows
    .filter((r) => !r.ok)
    .map((r) => ({ text: `${r.label}: ${r.value}. ${r.why}`, critical: (r.key === 'sync' && spec.sync && run.shocked) || (r.key === 'safety' && run.unsafe) }))
  if (run.syncStalls) faults.push({ text: `SYNC was on in VF: the shock waited for an R wave that never came (${run.syncStalls} time${run.syncStalls === 1 ? '' : 's'}).`, critical: false })
  return { earned, faults }
}
