/**
 * Fish hook removal by advance-and-cut (Tintinalli; Wilderness Medical Society). Pure.
 *
 * Side view of the thumb, 220 × 140: the pulp surface at y = 100. The hook's bend is an arc about C, radius R:
 * it entered the skin at angle 180° and its barbed point now lies under the skin at 45°. Advancing it along its own
 * curve, the point reaches the surface at 0° and comes out beyond.
 */

export type Pt = { x: number; y: number }

export const C: Pt = { x: 125, y: 100 }
export const R = 21
export const SURFACE_Y = 100
export const POINT_START = 45

export const onArc = (deg: number): Pt => ({ x: C.x + R * Math.cos((deg * Math.PI) / 180), y: C.y - R * Math.sin((deg * Math.PI) / 180) })
export const ENTRY = onArc(180)

/** The angle (degrees) of a finger about the bend, and how far it is off the curve. */
export function angleOf(p: Pt) {
  return { deg: (Math.atan2(C.y - p.y, p.x - C.x) * 180) / Math.PI, off: Math.abs(Math.hypot(p.x - C.x, p.y - C.y) - R) }
}

export type HookRun = {
  looked: boolean
  water: boolean
  tetanus: boolean
  allergy: boolean
  blocked: boolean
  eyes: boolean
  gripped: boolean
  point: number
  offCurve: number
  popped: boolean
  barbCut: boolean
  cutWrong: boolean
  removed: boolean
  pulledBarbed: boolean
  tore: boolean
  inspected: boolean
  dressed: boolean
}

export function freshHook(): HookRun {
  return { looked: false, water: false, tetanus: false, allergy: false, blocked: false, eyes: false, gripped: false, point: POINT_START, offCurve: 0, popped: false, barbCut: false, cutWrong: false, removed: false, pulledBarbed: false, tore: false, inspected: false, dressed: false }
}

/** Push the point on along the curve to angle `deg` (only forward: toward and through the skin). */
export function advance(run: HookRun, deg: number, off: number): { patch: Partial<HookRun>; event: 'move' | 'pop' | 'off' | 'none' } {
  if (!run.gripped || run.removed || run.barbCut) return { patch: {}, event: 'none' }
  if (off > 9) return { patch: { offCurve: run.offCurve + 1 }, event: 'off' }
  const point = Math.max(-30, Math.min(run.point, deg))
  if (point >= run.point) return { patch: {}, event: 'none' }
  const popped = run.popped || point <= -4
  return { patch: { point, popped }, event: popped && !run.popped ? 'pop' : 'move' }
}

/** Back the hook out along its entry path. With the barb still on, it catches and tears. */
export function backOut(run: HookRun): Partial<HookRun> {
  if (run.barbCut) return { removed: true }
  return { removed: true, tore: true, pulledBarbed: true }
}

export const HOOK_MARKS = ['assess', 'history', 'anaesthesia', 'eyes', 'advance', 'cut', 'retro', 'after'] as const
export type HookRow = { key: (typeof HOOK_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkHook(r: HookRun): HookRow[] {
  return [
    { key: 'assess', label: 'The hook', value: r.looked ? 'Single barb, 5 mm deep in the pulp, clear of joint and tendon' : 'Not assessed', range: 'Barbs, depth, and what is near it', ok: r.looked, why: 'A hook near the eye, a joint or the neurovascular bundle is for a specialist.' },
    { key: 'history', label: 'History', value: [r.water && 'sea water', r.tetanus && 'tetanus', r.allergy && 'allergies'].filter(Boolean).join(', ') || 'None', range: 'Salt or fresh water, tetanus, allergies', ok: r.water && r.tetanus && r.allergy, why: 'Salt water means Vibrio; fresh water, Aeromonas. Both change the antibiotic, if one is needed.' },
    { key: 'anaesthesia', label: 'Anaesthesia', value: r.blocked ? 'Cleaned, digital block' : 'None', range: 'Clean; local or a digital block', ok: r.blocked, why: 'Advancing a hook through the skin of an unanaesthetised thumb is very painful.' },
    { key: 'eyes', label: 'Eye protection', value: r.eyes ? 'Everyone' : 'None', range: 'Glasses on for everyone before you cut', ok: r.eyes, why: 'The cut barb flies.' },
    { key: 'advance', label: 'Advance', value: r.popped ? `Point through the skin${r.offCurve ? `, ${r.offCurve}× off its curve` : ''}` : 'Point still buried', range: 'Grip the shank, push the point along its curve out through the skin', ok: r.popped && r.offCurve <= 1, why: 'Following the curve of the hook makes the smallest second wound.' },
    { key: 'cut', label: 'Cut', value: r.barbCut ? 'Barb cut off' : r.cutWrong ? 'Cut in the wrong place' : 'Not cut', range: 'Cut the barb off where it is outside the skin', ok: r.barbCut, why: 'Once the barb is gone the hook backs out along its own track.' },
    { key: 'retro', label: 'Remove', value: r.removed ? (r.tore ? 'Pulled back with the barb on: torn' : 'Backed out along its entry path') : 'Still in', range: 'Back it out the way it went in', ok: r.removed && !r.tore, why: 'A barb pulled backwards tears a ragged wound.', critical: r.pulledBarbed },
    { key: 'after', label: 'Aftercare', value: [r.inspected && 'hook complete', r.dressed && 'irrigated and dressed'].filter(Boolean).join(', ') || 'Nothing', range: 'Check the hook is complete; irrigate, dress', ok: r.inspected && r.dressed, why: 'A piece left behind is a foreign body that will get infected.' },
  ]
}
