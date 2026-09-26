import { rng } from '../io/case'
import type { Fault, Scored } from '../io/score'

/**
 * Umbilical cord prolapse, RCOG Green-top 50: do not replace the cord, minimal handling,
 * elevate the presenting part and keep the hand in, knee–chest in the bay, left lateral head-down to move,
 * bladder filling only if birth will be delayed, tocolysis only if the heart stays abnormal and birth is delayed.
 */

export type CordCase = {
  /** Loop of cord outside the introitus, or only felt on examination. */
  visible: boolean
  contractions: boolean
  /** Obstetric theatre busy: birth delayed about 20 minutes. */
  delayed: boolean
  /** Fetal heart while the cord is compressed. */
  compressedFhr: number
}

export function cordCaseFor(seed: number): CordCase {
  const r = rng(seed ^ 0xc0de)
  return {
    visible: r() < 0.6,
    contractions: r() < 0.4,
    delayed: r() < 0.35,
    compressedFhr: 70 + Math.floor(r() * 3) * 10,
  }
}

export type Pose = 'supine' | 'knee-chest' | 'lateral' | 'sitting'

export type CordRun = {
  gloves: boolean
  apron: boolean
  exposedBeforePpe: boolean
  exposed: boolean
  examined: boolean
  saidRecognised: boolean | null

  lift: number
  elevated: boolean
  elevatedAtS: number | null
  handOut: boolean

  replacedCord: boolean
  handledCord: number
  gauze: boolean
  gauzeTight: boolean

  bayPose: Pose | null

  doppler: boolean
  saidFhr: boolean | null

  bladderMl: number
  bladderClamped: boolean
  terbutaline: boolean

  transferPose: Pose | 'walk' | null
  saidEmptyBladder: boolean | null

  lowFhrS: number
}

export function freshCordRun(): CordRun {
  return {
    gloves: false,
    apron: false,
    exposedBeforePpe: false,
    exposed: false,
    examined: false,
    saidRecognised: null,
    lift: 0,
    elevated: false,
    elevatedAtS: null,
    handOut: false,
    replacedCord: false,
    handledCord: 0,
    gauze: false,
    gauzeTight: false,
    bayPose: null,
    doppler: false,
    saidFhr: null,
    bladderMl: 0,
    bladderClamped: false,
    terbutaline: false,
    transferPose: null,
    saidEmptyBladder: null,
    lowFhrS: 0,
  }
}

/* ---------------------------------------------------------------- the fetal heart */

/** Is a contraction squeezing now? 20 s in every 60 s, unless tocolysis has worked. */
export function contracting(c: CordCase, run: CordRun, tS: number) {
  if (!c.contractions || run.terbutaline) return false
  return tS % 60 >= 38
}

/**
 * Where the fetal heart is heading. Relief comes from the hand, a full bladder, or the position.
 * Handling the cord causes spasm; contractions squeeze a cord that is not decompressed.
 */
export function fhrTarget(c: CordCase, run: CordRun, tS: number, spasmUntilS: number) {
  const handRelief = run.elevated && !run.handOut
  const bladderRelief = run.bladderMl >= 500 && run.bladderClamped
  let target = c.compressedFhr
  if (handRelief || bladderRelief) target = 140
  else if (run.bayPose === 'knee-chest' || run.bayPose === 'lateral') target = c.compressedFhr + 25
  if (run.bayPose === 'supine' && !handRelief) target -= 10
  if (tS < spasmUntilS) target = Math.min(target, 65)
  if (contracting(c, run, tS)) target -= handRelief || bladderRelief ? 12 : 30
  return target
}

export function fhrAbnormal(fhr: number) {
  return fhr < 110
}

/* ---------------------------------------------------------------- scoring */

export function scoreCord(run: CordRun, c: CordCase): Scored {
  const marks: string[] = []
  const faults: Fault[] = []
  const fault = (text: string, critical = false) => faults.push({ text, critical })

  // PPE, look, recognise
  if (!run.gloves || !run.apron) fault('Gloves and apron go on before you expose her.')
  if (run.exposedBeforePpe) fault('She was exposed before your gloves and apron were on.')
  if (!run.exposed) fault('She was never exposed, so the cord was never seen.', true)
  if (!c.visible && !run.examined) fault('The cord is not visible. A gentle vaginal examination finds it below the presenting part.')
  if (run.gloves && run.apron && !run.exposedBeforePpe) marks.push('MS-03')
  if (run.saidRecognised === false) fault('What you said did not name it: this is a cord prolapse.')
  if (run.saidRecognised) marks.push('MS-04')

  // The cord itself
  if (run.replacedCord) fault('The cord was pushed back. Do not replace it: that causes spasm and does not help.', true)
  else marks.push('MS-11')
  if (run.handledCord > 0) fault(`The cord was handled ${run.handledCord === 1 ? 'once' : `${run.handledCord} times`}. Every squeeze makes it spasm and the heart drops.`)
  if (c.visible && !run.gauze) fault('The loop outside was left bare. Loose warm saline gauze keeps it warm and moist.')
  if (run.gauzeTight) fault('The gauze was wrapped tight. It goes on loosely.')
  const careOk = !run.replacedCord && run.handledCord === 0 && !run.gauzeTight && (!c.visible || run.gauze)
  if (careOk) marks.push('MS-12')

  // Elevation
  if (!run.elevated) fault('The presenting part was never lifted off the cord.', true)
  else {
    marks.push('MS-13')
    if ((run.elevatedAtS ?? 0) > 90) fault(`Elevation came ${Math.round(run.elevatedAtS ?? 0)} seconds in. Lift first; everything else can wait.`)
  }
  if (run.handOut) fault('Your hand came out before O&G took over. The head comes straight back down on the cord.', true)
  else if (run.elevated) marks.push('MS-14')

  // Position
  if (run.bayPose === 'knee-chest') marks.push('MS-15')
  else if (run.bayPose === 'lateral') fault('In the bay, knee–chest takes the most weight off the cord. Left lateral head-down is for moving her.')
  else fault(run.bayPose === 'supine' ? 'Flat on her back presses the head onto the cord.' : 'She was never positioned to take the weight off the cord.')
  if (run.transferPose === 'lateral') marks.push('MS-16')
  else if (run.transferPose === 'knee-chest') fault('Knee–chest on a moving trolley is unsafe. Transfer left lateral, head down, pillow under the left hip.')
  else if (run.transferPose === 'walk') fault('She walked. Never: she goes on a trolley, left lateral, head down, your hand in.', true)
  else fault('No position for the transfer.')

  // Fetal heart
  if (!run.doppler) fault('The fetal heart was never checked.')
  if (run.saidFhr === false) fault('The fetal heart was reported wrongly.')
  if (run.doppler && run.saidFhr) marks.push('MS-17')

  // Delay: bladder and tocolysis
  const bladderOk = run.bladderMl >= 500 && run.bladderMl <= 750 && run.bladderClamped
  if (c.delayed && !bladderOk) {
    if (run.bladderMl === 0) fault('Theatre was 20 minutes away and the bladder was not filled. Fill 500–750 mL through a Foley and clamp it.')
    else if (!run.bladderClamped) fault('The Foley was not clamped. The bladder empties and the relief goes.')
    else fault(`${run.bladderMl} mL. Fill 500–750 mL.`)
  }
  if (!c.delayed && run.bladderMl > 0) fault('Theatre was ready. Bladder filling only delays a birth that can happen now.')
  if (run.bladderMl > 0 && run.saidEmptyBladder !== true) fault('A filled bladder must be emptied before the caesarean. Say it at handover.')
  // Contractions keep squeezing the cord even with the hand in, so the heart stays abnormal.
  const tocolysisIndicated = c.delayed && c.contractions
  if (run.terbutaline && !tocolysisIndicated) fault('Terbutaline is for a delayed birth when the heart stays abnormal after elevation. Here it only adds a drug.')
  if (tocolysisIndicated && !run.terbutaline) fault('Contractions kept dropping the heart and birth was delayed: terbutaline 0.25 mg SC.')

  const minutes = Math.round(run.lowFhrS / 6) / 10
  const summary = `Cord prolapse: ${run.elevated && !run.handOut ? 'presenting part held off the cord' : 'cord not decompressed'}, ${
    run.transferPose === 'lateral' ? 'left lateral head-down for the move' : 'transfer position not right'
  }. Fetal heart under 110 for ${minutes} min. ${faults.length ? `${faults.length} point${faults.length === 1 ? '' : 's'} to review.` : 'Clean management.'}`
  return { marks, faults, outcome: null, summary }
}
