import stationCards from 'virtual:station-cards'
import worldJson from '../../content/world/world.json'
import { packsForGym } from '~/engine/loadPacks'
import { deckFor as pick, deckSchema, worldSchema, type Deck, type World } from './model'

/** Loads the world and every deck in content/cards through Vite. Station scripts join their gym. */
const parsed = worldSchema.parse(worldJson)
export const WORLD: World = { ...parsed, gyms: parsed.gyms.map((g) => ({ ...g, packs: packsForGym(g.id, g.packs) })) }

const deckModules = import.meta.glob('../../content/cards/*.json', { eager: true }) as Record<string, { default?: unknown } | unknown>

/** Flashcards from station scripts, grouped by gym (answer index 0; the battle shuffles). */
const extra: Record<string, Deck['cards']> = {}
for (const st of stationCards) {
  st.cards.forEach((card, i) => (extra[st.gym] ??= []).push({ id: `${st.id}-c${i + 1}`, answer: 0, ...card }))
}

/** Deck files give each gym its creatures and general cards; each station adds its own cards. */
export const DECKS: Record<string, Deck> = Object.fromEntries(
  Object.values(deckModules).map((mod) => {
    const raw = mod && typeof mod === 'object' && 'default' in mod ? (mod as { default: unknown }).default : mod
    const deck = deckSchema.parse(raw)
    const known = new Set(deck.cards.map((c) => c.id))
    const more = (extra[deck.deck] ?? []).filter((c) => !known.has(c.id))
    return [deck.deck, { ...deck, cards: [...deck.cards, ...more] }]
  }),
)

export function deckFor(key: string): Deck | null {
  return pick(DECKS, key)
}
