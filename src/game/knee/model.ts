/**
 * Knee aspiration for a hot swollen joint (BSR/BOA hot joint guideline; standard lateral approach). Pure.
 *
 * Front view of the right knee, 200 × 200: lateral on your left, medial on your right. The patella is centred at
 * (100, 100). Cellulitis covers the medial and infrapatellar skin: go in laterally.
 *
 * Cross-section at the patella, 240 × 140: lateral on the left. The effusion lies between the patella and the
 * trochlea; the needle comes in from the lateral side and angles under the patella.
 */

export type Pt = { x: number; y: number }

export const EFFUSION_ML = 60
/** What flows freely before you need to milk the suprapatellar pouch toward the needle. */
export const FREE_ML = 18
export const MILK_ML = 15

export type KneeSite = 'superolateral' | 'lateral' | 'cellulitis' | 'patella' | 'tendon' | 'other'
export type TipRegion = 'outside' | 'soft' | 'fluid' | 'bone'
export type Pot = 'gram' | 'count' | 'crystals' | 'bc'

export const PATELLA = { cx: 100, cy: 100, rx: 18, ry: 22 }
export const CELLULITIS = { cx: 132, cy: 120, rx: 30, ry: 34 }

export function siteAt(p: Pt): KneeSite {
  const inE = (e: { cx: number; cy: number; rx: number; ry: number }, k = 1) => ((p.x - e.cx) / (e.rx * k)) ** 2 + ((p.y - e.cy) / (e.ry * k)) ** 2 <= 1
  if (inE(CELLULITIS)) return 'cellulitis'
  if (inE(PATELLA)) return 'patella'
  if (p.y > 126 && p.x > 84 && p.x < 116) return 'tendon'
  if (p.x >= 60 && p.x < 84 && p.y >= 62 && p.y < 86) return 'superolateral'
  if (p.x >= 62 && p.x < 82 && p.y >= 86 && p.y <= 112) return 'lateral'
  return 'other'
}

/** The cross-section. The effusion lens shrinks as you drain it. */
export const AXIAL = { patella: { cx: 120, cy: 32, rx: 34, ry: 12 }, femur: { cx: 120, cy: 120, rx: 80, ry: 30 }, skin: { cx: 120, cy: 72, rx: 112, ry: 66 } }

export function tipRegion(p: Pt, remaining: number): TipRegion {
  const inE = (e: { cx: number; cy: number; rx: number; ry: number }) => ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1
  if (!inE(AXIAL.skin)) return 'outside'
  if (inE(AXIAL.patella) || inE(AXIAL.femur)) return 'bone'
  const depth = 10 + 40 * (remaining / EFFUSION_ML)
  if (p.x > 52 && p.x < 188 && p.y > 44 && p.y < 44 + depth) return 'fluid'
  return 'soft'
}

export type KneeRun = {
  consent: boolean
  askedProsthesis: boolean
  sawSkin: boolean
  tapped: boolean
  extended: boolean
  site: KneeSite | null
  cleaned: number
  wheal: number
  tip: Pt | null
  region: TipRegion
  boneHits: number
  drawn: number
  reachable: number
  milked: number
  steroid: boolean
  pots: Pot[]
  dressed: boolean
  sent: boolean
}

export function freshKnee(): KneeRun {
  return {
    consent: false,
    askedProsthesis: false,
    sawSkin: false,
    tapped: false,
    extended: false,
    site: null,
    cleaned: 0,
    wheal: 0,
    tip: null,
    region: 'outside',
    boneHits: 0,
    drawn: 0,
    reachable: FREE_ML,
    milked: 0,
    steroid: false,
    pots: [],
    dressed: false,
    sent: false,
  }
}

export const remaining = (r: KneeRun) => EFFUSION_ML - r.drawn

/** Pull on the syringe: fluid comes only from the effusion, and only what has reached the needle. */
export function draw(run: KneeRun, ml: number): { patch: Partial<KneeRun>; kind: 'fluid' | 'none' } {
  if (run.region !== 'fluid') return { patch: {}, kind: 'none' }
  const can = Math.min(ml, run.reachable - run.drawn, 20 - (run.drawn - run.pots.length * 5))
  if (can <= 0) return { patch: {}, kind: 'none' }
  return { patch: { drawn: run.drawn + can }, kind: 'fluid' }
}

/** Squeeze the suprapatellar pouch down toward the needle. */
export function milk(run: KneeRun): Partial<KneeRun> {
  return { milked: run.milked + 1, reachable: Math.min(EFFUSION_ML, Math.max(run.reachable, run.drawn) + MILK_ML) }
}

/** Fluid in the syringe, after what has gone into pots (about 5 mL each). */
export const inSyringe = (r: KneeRun) => Math.max(0, r.drawn - r.pots.length * 5)

/* ---------------------------------------------------------------- check */

export const KNEE_MARKS = ['checks', 'effusion', 'site', 'asepsis', 'under', 'samples', 'dressing'] as const
export type KneeMark = (typeof KNEE_MARKS)[number]
export type KneeRow = { key: KneeMark; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkKnee(run: KneeRun): KneeRow[] {
  const need: Pot[] = ['gram', 'count', 'crystals']
  const missingPots = need.filter((p) => !run.pots.includes(p))
  return [
    { key: 'checks', label: 'Consent and checks', value: [run.consent && 'consent', run.askedProsthesis && 'no replacement', run.sawSkin && 'skin seen'].filter(Boolean).join(', ') || 'None', range: 'Consent; no joint replacement; the skin over the site', ok: run.consent && run.askedProsthesis && run.sawSkin, why: 'A prosthetic joint is aspirated by orthopaedics in theatre; cellulitis over the site is a contraindication there.' },
    { key: 'effusion', label: 'Position and effusion', value: `${run.extended ? 'Knee straight and relaxed' : 'Not positioned'}, ${run.tapped ? 'patellar tap positive' : 'effusion not confirmed'}`, range: 'Knee extended and relaxed; effusion confirmed', ok: run.extended && run.tapped, why: 'With the quadriceps relaxed the patella lifts and the needle slides under it.' },
    { key: 'site', label: 'Site', value: run.site ?? 'Not marked', range: 'Lateral: superolateral corner of the patella, or mid-patella laterally', ok: run.site === 'superolateral' || run.site === 'lateral', why: 'Through cellulitis you inoculate a joint that may not be infected; over the patella or tendon you hit bone or tendon.', critical: run.site === 'cellulitis' },
    { key: 'asepsis', label: 'Asepsis and local', value: `${Math.round(run.cleaned * 100)}% cleaned, ${run.wheal.toFixed(1)} mL to the skin`, range: 'Chlorhexidine over the site; 1% lidocaine skin wheal', ok: run.cleaned >= 0.7 && run.wheal >= 1, why: 'A no-touch aseptic technique: a needle into a joint can seed infection.' },
    { key: 'under', label: 'Needle', value: run.drawn > 0 ? `Under the patella${run.boneHits ? `, hit bone ${run.boneHits}×` : ''}` : run.boneHits ? `Hit bone ${run.boneHits}×, no fluid` : 'No fluid reached', range: 'From lateral, angled under the patella into the effusion', ok: run.drawn > 0 && run.boneHits <= 1, why: 'Hitting cartilage repeatedly damages it: aim under the patella, not into it.' },
    { key: 'samples', label: 'Samples', value: run.steroid ? 'Steroid injected into the joint' : missingPots.length ? `Missing: ${missingPots.join(', ')}` : `${run.drawn.toFixed(0)} mL: Gram stain and culture, cell count, crystals${run.pots.includes('bc') ? ', blood culture bottles' : ''}`, range: 'Turbid fluid into pots for Gram stain and culture, cell count and crystals', ok: !run.steroid && !missingPots.length, why: 'Steroid into a possibly septic joint is dangerous; every pot answers a different question.', critical: run.steroid },
    { key: 'dressing', label: 'Finish', value: `${run.dressed ? 'Pressure and dressing' : 'No dressing'}, ${run.sent ? 'sent urgently' : 'not sent'}`, range: 'Needle out, pressure, dressing; samples to the lab urgently', ok: run.dressed && run.sent, why: 'A Gram stain within the hour changes what happens tonight.' },
  ]
}
