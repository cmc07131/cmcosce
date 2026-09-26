import { Field } from './field'

/**
 * Plain films of the limbs, pelvis and cervical spine. A bone is a bright cortical shell around a
 * slightly darker medulla; soft tissue is a mid grey. Each builder shows the named sign in the place a
 * radiologist would look for it.
 */

const SOFT = 0.3
const CORTEX = 0.86
const MEDULLA = 0.62

type P = [number, number]

/** A long bone along a path: cortex first, then the medulla inside it. */
function bone(f: Field, pts: P[], width: number) {
  f.path(pts, width, CORTEX, 'set', 0.8)
  f.path(pts, Math.max(1, width - 3.2), MEDULLA, 'set', 0.8)
}

/** A rounded bone end or small bone (carpal, femoral head). */
function knob(f: Field, x: number, y: number, rx: number, ry: number, rot = 0) {
  f.ellipse(x, y, rx, ry, CORTEX, 'set', 0.8, rot)
  f.ellipse(x, y, Math.max(0.8, rx - 1.6), Math.max(0.8, ry - 1.6), MEDULLA, 'set', 0.8, rot)
}

/* ------------------------------------------------------------------ wrist */

/** Wrist, PA (left half) and lateral (right half). Colles: dorsal angulation, shortening, ulnar styloid. */
export function wrist(kind: 'normal' | 'colles' = 'normal', seed = 1): Field {
  const f = new Field(160, 128, 0.04)
  const colles = kind === 'colles'
  // PA: forearm vertical, fingers up. Patient's radius on the image left for a right wrist PA (thumb side).
  f.poly(
    [
      [22, 128],
      [58, 128],
      [60, 66],
      [64, 20],
      [16, 20],
      [20, 66],
    ],
    SOFT,
    'set',
    3,
  )
  const drop = colles ? 5 : 0
  bone(f, [
    [30, 128],
    [30, 80],
  ], 11)
  // Distal radius: flares toward the styloid; radial inclination ~22° normally, lost with Colles.
  f.poly(
    [
      [24, 82],
      [36, 82],
      [38, 70 + drop],
      [22, colles ? 70 : 62],
    ],
    CORTEX,
    'set',
    0.8,
  )
  f.poly(
    [
      [26, 81],
      [34, 81],
      [36, 71 + drop],
      [24, colles ? 71 : 64],
    ],
    MEDULLA,
    'set',
    0.8,
  )
  bone(f, [
    [48, 128],
    [47, 74],
  ], 8)
  if (colles) {
    // Transverse fracture line ~2 cm above the joint, impaction band, ulnar styloid avulsed.
    f.line(22, 80, 38, 79, 1.2, 0.2, 'set', 0.4)
    f.line(22, 84, 38, 83, 1.4, 0.95, 'max', 0.4)
    f.line(46, 72, 50, 70, 1, 0.2, 'set', 0.3)
  }
  // Ulnar styloid and the carpus.
  knob(f, 49, 71, 2, 3)
  for (const [x, y] of [
    [26, 60],
    [34, 60],
    [42, 60],
    [48, 62],
    [24, 50],
    [32, 50],
    [40, 50],
    [48, 52],
  ] as P[])
    knob(f, x, y - drop, 4, 4)
  for (let i = 0; i < 5; i++) bone(f, [[20 + i * 8, 44 - drop], [18 + i * 9, 22]], 5)

  // Lateral: radius and ulna superimposed; carpus sits in the lunate cup. Dorsal is the image right.
  const ox = 100
  const tilt = colles ? 0.5 : -0.2
  f.poly(
    [
      [ox - 14, 128],
      [ox + 16, 128],
      [ox + 16 + (colles ? 10 : 0), 72],
      [ox + 10, 20],
      [ox - 14, 20],
      [ox - 16, 72],
    ],
    SOFT,
    'set',
    3,
  )
  bone(f, [
    [ox, 128],
    [ox, 78],
  ], 12)
  // Distal fragment: normally tilted volar (toward the image left); Colles tips it dorsal and shifts it back.
  const fx = ox + (colles ? 5 : 0)
  const fy = 72
  const frag: P[] = [
    [-7, 6],
    [7, 6],
    [8, -6],
    [-8, -6],
  ]
  const rot = (p: P): P => [fx + p[0] * Math.cos(tilt) - p[1] * Math.sin(tilt), fy + p[0] * Math.sin(tilt) + p[1] * Math.cos(tilt)]
  f.poly(frag.map(rot), CORTEX, 'set', 0.8)
  f.poly(
    frag.map(([x, y]) => [x * 0.7, y * 0.7] as P).map(rot),
    MEDULLA,
    'set',
    0.8,
  )
  // Lunate in the radial cup, capitate above, metacarpals.
  const cup = rot([0, -8])
  knob(f, cup[0], cup[1], 5, 4, tilt)
  const cap = rot([0, -17])
  knob(f, cap[0] - 1, cap[1], 5, 5)
  // The hand follows the carpus: tipped back with a Colles (the "dinner fork"), in line otherwise.
  const hand = rot([colles ? -4 : 0, -64])
  bone(f, [[cap[0] - 1, cap[1] - 6], [hand[0], Math.max(20, hand[1])]], 7)
  if (colles) f.line(ox - 7, 79, ox + 8, 79, 1.2, 0.2, 'set', 0.4)
  f.grain(0.04, seed)
  return f
}

/* ------------------------------------------------------------------ elbow */

/**
 * Lateral elbow at 90°. Normal: the anterior humeral line crosses the middle third of the capitellum,
 * no posterior fat pad. Supracondylar (extension type): posterior fat pad, the distal fragment and
 * capitellum displaced back, so the anterior humeral line passes in front of the capitellum.
 */
export function elbow(kind: 'normal' | 'supracondylar' = 'normal', seed = 1): Field {
  const f = new Field(128, 128, 0.04)
  const sc = kind === 'supracondylar'
  f.poly(
    [
      [34, 0],
      [80, 0],
      [86, 70],
      [128, 84],
      [128, 116],
      [60, 104],
      [38, 86],
    ],
    SOFT,
    'set',
    3,
  )
  // Humerus shaft down to the condyles.
  bone(f, [
    [58, 0],
    [58, 60],
  ], 14)
  const back = sc ? 8 : 0
  const cx = 60 - back * -1
  // Distal humerus / condylar mass (hourglass on the lateral view) and capitellum.
  knob(f, cx + back * 0.1, 70, 10, 8)
  const capX = 54 + back
  const capY = 80
  knob(f, capX, capY, 6, 6)
  if (sc) {
    f.line(46, 60, 72, 58, 1.4, 0.2, 'set', 0.4)
  }
  // Forearm: ulna with olecranon behind, radius head articulating with the capitellum.
  bone(f, [
    [capX + 4, capY + 4],
    [124, 96],
  ], 9)
  knob(f, 72 + back, 70, 5, 6)
  bone(f, [
    [capX - 2, capY + 7],
    [124, 106],
  ], 8)
  // Fat pads: anterior sail (raised with an effusion) and posterior (always abnormal when seen).
  if (sc) {
    f.poly(
      [
        [44, 56],
        [40, 70],
        [48, 66],
      ],
      0.16,
      'set',
      1,
    )
    f.poly(
      [
        [72, 56],
        [78, 68],
        [70, 66],
      ],
      0.16,
      'set',
      1,
    )
  } else {
    f.ellipse(47, 64, 1.5, 4, 0.18, 'set', 1)
  }
  f.grain(0.04, seed)
  return f
}

/** Where the anterior humeral line meets the capitellum's row, relative to the capitellum centre. */
export function anteriorHumeralOffset(kind: 'normal' | 'supracondylar') {
  const back = kind === 'supracondylar' ? 8 : 0
  const lineX = 51 // the anterior cortex of the humerus
  const capX = 54 + back
  return (capX - lineX) / 6
}

/* ------------------------------------------------------------------ shoulder */

/** AP shoulder. Anterior dislocation: the head sits medial and below the glenoid, under the coracoid. */
export function shoulder(kind: 'normal' | 'anterior' = 'normal', seed = 1): Field {
  const f = new Field(128, 128, 0.04)
  f.poly(
    [
      [0, 10],
      [80, 6],
      [118, 30],
      [128, 60],
      [128, 128],
      [0, 128],
    ],
    SOFT,
    'set',
    3,
  )
  // Ribs and lung behind (dark), clavicle, scapula with glenoid facing the image right.
  f.poly(
    [
      [0, 40],
      [44, 36],
      [52, 128],
      [0, 128],
    ],
    0.14,
    'set',
    3,
  )
  for (let i = 0; i < 7; i++) f.curve([0, 44 + i * 12], [30, 36 + i * 12], [48, 52 + i * 12], 2, 0.12, 'add', 0.6)
  bone(f, [
    [0, 22],
    [40, 16],
    [74, 22],
  ], 7)
  // Acromion and coracoid.
  bone(f, [
    [64, 26],
    [88, 26],
  ], 6)
  knob(f, 58, 38, 4, 3)
  // Scapular body and the glenoid rim.
  f.poly(
    [
      [52, 32],
      [70, 36],
      [70, 64],
      [40, 110],
      [30, 100],
    ],
    0.5,
    'set',
    1.5,
  )
  f.line(70, 38, 70, 62, 2, CORTEX, 'set', 0.6)
  const [hx, hy] = kind === 'anterior' ? [56, 64] : [82, 50]
  // Humeral head, neck and shaft.
  knob(f, hx, hy, 13, 13)
  bone(f, [
    [hx + 6, hy + 8],
    [hx + 14, 128],
  ], 15)
  // Greater tuberosity bump.
  knob(f, hx + 12, hy - 2, 4, 5)
  f.grain(0.04, seed)
  return f
}

/* ------------------------------------------------------------------ pelvis */

/**
 * AP pelvis. The ring: sacrum and SI joints behind, iliac wings, the pelvic brim, pubic rami meeting at
 * the symphysis, obturator foramina, femoral heads in the acetabula. Open book: the symphysis springs
 * apart (> 2.5 cm), the SI joints widen and the wings flare.
 */
export function pelvis(kind: 'normal' | 'open-book' = 'normal', seed = 1): Field {
  const f = new Field(128, 128, 0.04)
  f.poly(
    [
      [2, 6],
      [126, 6],
      [126, 128],
      [2, 128],
    ],
    SOFT,
    'set',
    3,
  )
  const open = kind === 'open-book'
  // Half the gap at the symphysis, in pixels (~3 mm each): 1 normal, 5 when sprung open.
  const g = open ? 5 : 1
  const flare = open ? 4 : 0
  // Lumbar vertebrae and the sacrum with its foramina.
  knob(f, 64, 6, 10, 5)
  knob(f, 64, 19, 11, 6)
  f.poly(
    [
      [51, 28],
      [77, 28],
      [71, 66],
      [64, 74],
      [57, 66],
    ],
    0.6,
    'set',
    1,
  )
  for (let i = 0; i < 4; i++) {
    f.ellipse(58, 36 + i * 8, 1.6, 1.3, 0.4, 'set', 0.5)
    f.ellipse(70, 36 + i * 8, 1.6, 1.3, 0.4, 'set', 0.5)
  }
  for (const dir of [-1, 1]) {
    const X = (dx: number) => 64 + dir * dx
    const shift = open ? 3 : 0
    // Iliac wing, fanning up and out from the SI joint.
    const wing: P[] = [
      [X(13 + shift), 28],
      [X(30 + flare), 12],
      [X(52 + flare), 16],
      [X(58 + flare), 30],
      [X(50 + shift), 54],
      [X(44 + shift), 70],
      [X(24 + shift), 66],
      [X(12 + shift), 60],
    ]
    f.poly(wing, 0.6, 'set', 1)
    f.path([...wing.slice(0, 5)], 1.6, CORTEX, 'max', 0.5)
    // SI joint: a thin dark cleft along the sacrum, wider when opened.
    f.line(X(12 + shift / 2), 30, X(8 + shift / 2), 60, open ? 2.6 : 1, 0.18, 'set', 0.4)
    // Acetabular body and roof.
    f.ellipse(X(38 + shift), 80, 13, 12, 0.66, 'set', 1)
    // Superior pubic ramus to the pubic body at the symphysis.
    f.line(X(32 + shift), 86, X(g + 3), 92, 7, 0.64, 'set', 0.8)
    f.poly(
      [
        [X(g), 88],
        [X(g + 7), 88],
        [X(g + 7), 104],
        [X(g), 104],
      ],
      0.66,
      'set',
      0.6,
    )
    f.line(X(g), 88, X(g), 104, 1.2, CORTEX, 'max', 0.4)
    // Inferior ramus and ischium round to the ischial tuberosity.
    f.path(
      [
        [X(g + 4), 102],
        [X(22 + shift), 112],
        [X(32 + shift), 108],
        [X(36 + shift), 90],
      ],
      6,
      0.64,
      'set',
      0.8,
    )
    // Obturator foramen: the hole in the ring.
    f.ellipse(X(20 + shift), 99, 8, 7, SOFT, 'set', 1)
    // Femoral head seated in the acetabulum, neck, trochanters, shaft.
    knob(f, X(38 + shift), 80, 9.5, 9.5)
    f.curve([X(27 + shift), 74], [X(38 + shift), 64], [X(49 + shift), 72], 1.6, CORTEX, 'max', 0.5)
    bone(f, [
      [X(42 + shift), 84],
      [X(51 + shift), 92],
    ], 9)
    knob(f, X(54 + shift), 90, 5, 7)
    bone(f, [
      [X(51 + shift), 94],
      [X(50 + shift), 128],
    ], 13)
    knob(f, X(45 + shift), 104, 3, 3.5)
  }
  // The pelvic brim (iliopectineal lines): the oval of the inlet.
  const brim: P[] = []
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / 40)
    brim.push([64 + Math.cos(a + Math.PI) * (28 + (open ? 3 : 0)), 64 + Math.sin(a) * 24])
  }
  f.path(brim, 1.2, CORTEX, 'max', 0.5)
  // Bladder shadow.
  f.ellipse(64, 78, 12, 8, 0.04, 'add', 4)
  f.grain(0.04, seed)
  return f
}

/** Width of the symphysis in pixels at its row: tests check it is wide in an open book. */
export function symphysisWidth(f: Field) {
  const dark = (x: number) => f.mean(x, 96, x, 100) < 0.5
  if (!dark(64)) return 0
  let lo = 64
  let hi = 64
  while (lo > 40 && dark(lo - 1)) lo--
  while (hi < 88 && dark(hi + 1)) hi++
  return hi - lo + 1
}

/* ------------------------------------------------------------------ ankle */

/** Mortise view. Weber B: oblique fibular fracture at the syndesmosis; medial clear space widened. */
export function ankle(kind: 'normal' | 'weber-b' = 'normal', seed = 1): Field {
  const f = new Field(128, 128, 0.04)
  const wb = kind === 'weber-b'
  f.poly(
    [
      [30, 0],
      [98, 0],
      [104, 90],
      [96, 128],
      [32, 128],
      [24, 90],
    ],
    SOFT,
    'set',
    3,
  )
  // Tibia with the medial malleolus (image left for a right ankle mortise).
  bone(f, [
    [58, 0],
    [58, 60],
  ], 30)
  f.poly(
    [
      [42, 60],
      [74, 60],
      [74, 72],
      [48, 72],
      [44, 86],
      [38, 84],
    ],
    MEDULLA,
    'set',
    1,
  )
  f.path(
    [
      [38, 84],
      [44, 86],
      [48, 72],
      [74, 72],
    ],
    1.6,
    CORTEX,
    'max',
    0.5,
  )
  // Fibula and lateral malleolus.
  bone(f, [
    [86, 0],
    [84, 60],
    [86, 90],
  ], 9)
  if (wb) f.line(80, 70, 90, 56, 1.4, 0.2, 'set', 0.4)
  // Talus in the mortise; shifted laterally when the mortise is unstable.
  const shift = wb ? 5 : 0
  knob(f, 62 + shift, 84, 14, 11)
  f.grain(0.04, seed)
  return f
}

/* ------------------------------------------------------------------ hip */

/** AP hip. Neck of femur fracture: shortened, externally rotated, Shenton's line broken. */
export function hip(kind: 'normal' | 'nof' = 'normal', seed = 1): Field {
  const f = new Field(128, 128, 0.04)
  const nof = kind === 'nof'
  f.poly(
    [
      [0, 0],
      [128, 0],
      [128, 128],
      [0, 128],
    ],
    SOFT,
    'set',
    3,
  )
  // Acetabulum and superior pubic ramus (the upper arc of Shenton's line).
  f.poly(
    [
      [0, 20],
      [60, 20],
      [70, 52],
      [60, 70],
      [0, 80],
    ],
    0.62,
    'set',
    1,
  )
  f.line(0, 78, 58, 72, 5, 0.72, 'set', 0.8)
  knob(f, 66, 50, 14, 14)
  const drop = nof ? 10 : 0
  // Neck and shaft; with a fracture the shaft rides up and rotates out (lesser trochanter prominent).
  bone(f, [
    [72, 58],
    [86, 72 - drop],
  ], 13)
  if (nof) f.line(74, 60, 84, 54, 1.4, 0.2, 'set', 0.4)
  knob(f, 96, 70 - drop, 8, 9)
  bone(f, [
    [92, 76 - drop],
    [96, 128],
  ], 16)
  knob(f, nof ? 82 : 86, 96 - drop, nof ? 6 : 4, 5)
  f.grain(0.04, seed)
  return f
}

/* ------------------------------------------------------------------ cervical spine */

/**
 * Lateral C-spine. Normal: C1 to the top of T1, smooth anterior, posterior and spinolaminar lines.
 * `short`: the film stops at C6, so it is inadequate. `c5-6`: C5 slides forward on C6 (facet dislocation).
 */
export function cspine(kind: 'normal' | 'short' | 'c5-6' = 'normal', seed = 1): Field {
  const f = new Field(128, 128, 0.04)
  f.poly(
    [
      [34, 0],
      [100, 0],
      [104, 128],
      [26, 128],
    ],
    SOFT,
    'set',
    3,
  )
  // Airway in front (prevertebral soft tissue between it and the bodies).
  f.path(
    [
      [36, 20],
      [38, 70],
      [42, 128],
    ],
    7,
    0.12,
    'set',
    1,
  )
  const levels = kind === 'short' ? 6 : 8
  for (let i = 0; i < levels; i++) {
    const y = 14 + i * 14
    // Anterior is the image left (the airway side): C5 and everything above slides forward on C6.
    const slip = kind === 'c5-6' && i <= 4 ? -6 : 0
    const x = 58 + i * 1.5 + slip
    if (i === 0) {
      // C1: anterior arch ring and the dens behind it.
      knob(f, x - 6, y, 4, 4)
      f.line(x, y, x + 18, y, 3, 0.66, 'set', 0.8)
      continue
    }
    f.poly(
      [
        [x - 8, y - 5],
        [x + 8, y - 5],
        [x + 8, y + 6],
        [x - 8, y + 6],
      ],
      MEDULLA,
      'set',
      0.8,
    )
    f.path(
      [
        [x - 8, y - 5],
        [x + 8, y - 5],
        [x + 8, y + 6],
        [x - 8, y + 6],
        [x - 8, y - 5],
      ],
      1.2,
      CORTEX,
      'max',
      0.4,
    )
    // Posterior elements and spinous process.
    f.line(x + 10, y, x + 26, y + 4, 4, 0.62, 'set', 0.8)
  }
  if (kind === 'short') {
    // Shoulders obscure everything below C6.
    f.poly(
      [
        [0, 96],
        [128, 96],
        [128, 128],
        [0, 128],
      ],
      0.78,
      'set',
      6,
    )
  }
  f.grain(0.04, seed)
  return f
}
