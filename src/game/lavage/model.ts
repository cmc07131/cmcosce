/**
 * Gastric lavage, as the hands do it. Pure.
 *
 * Sources (see the station's notes): Lau FL, Emergency management of poisoning in Hong Kong, HKMJ 2000;6:288–92 (its
 * gastric lavage procedure box, the Hong Kong protocol); Benson BE et al., Position paper update: gastric lavage for
 * gastrointestinal decontamination, Clin Toxicol 2013;51:140–6 (AACT/EAPCCT); LITFL and WikEM on technique.
 *
 * The protocol: the left lateral position with the foot of the trolley raised about 20 cm, suction ready; measure the
 * tube from the mouth to the epigastrium and mark it with tape; lignocaine spray to the oropharynx, a mouth gag, a
 * lubricated large-bore tube (36–40 Fr) passed orally; confirm it is in the stomach (aspirate, or air in with the
 * 50 mL syringe while listening at the epigastrium); siphon off the contents and save a specimen; 200 mL aliquots in
 * by gravity from a funnel about 2 feet above her, drained back each time, until 3 L have been used and the return is
 * clear; charcoal down the tube if indicated; pinch the tube and withdraw it.
 */

/** The foot of the trolley: about 20 cm. */
export const FOOT = { target: 20, min: 15, max: 25, top: 40 }
/** Mouth to epigastrium on this patient, and how close the tape must be. */
export const MEASURE = { true: 50, tol: 4, top: 70 }
/** Along the tube from the lips: the pharynx (she gags), the gastro-oesophageal junction. */
export const DEPTH = { gag: 14, gagEnd: 22, goj: 42 }
/** One aliquot, and when it is too much; the total and the return that end it. */
export const ALIQUOT = { ml: 200, max: 300, vomit: 550 }
/** 3 L used (a little under, as the jug is read, still counts) and a clear return. */
export const END = { total: 3000, enough: 2900, clear: 0.06 }
/** Gastric contents before the lavage. */
export const CONTENTS = 250
/** mL a second through the tube, either way, and from the jug into the funnel. */
export const FLOW = 170
export const POUR = 200
export const FUNNEL_MAX = 500
/** The funnel's height: above `up` it runs in (about 2 feet above her), below `down` it drains into the bucket. */
export const HEIGHT = { up: 0.68, down: 0.32 }

export type LavageRun = {
  lateral: boolean
  foot: number
  suction: boolean
  /** The tube laid out from the mouth (cm), and where you taped it. */
  laid: number
  mark: number | null
  sprayed: boolean
  gagIn: boolean
  lubed: number
  /** How far the tube is in at the lips (cm). */
  depth: number
  /** She is gagging now; you pushed while she gagged. */
  gagging: boolean
  swallowed: boolean
  forced: boolean
  /** Placement checks: fluid aspirated, air heard at the epigastrium; and a check that found nothing. */
  aspirated: boolean
  whoosh: boolean
  missed: boolean
  /** Fluid: in the funnel, in the stomach; totals in and out; the tablet residue left (1 at the start). */
  funnel: number
  stomach: number
  poured: number
  inTotal: number
  outTotal: number
  residue: number
  /** The return as it last came out: how cloudy (0 clear … 1 thick with tablet). */
  returnCloud: number
  /** Fluid in before the tube was confirmed; before the stomach was siphoned. */
  blind: boolean
  unsiphoned: boolean
  siphoned: boolean
  sample: 'none' | 'neat' | 'diluted'
  /** The most run in at once since the last drain, and the most the stomach held. */
  aliquot: number
  peakAliquot: number
  peakStomach: number
  vomited: boolean
  charcoal: boolean
  pinched: boolean
  /** cm of tube withdrawn; dribbled into her pharynx as it came out unpinched. */
  out: number
  dribbled: boolean
  gagOut: boolean
  /** Where you hold the funnel: 0 the floor … 1 two feet above her. */
  height: number
}

export function freshLavage(): LavageRun {
  return {
    lateral: false,
    foot: 0,
    suction: false,
    laid: 0,
    mark: null,
    sprayed: false,
    gagIn: false,
    lubed: 0,
    depth: 0,
    gagging: false,
    swallowed: false,
    forced: false,
    aspirated: false,
    whoosh: false,
    missed: false,
    funnel: 0,
    stomach: CONTENTS,
    poured: 0,
    inTotal: 0,
    outTotal: 0,
    residue: 1,
    returnCloud: 0,
    blind: false,
    unsiphoned: false,
    siphoned: false,
    sample: 'none',
    aliquot: 0,
    peakAliquot: 0,
    peakStomach: CONTENTS,
    vomited: false,
    charcoal: false,
    pinched: false,
    out: 0,
    dribbled: false,
    gagOut: false,
    height: 0.5,
  }
}

export const footOk = (r: LavageRun) => r.foot >= FOOT.min && r.foot <= FOOT.max
export const markOk = (r: LavageRun) => r.mark !== null && Math.abs(r.mark - MEASURE.true) <= MEASURE.tol
/** The tube's tip is in the stomach. */
export const inStomach = (r: LavageRun) => r.depth >= DEPTH.goj + 3 && r.out === 0
export const atMark = (r: LavageRun) => r.mark !== null && Math.abs(r.depth - r.mark) <= 2
export const confirmed = (r: LavageRun) => r.aspirated || r.whoosh
export const clear = (r: LavageRun) => r.residue <= END.clear
export const enough = (r: LavageRun) => r.inTotal >= END.enough
export const done = (r: LavageRun) => enough(r) && clear(r) && r.stomach < 60

export type AdvanceEvent = 'none' | 'gag' | 'forced' | 'past-gag' | 'at-mark' | 'past-mark' | 'stomach' | 'no-gag' | 'no-spray' | 'dry'

/**
 * Advance (or pull back) the tube by `d` cm. At the pharynx she gags: wait, ask her to swallow, then go on with the
 * swallow. Pushing while she gags makes her retch.
 */
export function advance(r: LavageRun, d: number): { patch: Partial<LavageRun>; event: AdvanceEvent } {
  if (!r.gagIn && d > 0 && r.depth < 2) return { patch: {}, event: 'no-gag' }
  const depth = Math.max(0, Math.min(MEASURE.top, r.depth + d))
  const patch: Partial<LavageRun> = { depth }
  if (d > 0 && r.gagging) return { patch: { forced: true }, event: 'forced' }
  if (d > 0 && r.depth < DEPTH.gag && depth >= DEPTH.gag && !r.swallowed) return { patch: { depth: DEPTH.gag, gagging: true }, event: 'gag' }
  if (d > 0 && r.depth < DEPTH.gagEnd && depth >= DEPTH.gagEnd) {
    patch.swallowed = false
    return { patch, event: 'past-gag' }
  }
  if (d > 0 && r.mark !== null && r.depth < r.mark - 2 && depth >= r.mark - 2) return { patch, event: 'at-mark' }
  if (d > 0 && r.mark !== null && depth > r.mark + 4 && r.depth <= r.mark + 4) return { patch, event: 'past-mark' }
  if (d > 0 && r.depth < DEPTH.goj && depth >= DEPTH.goj && r.mark === null) return { patch, event: 'stomach' }
  return { patch, event: 'none' }
}

/** Ask her to swallow: the gag settles and the tube can go on with the swallow. */
export const swallow = (): Partial<LavageRun> => ({ gagging: false, swallowed: true })

export type FlowEvent = 'none' | 'in' | 'out' | 'spill' | 'overfill' | 'vomit' | 'blind' | 'unsiphoned' | 'clear' | 'end' | 'not-in'

/**
 * One tick of the funnel at `height` (0 floor … 1 two feet above her): up, the funnel runs into the stomach; down,
 * the stomach drains into the bucket and carries tablet with it. Draining takes residue out in proportion to the
 * volume; the return's cloudiness is the residue it carries.
 */
export function flow(r: LavageRun, dt: number, height: number): { patch: Partial<LavageRun>; event: FlowEvent } {
  if (r.out > 0) return { patch: {}, event: 'none' }
  const patch: Partial<LavageRun> = {}
  if (height >= HEIGHT.up && r.funnel > 0) {
    if (!inStomach(r)) return { patch: { funnel: Math.max(0, r.funnel - FLOW * dt), vomited: true }, event: 'not-in' }
    const v = Math.min(r.funnel, FLOW * dt)
    const stomach = r.stomach + v
    const aliquot = r.aliquot + v
    Object.assign(patch, { funnel: r.funnel - v, stomach, inTotal: r.inTotal + v, aliquot, peakAliquot: Math.max(r.peakAliquot, aliquot), peakStomach: Math.max(r.peakStomach, stomach) })
    if (!confirmed(r)) patch.blind = true
    if (!r.siphoned && r.stomach >= CONTENTS - 20) patch.unsiphoned = true
    if (stomach > ALIQUOT.vomit && !r.vomited) {
      patch.vomited = true
      return { patch, event: 'vomit' }
    }
    if (aliquot > ALIQUOT.max && r.aliquot <= ALIQUOT.max) return { patch, event: 'overfill' }
    if (!confirmed(r) && !r.blind) return { patch, event: 'blind' }
    return { patch, event: 'in' }
  }
  if (height <= HEIGHT.down) {
    if (r.funnel > 0) {
      // A funnel held low over the bucket empties into it: wasted, not run in.
      patch.funnel = Math.max(0, r.funnel - FLOW * 2 * dt)
      return { patch, event: 'spill' }
    }
    if (r.stomach <= 0.5 || !inStomach(r)) return { patch: { aliquot: 0 }, event: 'none' }
    const v = Math.min(r.stomach, FLOW * dt)
    const took = r.residue * (1 - Math.exp(-v / 700))
    const residue = r.residue - took
    const stomach = r.stomach - v
    Object.assign(patch, { stomach, outTotal: r.outTotal + v, residue, returnCloud: Math.min(1, residue * 1.4), aliquot: 0 })
    if (!r.siphoned && stomach < 30 && r.inTotal === 0) patch.siphoned = true
    if (!clear(r) && residue <= END.clear) return { patch, event: 'clear' }
    if (r.inTotal >= END.enough && residue <= END.clear && stomach < 60 && r.stomach >= 60) return { patch, event: 'end' }
    return { patch, event: 'out' }
  }
  return { patch: {}, event: 'none' }
}

export type WithdrawEvent = 'none' | 'dribble' | 'out'

/** Withdraw the tube by `d` cm: unpinched, what is in it runs into her pharynx. */
export function withdraw(r: LavageRun, d: number): { patch: Partial<LavageRun>; event: WithdrawEvent } {
  const out = Math.max(0, Math.min(r.depth, r.out + d))
  const patch: Partial<LavageRun> = { out }
  if (out >= r.depth) return { patch, event: 'out' }
  if (!r.pinched && out > 4 && !r.dribbled) {
    patch.dribbled = true
    return { patch, event: 'dribble' }
  }
  return { patch, event: 'none' }
}

export const LAVAGE_MARKS = ['position', 'measure', 'pass', 'confirm', 'siphon', 'lavage', 'finish'] as const

export type Row = { key: string; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

const L = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml)} mL`)

export function checkLavage(r: LavageRun): Row[] {
  return [
    {
      key: 'position',
      label: 'Position',
      value: `${r.lateral ? 'left lateral' : 'on her back'}, foot raised ${Math.round(r.foot)} cm, suction ${r.suction ? 'on and at hand' : 'not ready'}`,
      range: `Left lateral, the foot of the trolley raised about ${FOOT.target} cm, suction on`,
      ok: r.lateral && footOk(r) && r.suction,
      why: 'Left side and head down keep the stomach contents in the fundus and away from the pylorus and the airway.',
    },
    {
      key: 'measure',
      label: 'Measured',
      value: r.mark === null ? 'Not measured' : `Taped at ${Math.round(r.mark)} cm (mouth to epigastrium ${MEASURE.true} cm)`,
      range: `Mouth to epigastrium, tape at the mark (±${MEASURE.tol} cm)`,
      ok: markOk(r),
      why: 'Too short and the fluid goes into the oesophagus and up into the airway.',
    },
    {
      key: 'pass',
      label: 'Passed',
      value: [r.sprayed ? 'throat sprayed' : 'no spray', r.gagIn ? 'mouth gag' : 'no gag', r.lubed >= 1 ? 'lubricated' : 'dry tube', r.forced ? 'pushed against a gag' : 'with her swallows', `in to ${Math.round(r.depth)} cm`].join(', '),
      range: 'Lignocaine spray, mouth gag, lubricated; gently, with her swallows, to the tape',
      ok: r.sprayed && r.gagIn && r.lubed >= 1 && !r.forced && (atMark(r) || r.out > 0),
      why: 'Pushing against a gag makes her retch and vomit with an open glottis.',
    },
    {
      key: 'confirm',
      label: 'Confirmed',
      value: r.blind ? 'Fluid run in before the tube was confirmed' : [r.aspirated ? 'gastric fluid aspirated' : '', r.whoosh ? 'air heard at the epigastrium' : ''].filter(Boolean).join(', ') || 'Not confirmed',
      range: 'Aspirate gastric fluid, or air in with the 50 mL syringe while listening at the epigastrium, before any fluid',
      ok: confirmed(r) && !r.blind,
      why: 'Fluid down a tube in the trachea drowns her.',
      critical: r.blind && !inStomach(r),
    },
    {
      key: 'siphon',
      label: 'Siphon and sample',
      value: `${r.unsiphoned ? 'Lavage started on a full stomach' : r.siphoned ? 'Contents siphoned off' : 'Not siphoned'}; ${r.sample === 'neat' ? 'specimen saved' : r.sample === 'diluted' ? 'specimen taken after the lavage had diluted it' : 'no specimen'}`,
      range: 'Siphon the contents off first, and save a specimen of them for toxicology',
      ok: r.siphoned && !r.unsiphoned && r.sample === 'neat',
      why: 'A full stomach plus an aliquot overfills it; the first return is the only neat sample.',
    },
    {
      key: 'lavage',
      label: 'Lavage',
      value: `${L(r.inTotal)} in, ${L(r.outTotal)} out; largest aliquot ${Math.round(r.peakAliquot)} mL; return ${clear(r) ? 'clear' : 'still cloudy'}${r.vomited ? '; she vomited round the tube' : ''}`,
      range: `Aliquots of about ${ALIQUOT.ml} mL by gravity, each drained back, until ${END.total / 1000} L used and the return is clear`,
      ok: enough(r) && clear(r) && r.peakAliquot <= ALIQUOT.max && !r.vomited,
      why: 'Big aliquots push tablets through the pylorus and make her vomit; fluid left behind is water intoxication.',
      critical: r.vomited,
    },
    {
      key: 'finish',
      label: 'Charcoal, tube out',
      value: [r.charcoal ? 'charcoal 50 g down the tube' : 'no charcoal', r.out >= r.depth && r.depth > 0 ? (r.dribbled ? 'withdrawn unpinched: it dribbled into her pharynx' : 'pinched and withdrawn') : 'tube still in', r.gagOut ? 'gag out, mouth suctioned' : 'gag still in'].join(', '),
      range: 'Activated charcoal 50 g down the tube; pinch it and withdraw; gag out, suction the mouth',
      ok: r.charcoal && r.out >= r.depth && r.depth > 0 && !r.dribbled && r.gagOut,
      why: 'An open tube drains its contents into the pharynx as it comes out.',
    },
  ]
}
