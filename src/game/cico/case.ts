import { rng } from '../io/case'

/**
 * Scalpel–bougie–tube eFONA (DAS 2025): vertical midline skin incision, finger to the membrane,
 * transverse stab, rotate, bougie, 6.0 cuffed tube, capnography.
 *
 * Front of the neck in a 200×300 viewBox: chin at the top, sternal notch at the bottom, midline x = 100.
 * Scale: 1 cm ≈ 14 units.
 */

export const NECK_CM = 14
export const MID_X = 100

export const NECK = {
  hyoidY: 70,
  thyroidTop: 90,
  thyroidBottom: 136,
  membraneTop: 137,
  membraneBottom: 151,
  cricoidBottom: 165,
  ringsBottom: 268,
  notchY: 282,
}

export type Habitus = 'slim' | 'obese'

export type CicoCase = {
  habitus: Habitus
  /** A bougie may slip into a false passage even from a good hole. Poor technique adds to this. */
  falseTractBase: boolean
}

export function cicoCaseFor(seed: number): CicoCase {
  const r = rng(seed ^ 0x5eed)
  return { habitus: r() < 0.35 ? 'obese' : 'slim', falseTractBase: r() < 0.12 }
}

export type NeckFeel = 'chin' | 'hyoid' | 'notch-thyroid' | 'thyroid' | 'membrane' | 'cricoid' | 'rings' | 'sternal-notch' | 'lateral' | 'soft' | 'deep'

export const NECK_FEEL_TEXT: Record<NeckFeel, string> = {
  chin: 'The underside of the jaw.',
  hyoid: 'A small hard bar high in the neck. The hyoid.',
  'notch-thyroid': 'A V-shaped notch at the top of a big cartilage. The thyroid notch.',
  thyroid: 'Broad hard cartilage. The thyroid cartilage.',
  membrane: 'A soft dip between two hard rings. The cricothyroid membrane.',
  cricoid: 'A firm complete ring below the dip. The cricoid.',
  rings: 'Small ridges going down. Tracheal rings, with the thyroid isthmus over them.',
  'sternal-notch': 'The dip at the top of the sternum.',
  lateral: 'Off the midline: muscle, and a pulse under your finger. The carotid.',
  soft: 'Soft tissue beside the larynx.',
  deep: 'Thick soft tissue. You cannot feel the landmarks through it.',
}

export function neckFeelAt(x: number, y: number, habitus: Habitus): NeckFeel {
  const dx = Math.abs(x - MID_X)
  if (dx > 42) return 'lateral'
  if (y < 55) return 'chin'
  if (y >= NECK.notchY - 8) return 'sternal-notch'
  if (habitus === 'obese' && y > NECK.thyroidTop + 16 && dx < 30) return 'deep'
  if (y < NECK.hyoidY + 8 && y > NECK.hyoidY - 8 && dx < 26) return 'hyoid'
  if (y >= NECK.thyroidTop && y < NECK.thyroidBottom) {
    const half = 30 - ((y - NECK.thyroidTop) / (NECK.thyroidBottom - NECK.thyroidTop)) * 16
    if (dx <= half) return y < NECK.thyroidTop + 10 && dx < 8 ? 'notch-thyroid' : 'thyroid'
  }
  if (y >= NECK.membraneTop && y < NECK.membraneBottom && dx < 12) return 'membrane'
  if (y >= NECK.membraneBottom && y < NECK.cricoidBottom && dx < 16) return 'cricoid'
  if (y >= NECK.cricoidBottom && y < NECK.ringsBottom && dx < 14) return 'rings'
  return 'soft'
}

/* ---------------------------------------------------------------- the vertical incision */

export type Stroke = { x: number; y: number }[]

export type IncisionVerdict = {
  ok: boolean
  vertical: boolean
  upward: boolean
  midline: boolean
  overMembrane: boolean
  lengthCm: number
  notes: string[]
}

/** DAS 2025: a midline vertical skin incision, up to 8 cm, caudad to cephalad, over the membrane. */
export function judgeIncision(stroke: Stroke): IncisionVerdict {
  const notes: string[] = []
  if (stroke.length < 2) return { ok: false, vertical: false, upward: false, midline: false, overMembrane: false, lengthCm: 0, notes: ['No incision.'] }
  const a = stroke[0]
  const b = stroke[stroke.length - 1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const vertical = Math.abs(dy) > 2 * Math.abs(dx)
  const upward = dy < 0
  const maxOff = Math.max(...stroke.map((p) => Math.abs(p.x - MID_X)))
  const midline = maxOff <= 10
  const ys = stroke.map((p) => p.y)
  const overMembrane = Math.min(...ys) <= NECK.membraneTop + 4 && Math.max(...ys) >= NECK.membraneBottom - 4
  const lengthCm = Math.hypot(dx, dy) / NECK_CM
  if (!vertical) notes.push('The skin incision was transverse. DAS 2025 uses a vertical midline incision for every patient.')
  if (vertical && !upward) notes.push('Cut from the bottom up: caudad to cephalad, away from the sternal notch vessels.')
  if (!midline) notes.push('The incision wandered off the midline. The vessels are lateral.')
  if (!overMembrane) notes.push('The incision did not cross the level of the cricothyroid membrane.')
  if (lengthCm < 3) notes.push('Too short to get a finger in. Up to 8 cm.')
  if (lengthCm > 9) notes.push('Longer than 8 cm. That is more bleeding than you need.')
  const ok = vertical && upward && midline && overMembrane && lengthCm >= 3 && lengthCm <= 9
  return { ok, vertical, upward, midline, overMembrane, lengthCm, notes }
}

/* ---------------------------------------------------------------- stab, bougie, tube */

/** Depth below the membrane surface, mm. The posterior tracheal wall is about 15 mm back. */
export const STAB = { through: 1.5, posteriorWall: 14 }

export type StabSite = 'membrane' | 'thyroid' | 'cricoid' | 'rings' | 'off'

export function stabSiteAt(x: number, y: number): StabSite {
  if (Math.abs(x - MID_X) > 12) return 'off'
  if (y < NECK.membraneTop) return 'thyroid'
  if (y < NECK.membraneBottom) return 'membrane'
  if (y < NECK.cricoidBottom) return 'cricoid'
  return 'rings'
}

/** Bougie: tracheal-ring clicks from 3 cm; a false passage holds up early, about 5 cm. */
export const BOUGIE = { clicksFrom: 3, holdUp: 5.5, min: 10, max: 15, carina: 17 }

/** Tube over the bougie: the cuff passes the membrane at 3.5 cm. Stop with the cuff just through. */
export const TUBE = { cuffThrough: 3.5, idealMax: 6, tooDeep: 7.5, max: 10 }

/* ---------------------------------------------------------------- oxygen */

/** SpO2 per second while nobody is oxygenating the lungs. Practice mode halves it. */
export function desatRate(coach: boolean) {
  return coach ? 0.1 : 0.2
}

/** Heart rate and rhythm follow the saturation. */
export function hypoxicHeart(spo2: number): { hr: number; rhythm: 'sinus' | 'agonal' } {
  if (spo2 >= 70) return { hr: 118, rhythm: 'sinus' }
  if (spo2 >= 58) return { hr: 70 + ((spo2 - 58) / 12) * 48, rhythm: 'sinus' }
  if (spo2 >= 46) return { hr: 42 + ((spo2 - 46) / 12) * 28, rhythm: 'sinus' }
  return { hr: 18, rhythm: 'agonal' }
}

export const ARREST_SPO2 = 45
