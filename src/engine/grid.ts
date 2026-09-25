import type { Dir, Pack, Pos, Tile } from './schema'
import { SOLID_KINDS } from './schema'

export const DIR_DELTA: Record<Dir, Tile> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
}

const DIRS: Dir[] = ['n', 'e', 's', 'w']

export function keyOf(t: Tile) {
  return `${t.x},${t.y}`
}

export function keyToDir(key: string): Dir | null {
  switch (key.toLowerCase()) {
    case 'a':
    case 'arrowleft':
      return 'w'
    case 'd':
    case 'arrowright':
      return 'e'
    case 'w':
    case 'arrowup':
      return 'n'
    case 's':
    case 'arrowdown':
      return 's'
    default:
      return null
  }
}

/** Screen y grows downward. Right is +x → east. Left is −x → west. */
export function vectorToDir(dx: number, dy: number, dead = 0.28): Dir | null {
  if (Math.hypot(dx, dy) < dead) return null
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'e' : 'w'
  return dy > 0 ? 's' : 'n'
}

export function tilesOf(obj: { x: number; y: number; w?: number; h?: number }): Tile[] {
  const w = obj.w ?? 1
  const h = obj.h ?? 1
  const out: Tile[] = []
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) out.push({ x: obj.x + dx, y: obj.y + dy })
  }
  return out
}

export function buildSolids(pack: Pack): Set<string> {
  const solids = new Set<string>()
  for (const prop of pack.room.props) {
    if (!SOLID_KINDS.has(prop.kind)) continue
    for (const t of tilesOf(prop)) solids.add(keyOf(t))
  }
  for (const item of pack.room.interactables) {
    if (!SOLID_KINDS.has(item.kind)) continue
    for (const t of tilesOf(item)) solids.add(keyOf(t))
  }
  for (const npc of pack.cast) solids.add(keyOf(npc.spawn))
  return solids
}

export function inBounds(t: Tile, cols: number, rows: number) {
  return t.x >= 0 && t.y >= 0 && t.x < cols && t.y < rows
}

export function step(pos: Pos, dir: Dir, solids: Set<string>, cols: number, rows: number): Pos {
  const d = DIR_DELTA[dir]
  const next = { x: pos.x + d.x, y: pos.y + d.y }
  if (!inBounds(next, cols, rows) || solids.has(keyOf(next))) {
    return { ...pos, facing: dir }
  }
  return { x: next.x, y: next.y, facing: dir }
}

export function findPath(
  from: Tile,
  to: Tile,
  solids: Set<string>,
  cols: number,
  rows: number,
): Tile[] | null {
  if (!inBounds(from, cols, rows) || !inBounds(to, cols, rows)) return null
  if (solids.has(keyOf(to))) return null
  if (from.x === to.x && from.y === to.y) return []
  const q: Tile[] = [from]
  const prev = new Map<string, string | null>()
  prev.set(keyOf(from), null)
  while (q.length) {
    const cur = q.shift()!
    for (const dir of DIRS) {
      const d = DIR_DELTA[dir]
      const nxt = { x: cur.x + d.x, y: cur.y + d.y }
      const k = keyOf(nxt)
      if (!inBounds(nxt, cols, rows) || solids.has(k) || prev.has(k)) continue
      prev.set(k, keyOf(cur))
      if (nxt.x === to.x && nxt.y === to.y) {
        const path: Tile[] = [nxt]
        let walk: string | null = keyOf(cur)
        while (walk && walk !== keyOf(from)) {
          const [xs, ys] = walk.split(',')
          path.push({ x: Number(xs), y: Number(ys) })
          walk = prev.get(walk) ?? null
        }
        path.reverse()
        return path
      }
      q.push(nxt)
    }
  }
  return null
}

function cardinalTouch(a: Tile, b: Tile) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}

export function facingToward(from: Tile, targetTiles: Tile[]): Dir {
  let best = targetTiles[0]
  let bestD = Infinity
  for (const t of targetTiles) {
    const d = Math.abs(t.x - from.x) + Math.abs(t.y - from.y)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  const dx = best.x - from.x
  const dy = best.y - from.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'e' : 'w'
  if (dy > 0) return 's'
  if (dy < 0) return 'n'
  return 'n'
}

export type Activation = { path: Tile[]; stand: Tile; facing: Dir }

/** Path to a free tile beside the target, then face it. Never stands on the target. */
export function planActivation(
  from: Tile,
  targetTiles: Tile[],
  solids: Set<string>,
  cols: number,
  rows: number,
): Activation | null {
  if (!targetTiles.length) return null
  const stands: Tile[] = []
  const seen = new Set<string>()
  for (const t of targetTiles) {
    for (const dir of DIRS) {
      const d = DIR_DELTA[dir]
      const n = { x: t.x + d.x, y: t.y + d.y }
      const k = keyOf(n)
      if (seen.has(k)) continue
      seen.add(k)
      if (!inBounds(n, cols, rows) || solids.has(k)) continue
      if (targetTiles.some((tt) => tt.x === n.x && tt.y === n.y)) continue
      if (cardinalTouch(n, t)) stands.push(n)
    }
  }
  if (!stands.length) return null

  let best: Activation | null = null
  for (const stand of stands) {
    const path = findPath(from, stand, solids, cols, rows)
    if (!path) continue
    const facing = facingToward(stand, targetTiles)
    if (!best || path.length < best.path.length) best = { path, stand, facing }
  }
  return best
}

export function targetTilesFor(
  pack: Pack,
  targetId: string,
): Tile[] {
  const npc = pack.cast.find((c) => c.id === targetId)
  if (npc) return [npc.spawn]
  const item = pack.room.interactables.find((i) => i.id === targetId)
  if (item) return tilesOf(item)
  return []
}
