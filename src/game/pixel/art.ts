import type { Dir } from '~/engine/schema'

/**
 * Original Game Boy Color–style pixel art, drawn in code.
 * One tile is 16×16 internal pixels. Characters are 16×16 with a dark outline.
 */

export const TILE = 16
export const INK = '#181820'

type Ctx = CanvasRenderingContext2D

/* ---------------------------------------------------------------- characters */

const FRONT = [
  '................',
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHhHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHSSSSSSHO...',
  '...OSSESSESSO...',
  '...OSSSSSSSSO...',
  '....OSSMMSSO....',
  '...OCCcTTcCCO...',
  '..OGOCCTTCCOGO..',
  '..OGOCCTTCCOGO..',
  '...OOCCCCCCOO...',
  '....OPPPPPPO....',
  '....OPPOOPPO....',
  '.....OO..OO.....',
]

const BACK = [
  '................',
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHHHHHHHO...',
  '...OHHHhHHHHO...',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '....OHHHHHHO....',
  '...OCCCcCCCCO...',
  '..OGOCCcCCCOGO..',
  '..OGOCCcCCCOGO..',
  '...OOCCCCCCOO...',
  '....OPPPPPPO....',
  '....OPPOOPPO....',
  '.....OO..OO.....',
]

const SIDE = [
  '................',
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHHhHHHHO...',
  '...OHHHHHHHHO...',
  '...OHHHHHSSSO...',
  '...OHHHHSSESO...',
  '...OHHHSSSSSO...',
  '....OSSSSSsO....',
  '.....OCCCTO.....',
  '.....OCGGTO.....',
  '.....OCGGCO.....',
  '.....OOCCOO.....',
  '......OPPO......',
  '......OPPO......',
  '......OOOO......',
]

const LEGS_FRONT_A = ['....OPPPPPPO....', '....OPPO.OO.....', '.....OO.........']
const LEGS_FRONT_B = ['....OPPPPPPO....', '.....OO.OPPO....', '.........OO.....']
const LEGS_SIDE = ['.....OPPPPO.....', '....OPPOOPPO....', '....OO....OO....']

/** Long hair falls past the ears on the front and back views. */
function longHair(rows: string[], back: boolean): string[] {
  const out = [...rows]
  if (back) {
    out[8] = '...OHHHHHHHHO...'
    out[9] = '...OHHCcCCHHO...'
  } else {
    out[6] = '..OHSSESSESSHO..'
    out[7] = '..OHSSSSSSSSHO..'
    out[8] = '..OHOSSMMSSOHO..'
  }
  return out
}

export type Look = {
  hair: string
  hairHi: string
  skin: string
  coat: string
  coatShade: string
  inner: string
  pants: string
  longHair?: boolean
}

export const LOOKS: Record<string, Look> = {
  doctor: { hair: '#383040', hairHi: '#686078', skin: '#f8c8a0', coat: '#f8f8f8', coatShade: '#b8c0d0', inner: '#3878d8', pants: '#3060b0' },
  nurse: { hair: '#704020', hairHi: '#a86838', skin: '#f8d0a8', coat: '#40b0a0', coatShade: '#288070', inner: '#f8f8f8', pants: '#288070', longHair: true },
  examiner: { hair: '#a8a8b0', hairHi: '#e0e0e8', skin: '#f0c098', coat: '#505870', coatShade: '#383e50', inner: '#d03838', pants: '#383e50' },
  partner: { hair: '#282020', hairHi: '#585050', skin: '#e8b890', coat: '#e87838', coatShade: '#b05020', inner: '#f8e0a0', pants: '#405890' },
  relative: { hair: '#282020', hairHi: '#585050', skin: '#e8b890', coat: '#e87838', coatShade: '#b05020', inner: '#f8e0a0', pants: '#405890' },
  patient: { hair: '#583830', hairHi: '#886050', skin: '#f8c8a0', coat: '#f0b8c8', coatShade: '#d08898', inner: '#f0b8c8', pants: '#f0b8c8', longHair: true },
}

function lookOf(role: string): Look {
  return LOOKS[role] ?? LOOKS.partner
}

function rowsFor(facing: Dir, frame: number, look: Look): string[] {
  const back = facing === 'n'
  let rows = facing === 'e' || facing === 'w' ? [...SIDE] : back ? [...BACK] : [...FRONT]
  if (look.longHair && facing !== 'e' && facing !== 'w') rows = longHair(rows, back)
  if (frame) {
    const legs = facing === 'e' || facing === 'w' ? LEGS_SIDE : frame === 1 ? LEGS_FRONT_A : LEGS_FRONT_B
    rows.splice(13, 3, ...legs)
  }
  return rows
}

function colourOf(ch: string, look: Look, gloved: boolean, talking: boolean): string | null {
  switch (ch) {
    case 'O':
      return INK
    case 'H':
      return look.hair
    case 'h':
      return look.hairHi
    case 'S':
      return look.skin
    case 's':
      return shade(look.skin)
    case 'E':
      return INK
    case 'M':
      return talking ? '#983040' : look.skin
    case 'C':
      return look.coat
    case 'c':
      return look.coatShade
    case 'T':
      return look.inner
    case 'G':
      return gloved ? '#88c8f0' : look.skin
    case 'P':
      return look.pants
    default:
      return null
  }
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, ((n >> 16) & 255) - 36)
  const g = Math.max(0, ((n >> 8) & 255) - 44)
  const b = Math.max(0, (n & 255) - 40)
  return `rgb(${r},${g},${b})`
}

const spriteCache = new Map<string, HTMLCanvasElement>()

/** Cached 16×16 canvas for one pose. West is the east sprite mirrored. */
export function actorSprite(role: string, facing: Dir, frame = 0, gloved = false, talking = false): HTMLCanvasElement {
  const key = `${role}|${facing}|${frame}|${gloved}|${talking}`
  const hit = spriteCache.get(key)
  if (hit) return hit
  const look = lookOf(role)
  const canvas = document.createElement('canvas')
  canvas.width = TILE
  canvas.height = TILE
  const c = canvas.getContext('2d')!
  const rows = rowsFor(facing, frame, look)
  if (facing === 'w') {
    c.translate(TILE, 0)
    c.scale(-1, 1)
  }
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const colour = colourOf(row[x] ?? '.', look, gloved, talking)
      if (!colour) continue
      c.fillStyle = colour
      c.fillRect(x, y, 1, 1)
    }
  })
  spriteCache.set(key, canvas)
  return canvas
}

/* ---------------------------------------------------------------- helpers */

function box(c: Ctx, x: number, y: number, w: number, h: number, fill: string, line = INK) {
  c.fillStyle = line
  c.fillRect(x, y, w, h)
  c.fillStyle = fill
  c.fillRect(x + 1, y + 1, w - 2, h - 2)
}

function px(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  c.fillStyle = fill
  c.fillRect(x, y, w, h)
}

/* ---------------------------------------------------------------- floors & walls */

const FLOOR: Record<string, [string, string, string]> = {
  'resus-bay': ['#f0e8d0', '#e6dcc0', '#cfc09c'],
  cubicle: ['#f4eedc', '#ebe2cc', '#d4c6a4'],
  'skills-bench': ['#e4f0d4', '#d8e8c4', '#b8cc9c'],
  'teaching-room': ['#e4ecf8', '#d8e2f2', '#b4c2dc'],
}

export function drawFloor(c: Ctx, tx: number, ty: number, template: string) {
  const [a, b, line] = FLOOR[template] ?? FLOOR['resus-bay']
  const x = tx * TILE
  const y = ty * TILE
  px(c, x, y, TILE, TILE, a)
  px(c, x + 8, y, 8, 8, b)
  px(c, x, y + 8, 8, 8, b)
  px(c, x + TILE - 1, y, 1, TILE, line)
  px(c, x, y + TILE - 1, TILE, 1, line)
  if ((tx * 7 + ty * 3) % 5 === 0) px(c, x + 3, y + 11, 1, 1, line)
}

/** Back wall seen face-on: pale green paint, rail, skirting, and the odd window or poster. */
export function drawWallFace(c: Ctx, tx: number, ty: number) {
  const x = tx * TILE
  const y = ty * TILE
  px(c, x, y, TILE, TILE, '#b8d8c8')
  px(c, x, y, TILE, 2, '#f8f8f0')
  px(c, x, y + 2, TILE, 1, '#688878')
  px(c, x, y + 9, TILE, 1, '#98b8a8')
  px(c, x, y + 13, TILE, 3, '#688878')
  px(c, x, y + 13, TILE, 1, '#486858')
  const slot = tx % 4
  if (slot === 1) {
    box(c, x + 3, y + 4, 10, 8, '#90c8f8')
    px(c, x + 4, y + 5, 3, 2, '#d8f0ff')
    px(c, x + 7, y + 5, 1, 6, INK)
  } else if (slot === 3) {
    box(c, x + 4, y + 4, 8, 7, '#f8f0c0')
    px(c, x + 6, y + 6, 4, 1, '#d04040')
    px(c, x + 7, y + 5, 2, 3, '#d04040')
  }
}

/** Perimeter wall seen from above. The rim facing the floor catches the light. */
export function drawWallTop(c: Ctx, tx: number, ty: number, open: { n: boolean; e: boolean; s: boolean; w: boolean }) {
  const x = tx * TILE
  const y = ty * TILE
  px(c, x, y, TILE, TILE, '#404858')
  px(c, x + 2, y + 2, TILE - 4, TILE - 4, '#4c5668')
  if (open.n) px(c, x, y, TILE, 2, '#8898b0')
  if (open.s) px(c, x, y + TILE - 2, TILE, 2, '#8898b0')
  if (open.w) px(c, x, y, 2, TILE, '#8898b0')
  if (open.e) px(c, x + TILE - 2, y, 2, TILE, '#8898b0')
}

/* ---------------------------------------------------------------- furniture */

export type PropBox = { kind: string; x: number; y: number; w: number; h: number; id: string }

function hashOf(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

const DRAWERS = ['#d84848', '#4880d8', '#48a868', '#e8b030', '#9058c8']

function trolley(c: Ctx, x: number, y: number, id: string) {
  const accent = DRAWERS[hashOf(id) % DRAWERS.length]
  box(c, x + 1, y + 2, 14, 11, '#b8c0c8')
  px(c, x + 2, y + 3, 12, 2, '#e8ecf0')
  box(c, x + 3, y + 6, 10, 3, accent)
  box(c, x + 3, y + 9, 10, 3, '#98a0a8')
  px(c, x + 7, y + 7, 2, 1, '#f8f8f8')
  px(c, x + 2, y + 13, 3, 3, INK)
  px(c, x + 11, y + 13, 3, 3, INK)
  px(c, x + 4, y + 0, 3, 3, '#f8f8f8')
  px(c, x + 4, y + 0, 3, 1, INK)
  px(c, x + 9, y + 1, 3, 2, accent)
}

function shelf(c: Ctx, x: number, y: number) {
  box(c, x + 1, y, 14, 16, '#b87840')
  px(c, x + 2, y + 1, 12, 14, '#704828')
  px(c, x + 2, y + 5, 12, 1, '#d09858')
  px(c, x + 2, y + 10, 12, 1, '#d09858')
  const bottles = ['#f8f8f8', '#e85858', '#58a8e8', '#f8d858', '#78c878']
  bottles.forEach((col, i) => {
    px(c, x + 3 + i * 2, y + 2, 1, 3, col)
    px(c, x + 3 + ((i * 3) % 10), y + 7, 2, 3, bottles[(i + 2) % bottles.length])
    px(c, x + 3 + i * 2, y + 12, 2, 2, bottles[(i + 4) % bottles.length])
  })
}

function monitor(c: Ctx, p: PropBox, t: number, bpm: number, flat: boolean) {
  const x = p.x * TILE
  const y = p.y * TILE
  const w = p.w * TILE
  box(c, x + 1, y + 1, w - 2, 13, '#404850')
  px(c, x + 3, y + 3, w - 6, 9, '#082818')
  px(c, x + w / 2 - 2, y + 14, 4, 2, '#404850')
  const width = w - 8
  const baseY = y + 9
  const beat = 60000 / Math.max(20, bpm)
  const sweep = (t / 2400) % 1
  for (let i = 0; i < width; i++) {
    const ms = (i / width) * 2400
    const phase = (ms % beat) / beat
    let dy = 0
    if (!flat) {
      if (phase > 0.1 && phase < 0.13) dy = -1
      else if (phase >= 0.2 && phase < 0.22) dy = 1
      else if (phase >= 0.22 && phase < 0.26) dy = -5
      else if (phase >= 0.26 && phase < 0.29) dy = 2
      else if (phase > 0.45 && phase < 0.55) dy = -1
    }
    const ahead = i / width - sweep
    if (ahead > 0 && ahead < 0.08) continue
    px(c, x + 4 + i, baseY + dy, 1, 1, ahead < 0 && ahead > -0.25 ? '#98ffb0' : '#38c868')
  }
  px(c, x + w - 8, y + 4, 3, 2, '#f8e058')
}

function bed(c: Ctx, p: PropBox) {
  const x = p.x * TILE
  const y = p.y * TILE
  const w = p.w * TILE
  const h = p.h * TILE
  const horizontal = p.w >= p.h
  box(c, x + 1, y + 1, w - 2, h - 2, '#8898a8')
  px(c, x + 3, y + 3, w - 6, h - 6, '#f8f8f8')
  if (horizontal) {
    px(c, x + 14, y + 3, w - 17, h - 6, '#a8d0f0')
    px(c, x + 14, y + 3, 2, h - 6, '#80b0d8')
    box(c, x + 4, y + h / 2 - 6, 9, 12, '#f8f8f8')
    px(c, x + 5, y + h / 2 - 5, 3, 3, '#e8e8f0')
    px(c, x + 1, y + h - 3, w - 2, 1, '#607080')
  } else {
    px(c, x + 3, y + 14, w - 6, h - 17, '#a8d0f0')
    box(c, x + w / 2 - 6, y + 4, 12, 9, '#f8f8f8')
  }
}

function phone(c: Ctx, x: number, y: number) {
  box(c, x + 1, y + 6, 14, 10, '#b87840')
  px(c, x + 2, y + 7, 12, 2, '#d09858')
  box(c, x + 3, y + 2, 10, 7, '#e8e0c8')
  px(c, x + 4, y + 3, 8, 2, '#d04040')
  px(c, x + 5, y + 6, 1, 1, INK)
  px(c, x + 7, y + 6, 1, 1, INK)
  px(c, x + 9, y + 6, 1, 1, INK)
  px(c, x + 12, y + 9, 1, 4, INK)
}

function door(c: Ctx, x: number, y: number) {
  px(c, x, y, TILE, TILE, '#503018')
  box(c, x + 2, y + 1, 12, 15, '#c08850')
  box(c, x + 4, y + 3, 8, 5, '#a8d8f8')
  px(c, x + 11, y + 10, 2, 2, '#f8e058')
  px(c, x + 3, y + 12, 10, 1, '#986030')
}

function hazard(c: Ctx, x: number, y: number) {
  for (let i = 0; i < TILE; i++) {
    const on = Math.floor((i + 0) / 3) % 2 === 0
    px(c, x + i, y + 6, 1, 4, on ? '#f8c830' : INK)
  }
  px(c, x, y + 5, TILE, 1, '#b08818')
  px(c, x, y + 10, TILE, 1, '#b08818')
}

function mat(c: Ctx, x: number, y: number) {
  box(c, x + 2, y + 4, 12, 9, '#c84848')
  px(c, x + 4, y + 6, 8, 1, '#e87878')
  px(c, x + 4, y + 10, 8, 1, '#e87878')
}

function table(c: Ctx, p: PropBox) {
  const x = p.x * TILE
  const y = p.y * TILE
  box(c, x + 1, y + 2, p.w * TILE - 2, p.h * TILE - 4, '#c89058')
  px(c, x + 2, y + 3, p.w * TILE - 4, 2, '#e0b078')
}

function chair(c: Ctx, x: number, y: number) {
  box(c, x + 3, y + 2, 10, 6, '#6878c8')
  box(c, x + 3, y + 7, 10, 6, '#8898e0')
  px(c, x + 4, y + 13, 2, 3, INK)
  px(c, x + 10, y + 13, 2, 3, INK)
}

function whiteboard(c: Ctx, p: PropBox) {
  const x = p.x * TILE
  const y = p.y * TILE
  const w = p.w * TILE
  box(c, x + 1, y + 1, w - 2, 12, '#f8f8f8', '#707880')
  px(c, x + 4, y + 4, w / 2, 1, '#4868c8')
  px(c, x + 4, y + 7, w / 3, 1, '#d04848')
}

function chart(c: Ctx, x: number, y: number) {
  box(c, x + 3, y + 2, 10, 13, '#f8f8f0')
  px(c, x + 6, y + 1, 4, 2, '#707880')
  for (let i = 0; i < 4; i++) px(c, x + 5, y + 5 + i * 2, 6, 1, '#a0a8b0')
}

function plant(c: Ctx, x: number, y: number) {
  box(c, x + 4, y + 10, 8, 6, '#c86838')
  px(c, x + 3, y + 2, 10, 8, '#48a848')
  px(c, x + 5, y + 1, 6, 3, '#68c868')
  px(c, x + 3, y + 2, 1, 8, INK)
  px(c, x + 12, y + 2, 1, 8, INK)
}

function sink(c: Ctx, x: number, y: number) {
  box(c, x + 1, y + 3, 14, 10, '#e8f0f8')
  box(c, x + 4, y + 5, 8, 6, '#b8d0e8')
  px(c, x + 7, y + 1, 2, 5, '#909aa8')
}

function curtain(c: Ctx, p: PropBox) {
  const x = p.x * TILE
  const y = p.y * TILE
  for (let i = 0; i < p.w * TILE; i += 4) {
    px(c, x + i, y, 3, p.h * TILE, '#78a8d8')
    px(c, x + i + 3, y, 1, p.h * TILE, '#5080b0')
  }
  px(c, x, y, p.w * TILE, 2, '#909aa8')
}

/** Floor-level props draw before actors; furniture after the floor. */
export const FLOOR_KINDS = new Set(['hazard', 'mat'])

export function drawProp(c: Ctx, p: PropBox, t: number, monitorBpm = 80, monitorFlat = false) {
  const x = p.x * TILE
  const y = p.y * TILE
  switch (p.kind) {
    case 'bed':
      return bed(c, p)
    case 'monitor':
      return monitor(c, p, t, monitorBpm, monitorFlat)
    case 'hazard':
      for (let i = 0; i < p.w; i++) hazard(c, x + i * TILE, y)
      return
    case 'mat':
      return mat(c, x, y)
    case 'desk':
    case 'table':
    case 'couch':
      return table(c, p)
    case 'whiteboard':
      return whiteboard(c, p)
    case 'curtain':
      return curtain(c, p)
    default:
      break
  }
  for (let dy = 0; dy < p.h; dy++) {
    for (let dx = 0; dx < p.w; dx++) {
      const tx = x + dx * TILE
      const ty = y + dy * TILE
      switch (p.kind) {
        case 'trolley':
          trolley(c, tx, ty, p.id)
          break
        case 'shelf':
          shelf(c, tx, ty)
          break
        case 'phone':
          phone(c, tx, ty)
          break
        case 'door':
          door(c, tx, ty)
          break
        case 'chair':
          chair(c, tx, ty)
          break
        case 'chart':
          chart(c, tx, ty)
          break
        case 'plant':
          plant(c, tx, ty)
          break
        case 'sink':
          sink(c, tx, ty)
          break
        default:
          box(c, tx + 1, ty + 1, TILE - 2, TILE - 2, '#8890a0')
      }
    }
  }
}

/* ---------------------------------------------------------------- patient in bed */

export type BedPose = 'supine' | 'knee' | 'lateral'

/** Patient lying on a horizontal bed, head on the pillow at the bed's left end. */
export function drawPatientInBed(c: Ctx, bedBox: PropBox, look: Look, pose: BedPose, scene: string[], talking: boolean) {
  const x = bedBox.x * TILE
  const y = bedBox.y * TILE
  const h = bedBox.h * TILE
  const mid = y + h / 2
  const skin = look.skin
  if (pose === 'knee') {
    // Knee-chest: head down on the pillow, bottom up, blanket off.
    box(c, x + 5, mid - 4, 8, 8, look.hair)
    box(c, x + 12, mid - 7, 26, 14, look.coat)
    px(c, x + 13, mid - 6, 24, 3, shade(look.coat))
    box(c, x + 36, mid - 6, 8, 12, skin)
    box(c, x + 26, mid + 5, 12, 4, skin)
  } else if (pose === 'lateral') {
    // Left lateral, head down, knees drawn up.
    box(c, x + 4, mid - 5, 10, 10, look.hair)
    px(c, x + 11, mid - 3, 3, 6, skin)
    box(c, x + 13, mid - 6, 22, 12, look.coat)
    box(c, x + 33, mid - 2, 12, 8, skin)
    px(c, x + 14, mid + 6, 30, 2, '#80b0d8')
  } else {
    // Supine: face up, blanket to the chest, arms out.
    box(c, x + 4, mid - 6, 11, 12, look.hair)
    box(c, x + 7, mid - 4, 7, 8, skin)
    px(c, x + 9, mid - 2, 1, 1, INK)
    px(c, x + 9, mid + 1, 1, 1, INK)
    px(c, x + 12, mid - 1, 1, 2, talking ? '#983040' : shade(skin))
    box(c, x + 14, mid - 7, 12, 14, look.coat)
    px(c, x + 15, mid - 6, 10, 2, shade(look.coat))
    box(c, x + 25, mid - 8, bedBox.w * TILE - 30, 16, '#a8d0f0')
    px(c, x + 26, mid - 7, 2, 14, '#80b0d8')
    px(c, x + 18, mid - 9, 5, 2, skin)
    px(c, x + 18, mid + 7, 5, 2, skin)
  }
  if (scene.includes('pads')) {
    px(c, x + 17, mid - 5, 4, 4, '#606870')
    px(c, x + 17, mid + 1, 4, 4, '#606870')
  }
  if (scene.includes('cannula')) px(c, x + 21, mid - 10, 2, 2, '#e04858')
  if (scene.includes('listen')) px(c, x + 30, mid - 3, 3, 3, '#3070c0')
  if (scene.includes('cover')) box(c, x + 38, mid - 3, 6, 6, '#f8f8f8')
  if (scene.includes('lift')) px(c, x + 44, mid - 2, 3, 4, '#88c8f0')
}
