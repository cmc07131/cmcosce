/**
 * Vaginal breech delivery (RCOG Green-top 20b; ALSO). Pure. "Hands off the breech": touch only when needed.
 *
 * Here the left leg delivers with pushing; the right leg stays extended and needs Pinard's manoeuvre; the arms stay
 * up and need Løvset's manoeuvre.
 */

export type Pt = { x: number; y: number }
export type Grip = 'pelvis' | 'abdomen'

export type BreechRun = {
  pushes: number
  touchedEarly: number
  pulledLegs: boolean
  pinard: boolean
  /** Pushes when the leg was flexed out; progress resumes from there. */
  pinardAt: number
  backAngle: number
  backCorrected: boolean
  towel: boolean
  grip: Grip | null
  rotated: number
  armsOut: number
  heldUp: boolean
  hungS: number
  malar: boolean
  occiput: boolean
  headSpeed: number
  headOut: boolean
}

export function freshBreech(): BreechRun {
  return { pushes: 0, touchedEarly: 0, pulledLegs: false, pinard: false, pinardAt: 0, backAngle: 0, backCorrected: false, towel: false, grip: null, rotated: 0, armsOut: 0, heldUp: false, hungS: 0, malar: false, occiput: false, headSpeed: 0, headOut: false }
}

/**
 * How far the baby has come with her pushing: 1 the buttocks, 2 the left leg (the right stays up until Pinard),
 * 3 to the umbilicus, 4 to the scapulae.
 */
export const stageOf = (r: BreechRun) => (r.pinard ? Math.min(4, 2 + r.pushes - r.pinardAt) : Math.min(2, r.pushes))

/** Løvset: holding the pelvis, each half turn brings an arm under the pubic arch. */
export function rotate(run: BreechRun, deg: number): Partial<BreechRun> {
  // Travel either way counts: a half turn one way, then a half turn back.
  const rotated = run.rotated + Math.abs(deg)
  const halfTurns = Math.floor(rotated / 175)
  const armsOut = run.grip === 'pelvis' ? Math.max(run.armsOut, Math.min(2, halfTurns)) : run.armsOut
  return { rotated, armsOut }
}

export const BREECH_MARKS = ['handsoff', 'back', 'lovset', 'hang', 'msv'] as const
export type BreechRow = { key: (typeof BREECH_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkBreech(r: BreechRun): BreechRow[] {
  return [
    { key: 'handsoff', label: 'Hands off', value: r.pulledLegs ? 'Pulled on the legs' : `${r.pushes} pushes${r.pinard ? '; Pinard for the extended leg' : ''}${r.touchedEarly ? `; touched it ${r.touchedEarly}× before it was needed` : ''}`, range: 'Let her push it out; touch only to flex out a stuck leg (Pinard)', ok: !r.pulledLegs && r.pinard && r.touchedEarly === 0, why: 'Pulling makes the arms extend above the head and the head deflex: entrapment.', critical: r.pulledLegs },
    { key: 'back', label: 'Back anterior', value: `${r.backCorrected ? 'Kept anterior' : Math.abs(r.backAngle) > 45 ? 'Allowed to turn posterior' : 'Anterior'}${r.towel ? ', wrapped in a warm towel' : ''}`, range: 'The back kept anterior; the body wrapped in a towel', ok: Math.abs(r.backAngle) <= 45 && r.towel, why: 'Back posterior, the chin catches on the pubis.' },
    { key: 'lovset', label: 'Arms', value: r.grip === 'abdomen' ? 'Held by the abdomen' : r.armsOut >= 2 ? 'Løvset: both arms under the pubic arch' : `${r.armsOut} arm${r.armsOut === 1 ? '' : 's'} out`, range: 'Hold the bony pelvis; rotate 180° each way (Løvset)', ok: r.grip === 'pelvis' && r.armsOut >= 2, why: 'Squeezing the abdomen can rupture the liver or spleen; thumbs on the sacrum, fingers on the iliac crests.', critical: r.grip === 'abdomen' },
    { key: 'hang', label: 'Let it hang', value: r.heldUp ? 'Lifted up straight away' : r.hungS >= 3 ? 'Hung until the hairline showed' : 'Not long enough', range: 'Let the body hang until the nape of the neck and the hairline show', ok: !r.heldUp && r.hungS >= 3, why: 'The weight of the body flexes the head into the pelvis.' },
    { key: 'msv', label: 'The head', value: r.headOut ? `Mauriceau–Smellie–Veit${r.headSpeed > 0.6 ? ', delivered fast' : ', slowly'}` : r.malar && r.occiput ? 'Grip right, not delivered' : 'Not delivered', range: 'Fingers on the cheekbones, other hand on the occiput; flex and deliver slowly', ok: r.malar && r.occiput && r.headOut && r.headSpeed <= 0.6, why: 'A fast delivery of the head decompresses it suddenly: intracranial bleeding.' },
  ]
}
