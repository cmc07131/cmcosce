import { z } from 'zod'

/** The overworld and the flashcard decks are data files, like the station packs. Pure: no Vite imports, so tests can use it. */

const tile = z.object({ x: z.number().int(), y: z.number().int() })

export const worldSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  start: tile,
  grid: z.array(z.string()),
  buildings: z.array(z.object({ id: z.string(), x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int(), door: tile })),
  gyms: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      badge: z.string(),
      packs: z.array(z.string()),
      deck: z.string().nullable(),
      topics: z.array(z.string()),
      door: tile,
    }),
  ),
  places: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(['board', 'shop']), door: tile })),
})

export type World = z.infer<typeof worldSchema>
export type Gym = World['gyms'][number]

export const cardSchema = z.object({
  id: z.string(),
  q: z.string(),
  options: z.array(z.string()).length(4),
  /** Index of the right answer in `options`. The order is shuffled every time the card is shown. */
  answer: z.number().int().min(0).max(3),
  why: z.string(),
  source: z.string(),
  /** Where the guideline disagrees with common notes. */
  note: z.string().optional(),
})

export const creatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  body: z.enum(['blob', 'bird', 'beast', 'snake']),
  main: z.string(),
  accent: z.string(),
})

export const deckSchema = z.object({
  deck: z.string(),
  name: z.string(),
  creatures: z.array(creatureSchema).min(1),
  cards: z.array(cardSchema).min(1),
})

export type Card = z.infer<typeof cardSchema>
export type Creature = z.infer<typeof creatureSchema>
export type Deck = z.infer<typeof deckSchema>

/** Tall-grass letters pick a deck. `x` is every active deck mixed. */
export const GRASS_DECK: Record<string, string> = { a: 'atls', c: 'acls', o: 'og', x: 'mixed' }

export function deckFor(decks: Record<string, Deck>, key: string): Deck | null {
  if (key !== 'mixed') return decks[key] ?? null
  const all = Object.values(decks)
  if (!all.length) return null
  return { deck: 'mixed', name: 'Mixed', creatures: all.flatMap((d) => d.creatures), cards: all.flatMap((d) => d.cards) }
}

/* ---------------------------------------------------------------- the grid */

export type TileKind = 'grass' | 'path' | 'tree' | 'fence' | 'flowers' | 'water' | 'roof' | 'wall' | 'door' | 'tall'

export function tileKind(ch: string): TileKind {
  switch (ch) {
    case ',':
      return 'path'
    case 'T':
      return 'tree'
    case 'F':
      return 'fence'
    case '*':
      return 'flowers'
    case '~':
      return 'water'
    case 'R':
      return 'roof'
    case '#':
      return 'wall'
    case 'D':
      return 'door'
    default:
      return GRASS_DECK[ch] ? 'tall' : 'grass'
  }
}

const SOLID = new Set<TileKind>(['tree', 'fence', 'water', 'roof', 'wall'])

export function charAt(world: World, x: number, y: number) {
  return world.grid[y]?.[x] ?? 'T'
}

export function worldSolids(world: World): Set<string> {
  const out = new Set<string>()
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) if (SOLID.has(tileKind(charAt(world, x, y)))) out.add(`${x},${y}`)
  }
  return out
}

export type DoorHit = { kind: 'gym'; gym: Gym } | { kind: 'board' } | { kind: 'shop' }

export function doorAt(world: World, x: number, y: number): DoorHit | null {
  const gym = world.gyms.find((g) => g.door.x === x && g.door.y === y)
  if (gym) return { kind: 'gym', gym }
  const place = world.places.find((p) => p.door.x === x && p.door.y === y)
  if (place) return { kind: place.kind }
  return null
}

/** Stand on the path just below a door, facing it. */
export function outsideDoor(door: { x: number; y: number }) {
  return { x: door.x, y: door.y + 1, facing: 'n' as const }
}
