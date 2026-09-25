import type { Fault, Scored } from '../io/score'
import { BOUGIE, STAB, TUBE, judgeIncision, type CicoCase, type StabSite, type Stroke } from './case'

export type CicoRun = {
  extended: boolean
  side: 'left' | 'right' | null

  handshake: boolean
  palpatedMembrane: boolean
  saidLandmarks: boolean | null
  lostLarynx: boolean

  incision: Stroke | null
  dissected: boolean

  stabSite: StabSite | null
  bladeTransverse: boolean | null
  edgeTowardYou: boolean | null
  stabDepth: number
  stabbed: boolean

  rotated: boolean
  edgeCaudal: boolean | null
  opened: 'lateral' | 'removed' | null

  bougieDepth: number
  holdUpMet: boolean
  forcedHoldUp: boolean
  bougieDone: boolean
  secondPass: boolean

  tubeDepth: number
  tubeHeldForBougie: boolean | null
  bougieOut: boolean
  cuff: number
  circuit: boolean

  askedEtco2: boolean
  etco2Read: 'right' | 'wrong' | null
  pulledFalseTube: boolean

  holdUntilTied: boolean | null
  saidClose: boolean | null

  minSpo2: number
  arrested: boolean
}

export function freshCicoRun(): CicoRun {
  return {
    extended: false,
    side: null,
    handshake: false,
    palpatedMembrane: false,
    saidLandmarks: null,
    lostLarynx: false,
    incision: null,
    dissected: false,
    stabSite: null,
    bladeTransverse: null,
    edgeTowardYou: null,
    stabDepth: 0,
    stabbed: false,
    rotated: false,
    edgeCaudal: null,
    opened: null,
    bougieDepth: 0,
    holdUpMet: false,
    forcedHoldUp: false,
    bougieDone: false,
    secondPass: false,
    tubeDepth: 0,
    tubeHeldForBougie: null,
    bougieOut: false,
    cuff: 0,
    circuit: false,
    askedEtco2: false,
    etco2Read: null,
    pulledFalseTube: false,
    holdUntilTied: null,
    saidClose: null,
    minSpo2: 68,
    arrested: false,
  }
}

/** A bougie goes into a false passage from a poor hole, or sometimes from a good one. */
export function falseTract(run: CicoRun, c: CicoCase) {
  if (run.secondPass) return false
  const poorHole = run.stabSite !== 'membrane' || run.stabDepth < STAB.through || run.opened !== 'lateral' || !run.rotated
  const offMidline = run.incision ? !judgeIncision(run.incision).midline : false
  return c.falseTractBase || poorHole || offMidline
}

/** The tube ended up in the trachea: a good hole, or the bougie was redone after a false passage. */
export function tubeInTrachea(run: CicoRun, c: CicoCase) {
  if (run.secondPass) return true
  return !falseTract(run, c)
}

export function scoreCico(run: CicoRun, c: CicoCase): Scored {
  const marks: string[] = []
  const faults: Fault[] = []
  const fault = (text: string, critical = false) => faults.push({ text, critical })

  if (run.arrested) fault(`SpO2 fell to ${Math.round(run.minSpo2)}% and he arrested before the airway was in. Front-of-neck access has to be fast.`, true)

  // Position
  if (!run.extended) fault('The neck was not extended.')
  if (run.side === 'right') fault('A right-handed operator stands on the patient’s left.')
  if (!run.side) fault('You did not choose where to stand.')
  if (run.extended && run.side === 'left') marks.push('MS-10')

  // Larynx
  if (!run.handshake) fault('No laryngeal handshake. Stabilise the larynx before you cut.')
  else marks.push('MS-11')
  if (run.saidLandmarks === false) fault('The landmarks you said were wrong.')
  if (run.saidLandmarks === null) fault('The landmarks were not said out loud.')
  if (run.saidLandmarks) marks.push('MS-12')

  // Incision
  const inc = run.incision ? judgeIncision(run.incision) : null
  if (!inc) fault('No skin incision.', true)
  else for (const n of inc.notes) fault(n)
  if (inc && !run.dissected) fault('No finger dissection down to the membrane before the stab.')
  if (inc?.ok && run.dissected) marks.push('MS-13')

  if (run.lostLarynx) fault('Your non-dominant hand left the larynx. It slides, and the midline is gone.', true)
  else if (run.handshake) marks.push('MS-14')

  // Stab
  if (!run.stabbed) fault('The membrane was never opened.', true)
  if (run.stabSite && run.stabSite !== 'membrane') fault(`The blade went into the ${run.stabSite === 'off' ? 'soft tissue off the midline' : run.stabSite}, not the cricothyroid membrane.`)
  if (run.bladeTransverse === false) fault('The stab through the membrane is transverse, across the neck.')
  if (run.edgeTowardYou === false) fault('The cutting edge faces toward you for the stab.')
  if (run.stabbed && run.stabDepth < STAB.through) fault('The blade did not go through the membrane.')
  if (run.stabDepth >= STAB.posteriorWall) fault('The blade reached the back wall of the trachea. The oesophagus is behind it.', true)
  if (run.stabSite === 'membrane' && run.bladeTransverse && run.edgeTowardYou && run.stabDepth >= STAB.through && run.stabDepth < STAB.posteriorWall) marks.push('MS-15')

  // Rotate and open
  if (run.stabbed && !run.rotated) fault('The blade was not rotated 90 degrees.')
  if (run.edgeCaudal === false) fault('After the turn the sharp edge points to the feet, away from the cords.')
  if (run.rotated && run.edgeCaudal) marks.push('MS-16')
  if (run.opened === 'removed') fault('The blade came out and the hole closed. Keep it in and pull it toward you.')
  if (run.opened === 'lateral') marks.push('MS-17')

  // Bougie
  if (run.forcedHoldUp) fault('The bougie was forced past an early hold-up. That is a false passage.', true)
  if (!run.bougieDone) fault('No bougie in the trachea.', true)
  else if (run.bougieDepth > BOUGIE.carina) fault('The bougie went too deep. Stop at 10–15 cm.')
  else if (run.bougieDepth < BOUGIE.min - 1) fault('The bougie was not in far enough for the tube to follow.')
  const bougieOk = run.bougieDone && !run.forcedHoldUp && run.bougieDepth >= BOUGIE.min - 1 && run.bougieDepth <= BOUGIE.carina
  if (bougieOk) marks.push('MS-18')

  // Tube
  if (run.tubeDepth < TUBE.cuffThrough) fault('The cuff never passed the membrane.')
  if (run.tubeDepth > TUBE.tooDeep) fault('The tube went too far. A front-of-neck tube sits short, cuff just through the membrane.')
  if (run.tubeHeldForBougie === false) fault('The bougie came out while nobody held the tube.')
  if (run.cuff < 1) fault('The cuff was not inflated.')
  if (!run.circuit) fault('The breathing circuit was not connected.')
  if (run.tubeDepth >= TUBE.cuffThrough && run.tubeDepth <= TUBE.tooDeep && run.tubeHeldForBougie && run.bougieOut && run.cuff >= 1 && run.circuit) marks.push('MS-19')

  // Confirm
  if (!run.askedEtco2) fault('Nobody asked for capnography. A chest that moves is not proof.', true)
  if (run.etco2Read === 'wrong') fault('The ETCO2 trace was read wrongly.', true)
  if (run.askedEtco2 && run.etco2Read === 'right') marks.push('MS-20')
  if (run.pulledFalseTube) marks.push('MS-21')

  if (run.holdUntilTied === false) fault('You let go of a short front-of-neck tube before it was tied.', true)
  if (run.holdUntilTied) marks.push('MS-22')
  if (run.saidClose === false) fault('The summary to the team was wrong.')

  const trachea = tubeInTrachea(run, c)
  const summary = run.arrested
    ? 'Front-of-neck access: he arrested from hypoxia before the airway was in.'
    : trachea && run.circuit
      ? `Front-of-neck tube in the trachea, square ETCO2, SpO2 recovering from ${Math.round(run.minSpo2)}%. ${faults.length ? `${faults.length} point${faults.length === 1 ? '' : 's'} to review.` : 'Clean procedure.'}`
      : `The front-of-neck tube is not confirmed in the trachea. ${faults.length} point${faults.length === 1 ? '' : 's'} to review.`
  return { marks, faults, outcome: null, summary }
}
