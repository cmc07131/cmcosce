/**
 * Great saphenous vein cut-down at the ankle (ATLS venous cut-down). Pure.
 *
 * Ankle view, 200 × 150, the right ankle from the medial side: knee to your left, foot to your right, front of the
 * leg at the top. 10 units to the centimetre. The vein passes 1–2 cm in front of and above the medial malleolus.
 *
 * Field view, 200 × 120, inside the incision: the vein runs left (toward the knee) to right (toward the foot);
 * the saphenous nerve lies beside it. Fat hides both until you spread it.
 */

export type Pt = { x: number; y: number }

export const MALLEOLUS: Pt = { x: 132, y: 100 }
export const LANDMARK: Pt = { x: 120, y: 80 }
/** The vein on the ankle view, as a line. */
export const VEIN_LINE = { a: { x: 20, y: 74 }, b: { x: 190, y: 84 } }
export const FIELD = { veinY: 58, veinR: 8, nerveY: 76, nerveR: 2.5 }

export type Structure = 'vein' | 'nerve' | 'fat'
export type Ligature = 'distal' | 'proximal'

export type CutdownRun = {
  mark: Pt | null
  cleaned: number
  local: boolean
  tourniquet: boolean
  incision: { from: Pt; to: Pt } | null
  deep: boolean
  spread: number
  spreadAcross: number
  lifted: Structure | null
  liftedNerve: boolean
  ligatures: Ligature[]
  tied: Ligature[]
  tiedProximalEarly: boolean
  venotomy: number | null
  transected: boolean
  cannula: 'proximal' | 'distal' | null
  secured: boolean
  fluids: boolean
  released: boolean
  closed: boolean
  dressed: boolean
}

export function freshCutdown(): CutdownRun {
  return {
    mark: null,
    cleaned: 0,
    local: false,
    tourniquet: false,
    incision: null,
    deep: false,
    spread: 0,
    spreadAcross: 0,
    lifted: null,
    liftedNerve: false,
    ligatures: [],
    tied: [],
    tiedProximalEarly: false,
    venotomy: null,
    transected: false,
    cannula: null,
    secured: false,
    fluids: false,
    released: false,
    closed: false,
    dressed: false,
  }
}

export const cmFrom = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) / 10

/** The incision against the vein: its length (cm), angle to the vein (degrees, 90 is transverse), and whether it crosses it. */
export function judgeIncision(from: Pt, to: Pt) {
  const v = { x: VEIN_LINE.b.x - VEIN_LINE.a.x, y: VEIN_LINE.b.y - VEIN_LINE.a.y }
  const c = { x: to.x - from.x, y: to.y - from.y }
  const cos = Math.abs(v.x * c.x + v.y * c.y) / (Math.hypot(v.x, v.y) * Math.hypot(c.x, c.y) || 1)
  const angle = (Math.acos(Math.min(1, cos)) * 180) / Math.PI
  const side = (p: Pt) => Math.sign((v.x * (p.y - VEIN_LINE.a.y) - v.y * (p.x - VEIN_LINE.a.x)) / Math.hypot(v.x, v.y))
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  return { length: cmFrom(from, to), angle, crosses: side(from) !== side(to), nearLandmark: cmFrom(mid, LANDMARK) <= 1.2 }
}

/** What a tap in the field picks up, once the fat over it has been spread. */
export function structureAt(p: Pt, spread: number): Structure {
  if (spread < 0.6) return 'fat'
  if (Math.abs(p.y - FIELD.nerveY) <= FIELD.nerveR + 3) return 'nerve'
  if (Math.abs(p.y - FIELD.veinY) <= FIELD.veinR + 2) return 'vein'
  return 'fat'
}

export const CUTDOWN_MARKS = ['landmark', 'prep', 'incision', 'dissect', 'ligatures', 'venotomy', 'secure', 'close'] as const
export type CutdownRow = { key: (typeof CUTDOWN_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkCutdown(r: CutdownRun): CutdownRow[] {
  const inc = r.incision ? judgeIncision(r.incision.from, r.incision.to) : null
  const markCm = r.mark ? cmFrom(r.mark, LANDMARK) : null
  const ligOk = r.ligatures.includes('distal') && r.ligatures.includes('proximal') && r.tied.includes('distal') && !r.tiedProximalEarly
  return [
    { key: 'landmark', label: 'Landmark', value: markCm === null ? 'Not marked' : markCm <= 0.8 ? '1–2 cm in front of and above the malleolus' : `${markCm.toFixed(1)} cm off`, range: '1–2 cm anterior and superior to the medial malleolus', ok: markCm !== null && markCm <= 0.8, why: 'The great saphenous vein is reliably there, even when you cannot see it in a shocked patient.' },
    { key: 'prep', label: 'Prepare', value: [r.cleaned >= 0.7 && 'cleaned', r.local && 'local', r.tourniquet && 'tourniquet'].filter(Boolean).join(', ') || 'None', range: 'Clean and drape; local if he is conscious; a venous tourniquet above', ok: r.cleaned >= 0.7 && r.local && r.tourniquet, why: 'The tourniquet fills the vein so you can find it.' },
    { key: 'incision', label: 'Incision', value: inc ? `${inc.angle >= 60 ? 'Transverse' : 'Along the vein'}, ${inc.length.toFixed(1)} cm${r.deep ? ', cut straight down to bone' : ', skin only'}` : 'None', range: 'Transverse, about 2.5 cm, through the skin only, across the vein', ok: !!inc && inc.angle >= 60 && inc.length >= 1.8 && inc.length <= 3.5 && inc.crosses && !r.deep, why: 'A longitudinal or deep cut transects the vein and the nerve beside it.', critical: r.deep && r.transected },
    { key: 'dissect', label: 'Dissection', value: `${r.spread >= 0.6 ? 'Fat spread bluntly' : 'Not dissected'}; lifted ${r.lifted ?? 'nothing'}${r.liftedNerve ? ' (picked up the nerve first)' : ''}`, range: 'Blunt spreading in the line of the vein; lift the vein, not the nerve', ok: r.lifted === 'vein' && !r.liftedNerve && r.spread >= 0.6, why: 'The saphenous nerve is the white strand beside the vein: solid, it does not fill.' },
    { key: 'ligatures', label: 'Ligatures', value: `${r.ligatures.length} passed, ${r.tied.length ? `${r.tied.join(' and ')} tied` : 'none tied'}${r.tiedProximalEarly ? ' (proximal tied before the cannula)' : ''}`, range: 'Two ligatures under the vein; tie the distal one, leave it long', ok: ligOk, why: 'The distal tie stops back-bleeding and gives traction; tie the proximal one around the cannula.' },
    { key: 'venotomy', label: 'Venotomy and cannula', value: r.transected ? 'Vein cut through' : r.venotomy === null ? 'No venotomy' : `${Math.round(r.venotomy * 100)}% across; cannula ${r.cannula ?? 'not in'}`, range: 'A small transverse nick, about a third across; cannula toward the heart', ok: !r.transected && r.venotomy !== null && r.venotomy <= 0.55 && r.cannula === 'proximal', why: 'Too big a cut and the vein retracts; pointing distally the fluid goes to the foot.', critical: r.cannula === 'distal' },
    { key: 'secure', label: 'Secure', value: [r.secured && 'proximal tied round the cannula', r.fluids && 'fluids connected', r.released && 'tourniquet off'].filter(Boolean).join(', ') || 'Nothing', range: 'Tie the proximal ligature over the cannula, connect the fluids, release the tourniquet', ok: r.secured && r.fluids && r.released, why: 'With the tourniquet on, nothing runs.' },
    { key: 'close', label: 'Close', value: [r.closed && 'skin closed', r.dressed && 'dressed'].filter(Boolean).join(', ') || 'Open', range: 'Close the skin, dress it', ok: r.closed && r.dressed, why: 'The cannula must not pull out on the way to theatre.' },
  ]
}
