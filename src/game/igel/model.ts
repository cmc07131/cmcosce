/**
 * i-gel insertion (DAS 2025 plan B; i-gel instructions for use). Everything here is pure, so the test
 * can drive a whole insertion without a screen.
 *
 * Geometry is in the head's own frame, drawn as the manikin lies: supine on the trolley, the top of the head on
 * the left toward you, face up, neck and chest to the right (240 × 150). The art rotates that frame for head
 * tilt; pointer positions are mapped back into it before they reach here.
 */

export type Pt = { x: number; y: number }
export type IgelSize = 3 | 4 | 5
export type Orientation = 'chin' | 'palate'
export type Grip = 'block' | 'cuff'

export const WEIGHT_KG = 70

/** i-gel sizes by weight, with the connector colour and the largest gastric tube the drain channel takes. */
export const SIZES: Record<IgelSize, { band: string; colour: string; name: string; maxFr: number }> = {
  3: { band: '30–60 kg', colour: '#f0d040', name: 'YELLOW', maxFr: 12 },
  4: { band: '50–90 kg', colour: '#58b060', name: 'GREEN', maxFr: 12 },
  5: { band: '90+ kg', colour: '#f09040', name: 'ORANGE', maxFr: 14 },
}

export function rightSize(kg: number): IgelSize[] {
  const out: IgelSize[] = []
  if (kg >= 30 && kg <= 60) out.push(3)
  if (kg >= 50 && kg <= 90) out.push(4)
  if (kg > 90) out.push(5)
  return out
}

/* ---------------------------------------------------------------- the track the tip follows */

/** From the lips down along the hard palate, round the back of the tongue, to the upper oesophageal sphincter. */
export const TRACK: Pt[] = [
  { x: 86, y: 38 },
  { x: 85, y: 48 },
  { x: 84, y: 60 },
  { x: 85, y: 70 },
  { x: 89, y: 80 },
  { x: 97, y: 88 },
  { x: 110, y: 92 },
  { x: 128, y: 91 },
]
export const LIPS = TRACK[0]

const SAMPLES = (() => {
  const pts: { p: Pt; s: number; t: Pt }[] = []
  const seg: number[] = []
  for (let i = 1; i < TRACK.length; i++) seg.push(Math.hypot(TRACK[i].x - TRACK[i - 1].x, TRACK[i].y - TRACK[i - 1].y))
  const total = seg.reduce((a, b) => a + b, 0)
  let acc = 0
  for (let i = 0; i < seg.length; i++) {
    const a = TRACK[i]
    const b = TRACK[i + 1]
    const t = { x: (b.x - a.x) / seg[i], y: (b.y - a.y) / seg[i] }
    for (let k = 0; k < 12; k++) {
      const f = k / 12
      pts.push({ p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, s: (acc + seg[i] * f) / total, t })
    }
    acc += seg[i]
  }
  const last = TRACK[TRACK.length - 1]
  pts.push({ p: last, s: 1, t: pts[pts.length - 1].t })
  return { pts, total }
})()

/** Track length in head units. */
export const TRACK_LEN = SAMPLES.total

/** The point `s` (0 lips → 1 sphincter) along the track, and its direction. */
export function along(s: number): { p: Pt; t: Pt } {
  const pts = SAMPLES.pts
  const c = Math.max(0, Math.min(1, s))
  let i = pts.findIndex((q) => q.s >= c)
  if (i <= 0) return { p: pts[0].p, t: pts[0].t }
  const a = pts[i - 1]
  const b = pts[i]
  const f = b.s === a.s ? 0 : (c - a.s) / (b.s - a.s)
  return { p: { x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f }, t: b.t }
}

/** The normal pointing to the inside of the curve: toward the tongue, then the larynx. */
export function inward(t: Pt): Pt {
  return { x: t.y, y: -t.x }
}

/**
 * Nearest point on the track. `off` is the signed distance from it: positive toward the tongue and larynx
 * (the inside of the curve), negative toward the palate and the back wall of the pharynx.
 */
export function nearest(q: Pt): { s: number; off: number } {
  let best = SAMPLES.pts[0]
  let bestD = Infinity
  for (const row of SAMPLES.pts) {
    const d = Math.hypot(q.x - row.p.x, q.y - row.p.y)
    if (d < bestD) {
      bestD = d
      best = row
    }
  }
  const n = inward(best.t)
  const off = (q.x - best.p.x) * n.x + (q.y - best.p.y) * n.y
  return { s: best.s, off }
}

/* ---------------------------------------------------------------- the run */

export type IgelRun = {
  size: IgelSize | null
  sizesTried: IgelSize[]

  lube: { front: number; back: number; bowl: number }

  pillow: boolean
  ext: number
  open: number
  grip: Grip | null

  orientation: Orientation
  depth: number
  seated: boolean
  folded: boolean
  attempts: number
  failures: string[]
  tongueWarned: boolean

  spo2: number
  lowestSpo2: number
  maskBetween: number

  breaths: number
  hardSqueezes: number
  saidConfirm: boolean | null
  inflateTried: boolean

  tubeFr: number | null
  tubeTriedTooBig: boolean
  tube: number

  taped: boolean
  tapeMandible: boolean
}

export function freshIgelRun(): IgelRun {
  return {
    size: null,
    sizesTried: [],
    lube: { front: 0, back: 0, bowl: 0 },
    pillow: false,
    ext: 0,
    open: 0,
    grip: null,
    orientation: 'chin',
    depth: 0,
    seated: false,
    folded: false,
    attempts: 0,
    failures: [],
    tongueWarned: false,
    spo2: 93,
    lowestSpo2: 93,
    maskBetween: 0,
    breaths: 0,
    hardSqueezes: 0,
    saidConfirm: null,
    inflateTried: false,
    tubeFr: null,
    tubeTriedTooBig: false,
    tube: 0,
    taped: false,
    tapeMandible: false,
  }
}

/** Head extension that makes the sniffing position, with a pillow under the occiput. */
export const EXT_OK = { min: 12, max: 32 }
export const OPEN_OK = 0.6
export const LUBE_OK = 0.6
export const BOWL_POOL = 0.35
const TONGUE_WARN = 8
const TONGUE_FOLD = 15
const MAX_STEP = 0.07
const SEAT = 0.97

export type InsertEvent = 'none' | 'advance' | 'teeth' | 'tongue' | 'fold' | 'flipped-fold' | 'seated' | 'resistance'

/**
 * One pointer move while inserting. The tip follows your finger only along the track and only a little at a
 * time: stray toward the tongue and it catches, stray far and it folds back. Upside down, it folds at the
 * back of the tongue.
 */
export function pushTo(run: IgelRun, q: Pt): { patch: Partial<IgelRun>; event: InsertEvent } {
  if (run.seated) return { patch: {}, event: 'resistance' }
  if (run.folded) return { patch: {}, event: 'none' }
  const { s, off } = nearest(q)
  if (s <= run.depth) return { patch: {}, event: 'none' }
  if (run.open < 0.4 && s > 0.06) return { patch: { depth: Math.max(run.depth, 0.06) }, event: 'teeth' }
  const inMouth = s > 0.12 && s < 0.7
  if (inMouth && off > TONGUE_FOLD) return fold(run, `Attempt ${run.attempts + 1}: the tip caught the tongue and folded back. Glide along the hard palate.`)
  if (inMouth && off > TONGUE_WARN) return { patch: { tongueWarned: true }, event: 'tongue' }
  if (Math.abs(off) > TONGUE_FOLD + 6) return { patch: {}, event: 'none' }
  const depth = Math.min(s, run.depth + MAX_STEP)
  if (run.orientation === 'palate' && depth > 0.42) {
    return fold(run, `Attempt ${run.attempts + 1}: inserted upside down, the tip folded at the back of the tongue. The cuff outlet faces the chin.`, 'flipped-fold')
  }
  if (depth >= SEAT) return { patch: { depth: 1, seated: true, attempts: run.attempts + 1 }, event: 'seated' }
  return { patch: { depth }, event: 'advance' }
}

function fold(run: IgelRun, why: string, event: InsertEvent = 'fold'): { patch: Partial<IgelRun>; event: InsertEvent } {
  return { patch: { folded: true, attempts: run.attempts + 1, failures: [...run.failures, why] }, event }
}

/** Take it out after a fold, ready for the next attempt. */
export function withdraw(): Partial<IgelRun> {
  return { depth: 0, folded: false, tongueWarned: false }
}

/* ---------------------------------------------------------------- oxygen */

/** SpO2 per second: falls while nobody ventilates, rises with the mask or through a seated device. */
export function spo2Step(run: IgelRun, dt: number, ventilating: boolean) {
  const next = ventilating ? Math.min(97, run.spo2 + 1.6 * dt) : Math.max(62, run.spo2 - 0.35 * dt)
  return { spo2: next, lowestSpo2: Math.min(run.lowestSpo2, next) }
}

/* ---------------------------------------------------------------- the bag */

export type Squeeze = 'good' | 'hard' | 'leak-unseated' | 'short'

/** One squeeze of the bag, by how long you held it. */
export function squeeze(run: IgelRun, heldS: number): Squeeze {
  if (heldS < 0.35) return 'short'
  if (!run.seated) return 'leak-unseated'
  if (heldS > 1.6) return 'hard'
  return 'good'
}

/* ---------------------------------------------------------------- tape */

/**
 * A strip of tape drawn on the front view (100 × 100). It should run cheek to cheek across the upper jaw,
 * over the bite block. Returns what is wrong, or null.
 */
export function judgeTape(stroke: Pt[]): { ok: boolean; mandible: boolean; why: string | null } {
  if (stroke.length < 2) return { ok: false, mandible: false, why: null }
  const xs = stroke.map((p) => p.x)
  const spans = Math.min(...xs) < 26 && Math.max(...xs) > 74
  const overBlock = stroke.some((p) => p.x > 42 && p.x < 58 && p.y > 56 && p.y < 72)
  const ends = [stroke[0], stroke[stroke.length - 1]]
  const mandible = ends.some((p) => p.y > 76)
  if (!spans) return { ok: false, mandible: false, why: 'Too short: the tape runs from one maxilla to the other.' }
  if (mandible) return { ok: false, mandible: true, why: 'That is on the jaw. The jaw moves: tape from maxilla to maxilla, over the bite block.' }
  if (!overBlock) return { ok: false, mandible: false, why: 'The tape has to cross the bite block to hold the device.' }
  return { ok: true, mandible: false, why: null }
}

/* ---------------------------------------------------------------- scoring */

export type IgelFault = { text: string; critical?: boolean }

/** The station's marks for this bench, in the order they are written on the option. */
export const IGEL_MARKS = ['size', 'lube', 'position', 'insert', 'confirm', 'gastric', 'secure'] as const
export type IgelMark = (typeof IGEL_MARKS)[number]

export function scoreIgel(run: IgelRun): { earned: IgelMark[]; faults: IgelFault[]; summary: string } {
  const earned: IgelMark[] = []
  const faults: IgelFault[] = []
  const fault = (text: string, critical = false) => faults.push({ text, critical })

  const ok = rightSize(WEIGHT_KG)
  if (run.size && ok.includes(run.size)) earned.push('size')
  else fault(run.size ? `Size ${run.size} is for ${SIZES[run.size].band}. For ${WEIGHT_KG} kg it is size 4 (50–90 kg).` : 'No device size was chosen.')

  const l = run.lube
  const lubed = l.back >= LUBE_OK && l.front >= LUBE_OK
  if (lubed && l.bowl < BOWL_POOL) earned.push('lube')
  if (!lubed) fault(l.back < LUBE_OK ? 'The back of the cuff was not lubricated: that surface glides along the palate.' : 'The front and sides of the cuff need a thin layer of lubricant too.')
  if (l.bowl >= BOWL_POOL) fault('Lubricant pooled in the bowl. It can be inhaled: a thin layer on the outside only.')

  const extOk = run.ext >= EXT_OK.min && run.ext <= EXT_OK.max
  if (run.pillow && extOk && run.open >= OPEN_OK && run.grip === 'block') earned.push('position')
  if (!run.pillow) fault('No pillow under the occiput: the sniffing position flexes the neck as well as extending the head.')
  if (!extOk) fault(run.ext < EXT_OK.min ? 'The head was not extended into the sniffing position.' : 'The head was over-extended.')
  if (run.open < OPEN_OK) fault('The chin was not pressed down to open the mouth.')
  if (run.grip !== 'block') fault(run.grip === 'cuff' ? 'Held by the cuff. Hold it firmly along the integral bite block.' : 'No grip chosen: hold it along the integral bite block.')

  for (const f of run.failures) fault(f)
  if (run.attempts > 3) fault(`${run.attempts} insertion attempts. Plan B allows three: then stop, think, and prepare for front-of-neck access.`, true)
  if (run.seated && run.attempts <= 3) earned.push('insert')
  if (!run.seated) fault('The device was never seated at definite resistance.', true)
  if (run.lowestSpo2 < 85) fault(`SpO2 fell to ${Math.round(run.lowestSpo2)}% during the attempts. Go back to the mask between attempts.`)

  if (run.breaths >= 3 && run.saidConfirm) earned.push('confirm')
  if (run.breaths < 3) fault('Ventilation was not confirmed over several breaths with a capnography trace.', !run.breaths)
  if (run.saidConfirm === false) fault('Capnography confirms ventilation: a square trace breath after breath, and the chest rising.')
  if (run.saidConfirm === null && run.breaths >= 3) fault('You did not say how you confirmed it.')
  if (run.hardSqueezes > 1) fault('Squeezes too hard and too long: the seal leaks and air goes into the stomach. Gentle breaths over about one second.')
  if (run.inflateTried) fault('Tried to inflate the cuff. The i-gel has a gel cuff: there is nothing to inflate.')

  if (run.tube >= 1) earned.push('gastric')
  else fault('No gastric tube down the drain channel.')
  if (run.tubeTriedTooBig) fault(`An 18 Fr tube does not pass the drain channel. Size ${run.size ?? 4} takes up to ${SIZES[run.size ?? 4].maxFr} Fr.`)

  if (run.taped) earned.push('secure')
  else fault(run.tapeMandible ? 'Taped to the jaw. Tape from maxilla to maxilla over the bite block.' : 'The device was not secured.')

  const summary = `i-gel ${run.size ?? '?'}: ${run.seated ? `seated at attempt ${run.attempts}` : 'not seated'}, ${run.breaths} capnography breath${run.breaths === 1 ? '' : 's'}, lowest SpO2 ${Math.round(run.lowestSpo2)}%. ${
    faults.length ? `${faults.length} point${faults.length === 1 ? '' : 's'} to review.` : 'Clean insertion.'
  }`
  return { earned, faults, summary }
}
