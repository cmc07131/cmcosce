/**
 * Normal vaginal delivery and active third stage (NICE NG235, 2023; RCOG). Pure.
 */

export type BirthRun = {
  palm: boolean
  guard: boolean
  pant: boolean
  crowned: 'controlled' | 'rapid' | null
  tear: boolean
  cordFelt: boolean
  cord: 'slipped' | 'cut' | null
  restituted: boolean
  shouldersEarly: boolean
  anterior: 'gentle' | 'hard' | null
  posterior: boolean
  wrongOrder: boolean
  dried: number
  skin: boolean
  suctioned: boolean
  secondsSinceBirth: number
  clampedAt: number | null
}

export function freshBirth(): BirthRun {
  return { palm: false, guard: false, pant: false, crowned: null, tear: false, cordFelt: false, cord: null, restituted: false, shouldersEarly: false, anterior: null, posterior: false, wrongOrder: false, dried: 0, skin: false, suctioned: false, secondsSinceBirth: 0, clampedAt: null }
}

export const BIRTH_MARKS = ['control', 'pant', 'cord', 'restitution', 'shoulders', 'baby'] as const

export type Row = { key: string; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkBirth(r: BirthRun): Row[] {
  return [
    { key: 'control', label: 'Control', value: [r.palm && 'palm keeping the head flexed', r.guard && 'perineum guarded'].filter(Boolean).join(', ') || 'Hands off', range: 'Palm on the head to keep it flexed; the other hand guarding the perineum', ok: r.palm && r.guard, why: 'A controlled, flexed head stretches the perineum least.' },
    { key: 'pant', label: 'Crowning', value: r.crowned === 'controlled' ? 'Slow, she panted' : r.crowned === 'rapid' ? `Shot out${r.tear ? ', with a tear' : ''}` : 'Not delivered', range: 'Ask her to pant as the head crowns', ok: r.crowned === 'controlled', why: 'Pushing at crowning drives the head out fast and tears the perineum.' },
    { key: 'cord', label: 'Nuchal cord', value: r.cord === 'slipped' ? 'Felt for, loose, slipped over the head' : r.cord === 'cut' ? 'Clamped and cut before the birth' : r.cordFelt ? 'Felt, left round the neck' : 'Not felt for', range: 'Feel for it; a loose cord slips over the head', ok: r.cordFelt && r.cord === 'slipped', why: 'Cutting it before delivery is a last resort for a tight cord: it cuts off the baby’s supply.' },
    { key: 'restitution', label: 'Restitution', value: r.shouldersEarly ? 'Pulled before it turned' : r.restituted ? 'Waited: the head turned to face a thigh' : 'Not waited for', range: 'Wait for the head to turn, then the next contraction', ok: r.restituted && !r.shouldersEarly, why: 'Restitution lines the shoulders up with the widest part of the pelvis.' },
    { key: 'shoulders', label: 'Shoulders', value: r.anterior ? `${r.anterior === 'gentle' ? 'Gentle downward' : 'Hard'} traction for the anterior, ${r.posterior ? 'upward for the posterior' : 'posterior not delivered'}${r.wrongOrder ? ' (posterior first)' : ''}` : 'Not delivered', range: 'With a contraction: gentle downward for the anterior shoulder, then upward for the posterior', ok: r.anterior === 'gentle' && r.posterior && !r.wrongOrder, why: 'Hard traction injures the brachial plexus; anterior first gets it out from under the pubis.', critical: r.anterior === 'hard' },
    { key: 'baby', label: 'The baby', value: `${r.dried >= 0.7 ? 'dried' : 'wet'}, ${r.skin ? 'skin to skin' : 'not skin to skin'}${r.suctioned ? ', suctioned routinely' : ''}; cord ${r.clampedAt === null ? 'not clamped' : `clamped at ${r.clampedAt} s`}`, range: 'Dry, skin to skin, no routine suction; clamp after at least 60 s', ok: r.dried >= 0.7 && r.skin && !r.suctioned && r.clampedAt !== null && r.clampedAt >= 60, why: 'Drying and warmth matter most; delayed clamping gives her blood; routine suction can cause bradycardia.' },
  ]
}

/* ---------------------------------------------------------------- third stage */

export type ThirdRun = {
  palpated: boolean
  oxytocin: boolean
  /** Oxytocin given before the abdomen was felt for a second twin. */
  oxytocinFirst: boolean
  minutes: number
  saw: ('gush' | 'cord' | 'uterus')[]
  guarded: boolean
  pulledEarly: boolean
  inversion: boolean
  snapped: boolean
  placentaOut: boolean
  checked: ('cotyledons' | 'membranes' | 'vessels')[]
  rubbed: number
  inspected: boolean
  ebl: number | null
}

export function freshThird(): ThirdRun {
  return { palpated: false, oxytocin: false, oxytocinFirst: false, minutes: 0, saw: [], guarded: false, pulledEarly: false, inversion: false, snapped: false, placentaOut: false, checked: [], rubbed: 0, inspected: false, ebl: null }
}

/** Separation after about four minutes with oxytocin, longer without. */
export const separated = (r: ThirdRun) => r.minutes >= (r.oxytocin ? 4 : 12)

export const THIRD_MARKS = ['twin', 'separation', 'cct', 'placenta', 'fundus'] as const

export function checkThird(r: ThirdRun): Row[] {
  return [
    { key: 'twin', label: 'Twin and oxytocin', value: `${[r.palpated && 'no second twin', r.oxytocin && 'oxytocin 10 IU IM'].filter(Boolean).join(', ') || 'Neither'}${r.oxytocinFirst ? ' (oxytocin before feeling for a twin)' : ''}`, range: 'Palpate to exclude a twin, then oxytocin 10 IU IM', ok: r.palpated && r.oxytocin && !r.oxytocinFirst, why: 'Oxytocin with a second twin still inside can trap it.' },
    { key: 'separation', label: 'Separation', value: r.saw.length ? `Saw: ${r.saw.join(', ')}` : 'Not looked for', range: 'Gush of blood, the cord lengthening, the uterus firming and rising', ok: r.saw.length >= 2 && !r.pulledEarly, why: 'Traction before it has separated can invert the uterus.' },
    { key: 'cct', label: 'Controlled cord traction', value: r.inversion ? 'The uterus started to invert' : r.snapped ? 'The cord snapped' : r.placentaOut ? `Delivered${r.guarded ? ', the uterus guarded above the pubis' : ', unguarded'}` : 'Not delivered', range: 'Steady traction with the other hand guarding the uterus above the pubis', ok: r.placentaOut && r.guarded && !r.inversion && !r.snapped, why: 'The guarding hand stops the uterus following the cord.', critical: r.inversion },
    { key: 'placenta', label: 'The placenta', value: r.checked.length ? `Checked: ${r.checked.join(', ')}` : 'Not checked', range: 'Cotyledons and membranes complete; three vessels in the cord', ok: r.checked.length === 3, why: 'A missing cotyledon is a retained piece: bleeding and infection.' },
    { key: 'fundus', label: 'Tone, tears, loss', value: `${r.rubbed >= 0.6 ? 'fundus contracted' : 'tone not checked'}, ${r.inspected ? 'first-degree tear found' : 'not inspected'}, EBL ${r.ebl ?? '?'} mL`, range: 'A contracted fundus; inspect for tears; estimate the blood loss (about 300 mL)', ok: r.rubbed >= 0.6 && r.inspected && r.ebl !== null && r.ebl <= 400, why: 'Tone, trauma, tissue and thrombin: the four causes of PPH start here.' },
  ]
}
