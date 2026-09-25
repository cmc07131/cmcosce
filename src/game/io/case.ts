/**
 * EZ-IO proximal tibia: the case, the anatomy, and the physics. Pure functions, no React.
 *
 * Front view of a LEFT leg in a 200×300 viewBox, medial side on the viewer's left.
 * A right leg is the same drawing mirrored, so all hit tests work in left-leg coordinates.
 * Scale: patella ≈ 4.5 cm tall ≈ 48 units, so 1 cm ≈ 10.7 units.
 */

export const UNITS_PER_CM = 10.7

/** Skin outline of the left leg, top to bottom. Medial edge on the viewer's left. */
export const LEG_MEDIAL: [number, number][] = [[60, 0], [54, 60], [50, 100], [52, 130], [55, 165], [60, 220], [66, 300]]
export const LEG_LATERAL: [number, number][] = [[140, 0], [148, 60], [154, 100], [156, 130], [160, 165], [154, 220], [138, 300]]

function edgeAt(edge: [number, number][], y: number) {
  for (let i = 1; i < edge.length; i++) {
    const [x0, y0] = edge[i - 1]
    const [x1, y1] = edge[i]
    if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1)
  }
  return edge[edge.length - 1][0]
}

export const ANATOMY = {
  patella: { x: 100, y: 100, rx: 20, ry: 24 },
  jointY: 130,
  tuberosity: { x: 104, y: 160, rx: 10, ry: 9 },
  fibulaHead: { x: 150, y: 150, rx: 10, ry: 9 },
  /** Flat anteromedial tibia: 2 cm medial to the tuberosity, level with its lower half. */
  target: { x: 104 - 2 * UNITS_PER_CM, y: 163 },
  crestX: (y: number) => 104 - (y - 160) * 0.05,
  legLeft: (y: number) => edgeAt(LEG_MEDIAL, y),
  legRight: (y: number) => edgeAt(LEG_LATERAL, y),
}

export type Side = 'left' | 'right'
export type NeedleColour = 'pink' | 'blue' | 'yellow'
export type LegFinding = 'clean' | 'old-io' | 'cellulitis' | 'fracture'

export const NEEDLE_MM: Record<NeedleColour, number> = { pink: 15, blue: 25, yellow: 45 }

export type IoCase = {
  /** What is wrong with each leg. At most one leg is out. */
  legs: Record<Side, LegFinding>
  /** Skin to bone over the flat tibia, mm. 12 is a normal adult; 24 needs the yellow needle. */
  tissueMm: number
  cortexMm: number
  marrowMm: number
  marrowOnAspirate: boolean
  /** Swells after the flush even with good technique. Faults add to this. */
  extravasates: boolean
}

/** Small deterministic PRNG so a run keeps its case across reloads. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

export function caseFor(seed: number): IoCase {
  const r = rng(seed)
  const bad: LegFinding[] = ['clean', 'old-io', 'cellulitis', 'fracture']
  const which = bad[Math.floor(r() * bad.length)]
  const badSide: Side = r() < 0.5 ? 'left' : 'right'
  const legs: Record<Side, LegFinding> = { left: 'clean', right: 'clean' }
  legs[badSide] = which
  const thick = r() < 0.3
  return {
    legs,
    tissueMm: thick ? 24 : 12,
    cortexMm: 3,
    marrowMm: 25,
    marrowOnAspirate: r() < 0.7,
    extravasates: r() < 0.12,
  }
}

export const FINDING_TEXT: Record<LegFinding, string> = {
  clean: 'Skin intact. No swelling, no deformity. Landmarks are easy to feel.',
  'old-io': 'A small dressing over the upper tibia. The nurse says an IO came out of this leg yesterday.',
  cellulitis: 'Hot, red, tender skin over the upper shin. Cellulitis.',
  fracture: 'The shin is swollen and angled mid-way down. It moves where it should not. Fractured tibia.',
}

/* ---------------------------------------------------------------- landmark */

export type Feel = 'patella' | 'joint' | 'tuberosity' | 'flat' | 'crest' | 'lateral' | 'fibula' | 'thigh' | 'shin-low' | 'off'

export const FEEL_TEXT: Record<Feel, string> = {
  patella: 'Hard, round, and it slides a little. The kneecap.',
  joint: 'A soft gap between two bones. The joint line.',
  tuberosity: 'A firm bony bump below the kneecap, where the tendon ends.',
  flat: 'Broad flat bone just under the skin.',
  crest: 'A sharp ridge of bone. The front edge of the tibia.',
  lateral: 'Muscle over the bone. You cannot feel the bone clearly.',
  fibula: 'A small knob of bone on the outer side, below the knee.',
  thigh: 'Soft thigh above the knee.',
  'shin-low': 'Flat bone, further down the shin.',
  off: 'Nothing there.',
}

function inEllipse(x: number, y: number, e: { x: number; y: number; rx: number; ry: number }) {
  return ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1
}

/** What a fingertip feels at (x, y), in left-leg coordinates. */
export function feelAt(x: number, y: number): Feel {
  if (y < 0 || y > 300 || x < ANATOMY.legLeft(y) || x > ANATOMY.legRight(y)) return 'off'
  if (inEllipse(x, y, ANATOMY.patella)) return 'patella'
  if (inEllipse(x, y, ANATOMY.fibulaHead)) return 'fibula'
  if (inEllipse(x, y, ANATOMY.tuberosity)) return 'tuberosity'
  if (y < ANATOMY.jointY - 6) return 'thigh'
  if (Math.abs(y - ANATOMY.jointY) <= 6) return 'joint'
  const crest = ANATOMY.crestX(y)
  if (Math.abs(x - crest) <= 3 && y > 150) return 'crest'
  if (x > crest) return 'lateral'
  if (y > 205) return 'shin-low'
  if (y < 145) return 'joint'
  return 'flat'
}

export type LandmarkVerdict = { ok: boolean; distCm: number; feel: Feel; note: string }

export function judgeLandmark(x: number, y: number): LandmarkVerdict {
  const feel = feelAt(x, y)
  const distCm = Math.hypot(x - ANATOMY.target.x, y - ANATOMY.target.y) / UNITS_PER_CM
  if (feel === 'flat' && distCm <= 1.2) {
    return { ok: true, distCm, feel, note: 'Flat anteromedial tibia, about 2 cm medial to the tuberosity.' }
  }
  const notes: Partial<Record<Feel, string>> = {
    patella: 'That is the patella. The needle would go into the knee joint.',
    joint: 'Too close to the joint line. Go below the tuberosity.',
    tuberosity: 'That is the tuberosity itself. The patellar tendon inserts there. Move about 2 cm medial.',
    crest: 'On the crest the needle slips off the sharp edge. Move medial onto the flat surface.',
    lateral: 'Lateral to the crest: muscle over the bone, and the fibula and peroneal nerve are near. The flat bone is medial.',
    fibula: 'That is the fibular head. The common peroneal nerve wraps round it.',
    thigh: 'Above the knee. The distal femur is a site for infants, not this adult.',
    'shin-low': 'Too far down. The cortex is thicker and the marrow space narrower. Stay about 2 cm medial to the tuberosity.',
    off: 'That is off the leg.',
  }
  if (feel === 'flat') {
    return { ok: false, distCm, feel, note: `Right surface, but ${distCm.toFixed(1)} cm from the ideal point. Aim level with the tuberosity, about 2 cm medial.` }
  }
  return { ok: false, distCm, feel, note: notes[feel] ?? 'Not the landmark.' }
}

/* ---------------------------------------------------------------- needle and drill */

/** Needle length showing above the skin with the tip resting on bone. */
export function exposedMm(colour: NeedleColour, tissueMm: number) {
  return NEEDLE_MM[colour] - tissueMm
}

/** The black line sits 5 mm from the hub. It must be visible above the skin with the tip on bone. */
export function lineVisible(colour: NeedleColour, tissueMm: number) {
  return exposedMm(colour, tissueMm) >= 5
}

/** Right length for this leg: the 5 mm line shows, and it is not the long needle when blue would do. */
export function rightNeedle(colour: NeedleColour, tissueMm: number): { ok: boolean; note: string } {
  if (!lineVisible(colour, tissueMm)) {
    return { ok: false, note: 'With the tip on bone no black line shows. The needle may not reach the marrow. Back out and take a longer one.' }
  }
  if (colour === 'yellow' && lineVisible('blue', tissueMm)) {
    return { ok: false, note: 'Yellow 45 mm is for thick soft tissue or the humerus. On this tibia blue reaches, and yellow risks the far cortex.' }
  }
  if (colour === 'pink') {
    return { ok: false, note: 'Pink 15 mm is for 3–39 kg. This is an adult.' }
  }
  return { ok: true, note: 'At least one black 5 mm line shows above the skin.' }
}

/** Drill depth is the tip below the skin, mm. */
export function popDepth(c: IoCase) {
  return c.tissueMm + c.cortexMm
}

export function farCortexDepth(c: IoCase) {
  return c.tissueMm + c.cortexMm + c.marrowMm
}

/** How fast the tip advances under the drill, mm/s, for a given pressure 0–1. */
export function drillRate(depthMm: number, pressure: number, c: IoCase) {
  if (pressure < 0.08) return 0
  if (depthMm < popDepth(c)) return 0.4 + 1.8 * pressure
  // Marrow gives way fast, but leave a fair moment to release: about 0.9 s across the 5 mm window.
  return 4 + 4 * pressure
}

export type DrillOutcome = 'in-cortex' | 'seated' | 'too-deep' | 'hub-on-skin' | 'through'

/** Where the tip ended up when the trigger was released. */
export function drillOutcome(depthMm: number, colour: NeedleColour, c: IoCase): DrillOutcome {
  if (depthMm >= farCortexDepth(c)) return 'through'
  if (depthMm >= NEEDLE_MM[colour] - 0.5) return 'hub-on-skin'
  if (depthMm < popDepth(c)) return 'in-cortex'
  if (depthMm > popDepth(c) + 5) return 'too-deep'
  return 'seated'
}

/** Deepest the needle can go: the hub stops at the skin. */
export function maxDepth(colour: NeedleColour) {
  return NEEDLE_MM[colour]
}

/* ---------------------------------------------------------------- drugs */

/** mg in a volume of a percentage solution: 1% = 10 mg/mL. */
export function mgIn(ml: number, percent: number) {
  return ml * percent * 10
}
