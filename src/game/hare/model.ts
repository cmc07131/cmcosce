/**
 * Hare traction splint on a closed mid-shaft fracture of the left femur (manufacturer's instructions; JRCALC).
 * Pure, so the test can drive a whole application without a screen.
 *
 * Distances along the leg are in cm from the ischial tuberosity (0) toward the heel. The right (uninjured) leg is
 * 86 cm from ischium to heel. The left is shortened by muscle spasm over the fracture; traction pulls it back out.
 */

export const WEIGHT_KG = 65
export const HEEL_CM = 86
export const FRACTURE_CM = 20
export const KNEE_CM = 43
export const ANKLE_CM = 80
/** Shortening of the left leg before any traction. */
export const SHORT_CM = 3

/** About 10% of body weight, never more than 7 kg: stop when the pain eases and the length matches. */
export const TRACTION_OK = { min: 5, max: 7 }
/** What a nurse holding the hitch steadily gives you. */
export const MANUAL_KG = 4
/** Past this the hitch strangles the foot and the nerves stretch. */
export const OVER_KG = 8
/** How far the splint should reach past the heel, so the windlass has room. */
export const BEYOND_OK = { min: 18, max: 32 }
/** Snug: two fingers fit under. */
export const SNUG = { min: 0.35, max: 0.75 }

export const STRAP_ZONES = {
  fracture: [FRACTURE_CM - 5, FRACTURE_CM + 5],
  knee: [KNEE_CM - 5, KNEE_CM + 5],
  ankle: [ANKLE_CM - 4, 200],
} as const

export type Region = 'pelvis' | 'hip' | 'thigh' | 'knee' | 'shin' | 'ankle'
export type FootCheck = 'dp' | 'pt' | 'sens' | 'move' | 'crt'
export type HitchAt = 'ankle' | 'calf' | 'foot'
export type ManualHow = 'steady' | 'jerk' | 'lift'

export const REGIONS: Region[] = ['pelvis', 'hip', 'thigh', 'knee', 'shin', 'ankle']

export type HareRun = {
  /** Trouser leg cut away: you can see the thigh. */
  exposed: boolean
  shoeOff: boolean
  regions: Region[]
  before: FootCheck[]
  after: FootCheck[]

  measuredOn: 'right' | 'left' | null
  lengthCm: number
  locked: boolean

  straps: number[]

  hitchAt: HitchAt | null
  hitchOverShoe: boolean
  hitchTension: number

  manual: boolean
  manualHow: ManualHow | null
  /** A sharp pull at any point, even if she held it steadily afterwards. */
  jerked: boolean
  manualBeforeSlide: boolean
  slidUnsupported: boolean

  ringCm: number | null
  ischialTension: number

  hooked: boolean
  kg: number
  releasedEarly: boolean
  peakKg: number

  fastened: boolean[]
  stand: boolean

  painSpikes: number
}

export function freshHare(): HareRun {
  return {
    exposed: false,
    shoeOff: false,
    regions: [],
    before: [],
    after: [],
    measuredOn: null,
    lengthCm: 96,
    locked: false,
    straps: [92, 96, 100, 104],
    hitchAt: null,
    hitchOverShoe: false,
    hitchTension: 0,
    manual: false,
    manualHow: null,
    jerked: false,
    manualBeforeSlide: false,
    slidUnsupported: false,
    ringCm: null,
    ischialTension: 0,
    hooked: false,
    kg: 0,
    releasedEarly: false,
    peakKg: 0,
    fastened: [false, false, false, false],
    stand: false,
    painSpikes: 0,
  }
}

/* ---------------------------------------------------------------- the leg under traction */

/** The pull on the leg: the ratchet once hooked, or the nurse's hands while she holds. */
export function pull(run: HareRun) {
  const mech = run.hooked ? run.kg : 0
  return Math.max(mech, run.manual && run.manualHow !== 'lift' ? MANUAL_KG : 0)
}

/** How much shorter the left leg is than the right, cm. Negative: over-distracted. */
export function shortfall(run: HareRun) {
  return Math.max(-2.5, SHORT_CM - 0.5 * pull(run))
}

/** Where the left heel is, cm from the ischium. */
export const leftHeel = (run: HareRun) => HEEL_CM - shortfall(run)

/** Pain out of ten: analgesia lowers the floor, traction eases spasm, too much hurts again. */
export function pain(run: HareRun, analgesia: boolean) {
  const kg = pull(run)
  const base = analgesia ? 5 : 8
  const p = base - Math.min(3, kg * 0.5) + Math.max(0, kg - TRACTION_OK.max) * 1.5 + (run.ischialTension > 0.85 ? 2 : 0) + (run.hitchTension > 0.85 ? 1 : 0)
  return Math.max(0, Math.min(10, Math.round(p)))
}

/** The foot is in trouble: over-traction, or a hitch strangling the ankle. */
export const footCompromised = (run: HareRun) => pull(run) > OVER_KG || (run.hitchAt !== null && run.hitchTension > 0.85)

/** What you find at the foot. */
export function footFinding(run: HareRun, check: FootCheck): string {
  const bad = footCompromised(run)
  switch (check) {
    case 'dp':
      return bad ? 'Dorsalis pedis: faint, much weaker than before.' : 'Dorsalis pedis: strong and regular.'
    case 'pt':
      return bad ? 'Posterior tibial: barely palpable.' : 'Posterior tibial: strong, behind the medial malleolus.'
    case 'sens':
      return bad ? '"Pins and needles over the top of my foot."' : 'He feels your touch on every toe and the web space.'
    case 'move':
      return bad ? 'He can barely move his toes, and it hurts.' : 'He wiggles his toes and pulls the foot up and down.'
    case 'crt':
      return bad ? 'The nail bed stays pale: 4 seconds.' : 'Capillary refill under 2 seconds.'
  }
}

export const REGION_FINDING: Record<Region, string> = {
  pelvis: 'Gentle pressure on both iliac crests: no pain, it feels stable. (Never spring it.)',
  hip: 'Groin and hip: not tender, no deformity at the hip.',
  thigh: 'Mid-thigh swelling and angulation. The skin is intact all round: a closed fracture.',
  knee: 'Knee: no effusion, no tenderness, patella intact.',
  shin: 'Tibia and fibula: not tender along their length.',
  ankle: 'Ankle and foot: no swelling or tenderness.',
}

/* ---------------------------------------------------------------- straps */

export type StrapSpot = 'thigh' | 'calf' | 'fracture' | 'knee' | 'ankle' | 'top'

export function strapSpot(cm: number): StrapSpot {
  const within = (z: readonly [number, number]) => cm >= z[0] && cm <= z[1]
  if (cm < 4) return 'top'
  if (within(STRAP_ZONES.fracture)) return 'fracture'
  if (within(STRAP_ZONES.knee)) return 'knee'
  if (within(STRAP_ZONES.ankle)) return 'ankle'
  return cm < KNEE_CM ? 'thigh' : 'calf'
}

/** Straps sit at a distance along the splint from the ring; on the leg that is measured from the ischium. */
export const strapSpots = (run: HareRun) => run.straps.map((cm) => strapSpot(cm + (run.ringCm ?? 0)))

export function strapsOk(straps: number[], ringCm = 0) {
  const spots = straps.map((cm) => strapSpot(cm + ringCm))
  return spots.filter((s) => s === 'thigh').length === 2 && spots.filter((s) => s === 'calf').length === 2
}

/* ---------------------------------------------------------------- the steps that change the run */

/** Slide the splint up under the leg to `ringCm`. Without someone holding traction the fracture moves. */
export function slide(run: HareRun, ringCm: number): Partial<HareRun> {
  const supported = run.manual && run.manualHow !== 'lift'
  return {
    ringCm: Math.max(-8, Math.min(20, ringCm)),
    manualBeforeSlide: run.manualBeforeSlide || supported,
    slidUnsupported: run.slidUnsupported || !supported,
    painSpikes: run.painSpikes + (supported ? 0 : 1),
  }
}

/** The nurse lets go. If the ratchet has not taken over, the leg springs back. */
export function releaseManual(run: HareRun): Partial<HareRun> {
  const mech = run.hooked ? run.kg : 0
  const early = mech < MANUAL_KG
  return { manual: false, releasedEarly: run.releasedEarly || early, painSpikes: run.painSpikes + (early ? 1 : 0) }
}

/** Space between the restored heel and the windlass, cm. A short splint runs out of room to wind. */
export const windRoom = (run: HareRun) => (run.ringCm ?? 0) + run.lengthCm - HEEL_CM

/** The most the ratchet can pull before the foot meets the windlass. */
export const maxKg = (run: HareRun) => Math.max(0, Math.min(12, windRoom(run) - 6))

/** Ratchet. Nothing pulls until the hook is on the D-ring. */
export function wind(run: HareRun, kg: number): Partial<HareRun> {
  const next = Math.max(0, Math.min(maxKg(run), kg))
  return { kg: next, peakKg: Math.max(run.peakKg, run.hooked ? next : 0) }
}

export const beyondHeel = (run: HareRun) => run.lengthCm - (run.measuredOn === 'left' ? HEEL_CM - SHORT_CM : HEEL_CM)

/* ---------------------------------------------------------------- the check and the score */

export const HARE_MARKS = ['nvBefore', 'contra', 'measure', 'straps', 'hitch', 'manual', 'ring', 'traction', 'secure', 'nvAfter'] as const
export type HareMark = (typeof HARE_MARKS)[number]

export type HareRow = { key: HareMark; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

const nvDone = (c: FootCheck[]) => (c.includes('dp') || c.includes('pt')) && c.includes('sens') && c.includes('move')

export function checkHare(run: HareRun): HareRow[] {
  const missing = REGIONS.filter((r) => !run.regions.includes(r))
  const beyond = beyondHeel(run)
  const spots = strapSpots(run)
  const kg = run.hooked ? run.kg : 0
  const ring = run.ringCm
  const fastenedAll = run.fastened.every(Boolean)
  return [
    {
      key: 'nvBefore',
      label: 'Foot before',
      value: nvDone(run.before) ? 'Pulse, sensation, movement' : run.before.length ? `Only ${run.before.join(', ')}` : 'Not checked',
      range: 'Pulse, sensation and movement, shoe off',
      ok: nvDone(run.before),
      why: 'You need a baseline: a foot that goes cold after the splint means a strap or the hitch is too tight.',
    },
    {
      key: 'contra',
      label: 'Contraindications',
      value: missing.length ? `Not checked: ${missing.join(', ')}` : 'Pelvis, hip, knee, leg, ankle, skin',
      range: 'Pelvis, hip, knee, lower leg, ankle and an open wound excluded',
      ok: !missing.length,
      why: 'The ring pushes on the ischium and the hitch pulls on the ankle: a pelvic, hip, knee or ankle injury on that side rules it out.',
    },
    {
      key: 'measure',
      label: 'Measure',
      value: !run.measuredOn ? 'Not measured' : `${run.measuredOn === 'right' ? 'Uninjured' : 'Injured'} leg, ${Math.round(beyond)} cm past the heel${run.locked ? '' : ', not locked'}`,
      range: 'Uninjured leg, about 20–30 cm past the heel, locked',
      ok: run.measuredOn === 'right' && run.locked && beyond >= BEYOND_OK.min && beyond <= BEYOND_OK.max,
      why: 'The injured leg is short and moving it hurts. Too short and the foot meets the windlass; unlocked, it collapses as you wind.',
    },
    {
      key: 'straps',
      label: 'Leg straps',
      value: spots.join(', '),
      range: 'Two on the thigh, two on the calf; none on the fracture, knee or ankle',
      ok: strapsOk(run.straps, run.ringCm ?? 0),
      why: 'A strap on the fracture hurts and moves it; at the knee it presses the common peroneal nerve at the fibular head.',
    },
    {
      key: 'hitch',
      label: 'Ankle hitch',
      value: !run.hitchAt ? 'Not applied' : `On the ${run.hitchAt}, ${tensionWord(run.hitchTension)}${run.hitchOverShoe ? ', over the shoe' : ''}`,
      range: 'Round the ankle and heel, snug, shoe off',
      ok: run.hitchAt === 'ankle' && inSnug(run.hitchTension) && !run.hitchOverShoe,
      why: 'On the calf it slides up as you wind; loose it slips off; tight it strangles the foot.',
    },
    {
      key: 'manual',
      label: 'Manual traction',
      value: !run.manualHow ? 'None' : run.manualHow === 'steady' ? (run.jerked ? 'A sharp pull first, then steady' : run.releasedEarly ? 'Released before the ratchet took over' : run.slidUnsupported ? 'Started after the splint went under' : 'Steady, in line, held until the ratchet took over') : run.manualHow === 'jerk' ? 'A sharp pull' : 'Lifted, no traction',
      range: 'Steady in-line traction from before the splint goes under until the ratchet takes over',
      ok: run.manualHow === 'steady' && !run.jerked && run.manualBeforeSlide && !run.slidUnsupported && !run.releasedEarly,
      why: run.jerked
        ? 'A sharp pull grinds the bone ends and hurts: traction is steady and in line, taken up slowly.'
        : 'Without it the bone ends grind as you lift and slide. Let go before the ratchet holds and the leg springs back.',
    },
    {
      key: 'ring',
      label: 'Ring and ischial strap',
      value: ring === null ? 'Not under the leg' : `${ring < -3 ? 'Jammed into the groin' : ring > 3 ? `${Math.round(ring)} cm down the thigh` : 'Against the ischial tuberosity'}, strap ${tensionWord(run.ischialTension)}`,
      range: 'Padded ring against the ischial tuberosity; strap snug',
      ok: ring !== null && Math.abs(ring) <= 3 && inSnug(run.ischialTension),
      why: 'The ischium is the counter-traction point. Too high presses on the genitals; too low and the ring sits on the thigh and slips.',
    },
    {
      key: 'traction',
      label: 'Traction',
      value: !run.hooked ? 'Hook never on the D-ring' : `${kg.toFixed(1)} kg, left leg ${lengthWord(shortfall(run))}${run.peakKg > OVER_KG ? ` (peaked at ${run.peakKg.toFixed(1)} kg)` : ''}`,
      range: `${TRACTION_OK.min}–${TRACTION_OK.max} kg (about 10% of ${WEIGHT_KG} kg, max 7): pain eased, length equal`,
      ok: run.hooked && kg >= TRACTION_OK.min && kg <= TRACTION_OK.max && run.peakKg <= OVER_KG,
      why: 'Stop when the pain eases and the length matches the other side. Over-traction injures the skin and the nerves.',
      critical: run.hooked && kg > OVER_KG,
    },
    {
      key: 'secure',
      label: 'Secure',
      value: `${run.fastened.filter(Boolean).length}/4 straps fastened, stand ${run.stand ? 'down' : 'not lowered'}`,
      range: 'All four straps fastened, heel stand down',
      ok: fastenedAll && run.stand,
      why: 'Unfastened, the leg can roll off the splint; the stand keeps the heel off the trolley and the traction in line.',
    },
    {
      key: 'nvAfter',
      label: 'Foot after',
      value: nvDone(run.after) ? (footCompromised(run) ? 'Checked: the foot is compromised' : 'Pulse, sensation, movement') : 'Not re-checked',
      range: 'Pulse, sensation and movement again, compared with before',
      ok: nvDone(run.after) && !footCompromised(run),
      why: 'Any change after splinting means release some traction or loosen the hitch, then check again.',
      critical: footCompromised(run),
    },
  ]
}

const inSnug = (t: number) => t >= SNUG.min && t <= SNUG.max
export function tensionWord(t: number) {
  if (t <= 0.05) return 'not fastened'
  if (t < SNUG.min) return 'loose'
  if (t > 0.85) return 'far too tight'
  if (t > SNUG.max) return 'tight'
  return 'snug'
}
export function lengthWord(cm: number) {
  if (Math.abs(cm) < 0.5) return 'equal to the right'
  return cm > 0 ? `${cm.toFixed(1)} cm short` : `${(-cm).toFixed(1)} cm too long`
}

export function scoreHare(run: HareRun) {
  const rows = checkHare(run)
  const earned = rows.filter((r) => r.ok).map((r) => r.key)
  const faults = rows.filter((r) => !r.ok).map((r) => ({ text: `${r.label}: ${r.value}. ${r.why}`, critical: Boolean(r.critical) }))
  return { earned, faults, rows }
}
