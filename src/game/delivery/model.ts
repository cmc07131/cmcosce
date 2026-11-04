/**
 * Normal vaginal delivery and the active third stage, as the hands do it. Pure.
 *
 * Sources (see the station's notes): NICE NG235 Intrapartum care (2023; the CG190 recommendations it carries on),
 * NICE QS105 statement 6 (cord clamping), RCOG and standard midwifery teaching for the mechanism.
 *
 * The birth: hands on (palm flexing the head, the other hand guarding the perineum); she pushes with each contraction
 * until the head crowns, then pants while your palm keeps it slow and flexed; the head is born by extension, face
 * down. Feel for a cord round the neck and ease a loose loop over the head. Hands off while the head restitutes to face
 * her right thigh (left occipito-anterior). Hands either side of the head; with a contraction, gentle downward traction
 * for the anterior shoulder, then upward for the posterior, and she is born onto her mother's tummy. Note the time; dry
 * her; swap the wet towel for a dry one and a hat; check her breathing, tone and colour.
 *
 * The third stage: palpate for a second baby, then oxytocin 10 IU IM after the birth and before the cord is clamped;
 * clamp no earlier than a minute and before five (so traction can start); wait for the signs of separation; controlled
 * cord traction with the other hand guarding the uterus above the pubis; twist the membranes out; check the placenta,
 * the membranes and the three cord vessels; rub up the fundus; look for tears; measure the blood loss.
 */

/* ---------------------------------------------------------------- contractions */

/** A contraction cycle: a short rest, then `on` seconds of contraction and `off` of rest, again and again. */
export const CONTRACTION = { first: 3, on: 10, off: 5 }

/** How strong the contraction is `t` seconds into the step: 0 between them, up to 1 at the peak. */
export function contraction(t: number): number {
  if (t < CONTRACTION.first) return 0
  const u = (t - CONTRACTION.first) % (CONTRACTION.on + CONTRACTION.off)
  return u < CONTRACTION.on ? Math.sin((Math.PI * u) / CONTRACTION.on) : 0
}

export const contracting = (t: number) => contraction(t) > 0.15

/* ---------------------------------------------------------------- the birth */

/** Where the head is: visible at the introitus, crowning (it no longer slips back), extending, born. */
export const HEAD = { start: 0.4, crowning: 0.5, extending: 0.85, born: 1 }
/** Head progress per second of contraction. Controlled: she pants and your palm presses. */
export const RATE = { pushing: 0.06, controlled: 0.06, unpanted: 0.2, unheld: 1.9, fast: 0.08 }
/** Traction on the head: below `light` you are only holding; above `gentle` it is too hard. */
export const FORCE = { light: 0.15, gentle: 0.6 }

export type Tear = 'none' | 'first' | 'second'

export type BirthRun = {
  /** Your left palm over the occiput, your right hand with a pad guarding the perineum. */
  palm: boolean
  guard: boolean
  /** 0.4 visible … 0.5 crowning … 0.85 extending … 1 the head is born. */
  head: number
  /** Where the head was when you told her to pant; null: not yet. */
  pant: number | null
  /** Head progress made faster than control allows, and made with no palm pressing. */
  fast: number
  unheld: number
  tear: Tear
  headBorn: boolean
  /** Finger round the neck (0–1), and the loose loop eased over the head (0–1). */
  felt: number
  loop: number
  /** The head turning to face her right thigh, 0–1 (90°). */
  restitution: number
  /** Hands either side of the head, over the parietal bones. */
  sides: boolean
  anterior: number
  posterior: number
  /** Traction tried before the head had turned. */
  pulledEarly: boolean
  /** Upward traction tried before the anterior shoulder was out. */
  wrongOrder: boolean
  peak: number
  hard: boolean
  born: boolean
  onMum: boolean
  timeCalled: boolean
  dried: number
  dryTowel: boolean
  assessed: boolean
  /** Seconds since she was born. */
  since: number
}

export function freshBirth(): BirthRun {
  return {
    palm: false,
    guard: false,
    head: HEAD.start,
    pant: null,
    fast: 0,
    unheld: 0,
    tear: 'none',
    headBorn: false,
    felt: 0,
    loop: 0,
    restitution: 0,
    sides: false,
    anterior: 0,
    posterior: 0,
    pulledEarly: false,
    wrongOrder: false,
    peak: 0,
    hard: false,
    born: false,
    onMum: false,
    timeCalled: false,
    dried: 0,
    dryTowel: false,
    assessed: false,
    since: 0,
  }
}

export type CrownEvent = 'none' | 'recede' | 'advance' | 'crowning' | 'fast' | 'born'

/**
 * One tick of the head: `contr` is the contraction's strength, `holding` whether your palm is pressing. Before
 * crowning the head comes with each push and slips back a little between; at crowning it advances only with the
 * contraction, slowly if she pants and your palm holds it flexed, fast if not.
 */
export function crown(r: BirthRun, dt: number, contr: number, holding: boolean): { patch: Partial<BirthRun>; event: CrownEvent } {
  if (r.headBorn) return { patch: {}, event: 'none' }
  if (contr <= 0.15) {
    if (r.head < HEAD.crowning) return { patch: { head: Math.max(HEAD.start - 0.02, r.head - 0.015 * dt) }, event: 'recede' }
    return { patch: {}, event: 'none' }
  }
  const pressing = holding && r.palm
  const atCrown = r.head >= HEAD.crowning
  const rate = atCrown ? (r.pant !== null ? RATE.controlled : RATE.unpanted) * (pressing ? 1 : RATE.unheld) : RATE.pushing
  const step = rate * dt
  const head = Math.min(HEAD.born, r.head + step)
  const patch: Partial<BirthRun> = { head }
  if (atCrown && rate > RATE.fast) patch.fast = r.fast + step
  if (atCrown && !pressing) patch.unheld = r.unheld + step
  if (head >= HEAD.born) {
    const fast = patch.fast ?? r.fast
    patch.headBorn = true
    patch.tear = fast > 0.1 || !r.guard ? 'second' : 'first'
    return { patch, event: 'born' }
  }
  if (!atCrown && head >= HEAD.crowning) return { patch, event: 'crowning' }
  return { patch, event: atCrown && rate > RATE.fast ? 'fast' : 'advance' }
}

export type TractionEvent = 'none' | 'early' | 'no-hands' | 'between' | 'hard' | 'anterior' | 'anterior-out' | 'posterior-first' | 'posterior' | 'born' | 'lift-now'

/**
 * One tick of traction on the head: `force` from −1 (up, toward her tummy) to 1 (down, toward the floor). The
 * shoulders come only with a contraction, the anterior first with gentle downward traction, then the posterior
 * with gentle upward traction.
 */
export function traction(r: BirthRun, dt: number, force: number, contr: number): { patch: Partial<BirthRun>; event: TractionEvent } {
  const f = Math.abs(force)
  if (r.born || f < FORCE.light) return { patch: {}, event: 'none' }
  if (r.restitution < 1) return { patch: { pulledEarly: true }, event: 'early' }
  if (!r.sides) return { patch: {}, event: 'no-hands' }
  const patch: Partial<BirthRun> = { peak: Math.max(r.peak, f) }
  const hard = f > FORCE.gentle
  if (hard) patch.hard = true
  if (contr <= 0.15) return { patch, event: hard ? 'hard' : 'between' }
  const speed = hard ? 0.6 : 0.3
  if (force > 0) {
    if (r.anterior >= 1) return { patch, event: 'lift-now' }
    const anterior = Math.min(1, r.anterior + speed * dt)
    patch.anterior = anterior
    return { patch, event: hard ? 'hard' : anterior >= 1 ? 'anterior-out' : 'anterior' }
  }
  if (r.anterior < 1) return { patch: { ...patch, wrongOrder: true }, event: 'posterior-first' }
  const posterior = Math.min(1, r.posterior + speed * 1.15 * dt)
  patch.posterior = posterior
  if (posterior >= 1) {
    patch.born = true
    patch.since = 0
    return { patch, event: 'born' }
  }
  return { patch, event: hard ? 'hard' : 'posterior' }
}

export const BIRTH_MARKS = ['control', 'pant', 'cord', 'restitution', 'shoulders', 'baby'] as const

export type Row = { key: string; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export const pantInTime = (r: BirthRun) => r.pant !== null && r.pant <= HEAD.crowning + 0.05
export const crownedSlowly = (r: BirthRun) => r.headBorn && r.fast <= 0.1
export const flexed = (r: BirthRun) => r.unheld <= 0.05

export function checkBirth(r: BirthRun): Row[] {
  return [
    {
      key: 'control',
      label: 'Hands on',
      value: [r.palm ? 'palm on the occiput' : 'no palm on the head', r.guard ? 'perineum guarded' : 'perineum unguarded', r.headBorn && !flexed(r) ? 'the head let go at crowning' : ''].filter(Boolean).join(', '),
      range: 'Left palm keeping the head flexed and pressing through crowning; right hand with a pad guarding the perineum',
      ok: r.palm && r.guard && flexed(r),
      why: 'A flexed head presents its smallest diameter and stretches the perineum least.',
    },
    {
      key: 'pant',
      label: 'Crowning',
      value: !r.headBorn ? 'The head is not born' : `${crownedSlowly(r) ? 'Slowly' : 'Fast'}${r.pant === null ? ', she was never told to pant' : !pantInTime(r) ? ', told to pant late' : ', she panted'}; ${r.tear === 'second' ? 'a second-degree tear' : r.tear === 'first' ? 'a small first-degree graze' : 'intact'}`,
      range: 'As the head crowns: “pant, don’t push”, and the head born slowly between contractions',
      ok: r.headBorn && crownedSlowly(r) && pantInTime(r),
      why: 'Pushing as the head crowns drives it out fast and tears the perineum.',
    },
    {
      key: 'cord',
      label: 'Nuchal cord',
      value: r.loop >= 1 ? 'Felt for; a loose loop eased over the head' : r.felt >= 1 ? 'Felt, left round the neck' : 'Not felt for',
      range: 'Feel round the neck; a loose loop is eased over the head',
      ok: r.felt >= 1 && r.loop >= 1,
      why: 'A loop left round the neck tightens as the body is born. Clamping and cutting before the birth is a last resort for a tight cord.',
    },
    {
      key: 'restitution',
      label: 'Restitution',
      value: r.pulledEarly ? 'Pulled before the head had turned' : r.restitution >= 1 ? 'Hands off: the head turned to face her right thigh' : 'Not waited for',
      range: 'Hands off until the head turns to face a thigh',
      ok: r.restitution >= 1 && !r.pulledEarly,
      why: 'Restitution shows the shoulders have rotated into the widest diameter of the outlet.',
    },
    {
      key: 'shoulders',
      label: 'Shoulders',
      value: r.born
        ? `${r.hard ? 'Hard' : 'Gentle'} traction${r.wrongOrder ? ', upward tried first' : ''}: anterior shoulder down, posterior up; born`
        : r.anterior >= 1
          ? 'Anterior out; posterior not delivered'
          : 'Not delivered',
      range: 'Hands either side of the head; with a contraction, gentle downward traction for the anterior shoulder, then upward for the posterior',
      ok: r.born && r.sides && !r.hard && !r.wrongOrder,
      why: 'Hard or lateral traction on the head stretches the brachial plexus (Erb’s palsy).',
      critical: r.hard,
    },
    {
      key: 'baby',
      label: 'The baby',
      value: !r.born
        ? 'Not born'
        : [r.onMum ? 'on mum' : 'not on mum', r.timeCalled ? 'time noted' : 'time not noted', r.dried >= 0.7 ? 'dried' : 'wet', r.dryTowel ? 'dry towel and hat' : 'wet towel left on', r.assessed ? 'breathing, tone and colour checked' : 'not assessed'].join(', '),
      range: 'Onto mum’s tummy skin to skin; time of birth; dry her; wet towel off, dry towel and hat; breathing, tone, colour',
      ok: r.born && r.onMum && r.timeCalled && r.dried >= 0.7 && r.dryTowel && r.assessed,
      why: 'A wet newborn loses heat fast; drying is also the stimulation that starts her breathing.',
    },
  ]
}

/* ---------------------------------------------------------------- the third stage */

/** Seconds since the birth when the third stage starts (she has been dried and is skin to skin). */
export const THIRD_START = 30
/** The cord: 0 cm at her tummy, the introitus at 50 cm. */
export const CORD_CM = 50
export const CLAMP_CM = { min: 1.5, max: 5 }
/** NICE: not earlier than 1 minute; before 5 minutes, to do controlled cord traction. */
export const CLAMP_S = { min: 60, max: 300 }
/** Separation, seconds after the oxytocin. */
export const SEPARATES_AFTER = 240
/** A prolonged third stage with active management (NICE): not complete within 30 minutes of the birth. */
export const PROLONGED_S = 30 * 60
export const MEMBRANE_TURNS = 2
export const EBL = { jug: 220, pads: 90 }

export type Sign = 'gush' | 'lengthen' | 'uterus'
export type View = 'maternal' | 'fetal' | 'cord'

export type ThirdRun = {
  /** Seconds since the birth. */
  since: number
  palpated: number
  /** Seconds since the birth when the oxytocin went in. */
  oxyAt: number | null
  oxyFirst: boolean
  /** Where on the cord (cm from her tummy) each went; when the first clamp went on. */
  clampAt: number | null
  forcepsAt: number | null
  cutAt: number | null
  clampedAt: number | null
  bleed: boolean
  saw: Sign[]
  guarded: boolean
  pulledEarly: boolean
  inversion: boolean
  unguardedPull: boolean
  snapped: boolean
  /** The placenta coming down to the introitus (0–1), then the membranes twisted out (turns). */
  descent: number
  turns: number
  out: boolean
  outAt: number | null
  seen: View[]
  rubbed: number
  looked: boolean
  jug: boolean
  pads: boolean
}

export function freshThird(): ThirdRun {
  return {
    since: THIRD_START,
    palpated: 0,
    oxyAt: null,
    oxyFirst: false,
    clampAt: null,
    forcepsAt: null,
    cutAt: null,
    clampedAt: null,
    bleed: false,
    saw: [],
    guarded: false,
    pulledEarly: false,
    inversion: false,
    unguardedPull: false,
    snapped: false,
    descent: 0,
    turns: 0,
    out: false,
    outAt: null,
    seen: [],
    rubbed: 0,
    looked: false,
    jug: false,
    pads: false,
  }
}

export const separated = (r: ThirdRun) => r.oxyAt !== null && r.since >= r.oxyAt + SEPARATES_AFTER
export const cut = (r: ThirdRun) => r.cutAt !== null
export const cutBetween = (r: ThirdRun) => r.cutAt !== null && r.clampAt !== null && r.forcepsAt !== null && r.cutAt > r.clampAt && r.cutAt < r.forcepsAt
export const clampPlaced = (r: ThirdRun) => r.clampAt !== null && r.clampAt >= CLAMP_CM.min && r.clampAt <= CLAMP_CM.max
export const clampTimed = (r: ThirdRun) => r.clampedAt !== null && r.clampedAt >= CLAMP_S.min && r.clampedAt <= CLAMP_S.max && r.oxyAt !== null && r.oxyAt <= r.clampedAt
export const eblMeasured = (r: ThirdRun) => (r.jug ? EBL.jug : 0) + (r.pads ? EBL.pads : 0)

/** Where a tap on the cord lands: a clamp too close to another is moved, as a real one would not fit. */
export type CordTool = 'clamp' | 'forceps' | 'scissors'

export function onCord(r: ThirdRun, tool: CordTool, cm: number): { patch: Partial<ThirdRun>; event: 'clamp' | 'forceps' | 'cut' | 'bleed' | 'no-clamps' | 'done' } {
  if (cut(r)) return { patch: {}, event: 'done' }
  const first = r.clampedAt ?? r.since
  if (tool === 'clamp') return { patch: { clampAt: cm, clampedAt: first }, event: 'clamp' }
  if (tool === 'forceps') return { patch: { forcepsAt: cm, clampedAt: first }, event: 'forceps' }
  if (r.clampAt === null || r.forcepsAt === null) return { patch: { cutAt: cm, bleed: true }, event: 'no-clamps' }
  const between = cm > Math.min(r.clampAt, r.forcepsAt) && cm < Math.max(r.clampAt, r.forcepsAt)
  return { patch: { cutAt: cm, bleed: !between }, event: between ? 'cut' : 'bleed' }
}

/**
 * Controlled cord traction, one tick: `force` 0–1 down along the axis of the birth canal. Before separation the
 * cord only tightens (and, unguarded, the fundus dimples: inversion); too hard snaps it; steady and gentle brings
 * the placenta down to the introitus.
 */
export function cct(r: ThirdRun, dt: number, force: number): { patch: Partial<ThirdRun>; event: 'none' | 'early' | 'invert' | 'snap' | 'unguarded' | 'descend' | 'at-introitus' } {
  if (force < FORCE.light || r.snapped || r.descent >= 1 || !cut(r)) return { patch: {}, event: 'none' }
  if (!separated(r)) return r.guarded ? { patch: { pulledEarly: true }, event: 'early' } : { patch: { pulledEarly: true, inversion: true }, event: 'invert' }
  if (force > FORCE.gentle) return { patch: { snapped: true }, event: 'snap' }
  const descent = Math.min(1, r.descent + 0.25 * dt)
  const patch: Partial<ThirdRun> = { descent }
  if (!r.guarded) patch.unguardedPull = true
  return { patch, event: descent >= 1 ? 'at-introitus' : r.guarded ? 'descend' : 'unguarded' }
}

export const THIRD_MARKS = ['twin', 'clamp', 'separation', 'cct', 'placenta', 'fundus'] as const

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
export const clock = mmss

export function checkThird(r: ThirdRun): Row[] {
  const prolonged = !r.out && r.since > PROLONGED_S
  return [
    {
      key: 'twin',
      label: 'Twin, then oxytocin',
      value: `${r.palpated >= 1 ? 'Palpated: no second twin' : 'Not palpated'}; ${r.oxyAt === null ? 'no oxytocin' : `oxytocin 10 IU IM at ${mmss(r.oxyAt)}${r.oxyFirst ? ', before feeling for a twin' : ''}`}`,
      range: 'Palpate for a second baby, then oxytocin 10 IU IM after the birth, before the cord is clamped',
      ok: r.palpated >= 1 && r.oxyAt !== null && !r.oxyFirst,
      why: 'Oxytocin with an undiagnosed second twin can trap it.',
    },
    {
      key: 'clamp',
      label: 'The cord',
      value: r.clampedAt === null
        ? 'Not clamped'
        : `Clamped at ${mmss(r.clampedAt)}${r.oxyAt === null || r.oxyAt > r.clampedAt ? ', before the oxytocin' : ''}; cord clamp ${r.clampAt === null ? 'not used' : `${r.clampAt.toFixed(0)} cm from her tummy`}; ${r.cutAt === null ? 'not cut' : r.bleed ? 'cut outside the clamps: it bled' : 'cut between the clamps'}`,
      range: `After the oxytocin; no earlier than 1 minute and before 5; the cord clamp ${CLAMP_CM.min}–${CLAMP_CM.max} cm from her tummy, forceps beyond, cut between`,
      ok: clampTimed(r) && clampPlaced(r) && cutBetween(r) && !r.bleed,
      why: 'Deferred clamping gives the baby her placental blood; a cut outside the clamps bleeds from the baby or the cord.',
    },
    {
      key: 'separation',
      label: 'Separation',
      value: `${r.saw.length ? `Saw: ${r.saw.map((s) => ({ gush: 'a gush of blood', lengthen: 'the cord lengthening', uterus: 'the uterus rising, firm and globular' })[s]).join(', ')}` : 'No signs looked for'}${r.pulledEarly ? '; pulled before it had separated' : ''}${prolonged ? '; over 30 minutes' : ''}`,
      range: 'Wait for at least two signs: a gush of blood, the cord lengthening, the uterus rising, firm and globular',
      ok: r.saw.length >= 2 && !r.pulledEarly && !prolonged,
      why: 'Traction before separation can avulse the cord or invert the uterus.',
    },
    {
      key: 'cct',
      label: 'Controlled cord traction',
      value: r.inversion
        ? 'Pulled unguarded before separation: the fundus dimpled (inversion)'
        : r.snapped
          ? 'Pulled too hard: the cord snapped'
          : r.out
            ? `Delivered${r.unguardedPull ? ', partly without guarding the uterus' : ', the uterus guarded above the pubis'}, membranes twisted out`
            : r.descent >= 1
              ? 'At the introitus; membranes not twisted out'
              : 'Not delivered',
      range: 'Steady, gentle downward traction with the other hand pushing the uterus up above the pubis; twist the membranes out',
      ok: r.out && r.guarded && !r.unguardedPull && !r.inversion && !r.snapped,
      why: 'The guarding hand stops the uterus following the cord down. Twisting keeps the membranes whole.',
      critical: r.inversion,
    },
    {
      key: 'placenta',
      label: 'The placenta',
      value: r.seen.length ? `Checked: ${r.seen.map((v) => ({ maternal: 'maternal surface', fetal: 'fetal surface and membranes', cord: 'cord vessels' })[v]).join(', ')}` : 'Not checked',
      range: 'Maternal surface (cotyledons complete), fetal surface and membranes complete, three vessels in the cord',
      ok: r.seen.length === 3,
      why: 'A missing cotyledon or membranes left behind bleed and get infected; a single umbilical artery goes with anomalies.',
    },
    {
      key: 'fundus',
      label: 'Tone, tears, loss',
      value: `${r.rubbed >= 0.6 ? 'fundus rubbed up, firm' : 'tone not checked'}, ${r.looked ? 'first-degree tear found' : 'perineum not inspected'}, ${r.jug && r.pads ? `EBL measured ${eblMeasured(r)} mL` : r.jug || r.pads ? `EBL ${eblMeasured(r)} mL (only the ${r.jug ? 'jug' : 'pads'})` : 'EBL not measured'}`,
      range: 'A firm fundus; the perineum and vagina inspected; blood loss measured, jug and weighed pads (under 500 mL)',
      ok: r.rubbed >= 0.6 && r.looked && r.jug && r.pads,
      why: 'Tone, trauma, tissue, thrombin: the causes of PPH start here. Blood loss is underestimated by eye.',
    },
  ]
}
