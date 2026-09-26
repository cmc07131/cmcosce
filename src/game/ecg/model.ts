/**
 * A 12-lead ECG generator built from electrophysiology, not drawings.
 *
 * Each beat is a P wave, a QRS (q, R, S, optional r′), an ST segment and a T wave, with per-lead amplitudes in mV.
 * Rhythms decide when atria and ventricles fire. Diagnoses change the right leads by the textbook criteria.
 * Paper convention: 25 mm/s, 10 mm/mV, so 1 small square = 0.04 s and 0.1 mV.
 */

export const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as const
export type Lead = (typeof LEADS)[number]

/** Per-lead wave amplitudes, mV. `tw` < 1 narrows the T (peaked), > 1 broadens it. */
export type Morph = {
  p: number
  /** Second, negative phase of a biphasic P (V1). */
  p2?: number
  q: number
  r: number
  s: number
  /** Second positive deflection: RSR′ in RBBB, notched R in LBBB. */
  r2?: number
  st: number
  t: number
  tw?: number
  /** U wave (hypokalaemia). */
  u?: number
  /** PR-segment shift (pericarditis). */
  pr?: number
}

export type Conduction = {
  /** P onset to QRS onset, s. */
  pr: number
  /** QRS duration, s. */
  qrs: number
  /** QRS onset to T end, s. */
  qt: number
  /** Pre-excitation: slurred upstroke this many seconds before the QRS (WPW). */
  delta?: number
}

export type Rhythm =
  | { kind: 'sinus'; rate: number }
  | { kind: 'af'; rate: number }
  | { kind: 'flutter'; block: number }
  | { kind: 'svt'; rate: number }
  | { kind: 'vt'; rate: number; polymorphic?: boolean }
  | { kind: 'vf' }
  | { kind: 'asystole' }
  | { kind: 'mobitz1'; rate: number; cycle: number }
  | { kind: 'mobitz2'; rate: number; ratio: number }
  | { kind: 'chb'; atrial: number; ventricular: number }
  | { kind: 'paced'; rate: number; capture: boolean; native: number }
  | { kind: 'junctional'; rate: number }

export type EcgSpec = {
  id: string
  label: string
  rhythm: Rhythm
  conduction: Conduction
  morph: Record<Lead, Morph>
  /** Morphology for beats that start in the ventricles (VT, escape, paced). */
  wide: Record<Lead, Morph>
}

/* ================================================================ normal morphology */

/** A normal adult 12-lead: R-wave progression across V1–V6, aVR inverted, V1 T may be flat. */
export function normalMorph(): Record<Lead, Morph> {
  return {
    I: { p: 0.1, q: 0.05, r: 0.8, s: 0.1, st: 0, t: 0.25 },
    II: { p: 0.15, q: 0.05, r: 1.2, s: 0.1, st: 0, t: 0.3 },
    III: { p: 0.06, q: 0.05, r: 0.5, s: 0.2, st: 0, t: 0.1 },
    aVR: { p: -0.12, q: 0, r: 0.1, s: 0.8, st: 0, t: -0.25 },
    aVL: { p: 0.04, q: 0.05, r: 0.4, s: 0.2, st: 0, t: 0.1 },
    aVF: { p: 0.1, q: 0.05, r: 0.8, s: 0.1, st: 0, t: 0.2 },
    V1: { p: 0.06, p2: -0.05, q: 0, r: 0.2, s: 1.0, st: 0, t: -0.05 },
    V2: { p: 0.07, q: 0, r: 0.4, s: 1.3, st: 0.05, t: 0.4 },
    V3: { p: 0.07, q: 0, r: 0.8, s: 0.8, st: 0.03, t: 0.5 },
    V4: { p: 0.07, q: 0, r: 1.3, s: 0.4, st: 0, t: 0.5 },
    V5: { p: 0.07, q: 0.1, r: 1.4, s: 0.2, st: 0, t: 0.35 },
    V6: { p: 0.07, q: 0.1, r: 1.1, s: 0.1, st: 0, t: 0.3 },
  }
}

/** Beats from the ventricles: broad, LBBB-like from an RV focus, with the T opposite the QRS. */
export function wideMorph(): Record<Lead, Morph> {
  return {
    I: { p: 0, q: 0, r: 1.0, s: 0, r2: 0.6, st: -0.1, t: -0.3 },
    II: { p: 0, q: 0, r: 0.4, s: 0.6, st: 0.05, t: 0.2 },
    III: { p: 0, q: 0, r: 0.1, s: 0.9, st: 0.15, t: 0.3 },
    aVR: { p: 0, q: 0, r: 0.1, s: 0.8, st: 0.05, t: 0.2 },
    aVL: { p: 0, q: 0, r: 1.0, s: 0, r2: 0.5, st: -0.1, t: -0.3 },
    aVF: { p: 0, q: 0, r: 0.2, s: 0.8, st: 0.1, t: 0.25 },
    V1: { p: 0, q: 0, r: 0.1, s: 1.6, st: 0.25, t: 0.4 },
    V2: { p: 0, q: 0, r: 0.15, s: 2.0, st: 0.3, t: 0.5 },
    V3: { p: 0, q: 0, r: 0.3, s: 1.6, st: 0.2, t: 0.4 },
    V4: { p: 0, q: 0, r: 0.8, s: 0.9, st: 0, t: 0 },
    V5: { p: 0, q: 0, r: 1.3, s: 0, r2: 0.8, st: -0.15, t: -0.3 },
    V6: { p: 0, q: 0, r: 1.4, s: 0, r2: 0.9, st: -0.15, t: -0.35 },
  }
}

export function normalConduction(): Conduction {
  return { pr: 0.16, qrs: 0.09, qt: 0.38 }
}

export function sinus(rate = 75, id = 'sinus', label = 'Sinus rhythm'): EcgSpec {
  return { id, label, rhythm: { kind: 'sinus', rate }, conduction: normalConduction(), morph: normalMorph(), wide: wideMorph() }
}

/* ================================================================ diagnoses */

type Patch = Partial<Morph>
function apply(spec: EcgSpec, leads: Lead[], patch: Patch | ((m: Morph) => Patch)): EcgSpec {
  const morph = { ...spec.morph }
  for (const l of leads) morph[l] = { ...morph[l], ...(typeof patch === 'function' ? patch(morph[l]) : patch) }
  return { ...spec, morph }
}
function relabel(spec: EcgSpec, id: string, label: string): EcgSpec {
  return { ...spec, id, label }
}

export type Territory = 'inferior' | 'anterior' | 'anterolateral' | 'lateral' | 'posterior'

/**
 * Acute STEMI: ST elevation in the territory's leads, reciprocal depression opposite, tall T waves.
 * Inferior: II, III, aVF (III ≥ II suggests RCA); reciprocal I and aVL.
 * Posterior: ST depression with tall R and upright T in V1–V3 (the mirror of posterior elevation).
 */
export function stemi(territory: Territory, base = sinus(88)): EcgSpec {
  let s = base
  if (territory === 'inferior') {
    s = apply(s, ['II'], { st: 0.25, t: 0.5 })
    s = apply(s, ['III'], { st: 0.35, t: 0.5 })
    s = apply(s, ['aVF'], { st: 0.3, t: 0.5 })
    s = apply(s, ['I'], { st: -0.1, t: 0.05 })
    s = apply(s, ['aVL'], { st: -0.2, t: -0.1 })
  }
  if (territory === 'anterior' || territory === 'anterolateral') {
    s = apply(s, ['V1'], { st: 0.15, t: 0.3 })
    s = apply(s, ['V2', 'V3'], { st: 0.4, t: 0.8, r: 0.3 })
    s = apply(s, ['V4'], { st: 0.3, t: 0.7 })
    s = apply(s, ['III', 'aVF'], { st: -0.1 })
  }
  if (territory === 'anterolateral' || territory === 'lateral') {
    s = apply(s, ['I', 'aVL'], { st: 0.2, t: 0.4 })
    s = apply(s, ['V5', 'V6'], { st: 0.25, t: 0.5 })
    s = apply(s, ['III'], { st: -0.2, t: -0.1 })
    s = apply(s, ['aVF'], { st: -0.1 })
  }
  if (territory === 'posterior') {
    s = apply(s, ['V1'], { st: -0.15, r: 0.7, s: 0.4, t: 0.35 })
    s = apply(s, ['V2'], { st: -0.25, r: 1.1, s: 0.5, t: 0.5 })
    s = apply(s, ['V3'], { st: -0.2, r: 1.1, s: 0.5 })
  }
  return relabel(s, `stemi-${territory}`, `${territory[0].toUpperCase()}${territory.slice(1)} STEMI`)
}

/**
 * Hyperkalaemia by severity. Mild: tall, narrow, peaked T. Moderate: + flattened P, longer PR, wider QRS.
 * Severe: P gone, QRS very wide, merging into the T towards a sine wave.
 */
export function hyperkalaemia(level: 'mild' | 'moderate' | 'severe', base = sinus(70)): EcgSpec {
  const peak = (m: Morph): Patch => ({ t: Math.max(0.6, Math.abs(m.t) * 2.8) * (m.t < 0 ? -1 : 1), tw: 0.5 })
  let s = apply(base, [...LEADS].filter((l) => l !== 'aVR'), peak)
  s = apply(s, ['V2', 'V3', 'V4'], { t: 1.3, tw: 0.45 })
  if (level === 'mild') return relabel(s, 'hyperk-mild', 'Hyperkalaemia: peaked T waves')
  s = apply(s, [...LEADS], (m) => ({ p: m.p * 0.3, p2: (m.p2 ?? 0) * 0.3 }))
  s = { ...s, conduction: { ...s.conduction, pr: 0.24, qrs: 0.13 } }
  if (level === 'moderate') return relabel(s, 'hyperk-moderate', 'Hyperkalaemia: peaked T, flat P, wide QRS')
  s = apply(s, [...LEADS], (m) => ({ p: 0, p2: 0, tw: 0.9, s: m.s * 1.4 }))
  s = { ...s, rhythm: { kind: 'junctional', rate: 50 }, conduction: { ...s.conduction, qrs: 0.2, qt: 0.46 } }
  return relabel(s, 'hyperk-severe', 'Hyperkalaemia: no P, very wide QRS, sine-wave pattern')
}

/** Hypokalaemia: flat T, ST depression, prominent U waves (V2–V3). */
export function hypokalaemia(base = sinus(80)): EcgSpec {
  let s = apply(base, [...LEADS], (m) => ({ t: m.t * 0.35, u: m.t > 0 ? 0.12 : 0 }))
  s = apply(s, ['V2', 'V3'], { u: 0.25, st: -0.05 })
  s = apply(s, ['II', 'V4', 'V5', 'V6'], { st: -0.06 })
  return relabel(s, 'hypok', 'Hypokalaemia: flat T, ST depression, U waves')
}

/** Left bundle branch block: QRS ≥ 120 ms, broad deep S in V1, broad notched R in I, aVL, V5–V6 without q, discordant ST–T. */
export function lbbb(base = sinus(75)): EcgSpec {
  let s = { ...base, conduction: { ...base.conduction, qrs: 0.15, qt: 0.44 } }
  s = apply(s, ['I', 'aVL', 'V5', 'V6'], { q: 0, r: 1.1, r2: 0.8, s: 0, st: -0.1, t: -0.3 })
  s = apply(s, ['V1', 'V2', 'V3'], { q: 0, r: 0.1, s: 1.8, r2: 0, st: 0.25, t: 0.45 })
  s = apply(s, ['V4'], { r: 0.6, s: 1.0, st: 0.1, t: 0.2 })
  return relabel(s, 'lbbb', 'Left bundle branch block')
}

/** Right bundle branch block: QRS ≥ 120 ms, rSR′ in V1–V2, wide slurred S in I and V6. */
export function rbbb(base = sinus(75)): EcgSpec {
  let s = { ...base, conduction: { ...base.conduction, qrs: 0.13 } }
  s = apply(s, ['V1'], { r: 0.25, s: 0.4, r2: 0.8, st: -0.05, t: -0.2 })
  s = apply(s, ['V2'], { r: 0.35, s: 0.6, r2: 0.6, t: -0.1 })
  s = apply(s, ['I', 'V5', 'V6'], { s: 0.45 })
  return relabel(s, 'rbbb', 'Right bundle branch block')
}

/** Acute pericarditis: widespread concave ST elevation with PR depression; the reverse in aVR. */
export function pericarditis(base = sinus(100)): EcgSpec {
  let s = apply(base, ['I', 'II', 'aVL', 'aVF', 'V2', 'V3', 'V4', 'V5', 'V6'], { st: 0.15, pr: -0.06 })
  s = apply(s, ['III'], { st: 0.05, pr: -0.03 })
  s = apply(s, ['aVR'], { st: -0.12, pr: 0.06 })
  return relabel(s, 'pericarditis', 'Acute pericarditis')
}

/** Pulmonary embolism: sinus tachycardia, S1 Q3 T3, and right-heart strain (T inversion V1–V3). */
export function pulmonaryEmbolism(): EcgSpec {
  let s = sinus(112)
  s = apply(s, ['I'], { s: 0.45 })
  s = apply(s, ['III'], { q: 0.25, t: -0.25 })
  s = apply(s, ['V1', 'V2', 'V3'], { t: -0.3 })
  return relabel(s, 'pe', 'PE pattern: sinus tachycardia, S1Q3T3, RV strain')
}

/** LVH with strain: tall R in V5–V6 and deep S in V1–V2 (Sokolow–Lyon > 35 mm), lateral ST depression and T inversion. */
export function lvh(base = sinus(72)): EcgSpec {
  let s = apply(base, ['V1'], { s: 2.0 })
  s = apply(s, ['V2'], { s: 2.4 })
  s = apply(s, ['V5'], { r: 2.8, st: -0.1, t: -0.25 })
  s = apply(s, ['V6'], { r: 2.4, st: -0.1, t: -0.25 })
  s = apply(s, ['I', 'aVL'], { r: 1.3, st: -0.05, t: -0.15 })
  return relabel(s, 'lvh', 'LVH with strain')
}

/** Brugada type 1: coved ST elevation ≥ 2 mm in V1–V2 falling into an inverted T. */
export function brugada(base = sinus(72)): EcgSpec {
  const s = apply(base, ['V1', 'V2'], { r2: 0.25, st: 0.3, t: -0.25, tw: 1.2 })
  return relabel(s, 'brugada', 'Brugada type 1')
}

/** WPW: short PR (< 120 ms), delta wave, broad QRS. */
export function wpw(base = sinus(75)): EcgSpec {
  return relabel({ ...base, conduction: { ...base.conduction, pr: 0.1, qrs: 0.12, delta: 0.045 } }, 'wpw', 'WPW: short PR and delta wave')
}

/** Tricyclic toxicity: sinus tachycardia, QRS > 100 ms, terminal R in aVR > 3 mm. */
export function tcaToxicity(): EcgSpec {
  let s = { ...sinus(125), conduction: { ...normalConduction(), qrs: 0.13, qt: 0.4 } }
  s = apply(s, ['aVR'], { r2: 0.45 })
  s = apply(s, ['I', 'aVL'], { s: 0.4 })
  return relabel(s, 'tca', 'TCA toxicity: wide QRS, R in aVR')
}

export function longQt(base = sinus(60)): EcgSpec {
  return relabel({ ...base, conduction: { ...base.conduction, qt: 0.56 } }, 'long-qt', 'Long QT')
}

/* ================================================================ rhythms */

export const rhythms = {
  sinusTachy: () => relabel(sinus(130), 'sinus-tachy', 'Sinus tachycardia'),
  sinusBrady: () => relabel(sinus(45), 'sinus-brady', 'Sinus bradycardia'),
  firstDegree: () => relabel({ ...sinus(70), conduction: { ...normalConduction(), pr: 0.28 } }, 'avb1', 'First-degree AV block'),
  mobitz1: () => relabel({ ...sinus(75), rhythm: { kind: 'mobitz1', rate: 80, cycle: 4 } }, 'mobitz1', 'Mobitz I (Wenckebach)'),
  mobitz2: () => relabel({ ...sinus(75), rhythm: { kind: 'mobitz2', rate: 80, ratio: 3 } }, 'mobitz2', 'Mobitz II'),
  chb: () => relabel({ ...sinus(75), rhythm: { kind: 'chb', atrial: 82, ventricular: 34 } }, 'chb', 'Complete heart block'),
  af: (rate = 120) => relabel({ ...sinus(rate), rhythm: { kind: 'af', rate } }, 'af', 'Atrial fibrillation'),
  flutter: (block = 2) => relabel({ ...sinus(150), rhythm: { kind: 'flutter', block } }, 'flutter', `Atrial flutter ${block}:1`),
  svt: (rate = 185) => relabel({ ...sinus(rate), rhythm: { kind: 'svt', rate }, conduction: { ...normalConduction(), qt: 0.28 } }, 'svt', 'SVT (AVNRT)'),
  vt: (rate = 180) => relabel({ ...sinus(rate), rhythm: { kind: 'vt', rate } }, 'vt', 'Monomorphic VT'),
  torsades: () => relabel({ ...sinus(220), rhythm: { kind: 'vt', rate: 220, polymorphic: true } }, 'torsades', 'Torsades de pointes'),
  vf: () => relabel({ ...sinus(0), rhythm: { kind: 'vf' } }, 'vf', 'Ventricular fibrillation'),
  asystole: () => relabel({ ...sinus(0), rhythm: { kind: 'asystole' } }, 'asystole', 'Asystole'),
  paced: (capture = true) => relabel({ ...sinus(70), rhythm: { kind: 'paced', rate: 70, capture, native: 34 } }, capture ? 'paced' : 'paced-no-capture', capture ? 'Paced, capturing' : 'Pacing spikes, no capture'),
  junctional: () => relabel({ ...sinus(50), rhythm: { kind: 'junctional', rate: 50 } }, 'junctional', 'Junctional rhythm'),
}

/* ================================================================ timing */

export type Beat = {
  /** P onset, s (absent in AF, VT, junctional…). */
  p?: number
  /** QRS onset, s. Absent for a blocked P. */
  qrs?: number
  kind: 'normal' | 'wide' | 'paced'
  /** A pacing spike at this time. */
  spike?: number
  /** Polymorphic VT: amplitude scale for this beat. */
  scale?: number
}

/** Tiny seeded PRNG so irregular rhythms are reproducible. */
function hash(i: number, seed: number) {
  let x = (i * 374761393 + seed * 668265263) | 0
  x = (x ^ (x >>> 13)) * 1274126177
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** Every event from time 0 to `until` seconds. */
export function beats(spec: EcgSpec, until: number, seed = 1): Beat[] {
  const r = spec.rhythm
  const out: Beat[] = []
  const pr = spec.conduction.pr
  switch (r.kind) {
    case 'sinus': {
      const rr = 60 / r.rate
      for (let t = 0.3; t < until; t += rr) out.push({ p: t, qrs: t + pr, kind: 'normal' })
      break
    }
    case 'junctional': {
      const rr = 60 / r.rate
      for (let t = 0.3; t < until; t += rr) out.push({ qrs: t, kind: 'normal' })
      break
    }
    case 'af': {
      const mean = 60 / r.rate
      let t = 0.2
      for (let i = 0; t < until; i++) {
        out.push({ qrs: t, kind: 'normal' })
        t += mean * (0.6 + 0.8 * hash(i, seed))
      }
      break
    }
    case 'flutter': {
      const fl = 0.2 // 300/min flutter waves
      for (let i = 0, t = 0.2; t < until; i++, t += fl) if (i % r.block === 1) out.push({ qrs: t + 0.12, kind: 'normal' })
      break
    }
    case 'svt': {
      const rr = 60 / r.rate
      for (let t = 0.2; t < until; t += rr) out.push({ qrs: t, kind: 'normal' })
      break
    }
    case 'vt': {
      const rr = 60 / r.rate
      let i = 0
      for (let t = 0.2; t < until; t += rr, i++) out.push({ qrs: t, kind: 'wide', scale: r.polymorphic ? 0.3 + 0.7 * Math.abs(Math.sin(i / 3)) : 1 })
      // AV dissociation: sinus P waves march through independently.
      if (!r.polymorphic) for (let t = 0.5; t < until; t += 60 / 85) out.push({ p: t, kind: 'normal' })
      break
    }
    case 'mobitz1': {
      const pp = 60 / r.rate
      let n = 0
      for (let t = 0.3; t < until; t += pp, n++) {
        const k = n % r.cycle
        if (k === r.cycle - 1) out.push({ p: t, kind: 'normal' })
        else out.push({ p: t, qrs: t + pr + k * 0.08, kind: 'normal' })
      }
      break
    }
    case 'mobitz2': {
      const pp = 60 / r.rate
      let n = 0
      for (let t = 0.3; t < until; t += pp, n++) {
        if (n % r.ratio === r.ratio - 1) out.push({ p: t, kind: 'normal' })
        else out.push({ p: t, qrs: t + pr, kind: 'normal' })
      }
      break
    }
    case 'chb': {
      for (let t = 0.2; t < until; t += 60 / r.atrial) out.push({ p: t, kind: 'normal' })
      for (let t = 0.6; t < until; t += 60 / r.ventricular) out.push({ qrs: t, kind: 'wide' })
      break
    }
    case 'paced': {
      const rr = 60 / r.rate
      for (let t = 0.3; t < until; t += rr) out.push(r.capture ? { spike: t, qrs: t + 0.04, kind: 'paced' } : { spike: t, kind: 'paced' })
      if (!r.capture) {
        for (let t = 0.2; t < until; t += 60 / 82) out.push({ p: t, kind: 'normal' })
        for (let t = 0.6; t < until; t += 60 / r.native) out.push({ qrs: t, kind: 'wide' })
      }
      break
    }
    default:
      break
  }
  return out
}

/* ================================================================ sampling */

function g(x: number, mu: number, sigma: number, amp: number) {
  const d = (x - mu) / sigma
  return d > 6 || d < -6 ? 0 : amp * Math.exp(-0.5 * d * d)
}
function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Voltage from one beat's ventricular part, with x measured from QRS onset. */
function ventricular(m: Morph, c: Conduction, x: number, wide: boolean) {
  const d = wide ? Math.max(c.qrs, 0.16) : c.qrs
  const qt = wide ? Math.max(c.qt, 0.42) : c.qt
  let v = 0
  v += g(x, 0.12 * d, 0.07 * d, -m.q)
  v += g(x, 0.4 * d, 0.13 * d, m.r)
  v += g(x, 0.7 * d, 0.12 * d, -m.s)
  if (m.r2) v += g(x, 0.86 * d, 0.1 * d, m.r2)
  const tc = d + (qt - d) * 0.62
  const tEnd = qt
  v += m.st * smooth(d - 0.01, d + 0.015, x) * (1 - smooth(tc, tEnd, x))
  v += g(x, tc, (qt - d) * 0.16 * (m.tw ?? 1), m.t)
  if (m.u) v += g(x, qt + 0.1, 0.035, m.u)
  if (c.delta && !wide) v += (m.r * 0.35) * smooth(-c.delta, 0.02, x) * (1 - smooth(0.02, 0.4 * d, x))
  return v
}

function atrial(m: Morph, c: Conduction, x: number) {
  let v = g(x, 0.045, 0.022, m.p)
  if (m.p2) v += g(x, 0.085, 0.018, m.p2)
  if (m.pr) v += m.pr * smooth(0.09, 0.11, x) * (1 - smooth(c.pr - 0.02, c.pr, x))
  return v
}

/** Lead weights for the chaotic and flutter baselines. */
const FLUTTER_SIGN: Record<Lead, number> = { I: 0.1, II: -1, III: -1, aVR: 0.5, aVL: 0.3, aVF: -1, V1: 0.7, V2: 0.4, V3: 0.2, V4: 0.1, V5: 0.1, V6: 0.1 }

/**
 * Voltage in one lead at time t (s), mV. `events` is from `beats()`.
 * Pass the same events for every lead so all 12 stay in step, as on a real machine.
 */
export function sample(spec: EcgSpec, lead: Lead, t: number, events: Beat[], seed = 1): number {
  const c = spec.conduction
  const r = spec.rhythm
  let v = 0
  if (r.kind === 'vf') {
    const amp = 0.45 + 0.25 * Math.sin(t * 0.9 + seed)
    return amp * (Math.sin(t * 2 * Math.PI * 5.2 + seed) * 0.6 + Math.sin(t * 2 * Math.PI * 7.7 + 1.3) * 0.35 + Math.sin(t * 2 * Math.PI * 3.1 + 2) * 0.3) * (lead === 'aVR' ? -0.7 : 1)
  }
  if (r.kind === 'asystole') return 0.02 * Math.sin(t * 1.3 + seed)
  if (r.kind === 'af') {
    const w = lead === 'V1' ? 0.09 : lead === 'II' || lead === 'III' || lead === 'aVF' ? 0.05 : 0.025
    // Fibrillatory waves: 350–600/min, irregular in shape and size, never a repeating sawtooth.
    const wobble = 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 0.37 + seed * 1.3)
    v +=
      w *
      wobble *
      (Math.sin(t * 2 * Math.PI * 6.1 + seed) +
        0.7 * Math.sin(t * 2 * Math.PI * 8.3 + 2.1 + 0.9 * Math.sin(t * 1.7)) +
        0.5 * Math.sin(t * 2 * Math.PI * 9.7 + 0.4 + seed * 0.7) +
        0.4 * Math.sin(t * 2 * Math.PI * 5.3 + 1.1))
  }
  if (r.kind === 'flutter') {
    const phase = ((t - 0.2) / 0.2) % 1
    const saw = phase < 0.75 ? -0.5 + phase / 0.75 : 0.5 - (phase - 0.75) / 0.25
    v += 0.18 * saw * FLUTTER_SIGN[lead]
  }
  const m = spec.morph[lead]
  const w = spec.wide[lead]
  for (const b of events) {
    if (b.p !== undefined) {
      const x = t - b.p
      if (x > -0.05 && x < 0.3) v += atrial(m, c, x)
    }
    if (b.spike !== undefined && Math.abs(t - b.spike) < 0.004) v += lead === 'aVR' ? -1.2 : 1.2
    if (b.qrs !== undefined) {
      const x = t - b.qrs
      if (x > -0.08 && x < 0.75) v += ventricular(b.kind === 'normal' ? m : w, c, x, b.kind !== 'normal') * (b.scale ?? 1)
    }
  }
  return v
}

/* ================================================================ measurement (for tests and teaching) */

/** ST level at J + 60 ms of the first conducted beat, relative to the PR baseline. */
export function stLevel(spec: EcgSpec, lead: Lead) {
  const ev = beats(spec, 6)
  const b = ev.find((e) => e.qrs !== undefined && e.kind === 'normal') ?? ev.find((e) => e.qrs !== undefined)
  if (!b || b.qrs === undefined) return 0
  const d = b.kind === 'normal' ? spec.conduction.qrs : Math.max(spec.conduction.qrs, 0.16)
  const baseline = sample(spec, lead, b.qrs - 0.02, ev)
  return sample(spec, lead, b.qrs + d + 0.06, ev) - baseline
}

/** R–R intervals between successive QRS complexes, s. */
export function rrIntervals(spec: EcgSpec, until = 10) {
  const q = beats(spec, until)
    .map((b) => b.qrs)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b)
  return q.slice(1).map((x, i) => x - q[i])
}

/** Largest positive and negative deflection of one lead over a window. */
export function extremes(spec: EcgSpec, lead: Lead, from = 0, to = 3) {
  const ev = beats(spec, to + 1)
  let max = -Infinity
  let min = Infinity
  for (let t = from; t < to; t += 0.002) {
    const v = sample(spec, lead, t, ev)
    if (v > max) max = v
    if (v < min) min = v
  }
  return { max, min }
}
