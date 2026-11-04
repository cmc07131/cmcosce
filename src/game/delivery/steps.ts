/**
 * What each step of the delivery and the third stage must achieve, with the guidance shown when it is not done. Pure.
 */
import { goal as g, type Goal } from '../bench/goals'
import {
  CLAMP_CM,
  CLAMP_S,
  EBL,
  HEAD,
  MEMBRANE_TURNS as MT,
  clampPlaced,
  clock,
  crownedSlowly,
  cutBetween,
  flexed,
  pantInTime,
  separated,
  type BirthRun,
  type ThirdRun,
} from './model'

export const BIRTH_TITLES = ['Hands', 'Crowning', 'Cord', 'Restitution', 'Shoulders', 'Baby']
export const THIRD_TITLES = ['Twin', 'Cord', 'Separation', 'Traction', 'Placenta', 'Tone and tears']

export function birthGoals(step: number, r: BirthRun): Goal[] {
  switch (step) {
    case 0:
      return [
        g('Pad on the perineum', r.guard, 'Tap the perineum below the head: your right hand, holding a pad, supports it as the head stretches it.'),
        g('Palm on the occiput', r.palm, 'Tap the top of the head: your left palm goes over the occiput, ready to keep the head flexed.'),
      ]
    case 1:
      return [
        g('“Pant, don’t push” as it crowns', pantInTime(r), 'When the head stops slipping back between contractions it is crowning: press “PANT, DON’T PUSH” then, before the next contraction drives it.', r.pant !== null && !pantInTime(r), r.pant === null ? undefined : `said when the head was ${r.pant < HEAD.crowning ? 'not yet crowning' : 'already well through'}`),
        g('Head kept flexed through crowning', r.headBorn ? flexed(r) : r.unheld <= 0.05, 'Hold KEEP IT FLEXED all through each contraction once the head crowns: your palm presses gently on the occiput.', r.unheld > 0.05),
        g('Born slowly', crownedSlowly(r), 'Slow is pant plus your palm: the head eases out over a contraction or two. REDO THIS STEP to try again.', r.fast > 0.1),
      ]
    case 2:
      return [
        g('Felt round the neck', r.felt >= 1, 'Hold FEEL ROUND THE NECK until your finger has gone all the way round.'),
        g('Loose loop eased over the head', r.loop >= 1, 'Drag the EASE THE LOOP strip to the right: the loose loop slides up over the occiput and off.'),
      ]
    case 3:
      return [g('Hands off while the head turns', r.restitution >= 1 && !r.pulledEarly, 'Wait with your hands off: the head turns on its own to face her right thigh as the shoulders rotate.', r.pulledEarly)]
    case 4:
      return [
        g('Hands either side of the head', r.sides, 'Tap the head: a hand over each parietal bone, never round the neck.'),
        g('Anterior shoulder: gentle, downward', r.anterior >= 1, 'With a contraction, drag the TRACTION strip a little DOWN, in the green: steady, gentle, toward the floor until the anterior shoulder slips under the pubis.'),
        g('Posterior shoulder: gentle, upward', r.posterior >= 1 && !r.wrongOrder, r.wrongOrder ? 'The anterior shoulder comes first, from under the pubis: down first, then up. REDO THIS STEP.' : 'Then drag the strip UP, still in the green, toward her tummy: the posterior shoulder sweeps over the perineum and she is born.', r.wrongOrder),
        g('Never hard', !r.hard, 'Keep the knob in the green: hard traction on the head stretches the brachial plexus. REDO THIS STEP.', r.hard),
      ]
    case 5:
      return [
        g('Onto mum, skin to skin', r.onMum, 'Press LIFT HER ONTO MUM: straight onto her tummy, skin to skin.'),
        g('Time of birth noted', r.timeCalled, 'Press CALL OUT THE TIME: the time of birth goes in the notes.'),
        g('Dried', r.dried >= 0.7, 'Rub her all over with the warm towel: head, back, limbs. Drying warms her and makes her breathe.', false, `${Math.round(r.dried * 100)}% dry`),
        g('Wet towel off; dry towel and hat', r.dryTowel, 'Press DRY TOWEL AND HAT once she is dry: the wet towel off, a warm one over her and a hat on.'),
        g('Breathing, tone, colour', r.assessed, 'Press CHECK HER: crying or breathing, tone, colour, heart rate at the cord or chest.'),
      ]
    default:
      return []
  }
}

export function thirdGoals(step: number, r: ThirdRun): Goal[] {
  switch (step) {
    case 0:
      return [
        g('Palpated: no second twin', r.palpated >= 1, 'Hold PALPATE THE ABDOMEN: both hands over the fundus and sides, for fetal parts and the height of the uterus.'),
        g('Oxytocin 10 IU IM, after palpating', r.oxyAt !== null && !r.oxyFirst, r.oxyFirst ? 'Feel for a second twin first: oxytocin would clamp the uterus down on a baby still inside. REDO THIS STEP.' : 'Tap her thigh (the dashed area): oxytocin 10 IU into the anterolateral thigh.', r.oxyFirst),
      ]
    case 1:
      return [
        g(`Clamped no sooner than ${CLAMP_S.min / 60} min, before ${CLAMP_S.max / 60}`, r.clampedAt !== null && r.clampedAt >= CLAMP_S.min && r.clampedAt <= CLAMP_S.max, r.clampedAt !== null && r.clampedAt < CLAMP_S.min ? 'Too soon: a well baby keeps her cord for at least a minute. REDO THIS STEP and wait.' : `Watch the clock: clamp once it reads past ${clock(CLAMP_S.min)} (LET 30 SECONDS PASS if you need to), and before ${clock(CLAMP_S.max)}.`, r.clampedAt !== null && (r.clampedAt < CLAMP_S.min || r.clampedAt > CLAMP_S.max), r.clampedAt === null ? undefined : `clamped at ${clock(r.clampedAt)}`),
        g(`Cord clamp ${CLAMP_CM.min}–${CLAMP_CM.max} cm from her tummy`, clampPlaced(r), 'Pick CORD CLAMP and tap the cord close to the baby’s tummy, inside the dashed mark.', r.clampAt !== null && !clampPlaced(r), r.clampAt === null ? undefined : `${r.clampAt.toFixed(0)} cm`),
        g('Forceps on the mother’s side', r.forcepsAt !== null && r.clampAt !== null && r.forcepsAt > r.clampAt + 2, 'Pick FORCEPS and tap the cord a few centimetres beyond the cord clamp, toward the mother.'),
        g('Cut between them', cutBetween(r) && !r.bleed, 'Pick SCISSORS and tap the cord between the clamp and the forceps.', r.bleed),
      ]
    case 2:
      return [
        g('Waited for separation', separated(r) || r.saw.length >= 2, 'Press WAIT A MINUTE and keep watching: with oxytocin it separates in a few minutes.'),
        g('At least two signs seen', r.saw.length >= 2, 'Tap each sign as it appears: blood at the introitus (a gush), the forceps further from the vulva (lengthening), and the uterus (firm, globular, risen).', false, r.saw.length ? `${r.saw.length} seen` : undefined),
        g('No traction before it separated', !r.pulledEarly, 'Never pull before the signs: the cord tears or the uterus inverts. REDO THIS STEP.', r.pulledEarly),
      ]
    case 3:
      return [
        g('Uterus guarded above the pubis', r.guarded && !r.unguardedPull, 'Tap above the pubis first: the edge of your hand pushes the uterus up and back while the other hand pulls.', r.unguardedPull),
        g('Steady gentle traction to the introitus', r.descent >= 1 && !r.snapped, r.snapped ? 'Too hard: the cord snapped. REDO THIS STEP and keep the knob in the green.' : 'Drag the TRACTION strip down and hold it in the green: steady and gentle, along the line of the birth canal.', r.snapped || r.inversion),
        g(`Membranes twisted out (${Math.min(MT, Math.floor(r.turns))}/${MT})`, r.out, 'Cup the placenta and turn it round and round on the dial: twisting the membranes into a rope keeps them whole.'),
      ]
    case 4:
      return [
        g('Maternal surface: cotyledons complete', r.seen.includes('maternal'), 'Press MATERNAL SURFACE and look for a gap among the cotyledons.'),
        g('Fetal surface and membranes complete', r.seen.includes('fetal'), 'Press FETAL SURFACE, MEMBRANES: hold it up by the cord to see the membranes whole, one hole.'),
        g('Three cord vessels', r.seen.includes('cord'), 'Press CUT END OF THE CORD: two arteries and a vein.'),
      ]
    case 5:
      return [
        g('Fundus rubbed up, firm', r.rubbed >= 0.6, 'Rub over the fundus in circles until it firms up under your hand.', false, `${Math.round(r.rubbed * 100)}%`),
        g('Perineum and vagina inspected', r.looked, 'Press LIGHT AND LOOK: inspect the perineum, labia and vagina for tears.'),
        g(`Blood loss measured (${EBL.jug + EBL.pads} mL)`, r.jug && r.pads, 'Measure the jug and weigh the pads (1 g is 1 mL): an eyeball estimate is always too low.'),
      ]
    default:
      return []
  }
}

