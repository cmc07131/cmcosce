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
  // The cervical collar, and clearing the neck.
  | 'mils'
  | 'jewellery'
  | 'measure'
  | 'size'
  | 'collar-back'
  | 'collar-front'
  | 'fit'
  | 'blocks'
  | 'collar-all'
  | 'midline'
  | 'rotate-head'
  | `pose:${string}`

/**
 * The framework: look, feel, move; the special tests; the neurovascular checks; what completes it. A procedure taught
 * has its own headings (Peyton's four steps): any other heading is shown as written.
 */
export type Group = string
export const GROUPS: { id: Group; title: string }[] = [
  { id: 'Look', title: 'LOOK' },
  { id: 'Feel', title: 'FEEL' },
  { id: 'Move', title: 'MOVE' },
  { id: 'Special', title: 'SPECIAL TESTS' },
  { id: 'Neuro', title: 'NEUROVASCULAR' },
  { id: 'Complete', title: 'TO COMPLETE' },
]

/** The headings of the manoeuvres offered, in the order they first come. */
export function headings(offers: Offer[]): { id: Group; title: string }[] {
  const ids = [...new Set(offers.map((o) => o.def.group))]
  return ids.map((id) => GROUPS.find((g) => g.id === id) ?? { id, title: id.toUpperCase() })
}

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
  /** A drawn close-up shown while it is done (sizing the collar). */
  inset?: 'collar-size'
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

  // Teaching the collar by Peyton's four steps, on a manikin; then the learner does it.
  'collar-demo': {
    label: 'Fit the collar at real speed, without talking',
    tool: 'demo',
    anim: 'collar-all',
    group: 'Step 1: demonstrate',
    shows: { title: 'Peyton step 1', sub: 'the whole skill at real speed, in silence: what good looks like' },
  },
  mils: { label: 'Manual in-line stabilisation: hold the head, and keep holding', tool: 'mils', anim: 'mils', group: 'Step 2: explain each step', shows: { title: 'In-line stabilisation', sub: 'held from the head end until blocks and tape are on' } },
  jewellery: { label: 'Earrings and necklace off', tool: 'jewellery', anim: 'jewellery', group: 'Step 2: explain each step', shows: { title: 'Jewellery off', sub: 'nothing caught under the collar' } },
  measure: { label: 'Measure with your fingers: top of the shoulder to the bottom of the chin', tool: 'measure', anim: 'measure', group: 'Step 2: explain each step', shows: { title: 'Measure the neck', sub: 'fingers flat, head in line: from the trapezius to the chin' } },
  size: {
    label: 'Size the collar: the same fingers, red mark to the bottom of the hard plastic; lock it',
    tool: 'size',
    anim: 'size',
    group: 'Step 2: explain each step',
    shows: { title: 'Size the collar', sub: 'set it, press both lock tabs, bend it into shape' },
    inset: 'collar-size',
  },
  'collar-back': { label: 'Slide the rear panel behind the neck first', tool: 'collar', anim: 'collar-back', group: 'Step 2: explain each step', shows: { title: 'The rear panel first', sub: 'slid flat along the couch into the midline; the head not moved' } },
  'collar-front': { label: 'Chin support under the chin; hold the front, pull it snug, fasten', tool: 'collar', anim: 'collar-front', group: 'Step 2: explain each step', shows: { title: 'The front', sub: 'chin support under the chin; pulled round and fastened' } },
  fit: { label: 'Check the fit: chin on the chin support, no gaps; airway and pulses free', tool: 'fit', anim: 'fit', group: 'Step 2: explain each step', shows: { title: 'Check the fit', sub: 'too big pushes the head back; too small lets it flex' } },
  blocks: { label: 'Head blocks, then tape: the forehead first, then the chin', tool: 'blocks', anim: 'blocks', group: 'Step 2: explain each step', shows: { title: 'Blocks and tape', sub: 'only now can the hands come off' } },
  'collar-narrate': {
    label: 'Dr Lau talks you through each step while you do it',
    tool: 'narrate',
    anim: 'collar-all',
    group: 'Step 3: the learner talks you through it',
    shows: { title: 'Peyton step 3', sub: 'he says each step before you do it: he has it in order' },
  },
  'collar-learner': {
    label: 'Dr Lau fits the collar, talking it through',
    tool: 'learner',
    anim: 'collar-all',
    group: 'Step 4: the learner does it',
    shows: { title: 'Peyton step 4', sub: 'he does it; you watch, and say nothing until he has finished' },
  },
  // Clearing the neck: what you feel and what you ask.
  midline: { label: 'Feel down the middle of the back of the neck, one spinous process at a time', tool: 'press', anim: 'midline', group: 'Show the examination', shows: { title: 'Posterior midline', sub: 'tender here: image (and no movement test)' } },
  'rotate-head': {
    label: '“Turn your head to the left, then to the right, as far as you can”',
    say: 'rotate-head',
    anim: 'rotate-head',
    group: 'Show the examination',
    shows: { title: 'Active rotation', sub: '45° to each side: the last step of the Canadian C-spine Rule' },
  },
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
