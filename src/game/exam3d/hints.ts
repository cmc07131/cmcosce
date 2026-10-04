import { sayOf, toolById } from './catalog'
import { holds, type Act, type ExamState, type Plan, type Progress } from './model'
import { GROUPS, SITES, expand, siteLabel } from './sites'

/**
 * Practice help for the 3D examination: what to do next, in words, and what has to be true first (a position,
 * gloves, a joint bent). Pure.
 */

const GROUP_WORDS: Record<string, string> = {
  patient: 'the patient',
  face: 'the face',
  eyes: 'the eyes',
  hands: 'the hands',
  abdomen: 'the abdomen',
  flanks: 'the flanks',
  chest: 'the chest',
  legs: 'the legs',
  back: 'the back',
}

/** "the left radial pulse", "the hands", "either hand", "the right leg". */
export function targetWords(t: string): string {
  if (GROUP_WORDS[t]) return GROUP_WORDS[t]
  const g = t.match(/^(leg|arm|shoulder|ankle|knee|adnexa)-(R|L)\*?$/)
  if (g && GROUPS[t]) return `the ${g[2] === 'R' ? 'right' : 'left'} ${g[1] === 'adnexa' ? 'adnexa' : g[1]}`
  if (SITES[t]?.sided) return `either ${SITES[t].label}`
  return siteLabel(t)
}

const POSTURE_WORDS: Record<string, string> = {
  supine: 'lying flat',
  sitting: 'sitting up',
  edge: 'sitting on the edge of the couch',
  standing: 'standing',
  walking: 'walking',
  'knees-up': 'knees bent and apart',
  'roll-R': 'rolled onto their right side',
  'roll-L': 'rolled onto their left side',
  bent: 'bending forward',
  'one-leg-R': 'standing on the right leg',
  'one-leg-L': 'standing on the left leg',
}

/** The instruction that puts them in a posture. */
export const SAY_FOR_POSTURE: Record<string, string> = {
  supine: 'lie-flat',
  sitting: 'sit-up',
  edge: 'sit-edge',
  standing: 'stand',
  walking: 'walk',
  'knees-up': 'knees-up',
  'roll-R': 'roll-R',
  'roll-L': 'roll-L',
  bent: 'bend-forward',
  'one-leg-R': 'one-leg-R',
  'one-leg-L': 'one-leg-L',
}

const JOINT_WORDS: Record<string, string> = {
  knee: 'knee bent',
  hipflex: 'hip flexed',
  hiprot: 'hip rotated',
  hipabd: 'hip abducted',
  shoulderabd: 'shoulder abducted',
  shoulderflex: 'shoulder flexed',
  shoulderrot: 'shoulder rotated',
  elbow: 'elbow bent',
}

export function condWords(cond: string): string {
  const r = cond.match(/^([\w-]+)=(-?[\d.]+)\.\.(-?[\d.]+)$/)
  if (r) {
    const side = r[1].endsWith('-R') ? 'right ' : r[1].endsWith('-L') ? 'left ' : ''
    const base = r[1].replace(/-(R|L)$/, '')
    return `the ${side}${JOINT_WORDS[base] ?? base} ${r[2]}–${r[3]}°`
  }
  if (cond === 'gloved') return 'gloves on'
  if (cond === 'untouched') return 'before you touch them'
  return POSTURE_WORDS[cond] ? `the patient ${POSTURE_WORDS[cond]}` : cond
}

/** One act, in words: "Feel: the left radial pulse", "Ask: “Make an 'OK' sign”". */
export function actWords(act: Act): string {
  const conds = act.conds.length ? ` (with ${act.conds.map(condWords).join(', ')})` : ''
  if (act.tool === 'say') {
    const s = sayOf(act.targets[0] ?? '')
    const side = s?.side ? ` — ${s.side === 'R' ? 'right' : 'left'} side` : ''
    return `Ask: “${s?.def.label ?? act.targets[0]}”${side}${conds}`
  }
  if (act.tool === 'gloves') return `Wash your hands and put gloves on${conds}`
  if (act.tool === 'move') {
    const m = (act.targets[0] ?? '').match(/^(\w+)(?:-(R|L))?(?::(\w+))?$/)
    const side = m?.[2] === 'R' ? 'right ' : m?.[2] === 'L' ? 'left ' : ''
    const how = m?.[3] === 'rot' ? ' — rotate it' : m?.[3] === 'abd' ? ' — take it out to the side' : m?.[3] === 'flex' ? ' — bend it' : ''
    return `Move the ${side}${m?.[1] ?? 'joint'}${how}${conds}`
  }
  const tool = toolById(act.tool)?.label ?? act.tool
  return `${tool}: ${act.targets.map(targetWords).join(' or ')}${conds}`
}

/** The next act still to do in an item (its first way of doing it), given the progress so far. */
export function nextAct(plan: Plan, progress: Progress): Act | null {
  const alt = plan[0]
  for (let p = 0; p < alt.length; p++) {
    const n = progress[0]?.[p] ?? 0
    if (n < alt[p].length) return alt[p][n]
  }
  return null
}

/** What must be put right before an act can count, in the order to do it: a position, gloves, a joint angle. */
export function unmet(act: Act, state: ExamState): string[] {
  return act.conds.filter((c) => c !== 'untouched' && !holds(c, state))
}

/** The sites an act could be done at, of those this body has. */
export function sitesFor(act: Act, has: (id: string) => boolean): string[] {
  return act.targets.flatMap(expand).filter(has)
}
