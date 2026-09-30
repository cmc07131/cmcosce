/**
 * A transport ventilator, laid out like the common ED models (Oxylog 3000 style): a mode, three main settings on
 * rotary knobs (FiO2, tidal volume, rate) and two on the screen (PEEP, Pmax). Pure, so the test can score it.
 */

export type Mode = 'VC-CMV' | 'VC-SIMV' | 'PC-BIPAP' | 'CPAP'
export const MODES: Mode[] = ['VC-CMV', 'VC-SIMV', 'PC-BIPAP', 'CPAP']

export type Setting = 'fio2' | 'vt' | 'rr' | 'peep' | 'pmax'

export type VentSettings = { mode: Mode; fio2: number; vt: number; rr: number; peep: number; pmax: number }

/** What the machine shows when you walk up to it: switched on, adult defaults. */
export function defaults(): VentSettings {
  return { mode: 'VC-SIMV', fio2: 40, vt: 500, rr: 12, peep: 0, pmax: 60 }
}

export const RANGES: Record<Setting, { min: number; max: number; step: number; unit: string; label: string }> = {
  fio2: { min: 40, max: 100, step: 10, unit: '%', label: 'O2' },
  vt: { min: 50, max: 1000, step: 25, unit: 'mL', label: 'VT' },
  rr: { min: 5, max: 40, step: 1, unit: '/min', label: 'RR' },
  peep: { min: 0, max: 20, step: 1, unit: 'cmH2O', label: 'PEEP' },
  pmax: { min: 20, max: 60, step: 5, unit: 'cmH2O', label: 'Pmax' },
}

export function nudge(s: VentSettings, key: Setting, dir: 1 | -1): VentSettings {
  const r = RANGES[key]
  return { ...s, [key]: Math.max(r.min, Math.min(r.max, s[key] + dir * r.step)) }
}

/**
 * What this patient needs. `tca`: paralysed after RSI, 70 kg, keep her alkaline — a controlled mode, 6–8 mL/kg,
 * a faster rate to hyperventilate (pH 7.45–7.55), 100% oxygen to start, PEEP 5, a pressure limit.
 */
export type VentSpec = { weightKg: number; rr: [number, number]; why: string; co2: string; peep?: [number, number]; peepWhy?: string }

export function ventSpec(pose?: string): VentSpec {
  if (pose === 'tca') return { weightKg: 70, rr: [20, 26], why: 'Mild hyperventilation keeps her pH 7.45–7.55, which narrows the QRS.', co2: 'aim for mild hypocapnia (about 3.5–4.5) to keep the pH 7.45–7.55' }
  if (pose === 'post-arrest') return { weightKg: 80, rr: [10, 16], why: 'After ROSC: normocapnia (PaCO2 4.7–6.0 kPa). Hyperventilation lowers cerebral blood flow.', co2: 'aim for normocapnia (about 4.5–5.5)' }
  if (pose === 'burns') return { weightKg: 70, rr: [12, 18], why: 'Normocapnia; 100% oxygen washes out the carbon monoxide.', co2: 'aim for normocapnia (about 4.5–5.5)' }
  if (pose === 'drowning') return { weightKg: 60, rr: [12, 18], why: 'Normocapnia after ROSC.', co2: 'aim for normocapnia (about 4.5–5.5)', peep: [8, 10], peepWhy: 'Drowned lungs are wet and stiff: PEEP 8–10 recruits them.' }
  if (pose === 'head-injury') return { weightKg: 75, rr: [12, 18], why: 'Head injury: PaCO2 4.5–5.0 kPa. Too low starves the brain of blood; too high raises the ICP.', co2: 'aim for low-normal CO2 (about 4.0–4.8)' }
  return { weightKg: 70, rr: [12, 18], why: 'A normal rate for a normal PaCO2.', co2: 'aim for normocapnia (about 4.5–5.5)' }
}

/** The station's marks for this bench, in the order they are written on the option. */
export const VENT_MARKS = ['mode', 'volume', 'rate', 'oxygen'] as const
export type VentMark = (typeof VENT_MARKS)[number]

export type VentCheck = { key: 'mode' | Setting; label: string; value: string; range: string; ok: boolean; why: string }

/** Each setting against its acceptable range, for the check screen after START. The scoring uses the same rules. */
export function checkVent(s: VentSettings, spec: VentSpec): VentCheck[] {
  const lo = spec.weightKg * 6
  const hi = spec.weightKg * 8
  return [
    { key: 'mode', label: 'Mode', value: s.mode, range: 'VC-CMV (or PC-BIPAP)', ok: s.mode === 'VC-CMV' || s.mode === 'PC-BIPAP', why: 'Paralysed after RSI: every breath must be delivered by the machine.' },
    { key: 'vt', label: 'VT', value: `${s.vt} mL`, range: `${lo}–${hi} mL`, ok: s.vt >= lo && s.vt <= hi, why: `6–8 mL/kg for ${spec.weightKg} kg: lung-protective.` },
    { key: 'rr', label: 'RR', value: `${s.rr} /min`, range: `${spec.rr[0]}–${spec.rr[1]} /min`, ok: s.rr >= spec.rr[0] && s.rr <= spec.rr[1], why: spec.why },
    { key: 'fio2', label: 'O2', value: `${s.fio2}%`, range: '100% to start (at least 90%)', ok: s.fio2 >= 90, why: 'Start high after intubation, then titrate to SpO2 94–98%.' },
    { key: 'peep', label: 'PEEP', value: `${s.peep} cmH2O`, range: `${(spec.peep ?? [5, 8])[0]}–${(spec.peep ?? [5, 8])[1]} cmH2O`, ok: s.peep >= (spec.peep ?? [5, 8])[0] && s.peep <= (spec.peep ?? [5, 8])[1], why: spec.peepWhy ?? 'Keeps the alveoli open; 5 is the usual start.' },
    { key: 'pmax', label: 'Pmax', value: `${s.pmax} cmH2O`, range: '30–40 cmH2O (about 35)', ok: s.pmax >= 30 && s.pmax <= 40, why: 'High enough to ventilate, low enough to protect the lungs.' },
  ]
}

export function scoreVent(s: VentSettings, spec: VentSpec) {
  const earned: VentMark[] = []
  const faults: { text: string; critical?: boolean }[] = []
  const lo = spec.weightKg * 6
  const hi = spec.weightKg * 8

  if (s.mode === 'VC-CMV' || s.mode === 'PC-BIPAP') earned.push('mode')
  else faults.push({ text: `${s.mode} relies on her own breaths. She is paralysed after RSI: use a controlled mode (VC-CMV).`, critical: s.mode === 'CPAP' })

  if (s.vt >= lo && s.vt <= hi) earned.push('volume')
  else faults.push({ text: `Tidal volume ${s.vt} mL. Use 6–8 mL/kg: ${lo}–${hi} mL for ${spec.weightKg} kg.` })

  if (s.rr >= spec.rr[0] && s.rr <= spec.rr[1]) earned.push('rate')
  else faults.push({ text: `Rate ${s.rr}/min. ${spec.why} Aim for ${spec.rr[0]}–${spec.rr[1]}/min.` })

  const [pLo, pHi] = spec.peep ?? [5, 8]
  const oxyOk = s.fio2 >= 90 && s.peep >= pLo && s.peep <= pHi && s.pmax >= 30 && s.pmax <= 40
  if (oxyOk) earned.push('oxygen')
  if (s.fio2 < 90) faults.push({ text: `FiO2 ${s.fio2}%. Start at 100% after intubation, then titrate to SpO2 94–98%.` })
  if (s.peep < pLo || s.peep > pHi) faults.push({ text: `PEEP ${s.peep}. ${spec.peepWhy ?? 'Start at 5 cmH2O.'} Aim for ${pLo}–${pHi}.` })
  if (s.pmax < 30 || s.pmax > 40) faults.push({ text: `Pmax ${s.pmax}. Set the pressure limit around 35 cmH2O: high enough to ventilate, low enough to protect the lungs.` })

  // Alveolar ventilation (minus about 150 mL of dead space a breath) sets her CO2; more than normal keeps her alkaline.
  const mv = (s.vt * s.rr) / 1000
  const va = (Math.max(0, s.vt - 150) * s.rr) / 1000
  const etco2 = Math.max(2.5, Math.min(9, 4.8 * Math.pow(5.5 / Math.max(0.5, va), 0.6)))
  return { earned, faults, mv, etco2 }
}
