import { Field } from './field'

/**
 * Non-contrast CT head, axial, brain window, radiological convention (patient's right on the image left,
 * anterior at the top). Acute blood is bright; CSF dark; bone white.
 *
 * Sutures are placed on the skull so an extradural haematoma can respect them (lens between the coronal
 * and lambdoid sutures) and a subdural can cross them (crescent along the whole hemisphere).
 */

export type HeadSpec = {
  slice?: 'ventricles' | 'basal'
  edh?: { side: 'R' | 'L' }
  sdh?: { side: 'R' | 'L'; acute?: boolean }
  sah?: boolean
  ich?: { side: 'R' | 'L' }
  infarct?: { side: 'R' | 'L' }
  fracture?: { side: 'R' | 'L' }
}

const CX = 64
const CY = 66
const RX = 44
const RY = 54
const BONE = 1
const BRAIN = 0.42
const WHITE = 0.37
const CSF = 0.14
const BLOOD = 0.76

/** Angles (radians from the image right, clockwise because y grows down) of the sutures on each side. */
export const SUTURES = {
  coronal: { R: (-150 * Math.PI) / 180, L: (-30 * Math.PI) / 180 },
  lambdoid: { R: (140 * Math.PI) / 180, L: (40 * Math.PI) / 180 },
}

/** A point on the inner table at angle `a`, `inset` pixels inward. */
export function onInner(a: number, inset = 0): [number, number] {
  return [CX + Math.cos(a) * (RX - 4 - inset), CY + Math.sin(a) * (RY - 4 - inset)]
}

/** The arc of the lateral convexity between one side's lambdoid and coronal sutures, as [from, to]. */
export function edhArc(side: 'R' | 'L'): [number, number] {
  return side === 'R' ? [SUTURES.lambdoid.R, SUTURES.coronal.R + Math.PI * 2] : [SUTURES.coronal.L, SUTURES.lambdoid.L]
}

function shiftOf(s: HeadSpec) {
  const side = s.edh?.side ?? s.sdh?.side ?? s.ich?.side
  if (!side) return 0
  const amount = s.edh ? 7 : s.sdh ? 6 : 4
  return side === 'R' ? amount : -amount
}

export function head(s: HeadSpec = {}, seed = 1): Field {
  const f = new Field(128, 128, 0)
  const basal = s.slice === 'basal'
  const shift = shiftOf(s)

  // Scalp, skull, then brain.
  f.ellipse(CX, CY, RX + 4, RY + 4, 0.34, 'set', 1)
  f.ellipse(CX, CY, RX, RY, BONE, 'set', 0.8)
  f.ellipse(CX, CY, RX - 4, RY - 4, BRAIN, 'set', 0.8)
  // Grey–white differentiation: white matter core.
  f.ellipse(CX + shift * 0.5, CY + 2, RX - 14, RY - 16, WHITE, 'set', 4)

  // Sutures: short dark gaps through the bone.
  for (const a of [SUTURES.coronal.R, SUTURES.coronal.L, SUTURES.lambdoid.R, SUTURES.lambdoid.L]) {
    const [x0, y0] = [CX + Math.cos(a) * (RX - 4.5), CY + Math.sin(a) * (RY - 4.5)]
    const [x1, y1] = [CX + Math.cos(a) * (RX + 0.5), CY + Math.sin(a) * (RY + 0.5)]
    f.line(x0, y0, x1, y1, 0.9, 0.5, 'set', 0.2)
  }

  // Cortical sulci: short, irregular dark clefts at the periphery.
  let h = seed * 40503
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h >>> 0) / 4294967296
  }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + rnd() * 0.12
    const depth = 3 + rnd() * 5
    const [x0, y0] = onInner(a, 1)
    const [xm, ym] = onInner(a + (rnd() - 0.5) * 0.08, depth * 0.6)
    const [x1, y1] = onInner(a + (rnd() - 0.5) * 0.12, depth)
    f.path(
      [
        [x0, y0],
        [xm, ym],
        [x1, y1],
      ],
      0.9,
      CSF + 0.1,
      'min',
      0.4,
    )
  }

  if (!basal) {
    // Lateral ventricles at body level, shifted and compressed by mass effect.
    const vx = CX + shift
    const squeezeR = s.edh?.side === 'R' || s.sdh?.side === 'R' ? 0.5 : 1
    const squeezeL = s.edh?.side === 'L' || s.sdh?.side === 'L' ? 0.5 : 1
    f.ellipse(vx - 5, CY - 12, 3.5 * squeezeR, 9, CSF, 'set', 0.8, 0.25)
    f.ellipse(vx + 5, CY - 12, 3.5 * squeezeL, 9, CSF, 'set', 0.8, -0.25)
    f.ellipse(vx - 7, CY + 8, 3 * squeezeR, 10, CSF, 'set', 0.8, -0.15)
    f.ellipse(vx + 7, CY + 8, 3 * squeezeL, 10, CSF, 'set', 0.8, 0.15)
    f.ellipse(vx - 10, CY + 20, 3 * squeezeR, 5, CSF, 'set', 0.8, -0.6)
    f.ellipse(vx + 10, CY + 20, 3 * squeezeL, 5, CSF, 'set', 0.8, 0.6)
  } else {
    // Basal cisterns around the midbrain, and the Sylvian fissures.
    f.poly(
      [
        [CX, CY - 22],
        [CX + 12, CY - 10],
        [CX + 9, CY + 8],
        [CX - 9, CY + 8],
        [CX - 12, CY - 10],
      ],
      s.sah ? BLOOD : CSF,
      'set',
      1,
    )
    f.ellipse(CX, CY + 2, 8, 7, BRAIN, 'set', 1)
    f.line(CX - 12, CY - 10, CX - 30, CY - 16, 2, s.sah ? BLOOD : CSF, 'set', 0.6)
    f.line(CX + 12, CY - 10, CX + 30, CY - 16, 2, s.sah ? BLOOD : CSF, 'set', 0.6)
    // Orbits' roofs and the petrous bones intrude at the front and sides.
    f.ellipse(CX - 14, CY - 44, 8, 5, BONE, 'set', 1)
    f.ellipse(CX + 14, CY - 44, 8, 5, BONE, 'set', 1)
    f.line(CX - 30, CY + 18, CX - 10, CY + 28, 3, BONE, 'set', 0.8)
    f.line(CX + 30, CY + 18, CX + 10, CY + 28, 3, BONE, 'set', 0.8)
  }

  // Falx: bright midline line, bowed away from a mass.
  f.curve([CX, CY - RY + 5], [CX + shift * 1.6, CY], [CX, CY + RY - 5], 0.9, 0.62, 'set', 0.4)

  if (s.sah) {
    // Blood in the interhemispheric fissure and the sulci.
    f.curve([CX, CY - RY + 6], [CX + shift, CY - 20], [CX, CY - 10], 1.6, BLOOD, 'set', 0.4)
    for (let i = 0; i < 26; i += 2) {
      const a = (i / 26) * Math.PI * 2 + 0.1
      const [x0, y0] = onInner(a, 1)
      const [x1, y1] = onInner(a + 0.03, 6)
      f.line(x0, y0, x1, y1, 1.1, BLOOD, 'set', 0.4)
    }
  }

  if (s.edh) {
    // Biconvex lens under the temporoparietal bone, confined between the coronal and lambdoid sutures:
    // the dura is stuck down at the sutures, so the bleed cannot spread past them.
    const [lo, hi] = edhArc(s.edh.side)
    const pts: [number, number][] = []
    const n = 24
    const a0 = lo + 0.1
    const a1 = hi - 0.1
    for (let i = 0; i <= n; i++) pts.push(onInner(a0 + ((a1 - a0) * i) / n, -0.5))
    for (let i = n; i >= 0; i--) pts.push(onInner(a0 + ((a1 - a0) * i) / n, 0.4 + 12 * Math.sin((Math.PI * i) / n)))
    f.poly(pts, BLOOD, 'set', 0.8)
  }

  if (s.sdh) {
    // Crescent along the whole hemisphere, crossing the sutures, concave inner margin.
    const side = s.sdh.side
    const pts: [number, number][] = []
    const n = 36
    const lo = side === 'R' ? Math.PI * 0.62 : -Math.PI * 0.38
    const hi = side === 'R' ? Math.PI * 1.38 : Math.PI * 0.38
    for (let i = 0; i <= n; i++) pts.push(onInner(lo + ((hi - lo) * i) / n, -0.5))
    for (let i = n; i >= 0; i--) pts.push(onInner(lo + ((hi - lo) * i) / n, 1 + 5.5 * Math.sin((Math.PI * i) / n)))
    f.poly(pts, s.sdh.acute === false ? 0.3 : BLOOD, 'set', 0.8)
  }

  if (s.ich) {
    const x = CX + (s.ich.side === 'R' ? -18 : 18) + shift * 0.3
    f.ellipse(x, CY + 2, 11, 9, 0.3, 'set', 3)
    f.ellipse(x, CY + 2, 8, 6.5, BLOOD, 'set', 1)
  }

  if (s.infarct) {
    // Early MCA-territory infarct: a hypodense wedge with loss of grey–white differentiation.
    const dir = s.infarct.side === 'R' ? -1 : 1
    f.poly(
      [
        [CX + dir * 8, CY - 4],
        [CX + dir * (RX - 4), CY - 24],
        [CX + dir * (RX - 3), CY + 20],
      ],
      0.3,
      'set',
      3,
    )
  }

  if (s.fracture) {
    const a = s.fracture.side === 'R' ? Math.PI * 1.02 : -0.02
    const [x0, y0] = [CX + Math.cos(a) * (RX - 4.5), CY + Math.sin(a) * (RY - 4.5)]
    const [x1, y1] = [CX + Math.cos(a + 0.03) * (RX + 0.5), CY + Math.sin(a + 0.03) * (RY + 0.5)]
    f.line(x0, y0, x1, y1, 1.1, 0.34, 'set', 0.2)
    // Overlying scalp haematoma.
    f.ellipse(CX + Math.cos(a) * (RX + 5), CY + Math.sin(a) * (RY + 5), 5, 9, 0.4, 'max', 1)
  }

  f.grain(0.035, seed)
  return f
}
