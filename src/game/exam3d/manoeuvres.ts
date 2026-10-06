/**
 * Focused examinations: a station lists exactly the clinical manoeuvres it offers (`body.focus`), each written as
 * `id` (asking the patient to do something) or `id@site` (doing something at a place), e.g. `pulse@wrist-L`,
 * `ok-sign`. Each is an act in the rules (what a `do` line matches) and an animation in the scene. Pure.
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
  | `pose:${string}`

/** The framework: look, feel, move; then the neurovascular checks (pulses, refill, each nerve). */
export type Group = 'Look' | 'Feel' | 'Move' | 'Neuro'
export const GROUPS: { id: Group; title: string }[] = [
  { id: 'Look', title: 'LOOK' },
  { id: 'Feel', title: 'FEEL' },
  { id: 'Move', title: 'MOVE' },
  { id: 'Neuro', title: 'NEUROVASCULAR' },
]

export type ManoeuvreDef = {
  label: string
  /** Hands on: the tool it counts as. Asking: the instruction. Moving: the joint movement (side added from the site). */
  tool?: string
  say?: string
  move?: string
  anim: Anim
  group: Group
}

export const MANOEUVRES: Record<string, ManoeuvreDef> = {
  inspect: { label: 'Expose and inspect the skin', tool: 'look', anim: 'inspect', group: 'Look' },
  colour: { label: 'Look at the colour', tool: 'look', anim: 'look', group: 'Look' },
  warmth: { label: 'Feel the temperature (back of your fingers)', tool: 'feel', anim: 'warmth', group: 'Feel' },
  crt: { label: 'Capillary refill: press the nail bed', tool: 'press', anim: 'crt', group: 'Neuro' },
  pulse: { label: 'Feel the radial pulse', tool: 'feel', anim: 'pulse', group: 'Neuro' },
  doppler: { label: 'Handheld Doppler', tool: 'doppler', anim: 'doppler', group: 'Neuro' },
  touch: { label: 'Light touch (cotton wool)', tool: 'cotton', anim: 'touch', group: 'Neuro' },
  pin: { label: 'Sharp touch (neurotip)', tool: 'pin', anim: 'pin', group: 'Neuro' },
  compartments: { label: 'Feel the forearm compartments', tool: 'feel', anim: 'squeeze', group: 'Feel' },
  stretch: { label: 'Passively extend the fingers', tool: 'stretch', anim: 'stretch', group: 'Move' },
  'bend-elbow': { label: 'Bend the elbow up fully', move: 'flex', anim: 'elbow-flex', group: 'Move' },
  'straighten-elbow': { label: 'Straighten the elbow', move: 'ext', anim: 'elbow-straighten', group: 'Move' },
  'thumbs-up': { label: '“Thumbs up, and bend your wrist back”', say: 'thumbs-up', anim: 'pose:thumbs-up', group: 'Neuro' },
  'ok-sign': { label: '“Make an OK sign”', say: 'ok-sign', anim: 'pose:ok', group: 'Neuro' },
  'cross-fingers': { label: '“Cross your fingers”', say: 'cross-fingers', anim: 'pose:cross', group: 'Neuro' },
  opposition: { label: '“Touch your thumb to your little finger”', say: 'opposition', anim: 'pose:opposition', group: 'Neuro' },
  'spread-fingers': { label: '“Spread your fingers wide”', say: 'spread-fingers', anim: 'pose:spread', group: 'Neuro' },
  'make-fist': { label: '“Make a fist”', say: 'make-fist', anim: 'pose:fist', group: 'Move' },
}

export type Offer = { key: string; def: ManoeuvreDef; site: string | null }

/** A focus entry, read: `pulse@wrist-L` → the pulse manoeuvre at the left radial pulse. */
export function offerOf(entry: string): Offer | null {
  const [key, site = null] = entry.split('@')
  const def = MANOEUVRES[key]
  return def ? { key: entry, def, site } : null
}

/** The rules' event for doing it. */
export function eventOf(o: Offer): { tool: string; site?: string; say?: string; move?: string } {
  const side = o.site?.match(/-(R|L)$/)?.[1]
  if (o.def.say) return { tool: 'say', say: o.def.say }
  if (o.def.move) return { tool: 'move', move: `elbow${side ? `-${side}` : ''}:${o.def.move}`, site: o.site ?? undefined }
  return { tool: o.def.tool ?? 'look', site: o.site ?? undefined }
}
