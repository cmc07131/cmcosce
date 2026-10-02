/**
 * Pelvic binder for an open-book pelvic injury (ATLS 11th; NICE NG39; BOAST pelvic guidance). Pure.
 *
 * View from above, 160 × 220, head at the top: the iliac crests at y 60, the greater trochanters at y 104, the knees
 * at y 176. The binder slides up from the knees; its centre line is what matters.
 */

export const CRESTS_Y = 60
export const TROCHANTERS_Y = 104
export const KNEES_Y = 176
/** The binder locks at this tension. */
export const LOCK = 0.65

export type BinderRun = {
  explained: boolean
  pockets: boolean
  logRolled: boolean
  binderY: number | null
  slidFromKnees: boolean
  feetGap: number
  tied: boolean
  tension: number
  locked: boolean
  timed: boolean
  rechecked: boolean
}

export function freshBinder(): BinderRun {
  return { explained: false, pockets: false, logRolled: false, binderY: null, slidFromKnees: false, feetGap: 1, tied: false, tension: 0, locked: false, timed: false, rechecked: false }
}

export function placement(y: number | null): 'trochanters' | 'crests' | 'thighs' | 'none' {
  if (y === null) return 'none'
  if (Math.abs(y - TROCHANTERS_Y) <= 8) return 'trochanters'
  if (y < TROCHANTERS_Y - 8) return 'crests'
  return 'thighs'
}

/** How far the symphysis is sprung open (0 closed, 1 wide), from where the binder is and how tight. */
export function opened(r: BinderRun) {
  if (!r.locked) return 1
  const p = placement(r.binderY)
  return p === 'trochanters' ? (r.tied ? 0.1 : 0.25) : p === 'crests' ? 0.75 : 0.6
}

export const BINDER_MARKS = ['explain', 'slide', 'centre', 'feet', 'lock', 'recheck'] as const
export type BinderRow = { key: (typeof BINDER_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkBinder(r: BinderRun): BinderRow[] {
  const p = placement(r.binderY)
  return [
    { key: 'explain', label: 'Explain and prepare', value: [r.explained && 'explained', r.pockets && 'pockets emptied, belt off'].filter(Boolean).join(', ') || 'Neither', range: 'Tell her; empty her pockets and take off her belt', ok: r.explained && r.pockets, why: 'A phone or keys under a tight binder cause pressure sores.' },
    { key: 'slide', label: 'Slide it on', value: r.logRolled ? 'Log rolled her to feed it under' : r.slidFromKnees ? 'Slid under the knees and worked up' : 'Not placed', range: 'Under the knees, then sawed up to the hips; no log roll', ok: r.slidFromKnees && !r.logRolled, why: 'Every log roll can dislodge clot from the presacral veins.', critical: r.logRolled },
    { key: 'centre', label: 'Position', value: p === 'trochanters' ? 'Over the greater trochanters' : p === 'crests' ? 'Over the iliac crests' : p === 'thighs' ? 'Down on the thighs' : 'Not placed', range: 'Centred on the greater trochanters', ok: p === 'trochanters', why: 'Over the crests it can open the pelvis further; the trochanters are where the ring closes.' },
    { key: 'feet', label: 'Feet and knees', value: r.tied ? 'Together and tied' : r.feetGap < 0.2 ? 'Together, not tied' : 'Apart, rolled out', range: 'Feet and knees together, tied', ok: r.tied && r.feetGap < 0.2, why: 'Internal rotation of the legs helps close the ring.' },
    { key: 'lock', label: 'Tighten', value: `${r.locked ? 'Locked' : 'Not locked'}${r.timed ? ', time written on it' : ''}`, range: 'Tighten until it locks; write the time on it', ok: r.locked && r.timed, why: 'The time tells the next team how long the skin has been under pressure.' },
    { key: 'recheck', label: 'Recheck', value: r.rechecked ? 'Pulse and pressure rechecked' : 'Not rechecked', range: 'Pulse and blood pressure after the binder', ok: r.rechecked, why: 'Closing the ring should help; if it does not, she is bleeding from somewhere else too.' },
  ]
}
