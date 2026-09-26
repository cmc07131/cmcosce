import { Pixels } from './field'

/**
 * Clinical photographs as pixel art. Each shows the sign where it is really found: purpura that does not
 * blanch under a glass, a strawberry tongue, a fight bite over the knuckle, the burn areas on a body chart.
 */

const SKIN = '#f0c090'
const SKIN_SH = '#d8a070'
const LINE = '#302830'

/* ------------------------------------------------------------------ burns chart */

export type BurnRegion =
  | 'head'
  | 'chest'
  | 'abdomen'
  | 'back'
  | 'buttocks'
  | 'r-arm'
  | 'l-arm'
  | 'r-leg-front'
  | 'l-leg-front'
  | 'r-leg-back'
  | 'l-leg-back'
  | 'perineum'
  | 'r-hand'
  | 'l-hand'

/** Adult rule-of-nines share for each region, as percent of total body surface area. */
export const NINES: Record<BurnRegion, number> = {
  head: 9,
  chest: 9,
  abdomen: 9,
  back: 13.5,
  buttocks: 4.5,
  'r-arm': 9,
  'l-arm': 9,
  'r-leg-front': 9,
  'l-leg-front': 9,
  'r-leg-back': 9,
  'l-leg-back': 9,
  perineum: 1,
  'r-hand': 1,
  'l-hand': 1,
}

type Depth = 'superficial' | 'partial' | 'full'
const BURN: Record<Depth, string> = { superficial: '#f07868', partial: '#e0d0b8', full: '#b8a888' }

/** Front and back body outlines with the burned regions shaded by depth. Simple erythema is not counted. */
export function burnChart(regions: { region: BurnRegion; depth: Depth }[]) {
  const p = new Pixels(128, 112, '#f8f0e0')
  const figure = (ox: number, back: boolean) => {
    const parts: Record<string, [number, number][]> = {
      head: [
        [ox + 12, 4],
        [ox + 20, 4],
        [ox + 21, 16],
        [ox + 11, 16],
      ],
      chest: [
        [ox + 8, 18],
        [ox + 24, 18],
        [ox + 24, 34],
        [ox + 8, 34],
      ],
      abdomen: [
        [ox + 8, 34],
        [ox + 24, 34],
        [ox + 23, 50],
        [ox + 9, 50],
      ],
      'r-arm': back
        ? [
            [ox + 24, 18],
            [ox + 30, 20],
            [ox + 32, 52],
            [ox + 27, 52],
            [ox + 24, 26],
          ]
        : [
            [ox + 8, 18],
            [ox + 2, 20],
            [ox + 0, 52],
            [ox + 5, 52],
            [ox + 8, 26],
          ],
      'l-arm': back
        ? [
            [ox + 8, 18],
            [ox + 2, 20],
            [ox + 0, 52],
            [ox + 5, 52],
            [ox + 8, 26],
          ]
        : [
            [ox + 24, 18],
            [ox + 30, 20],
            [ox + 32, 52],
            [ox + 27, 52],
            [ox + 24, 26],
          ],
      'r-leg': back
        ? [
            [ox + 16, 52],
            [ox + 23, 50],
            [ox + 22, 96],
            [ox + 17, 96],
          ]
        : [
            [ox + 9, 50],
            [ox + 16, 52],
            [ox + 15, 96],
            [ox + 10, 96],
          ],
      'l-leg': back
        ? [
            [ox + 9, 50],
            [ox + 16, 52],
            [ox + 15, 96],
            [ox + 10, 96],
          ]
        : [
            [ox + 16, 52],
            [ox + 23, 50],
            [ox + 22, 96],
            [ox + 17, 96],
          ],
    }
    for (const pts of Object.values(parts)) p.poly(pts, SKIN)
    const paint = (key: string, depth: Depth) => parts[key] && p.poly(parts[key], BURN[depth])
    for (const { region, depth } of regions) {
      if (region === 'head') paint('head', depth)
      if (!back && region === 'chest') paint('chest', depth)
      if (!back && region === 'abdomen') paint('abdomen', depth)
      if (back && region === 'back') {
        paint('chest', depth)
        paint('abdomen', depth)
      }
      if (region === 'r-arm') paint('r-arm', depth)
      if (region === 'l-arm') paint('l-arm', depth)
      if (!back && region === 'r-leg-front') paint('r-leg', depth)
      if (!back && region === 'l-leg-front') paint('l-leg', depth)
      if (back && region === 'r-leg-back') paint('r-leg', depth)
      if (back && region === 'l-leg-back') paint('l-leg', depth)
    }
    for (const pts of Object.values(parts)) {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        p.line(a[0], a[1], b[0], b[1], LINE)
      }
    }
  }
  figure(20, false)
  figure(76, true)
  // Labels as tiny marks: F under the front, B under the back.
  p.rect(34, 102, 4, 1, LINE).rect(34, 102, 1, 6, LINE).rect(34, 104, 3, 1, LINE)
  p.rect(90, 102, 1, 6, LINE).rect(90, 102, 3, 1, LINE).rect(90, 104, 3, 1, LINE).rect(90, 107, 3, 1, LINE).rect(93, 103, 1, 1, LINE).rect(93, 105, 1, 2, LINE)
  // Legend swatches: superficial, partial, full.
  p.rect(4, 104, 6, 6, BURN.superficial).rect(12, 104, 6, 6, BURN.partial).rect(20, 104, 6, 6, BURN.full)
  return p
}

/** Total burn area counting partial and full thickness only (erythema is excluded). */
export function burnPercent(regions: { region: BurnRegion; depth: Depth }[]) {
  return regions.filter((r) => r.depth !== 'superficial').reduce((sum, r) => sum + NINES[r.region], 0)
}

/** A circumferential full-thickness burn of the chest: leathery, white-brown, inelastic. */
export function chestEschar() {
  const p = new Pixels(96, 96, '#283040')
  p.ellipse(48, 60, 40, 44, SKIN)
  p.rect(18, 30, 60, 50, '#c8b898')
  p.speckle((x, y) => x > 18 && x < 78 && y > 30 && y < 80, '#a89070', 0.18)
  p.speckle((x, y) => x > 18 && x < 78 && y > 30 && y < 80, '#e8dcc0', 0.08, 5)
  p.ellipse(48, 18, 12, 14, SKIN)
  p.rect(40, 26, 16, 6, SKIN_SH)
  return p
}

/* ------------------------------------------------------------------ rashes */

/** Non-blanching purpura on a child's leg, with a glass tumbler pressed on it: the spots stay visible. */
export function purpura() {
  const p = new Pixels(96, 96, '#e8e0d8')
  p.poly(
    [
      [30, 0],
      [66, 0],
      [62, 96],
      [34, 96],
    ],
    SKIN,
  )
  p.speckle((x, y) => x > 32 && x < 64 && y < 94, '#801828', 0.06, 7)
  p.speckle((x, y) => x > 32 && x < 64 && y < 94, '#a02040', 0.05, 11)
  // Larger ecchymoses.
  p.ellipse(44, 30, 3, 2, '#601830').ellipse(56, 62, 4, 3, '#601830')
  // The glass: a bright rim, the spots show through unchanged.
  for (let a = 0; a < Math.PI * 2; a += 0.05) p.dot(48 + Math.cos(a) * 18, 48 + Math.sin(a) * 18, '#f8f8f8')
  for (let a = 0; a < Math.PI * 2; a += 0.05) p.dot(48 + Math.cos(a) * 17, 48 + Math.sin(a) * 17, '#c8e0f0')
  return p
}

/** Scarlet fever: strawberry tongue, flushed cheeks with circumoral pallor. */
export function scarletTongue() {
  const p = new Pixels(96, 96, '#e8b090')
  p.ellipse(48, 48, 44, 46, '#f0b090')
  p.ellipse(24, 40, 12, 9, '#f08070').ellipse(72, 40, 12, 9, '#f08070')
  p.ellipse(48, 66, 18, 14, '#f8d8c0')
  p.ellipse(48, 66, 13, 10, '#301818')
  p.ellipse(48, 70, 10, 8, '#e03040')
  p.speckle((x, y) => (x - 48) ** 2 / 100 + (y - 70) ** 2 / 64 < 1, '#f8e8e8', 0.14, 3)
  p.rect(36, 58, 24, 3, '#f8f8f0')
  return p
}

/** Sandpaper rash in the skin creases (Pastia's lines) of the antecubital fossa. */
export function scarletRash() {
  const p = new Pixels(96, 96, '#e8e0d8')
  p.poly(
    [
      [0, 30],
      [96, 20],
      [96, 70],
      [0, 76],
    ],
    '#f4b8a0',
  )
  p.speckle((x, y) => y > 24 && y < 72, '#e07868', 0.35, 9)
  p.line(20, 48, 76, 44, '#b02030', 2)
  p.line(24, 54, 72, 50, '#b02030')
  return p
}

/** Chickenpox: crops of lesions at different stages (macule, papule, vesicle, crust) on the trunk. */
export function chickenpox() {
  const p = new Pixels(96, 96, '#e8e0d8')
  p.rect(8, 8, 80, 88, SKIN)
  let h = 17
  const r = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h >>> 0) / 4294967296
  }
  for (let i = 0; i < 34; i++) {
    const x = 12 + r() * 72
    const y = 12 + r() * 80
    const stage = i % 4
    p.ellipse(x, y, 2.5, 2.5, '#e87070')
    if (stage === 1) p.ellipse(x, y, 1.4, 1.4, '#f8f0e0')
    if (stage === 2) p.ellipse(x, y, 1.6, 1.6, '#c8e0e8')
    if (stage === 3) p.ellipse(x, y, 1.5, 1.5, '#804030')
  }
  return p
}

/** Shingles: grouped vesicles on a red base in one thoracic dermatome, stopping at the midline. */
export function zoster() {
  const p = new Pixels(96, 96, '#e8e0d8')
  p.rect(8, 8, 80, 88, SKIN)
  p.rect(47, 8, 1, 88, SKIN_SH)
  for (let x = 48; x < 88; x += 5) {
    const y = 40 + (x - 48) * 0.3
    p.ellipse(x, y, 4, 3, '#e87070')
    p.ellipse(x - 1, y, 1.2, 1.2, '#f0f0f8').ellipse(x + 1.5, y + 1, 1.2, 1.2, '#f0f0f8')
  }
  return p
}

/* ------------------------------------------------------------------ hands */

/** Fight bite: a small laceration over the third metacarpophalangeal joint of a clenched fist. */
export function fightBite() {
  const p = new Pixels(96, 96, '#d8d8e0')
  p.poly(
    [
      [14, 30],
      [80, 26],
      [86, 60],
      [60, 90],
      [18, 86],
    ],
    SKIN,
  )
  for (let i = 0; i < 4; i++) p.ellipse(24 + i * 16, 30, 8, 6, SKIN_SH)
  for (let i = 0; i < 4; i++) p.ellipse(24 + i * 16, 29, 6.5, 4.5, SKIN)
  p.line(52, 30, 58, 33, '#902030', 2)
  p.ellipse(55, 32, 7, 5, '#f09080')
  p.line(52, 30, 58, 33, '#902030', 2)
  return p
}

/* ------------------------------------------------------------------ fundus */

/** Retina through the ophthalmoscope. Papilloedema: swollen disc, blurred margin, lost cup, engorged veins. */
export function fundus(kind: 'normal' | 'papilloedema' = 'normal') {
  const p = new Pixels(96, 96, '#000000')
  p.ellipse(48, 48, 46, 46, '#c84830')
  p.speckle((x, y) => (x - 48) ** 2 + (y - 48) ** 2 < 46 * 46, '#b03828', 0.2, 4)
  const swollen = kind === 'papilloedema'
  const dx = 34
  const dy = 46
  if (swollen) {
    p.ellipse(dx, dy, 13, 13, '#e89868')
    p.speckle((x, y) => (x - dx) ** 2 + (y - dy) ** 2 < 14 * 14, '#f0b080', 0.4, 2)
    p.ellipse(dx, dy, 9, 9, '#f8c890')
    // Flame haemorrhages at the margin.
    p.line(dx + 13, dy - 4, dx + 17, dy - 6, '#801818', 2).line(dx - 12, dy + 8, dx - 15, dy + 12, '#801818', 2)
  } else {
    p.ellipse(dx, dy, 9, 9, '#f8d8a0')
    p.ellipse(dx + 1, dy, 3.5, 3.5, '#fff0d0')
  }
  // Vessels: veins darker and wider than arteries; engorged with papilloedema.
  const vein = swollen ? 3 : 2
  for (const [x1, y1] of [
    [86, 22],
    [86, 72],
    [60, 6],
    [60, 90],
  ] as [number, number][]) {
    p.line(dx, dy, x1, y1, '#801828', vein)
    p.line(dx, dy + 2, x1 - 4, y1 + 3, '#e06050', 1)
  }
  // Macula, darker, temporal to the disc.
  p.ellipse(70, 50, 5, 5, '#a03020')
  return p
}

/* ------------------------------------------------------------------ posturing */

/**
 * A patient on a trolley seen from above, head at the top.
 * Decorticate (abnormal flexion, GCS M3): elbows and wrists flexed onto the chest, legs extended, feet pointed.
 * Decerebrate (extension, GCS M2): arms straight and internally rotated, wrists flexed, legs extended, feet pointed.
 */
export function posture(kind: 'decorticate' | 'decerebrate') {
  const p = new Pixels(96, 128, '#c8d0d8')
  const GOWN = '#a8c8e8'
  p.rect(20, 4, 56, 120, '#f0f0f0')
  p.ellipse(48, 16, 8, 9, SKIN)
  p.rect(44, 6, 8, 3, '#403028')
  p.rect(36, 26, 24, 40, GOWN)
  // Legs extended with the feet pointed (plantarflexed) in both.
  p.rect(38, 66, 9, 44, GOWN).rect(49, 66, 9, 44, GOWN)
  p.rect(39, 110, 7, 10, SKIN).rect(50, 110, 7, 10, SKIN)
  if (kind === 'decorticate') {
    // Upper arms along the sides, forearms folded across the chest, fists curled.
    p.rect(30, 28, 6, 18, GOWN).rect(60, 28, 6, 18, GOWN)
    p.line(33, 46, 44, 36, SKIN, 5).line(63, 46, 52, 36, SKIN, 5)
    p.ellipse(45, 34, 3, 3, SKIN_SH).ellipse(51, 34, 3, 3, SKIN_SH)
  } else {
    // Arms straight at the sides, turned in (pronated), wrists flexed outward; neck arched back.
    p.rect(30, 28, 6, 36, GOWN).rect(60, 28, 6, 36, GOWN)
    p.rect(30, 64, 6, 8, SKIN).rect(60, 64, 6, 8, SKIN)
    p.line(33, 72, 27, 78, SKIN, 4).line(63, 72, 69, 78, SKIN, 4)
    p.rect(44, 4, 8, 2, SKIN_SH)
  }
  return p
}
