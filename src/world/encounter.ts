import type { Card, Creature, Deck } from './model'

/** Chance that a step into tall grass starts an encounter. */
export const ENCOUNTER_RATE = 1 / 8
/** Steps after a battle before grass can trigger again. */
export const GRACE_STEPS = 3

/** Coins for a right answer: 10, plus 5 for each answer already in the streak, capped at 30. */
export function coinsFor(streakBefore: number) {
  return Math.min(30, 10 + 5 * Math.max(0, streakBefore))
}

export type CardStats = Record<string, { r: number; w: number }>

/**
 * Cards you got wrong come back most, unseen cards next, cards you know least.
 * `rand` returns [0, 1).
 */
export function pickCard(cards: Card[], seen: CardStats, rand: () => number, avoid?: string): Card {
  const pool = cards.length > 1 && avoid ? cards.filter((c) => c.id !== avoid) : cards
  const weight = (c: Card) => {
    const s = seen[c.id]
    if (!s) return 2
    if (s.w > s.r) return 3
    return 1
  }
  const total = pool.reduce((sum, c) => sum + weight(c), 0)
  let roll = rand() * total
  for (const c of pool) {
    roll -= weight(c)
    if (roll < 0) return c
  }
  return pool[pool.length - 1]
}

export function pickCreature(deck: Deck, rand: () => number): Creature {
  return deck.creatures[Math.floor(rand() * deck.creatures.length)] ?? deck.creatures[0]
}

/** The same four options in a fresh order, and where the right one landed. */
export function shuffled(card: Card, rand: () => number): { options: string[]; correct: number } {
  const order = card.options.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { options: order.map((i) => card.options[i]), correct: order.indexOf(card.answer) }
}
