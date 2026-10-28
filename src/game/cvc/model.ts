/**
 * Ultrasound-guided right internal jugular central line, Seldinger technique, on a neck manikin. Pure, so the test
 * can drive it. Checked against NICE TA49, the Association of Anaesthetists' safe vascular access guideline (2016),
 * NatSSIPs 2023, the MSD Manual's internal jugular cannulation steps (Trendelenburg 15–20°, slight head turn,
 * pre-flushed lumens, J-wire 10–15 cm on the right, never lose grasp of the wire, #11 blade stab of about 4 mm,
 * dilator with a twisting motion, the wire out of the hub before the catheter goes in, catheter at least 15 cm on the
 * right, aspirate and flush, chest X-ray before use) and the short-axis dynamic needle tip positioning technique
 * (needle at 45–60°, slide the probe until the tip disappears, advance until it reappears).
 *
 * Working units are millimetres, in the patient: `x` lateral (+) or medial (−) from the centre of the vein, `z` depth
 * below the skin, `y` caudal along the neck from where the needle went in. Wire, dilator and catheter run along the
 * wire in centimetres.
 */

/* ================================================================ anatomy */

/** Centre of the right IJV below the skin at the level of the cricoid, on the manikin. */
export const VEIN_DEPTH = 13
/** The common carotid: medial and a little deeper. */
export const ARTERY = { x: -10.5, z: 16, r: 4 }

/** Head-down fills the vein: about 5 mm radius flat, 7.5 mm at 15° or more. */
export function veinRadius(tilt: number) {
  return 5 + 2.5 * Math.min(1, Math.max(0, tilt) / 15)
}

/** The vein as an ellipse. `press`: how hard the probe pushes (0–1). `tent`: the needle denting its front wall, mm. */
export function veinShape(tilt: number, press = 0, tent = 0) {
  const r = veinRadius(tilt)
  const rz = Math.max(0.4, r * (1 - 0.92 * press) - tent * 0.45)
  return { x: 0, z: VEIN_DEPTH + (r - rz) * 0.55, rx: r * (1 + 0.35 * press) + tent * 0.15, rz }
}

/** Turning the head far round brings the vein over the carotid. */
export function arteryAt(rotation: number) {
  return { ...ARTERY, x: ARTERY.x + Math.max(0, rotation - 40) * 0.2 }
}

/** How much of the artery lies straight under the vein (0–1): a needle through the back wall finds it. */
export function overlap(tilt: number, rotation: number) {
  const v = veinShape(tilt)
  const a = arteryAt(rotation)
  return Math.max(0, Math.min(1, (v.rx + a.r - Math.abs(a.x - v.x)) / (2 * a.r)))
}

export const TILT_OK = { min: 10, max: 20 }
export const ROTATION_MAX = 45

/* ================================================================ the probe on the neck */

/**
 * The neck from the head of the bed, 200 × 150, 2 units to the millimetre: the jaw nearest you (bottom), the
 * clavicle away from you (top), the midline to your right (her right neck is on your left).
 */
export const NECK = { scale: 2, apexY: 74, clavicleY: 22, jawY: 132 }
/** The vein's course on the neck picture: almost straight down the neck under the sternocleidomastoid. */
export const veinXOnNeck = (y: number) => 88 + (y - NECK.apexY) * 0.12
export const arteryXOnNeck = (y: number) => veinXOnNeck(y) + 22

export type Level = 'apex' | 'low' | 'high'
export function levelAt(y: number): Level {
  if (y < 48) return 'low'
  if (y > 100) return 'high'
  return 'apex'
}
/** Where the probe centre lies, in mm lateral to the vein. */
export const offsetMm = (p: { x: number; y: number }) => (veinXOnNeck(p.y) - p.x) / NECK.scale

/* ================================================================ kit */

export type Lumen = 'distal' | 'medial' | 'proximal'
export const LUMENS: { id: Lumen; colour: string; name: string }[] = [
  { id: 'distal', colour: '#8a5a2c', name: 'distal (brown)' },
  { id: 'medial', colour: '#3a68c8', name: 'medial (blue)' },
  { id: 'proximal', colour: '#ececec', name: 'proximal (white)' },
]

export type Garb = 'cap' | 'mask' | 'scrub' | 'gown' | 'gloves'
export const GARB: { id: Garb; label: string; line: string }[] = [
  { id: 'cap', label: 'CAP', line: 'Hair under a cap.' },
  { id: 'mask', label: 'MASK', line: 'A surgical mask over nose and mouth.' },
  { id: 'scrub', label: 'SCRUB HANDS', line: 'A surgical hand scrub, fingertips up.' },
  { id: 'gown', label: 'STERILE GOWN', line: 'Into the sterile gown, tied at the back by the nurse.' },
  { id: 'gloves', label: 'STERILE GLOVES', line: 'Closed gloving: the cuffs over the gown sleeves.' },
]

/** Garb in a safe order: cap and mask before the scrub, scrub before the gown, gown before the gloves. */
export function garbOrderOk(garb: Garb[]) {
  const at = (g: Garb) => garb.indexOf(g)
  if (GARB.some((g) => at(g.id) < 0)) return false
  return at('cap') < at('scrub') && at('mask') < at('scrub') && at('scrub') < at('gown') && at('gown') < at('gloves')
}

/** Chlorhexidine: back-and-forth strokes for about 30 seconds, then left to dry. */
export const STROKES_NEEDED = 12
export const DRY_SECONDS = 30

/* ================================================================ the needle */

/** The introducer needle goes in at 45°, so its depth equals its distance down the neck. */
export const NEEDLE_ANGLE = 45
const S = Math.SQRT1_2
export const NEEDLE_LEN = 64
export const tipOf = (depth: number) => ({ y: depth * S, z: depth * S })
/** The beam is about 1.5 mm thick: a tip within that is seen as the tip. */
export const BEAM_HALF = 1.5
/** The front wall dents this far before the needle pops through. */
export const TENT_MAX = 3.5

export type Where = 'outside' | 'tissue' | 'vein' | 'artery' | 'through'

/** Where the needle crosses the beam, if it does: the bright dot. `isTip`: what you see really is the tip. */
export function needleInBeam(depth: number, beam: number) {
  const tip = tipOf(depth)
  if (depth <= 0 || tip.y < beam - BEAM_HALF) return null
  const isTip = tip.y <= beam + BEAM_HALF
  return { z: Math.min(tip.z, beam), isTip }
}

function wallsAt(x: number, tilt: number) {
  const v = veinShape(tilt)
  if (Math.abs(x - v.x) >= v.rx) return null
  const h = v.rz * Math.sqrt(1 - ((x - v.x) / v.rx) ** 2)
  return { front: v.z - h, back: v.z + h }
}

export type NeedleRun = {
  tilt: number
  rotation: number
  entryX: number | null
  depth: number
  beam: number
  aspirating: boolean
  where: Where
  tent: number
  popped: boolean
  blindMm: number
  passes: number
  arterial: boolean
  backWall: boolean
  enteredAspirating: boolean
  flash: 'none' | 'dark' | 'bright'
}

export type NeedleEvent = 'skin' | 'tent' | 'pop' | 'artery' | 'through' | 'out' | 'move' | 'deep' | 'resist'

/** Move the needle to `depth` mm along its shaft. Counts blind advancing (tip past the beam), pops and punctures. */
export function moveNeedle(n: NeedleRun, depth: number, probeX: number): { patch: Partial<NeedleRun>; event: NeedleEvent } {
  const d = Math.max(0, Math.min(NEEDLE_LEN - 4, depth))
  const patch: Partial<NeedleRun> = { depth: d }
  const delta = d - n.depth
  if (n.depth <= 0 && d > 0) {
    patch.entryX = probeX
    patch.passes = n.passes + 1
    patch.popped = false
    patch.tent = 0
  }
  const entryX = patch.entryX ?? n.entryX ?? probeX
  if (d <= 0) return { patch: { ...patch, where: 'outside', tent: 0, popped: false, flash: n.flash }, event: n.depth > 0 ? 'out' : 'move' }
  const tip = tipOf(d)
  if (delta > 0 && tip.y > n.beam + BEAM_HALF) patch.blindMm = n.blindMm + delta
  const a = arteryAt(n.rotation)
  const inArtery = Math.hypot(entryX - a.x, tip.z - a.z) <= a.r
  const walls = wallsAt(entryX, n.tilt)
  let popped = patch.popped ?? n.popped
  let where: Where = 'tissue'
  let tent = 0
  let event: NeedleEvent = 'move'
  if (inArtery) {
    where = 'artery'
    event = 'artery'
    patch.arterial = true
  } else if (walls) {
    if (!popped) {
      if (tip.z >= walls.front + TENT_MAX) {
        popped = true
        event = 'pop'
        if (n.aspirating) patch.enteredAspirating = true
      } else if (tip.z >= walls.front) {
        tent = tip.z - walls.front
        event = 'tent'
      }
    } else if (tip.z < walls.front) popped = false
    if (popped) {
      if (tip.z > walls.back) {
        where = 'through'
        if (n.where !== 'through') event = 'through'
        patch.backWall = true
      } else where = 'vein'
    }
  }
  if (tip.z > 32 && where === 'tissue') event = 'deep'
  // Blood in the syringe stays there once it has come.
  const flash = where === 'artery' ? 'bright' : where === 'vein' && n.aspirating ? (n.flash === 'bright' ? 'bright' : 'dark') : n.flash
  return { patch: { ...patch, where, tent, popped, flash }, event }
}

/* ================================================================ the wire */

export const WIRE_LEN = 60
/** Past this mark at the hub the J tip tickles the right atrium: ectopics. */
export const ECTOPY_CM = 21
export const WIRE_OK = { min: 12, max: 20 }
/** Where your fingers pinch the wire, near the skin. */
export const SKIN_GRIP_CM = 3
export const DIL_LEN = 10
export const CATH_LEN = 20
export const CATH_OK = { min: 14, max: 16 }
/** The dilator only needs to reach the vein: about 18 mm along the track at 45° (13 mm deep), with a little to spare. */
export const DILATE_OK = { min: 15, max: 32 }

export type Grip = 'needle' | 'skin' | 'tail' | 'none'

export type Sleeve = { kind: 'dilator' | 'catheter'; front: number } | null

/** The tail of the wire, in cm along it from the skin. */
export const tailAt = (inside: number) => WIRE_LEN - inside
/** The tail is out of the back of what is threaded on the wire, so a hand can hold it. */
export function tailFree(inside: number, sleeve: Sleeve) {
  if (!sleeve) return true
  const len = sleeve.kind === 'dilator' ? DIL_LEN : CATH_LEN
  return sleeve.front + len < tailAt(inside) - 0.5
}

/* ================================================================ the whole run */

export type CvcRun = NeedleRun & {
  // position and pre-scan
  scanLevel: Level | null
  scanOffset: number | null
  pressedFlat: boolean
  named: ('vein' | 'artery')[]
  // asepsis
  garb: Garb[]
  prepCoverage: number
  strokes: number
  drySec: number
  drapedWet: boolean
  draped: number
  // kit
  flushed: Lumen[]
  clamped: Lumen[]
  probeCover: boolean
  lidocaine: number
  // wire
  steadied: boolean
  syringeOff: boolean
  thumb: boolean
  openSec: number
  wireCm: number
  wireMax: number
  wireIn: 'vein' | 'artery' | null
  ectopy: boolean
  needleOut: boolean
  inside: number
  grip: Grip
  letGo: number
  // confirm
  seenShort: boolean
  seenLong: boolean
  // dilate
  nick: { len: number; crossed: boolean } | null
  sleeve: Sleeve
  dilatorMax: number
  dilated: boolean
  dilatedArtery: boolean
  gauze: boolean
  // catheter
  catheterCm: number
  catheterPlaced: boolean
  hubGrip: boolean
  wireOut: boolean
  wireCounted: boolean
  // after
  aspirated: Lumen[]
  flushedAfter: Lumen[]
  capped: Lumen[]
  sutures: number
  dressing: boolean
  tipSeen: boolean
  lungsChecked: ('left' | 'right')[]
  documented: boolean
}

export function freshCvc(): CvcRun {
  return {
    tilt: 0,
    rotation: 0,
    entryX: null,
    depth: 0,
    beam: 10,
    aspirating: false,
    where: 'outside',
    tent: 0,
    popped: false,
    blindMm: 0,
    passes: 0,
    arterial: false,
    backWall: false,
    enteredAspirating: false,
    flash: 'none',
    scanLevel: null,
    scanOffset: null,
    pressedFlat: false,
    named: [],
    garb: [],
    prepCoverage: 0,
    strokes: 0,
    drySec: 0,
    drapedWet: false,
    draped: 0,
    flushed: [],
    clamped: [],
    probeCover: false,
    lidocaine: 0,
    steadied: false,
    syringeOff: false,
    thumb: false,
    openSec: 0,
    wireCm: 0,
    wireMax: 0,
    wireIn: null,
    ectopy: false,
    needleOut: false,
    inside: 0,
    grip: 'needle',
    letGo: 0,
    seenShort: false,
    seenLong: false,
    nick: null,
    sleeve: null,
    dilatorMax: 0,
    dilated: false,
    dilatedArtery: false,
    gauze: false,
    catheterCm: 0,
    catheterPlaced: false,
    hubGrip: false,
    wireOut: false,
    wireCounted: false,
    aspirated: [],
    flushedAfter: [],
    capped: [],
    sutures: 0,
    dressing: false,
    tipSeen: false,
    lungsChecked: [],
    documented: false,
  }
}

/** Feed the wire to `cm` at the hub. Out of a lumen it stops at the needle tip: resistance. */
export function feedWire(r: CvcRun, cm: number): { patch: Partial<CvcRun>; event: 'resist' | 'ectopy' | 'move' } {
  const lumen = r.where === 'vein' || r.where === 'artery'
  const cap = lumen ? WIRE_LEN - 5 : NEEDLE_LEN / 10 + 0.8
  const c = Math.max(0, Math.min(cap, cm))
  const patch: Partial<CvcRun> = { wireCm: c, wireMax: Math.max(r.wireMax, c) }
  if (c > 0 && r.wireIn === null && lumen) patch.wireIn = r.where === 'artery' ? 'artery' : 'vein'
  if (c >= cap && cm > cap && !lumen) return { patch, event: 'resist' }
  if (c > ECTOPY_CM && r.wireIn !== 'artery' && lumen) return { patch: { ...patch, ectopy: true }, event: 'ectopy' }
  return { patch, event: 'move' }
}

/** Length of wire in the patient once the needle is off it. */
export const insideAfterNeedle = (r: CvcRun) => Math.max(0, r.wireCm - (NEEDLE_LEN - r.depth) / 10)

/** Slide a dilator or catheter along the wire to `front` cm from the skin (negative: under the skin). */
export function slide(r: CvcRun, front: number): { patch: Partial<CvcRun>; event: 'blocked-hand' | 'blocked-tail' | 'off' | 'skin' | 'move' } {
  const s = r.sleeve
  if (!s) return { patch: {}, event: 'move' }
  const len = s.kind === 'dilator' ? DIL_LEN : CATH_LEN
  const tail = tailAt(r.inside)
  let f = front
  // Your fingers on the wire at the skin are in the way.
  if (r.grip === 'skin' && s.front > SKIN_GRIP_CM && f < SKIN_GRIP_CM) return { patch: { sleeve: { ...s, front: SKIN_GRIP_CM } }, event: 'blocked-hand' }
  // Off the end of the wire: only with the wire held at the skin.
  if (f > tail) {
    if (r.grip === 'tail') return { patch: { sleeve: { ...s, front: tail - 0.2 } }, event: 'blocked-tail' }
    return { patch: { sleeve: null }, event: 'off' }
  }
  if (s.kind === 'catheter' && f < 0) f = Math.max(-(len - 1), f)
  const patch: Partial<CvcRun> = { sleeve: { ...s, front: f } }
  if (s.kind === 'dilator' && f < 0) {
    const mm = -f * 10
    patch.dilatorMax = Math.max(r.dilatorMax, mm)
    if (mm >= DILATE_OK.min) {
      patch.dilated = true
      if (r.wireIn === 'artery') patch.dilatedArtery = true
    }
  }
  if (s.kind === 'catheter') patch.catheterCm = Math.max(0, -f)
  return { patch, event: s.front >= 0 && f < 0 ? 'skin' : 'move' }
}

/** Where the catheter tip lies on the chest X-ray, from its depth at the skin. */
export function tipZone(cm: number): 'high' | 'junction' | 'atrium' {
  if (cm < CATH_OK.min - 1) return 'high'
  if (cm > CATH_OK.max + 1.5) return 'atrium'
  return 'junction'
}

/* ================================================================ check */

export const CVC_MARKS = ['position', 'asepsis', 'puncture', 'wire', 'dilate', 'secure', 'confirm'] as const
export type CvcMark = (typeof CVC_MARKS)[number]
export type CvcRow = { key: CvcMark; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

const list = (xs: string[]) => xs.join(', ') || 'none'

export function checkCvc(r: CvcRun): CvcRow[] {
  const tiltOk = r.tilt >= TILT_OK.min && r.tilt <= TILT_OK.max
  const rotOk = r.rotation <= ROTATION_MAX
  const scanOk = r.scanLevel === 'apex' && r.scanOffset !== null && Math.abs(r.scanOffset) <= 3
  const garbOk = garbOrderOk(r.garb)
  const prepOk = r.prepCoverage >= 0.8 && r.strokes >= STROKES_NEEDED
  const aimOk = r.entryX !== null && Math.abs(r.entryX) <= 3
  const wireOk = r.wireIn === 'vein' && r.wireCm >= WIRE_OK.min && r.wireCm <= WIRE_OK.max
  const nickOk = r.nick !== null && !r.nick.crossed && r.nick.len >= 2 && r.nick.len <= 7
  const kitOk = LUMENS.every((l) => r.flushed.includes(l.id)) && r.clamped.includes('medial') && r.clamped.includes('proximal') && !r.clamped.includes('distal')
  // Judged on the depth as read off the catheter at the skin: whole centimetres.
  const cm = Math.round(r.catheterCm)
  const cathOk = cm >= CATH_OK.min && cm <= CATH_OK.max
  const allLumens = LUMENS.every((l) => r.aspirated.includes(l.id) && r.flushedAfter.includes(l.id) && r.capped.includes(l.id))
  return [
    {
      key: 'position',
      label: 'Position and pre-scan',
      value: `${r.tilt.toFixed(0)}° head-down, head turned ${r.rotation.toFixed(0)}°; ${r.scanLevel === null ? 'no pre-scan' : `probe ${r.scanLevel === 'apex' ? 'at the apex of the triangle' : r.scanLevel === 'low' ? 'down by the clavicle' : 'up by the jaw'}`}${r.pressedFlat ? ', vein compressed' : ''}; named ${list(r.named)}`,
      range: `${TILT_OK.min}–${TILT_OK.max}° head-down, head turned only slightly (under ${ROTATION_MAX}°); the vein centred, lateral to the carotid, squashed flat by the probe`,
      ok: tiltOk && rotOk && scanOk && r.pressedFlat && r.named.includes('vein') && r.named.includes('artery'),
      why: 'Head-down fills the vein and keeps air out; turning the head far brings the vein over the carotid. Compression tells the vein from the artery.',
    },
    {
      key: 'asepsis',
      label: 'Full barrier precautions',
      value: `${r.garb.join(' → ') || 'nothing'}; chlorhexidine ${Math.round(r.prepCoverage * 100)}% covered, ${r.strokes} strokes${r.drapedWet ? ', draped while wet' : ''}; drape ${Math.round(r.draped * 100)}%; probe ${r.probeCover ? 'in a sterile sheath' : 'bare'}`,
      range: 'Cap and mask, scrub, sterile gown, sterile gloves; 2% chlorhexidine in 70% alcohol scrubbed 30 s and left to dry; a full-length drape; the probe in a sterile sheath',
      ok: garbOk && prepOk && !r.drapedWet && r.draped >= 0.95 && r.probeCover,
      why: 'Maximal barrier precautions and dry chlorhexidine are what cut line infections.',
    },
    {
      key: 'puncture',
      label: 'Real-time ultrasound venepuncture',
      value: `${r.lidocaine > 0 ? `${r.lidocaine.toFixed(0)} mL lidocaine` : 'no local'}; aimed ${r.entryX === null ? 'nowhere' : `${Math.abs(r.entryX).toFixed(1)} mm ${r.entryX > 0 ? 'lateral' : 'medial'} of centre`}; ${r.blindMm > 3 ? `${r.blindMm.toFixed(0)} mm advanced past the beam` : 'tip tracked'}; ${r.passes} pass${r.passes === 1 ? '' : 'es'}${r.arterial ? ', carotid punctured' : ''}${r.backWall ? ', through the back wall' : ''}`,
      range: 'Local first; the vein centred under the probe; slide the probe, advance to the dot, repeat; aspirate all the way and stop at the flash',
      ok: r.lidocaine >= 2 && aimOk && r.blindMm <= 3 && !r.arterial && !r.backWall && r.enteredAspirating && r.passes <= 2,
      why: 'The dot you see is only the tip if it vanishes when you slide the probe on. A tip you cannot see goes through the back wall, into the carotid.',
      critical: r.arterial,
    },
    {
      key: 'wire',
      label: 'Wire control and confirmation',
      value: `${r.steadied ? 'needle steadied' : 'needle not steadied'}; ${r.thumb ? `hub covered` : 'hub left open'}; wire ${r.wireCm.toFixed(0)} cm${r.ectopy ? ` (ectopics at ${r.wireMax.toFixed(0)} cm)` : ''} in the ${r.wireIn ?? 'tissue'}; ${r.letGo ? `let go of the wire ${r.letGo}×` : 'always held'}; seen ${[r.seenShort ? 'in short axis' : '', r.seenLong ? 'in long axis' : ''].filter(Boolean).join(' and ') || 'on ultrasound: no'}`,
      range: `Steady the needle, thumb on the hub, J-wire to ${WIRE_OK.min}–${WIRE_OK.max} cm (back off if ectopics), a hand on it at all times, seen in the vein in both axes before dilating`,
      ok: r.steadied && r.thumb && r.openSec <= 3 && wireOk && r.letGo === 0 && r.seenShort && r.seenLong,
      why: 'A wire let go of can be lost into the heart. A wire not seen in the vein may be in the carotid.',
      critical: r.letGo > 0,
    },
    {
      key: 'dilate',
      label: 'Nick, dilate, catheter',
      value: `lumens ${kitOk ? 'flushed, distal left open' : 'not ready'}; nick ${r.nick ? `${r.nick.len.toFixed(0)} mm${r.nick.crossed ? ', across the wire' : ''}` : 'none'}; dilated ${r.dilatorMax.toFixed(0)} mm${r.dilatedArtery ? ' INTO THE CAROTID' : ''}; ${r.hubGrip ? 'wire held at the brown hub' : 'wire not out of the hub'}; catheter at ${r.catheterCm.toFixed(0)} cm`,
      range: `Pre-flushed, distal open; a 4 mm stab beside the wire, edge away; dilator twisted in ${DILATE_OK.min}–${DILATE_OK.max} mm, to the vein only; wire out of the brown hub and held before the tip enters the skin; ${CATH_OK.min}–${CATH_OK.max} cm on the right`,
      ok: kitOk && nickOk && r.dilatorMax >= DILATE_OK.min && r.dilatorMax <= DILATE_OK.max && !r.dilatedArtery && r.hubGrip && cathOk,
      why: 'Dilating deeper than the vein tears it; a dilated carotid is a vascular emergency. Too deep a catheter sits in the atrium.',
      critical: r.dilatedArtery,
    },
    {
      key: 'secure',
      label: 'Wire out, flush, secure',
      value: `${r.wireOut ? (r.wireCounted ? 'wire out and shown whole' : 'wire out, not checked') : 'wire still in'}; aspirated ${list(r.aspirated)}, flushed ${list(r.flushedAfter)}; ${r.sutures} suture${r.sutures === 1 ? '' : 's'}; ${r.dressing ? 'dressing on' : 'no dressing'}`,
      range: 'Wire out and shown whole with its J tip; aspirate then flush every lumen, cap or clamp it; suture both wings; chlorhexidine dressing',
      ok: r.wireOut && r.wireCounted && allLumens && r.sutures >= 2 && r.dressing,
      why: 'A retained guidewire is a never event. Blood back from every lumen proves the catheter is in the vein.',
      critical: !r.wireOut,
    },
    {
      key: 'confirm',
      label: 'X-ray and record',
      value: `${r.tipSeen ? `tip ${tipZone(r.catheterCm) === 'junction' ? 'at the cavo-atrial junction' : tipZone(r.catheterCm) === 'atrium' ? 'in the right atrium' : 'high in the SVC'}` : 'tip not looked for'}; lungs checked: ${list(r.lungsChecked)}; ${r.documented ? 'documented' : 'not documented'}`,
      range: 'Tip at the cavo-atrial junction, no pneumothorax, before the line is used; record it all and the wire count',
      ok: r.tipSeen && tipZone(r.catheterCm) === 'junction' && r.lungsChecked.length === 2 && r.documented,
      why: 'Noradrenaline goes in only once the X-ray shows the tip in place and no pneumothorax.',
    },
  ]
}
