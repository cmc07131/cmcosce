/**
 * Dix–Hallpike and Epley for right posterior canal BPPV (Bhattacharyya et al., AAO-HNS BPPV guideline 2017). Pure.
 *
 * The bench poses a 3D patient from these numbers; the scoring reads them.
 */

export type Dx = 'right-posterior' | 'left-posterior' | 'horizontal' | 'central'

export type PosRun = {
  explained: boolean
  eyesOpenAsked: boolean
  /** Hip position along the couch: 0.85 m (head on the couch) to 0.55 m (head over the end). */
  hipX: number
  /** Head rotation, degrees, positive to her right. */
  yaw: number
  /** 0 sitting, 1 lying. */
  lie: number
  /** 0 on her back, -1 on her left side. */
  roll: number
  /** Head extension below the couch, degrees. */
  ext: number
  flex: number
  /** Seconds from starting to lie her back to being flat. */
  dropS: number | null
  /** Head rotation when she went down. */
  yawAtDrop: number | null
  extAtDrop: number
  watchedS: number
  sawNystagmus: boolean
  dx: Dx | null
  holds: number[]
  turned: boolean
  rolled: boolean
  satUp: boolean
  satFast: boolean
  retested: boolean
}

export function freshPos(epley: boolean): PosRun {
  const base: PosRun = { explained: false, eyesOpenAsked: false, hipX: 0.85, yaw: 0, lie: 0, roll: 0, ext: 0, flex: 0, dropS: null, yawAtDrop: null, extAtDrop: 0, watchedS: 0, sawNystagmus: false, dx: null, holds: [0, 0, 0], turned: false, rolled: false, satUp: false, satFast: false, retested: false }
  // The Epley starts where a positive right Hallpike left her.
  return epley ? { ...base, explained: true, eyesOpenAsked: true, hipX: 0.55, yaw: 45, lie: 1, ext: 20, dropS: 1, yawAtDrop: 45, extAtDrop: 20, watchedS: 30, sawNystagmus: true, dx: 'right-posterior' } : base
}

/** She is far enough down the couch for her head to hang over the end. */
export const headOverEnd = (r: PosRun) => r.hipX <= 0.6

/**
 * Right posterior canal BPPV: after a latency of a few seconds, torsional nystagmus with the upper poles beating
 * toward the right (lower) ear and an up-beating component, building then fading within about 20 seconds.
 * Returns the eye position (degrees) at `t` seconds in the provoking position, and how strong it is.
 */
export function nystagmus(t: number) {
  if (t < 4) return { torsion: 0, vertical: 0, strength: 0 }
  const e = t < 8 ? (t - 4) / 4 : t < 16 ? 1 : Math.max(0, 1 - (t - 16) / 8)
  const phase = (t * 2.6) % 1
  // Slow drift away, then a quick beat back (the fast phase, toward the right ear and up).
  const saw = phase < 0.82 ? 1 - phase / 0.82 : (phase - 0.82) / 0.18
  return { torsion: 12 * e * saw, vertical: 5 * e * saw, strength: e }
}

/** Is she in the provoking position for the right posterior canal: head turned right, lying, head down? */
export const provoking = (r: PosRun) => r.lie >= 0.95 && r.roll > -0.2 && r.yaw >= 25 && r.ext >= 10

export type CheckRow = { key: string; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export const HALLPIKE_MARKS = ['explain', 'start', 'turn', 'drop', 'watch', 'interpret'] as const
export const EPLEY_MARKS = ['hold1', 'turn90', 'roll', 'sit', 'retest'] as const

export function hallpikeRows(r: PosRun): CheckRow[] {
  const turn = r.yawAtDrop ?? r.yaw
  return [
    { key: 'explain', label: 'Explain', value: [r.explained && 'warned it may make her dizzy', r.eyesOpenAsked && 'asked to keep her eyes open'].filter(Boolean).join(', ') || 'Nothing said', range: 'Warn her it may bring on the spinning; ask her to keep her eyes open on you', ok: r.explained && r.eyesOpenAsked, why: 'Frightened, she shuts her eyes when it spins, and then you see nothing.' },
    { key: 'start', label: 'Start position', value: headOverEnd(r) ? 'Far enough down the couch for the head to hang over the end' : 'Too far up: her head stayed on the couch', range: 'Sat so that, lying back, her head hangs over the end of the couch', ok: headOverEnd(r), why: 'The head has to go below the horizontal to bring the posterior canal into play.' },
    { key: 'turn', label: 'Head turn', value: `${Math.round(Math.abs(turn))}° to the ${turn >= 0 ? 'right' : 'left'}`, range: 'About 45° toward the ear being tested (right)', ok: turn >= 35 && turn <= 55, why: '45° lines the posterior canal up with the plane of the movement.' },
    { key: 'drop', label: 'Lie back', value: r.dropS === null ? 'Not done' : `In ${r.dropS.toFixed(1)} s, head ${Math.round(r.extAtDrop)}° below the couch`, range: 'Briskly (a second or two), the head about 20° below the horizontal, supported', ok: r.dropS !== null && r.dropS <= 2.5 && r.extAtDrop >= 15 && r.extAtDrop <= 35, why: 'A slow lie-back may not move the debris; without extension the canal is not in the plane of gravity.' },
    { key: 'watch', label: 'Watch', value: `${Math.round(r.watchedS)} s${r.sawNystagmus ? ': the nystagmus seen' : ''}`, range: 'At least 30 seconds: latency, direction, duration', ok: r.watchedS >= 30 && r.sawNystagmus, why: 'It starts after a few seconds and fades: stop early, or let her shut her eyes, and you miss it.' },
    { key: 'interpret', label: 'Interpret', value: r.dx ? { 'right-posterior': 'Right posterior canal BPPV', 'left-posterior': 'Left posterior canal BPPV', horizontal: 'Horizontal canal BPPV', central: 'Central cause' }[r.dx] : 'None', range: 'Torsional, up-beating toward the down (right) ear, with latency and fatigue: right posterior canal BPPV', ok: r.dx === 'right-posterior', why: 'The down ear is the affected ear; a purely vertical, non-fatiguing or direction-changing nystagmus is central.' },
  ]
}

export function epleyRows(r: PosRun): CheckRow[] {
  return [
    { key: 'hold1', label: 'Start', value: `Right Hallpike held ${Math.round(r.holds[0])} s`, range: 'Stay in the right Hallpike position for 30 seconds', ok: r.holds[0] >= 30, why: 'Let the debris settle before the next move.' },
    { key: 'turn90', label: 'Turn', value: r.turned ? `Head turned 90° to the left, held ${Math.round(r.holds[1])} s` : 'Not turned', range: 'Turn the head 90° to the left, keeping it extended; 30 seconds', ok: r.turned && r.holds[1] >= 30, why: 'This moves the debris round the canal toward the common crus.' },
    { key: 'roll', label: 'Roll', value: r.rolled ? `Onto her left side, nose down, held ${Math.round(r.holds[2])} s` : 'Not rolled', range: 'Roll her onto her left side, head turned on so the nose points to the floor; 30 seconds', ok: r.rolled && r.holds[2] >= 30, why: 'Nose down carries the debris out into the utricle.' },
    { key: 'sit', label: 'Sit up', value: r.satUp ? (r.satFast ? 'Sat up quickly' : 'Sat up slowly, chin slightly down') : 'Still lying', range: 'Sit up slowly, chin slightly down', ok: r.satUp && !r.satFast, why: 'She will feel briefly dizzy as she comes up: slowly, supported.' },
    { key: 'retest', label: 'Retest', value: r.retested ? 'Repeat right Hallpike: no nystagmus' : 'Not retested', range: 'Repeat the Dix–Hallpike', ok: r.retested, why: 'No nystagmus means treated; if still positive, repeat the Epley.' },
  ]
}
