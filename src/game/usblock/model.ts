/**
 * Ultrasound-guided fascia iliaca block, infra-inguinal approach (Association of Anaesthetists / RCEM 2021;
 * NICE CG124). Pure, so the test can drive it.
 *
 * The ultrasound image is 240 × 160, transverse below the inguinal ligament: medial on the left, lateral on the
 * right, skin at the top. The femoral artery lies on top of the fascia iliaca; the femoral nerve lies under it,
 * lateral to the artery. The target is under the fascia iliaca, lateral to the nerve.
 */

export type Pt = { x: number; y: number }

export const WEIGHT_KG = 50
/** Levobupivacaine 0.25% = 2.5 mg/mL; 2 mg/kg = 100 mg = 40 mL. */
export const MG_PER_ML = 2.5
export const MAX_MG = 2 * WEIGHT_KG
export const TARGET_ML = 40
export const ALIQUOT_ML = 5

export const US = { w: 240, h: 160 }
export const FASCIA_LATA_Y = 30
export const ARTERY = { x: 62, y: 70, r: 11 }
export const VEIN = { x: 32, y: 74, r: 12 }
/** The fascia iliaca: deeper medially, rising laterally. */
export const fasciaIliacaY = (x: number) => 86 - Math.max(0, x - 50) * 0.11
export const NERVE = { x: 98, y: fasciaIliacaY(98) + 8, r: 8 }

export type Region = 'skin' | 'subcut' | 'above' | 'target' | 'medial' | 'muscle' | 'nerve' | 'artery' | 'vein'
export type Probe = 'good' | 'medial' | 'lateral' | 'above'
export type Feature = 'artery' | 'vein' | 'nerve' | 'fascia'

export function regionAt(p: Pt): Region {
  const d = (c: { x: number; y: number }) => Math.hypot(p.x - c.x, p.y - c.y)
  if (d(ARTERY) <= ARTERY.r) return 'artery'
  if (d(VEIN) <= VEIN.r) return 'vein'
  if (d(NERVE) <= NERVE.r) return 'nerve'
  if (p.y < 8) return 'skin'
  if (p.y < FASCIA_LATA_Y) return 'subcut'
  const fi = fasciaIliacaY(p.x)
  if (p.y < fi) return 'above'
  if (p.y > fi + 14) return 'muscle'
  return p.x > NERVE.x + NERVE.r + 4 ? 'target' : 'medial'
}

/** What a tap on the image hits, for naming the sonoanatomy. */
export function featureAt(p: Pt): Feature | null {
  const d = (c: { x: number; y: number }) => Math.hypot(p.x - c.x, p.y - c.y)
  if (d(ARTERY) <= ARTERY.r + 3) return 'artery'
  if (d(VEIN) <= VEIN.r + 3) return 'vein'
  if (d(NERVE) <= NERVE.r + 3) return 'nerve'
  if (p.x > 70 && Math.abs(p.y - fasciaIliacaY(p.x)) <= 5) return 'fascia'
  return null
}

export type BlockRun = {
  cleaned: number
  cover: boolean
  probe: Probe | null
  doppler: boolean
  named: Feature[]
  misnamed: number
  plane: 'in' | 'out' | null
  tip: Pt | null
  region: Region | null
  pops: number
  blindAdvance: boolean
  nerveTouch: boolean
  vesselPunctured: boolean
  injected: Partial<Record<Region, number>>
  sinceAspirate: number
  worstUnaspirated: number
  aspirations: number
  syringe: number
  /** mL injected when the second syringe went on; what was left in the first is discarded. */
  swapAt: number
  labelled: boolean
  observed: boolean
  documented: boolean
}

export function freshBlock(): BlockRun {
  return {
    cleaned: 0,
    cover: false,
    probe: null,
    doppler: false,
    named: [],
    misnamed: 0,
    plane: null,
    tip: null,
    region: null,
    pops: 0,
    blindAdvance: false,
    nerveTouch: false,
    vesselPunctured: false,
    injected: {},
    sinceAspirate: 0,
    worstUnaspirated: 0,
    aspirations: 0,
    syringe: 1,
    swapAt: 0,
    labelled: false,
    observed: false,
    documented: false,
  }
}

export const totalMl = (r: BlockRun) => Object.values(r.injected).reduce((a, b) => a + (b ?? 0), 0)
export const intravascularMl = (r: BlockRun) => (r.injected.artery ?? 0) + (r.injected.vein ?? 0)
export const underFasciaMl = (r: BlockRun) => (r.injected.target ?? 0) + (r.injected.medial ?? 0)

/** Advance the tip to `p`. Counts the two pops through the fasciae; touching the nerve or a vessel is recorded. */
export function moveTip(run: BlockRun, p: Pt): { patch: Partial<BlockRun>; event: 'pop' | 'nerve' | 'vessel' | 'move' } {
  const region = regionAt(p)
  const prevY = run.tip?.y ?? 0
  const crossedLata = prevY < FASCIA_LATA_Y && p.y >= FASCIA_LATA_Y
  const crossedIliaca = run.tip !== null && prevY < fasciaIliacaY(p.x) && p.y >= fasciaIliacaY(p.x) && region !== 'artery'
  const patch: Partial<BlockRun> = { tip: p, region, blindAdvance: run.blindAdvance || run.plane !== 'in' }
  if (region === 'nerve') return { patch: { ...patch, nerveTouch: true }, event: 'nerve' }
  if (region === 'artery' || region === 'vein') return { patch: { ...patch, vesselPunctured: true }, event: 'vessel' }
  if (crossedLata || crossedIliaca) return { patch: { ...patch, pops: run.pops + 1 }, event: 'pop' }
  return { patch, event: 'move' }
}

/** Inject `ml` wherever the tip is. Into a nerve it will not go: high pressure. */
export function inject(run: BlockRun, ml: number): { patch: Partial<BlockRun>; ok: boolean } {
  if (!run.region || run.region === 'skin') return { patch: {}, ok: false }
  if (run.region === 'nerve') return { patch: {}, ok: false }
  const since = run.sinceAspirate + ml
  return {
    ok: true,
    patch: {
      injected: { ...run.injected, [run.region]: (run.injected[run.region] ?? 0) + ml },
      sinceAspirate: since,
      worstUnaspirated: Math.max(run.worstUnaspirated, since),
    },
  }
}

/** Signs of local anaesthetic toxicity, from what went into a vessel. */
export function toxicity(run: BlockRun): string | null {
  const iv = intravascularMl(run)
  if (iv >= 15) return 'She is twitching and confused. Local anaesthetic toxicity: stop, call for help, 20% lipid emulsion.'
  if (iv >= 5) return '"My lips are tingling… there\'s ringing in my ears." Early local anaesthetic toxicity.'
  return null
}

/* ---------------------------------------------------------------- check */

export const BLOCK_MARKS = ['asepsis', 'sono', 'inplane', 'spread', 'incremental', 'document'] as const
export type BlockMark = (typeof BLOCK_MARKS)[number]
export type BlockRow = { key: BlockMark; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkBlock(run: BlockRun): BlockRow[] {
  const total = totalMl(run)
  const mg = total * MG_PER_ML
  const under = underFasciaMl(run)
  const need: Feature[] = ['artery', 'nerve', 'fascia']
  const missing = need.filter((f) => !run.named.includes(f))
  return [
    { key: 'asepsis', label: 'Asepsis', value: `${Math.round(run.cleaned * 100)}% of the groin cleaned, probe ${run.cover ? 'in a sterile cover' : 'uncovered'}`, range: 'Chlorhexidine over the groin; sterile probe cover and gel', ok: run.cleaned >= 0.7 && run.cover, why: 'A needle near the femoral vessels: clean skin and a sterile probe.' },
    { key: 'sono', label: 'Sonoanatomy', value: run.probe !== 'good' ? `Probe ${run.probe ?? 'never placed'}` : missing.length ? `Not identified: ${missing.join(', ')}` : 'Artery, nerve and fascia iliaca named', range: 'Transverse below the ligament, lateral to the pulse; artery, nerve and fascia iliaca identified', ok: run.probe === 'good' && !missing.length, why: 'You inject under the fascia iliaca, lateral to the nerve: you must see all three first.' },
    { key: 'inplane', label: 'Needle', value: `${run.plane === 'in' ? 'In-plane' : run.plane === 'out' ? 'Out-of-plane' : 'No plane chosen'}${run.blindAdvance ? ', advanced without seeing the tip' : ''}; tip ${run.region ?? 'nowhere'}${run.nerveTouch ? ', touched the nerve' : ''}${run.vesselPunctured ? ', entered a vessel' : ''}`, range: 'In-plane from lateral, tip seen all the way, under the fascia lateral to the nerve', ok: run.plane === 'in' && !run.blindAdvance && !run.nerveTouch && !run.vesselPunctured && under > 0, why: 'Always see the tip: the femoral artery and nerve are a centimetre apart.', critical: run.vesselPunctured && intravascularMl(run) > 0 },
    { key: 'spread', label: 'Spread', value: under >= total * 0.8 && total > 0 ? `${under.toFixed(0)} mL under the fascia, lifting it` : total ? `${(total - under).toFixed(0)} mL in the wrong plane` : 'Nothing injected', range: 'Aspirate, 2 mL test, the fascia lifts off the iliacus and spreads toward the nerve', ok: run.aspirations > 0 && total > 0 && under >= total * 0.8, why: 'Above the fascia or in the muscle the drug never reaches the nerves.' },
    { key: 'incremental', label: 'Volume and increments', value: `${total.toFixed(0)} mL (${mg.toFixed(0)} mg), up to ${run.worstUnaspirated.toFixed(0)} mL between aspirations`, range: `About ${TARGET_ML} mL of 0.25% within ${MAX_MG} mg; ${ALIQUOT_ML} mL aliquots, aspirating between`, ok: total >= 30 && mg <= MAX_MG && run.worstUnaspirated <= ALIQUOT_ML + 1, why: 'A big volume spreads under the fascia; small aliquots with aspiration catch an intravascular tip early.', critical: mg > MAX_MG || intravascularMl(run) >= 5 },
    { key: 'document', label: 'After', value: [run.labelled ? 'labelled' : null, run.observed ? 'observed' : null, run.documented ? 'documented' : null].filter(Boolean).join(', ') || 'Nothing', range: 'Wristband label (time, drug, dose), observe for toxicity, document', ok: run.labelled && run.observed && run.documented, why: 'A labelled block prevents a second dose by the next team.' },
  ]
}
