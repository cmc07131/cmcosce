/** What each step of the lavage must achieve, with the guidance shown when it is not done. Pure. */
import { goal as g, type Goal } from '../bench/goals'
import { ALIQUOT, CONTENTS, DEPTH, END, FOOT, MEASURE, atMark, clear, confirmed, enough, footOk, inStomach, markOk, type LavageRun } from './model'

export const LAVAGE_TITLES = ['Position', 'Measure', 'Pass', 'Confirm', 'Siphon', 'Lavage', 'Finish']

const L = (ml: number) => `${(ml / 1000).toFixed(1)} L`

export function lavageGoals(step: number, r: LavageRun): Goal[] {
  switch (step) {
    case 0:
      return [
        g('Left lateral', r.lateral, 'Press ROLL HER ONTO HER LEFT SIDE.'),
        g(`Foot of the trolley up about ${FOOT.target} cm`, footOk(r), `Turn the FOOT dial until the gauge reads ${FOOT.min}–${FOOT.max} cm: head down, so anything she brings up runs out of her mouth, not into her lungs.`, r.foot > FOOT.max, `${Math.round(r.foot)} cm`),
        g('Suction on, at her mouth', r.suction, 'Press SUCTION ON: the Yankauer by her mouth before the tube goes near it.'),
      ]
    case 1:
      return [
        g('Tube laid mouth to epigastrium', r.mark !== null || Math.abs(r.laid - MEASURE.true) <= MEASURE.tol, 'Drag the LAY THE TUBE strip until its tip sits on the dashed epigastrium, just below the xiphisternum.', false, `${Math.round(r.laid)} cm`),
        g('Taped at the mark', markOk(r), r.mark !== null && !markOk(r) ? 'Wrong length: lay it again to the epigastrium and tape again.' : 'Press TAPE THE MARK with the tip on the epigastrium: the tape at her lips tells you when the tube is in the stomach.', r.mark !== null && !markOk(r), r.mark === null ? undefined : `${Math.round(r.mark)} cm`),
      ]
    case 2:
      return [
        g('Lignocaine to the throat', r.sprayed, 'Hold SPRAY THE THROAT: lignocaine to the oropharynx so she gags less.'),
        g('Mouth gag in', r.gagIn, 'Press MOUTH GAG IN so she cannot bite the tube.'),
        g('Tube lubricated', r.lubed >= 1, 'Hold LUBRICATE until the end of the tube glistens.'),
        g('With her swallows, never against a gag', !r.forced, r.forced ? 'You pushed while she gagged: she retched. REDO THIS STEP: stop at the gag, press SWALLOW, then go on.' : 'When she gags at the back of the throat, stop and press “SWALLOW”, then advance with the swallow.', r.forced),
        g('In to the tape', atMark(r), `Drag ADVANCE until the tape is at her lips (${r.mark === null ? '—' : Math.round(r.mark)} cm).`, false, `${Math.round(r.depth)} cm`),
      ]
    case 3:
      return [g('In the stomach, confirmed', confirmed(r), inStomach(r) ? 'Hold ASPIRATE for gastric fluid, or hold AIR IN, LISTEN for the whoosh at the epigastrium.' : `The tip is not in the stomach (${Math.round(r.depth)} cm, the junction at ${DEPTH.goj}): go back, check the measurement and advance.`, r.missed && !confirmed(r))]
    case 4:
      return [
        g('Contents siphoned off', r.siphoned && !r.unsiphoned, r.unsiphoned ? 'Fluid went into a full stomach. REDO THIS STEP: siphon first.' : `Move the FUNNEL down below her, over the bucket: the ${CONTENTS} mL in her stomach drains out.`, r.unsiphoned),
        g('Specimen saved', r.sample === 'neat', r.sample === 'diluted' ? 'That sample was diluted by lavage fluid. REDO THIS STEP and save the first return.' : 'Press SAVE A SPECIMEN while the first return comes: it goes to toxicology.', r.sample === 'diluted'),
      ]
    case 5:
      return [
        g(`Aliquots of about ${ALIQUOT.ml} mL`, r.peakAliquot <= ALIQUOT.max && !r.vomited, r.vomited ? 'Too much in at once: she vomited round the tube. REDO THIS STEP.' : `Hold POUR until the funnel reads about ${ALIQUOT.ml} mL, raise it to run in, lower it to drain before the next. More than ${ALIQUOT.max} mL at once overfills her.`, r.peakAliquot > ALIQUOT.max || r.vomited, r.peakAliquot ? `largest ${Math.round(r.peakAliquot)} mL` : undefined),
        g('Each one drained back', r.stomach < 60 || r.inTotal === 0, 'Lower the funnel over the bucket after each aliquot until the return stops: in should equal out.', false, `${Math.round(r.stomach)} mL left in`),
        g('The return clear', clear(r), 'Keep going: the return clears as the tablet washes out.'),
        g(`${L(END.total)} used`, enough(r), `Carry on until ${L(END.total)} have gone in and the return is clear.`, false, L(r.inTotal)),
      ]
    case 6:
      return [
        g('Charcoal 50 g down the tube', r.charcoal, 'Press CHARCOAL 50 g DOWN THE TUBE, while the tube is still in.'),
        g('Pinched before withdrawing', !r.dribbled && (r.pinched || r.out === 0), r.dribbled ? 'It came out open: fluid ran into her pharynx. REDO THIS STEP: pinch first.' : 'Press PINCH THE TUBE before it moves.', r.dribbled),
        g('Withdrawn', r.out >= r.depth && r.depth > 0, 'Drag WITHDRAW to the left in one smooth pull.'),
        g('Gag out, mouth suctioned', r.gagOut, 'Press GAG OUT, SUCTION once the tube is out.'),
      ]
    default:
      return []
  }
}
