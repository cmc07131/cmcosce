import { Field } from './field'

/**
 * Bedside ultrasound, B-mode, in a sector. Fluid is black (anechoic), soft organs speckled grey,
 * bone and gas bright with shadowing. Probe marker at the top left.
 */

function sector(f: Field) {
  const apexX = 64
  const apexY = 4
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const a = Math.atan2(x - apexX, y - apexY)
      const r = Math.hypot(x - apexX, y - apexY)
      if (Math.abs(a) > 0.62 || r > 122 || r < 6) f.d[y * f.w + x] = 0
    }
  }
  return f
}

function speckle(f: Field, amount: number, seed: number) {
  f.grain(amount, seed)
  return f
}

/**
 * FAST, right upper quadrant (hepatorenal view). Positive: an anechoic black stripe in Morison's pouch
 * between the liver capsule and the right kidney.
 */
export function fastRuq(positive: boolean, seed = 1, haemothorax = false): Field {
  const f = new Field(128, 128, 0.1)
  // Liver: homogeneous mid-grey filling the near field.
  f.ellipse(52, 44, 60, 44, 0.42, 'set', 4)
  // Kidney: bright sinus fat centre, darker cortex, lying deeper to the right.
  f.ellipse(80, 88, 24, 14, 0.3, 'set', 2, -0.35)
  f.ellipse(80, 88, 14, 6, 0.7, 'set', 2, -0.35)
  // Diaphragm: bright curved line at the top left.
  f.curve([8, 60], [18, 26], [48, 10], 2, 0.9, 'set', 1)
  if (positive) {
    // Free fluid in the hepatorenal space tracks along the kidney's upper surface.
    f.curve([48, 70], [70, 62], [102, 72], 5, 0.02, 'set', 1)
  } else {
    // The potential space is a single bright interface.
    f.curve([48, 72], [70, 66], [102, 76], 1.2, 0.7, 'set', 0.6)
  }
  speckle(f, 0.18, seed)
  // Fluid stays black after speckle.
  if (positive) f.curve([48, 70], [70, 62], [102, 72], 4, 0.02, 'set', 0.8)
  if (haemothorax) {
    // Fluid above the diaphragm, and the spine sign: vertebral shadows seen through it, above the diaphragm.
    f.poly(
      [
        [0, 20],
        [30, 14],
        [44, 12],
        [18, 30],
        [8, 60],
        [0, 70],
      ],
      0.02,
      'set',
      1,
    )
    for (let i = 0; i < 4; i++) f.ellipse(14 + i * 5, 58 - i * 11, 3, 2, 0.85, 'set', 0.6)
  }
  return sector(f)
}

/** FAST, pelvic view. Positive: black fluid behind the bladder (rectovesical or rectouterine pouch). */
export function fastPelvis(positive: boolean, seed = 1): Field {
  const f = new Field(128, 128, 0.35)
  f.ellipse(64, 50, 30, 22, 0.02, 'set', 2)
  if (positive) f.poly(
    [
      [36, 74],
      [92, 74],
      [80, 90],
      [48, 90],
    ],
    0.03,
    'set',
    2,
  )
  speckle(f, 0.16, seed)
  f.ellipse(64, 50, 28, 20, 0.02, 'set', 2)
  if (positive) f.poly(
    [
      [38, 75],
      [90, 75],
      [79, 88],
      [49, 88],
    ],
    0.03,
    'set',
    1,
  )
  return sector(f)
}

/** Subxiphoid cardiac view. Effusion: a black rim around the heart; tamponade adds a collapsing RV. */
export function cardiac(effusion: boolean, seed = 1): Field {
  const f = new Field(128, 128, 0.3)
  f.ellipse(64, 30, 50, 22, 0.42, 'set', 3)
  if (effusion) f.ellipse(64, 76, 42, 34, 0.02, 'set', 2)
  f.ellipse(64, 76, 34, 26, 0.5, 'set', 2)
  f.ellipse(50, 76, 10, 14, 0.04, 'set', 2)
  f.ellipse(78, 76, 12, 16, 0.04, 'set', 2)
  speckle(f, 0.16, seed)
  if (effusion) {
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const x = 64 + Math.cos(a) * 38
      const y = 76 + Math.sin(a) * 30
      f.ellipse(x, y, 2, 2, 0.02, 'set', 0.5)
    }
  }
  return sector(f)
}

/** Early pregnancy, transabdominal. `ectopic`: empty uterus, free fluid, adnexal mass. `iup`: sac with yolk sac. */
export function earlyPregnancy(kind: 'iup' | 'ectopic', seed = 1): Field {
  const f = new Field(128, 128, 0.3)
  // Bladder (black) near field.
  f.ellipse(64, 24, 36, 14, 0.02, 'set', 2)
  // Uterus.
  f.ellipse(64, 70, 30, 20, 0.45, 'set', 3)
  f.line(40, 70, 88, 70, 1.4, 0.7, 'set', 0.6)
  if (kind === 'iup') {
    f.ellipse(64, 70, 9, 8, 0.02, 'set', 1)
    f.ellipse(62, 68, 2.4, 2.4, 0.9, 'set', 0.4)
  } else {
    f.ellipse(100, 78, 8, 7, 0.55, 'set', 1)
    f.ellipse(100, 78, 3, 3, 0.1, 'set', 1)
    f.poly(
      [
        [40, 94],
        [92, 94],
        [80, 108],
        [52, 108],
      ],
      0.03,
      'set',
      2,
    )
  }
  speckle(f, 0.16, seed)
  f.ellipse(64, 24, 34, 12, 0.02, 'set', 2)
  if (kind === 'iup') f.ellipse(64, 70, 8, 7, 0.02, 'set', 1)
  if (kind === 'iup') f.ellipse(62, 68, 2.4, 2.4, 0.9, 'set', 0.4)
  if (kind === 'ectopic') f.poly(
    [
      [42, 95],
      [90, 95],
      [79, 106],
      [53, 106],
    ],
    0.03,
    'set',
    1,
  )
  return sector(f)
}
