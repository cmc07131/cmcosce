/**
 * Hands-on examination: the candidate performs each test and sees the sign, instead of picking the
 * test's name from a menu. A step option opts in with `perform: "exam"` and `pose: "<test>:<side>"`,
 * where side is the lesion side ("right", "left" or "none"). The finding text is still the option's
 * reply; the bench decides whether the technique earned the option's marks and what went wrong.
 *
 * Screen convention: the patient faces you, so the patient's right is on the viewer's left.
 */

export type ExamTest = 'eyes' | 'finger-nose'
export type Side = 'right' | 'left' | 'none'

export type ExamSpec = { test: ExamTest; side: Side }

export function examSpec(pose: string | undefined): ExamSpec | null {
  const [test, side = 'none'] = (pose ?? '').split(':')
  if (test !== 'eyes' && test !== 'finger-nose') return null
  if (side !== 'right' && side !== 'left' && side !== 'none') return null
  return { test, side }
}

export type ExamFault = { text: string; critical?: boolean }
export type ExamScore = { ok: boolean; faults: ExamFault[]; technique: string }

/* ---------------------------------------------------------------- eye movements */

/**
 * Gaze from the pen position (stage %, 0–100). Positive h is the patient's right (viewer's left),
 * positive v is up. 1.0 is about 40°, the edge of comfortable gaze; beyond that is the extreme.
 */
export function gazeOf(x: number, y: number) {
  return { h: clamp((50 - x) / 40, -1.3, 1.3), v: clamp((50 - y) / 34, -1.3, 1.3) }
}

export const LATERAL = 0.35
export const EXTREME = 1.05

/**
 * Horizontal eye offset (in gaze units) added by nystagmus at time t (s): a slow drift back toward the
 * middle, then a quick jerk toward the side of gaze. Gaze-evoked nystagmus in a cerebellar lesion beats
 * toward the side of the lesion and is worst looking that way. At the extreme of gaze anyone shows a few
 * fine beats (end-point nystagmus), which is why you stop at about 30°.
 */
export function nystagmus(t: number, h: number, side: Side) {
  const toward = h > 0 ? 'right' : 'left'
  let amp = 0
  let hz = 2.4
  if (side !== 'none' && toward === side && Math.abs(h) > 0.2) amp = 0.06 + (Math.abs(h) - 0.2) * 0.1
  else if (side !== 'none' && Math.abs(h) > 0.6) amp = 0.02
  if (Math.abs(h) > EXTREME) {
    amp = Math.max(amp, 0.035)
    hz = Math.max(hz, 3.2)
  }
  if (!amp) return 0
  const phase = (t * hz) % 1
  // 80% of the cycle drifting back to the middle, 20% jerking out again.
  const drift = phase < 0.8 ? phase / 0.8 : 1 - (phase - 0.8) / 0.2
  return -Math.sign(h) * amp * drift
}

export type EyesRun = {
  toldHeadStill: boolean
  askedDiplopia: boolean
  /** Longest steady hold (s) in each gaze zone. */
  held: { right: number; left: number; up: number; down: number }
  extreme: boolean
  /** The pen moved while the patient had not been told to keep his head still. */
  headFollowed: boolean
}

export function freshEyes(): EyesRun {
  return { toldHeadStill: false, askedDiplopia: false, held: { right: 0, left: 0, up: 0, down: 0 }, extreme: false, headFollowed: false }
}

export function zoneOf(h: number, v: number): keyof EyesRun['held'] | null {
  if (Math.abs(h) >= LATERAL && Math.abs(h) >= Math.abs(v)) return h > 0 ? 'right' : 'left'
  if (Math.abs(v) >= LATERAL) return v > 0 ? 'up' : 'down'
  return null
}

/** A hold of 1 second at the side is enough to see nystagmus; up and down need a brief look. */
export const HOLD_S = 1
export const GLANCE_S = 0.4

export function scoreEyes(run: EyesRun, side: Side): ExamScore {
  const faults: ExamFault[] = []
  const bothSides = run.held.right >= HOLD_S && run.held.left >= HOLD_S
  const vertical = run.held.up >= GLANCE_S && run.held.down >= GLANCE_S
  if (!run.toldHeadStill) faults.push({ text: 'Eye movements: ask him to keep his head still and follow the pen with his eyes only. He turned his head instead.' })
  if (!bothSides) {
    const missed = [run.held.right < HOLD_S && 'his right', run.held.left < HOLD_S && 'his left'].filter(Boolean).join(' and ')
    faults.push({ text: `Eye movements: hold the pen for a second or two to ${missed} — nystagmus only shows on sustained gaze.` })
  }
  if (!vertical) faults.push({ text: 'Eye movements: also look up and down (the H pattern) for vertical nystagmus and palsies.' })
  if (run.extreme) faults.push({ text: 'Eye movements: the pen went to the extreme of gaze, where a few beats of nystagmus are normal. Stop at about 30°.' })
  const ok = run.toldHeadStill && bothSides && vertical
  const lesion = side === 'none' ? '' : ` The nystagmus is worst looking to his ${side}.`
  const technique = ok
    ? `Good technique: head still, H pattern, gaze held at each side.${lesion}`
    : bothSides
      ? 'Incomplete technique (see the debrief).'
      : `You didn't hold gaze on both sides, so you could have missed it.${lesion}`
  return { ok, faults, technique }
}

/* ---------------------------------------------------------------- finger–nose */

export type Pt = { x: number; y: number }

/** Scene units (200 × 160). The patient's right shoulder is on the viewer's left. */
export const NOSE: Pt = { x: 100, y: 52 }
export const SHOULDER: Record<'right' | 'left', Pt> = { right: { x: 72, y: 92 }, left: { x: 128, y: 92 } }

/**
 * How far your finger is from his face, in cm. His arm is about 70 cm long: the finger should sit at
 * the full stretch of his arm, where intention tremor is worst, and not beyond it.
 */
export const ARM_CM = 70
export type Reach = 'close' | 'good' | 'far'

export function reachOf(cm: number): Reach {
  if (cm < 50) return 'close'
  if (cm > ARM_CM + 8) return 'far'
  return 'good'
}

/**
 * The fingertip at time t (s) through one touch cycle: nose to target (0–1 s) and back (1–2 s).
 * An ataxic arm oscillates across the line of travel, more as it closes on the target (intention
 * tremor), and overshoots before correcting (past-pointing).
 */
export function fingertip(t: number, target: Pt, ataxic: boolean): Pt {
  const cycle = t % 2
  const out = cycle < 1
  const s = out ? cycle : 2 - cycle
  const eased = s * s * (3 - 2 * s)
  const dx = target.x - NOSE.x
  const dy = target.y - NOSE.y
  const len = Math.hypot(dx, dy) || 1
  let x = NOSE.x + dx * eased
  let y = NOSE.y + dy * eased
  if (ataxic) {
    const amp = 9 * s ** 3
    const wobble = Math.sin(t * 2 * Math.PI * 5) * amp
    // Across the line of travel.
    x += (-dy / len) * wobble
    y += (dx / len) * wobble
    // Past-pointing: overshoot beyond the target near the end of the reach.
    const over = Math.max(0, 1 - Math.abs(s - 0.95) / 0.12) * 7
    x += (dx / len) * over
    y += (dy / len) * over
  }
  return { x, y }
}

export type Attempt = { arm: 'right' | 'left'; target: Pt; cm: number; reach: Reach }

export type FingerNoseRun = { instructed: boolean; attempts: Attempt[] }

export function freshFingerNose(): FingerNoseRun {
  return { instructed: false, attempts: [] }
}

export function scoreFingerNose(run: FingerNoseRun, side: Side): ExamScore {
  const faults: ExamFault[] = []
  const good = run.attempts.filter((a) => a.reach === 'good')
  const arms = new Set(good.map((a) => a.arm))
  const moved = (['right', 'left'] as const).some((arm) => {
    const ts = good.filter((a) => a.arm === arm).map((a) => a.target)
    return ts.some((a) => ts.some((b) => Math.hypot(a.x - b.x, a.y - b.y) > 16))
  })
  if (!run.instructed) faults.push({ text: 'Finger–nose: explain and demonstrate first ("touch my finger, then your nose, as quickly as you can").' })
  if (run.attempts.some((a) => a.reach === 'close')) faults.push({ text: 'Finger–nose: your finger was too close. Hold it at the full stretch of his arm — intention tremor shows at the end of the reach.' })
  if (run.attempts.some((a) => a.reach === 'far')) faults.push({ text: 'Finger–nose: your finger was out of his reach. Full stretch, not beyond it.' })
  if (arms.size < 2) faults.push({ text: 'Finger–nose: test both arms and compare the sides.' })
  if (!moved) faults.push({ text: 'Finger–nose: move your finger between touches, so he has to aim each time.' })
  const ok = arms.size === 2 && moved
  const seen = side !== 'none' && good.some((a) => a.arm === side)
  const technique = ok
    ? 'Good technique: full reach, both arms, target moved.'
    : seen || side === 'none'
      ? 'Incomplete technique (see the debrief).'
      : `You didn't test his ${side} arm at full reach, so you could have missed it.`
  return { ok, faults, technique }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
