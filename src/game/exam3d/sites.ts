/**
 * Where on the body you examine: named landmarks (the right iliac fossa, the lateral malleolus, the apex…) and groups of
 * them. Pure data: `scene.ts` finds each on whatever body is loaded, by casting from outside toward a point near a
 * bone, and pins it to that bone so it follows every posture.
 *
 * Positions are for a 1.72 m adult in the rig's bind frame (metres; face +Z, her right -X, up +Y; arms out to the sides
 * palms down, so on an arm "up" is its lateral side and "down" the palm). Each is written for her right side; `-L`
 * mirrors it. Children scale with their height.
 */

export type JointRef =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'eyes'
  | 'eye'
  | 'clavicle'
  | 'upperArm'
  | 'forearm'
  | 'hand'
  | 'finger'
  | 'ring'
  | 'thumb'
  | 'thigh'
  | 'calf'
  | 'foot'
  | 'toe'

export type SiteDef = {
  label: string
  /** The bone it sits on (and moves with); `to` and `t` place it along the line to another joint (t > 1 runs past it). */
  j: JointRef
  to?: JointRef
  t?: number
  /** Offset from that point, before finding the skin. */
  off?: [number, number, number]
  /** Which way the skin faces there: the cast comes in from this side. */
  dir: [number, number, number]
  /** How close (m) a touch must land. */
  r: number
  /** Has a left and a right (the id gets -R / -L). */
  sided?: boolean
  /** Under the drape: shown in a drawn close-up, never on the model. */
  draped?: boolean
}

const F: [number, number, number] = [0, 0, 1]
const B: [number, number, number] = [0, 0, -1]
const U: [number, number, number] = [0, 1, 0]
const D: [number, number, number] = [0, -1, 0]
/** Her right side (lateral for the right limbs). */
const RT: [number, number, number] = [-1, 0, 0]
/** Toward the midline from her right side. */
const MED: [number, number, number] = [1, 0, 0]

export const SITES: Record<string, SiteDef> = {
  // Head and face (the eyes' midpoint is `eyes`).
  head: { label: 'head', j: 'head', off: [0, 0.12, 0], dir: U, r: 0.11 },
  temple: { label: 'temple', j: 'head', off: [-0.065, 0.08, 0.03], dir: RT, r: 0.045, sided: true },
  forehead: { label: 'forehead', j: 'eyes', off: [0, 0.045, 0], dir: F, r: 0.035 },
  eye: { label: 'eye', j: 'eye', dir: F, r: 0.022, sided: true },
  supraorbital: { label: 'supraorbital ridge', j: 'eye', off: [0, 0.022, 0], dir: F, r: 0.014, sided: true },
  cheek: { label: 'cheek', j: 'eyes', off: [-0.035, -0.035, 0], dir: F, r: 0.025, sided: true },
  mouth: { label: 'mouth', j: 'eyes', off: [0, -0.068, 0], dir: F, r: 0.025 },
  jaw: { label: 'jaw (masseter)', j: 'eyes', off: [-0.055, -0.06, -0.05], dir: RT, r: 0.025, sided: true },
  ear: { label: 'ear', j: 'eyes', off: [-0.075, -0.012, -0.08], dir: RT, r: 0.025, sided: true },
  mastoid: { label: 'mastoid', j: 'eyes', off: [-0.068, -0.045, -0.1], dir: RT, r: 0.016, sided: true },

  // Neck and chest.
  neck: { label: 'neck', j: 'neck', off: [0, 0.04, 0], dir: F, r: 0.04 },
  trapezius: { label: 'trapezius', j: 'neck', off: [-0.085, -0.02, -0.03], dir: U, r: 0.035, sided: true },
  supraclavicular: { label: 'supraclavicular fossa', j: 'neck', off: [-0.055, -0.045, 0.02], dir: F, r: 0.022, sided: true },
  sternum: { label: 'sternum', j: 'chest', off: [0, 0.02, 0], dir: F, r: 0.035 },
  chest: { label: 'chest', j: 'chest', off: [-0.085, 0, 0], dir: F, r: 0.055, sided: true },

  // Abdomen.
  epigastrium: { label: 'epigastrium', j: 'spine', off: [0, 0.13, 0], dir: F, r: 0.04 },
  umbilicus: { label: 'umbilicus', j: 'spine', off: [0, 0.02, 0], dir: F, r: 0.03 },
  ruq: { label: 'upper quadrant', j: 'spine', off: [-0.08, 0.09, 0], dir: F, r: 0.045, sided: true },
  iliac: { label: 'iliac fossa', j: 'hips', off: [-0.075, 0.04, 0], dir: F, r: 0.04, sided: true },
  suprapubic: { label: 'suprapubic area', j: 'hips', off: [0, -0.02, 0], dir: F, r: 0.035 },
  flank: { label: 'flank', j: 'spine', off: [-0.1, 0.03, 0], dir: RT, r: 0.045, sided: true },
  groin: { label: 'groin', j: 'thigh', off: [0.035, 0.0, 0], dir: F, r: 0.03, sided: true },

  // Back.
  spine: { label: 'lumbar spine', j: 'spine', off: [0, 0.02, 0], dir: B, r: 0.05 },
  thoracic: { label: 'thoracic spine', j: 'chest', off: [0, 0, 0], dir: B, r: 0.05 },
  paraspinal: { label: 'paraspinal muscles', j: 'spine', off: [-0.045, 0.04, 0], dir: B, r: 0.03, sided: true },
  sacrum: { label: 'sacrum', j: 'hips', off: [0, -0.03, 0], dir: B, r: 0.035 },
  perianal: { label: 'perianal skin', j: 'hips', off: [0, -0.1, -0.03], dir: D, r: 0.045, draped: true },

  // Shoulder and arm (bind: arm out to the side, palm down).
  shoulder: { label: 'shoulder', j: 'upperArm', off: [0.01, 0.0, 0], dir: U, r: 0.05, sided: true },
  acromion: { label: 'acromion', j: 'upperArm', off: [0.01, 0.035, 0], dir: U, r: 0.02, sided: true },
  acjoint: { label: 'AC joint', j: 'upperArm', off: [0.035, 0.04, 0], dir: U, r: 0.018, sided: true },
  clavicle: { label: 'clavicle', j: 'clavicle', to: 'upperArm', t: 0.5, dir: F, r: 0.025, sided: true },
  scjoint: { label: 'SC joint', j: 'clavicle', to: 'upperArm', t: 0.12, dir: F, r: 0.018, sided: true },
  tuberosity: { label: 'greater tuberosity', j: 'upperArm', to: 'forearm', t: 0.08, off: [0, 0, 0.01], dir: [-0.3, 0.6, 0.7], r: 0.02, sided: true },
  bicipital: { label: 'bicipital groove', j: 'upperArm', to: 'forearm', t: 0.12, dir: F, r: 0.018, sided: true },
  badge: { label: 'regimental badge area', j: 'upperArm', to: 'forearm', t: 0.38, dir: U, r: 0.03, sided: true },
  arm: { label: 'upper arm', j: 'upperArm', to: 'forearm', t: 0.55, dir: U, r: 0.05, sided: true },
  elbow: { label: 'elbow', j: 'forearm', dir: B, r: 0.035, sided: true },
  forearm: { label: 'forearm', j: 'forearm', to: 'hand', t: 0.5, dir: D, r: 0.045, sided: true },
  wrist: { label: 'radial pulse', j: 'hand', to: 'forearm', t: 0.12, dir: [0, -0.7, 0.7], r: 0.02, sided: true },
  hand: { label: 'back of the hand', j: 'hand', to: 'finger', t: 0.55, dir: U, r: 0.035, sided: true },
  palm: { label: 'palm', j: 'hand', to: 'finger', t: 0.5, dir: D, r: 0.035, sided: true },
  nails: { label: 'nails', j: 'hand', to: 'finger', t: 2.05, dir: U, r: 0.03, sided: true },
  pulp: { label: 'fingertip pulp', j: 'hand', to: 'finger', t: 2.05, dir: D, r: 0.02, sided: true },
  ring: { label: 'ring finger', j: 'hand', to: 'ring', t: 1.6, dir: D, r: 0.02, sided: true },
  ringpulp: { label: 'ring finger pulp', j: 'hand', to: 'ring', t: 2.0, dir: D, r: 0.016, sided: true },
  thumb: { label: 'thumb', j: 'thumb', to: 'hand', t: -0.6, dir: U, r: 0.02, sided: true },
  web: { label: 'first web space', j: 'hand', to: 'thumb', t: 0.7, dir: U, r: 0.016, sided: true },

  // Hip and leg (bind: standing).
  asis: { label: 'ASIS', j: 'hips', off: [-0.105, 0.06, 0], dir: F, r: 0.022, sided: true },
  hip: { label: 'greater trochanter', j: 'thigh', off: [-0.04, -0.05, 0], dir: RT, r: 0.035, sided: true },
  thigh: { label: 'thigh', j: 'thigh', to: 'calf', t: 0.5, dir: F, r: 0.07, sided: true },
  innerthigh: { label: 'inner thigh', j: 'thigh', to: 'calf', t: 0.32, dir: MED, r: 0.04, sided: true },
  knee: { label: 'knee', j: 'calf', off: [0, 0.03, 0], dir: F, r: 0.035, sided: true },
  medialjoint: { label: 'medial joint line', j: 'calf', dir: MED, r: 0.02, sided: true },
  lateraljoint: { label: 'lateral joint line', j: 'calf', dir: RT, r: 0.02, sided: true },
  tibialtub: { label: 'tibial tuberosity', j: 'calf', to: 'foot', t: 0.12, dir: F, r: 0.018, sided: true },
  fibula: { label: 'fibular head', j: 'calf', to: 'foot', t: 0.09, dir: [-0.7, 0, -0.7], r: 0.02, sided: true },
  popliteal: { label: 'popliteal fossa', j: 'calf', off: [0, 0.02, 0], dir: B, r: 0.03, sided: true },
  shin: { label: 'shin', j: 'calf', to: 'foot', t: 0.5, dir: F, r: 0.045, sided: true },
  calf: { label: 'calf', j: 'calf', to: 'foot', t: 0.35, dir: B, r: 0.05, sided: true },
  lateralmalleolus: { label: 'lateral malleolus', j: 'foot', off: [-0.03, 0.0, -0.015], dir: [-0.8, 0, -0.6], r: 0.02, sided: true },
  medialmalleolus: { label: 'medial malleolus', j: 'foot', off: [0.025, 0.01, -0.01], dir: [0.8, 0, -0.6], r: 0.02, sided: true },
  pt: { label: 'posterior tibial pulse', j: 'foot', off: [0.02, -0.01, -0.035], dir: [0.6, 0, -0.8], r: 0.016, sided: true },
  dp: { label: 'dorsalis pedis pulse', j: 'foot', to: 'toe', t: 0.45, dir: U, r: 0.017, sided: true },
  navicular: { label: 'navicular', j: 'foot', to: 'toe', t: 0.35, off: [0.025, 0, 0], dir: MED, r: 0.017, sided: true },
  fifthmt: { label: 'base of the 5th metatarsal', j: 'foot', to: 'toe', t: 0.62, off: [-0.035, -0.02, 0], dir: RT, r: 0.017, sided: true },
  foot: { label: 'foot', j: 'foot', to: 'toe', t: 0.55, dir: U, r: 0.045, sided: true },
  toes: { label: 'toes', j: 'toe', dir: U, r: 0.03, sided: true },
  sole: { label: 'sole', j: 'foot', to: 'toe', t: 0.45, dir: D, r: 0.035, sided: true },
  heel: { label: 'heel', j: 'foot', off: [0, -0.05, -0.05], dir: B, r: 0.03, sided: true },

  // Under the drape.
  vulva: { label: 'vulva', j: 'hips', off: [0, -0.1, 0.03], dir: F, r: 0.04, draped: true },
  cervix: { label: 'cervix', j: 'hips', off: [0, -0.09, 0.02], dir: F, r: 0.03, draped: true },
  adnexa: { label: 'adnexa', j: 'hips', off: [-0.06, 0.01, 0], dir: F, r: 0.035, sided: true, draped: true },
  scrotum: { label: 'scrotum', j: 'hips', off: [0, -0.11, 0.06], dir: F, r: 0.035, draped: true },
  testis: { label: 'testis', j: 'hips', off: [-0.018, -0.12, 0.06], dir: F, r: 0.02, sided: true, draped: true },
}

/** Every site id, with -R and -L for the sided ones. */
export const SITE_IDS: string[] = Object.entries(SITES).flatMap(([id, s]) => (s.sided ? [`${id}-R`, `${id}-L`] : [id]))

/** Named groups an exam step may target: any of their sites will do (or, with `+` in a step, each). */
export const GROUPS: Record<string, string[]> = {
  patient: SITE_IDS,
  face: ['forehead', 'eye-R', 'eye-L', 'cheek-R', 'cheek-L', 'mouth', 'supraorbital-R', 'supraorbital-L'],
  eyes: ['eye-R', 'eye-L'],
  hands: ['hand-R', 'hand-L', 'palm-R', 'palm-L', 'nails-R', 'nails-L', 'pulp-R', 'pulp-L'],
  abdomen: ['epigastrium', 'umbilicus', 'ruq-R', 'ruq-L', 'iliac-R', 'iliac-L', 'suprapubic', 'flank-R', 'flank-L'],
  flanks: ['flank-R', 'flank-L'],
  chest: ['sternum', 'chest-R', 'chest-L'],
  'leg-R': ['thigh-R', 'knee-R', 'shin-R', 'calf-R', 'foot-R', 'toes-R'],
  'leg-L': ['thigh-L', 'knee-L', 'shin-L', 'calf-L', 'foot-L', 'toes-L'],
  legs: ['thigh-R', 'knee-R', 'shin-R', 'calf-R', 'foot-R', 'toes-R', 'thigh-L', 'knee-L', 'shin-L', 'calf-L', 'foot-L', 'toes-L'],
  'arm-R': ['arm-R', 'elbow-R', 'forearm-R', 'wrist-R', 'hand-R', 'palm-R'],
  'arm-L': ['arm-L', 'elbow-L', 'forearm-L', 'wrist-L', 'hand-L', 'palm-L'],
  'shoulder-R': ['shoulder-R', 'acromion-R', 'acjoint-R', 'tuberosity-R', 'bicipital-R', 'clavicle-R', 'scjoint-R'],
  'shoulder-L': ['shoulder-L', 'acromion-L', 'acjoint-L', 'tuberosity-L', 'bicipital-L', 'clavicle-L', 'scjoint-L'],
  'knee-R*': ['knee-R', 'medialjoint-R', 'lateraljoint-R', 'tibialtub-R', 'fibula-R', 'popliteal-R'],
  'knee-L*': ['knee-L', 'medialjoint-L', 'lateraljoint-L', 'tibialtub-L', 'fibula-L', 'popliteal-L'],
  'ankle-R': ['lateralmalleolus-R', 'medialmalleolus-R', 'foot-R'],
  'ankle-L': ['lateralmalleolus-L', 'medialmalleolus-L', 'foot-L'],
  back: ['spine', 'thoracic', 'paraspinal-R', 'paraspinal-L', 'sacrum'],
  // Bimanual: the outer hand on the iliac fossa feels each adnexa against the fingers in the lateral fornix.
  'adnexa-R': ['adnexa-R', 'iliac-R'],
  'adnexa-L': ['adnexa-L', 'iliac-L'],
}

/** Sites a target names: a site, a group, or a site's bare name for either side (`hand` = hand-R or hand-L). */
export function expand(target: string): string[] {
  if (GROUPS[target]) return GROUPS[target]
  if (SITES[target]?.sided) return [`${target}-R`, `${target}-L`]
  return [target]
}

/** The definition and side of a site id. */
export function siteOf(id: string): { def: SiteDef; side: 'R' | 'L' | null } | null {
  const m = id.match(/^(.*)-(R|L)$/)
  if (m && SITES[m[1]]?.sided) return { def: SITES[m[1]], side: m[2] as 'R' | 'L' }
  return SITES[id] ? { def: SITES[id], side: null } : null
}

/** How a site reads in a sentence: "the right lateral malleolus". */
export function siteLabel(id: string): string {
  const s = siteOf(id)
  if (!s) return id
  return `the ${s.side === 'R' ? 'right ' : s.side === 'L' ? 'left ' : ''}${s.def.label}`
}
