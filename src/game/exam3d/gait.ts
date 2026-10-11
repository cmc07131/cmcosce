/**
 * Walking, as joint angles over the gait cycle. Pure.
 *
 * An antalgic gait (a painful leg): as little time as possible standing on the sore leg. It strikes, takes the weight
 * briefly with the knee held bent and stiff, and the good leg is hurried through in a short, quick step to take the
 * weight off it; then a long stance on the good leg while the sore one swings through, barely bending. The body dips
 * as the weight goes onto the bent sore knee, and the face winces.
 */

export type Side = 'R' | 'L'

/** One leg's timing in the cycle (fractions): heel strike, toe off (after 1: in the next cycle); and its angles. */
type LegPlan = {
  strike: number
  off: number
  /** Hip flexion at heel strike and at toe off (degrees; negative: extension). */
  hipStrike: number
  hipOff: number
  /** Knee flexion at heel strike, the extra bend as it takes the weight, at toe off, and at the height of the swing. */
  kneeStrike: number
  kneeLoad: number
  kneeOff: number
  kneeSwing: number
}

const GOOD: Omit<LegPlan, 'strike' | 'off'> = { hipStrike: 22, hipOff: -12, kneeStrike: 4, kneeLoad: 12, kneeOff: 35, kneeSwing: 58 }
/** Held bent and stiff: never straight, little more bend in the swing. */
const SORE: Omit<LegPlan, 'strike' | 'off'> = { hipStrike: 14, hipOff: 0, kneeStrike: 18, kneeLoad: 4, kneeOff: 25, kneeSwing: 36 }

/** Seconds per cycle (two steps): slow. */
export const ANTALGIC_CYCLE = 1.35

const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
/** A hump from `a` to `b` (0 outside), peaking half way. */
const bump = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI))

/** Where in its own stance (0 … 1) or swing (0 … 1) a leg is at cycle fraction `p`. */
function phaseOf(p: number, plan: { strike: number; off: number }): { stance: boolean; u: number } {
  const since = (((p - plan.strike) % 1) + 1) % 1
  const stanceLen = plan.off - plan.strike
  return since < stanceLen ? { stance: true, u: since / stanceLen } : { stance: false, u: (since - stanceLen) / (1 - stanceLen) }
}

function legAngles(p: number, plan: LegPlan) {
  const { stance, u } = phaseOf(p, plan)
  if (stance) {
    const hip = lerp(plan.hipStrike, plan.hipOff, u)
    const knee = plan.kneeStrike + plan.kneeLoad * bump(u, 0, 0.45) + (plan.kneeOff - plan.kneeStrike) * ease((u - 0.65) / 0.35)
    const ankle = -8 * bump(u, 0.2, 0.8) + 15 * ease((u - 0.8) / 0.2)
    return { hip, knee, ankle, stance }
  }
  const hip = lerp(plan.hipOff, plan.hipStrike, ease(u / 0.7)) + 3 * bump(u, 0.4, 1)
  const knee = u < 0.35 ? lerp(plan.kneeOff, plan.kneeSwing, ease(u / 0.35)) : lerp(plan.kneeSwing, plan.kneeStrike, ease((u - 0.35) / 0.65))
  const ankle = lerp(15, 0, ease(u / 0.4))
  return { hip, knee, ankle, stance }
}

/**
 * The joints `t` seconds into an antalgic walk on the `sore` side: each leg's hip, knee and ankle, each arm's swing,
 * how far the body dips (0 … 1) and how much it hurts (0 … 1) this instant.
 */
export function antalgic(t: number, sore: Side) {
  const p = (((t / ANTALGIC_CYCLE) % 1) + 1) % 1
  const good: Side = sore === 'R' ? 'L' : 'R'
  // The sore leg strikes at 0 and is off again by 0.4; the good one is snatched off at 0.08 and down again by 0.27.
  const plans: Record<Side, LegPlan> = {
    [sore]: { ...SORE, strike: 0, off: 0.4 },
    [good]: { ...GOOD, strike: 0.27, off: 1.08 },
  } as Record<Side, LegPlan>
  const legs = { R: legAngles(p, plans.R), L: legAngles(p, plans.L) }
  // Alone on the sore leg (from the good one's toe off to its strike): the dip, and the wince.
  const alone = bump(p, 0.06, 0.28)
  return {
    legs,
    arms: { R: -0.45 * legs.R.hip, L: -0.45 * legs.L.hip },
    dip: alone,
    pain: alone,
    /** Fraction of the cycle each foot is on the ground. */
    stance: { [sore]: 0.4, [good]: 0.81 } as Record<Side, number>,
  }
}
