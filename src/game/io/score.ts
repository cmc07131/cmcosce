import {
  FINDING_TEXT,
  NEEDLE_MM,
  drillOutcome,
  judgeLandmark,
  mgIn,
  rightNeedle,
  type DrillOutcome,
  type IoCase,
  type NeedleColour,
  type Side,
} from './case'

/** Everything the player did at the bench. Scored once, at the end. */
export type Run = {
  exposed: Record<Side, boolean>
  side: Side | null

  needle: NeedleColour | null
  primed: boolean
  lidoVial: 'plain2' | 'adr1' | null
  lidoMl: number

  gloves: boolean
  handsBeforeGloves: boolean
  towel: boolean
  hands: { medial: boolean; lateral: boolean }
  handBehind: boolean

  dent: { x: number; y: number } | null
  saidLandmark: boolean | null

  scrub: number
  dry: boolean
  touchedPrep: boolean

  capOffBeforePush: boolean
  contact: boolean
  contactAngle: number | null
  lineChecked: boolean
  saidLine: boolean | null
  drilledBeforeContact: boolean
  tooHard: boolean
  depth: number
  drilled: boolean

  hubHeld: boolean
  driverOff: boolean
  styletOut: boolean
  styletSafe: boolean | null

  stabilizer: boolean
  extBeforeStabilizer: boolean
  extension: boolean
  locked: boolean
  aspirated: boolean

  lidoFirstMl: number
  lidoFast: boolean
  dwell: boolean
  flush: 'none' | 'slow' | 'fast'
  flushBeforeLido: boolean
  lidoSecondMl: number

  swelling: boolean
  calf: 'soft-ok' | 'carried-on' | 'stopped' | null
  removal: 'straight' | 'rocked' | null

  wristband: boolean
  pressureBag: boolean
  saidClose: boolean | null
}

export function freshRun(): Run {
  return {
    exposed: { left: false, right: false },
    side: null,
    needle: null,
    primed: false,
    lidoVial: null,
    lidoMl: 0,
    gloves: false,
    handsBeforeGloves: false,
    towel: false,
    hands: { medial: false, lateral: false },
    handBehind: false,
    dent: null,
    saidLandmark: null,
    scrub: 0,
    dry: false,
    touchedPrep: false,
    capOffBeforePush: false,
    contact: false,
    contactAngle: null,
    lineChecked: false,
    saidLine: null,
    drilledBeforeContact: false,
    tooHard: false,
    depth: -6,
    drilled: false,
    hubHeld: false,
    driverOff: false,
    styletOut: false,
    styletSafe: null,
    stabilizer: false,
    extBeforeStabilizer: false,
    extension: false,
    locked: false,
    aspirated: false,
    lidoFirstMl: 0,
    lidoFast: false,
    dwell: false,
    flush: 'none',
    flushBeforeLido: false,
    lidoSecondMl: 0,
    swelling: false,
    calf: null,
    removal: null,
    wristband: false,
    pressureBag: false,
    saidClose: null,
  }
}

export type Fault = { text: string; critical?: boolean }

export type Scored = { marks: string[]; faults: Fault[]; outcome: DrillOutcome | null; summary: string }

/** The drill left the needle somewhere that will leak. */
export function leaks(run: Run, c: IoCase) {
  if (!run.needle || !run.drilled) return false
  const out = drillOutcome(run.depth, run.needle, c)
  return out === 'through' || out === 'in-cortex' || !rightNeedle(run.needle, c.tissueMm).ok
}

export function scoreRun(run: Run, c: IoCase): Scored {
  const marks: string[] = []
  const faults: Fault[] = []
  const fault = (text: string, critical = false) => faults.push({ text, critical })

  // Choose the bone
  const chosen = run.side ? c.legs[run.side] : null
  const both = run.exposed.left && run.exposed.right
  if (!run.side) fault('No bone was chosen.', true)
  else if (chosen !== 'clean') fault(`Drilled a leg that is out: ${FINDING_TEXT[chosen!].toLowerCase()}`, true)
  if (!both) fault('Only one leg was exposed and examined before choosing.')
  if (run.side && chosen === 'clean' && both) marks.push('MS-04')

  // Needle length
  const needle = run.needle ? rightNeedle(run.needle, c.tissueMm) : null
  if (!run.needle) fault('No needle set was attached to the driver.', true)
  else if (!needle!.ok) fault(needle!.note)
  if (run.contact && !run.lineChecked) fault('The 5 mm line was not checked with the tip on bone.')
  if (run.saidLine === false) fault('What you said about the 5 mm line did not match what you saw.')
  if (needle?.ok && run.lineChecked && run.saidLine !== false) marks.push('MS-06')

  // Position and gloves
  if (!run.gloves) fault('No gloves.')
  if (run.handsBeforeGloves) fault('Hands on the limb before gloves.')
  if (!run.towel) fault('The calf was not supported on a towel.')
  if (!run.hands.medial || !run.hands.lateral) fault('The leg was not steadied from both sides.')
  if (run.handBehind) fault('A hand went behind the tibia. A needle that goes through comes out into you.', true)
  if (run.towel && run.hands.medial && run.hands.lateral && !run.handBehind) marks.push('MS-07')

  // Landmark
  const land = run.dent ? judgeLandmark(run.dent.x, run.dent.y) : null
  if (!land) fault('No insertion point was marked.', true)
  else if (!land.ok) fault(land.note, land.feel === 'patella' || land.feel === 'joint' || land.feel === 'fibula')
  if (run.dent && run.saidLandmark === null) fault('The landmark was not said out loud.')
  if (run.saidLandmark === false) fault('The landmark you said was wrong.')
  if (land?.ok && run.saidLandmark) marks.push('MS-05')

  // Skin prep
  if (run.scrub < 1) fault('The skin was not cleaned with chlorhexidine.')
  else if (!run.dry) fault('The needle went through wet chlorhexidine. Let it dry.')
  if (run.touchedPrep) fault('The cleaned site was touched again.')

  // Insertion
  const angleOk = run.contactAngle !== null && Math.abs(run.contactAngle) <= 10
  const outcome = run.needle && run.drilled ? drillOutcome(run.depth, run.needle, c) : null
  if (!run.contact) fault('The needle never reached bone.', true)
  if (run.drilledBeforeContact) fault('The drill ran before the tip was on bone. Push through the skin unpowered.')
  if (run.contact && !angleOk) fault(`The needle met bone ${Math.abs(run.contactAngle ?? 0).toFixed(0)}° off perpendicular. Aim 90° to the bone.`)
  if (run.tooHard) fault('Too much force on the driver. Let the drill do the work.')
  if (outcome === 'in-cortex') fault('The trigger came off before the pop. The tip is still in cortex, so nothing will flow.')
  if (outcome === 'too-deep') fault('You kept drilling after the pop.')
  if (outcome === 'hub-on-skin') fault('Drilled until the hub hit the skin. Stop at the pop so the hub stands proud.')
  if (outcome === 'through') fault('Through-and-through: the tip passed the far cortex.', true)
  if (run.contact && !run.drilledBeforeContact && angleOk && outcome === 'seated' && !run.tooHard) marks.push('MS-08')

  // Driver off, stylet, dressing, line
  if (run.driverOff && !run.hubHeld) fault('The driver came off without holding the hub. The catheter can come with it.')
  if (!run.styletOut) fault('The stylet was never removed.')
  if (run.styletSafe === false) fault('The stylet went on the bed, not in the NeedleVISE.')
  if (run.extBeforeStabilizer) fault('The extension went on before the stabilizer. It will not seat until the dressing is on.')
  if (!run.stabilizer) fault('No stabilizer dressing on the hub.')
  if (run.extension && !run.primed) fault('The extension was not primed. You pushed air into the marrow.')
  if (run.hubHeld && run.styletOut && run.styletSafe && run.stabilizer && !run.extBeforeStabilizer && run.extension && run.locked) marks.push('MS-09')

  // Lidocaine, flush, calf
  const pct = run.lidoVial === 'adr1' ? 1 : 2
  const mg1 = mgIn(run.lidoFirstMl, pct)
  const mg2 = mgIn(run.lidoSecondMl, pct)
  if (run.lidoVial === 'adr1' && run.lidoFirstMl + run.lidoSecondMl > 0) fault('Lidocaine with adrenaline went into the marrow. Use plain, preservative-free 2%.', true)
  if (run.lidoFirstMl === 0) fault('No lidocaine before the flush. He withdraws to pain; the flush hurts more than the drill.')
  else if (Math.abs(mg1 - 40) > 5) fault(`First lidocaine dose was ${mg1.toFixed(0)} mg. Adult: 40 mg (2 mL of 2%).`)
  if (run.lidoFast) fault('Lidocaine pushed fast. Give it slowly, over about 2 minutes.')
  if (run.lidoFirstMl > 0 && !run.dwell) fault('No dwell. Let the lidocaine sit about a minute before the flush.')
  if (run.flush === 'none') fault('No flush. No flush, no flow.', true)
  if (run.flush === 'slow') fault('The flush was a trickle. Push 10 mL hard and fast.')
  if (run.flushBeforeLido) fault('Flushed before lidocaine in a patient who feels pain.')
  if (run.lidoSecondMl === 0) fault('No second lidocaine dose after the flush.')
  else if (Math.abs(mg2 - 20) > 5) fault(`Second lidocaine dose was ${mg2.toFixed(0)} mg. Adult: 20 mg (1 mL of 2%).`)
  if (run.swelling && run.calf !== 'stopped') fault('The calf swelled and the infusion carried on. Stop, remove, new bone.', true)
  if (!run.swelling && run.calf === 'stopped') fault('The calf was soft. The IO was pulled for no reason.')
  if (run.removal === 'rocked') fault('The IO was rocked out. Syringe on the hub, rotate clockwise, pull straight.')
  const drugsOk =
    run.lidoVial === 'plain2' &&
    Math.abs(mg1 - 40) <= 5 &&
    !run.lidoFast &&
    run.dwell &&
    run.flush === 'fast' &&
    !run.flushBeforeLido &&
    Math.abs(mg2 - 20) <= 5 &&
    (run.swelling ? run.calf === 'stopped' && run.removal === 'straight' : run.calf === 'soft-ok')
  if (drugsOk) marks.push('MS-10')

  // Close
  if (!run.wristband) fault('No wristband with the time and site.')
  if (run.saidClose === false) fault('The handover line was wrong. An IO is a bridge, up to 24 hours.')

  const size = run.needle ? `${run.needle} ${NEEDLE_MM[run.needle]} mm` : 'no needle'
  const where = run.side ? `${run.side} proximal tibia` : 'no bone'
  const status = run.swelling
    ? run.calf === 'stopped'
      ? 'Calf swelled; the IO is out. Next needle in a different bone.'
      : 'Calf swelling with fluid still running.'
    : run.flush === 'fast'
      ? 'Flushed; the calf is soft.'
      : 'Not flushed.'
  const summary = `IO: ${where}, ${size}. ${status} ${faults.length ? `${faults.length} point${faults.length === 1 ? '' : 's'} to review in the debrief.` : 'Clean procedure.'}`
  return { marks, faults, outcome, summary }
}
