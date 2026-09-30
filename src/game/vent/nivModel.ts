/**
 * Non-invasive ventilation for acute hypercapnic respiratory failure (BTS/ICS 2016): a full face mask, IPAP 15
 * titrated up to 20, EPAP 3–5, a backup rate, and oxygen entrained to SpO2 88–92%. Pure, for the test.
 */

export type Mask = 'full-face' | 'nasal' | 'non-rebreather'
export type NivSettings = { mask: Mask | null; ipap: number; epap: number; rate: number; fio2: number }
export type NivKey = 'ipap' | 'epap' | 'rate' | 'fio2'

export function nivDefaults(): NivSettings {
  return { mask: null, ipap: 10, epap: 4, rate: 10, fio2: 21 }
}

export const NIV_RANGES: Record<NivKey, { min: number; max: number; step: number; unit: string; label: string }> = {
  ipap: { min: 4, max: 30, step: 1, unit: 'cmH2O', label: 'IPAP' },
  epap: { min: 2, max: 12, step: 1, unit: 'cmH2O', label: 'EPAP' },
  rate: { min: 0, max: 30, step: 1, unit: '/min', label: 'Rate' },
  fio2: { min: 21, max: 100, step: 7, unit: '%', label: 'O2' },
}

export function nudgeNiv(s: NivSettings, key: NivKey, dir: 1 | -1): NivSettings {
  const r = NIV_RANGES[key]
  return { ...s, [key]: Math.max(r.min, Math.min(r.max, s[key] + dir * r.step)) }
}

export const NIV_MARKS = ['mask', 'pressures', 'rate', 'oxygen'] as const

export type NivCheck = { key: (typeof NIV_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string }

export function checkNiv(s: NivSettings): NivCheck[] {
  const pressuresOk = s.ipap >= 12 && s.ipap <= 20 && s.epap >= 3 && s.epap <= 5 && s.ipap - s.epap >= 8
  return [
    { key: 'mask', label: 'Mask', value: s.mask ?? 'none', range: 'Full face mask', ok: s.mask === 'full-face', why: 'Breathless patients mouth-breathe: a nasal mask leaks.' },
    { key: 'pressures', label: 'IPAP / EPAP', value: `${s.ipap} / ${s.epap} cmH2O`, range: 'IPAP 15 (12–20), EPAP 3–5', ok: pressuresOk, why: 'Start IPAP about 15 and titrate to 20 over 10–30 minutes; the difference between them is what ventilates.' },
    { key: 'rate', label: 'Backup rate', value: `${s.rate} /min`, range: '12–20 /min', ok: s.rate >= 12 && s.rate <= 20, why: 'A backup rate covers him if he tires or stops triggering.' },
    { key: 'oxygen', label: 'O2', value: `${s.fio2}%`, range: '28–40% (SpO2 88–92%)', ok: s.fio2 >= 28 && s.fio2 <= 40, why: 'Controlled oxygen: too much worsens hypercapnia in COPD.' },
  ]
}
