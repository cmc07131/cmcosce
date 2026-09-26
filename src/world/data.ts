import worldJson from '../../content/world/world.json'
import { deckFor as pick, deckSchema, worldSchema, type Deck, type World } from './model'

/** Loads the world and every deck in content/cards through Vite. */
export const WORLD: World = worldSchema.parse(worldJson)

const deckModules = import.meta.glob('../../content/cards/*.json', { eager: true }) as Record<string, { default?: unknown } | unknown>

export const DECKS: Record<string, Deck> = Object.fromEntries(
  Object.values(deckModules).map((mod) => {
    const raw = mod && typeof mod === 'object' && 'default' in mod ? (mod as { default: unknown }).default : mod
    const deck = deckSchema.parse(raw)
    return [deck.deck, deck]
  }),
)

export function deckFor(key: string): Deck | null {
  return pick(DECKS, key)
}
