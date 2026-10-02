/**
 * Shoulder dystocia (RCOG Green-top 42; ALSO HELPERR). Pure.
 *
 * Here the anterior shoulder stays impacted after McRoberts and suprapubic pressure: you need an internal manoeuvre.
 * The head-to-body interval runs in real seconds from the moment the bench opens.
 */

export type Pt = { x: number; y: number }
export type SpSite = 'correct' | 'wrong-side' | 'fundal' | 'other'
export type Internal = 'posterior-arm' | 'rotation'

/** Abdomen from the front, 160 × 140: the pubis at y 112, the fundus at y 24; the fetal back to her left (your right). */
export function spSiteAt(p: Pt): SpSite {
  if (p.y < 60) return 'fundal'
  if (p.y >= 86 && p.y <= 110) return p.x >= 82 && p.x <= 116 ? 'correct' : p.x < 78 && p.x > 40 ? 'wrong-side' : 'other'
  return 'other'
}

export type DystociaRun = {
  flatBack: boolean
  helpers: boolean
  hipFlex: number
  sp: SpSite | null
  continuousS: number
  rocks: number
  fundal: boolean
  tractions: { angle: number; force: number }[]
  episiotomy: boolean
  handIn: boolean
  elbowFlexed: boolean
  armSwept: boolean
  rubin: boolean
  woods: boolean
  internal: Internal | null
  delivered: boolean
  headToBodyS: number
  timeNoted: boolean
  resuscitaire: boolean
}

export function freshDystocia(): DystociaRun {
  return { flatBack: false, helpers: false, hipFlex: 0, sp: null, continuousS: 0, rocks: 0, fundal: false, tractions: [], episiotomy: false, handIn: false, elbowFlexed: false, armSwept: false, rubin: false, woods: false, internal: null, delivered: false, headToBodyS: 0, timeNoted: false, resuscitaire: false }
}

/** One attempt at traction on the head: `angle` below the line of the spine (degrees), `force` 0–1. Excessive: steep or hard. */
export const excessive = (t: { angle: number; force: number }) => t.angle > 30 || t.force > 0.7

/** McRoberts with good suprapubic pressure is not enough here; an internal manoeuvre frees it. */
export function freed(r: DystociaRun) {
  return r.internal !== null
}

export const DYSTOCIA_MARKS = ['mcroberts', 'suprapubic', 'posterior', 'rotate', 'deliver'] as const
export type DystociaRow = { key: (typeof DYSTOCIA_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkDystocia(r: DystociaRun): DystociaRow[] {
  const hard = r.tractions.filter(excessive).length
  const freedBy = r.internal === 'posterior-arm' ? 'the posterior arm' : r.internal === 'rotation' ? 'rotation' : null
  return [
    { key: 'mcroberts', label: 'McRoberts', value: r.hipFlex >= 0.8 && r.flatBack ? 'Flat, hips hyperflexed, thighs to the abdomen' : r.hipFlex > 0 ? 'Hips only partly flexed' : 'Not done', range: 'Lie her flat; two helpers hyperflex her hips', ok: r.hipFlex >= 0.8 && r.flatBack && r.helpers, why: 'It straightens the sacrum and rotates the pubis up over the shoulder.' },
    { key: 'suprapubic', label: 'Suprapubic pressure', value: r.fundal ? 'Fundal pressure' : r.sp === 'correct' ? `From the side of the back, ${r.continuousS >= 3 ? 'continuous' : 'brief'}${r.rocks >= 3 ? ', then rocking' : ''}${hard ? `; ${hard} hard or downward pull${hard === 1 ? '' : 's'} on the head` : ''}` : r.sp === 'wrong-side' ? 'From the wrong side' : 'Not done', range: 'Over the anterior shoulder from the side of the fetal back, continuous then rocking, with only gentle axial traction', ok: r.sp === 'correct' && r.continuousS >= 3 && r.rocks >= 3 && !r.fundal && hard === 0, why: 'It pushes the shoulder off the pubis. Fundal pressure impacts it further; downward traction stretches the brachial plexus.', critical: r.fundal || hard > 1 },
    { key: 'posterior', label: 'Internal manoeuvre', value: freedBy ? `Freed by ${freedBy}` : r.handIn ? 'Hand in, nothing delivered' : 'Not attempted', range: 'Hand in posteriorly: deliver the posterior arm, or rotate (Rubin II, Woods’ screw)', ok: freedBy !== null, why: 'When McRoberts and suprapubic pressure fail, go inside: there is room posteriorly.' },
    { key: 'rotate', label: 'Which manoeuvre', value: r.internal === 'rotation' ? `Rubin II${r.woods ? " and Woods' screw" : ''}` : r.internal === 'posterior-arm' ? 'Posterior arm: rotation not needed' : 'None', range: 'Posterior arm, or rotational manoeuvres', ok: freedBy !== null, why: 'Either reduces the diameter caught behind the pubis.' },
    { key: 'deliver', label: 'Delivery', value: r.delivered ? `Delivered at ${Math.round(r.headToBodyS)} s from the head${r.timeNoted ? ', time noted' : ''}${r.resuscitaire ? ', to the resuscitaire' : ''}` : 'Not delivered', range: 'Shoulders delivered; baby to the resuscitaire; the time noted', ok: r.delivered && r.timeNoted && r.resuscitaire, why: 'The head-to-body interval goes in the notes and to the neonatal team.' },
  ]
}
