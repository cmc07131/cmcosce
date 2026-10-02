/**
 * Colles fracture: haematoma block, closed reduction and a moulded below-elbow backslab (BOAST 2017; AAOS 2020).
 * Pure, so the test can drive it without a screen.
 *
 * The fracture starts with 28° of dorsal tilt, 7 mm of radial shortening and the radial inclination reduced to
 * 10° (normal about 22°). Acceptable after reduction: dorsal tilt 10° or less, shortening 3 mm or less.
 */

export const WEIGHT_KG = 55
/** Plain lidocaine, 3 mg/kg. */
export const MAX_LIDO_MG = 3 * WEIGHT_KG
export const START = { tilt: 28, short: 7, incl: 10 }
export const OK_TILT = 10
export const OK_SHORT = 3
export const BLOCK_MIN = 5

export type HandCheck = 'pulse' | 'median' | 'abduct' | 'epl' | 'crt' | 'skin' | 'allergy'
export type Site = 'fracture' | 'carpus' | 'shaft'
export type Slab = 'dorsal-be' | 'volar-be' | 'above-elbow' | 'full-cast'

export type CollesRun = {
  before: HandCheck[]
  after: HandCheck[]

  ampoule: 1 | 2 | null
  drawnMl: number

  cleaned: number

  site: Site | null
  aspirated: boolean
  aspiratedBlood: boolean
  injectedMl: number
  injectedBeforeAspirate: boolean
  boneInjection: boolean

  minutes: number
  blockAt: number | null
  testedBlock: boolean

  counter: boolean
  traction: number
  peakDorsal: number
  disimpacted: boolean
  tilt: number
  short: number
  incl: number
  reducedEarly: boolean
  painful: number

  slab: Slab | null
  slabWhileHeld: boolean
  moulded: number
  lostReduction: boolean
  held: boolean
  xray: boolean
}

export function freshColles(): CollesRun {
  return {
    before: [],
    after: [],
    ampoule: null,
    drawnMl: 0,
    cleaned: 0,
    site: null,
    aspirated: false,
    aspiratedBlood: false,
    injectedMl: 0,
    injectedBeforeAspirate: false,
    boneInjection: false,
    minutes: 0,
    blockAt: null,
    testedBlock: false,
    counter: false,
    traction: 0,
    peakDorsal: START.tilt,
    disimpacted: false,
    tilt: START.tilt,
    short: START.short,
    incl: START.incl,
    reducedEarly: false,
    painful: 0,
    slab: null,
    slabWhileHeld: false,
    moulded: 0,
    lostReduction: false,
    held: false,
    xray: false,
  }
}

export const lidoMgPerMl = (run: CollesRun) => (run.ampoule === 2 ? 20 : 10)
export const injectedMg = (run: CollesRun) => run.injectedMl * lidoMgPerMl(run)

/** Where a needle entering the dorsum at `x` (lateral view, 0 elbow → 300 fingertips) ends up. */
export function siteAt(x: number): Site {
  if (x >= 188 && x <= 214) return 'fracture'
  if (x > 214) return 'carpus'
  return 'shaft'
}

/** Is the block working? Needs the haematoma, enough drug, and time. */
export function blockWorks(run: CollesRun) {
  return run.site === 'fracture' && run.aspiratedBlood && run.injectedMl >= 5 && run.blockAt !== null && run.minutes - run.blockAt >= BLOCK_MIN
}

/** Pain at the fracture as you manipulate, out of ten. */
export function manipPain(run: CollesRun) {
  if (blockWorks(run)) return 2
  if (run.site === 'fracture' && run.injectedMl >= 5 && run.blockAt !== null) return 6
  return 9
}

/* ---------------------------------------------------------------- reduction */

/**
 * Traction (0–1) along the forearm. Without an assistant holding counter-traction at the elbow, the whole arm
 * slides toward you and you cannot get much.
 */
export function setTraction(run: CollesRun, t: number): Partial<CollesRun> {
  const traction = Math.max(0, Math.min(run.counter ? 1 : 0.3, t))
  const short = run.disimpacted ? Math.max(0, START.short - 7 * traction) : Math.max(START.short - 2, START.short - 2 * traction)
  return { traction, short: Math.round(short * 10) / 10, held: traction >= 0.6 }
}

/**
 * Tilt the distal fragment: positive is dorsal. Under traction, briefly exaggerating the deformity disimpacts it;
 * only then will it go volar. An impacted fragment barely moves.
 */
export function setTilt(run: CollesRun, tilt: number): Partial<CollesRun> {
  const want = Math.max(-15, Math.min(45, tilt))
  if (!run.disimpacted) {
    // Under traction, exaggerating the dorsal tilt unlocks it.
    if (run.traction >= 0.6 && want >= START.tilt + 8) {
      return { tilt: want, peakDorsal: Math.max(run.peakDorsal, want), disimpacted: true, ...setTraction({ ...run, disimpacted: true }, run.traction) }
    }
    return { tilt: Math.max(START.tilt - 6, Math.min(45, want)), peakDorsal: Math.max(run.peakDorsal, want) }
  }
  return { tilt: want, peakDorsal: Math.max(run.peakDorsal, want) }
}

/** Ulnar deviation (0–1) restores the radial inclination once it is free. */
export function setUlnar(run: CollesRun, u: number): Partial<CollesRun> {
  const v = Math.max(0, Math.min(1, u))
  return { incl: Math.round(run.disimpacted ? START.incl + 13 * v : START.incl + 2 * v) }
}

/** Let go of traction before the slab is moulded: the fragment slips back part of the way. */
export function letGo(run: CollesRun): Partial<CollesRun> {
  if (run.moulded >= 1 || !run.disimpacted) return { traction: 0, held: false }
  return { traction: 0, held: false, lostReduction: true, tilt: Math.min(START.tilt, run.tilt + 12), short: Math.min(START.short, run.short + 3) }
}

/** Mould: three-point pressure while the plaster sets, building over about three seconds. */
export function mould(run: CollesRun, dt: number): Partial<CollesRun> {
  if (!run.slab) return {}
  return { moulded: Math.min(1, run.moulded + dt / 3) }
}

/* ---------------------------------------------------------------- check and score */

export const COLLES_MARKS = ['nv', 'epl', 'circ', 'asepsis', 'site', 'aspirate', 'dose', 'wait', 'counter', 'disimpact', 'reduce', 'slab', 'mould', 'after'] as const
export type CollesMark = (typeof COLLES_MARKS)[number]

export type CollesRow = { key: CollesMark; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkColles(run: CollesRun): CollesRow[] {
  const mg = injectedMg(run)
  const waited = run.blockAt === null ? 0 : run.minutes - run.blockAt
  const b = run.before
  return [
    { key: 'nv', label: 'Median nerve', value: b.includes('median') && b.includes('abduct') ? 'Sensation and thumb abduction' : 'Not fully checked', range: 'Index pulp sensation and thumb abduction, before you start', ok: b.includes('median') && b.includes('abduct'), why: 'Acute carpal tunnel syndrome complicates distal radius fractures: you need a baseline.' },
    { key: 'epl', label: 'EPL', value: b.includes('epl') ? 'Thumb lifts off the table' : 'Not tested', range: 'Thumb extension (lift it off the table)', ok: b.includes('epl'), why: 'Extensor pollicis longus can rupture after a distal radius fracture.' },
    { key: 'circ', label: 'Circulation and skin', value: b.includes('pulse') && b.includes('skin') ? 'Radial pulse, skin intact' : 'Not fully checked', range: 'Radial pulse, refill, and the skin all round (open fracture?)', ok: b.includes('pulse') && b.includes('skin'), why: 'An open fracture needs antibiotics and theatre, not a block in the plaster room.' },
    { key: 'asepsis', label: 'Asepsis', value: run.cleaned >= 0.7 ? 'Dorsum cleaned' : `${Math.round(run.cleaned * 100)}% cleaned`, range: 'Chlorhexidine over the whole dorsum of the wrist', ok: run.cleaned >= 0.7, why: 'You are injecting into a fracture haematoma: an infected one is a disaster.' },
    { key: 'site', label: 'Needle site', value: run.site === 'fracture' ? 'Dorsal, into the radial fracture' : run.site === 'carpus' ? 'Over the carpus' : run.site === 'shaft' ? 'Over the intact shaft' : 'No needle', range: 'Dorsally, into the fracture line of the radius', ok: run.site === 'fracture', why: 'Feel the step in the dorsal cortex: the haematoma is in the gap. The carpus is distal to it.' },
    { key: 'aspirate', label: 'Aspirate first', value: run.aspiratedBlood ? 'Dark blood back' : run.aspirated ? 'Nothing back' : 'Did not aspirate', range: 'Dark haematoma aspirated before injecting', ok: run.aspiratedBlood && !run.injectedBeforeAspirate, why: 'Haematoma confirms the tip is in the fracture; injecting blind risks a vein or the joint.' },
    { key: 'dose', label: 'Dose', value: `${run.injectedMl.toFixed(0)} mL of ${run.ampoule ?? '?'}% = ${mg.toFixed(0)} mg`, range: `1% lidocaine up to 10 mL (max ${MAX_LIDO_MG} mg plain for ${WEIGHT_KG} kg)`, ok: mg > 0 && mg <= MAX_LIDO_MG && run.injectedMl >= 5, why: 'Plain lidocaine maximum is 3 mg/kg. 2% doubles the dose for the same volume.', critical: mg > MAX_LIDO_MG },
    { key: 'wait', label: 'Wait', value: run.blockAt === null ? 'No block' : `${waited} min before manipulating${run.reducedEarly ? ' (started early)' : ''}`, range: `${BLOCK_MIN}–10 minutes, then test`, ok: run.blockAt !== null && !run.reducedEarly, why: 'Manipulating before the block works hurts, and she will not relax.' },
    { key: 'counter', label: 'Counter-traction', value: run.counter ? 'Assistant at the elbow' : 'None', range: 'Assistant holds the upper arm, elbow at 90°', ok: run.counter, why: 'Without counter-traction the whole arm slides toward you.' },
    { key: 'disimpact', label: 'Disimpaction', value: run.disimpacted ? `Exaggerated to ${Math.round(run.peakDorsal)}° under traction` : 'Never disimpacted', range: 'Traction, then briefly exaggerate the deformity', ok: run.disimpacted, why: 'An impacted fragment will not move volarly until it is freed.' },
    { key: 'reduce', label: 'Reduction', value: `Tilt ${Math.abs(Math.round(run.tilt))}° ${run.tilt >= 0 ? 'dorsal' : 'volar'}, shortening ${run.short.toFixed(0)} mm, inclination ${run.incl}°`, range: `Dorsal tilt ≤${OK_TILT}°, shortening ≤${OK_SHORT} mm`, ok: run.tilt <= OK_TILT && run.short <= OK_SHORT, why: 'Volar pressure on the distal fragment restores the tilt; traction restores the length; ulnar deviation the inclination.' },
    { key: 'slab', label: 'Backslab', value: run.slab ? `${slabName(run.slab)}${run.slabWhileHeld ? ', reduction held' : ', reduction not held'}` : 'None', range: 'Padded dorsal below-elbow backslab, applied while the reduction is held', ok: run.slab === 'dorsal-be' && run.slabWhileHeld, why: 'A full cast on day one can cause compartment syndrome as it swells. Let go before the slab is on and it slips.', critical: run.slab === 'full-cast' },
    { key: 'mould', label: 'Mould', value: run.moulded >= 1 ? 'Three-point mould held until set' : run.moulded > 0 ? 'Let go before it set' : 'Not moulded', range: 'Three-point mould until the plaster sets', ok: run.moulded >= 1 && !run.lostReduction, why: 'The mould holds the fragment; without it the reduction drifts in the slab.' },
    { key: 'after', label: 'After', value: run.after.includes('median') && run.after.includes('crt') && run.xray ? 'Median nerve, refill, check X-ray' : 'Incomplete', range: 'Median nerve and circulation again, then a check X-ray', ok: run.after.includes('median') && run.after.includes('crt') && run.xray, why: 'Swelling and the plaster can compress the median nerve; the X-ray shows whether it held.' },
  ]
}

export const slabName = (s: Slab) => ({ 'dorsal-be': 'Dorsal below-elbow backslab', 'volar-be': 'Volar below-elbow slab', 'above-elbow': 'Above-elbow slab', 'full-cast': 'Full circumferential cast' })[s]

export function scoreColles(run: CollesRun) {
  const rows = checkColles(run)
  return { rows, earned: rows.filter((r) => r.ok).map((r) => r.key) }
}
