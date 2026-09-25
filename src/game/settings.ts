import { create } from 'zustand'

const KEY = 'osce-gym:settings'

type Stored = { sound: boolean; labels: boolean }

/** `labels` shows NPC name tags on the map. Kit labels always show. */
const defaults: Stored = { sound: false, labels: false }

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    return { ...defaults, ...(JSON.parse(raw) as Partial<Stored>) }
  } catch {
    return defaults
  }
}

function write(value: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Private mode or blocked storage: settings just do not persist.
  }
}

type SettingsState = Stored & {
  loaded: boolean
  load: () => void
  toggleSound: () => void
  toggleLabels: () => void
}

/** Sound is off until the player turns it on. Loaded on the client only, so SSR renders the defaults. */
export const useSettings = create<SettingsState>((set, get) => ({
  ...defaults,
  loaded: false,
  load: () => {
    if (get().loaded) return
    set({ ...read(), loaded: true })
  },
  toggleSound: () => {
    const next = { sound: !get().sound, labels: get().labels }
    write(next)
    set(next)
  },
  toggleLabels: () => {
    const next = { sound: get().sound, labels: !get().labels }
    write(next)
    set(next)
  },
}))
