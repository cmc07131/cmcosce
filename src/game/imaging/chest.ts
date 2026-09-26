import { Field } from './field'

/**
 * Frontal chest radiograph, 128×128, conventional orientation: the patient's right is on the image left.
 * Built from anatomy (lungs, hila, mediastinum, heart, diaphragms, ribs, clavicles, spine), then the
 * pathology is applied to that anatomy: a pneumothorax collapses the lung toward the hilum, tension
 * pushes the mediastinum away, fluid fills from the base with a meniscus, and so on.
 */

export type Side = 'R' | 'L'

export type ChestSpec = {
  view?: 'PA' | 'AP'
  ptx?: { side: Side; size: 'small' | 'large'; tension?: boolean }
  fluid?: { side: Side; level: number; supine?: boolean }
  consolidation?: { side: Side; zone: 'upper' | 'middle' | 'lower' }
  oedema?: boolean
  cardiomegaly?: boolean
  freeAir?: boolean
  wideMediastinum?: boolean
  ribFractures?: { side: Side; ribs: number[] }
  ett?: 'good' | 'right-main'
  drain?: Side
  hyperinflated?: boolean
  surgicalEmphysema?: Side
}

const W = 128
const H = 128
const MID = 64

/** The shift of the mediastinum in pixels: positive moves it toward the image right (patient's left). */
function shiftOf(s: ChestSpec) {
  if (s.ptx?.tension) return s.ptx.side === 'R' ? 11 : -11
  if (s.fluid && s.fluid.level > 0.75 && !s.fluid.supine) return s.fluid.side === 'R' ? 7 : -7
  return 0
}

/** Outline of a hemithorax's aerated lung. `m` is the medial border x at heart level. */
function lungOutline(side: Side, shift: number, s: ChestSpec): [number, number][] {
  const infl = s.hyperinflated ? 8 : 0
  const baseR = 92 + infl
  const baseL = 96 + infl
  const flatten = (d: Side) => (s.ptx?.tension && s.ptx.side === d ? 7 : 0)
  if (side === 'R') {
    const m = 52 + shift
    const b = baseR + flatten('R')
    return [
      [42, 14],
      [34, 16],
      [26, 24],
      [20, 38],
      [17, 56],
      [16, 74],
      [17, 88],
      [19, b + 2],
      [26, b - 2],
      [36, b - 6],
      [46, b - 6],
      [m, b - 2],
      [m, 58],
      [m + 2, 44],
      [m + 2, 20],
      [48, 14],
    ]
  }
  const m = 76 + shift
  const b = baseL + flatten('L')
  const heartEdge = s.cardiomegaly ? 104 : 92
  return [
    [86, 14],
    [94, 16],
    [102, 24],
    [108, 38],
    [111, 56],
    [112, 74],
    [111, 90],
    [109, b + 2],
    [104, b - 2],
    [heartEdge + shift + 2, b - 3],
    [heartEdge + shift - 4, 80],
    [m + 6, 60],
    [m, 44],
    [m - 2, 20],
    [80, 14],
  ]
}

function hilum(side: Side, shift: number): [number, number] {
  return side === 'R' ? [49 + shift, 54] : [80 + shift, 56]
}

/** Shrink an outline toward a point: the collapsed lung of a pneumothorax. */
function toward(points: [number, number][], c: [number, number], k: number): [number, number][] {
  return points.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k])
}

function markings(f: Field, side: Side, shift: number, s: ChestSpec, seed: number) {
  const [hx, hy] = hilum(side, shift)
  const dir = side === 'R' ? -1 : 1
  let h = seed * 7919
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h >>> 0) / 4294967296
  }
  const upper = s.oedema ? 1.6 : 1
  const branch = (x: number, y: number, ang: number, len: number, width: number, depth: number) => {
    const x2 = x + Math.cos(ang) * len
    const y2 = y + Math.sin(ang) * len
    const gain = (y2 < hy ? upper : 1) * 0.1 * width
    f.line(x, y, x2, y2, width, gain, 'add', 0.6)
    if (depth <= 0) return
    branch(x2, y2, ang - 0.35 - rnd() * 0.2, len * 0.72, width * 0.72, depth - 1)
    branch(x2, y2, ang + 0.35 + rnd() * 0.2, len * 0.72, width * 0.72, depth - 1)
  }
  const fan = side === 'R' ? [Math.PI + 0.9, Math.PI + 0.4, Math.PI, Math.PI - 0.5, Math.PI - 0.95] : [-0.9, -0.4, 0, 0.5, 0.95]
  for (const a of fan) branch(hx, hy, a + (rnd() - 0.5) * 0.15, 10, 1.6, 3)
  f.ellipse(hx + dir * 1, hy, 4, 6, 0.12, 'add', 2)
}

export function chest(s: ChestSpec = {}, seed = 1): Field {
  const f = new Field(W, H, 0.03)
  const shift = shiftOf(s)

  // Soft tissue of neck, shoulders, trunk and upper abdomen.
  f.poly(
    [
      [50, 0],
      [78, 0],
      [80, 10],
      [104, 12],
      [122, 16],
      [126, 40],
      [124, 128],
      [4, 128],
      [2, 40],
      [6, 16],
      [24, 12],
      [48, 10],
    ],
    0.42,
    'set',
    2,
  )

  // Aerated lungs.
  const lungs: Record<Side, [number, number][]> = { R: lungOutline('R', shift, s), L: lungOutline('L', shift, s) }
  for (const side of ['R', 'L'] as Side[]) f.poly(lungs[side], s.hyperinflated ? 0.08 : 0.13, 'set', 1.5)
  for (const side of ['R', 'L'] as Side[]) markings(f, side, shift, s, seed + (side === 'R' ? 1 : 2))

  // Pneumothorax: no markings beyond the visceral pleural line; the lung shrinks toward the hilum.
  if (s.ptx) {
    const side = s.ptx.side
    const k = s.ptx.tension ? 0.32 : s.ptx.size === 'large' ? 0.55 : 0.86
    const shrunk = toward(lungs[side], hilum(side, shift), k)
    const saved = new Field(W, H)
    saved.d.set(f.d)
    f.poly(lungs[side], 0.035, 'set', 1)
    // Copy the collapsed lung back, a little denser because it holds less air.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (inPoly(shrunk, x + 0.5, y + 0.5)) f.d[i] = saved.d[i] + (s.ptx.tension ? 0.14 : 0.05)
      }
    }
    // The visceral pleural line.
    f.path([...shrunk, shrunk[0]], 0.8, 0.46, 'max', 0.5)
  }

  // Heart and mediastinum.
  const heartL = (s.cardiomegaly ? 104 : 92) + shift
  const heartR = (s.cardiomegaly ? 46 : 52) + shift
  f.poly(
    [
      [heartR + 2, 58],
      [heartR, 70],
      [heartR, 86],
      [heartR + 4, 96],
      [MID + shift, 100],
      [heartL - 6, 99],
      [heartL, 94],
      [heartL + 1, 84],
      [heartL - 6, 70],
      [MID + 12 + shift, 58],
    ],
    0.6,
    'set',
    1.5,
  )
  const medR = (s.wideMediastinum ? 45 : 54) + shift
  const medL = (s.wideMediastinum ? 84 : 75) + shift
  f.poly(
    [
      [medR, 12],
      [medL, 12],
      [medL + (s.wideMediastinum ? 0 : 1), 34],
      [medL - 1, 56],
      [medR + 1, 58],
      [medR, 34],
    ],
    0.58,
    'set',
    1.5,
  )
  if (!s.wideMediastinum) f.ellipse(77 + shift, 38, 5, 5, 0.6, 'set', 1)
  else f.ellipse(94 + shift / 2, 18, 8, 5, 0.52, 'set', 3)

  // Trachea and main bronchi (air columns).
  const tx = MID + shift - (s.wideMediastinum ? 3 : 0)
  f.line(tx, 0, tx, 44, 5, 0.18, 'set', 1)
  f.line(tx, 44, 50 + shift, 54, 3.5, 0.18, 'set', 1)
  f.line(tx, 44, 79 + shift, s.wideMediastinum ? 60 : 56, 3, 0.18, 'set', 1)

  // Spine, faintly through the mediastinum and the upper abdomen: a column with its disc spaces.
  const sx = MID + shift * 0.3
  f.line(sx, 4, sx, 126, 11, 0.07, 'add', 1.5)
  for (let v = 0; v < 13; v++) f.line(sx - 5, 8 + v * 9.5, sx + 5, 8 + v * 9.5, 1, -0.04, 'add', 0.5)

  // Diaphragms and upper abdomen.
  const infl = s.hyperinflated ? 8 : 0
  f.curve([16, 96 + infl], [36, 82 + infl], [58, 92 + infl], 1, 0.45, 'max')
  f.curve([72, 96 + infl], [92, 86 + infl], [112, 100 + infl], 1, 0.45, 'max')
  f.ellipse(88, 106 + infl, 7, 4, 0.14, 'set', 1.5)

  // Free gas under the right hemidiaphragm: a dark crescent above the liver, with the thin diaphragm on top.
  if (s.freeAir) {
    f.poly(
      [
        [24, 96],
        [34, 88],
        [48, 88],
        [56, 94],
        [48, 97],
        [34, 96],
      ],
      0.06,
      'set',
      0.8,
    )
    f.curve([22, 94], [36, 80], [56, 92], 1.6, 0.62, 'max', 0.4)
  }

  // Fluid in the pleural space.
  if (s.fluid) {
    const side = s.fluid.side
    const outline = lungs[side]
    const ys = outline.map((p) => p[1])
    const top = Math.min(...ys)
    const bottom = Math.max(...ys)
    if (s.fluid.supine) {
      f.poly(outline, 0.22 * Math.min(1, s.fluid.level * 1.3), 'add', 3)
    } else {
      const level = bottom - (bottom - top) * s.fluid.level
      const lateral = side === 'R' ? Math.min(...outline.map((p) => p[0])) : Math.max(...outline.map((p) => p[0]))
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!inPoly(outline, x + 0.5, y + 0.5)) continue
          // Meniscus: the surface climbs toward the lateral chest wall.
          const lat = 1 - Math.min(1, Math.abs(x - lateral) / 30)
          const surface = level - lat * lat * 10
          if (y > surface) f.d[y * W + x] = Math.max(f.d[y * W + x], 0.6)
        }
      }
    }
  }

  // Consolidation with air bronchograms.
  if (s.consolidation) {
    const { side, zone } = s.consolidation
    const cx = side === 'R' ? 32 : 98
    const cy = zone === 'upper' ? 32 : zone === 'middle' ? 72 : 86
    const [hx, hy] = hilum(side, shift)
    if (zone === 'middle') f.ellipse(side === 'R' ? 42 + shift : 88, 76, 12, 10, 0.55, 'max', 3)
    else f.ellipse(cx, cy, 15, 12, 0.55, 'max', 3)
    const bx = zone === 'middle' ? (side === 'R' ? 42 : 88) : cx
    for (const a of [-0.4, 0, 0.4]) {
      const ang = Math.atan2(cy - hy, bx - hx) + a
      f.line(hx + Math.cos(ang) * 8, hy + Math.sin(ang) * 8, hx + Math.cos(ang) * 22, hy + Math.sin(ang) * 22, 1.2, 0.3, 'min', 0.4)
    }
  }

  // Pulmonary oedema: perihilar bat-wing haze, Kerley B lines, blunted angles.
  if (s.oedema) {
    f.ellipse(44 + shift, 60, 16, 20, 0.2, 'add', 8)
    f.ellipse(84 + shift, 62, 16, 20, 0.2, 'add', 8)
    for (let k = 0; k < 4; k++) {
      f.line(17, 78 + k * 3, 22, 78 + k * 3, 0.8, 0.12, 'add', 0.3)
      f.line(106, 80 + k * 3, 111, 80 + k * 3, 0.8, 0.12, 'add', 0.3)
    }
    f.poly(
      [
        [16, 86],
        [26, 92],
        [16, 94],
      ],
      0.55,
      'max',
      1.5,
    )
    f.poly(
      [
        [112, 90],
        [102, 96],
        [112, 98],
      ],
      0.55,
      'max',
      1.5,
    )
  }

  // Surgical emphysema: streaky gas in the soft tissue of the chest wall and neck.
  if (s.surgicalEmphysema) {
    const x0 = s.surgicalEmphysema === 'R' ? 4 : 112
    for (let k = 0; k < 14; k++) f.line(x0 + (k % 3) * 3, 12 + k * 5, x0 + 6 + (k % 3) * 3, 14 + k * 5, 0.9, 0.12, 'min', 0.3)
  }

  // Ribs over everything: posterior ribs from the spine, anterior ribs fainter.
  const spacingFor = (side: Side) => (s.ptx?.tension && s.ptx.side === side ? 8.6 : s.hyperinflated ? 8.4 : 7.6)
  for (const side of ['R', 'L'] as Side[]) {
    const dir = side === 'R' ? -1 : 1
    const sp = spacingFor(side)
    for (let i = 0; i < 10; i++) {
      const y = 14 + i * sp
      const x0 = MID + dir * 6
      const broken = s.ribFractures?.side === side && s.ribFractures.ribs.includes(i + 1)
      if (broken) {
        // A cortical break with a step: the lateral fragment sits lower.
        const mid: [number, number] = [MID + dir * 40, y - 2]
        f.curve([x0, y], [MID + dir * 26, y - 8], mid, 2, 0.13, 'add', 0.7)
        f.curve([mid[0] + dir * 3, mid[1] + 3], [MID + dir * 52, y + 1], [MID + dir * 50, y + 11], 2, 0.13, 'add', 0.7)
      } else {
        f.curve([x0, y], [MID + dir * 34, y - 9], [MID + dir * 49, y + 8], 2, 0.13, 'add', 0.7)
      }
      f.curve([MID + dir * 47, y + 4], [MID + dir * 32, y + 10], [MID + dir * 14, y + 20], 1.4, 0.06, 'add', 0.6)
    }
    // Clavicle.
    f.curve([MID + dir * 6, 16], [MID + dir * 22, 11], [MID + dir * 44, 10], 3, 0.3, 'add', 0.8)
    // Humeral head at the edge.
    f.ellipse(MID + dir * 60, 18, 7, 8, 0.72, 'max', 1.5)
    // Scapular edge.
    f.curve([MID + dir * 50, 16], [MID + dir * 52, 36], [MID + dir * 46, 56], 1, 0.08, 'add', 0.5)
  }

  // Lines and tubes.
  if (s.ett) {
    // A good tip sits about 5 cm above the carina (row 44; ~0.3 cm per pixel).
    const tipY = s.ett === 'good' ? 28 : 56
    const endX = s.ett === 'good' ? tx : 50 + shift
    const bend = Math.min(tipY, 38)
    f.line(tx, 0, tx, bend, 1.4, 0.95, 'max', 0.4)
    if (tipY > bend) f.line(tx, bend, endX, tipY, 1.4, 0.95, 'max', 0.4)
  }
  if (s.drain) {
    const dir = s.drain === 'R' ? -1 : 1
    f.path(
      [
        [MID + dir * 60, 70],
        [MID + dir * 44, 66],
        [MID + dir * 34, 44],
        [MID + dir * 30, 26],
      ],
      1.6,
      0.95,
      'max',
      0.4,
    )
  }

  f.grain(0.05, seed)
  return f
}

export function inPoly(pts: [number, number][], x: number, y: number) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Where the trachea is on a row: the darkest column with bright mediastinum on both sides. Tests use it. */
export function tracheaX(f: Field, y: number) {
  let best = MID
  let low = Infinity
  for (let x = MID - 20; x <= MID + 20; x++) {
    if (f.mean(x - 6, y - 1, x - 5, y + 1) < 0.4 || f.mean(x + 5, y - 1, x + 6, y + 1) < 0.4) continue
    const v = f.mean(x - 1, y - 1, x + 1, y + 1)
    if (v < low) {
      low = v
      best = x
    }
  }
  return best
}
