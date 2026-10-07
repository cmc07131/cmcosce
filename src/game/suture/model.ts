/**
 * Repair of a V-shaped flap laceration on the shin (RCEM wound care; standard suturing). Pure.
 *
 * The skin is 200 × 140, 20 units to the centimetre. The flap tip (the apex of the V) points right, at A; its base
 * is attached along B1–B2. The wound is the two arms A–B1 and A–B2.
 */

export type Pt = { x: number; y: number }

export const CM = 20
export const A: Pt = { x: 140, y: 70 }
export const B1: Pt = { x: 90, y: 40 }
export const B2: Pt = { x: 90, y: 100 }
export const ARMS = [
  [A, B1],
  [A, B2],
] as const
/** Bite from the edge (aim 3.5–6 mm; 3–6.5 mm passes), and spacing between stitches (4–7 mm). 2 units = 1 mm. */
export const BITE = { min: 6, max: 13 }
export const GAP = { min: 8, max: 15 }
/** Near the tip is the corner stitch's job. */
export const TIP_ZONE = 10

export const FOREIGN: Pt = { x: 112, y: 62 }
export const TAG: Pt = { x: 100, y: 96 }

const sub = (a: Pt, b: Pt) => ({ x: a.x - b.x, y: a.y - b.y })
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y
const len = (a: Pt) => Math.hypot(a.x, a.y)

/** Signed distance of p from the line through a→b, and how far along it (0–1) the foot of the perpendicular lies. */
export function fromLine(p: Pt, a: Pt, b: Pt) {
  const ab = sub(b, a)
  const L = len(ab)
  const t = dot(sub(p, a), ab) / (L * L)
  const cross = (ab.x * (p.y - a.y) - ab.y * (p.x - a.x)) / L
  return { t, d: cross, along: t * L }
}

/** Is p inside the flap (the triangle A, B1, B2)? */
export function inFlap(p: Pt) {
  const s = (p1: Pt, p2: Pt, p3: Pt) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  const d1 = s(p, A, B1)
  const d2 = s(p, B1, B2)
  const d3 = s(p, B2, A)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

/** Distance from p to the nearest wound edge (either arm), in units. */
export function toEdge(p: Pt) {
  return Math.min(
    ...ARMS.map(([a, b]) => {
      const f = fromLine(p, a, b)
      const t = Math.max(0, Math.min(1, f.t))
      const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      return Math.hypot(p.x - q.x, p.y - q.y)
    }),
  )
}

export type Stitch = { arm: 0 | 1; along: number; d1: number; d2: number; angle: number; ok: boolean; why: string | null }

/** Judge a stitch dragged from p to q across one arm of the wound. */
export function judgeStitch(p: Pt, q: Pt): Stitch | null {
  for (const arm of [0, 1] as const) {
    const [a, b] = ARMS[arm]
    const fp = fromLine(p, a, b)
    const fq = fromLine(q, a, b)
    if (Math.sign(fp.d) === Math.sign(fq.d)) continue
    const along = (fp.along * Math.abs(fq.d) + fq.along * Math.abs(fp.d)) / (Math.abs(fp.d) + Math.abs(fq.d))
    const L = len(sub(b, a))
    if (along < -2 || along > L + 2) continue
    const pq = sub(q, p)
    const n = { x: -(b.y - a.y) / L, y: (b.x - a.x) / L }
    const angle = (Math.acos(Math.min(1, Math.abs(dot(pq, n)) / len(pq))) * 180) / Math.PI
    const d1 = Math.abs(fp.d)
    const d2 = Math.abs(fq.d)
    let why: string | null = null
    if (along < TIP_ZONE) why = 'Through the flap tip: that strangles its blood supply. The tip needs a corner stitch.'
    else if (Math.min(d1, d2) < BITE.min) why = 'Too close to the edge: it will cut out.'
    else if (Math.max(d1, d2) > BITE.max) why = 'Too wide a bite: it bunches and puckers the skin.'
    else if (Math.abs(d1 - d2) > 5) why = 'Uneven bites: the edges will sit at different heights.'
    else if (angle > 30) why = 'Not at right angles to the wound: the edges slide past each other.'
    return { arm, along, d1, d2, angle, ok: why === null, why }
  }
  return null
}

/** Gaps along each arm, from the tip zone to the end. */
export function gaps(stitches: Stitch[]) {
  return ([0, 1] as const).map((arm) => {
    const [a, b] = ARMS[arm]
    const L = len(sub(b, a))
    const xs = stitches.filter((s) => s.arm === arm && s.along >= TIP_ZONE - 2).map((s) => s.along).sort((x, y) => x - y)
    const all = [TIP_ZONE - 4, ...xs, L]
    const g: number[] = []
    for (let i = 1; i < all.length; i++) g.push(all[i] - all[i - 1])
    return { count: xs.length, maxGap: Math.max(...g), minGap: Math.min(...g.slice(1, -1), 99) }
  })
}

export type CornerKind = 'half-buried' | 'transfixing'

export type SutureRun = {
  flapLooked: boolean
  distal: boolean
  history: boolean
  cleaned: number
  edges: number[]
  throughSkin: number
  lidoMl: number
  tested: boolean
  irrigatedMl: number
  lifted: boolean
  foreignOut: boolean
  tagTrimmed: boolean
  tipTrimmed: boolean
  corner: CornerKind | null
  cornerOk: boolean
  holder: 'instrument' | 'fingers' | null
  stitches: Stitch[]
  /** The suture needle, and the lidocaine needle, in the sharps bin. */
  sharps: boolean
  lidoSharps: boolean
  dressed: boolean
}

export function freshSuture(): SutureRun {
  return {
    flapLooked: false,
    distal: false,
    history: false,
    cleaned: 0,
    edges: [],
    throughSkin: 0,
    lidoMl: 0,
    tested: false,
    irrigatedMl: 0,
    lifted: false,
    foreignOut: false,
    tagTrimmed: false,
    tipTrimmed: false,
    corner: null,
    cornerOk: false,
    holder: null,
    stitches: [],
    sharps: false,
    lidoSharps: false,
    dressed: false,
  }
}

/** Edge infiltration: the wound edges split into 12 segments (6 per arm). */
export const EDGE_SEGMENTS = 12
export function edgeSegment(p: Pt): number | null {
  for (const arm of [0, 1] as const) {
    const [a, b] = ARMS[arm]
    const f = fromLine(p, a, b)
    if (Math.abs(f.d) <= 6 && f.t >= 0 && f.t <= 1) return arm * 6 + Math.min(5, Math.floor(f.t * 6))
  }
  return null
}

export const SUTURE_MARKS = ['assess', 'infiltrate', 'irrigate', 'explore', 'corner', 'interrupted', 'sharps'] as const
export type SutureRow = { key: (typeof SUTURE_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkSuture(r: SutureRun): SutureRow[] {
  const g = gaps(r.stitches)
  const good = r.stitches.filter((s) => s.ok).length
  const closed = g.every((x) => x.count >= 2 && x.maxGap <= GAP.max + 4)
  return [
    { key: 'assess', label: 'Neurovascular and flap', value: [r.flapLooked ? 'flap tip pressed: pink, refills' : 'flap not checked', r.distal ? 'foot: pulses, sensation, movement' : 'foot not checked'].join('; '), range: 'Both: the flap tip (colour, capillary refill) and the foot (pulses, sensation, movement)', ok: r.flapLooked && r.distal, why: 'A dusky flap or a poor foot changes the plan: pretibial skin in older people heals badly.' },
    { key: 'infiltrate', label: 'Local anaesthetic', value: `${r.edges.length}/${EDGE_SEGMENTS} of the edges, ${r.lidoMl.toFixed(1)} mL 1%${r.throughSkin ? `; ${r.throughSkin}× through intact skin` : ''}`, range: 'Through the wound edges, all the way round', ok: r.edges.length >= EDGE_SEGMENTS - 1 && r.throughSkin === 0, why: 'Going in through the cut edge hurts far less than through intact skin.' },
    { key: 'irrigate', label: 'Test and irrigate', value: `${r.tested ? (r.edges.length >= EDGE_SEGMENTS - 1 ? 'Numb when tested' : 'Tested: still sore in places') : 'Not tested'}; ${r.irrigatedMl.toFixed(0)} mL saline`, range: 'Test the anaesthesia; irrigate with 100 mL or more under pressure', ok: r.tested && r.irrigatedMl >= 100, why: 'Irrigation under pressure is what prevents infection; a few squirts do not.' },
    { key: 'explore', label: 'Explore and debride', value: [r.lifted ? 'flap lifted' : 'flap never lifted', r.foreignOut ? 'metal fragment removed' : 'metal fragment missed', r.tagTrimmed ? 'dead tag trimmed' : 'dead tag left', r.tipTrimmed && 'healthy tip cut off'].filter(Boolean).join(', '), range: 'Lift the flap, remove the foreign body, trim only what is dead', ok: r.foreignOut && r.tagTrimmed && !r.tipTrimmed, why: 'A retained metal fragment from a building site guarantees infection. A pink tip is alive: keep it.' },
    { key: 'corner', label: 'Corner stitch', value: r.corner === 'transfixing' ? 'Straight through the tip' : r.cornerOk ? 'Half-buried horizontal mattress' : r.corner ? 'Misplaced' : 'None', range: 'Half-buried horizontal mattress: through the dermis of the tip, skin on the other side', ok: r.cornerOk && r.corner === 'half-buried', why: 'A stitch through the full thickness of the tip strangles its blood supply.' },
    { key: 'interrupted', label: 'Interrupted sutures', value: `${r.stitches.length} placed, ${good} well; ${closed ? 'both edges closed' : 'gaps left'}${r.holder === 'fingers' ? '; needle handled by hand' : ''}`, range: 'Bites 3.5–6 mm, square to the wound, 4–7 mm apart, edges closed', ok: r.stitches.length > 0 && good >= r.stitches.length * 0.8 && closed && r.holder === 'instrument', why: 'Even, square bites evert the edges; gaps leave the wound open; fingers on a needle mean a needlestick.' },
    { key: 'sharps', label: 'Sharps and dressing', value: `lidocaine needle ${r.lidoSharps ? 'binned' : 'left out'}, suture needle ${r.sharps ? 'binned' : 'left out'}, ${r.dressed ? 'dressed' : 'not dressed'}`, range: 'Each needle into the sharps bin by you, as soon as you are done with it; non-adherent dressing', ok: r.sharps && r.lidoSharps && r.dressed, why: 'The person who used the sharp disposes of it, straight away.' },
  ]
}

/**
 * The corner stitch, drawn as a path: in through the skin beside one arm, through the dermis of the flap tip,
 * out through the skin beside the other arm.
 */
export function judgeCorner(path: Pt[]): boolean {
  if (path.length < 2) return false
  const s = path[0]
  const e = path[path.length - 1]
  const centre = { x: (A.x + B1.x + B2.x) / 3, y: (A.y + B1.y + B2.y) / 3 }
  const outside = (p: Pt, arm: 0 | 1) => {
    const [a, b] = ARMS[arm]
    return Math.sign(fromLine(p, a, b).d) !== Math.sign(fromLine(centre, a, b).d)
  }
  const nearA = (p: Pt) => Math.hypot(p.x - A.x, p.y - A.y) < 34
  const throughTip = path.some((p) => inFlap(p) && Math.hypot(p.x - A.x, p.y - A.y) < 18)
  const across = (outside(s, 0) && outside(e, 1)) || (outside(s, 1) && outside(e, 0))
  return across && nearA(s) && nearA(e) && throughTip && !inFlap(s) && !inFlap(e)
}
