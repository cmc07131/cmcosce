/**
 * What each step of the central line must achieve, checked as you go and again when you press Next. Pure.
 *
 * Every goal is `done`, `todo` (not done yet) or `fail` (something already went wrong that redoing the step
 * fixes). `how` is the guidance shown when it is not done: what to do, in the order you would do it.
 */
import {
  CATH_OK,
  DILATE_OK,
  LUMENS,
  ROTATION_MAX,
  STROKES_NEEDED,
  TILT_OK,
  WIRE_OK,
  garbOrderOk,
  tipZone,
  type CvcRun,
} from './model'

export type GoalState = 'done' | 'todo' | 'fail'
export type Goal = { label: string; state: GoalState; how: string; now?: string }

const g = (label: string, ok: boolean, how: string, failed = false, now?: string): Goal => ({ label, state: ok ? 'done' : failed ? 'fail' : 'todo', how, now })

export function stepGoals(step: number, r: CvcRun): Goal[] {
  switch (step) {
    case 0:
      return [
        g(`Bed ${TILT_OK.min}–${TILT_OK.max}° head-down`, r.tilt >= TILT_OK.min && r.tilt <= TILT_OK.max, r.tilt > TILT_OK.max ? `Too steep: drag the head end back up to ${TILT_OK.min}–${TILT_OK.max}°. That is enough to fill the vein.` : `Drag the head end of the bed down until the readout shows ${TILT_OK.min}–${TILT_OK.max}°. It fills the vein and stops air being drawn in.`, r.tilt > TILT_OK.max, `${r.tilt}° ${r.tilt >= 0 ? 'head-down' : 'head-up'}`),
        g('Head turned slightly to her left', r.rotation >= 10 && r.rotation <= ROTATION_MAX, `Drag her nose toward HER L and stop at about 30°. Beyond ${ROTATION_MAX}° the vein rolls over the carotid.`, r.rotation > ROTATION_MAX, `turned ${r.rotation}°`),
      ]
    case 1:
      return [
        g('Probe at the cricoid, apex of the triangle', r.scanLevel === 'apex', 'Drag the probe to where the two heads of sternocleidomastoid part, level with the cricoid ring. Not down by the clavicle, not up by the jaw.', r.scanLevel === 'low' || r.scanLevel === 'high'),
        g('Vein centred on the screen', r.scanOffset !== null && Math.abs(r.scanOffset) <= 3, 'Slide the probe sideways until the large oval vein sits in the middle of the screen: the needle will go in under the centre of the probe.', false, r.scanOffset === null ? 'not scanned' : `${Math.abs(r.scanOffset).toFixed(0)} mm off centre`),
        g('Vein squashed flat with the probe', r.pressedFlat, 'With the vein centred, hold PRESS DOWN: the vein flattens, the carotid stays round and pulsing. That is how you tell them apart.'),
        g('Vein named', r.named.includes('vein'), 'Tap the large, oval, thin-walled vessel on the left (lateral) side of the screen.'),
        g('Carotid named', r.named.includes('artery'), 'Tap the smaller, round, thick-walled, pulsing vessel on the right (medial).'),
      ]
    case 2:
      return [
        g('Cap, mask, scrub, gown, gloves all on', ['cap', 'mask', 'scrub', 'gown', 'gloves'].every((x) => r.garb.includes(x as never)), 'Put on all five: maximal barrier precautions for every central line.'),
        g('In a safe order', r.garb.length < 5 || garbOrderOk(r.garb), 'Cap and mask first; then scrub your hands; then the gown; gloves last, their cuffs over the gown sleeves. REDO THIS STEP to put them on again.', r.garb.length === 5 && !garbOrderOk(r.garb)),
      ]
    case 3:
      return [
        g('The whole field scrubbed', r.prepCoverage >= 0.8, 'Rub the chlorhexidine over all of the neck, from the jaw to below the clavicle, out to the shoulder.'),
        g(`Back and forth for 30 s (${Math.min(r.strokes, STROKES_NEEDED)}/${STROKES_NEEDED})`, r.strokes >= STROKES_NEEDED, 'Keep the sponge moving back and forth: friction for 30 seconds, not a single wipe.'),
        g('Left to dry before draping', r.strokes > 0 && !r.drapedWet && r.drySec >= 30, 'Lift your finger and wait for the shine to go: chlorhexidine in alcohol works as it dries. Then drape.', r.drapedWet),
        g('Full-length drape', r.draped >= 0.95, 'Drag the drape from the head all the way down to the feet.'),
      ]
    case 4:
      return [
        ...LUMENS.map((l) => g(`${l.name[0].toUpperCase()}${l.name.slice(1)} lumen flushed`, r.flushed.includes(l.id), `Tap the ${l.name} hub, then push the syringe plunger left until saline runs out of the tip.`)),
        g('Blue and white clamped', r.clamped.includes('medial') && r.clamped.includes('proximal'), 'Tap the white clamps on the blue and white lines once each is flushed.'),
        g('Brown left open for the wire', !r.clamped.includes('distal'), 'The wire comes out through the brown (distal) hub: never cap or clamp it before the catheter is in.'),
        g('Probe in a sterile sheath', r.probeCover, 'Tap the sheath to put gel in it, then drag the probe right into it.'),
      ]
    case 5:
      return [
        g('Local anaesthetic first', r.lidocaine >= 2, 'Push at least 2 mL of lidocaine from the syringe before the needle.'),
        g('Aspirating as you go in', r.enteredAspirating, 'Press PULL BACK ON THE PLUNGER before you advance, so blood fills the syringe the moment you are in.', r.popped && !r.enteredAspirating),
        g('Aimed at the centre of the vein', r.entryX === null ? false : Math.abs(r.entryX) <= 3, 'Before the needle touches the skin, slide the probe so the vein is centred: the needle goes in under the middle of the probe.', r.entryX !== null && Math.abs(r.entryX) > 3),
        g('Tip tracked all the way', r.blindMm <= 3, 'Advance only until the dot appears, then slide the probe on toward the chest until it disappears, and advance again. A dot that stays while you advance is the shaft, not the tip.', r.blindMm > 3),
        g('No carotid puncture', !r.arterial, 'Keep the vein centred and the tip in view. If the syringe fills with bright red blood on its own, withdraw and press.', r.arterial),
        g('Not through the back wall', !r.backWall, 'Stop as soon as the dark flash comes. If it stops, withdraw slowly, aspirating, until it returns.', r.backWall),
        g('Tip in the vein, dark blood back', r.where === 'vein' && r.flash === 'dark', 'Advance in small steps until the front wall dents, gives, and dark non-pulsatile blood fills the syringe.', r.where === 'artery'),
      ]
    case 6:
      return [
        g('Needle steadied first', r.steadied, 'Tap the needle hub to anchor it with your other hand, resting on the neck, before twisting the syringe off.', r.syringeOff && !r.steadied),
        g('Thumb over the open hub', r.thumb && r.openSec <= 3, 'As soon as the syringe is off, tap the hub to cover it with your thumb.', r.openSec > 3),
        g(`Wire to ${WIRE_OK.min}–${WIRE_OK.max} cm in the vein`, r.wireIn === 'vein' && r.wireCm >= WIRE_OK.min && r.wireCm <= WIRE_OK.max, `Feed it with the strip to ${WIRE_OK.min}–${WIRE_OK.max} cm at the hub. Ectopics on the monitor: pull it back a few centimetres.`, r.wireIn === 'artery', r.wireIn === 'artery' ? 'in the carotid' : `${r.wireCm.toFixed(0)} cm`),
        g('Wire held at the skin', r.grip === 'skin' || (r.needleOut && r.letGo === 0), 'Press HOLD THE WIRE AT THE SKIN before you slide the needle off.', r.letGo > 0),
        g('Needle off the wire', r.needleOut, 'Drag the SLIDE THE NEEDLE OUT strip to the left until the needle clears the wire.'),
      ]
    case 7:
      return [
        g('Wire seen in the vein, short axis', r.seenShort && r.wireIn === 'vein', 'Tap the bright dot with a shadow under it, inside the vein.', r.seenShort && r.wireIn === 'artery'),
        g('Wire seen in the vein, long axis', r.seenLong && r.wireIn === 'vein', 'Turn the probe 90° to the long axis and tap the bright line running down the vein.'),
      ]
    case 8:
      return [
        g('A small nick at the wire, away from it', r.nick !== null && !r.nick.crossed && r.nick.len >= 2 && r.nick.len <= 7, 'Start the blade right at the wire and drag about 4 mm away from it, never across it.', r.nick !== null && (r.nick.crossed || r.nick.len > 7), r.nick ? `${r.nick.len.toFixed(0)} mm${r.nick.crossed ? ', across the wire' : ''}` : undefined),
        g(`Dilated to the vein only (${DILATE_OK.min}–${DILATE_OK.max} mm)`, r.dilatorMax >= DILATE_OK.min && r.dilatorMax <= DILATE_OK.max && !r.dilatedArtery, 'Bring the dilator to the skin, take the wire at its tail, then twist it in until you feel the give into the vein (about 2–3 cm), no further.', r.dilatorMax > DILATE_OK.max || r.dilatedArtery, `${r.dilatorMax.toFixed(0)} mm`),
        g('Wire held throughout', r.letGo === 0, 'Swap your hand from the skin to the tail only once the tail is out of the back of the dilator, and back to the skin before you slide it off.', r.letGo > 0),
        g('Dilator off, wire still in', r.dilated && r.sleeve === null && r.inside > 0, 'Draw the dilator back out of the skin, hold the wire at the skin, then slide the dilator off the end.'),
      ]
    case 9:
      return [
        g('Wire held at the brown hub before the skin', r.hubGrip, 'Slide the catheter down until the wire comes out of the brown hub, then press HOLD THE WIRE AT THE BROWN HUB before its tip reaches the skin.'),
        g(`Catheter at ${CATH_OK.min}–${CATH_OK.max} cm`, Math.round(r.catheterCm) >= CATH_OK.min && Math.round(r.catheterCm) <= CATH_OK.max, `Push it in with the strip until the readout shows ${CATH_OK.min}–${CATH_OK.max} cm at the skin (15 cm for a right IJ).`, Math.round(r.catheterCm) > CATH_OK.max + 2, `${Math.round(r.catheterCm)} cm`),
        g('Wire out', r.wireOut, 'Drag the DRAW THE WIRE OUT strip to the left until the wire is out of the brown hub.'),
        g('Wire shown whole', r.wireCounted, 'Tap the J tip of the wire on the tray: whole, and counted out with the nurse.'),
      ]
    case 10:
      return [
        ...LUMENS.map((l) =>
          g(
            `${l.name[0].toUpperCase()}${l.name.slice(1)}: blood back, flushed, capped`,
            r.aspirated.includes(l.id) && r.flushedAfter.includes(l.id) && r.capped.includes(l.id),
            `Tap the ${l.name} hub; pull the plunger right for blood; push it left to flush; then tap the hub again to cap it.`,
          ),
        ),
        g('Both wings stitched', r.sutures >= 2, 'Tap each blue wing of the fastener to stitch it.'),
        g('Dressing on', r.dressing, 'After the stitches, drag the dressing down from the top over the site.'),
      ]
    case 11:
      return [
        g('Tip at the cavo-atrial junction', r.tipSeen && tipZone(r.catheterCm) === 'junction', 'Follow the white line down from the neck and tap where it ends: it should be about two vertebrae below the carina.', r.tipSeen && tipZone(r.catheterCm) !== 'junction'),
        g('Right lung checked', r.lungsChecked.includes('right'), 'Tap the outer edge of the lung on your left (her right): markings out to the chest wall, no pneumothorax.'),
        g('Left lung checked', r.lungsChecked.includes('left'), 'Tap the outer edge of the lung on your right (her left).'),
        g('Documented', r.documented, 'Press DOCUMENT AND CONFIRM THE WIRE COUNT.'),
      ]
  }
  return []
}

export const stepOk = (step: number, r: CvcRun) => stepGoals(step, r).every((x) => x.state === 'done')
