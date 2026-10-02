/**
 * Resuscitative clamshell thoracotomy for tamponade after a stab wound (ERC 2021 traumatic arrest; ATLS 11th). Pure.
 *
 * Chest from the front, 180 × 170: sternum at x 90, his left on your right. The 4th/5th intercostal space runs at
 * y 96 at the sternum, curving down to y 108 at the mid-axillary lines (x 12 and x 168).
 * Inside, 180 × 150: the pericardium over the heart, the left phrenic nerve running down its left side (your right)
 * at x 132.
 */

export type Pt = { x: number; y: number }

export const SPACE = (x: number) => 96 + Math.min(12, (Math.abs(x - 90) / 78) * 12)
export const PHRENIC_X = 132
export const HOLE: Pt = { x: 80, y: 92 }

/** An incision drawn on one side: did it follow the space from the mid-axillary line to the sternum? */
export function judgeSide(path: Pt[], side: 'left' | 'right') {
  if (path.length < 3) return { ok: false, why: 'Too short.' }
  const xs = path.map((p) => p.x)
  const lateral = side === 'left' ? Math.max(...xs) >= 158 : Math.min(...xs) <= 22
  const medial = side === 'left' ? Math.min(...xs) <= 96 : Math.max(...xs) >= 84
  const offSpace = path.filter((p) => Math.abs(p.y - SPACE(p.x)) > 10).length / path.length
  if (!lateral) return { ok: false, why: 'Start right out at the mid-axillary line: you need the whole length to open the chest.' }
  if (!medial) return { ok: false, why: 'Carry it all the way to the sternum.' }
  if (offSpace > 0.3) return { ok: false, why: 'Follow the 4th/5th intercostal space, curving down toward the axilla.' }
  return { ok: true, why: null }
}

/** The pericardial incision: longitudinal (top to bottom) in front of the phrenic nerve, or across. */
export function judgePericardium(a: Pt, b: Pt) {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  const longitudinal = dy > dx * 1.5 && dy > 30
  const crossesPhrenic = Math.min(a.x, b.x) < PHRENIC_X && Math.max(a.x, b.x) > PHRENIC_X
  const besideNerve = Math.max(a.x, b.x) > PHRENIC_X - 6
  return { longitudinal, crossesPhrenic, besideNerve }
}

export type ClamRun = {
  left: boolean
  right: boolean
  sternum: 'saw' | 'shears' | null
  open: number
  lifted: boolean
  pericardium: 'longitudinal' | 'transverse' | null
  phrenicCut: boolean
  clot: number
  plugged: boolean
  beating: boolean
  closed: 'suture' | 'foley' | null
}

export function freshClam(): ClamRun {
  return { left: false, right: false, sternum: null, open: 0, lifted: false, pericardium: null, phrenicCut: false, clot: 0, plugged: false, beating: false, closed: null }
}

export const CLAM_MARKS = ['left', 'right', 'retract', 'open', 'clot', 'close'] as const
export type ClamRow = { key: (typeof CLAM_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkClam(r: ClamRun): ClamRow[] {
  return [
    { key: 'left', label: 'Left side', value: r.left ? 'Along the 4th/5th space, mid-axillary line to the sternum' : 'Not opened', range: 'Left 4th/5th space, from the mid-axillary line to the sternum', ok: r.left, why: 'The left side first: the heart is mostly there.' },
    { key: 'right', label: 'Right and sternum', value: r.right && r.sternum ? `Mirrored on the right; sternum divided with ${r.sternum === 'saw' ? 'the Gigli saw' : 'heavy shears'}` : 'Incomplete', range: 'Mirror it on the right and divide the sternum', ok: r.right && r.sternum !== null, why: 'A clamshell gives you the whole heart and both hila.' },
    { key: 'retract', label: 'Open and lift', value: [r.open >= 0.7 && 'chest opened wide', r.lifted && 'pericardium lifted with forceps'].filter(Boolean).join(', ') || 'Not done', range: 'Retractor in, open wide; tent the pericardium up with forceps', ok: r.open >= 0.7 && r.lifted, why: 'Tenting it up keeps the scissors off the heart.' },
    { key: 'open', label: 'Pericardium', value: r.pericardium === 'transverse' ? 'Opened across the front' : r.pericardium === 'longitudinal' ? `Opened longitudinally${r.phrenicCut ? ', through the phrenic nerve' : ', in front of the phrenic nerve'}` : 'Not opened', range: 'Longitudinally, in front of the phrenic nerve', ok: r.pericardium === 'longitudinal' && !r.phrenicCut, why: 'Across the front risks the phrenic nerves and the coronaries; behind it you cut the nerve.', critical: r.phrenicCut },
    { key: 'clot', label: 'Clot and hole', value: [r.clot >= 0.7 && 'clot scooped out', r.plugged && 'finger over the hole', r.beating && 'the heart beating'].filter(Boolean).join(', ') || 'Not done', range: 'Scoop out the clot; a finger over the hole in the ventricle', ok: r.clot >= 0.7 && r.plugged, why: 'Releasing the tamponade and plugging the hole is what restarts it.' },
    { key: 'close', label: 'Close the hole', value: r.closed === 'suture' ? 'Sutured' : r.closed === 'foley' ? 'Foley balloon as a bridge' : 'Still your finger', range: 'Sutures, or a Foley balloon as a bridge to theatre', ok: r.closed !== null, why: 'Your finger cannot go to theatre with him.' },
  ]
}
