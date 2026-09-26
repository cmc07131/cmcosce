import { rng } from '../io/case'
import type { Fault, Scored } from '../io/score'

/**
 * Transcutaneous pacing for unstable complete heart block.
 * Chest front view 200×240: sternum at x = 100, the patient's left on the viewer's right.
 * Back view 200×240: the patient's left on the viewer's left.
 */

export type PaceCase = {
  /** Output that captures with good pad contact and the potassium sorted, mA. */
  threshold: number
  sweaty: boolean
  hairy: boolean
  /** Peaked T waves on the first trace; capture needs 30 mA more until calcium. The gas after pacing shows K+ 7.4. */
  hyperK: boolean
}

export function paceCaseFor(seed: number): PaceCase {
  const r = rng(seed ^ 0xbeef)
  return {
    threshold: 50 + Math.floor(r() * 5) * 10,
    sweaty: r() < 0.45,
    hairy: r() < 0.3,
    hyperK: r() < 0.2,
  }
}

/* ---------------------------------------------------------------- where things go on the chest */

type Spot = { x: number; y: number; r: number }

export const FRONT: Record<'apPad' | 'alSternal' | 'alApex' | 'ra' | 'la' | 'll', Spot> = {
  /** Anterior pad of the AP pair: left lower sternal edge, over the heart. */
  apPad: { x: 122, y: 132, r: 20 },
  /** Anterolateral pair: right infraclavicular, and left mid-axilla at the apex. */
  alSternal: { x: 70, y: 72, r: 18 },
  alApex: { x: 160, y: 150, r: 18 },
  ra: { x: 58, y: 48, r: 16 },
  la: { x: 142, y: 48, r: 16 },
  ll: { x: 142, y: 214, r: 18 },
}

/** Back pad: left of the spine, below the scapula. The viewer sees the patient's left on their left. */
export const BACK_PAD: Spot = { x: 76, y: 122, r: 22 }

const within = (p: { x: number; y: number }, s: Spot) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r

export type FrontSite = 'apPad' | 'alSternal' | 'alApex' | 'wrong'
export function frontPadSite(p: { x: number; y: number }): FrontSite {
  if (within(p, FRONT.apPad)) return 'apPad'
  if (within(p, FRONT.alSternal)) return 'alSternal'
  if (within(p, FRONT.alApex)) return 'alApex'
  return 'wrong'
}

export type BackSite = 'leftScapula' | 'rightScapula' | 'spine' | 'wrong'
export function backPadSite(p: { x: number; y: number }): BackSite {
  if (within(p, BACK_PAD)) return 'leftScapula'
  if (Math.abs(p.x - 100) < 10) return 'spine'
  if (within(p, { x: 124, y: 122, r: 22 })) return 'rightScapula'
  return 'wrong'
}

export type Lead = 'ra' | 'la' | 'll'
export function leadSite(lead: Lead, p: { x: number; y: number }) {
  return within(p, FRONT[lead])
}

/* ---------------------------------------------------------------- the run */

export type PaceRun = {
  dried: boolean
  clipped: boolean
  leads: Record<Lead, boolean>
  leadsWrong: boolean

  padsFront: FrontSite[]
  padBack: BackSite | null

  mode: 'off' | 'monitor' | 'pacer' | 'defib'
  demand: boolean
  rate: number
  output: number
  pacing: boolean
  /** Biggest single output jump made before capture. */
  biggestStep: number
  shocked: boolean
  stoppedPacing: boolean

  captureCalled: boolean
  captureCalledWrong: boolean
  thresholdSeen: number | null

  carotid: boolean
  femoral: boolean
  femoralWithCapture: boolean

  calcium: boolean
  atropine: boolean
  analgesia: 'fentanyl' | 'ketamine' | null
  midazolam: boolean
  /** Every order given to the nurse, as said. */
  orders: Order[]
  /** The potassium came back after pacing captured. */
  kResult: boolean

  saidClose: boolean | null
}

export function freshPaceRun(): PaceRun {
  return {
    dried: false,
    clipped: false,
    leads: { ra: false, la: false, ll: false },
    leadsWrong: false,
    padsFront: [],
    padBack: null,
    mode: 'off',
    demand: true,
    rate: 70,
    output: 0,
    pacing: false,
    biggestStep: 0,
    shocked: false,
    stoppedPacing: false,
    captureCalled: false,
    captureCalledWrong: false,
    thresholdSeen: null,
    carotid: false,
    femoral: false,
    femoralWithCapture: false,
    calcium: false,
    atropine: false,
    analgesia: null,
    midazolam: false,
    orders: [],
    kResult: false,
    saidClose: null,
  }
}

export function padPairing(run: PaceRun): 'ap' | 'al' | 'none' {
  if (run.padsFront.includes('apPad') && run.padBack === 'leftScapula') return 'ap'
  if (run.padsFront.includes('alSternal') && run.padsFront.includes('alApex')) return 'al'
  return 'none'
}

/** Current needed to capture right now. Poor contact and the lateral vector cost current; high potassium blocks capture. */
export function captureThreshold(run: PaceRun, c: PaceCase) {
  const pairing = padPairing(run)
  if (pairing === 'none') return Infinity
  const poorContact = (c.sweaty && !run.dried) || (c.hairy && !run.clipped)
  const potassium = c.hyperK && !run.calcium ? 30 : 0
  return c.threshold + (poorContact ? 40 : 0) + (pairing === 'al' ? 10 : 0) + potassium
}

/* ---------------------------------------------------------------- drugs, ordered through the nurse */

export type Drug = 'atropine' | 'calcium' | 'fentanyl' | 'ketamine' | 'midazolam'

export type Order = { drug: Drug; dose: string }

/** What is on the drug cart, the doses you can say, and the one to say. */
export const CART: Record<Drug, { name: string; doses: string[]; right: string[] }> = {
  atropine: { name: 'Atropine', doses: ['0.3 mg', '0.6 mg', '1 mg'], right: ['0.6 mg', '1 mg'] },
  calcium: { name: 'Calcium gluconate 10%', doses: ['10 mL', '30 mL'], right: ['30 mL'] },
  fentanyl: { name: 'Fentanyl', doses: ['25 micrograms', '50 micrograms', '100 micrograms'], right: ['25 micrograms', '50 micrograms'] },
  ketamine: { name: 'Ketamine', doses: ['20 mg', '100 mg'], right: ['20 mg'] },
  midazolam: { name: 'Midazolam', doses: ['5 mg'], right: [] },
}

export const DOSE_NOTE: Partial<Record<string, string>> = {
  'atropine 0.3 mg': 'Atropine under 0.5 mg can slow the heart further. Give 0.6–1 mg.',
  'calcium 10 mL': 'Calcium gluconate 10 mL is too little for hyperkalaemia. Give 30 mL of 10% (or 10 mL of calcium chloride).',
  'fentanyl 100 micrograms': 'Fentanyl 100 micrograms in a man whose pressure was in the 70s risks dropping it. 25–50 micrograms.',
  'ketamine 100 mg': 'Ketamine 100 mg is an induction dose. For pacing pain, about 0.25 mg/kg: 20 mg.',
  'midazolam 5 mg': 'Midazolam 5 mg drops the pressure in a man with a systolic in the 70s. A small opioid or ketamine instead.',
}

/** What a delivered order changes. Wrong doses still act; the scorer says why they were wrong. */
export function deliver(run: PaceRun, order: Order): Partial<PaceRun> {
  const patch: Partial<PaceRun> = { orders: [...run.orders, order] }
  if (order.drug === 'atropine') patch.atropine = true
  if (order.drug === 'calcium') patch.calcium = true
  if (order.drug === 'fentanyl' || order.drug === 'ketamine') patch.analgesia = run.analgesia ?? order.drug
  if (order.drug === 'midazolam') patch.midazolam = true
  return patch
}

export function doseRight(order: Order) {
  return CART[order.drug].right.includes(order.dose)
}

export function potassiumOf(c: PaceCase) {
  return c.hyperK ? { k: 7.4, ph: 7.22 } : { k: 4.6, ph: 7.34 }
}

export function captured(run: PaceRun, c: PaceCase) {
  return run.mode === 'pacer' && run.pacing && run.output >= captureThreshold(run, c)
}

export function scorePacing(run: PaceRun, c: PaceCase): Scored {
  const marks: string[] = []
  const faults: Fault[] = []
  const fault = (text: string, critical = false) => faults.push({ text, critical })
  const thr = captureThreshold(run, c)

  if (run.shocked) fault('A shock was delivered to a conscious patient in complete heart block.', true)

  // Skin and leads
  if (c.sweaty && !run.dried) fault('The chest was wet with sweat. Pads lift off wet skin and need more current.')
  if (c.hairy && !run.clipped) fault('The hair under the pads was not clipped. Poor contact needs more current and burns.')
  if (!(run.leads.ra && run.leads.la && run.leads.ll)) fault('The defibrillator’s own ECG leads were not all on. Demand pacing needs them to sense.')
  if (run.leadsWrong) fault('An ECG electrode went on the wrong place.')

  // Pads
  const pairing = padPairing(run)
  if (pairing === 'none') fault('The pads were not a working pair: front at the left lower sternal edge with back left of the spine, or right infraclavicular with left mid-axilla.', true)
  if (run.padBack === 'rightScapula') fault('The back pad went on the right. It goes left of the spine, under the left scapula.')
  if (run.padBack === 'spine') fault('The back pad went over the spine. Move it left of the spine.')
  if (run.padsFront.includes('wrong')) fault('A front pad went somewhere that does not make a pacing vector.')
  if (pairing !== 'none') marks.push('MS-07')

  // Pacer set-up
  if (run.mode !== 'pacer' && !run.pacing) fault('The machine never went into PACER mode.', true)
  if (!run.demand) fault('Fixed mode can drop a spike on a returning T wave. Use demand.')
  if (run.rate < 60 || run.rate > 80) fault(`Rate ${run.rate}. Set 60–80; 70 is the script.`)
  if (run.pacing && run.demand && run.rate >= 60 && run.rate <= 80) marks.push('MS-08')

  // Titration and capture
  if (run.biggestStep > 20) fault(`The output jumped ${run.biggestStep} mA at once. Titrate up in 10 mA steps.`)
  if (run.captureCalledWrong) fault('You called capture on spikes alone. Capture is every spike followed by a wide QRS and a T wave.')
  if (!run.captureCalled) fault('Electrical capture was never called.')
  if (c.hyperK && !run.calcium) fault(run.kResult ? 'K+ 7.4 came back and no calcium was given. Calcium gluconate 10% 30 mL: it stabilises the membrane and lowers the pacing threshold.' : 'Peaked T waves and a high capture threshold: think hyperkalaemia. Calcium gluconate 10% 30 mL.', true)
  if (run.captureCalled && !run.captureCalledWrong && run.biggestStep <= 20) marks.push('MS-09')

  // Mechanical capture
  if (run.carotid && !run.femoral) fault('Only the carotid was felt. Muscle twitch from the pads fools it: feel the femoral.')
  if (!run.femoral) fault('No femoral pulse check. A spike and a QRS are only electrical capture.')
  if (run.femoralWithCapture) marks.push('MS-10')

  // Margin
  const margin = run.output - thr
  if (Number.isFinite(thr) && run.pacing) {
    if (margin < 5) fault(`Running ${run.output} mA against a threshold of ${thr} mA. Set 5–10 mA above it so beats do not drop out.`)
    else if (margin > 10) fault(`Running ${margin} mA above threshold. 5–10 mA above is enough; more only hurts.`)
    else marks.push('MS-11')
  }

  // Comfort
  for (const order of run.orders) {
    const note = DOSE_NOTE[`${order.drug} ${order.dose}`]
    if (note) fault(note)
  }
  if (!c.hyperK && run.calcium) fault('K+ was 4.6. Calcium was not needed.')
  if (run.stoppedPacing) fault('The pacer was switched off. The rate falls straight back to 32.', true)
  const comfort = run.orders.find((o) => (o.drug === 'fentanyl' || o.drug === 'ketamine') && doseRight(o))
  if (!run.analgesia) fault('No analgesia. Pacing at this current hurts.')
  if (comfort && !run.stoppedPacing && !run.midazolam) marks.push('MS-12')

  if (c.hyperK && run.orders.some((o) => o.drug === 'calcium' && doseRight(o))) marks.push('MS-13')
  if (run.saidClose === false) fault('The handover line was wrong. Pads stay on until a transvenous wire captures.')

  const summary = captured(run, c)
    ? `Paced at ${run.rate}, ${run.output} mA (threshold ${thr} mA)${run.femoralWithCapture ? ', femoral pulse matches' : ''}. ${faults.length ? `${faults.length} point${faults.length === 1 ? '' : 's'} to review.` : 'Clean procedure.'}`
    : `No capture at the end. ${faults.length} point${faults.length === 1 ? '' : 's'} to review.`
  return { marks, faults, outcome: null, summary }
}
