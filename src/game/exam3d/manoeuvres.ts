import { spotLabel } from './sites'

/**
 * Focused examinations: a station lists exactly the clinical manoeuvres it offers (`body.focus`), each written as
 * `id` (asking the patient to do something) or `id@site` (doing something at a place), e.g. `pulse@wrist-L`,
 * `ok-sign`, `lachman@knee-R`. Each is an act in the rules (what a `do` line matches) and an animation in the scene.
 * Pure.
 */

export type Anim =
  | 'inspect'
  | 'look'
  | 'warmth'
  | 'crt'
  | 'pulse'
  | 'doppler'
  | 'touch'
  | 'pin'
  | 'squeeze'
  | 'stretch'
  | 'elbow-flex'
  | 'elbow-straighten'
  // The knee.
  | 'walk'
  | 'patellar-tap'
  | 'joint-line'
  | 'bone'
  | 'knee-bend'
  | 'knee-passive'
  | 'slr'
  | 'lachman'
  | 'drawer'
  | 'stress'
  | 'foot-up'
  | 'hip-roll'
  | `pose:${string}`

/** The framework: look, feel, move; the special tests; the neurovascular checks; what completes it. */
export type Group = 'Look' | 'Feel' | 'Move' | 'Special' | 'Neuro' | 'Complete'
export const GROUPS: { id: Group; title: string }[] = [
  { id: 'Look', title: 'LOOK' },
  { id: 'Feel', title: 'FEEL' },
  { id: 'Move', title: 'MOVE' },
  { id: 'Special', title: 'SPECIAL TESTS' },
  { id: 'Neuro', title: 'NEUROVASCULAR' },
  { id: 'Complete', title: 'TO COMPLETE' },
]

export type ManoeuvreDef = {
  /** On its button; `{spot}` is the place it is done ("Feel the {spot}": "Feel the dorsalis pedis pulse"). */
  label: string
  /** Hands on: the tool it counts as. Asking: the instruction. Moving: the joint movement (side added from the site). */
  tool?: string
  say?: string
  /** The instruction is for one side: its id takes the site's side (`bend-knee-R`). */
  sided?: boolean
  move?: string
  /** The joint a movement moves (default the elbow). */
  joint?: string
  anim: Anim
  group: Group
  /** Watched from across the room, not close up (walking). */
  wide?: boolean
  /** What it tests, shown at the spot as it is done (otherwise the place, and what lies under it). */
  shows?: { title: string; sub?: string }
}

export const MANOEUVRES: Record<string, ManoeuvreDef> = {
  inspect: { label: 'Expose and inspect the skin', tool: 'look', anim: 'inspect', group: 'Look' },
  colour: { label: 'Look at the colour', tool: 'look', anim: 'look', group: 'Look' },
  warmth: { label: 'Feel the temperature (back of your fingers)', tool: 'feel', anim: 'warmth', group: 'Feel', shows: { title: 'Temperature', sub: 'the backs of the fingers; compare the other side' } },
  crt: { label: 'Capillary refill: press the nail bed', tool: 'press', anim: 'crt', group: 'Neuro', shows: { title: 'Capillary refill', sub: 'normal: back within 2 seconds' } },
  pulse: { label: 'Feel the {spot}', tool: 'feel', anim: 'pulse', group: 'Neuro' },
  doppler: { label: 'Handheld Doppler', tool: 'doppler', anim: 'doppler', group: 'Neuro' },
  touch: { label: 'Light touch (cotton wool)', tool: 'cotton', anim: 'touch', group: 'Neuro' },
  pin: { label: 'Sharp touch (neurotip)', tool: 'pin', anim: 'pin', group: 'Neuro' },
  compartments: { label: 'Feel the forearm compartments', tool: 'feel', anim: 'squeeze', group: 'Feel', shows: { title: 'Forearm compartments', sub: 'tense and tender: compartment syndrome' } },
  stretch: { label: 'Passively extend the fingers', tool: 'stretch', anim: 'stretch', group: 'Move', shows: { title: 'Passive stretch', sub: 'pain out of proportion: compartment syndrome' } },
  'bend-elbow': { label: 'Bend the elbow up fully', move: 'flex', anim: 'elbow-flex', group: 'Move' },
  'straighten-elbow': { label: 'Straighten the elbow', move: 'ext', anim: 'elbow-straighten', group: 'Move' },
  'thumbs-up': { label: '“Thumbs up, and bend your wrist back”', say: 'thumbs-up', anim: 'pose:thumbs-up', group: 'Neuro' },
  'ok-sign': { label: '“Make an OK sign”', say: 'ok-sign', anim: 'pose:ok', group: 'Neuro' },
  'cross-fingers': { label: '“Cross your fingers”', say: 'cross-fingers', anim: 'pose:cross', group: 'Neuro' },
  opposition: { label: '“Touch your thumb to your little finger”', say: 'opposition', anim: 'pose:opposition', group: 'Neuro' },
  'spread-fingers': { label: '“Spread your fingers wide”', say: 'spread-fingers', anim: 'pose:spread', group: 'Neuro' },
  'make-fist': { label: '“Make a fist”', say: 'make-fist', anim: 'pose:fist', group: 'Move' },

  // The knee: look, feel, move, the ligaments, then the foot and the hip.
  walk: { label: '“Walk a few steps for me, if you can”', say: 'walk', anim: 'walk', group: 'Look', wide: true },
  'inspect-knees': { label: 'Look at both knees: swelling, bruising, wounds, wasting', tool: 'look', anim: 'inspect', group: 'Look' },
  'patellar-tap': {
    label: 'Patellar tap: empty the pouch above, tap the kneecap',
    tool: 'patellar-tap',
    anim: 'patellar-tap',
    group: 'Feel',
    shows: { title: 'Patellar tap', sub: 'fluid squeezed down from the pouch lifts the kneecap off the femur' },
  },
  'joint-line': { label: 'Knee bent: press along the {spot}', tool: 'press', anim: 'joint-line', group: 'Feel' },
  bone: { label: 'Press for bony tenderness: the {spot}', tool: 'press', anim: 'bone', group: 'Feel' },
  'bend-knee': {
    label: '“Bend your knee up as far as you can, then straighten it”',
    say: 'bend-knee',
    sided: true,
    anim: 'knee-bend',
    group: 'Move',
    shows: { title: 'Active range', sub: 'normal: straight to about 135°; unable to bend to 90°: an X-ray (Ottawa)' },
  },
  'move-knee': {
    label: 'Bend and straighten it yourself, a hand on the kneecap',
    move: 'flex',
    joint: 'knee',
    anim: 'knee-passive',
    group: 'Move',
    shows: { title: 'Passive range', sub: 'crepitus under the hand; a springy block to straightening: a locked knee' },
  },
  slr: { label: '“Keep your knee straight and lift your leg”', say: 'lift-leg', sided: true, anim: 'slr', group: 'Move', shows: { title: 'Straight-leg raise', sub: 'the extensor mechanism: quadriceps, patella, patellar tendon' } },
  lachman: { label: 'Lachman test: knee at 20–30°, draw the shin forward', tool: 'lachman', anim: 'lachman', group: 'Special', shows: { title: 'Lachman test', sub: 'the ACL: does the shin slide forward on the femur?' } },
  'post-drawer': { label: 'Posterior sag, then the posterior drawer', tool: 'drawer', anim: 'drawer', group: 'Special', shows: { title: 'Posterior sag and drawer', sub: 'the PCL: does the shin sag or push back?' } },
  collaterals: { label: 'Valgus and varus stress, at 30° and straight', tool: 'stress', anim: 'stress', group: 'Special', shows: { title: 'Valgus and varus stress', sub: 'the MCL and the LCL: does the joint open?' } },
  'foot-up': { label: '“Pull your foot up, then push it down”', say: 'toes', anim: 'foot-up', group: 'Neuro', shows: { title: 'Foot up and down', sub: 'up: the deep peroneal nerve (from the common peroneal); down: the tibial' } },
  'hip-roll': { label: 'Roll the leg to and fro: the hip', move: 'rot', joint: 'hip', anim: 'hip-roll', group: 'Complete', shows: { title: 'Log roll', sub: 'the hip, the joint above: knee pain can come from it' } },
}

export type Offer = { key: string; def: ManoeuvreDef; site: string | null }

/** A focus entry, read: `pulse@wrist-L` → the pulse manoeuvre at the left radial pulse. */
export function offerOf(entry: string): Offer | null {
  const [key, site = null] = entry.split('@')
  const def = MANOEUVRES[key]
  return def ? { key: entry, def, site } : null
}

/** What its button says: "Feel the dorsalis pedis pulse". */
export function offerLabel(o: Offer): string {
  return o.def.label.replace('{spot}', o.site ? spotLabel(o.site) : 'pulse')
}

/** The rules' event for doing it. */
export function eventOf(o: Offer): { tool: string; site?: string; say?: string; move?: string } {
  const side = o.site?.match(/-(R|L)$/)?.[1]
  if (o.def.say) return { tool: 'say', say: o.def.sided && side ? `${o.def.say}-${side}` : o.def.say }
  if (o.def.move) return { tool: 'move', move: `${o.def.joint ?? 'elbow'}${side ? `-${side}` : ''}:${o.def.move}`, site: o.site ?? undefined }
  return { tool: o.def.tool ?? 'look', site: o.site ?? undefined }
}
