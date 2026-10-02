/**
 * Anterior shoulder dislocation: neurovascular check, and reduction by slow external rotation under procedural
 * sedation (RCEM/RCoA safe sedation; the external rotation technique). Pure.
 *
 * External rotation `er` is in degrees from neutral (the forearm pointing at the ceiling, elbow at his side):
 * negative is across his belly, 90 is the forearm lying flat out to the side. Going faster than the muscles can
 * relax builds spasm; enough spasm locks the arm until you pause.
 */

export type Check = 'badge' | 'deltoid' | 'wrist' | 'fingers' | 'pulse' | 'crt'
export type Ask = 'name' | 'tap'

export const ER_START = -30
export const ER_REDUCE = 75
/** Degrees per second the cuff tolerates; faster builds spasm. */
export const SAFE_RATE = 25

export type ShoulderRun = {
  before: Check[]
  after: Check[]
  sawShape: boolean
  depthChecked: Ask[]
  sedationistOnAirway: boolean | null
  er: number
  peakEr: number
  spasm: number
  locks: number
  lockedFor: number
  reduced: boolean
  hennepin: boolean
  levered: boolean
  sling: boolean
  xray: boolean
  observed: boolean
}

export function freshShoulder(): ShoulderRun {
  return {
    before: [],
    after: [],
    sawShape: false,
    depthChecked: [],
    sedationistOnAirway: null,
    er: ER_START,
    peakEr: ER_START,
    spasm: 0,
    locks: 0,
    lockedFor: 0,
    reduced: false,
    hennepin: false,
    levered: false,
    sling: false,
    xray: false,
    observed: false,
  }
}

/**
 * Rotate toward `want` over `dt` seconds. Fast rotation builds spasm, which decays when you go slowly or pause;
 * at full spasm the arm locks for two seconds. Sedation halves how fast spasm builds.
 */
export function rotate(run: ShoulderRun, want: number, dt: number, sedated: boolean): { patch: Partial<ShoulderRun>; event: 'move' | 'lock' | 'clunk' | 'locked' } {
  const t = Math.max(dt, 0.016)
  if (run.lockedFor > 0) return { patch: { lockedFor: Math.max(0, run.lockedFor - t), spasm: Math.max(0, run.spasm - 0.4 * t) }, event: 'locked' }
  const target = Math.max(-60, Math.min(110, want))
  const rate = Math.abs(target - run.er) / t
  const build = rate > SAFE_RATE ? ((rate - SAFE_RATE) / SAFE_RATE) * (sedated ? 0.5 : 1) * t * 2 : 0
  const spasm = Math.max(0, run.spasm + build - 0.5 * t)
  if (spasm >= 1) return { patch: { spasm: 0.6, locks: run.locks + 1, lockedFor: 2 }, event: 'lock' }
  const er = target
  const peakEr = Math.max(run.peakEr, er)
  // It goes back when the cuff and subscapularis relax: slowly, past about 75°.
  if (!run.reduced && er >= ER_REDUCE && spasm < 0.5 && (sedated || run.locks === 0)) return { patch: { er, peakEr, spasm, reduced: true }, event: 'clunk' }
  return { patch: { er, peakEr, spasm }, event: 'move' }
}

/** If external rotation alone has not done it: slow abduction while holding the rotation. */
export function abduct(run: ShoulderRun, sedated: boolean): Partial<ShoulderRun> {
  return { hennepin: true, reduced: run.reduced || (run.er >= 70 && run.spasm < 0.5 && sedated) }
}

/* ---------------------------------------------------------------- check */

export const CHECK_MARKS = ['axillary', 'motor', 'circ'] as const
export const REDUCE_MARKS = ['depth', 'technique', 'clunk', 'after', 'recovery'] as const
export type ShoulderRow = { key: string; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

const motorDone = (c: Check[]) => c.includes('wrist') && c.includes('fingers')

export function checkRows(run: ShoulderRun): ShoulderRow[] {
  const b = run.before
  return [
    { key: 'axillary', label: 'Axillary nerve', value: b.includes('badge') ? 'Badge sensation tested' : 'Not tested', range: 'Sensation over the regimental badge area, before you start', ok: b.includes('badge'), why: 'The axillary nerve is the one most often injured; a deficit found only afterwards looks like your fault.' },
    { key: 'motor', label: 'Radial, median, ulnar', value: motorDone(b) ? 'Wrist extension, finger movements' : 'Not fully tested', range: 'Wrist extension (radial), fist (median), finger spread (ulnar)', ok: motorDone(b), why: 'The brachial plexus can be stretched by the dislocation.' },
    { key: 'circ', label: 'Circulation', value: b.includes('pulse') ? 'Radial pulse felt' : 'Not checked', range: 'Radial pulse and refill', ok: b.includes('pulse'), why: 'Axillary artery injury is rare but disastrous, especially in older patients.' },
  ]
}

export function reduceRows(run: ShoulderRun, sedated: boolean): ShoulderRow[] {
  const a = run.after
  return [
    { key: 'depth', label: 'Sedation', value: `${sedated ? 'Sedated' : 'Not sedated'}; ${run.depthChecked.length ? `checked by ${run.depthChecked.join(' and ')}` : 'depth not checked'}; sedationist ${run.sedationistOnAirway === false ? 'left the airway' : run.sedationistOnAirway ? 'on the airway' : 'not told'}`, range: 'Depth checked before you start; the sedationist stays on the airway', ok: run.depthChecked.length > 0 && run.sedationistOnAirway === true, why: 'Too light and he fights you; too deep and nobody is watching his breathing.', critical: run.sedationistOnAirway === false },
    { key: 'technique', label: 'Technique', value: run.levered ? 'Kocher leverage' : `External rotation${run.hennepin ? ' then abduction' : ''}, ${run.locks} spasm lock${run.locks === 1 ? '' : 's'}`, range: 'Slow external rotation, elbow at the side, pausing when he tenses', ok: !run.levered && run.locks <= 1 && run.peakEr > 40, why: 'Speed provokes spasm; levering risks a humeral fracture and nerve injury.' },
    { key: 'clunk', label: 'Reduction', value: run.reduced ? 'Clunk; the round contour returned' : 'Not reduced', range: 'A clunk, the shoulder round again, the arm moving freely', ok: run.reduced, why: 'If it will not go with patience, do not force it: abduct slowly, or another technique.' },
    { key: 'after', label: 'After', value: [a.includes('badge') && 'badge', motorDone(a) && 'motor', a.includes('pulse') && 'pulse', run.sling && 'sling', run.xray && 'X-ray'].filter(Boolean).join(', ') || 'Nothing', range: 'Nerves and pulse again, a sling, a post-reduction X-ray', ok: a.includes('badge') && a.includes('pulse') && run.sling && run.xray, why: 'Compare with before; the X-ray confirms it and shows a Hill–Sachs or a fracture.' },
    { key: 'recovery', label: 'Recovery', value: run.observed ? 'Observed until he met the criteria' : 'Not observed', range: 'Monitored until awake and the discharge criteria are met', ok: run.observed, why: 'Peak respiratory depression often comes after the stimulus of the reduction has gone.' },
  ]
}
