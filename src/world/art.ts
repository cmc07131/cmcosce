import { INK, TILE } from '~/game/pixel/art'
import { charAt, tileKind, type Creature, type World } from './model'

/** Original Game Boy Color–style overworld tiles, drawn in code. 16×16 per tile. */

type Ctx = CanvasRenderingContext2D

function px(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  c.fillStyle = fill
  c.fillRect(x, y, w, h)
}

function grass(c: Ctx, x: number, y: number, tx: number, ty: number) {
  px(c, x, y, TILE, TILE, '#98d078')
  const seed = (tx * 7 + ty * 13) % 5
  px(c, x + 3 + seed, y + 4, 1, 2, '#70b058')
  px(c, x + 10 - seed, y + 10, 1, 2, '#70b058')
  px(c, x + 12, y + 3 + seed, 1, 1, '#b8e098')
}

function tall(c: Ctx, x: number, y: number) {
  px(c, x, y, TILE, TILE, '#60a848')
  for (const [dx, dy] of [[1, 2], [7, 1], [12, 4], [3, 9], [9, 8], [14, 11], [5, 13]]) {
    px(c, x + dx, y + dy + 2, 1, 3, '#2f7030')
    px(c, x + dx + 1, y + dy, 1, 5, '#2f7030')
    px(c, x + dx + 2, y + dy + 2, 1, 3, '#2f7030')
    px(c, x + dx + 1, y + dy, 1, 1, '#a8e088')
  }
}

function path(c: Ctx, x: number, y: number, tx: number, ty: number) {
  px(c, x, y, TILE, TILE, '#ead8a8')
  if ((tx + ty) % 3 === 0) px(c, x + 4, y + 6, 2, 1, '#d0bc88')
  if ((tx * 3 + ty) % 4 === 0) px(c, x + 11, y + 12, 1, 1, '#d0bc88')
}

function tree(c: Ctx, x: number, y: number) {
  px(c, x, y, TILE, TILE, '#98d078')
  px(c, x + 6, y + 11, 4, 5, '#7a5030')
  px(c, x + 6, y + 11, 1, 5, INK)
  px(c, x + 9, y + 11, 1, 5, INK)
  px(c, x + 2, y + 1, 12, 11, INK)
  px(c, x + 1, y + 3, 14, 7, INK)
  px(c, x + 3, y + 2, 10, 9, '#3a9040')
  px(c, x + 2, y + 4, 12, 5, '#3a9040')
  px(c, x + 4, y + 3, 4, 3, '#68b858')
  px(c, x + 9, y + 7, 3, 2, '#2a7030')
}

function fence(c: Ctx, x: number, y: number) {
  px(c, x, y, TILE, TILE, '#98d078')
  px(c, x, y + 5, TILE, 2, '#c89858')
  px(c, x, y + 10, TILE, 2, '#c89858')
  px(c, x, y + 7, TILE, 1, '#7a5030')
  px(c, x, y + 12, TILE, 1, '#7a5030')
  px(c, x + 2, y + 3, 3, 12, '#c89858')
  px(c, x + 11, y + 3, 3, 12, '#c89858')
  px(c, x + 2, y + 3, 3, 1, INK)
  px(c, x + 11, y + 3, 3, 1, INK)
}

function flowers(c: Ctx, x: number, y: number, tx: number) {
  px(c, x, y, TILE, TILE, '#98d078')
  const cols = tx % 2 ? ['#f05858', '#f8f8f8'] : ['#f8d048', '#f8f8f8']
  for (const [dx, dy, i] of [[3, 3, 0], [10, 5, 1], [5, 10, 1], [12, 12, 0]]) {
    px(c, x + dx - 1, y + dy, 3, 1, cols[i])
    px(c, x + dx, y + dy - 1, 1, 3, cols[i])
    px(c, x + dx, y + dy, 1, 1, '#f8a030')
  }
}

function water(c: Ctx, x: number, y: number, tx: number) {
  px(c, x, y, TILE, TILE, '#5890e8')
  px(c, x + ((tx * 5) % 8), y + 4, 5, 1, '#a8d0f8')
  px(c, x + ((tx * 3 + 6) % 10), y + 11, 4, 1, '#a8d0f8')
}

export const ROOF: Record<string, string> = {
  atls: '#d04848',
  acls: '#3878d8',
  og: '#e070a8',
  'cmc-hall': '#e0a830',
  shop: '#38a0d8',
}
const CLOSED_ROOF = '#9098a8'

function roof(c: Ctx, x: number, y: number, colour: string, topRow: boolean) {
  px(c, x, y, TILE, TILE, colour)
  for (let i = 0; i < TILE; i += 4) px(c, x, y + i + 3, TILE, 1, 'rgba(0,0,0,0.18)')
  if (topRow) {
    px(c, x, y, TILE, 2, INK)
    px(c, x, y + 2, TILE, 2, 'rgba(255,255,255,0.35)')
  }
}

function wall(c: Ctx, x: number, y: number, tx: number, bottom: boolean, closed: boolean) {
  px(c, x, y, TILE, TILE, '#f0e6cc')
  px(c, x, y + TILE - 1, TILE, 1, '#a89878')
  if (!bottom && tx % 2 === 0) {
    px(c, x + 4, y + 4, 8, 7, INK)
    px(c, x + 5, y + 5, 6, 5, '#98c8f0')
    px(c, x + 5, y + 5, 3, 2, '#d8f0ff')
  }
  if (bottom && closed) {
    for (let i = 0; i < TILE; i += 4) {
      px(c, x + i, y + 8, 2, 4, '#f8c830')
      px(c, x + i + 2, y + 8, 2, 4, INK)
    }
  }
}

function door(c: Ctx, x: number, y: number, closed: boolean) {
  px(c, x, y, TILE, TILE, '#f0e6cc')
  px(c, x + 3, y + 2, 10, 14, INK)
  px(c, x + 4, y + 3, 8, 13, closed ? '#6a5a48' : '#403848')
  if (closed) {
    px(c, x + 3, y + 7, 10, 2, '#f8c830')
    px(c, x + 3, y + 11, 10, 2, '#f8c830')
  }
}

/** Paint the whole static map once. Actors draw on a second canvas above it. */
export function renderWorld(world: World, closedGyms: Set<string>): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = world.cols * TILE
  cv.height = world.rows * TILE
  const c = cv.getContext('2d')!
  c.imageSmoothingEnabled = false
  const owner = new Map<string, { id: string; y: number; h: number }>()
  for (const b of world.buildings) {
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) owner.set(`${b.x + i},${b.y + j}`, { id: b.id, y: b.y, h: b.h })
  }
  for (let ty = 0; ty < world.rows; ty++) {
    for (let tx = 0; tx < world.cols; tx++) {
      const ch = charAt(world, tx, ty)
      const x = tx * TILE
      const y = ty * TILE
      const b = owner.get(`${tx},${ty}`)
      const closed = b ? closedGyms.has(b.id) : false
      switch (tileKind(ch)) {
        case 'grass':
          grass(c, x, y, tx, ty)
          break
        case 'tall':
          tall(c, x, y)
          break
        case 'path':
          path(c, x, y, tx, ty)
          break
        case 'tree':
          tree(c, x, y)
          break
        case 'fence':
          fence(c, x, y)
          break
        case 'flowers':
          flowers(c, x, y, tx)
          break
        case 'water':
          water(c, x, y, tx)
          break
        case 'roof':
          roof(c, x, y, b ? (ROOF[b.id] ?? CLOSED_ROOF) : CLOSED_ROOF, b ? ty === b.y : false)
          break
        case 'wall':
          wall(c, x, y, tx, b ? ty === b.y + b.h - 1 : false, closed)
          break
        case 'door':
          door(c, x, y, closed)
          break
      }
    }
  }
  return cv
}

/** The top of a tall-grass tile, drawn over the player's legs so they wade through it. */
export function grassOverlay(c: Ctx, x: number, y: number) {
  px(c, x + 1, y + 9, 14, 7, '#60a848')
  for (const dx of [1, 5, 9, 13]) {
    px(c, x + dx, y + 8, 1, 3, '#2f7030')
    px(c, x + dx + 1, y + 7, 1, 4, '#2f7030')
    px(c, x + dx + 1, y + 7, 1, 1, '#a8e088')
  }
}

/* ================================================================ creatures */

const BODIES: Record<Creature['body'], string[]> = {
  blob: [
    '................',
    '................',
    '......OOOO......',
    '....OOMMMMOO....',
    '...OMMAAMMMMO...',
    '..OMMAAMMMMMMO..',
    '..OMMMMMMMMMMO..',
    '.OMMEKMMMMEKMMO.',
    '.OMMKKMMMMKKMMO.',
    '.OMMMMMMMMMMMMO.',
    '.OMMMMOOOOMMMMO.',
    '.OMMMMMMMMMMMMO.',
    '..OMMMMMMMMMMO..',
    '...OOMMMMMMOO...',
    '.....OOOOOO.....',
    '................',
  ],
  bird: [
    '................',
    '......OOO.......',
    '.....OMMMO......',
    '....OMEKMMO.....',
    '....OMKKMMOOO...',
    '....OMMMMOAAO...',
    '...OMMMMMMOO....',
    '.OOMMAAAMMMO....',
    'OMMMAAAAMMMMO...',
    'OMMMMAAAMMMMMO..',
    '.OMMMMMMMMMMMO..',
    '..OOMMMMMMMMO...',
    '....OOMMMMOO....',
    '.....OAO.OAO....',
    '.....OAO.OAO....',
    '....OOO..OOO....',
  ],
  beast: [
    '................',
    '..OO....OO......',
    '.OAMO..OMAO.....',
    '.OMMMOOMMMO.....',
    'OMMEKMMMEKMO....',
    'OMMKKMMMKKMO....',
    'OMMMMMMMMMMOOOO.',
    '.OMMAAAAMMMMMMMO',
    '.OMAAAAAAMMMMMMO',
    '..OMMMMMMMMMMMO.',
    '..OMMMMMMMMMMMO.',
    '..OMMOOOOOOMMO..',
    '..OMO......OMO..',
    '..OMO......OMO..',
    '..OOO......OOO..',
    '................',
  ],
  snake: [
    '................',
    '........OOOO....',
    '.......OMMMMO...',
    '......OMEKMMMO..',
    '......OMKKMMMO..',
    '......OMMMMMO...',
    '.......OMMMO....',
    '....OOOMMMO.....',
    '...OMMMMMO......',
    '..OMMAAMO.......',
    '..OMAAMMOOOOO...',
    '..OMMMMMMMMMMO..',
    '...OMMAAAAMMMMO.',
    '....OOMMMMMMOO..',
    '......OOOOOO....',
    '................',
  ],
}

const creatureCache = new Map<string, HTMLCanvasElement>()

/** A 16×16 creature, facing the player. */
export function creatureSprite(cr: Creature): HTMLCanvasElement {
  const hit = creatureCache.get(cr.id)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = 16
  cv.height = 16
  const c = cv.getContext('2d')!
  BODIES[cr.body].forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x]
      const fill = ch === 'O' || ch === 'K' ? INK : ch === 'M' ? cr.main : ch === 'A' ? cr.accent : ch === 'E' ? '#f8f8f8' : null
      if (!fill) continue
      c.fillStyle = fill
      c.fillRect(x, y, 1, 1)
    }
  })
  creatureCache.set(cr.id, cv)
  return cv
}
