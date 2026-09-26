import { create } from 'zustand'
import type { Dir } from '~/engine/schema'
import { coinsFor, type CardStats } from './encounter'

/**
 * Your save on this device: coins, streak, cards seen, creatures beaten, stations cleared, where you stood.
 * Kept in localStorage; if storage is blocked the game still plays, it just forgets on reload.
 */

const KEY = 'osce-gym:progress:v1'

type Saved = {
  coins: number
  streak: number
  bestStreak: number
  seen: CardStats
  dex: Record<string, number>
  cleared: string[]
  pos: { x: number; y: number; facing: Dir } | null
}

const EMPTY: Saved = { coins: 0, streak: 0, bestStreak: 0, seen: {}, dex: {}, cleared: [], pos: null }

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) }
  } catch {
    return EMPTY
  }
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage blocked: play on without saving
  }
}

type ProgressState = Saved & {
  loaded: boolean
  load: () => void
  /** Record an answer. Returns the coins earned (0 if wrong). */
  answer: (cardId: string, creatureId: string, right: boolean) => number
  ran: () => void
  moveTo: (pos: Saved['pos']) => void
  clearStation: (packId: string) => void
}

function pick(s: ProgressState): Saved {
  return { coins: s.coins, streak: s.streak, bestStreak: s.bestStreak, seen: s.seen, dex: s.dex, cleared: s.cleared, pos: s.pos }
}

export const useProgress = create<ProgressState>((set, get) => {
  const commit = (patch: Partial<Saved>) => {
    const next = { ...pick(get()), ...patch }
    write(next)
    set(next)
  }
  return {
    ...EMPTY,
    loaded: false,
    load: () => {
      if (get().loaded) return
      set({ ...read(), loaded: true })
    },
    answer: (cardId, creatureId, right) => {
      const cur = get()
      const stats = cur.seen[cardId] ?? { r: 0, w: 0 }
      const seen = { ...cur.seen, [cardId]: right ? { ...stats, r: stats.r + 1 } : { ...stats, w: stats.w + 1 } }
      if (!right) {
        commit({ seen, streak: 0 })
        return 0
      }
      const earned = coinsFor(cur.streak)
      const streak = cur.streak + 1
      commit({
        seen,
        streak,
        bestStreak: Math.max(cur.bestStreak, streak),
        coins: cur.coins + earned,
        dex: { ...cur.dex, [creatureId]: (cur.dex[creatureId] ?? 0) + 1 },
      })
      return earned
    },
    ran: () => commit({ streak: 0 }),
    moveTo: (pos) => commit({ pos }),
    clearStation: (packId) => {
      if (get().cleared.includes(packId)) return
      commit({ cleared: [...get().cleared, packId] })
    },
  }
})
