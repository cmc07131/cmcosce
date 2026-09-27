import { create } from 'zustand'
import type { PatientLang } from '~/engine/lang'

const KEY = 'osce-gym:settings'

type Stored = { sound: boolean; labels: boolean; patientLang: PatientLang }

/** `labels` shows NPC name tags on the map. Kit labels always show. Patients speak Cantonese by default. */
const defaults: Stored = { sound: false, labels: false, patientLang: 'zh' }

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
  toggleLang: () => void
}

/** Sound is off until the player turns it on. Loaded on the client only, so SSR renders the defaults. */
export const useSettings = create<SettingsState>((set, get) => {
  const save = (patch: Partial<Stored>) => {
    const next: Stored = { sound: get().sound, labels: get().labels, patientLang: get().patientLang, ...patch }
    write(next)
    set(next)
  }
  return {
    ...defaults,
    loaded: false,
    load: () => {
      if (get().loaded) return
      set({ ...read(), loaded: true })
    },
    toggleSound: () => save({ sound: !get().sound }),
    toggleLabels: () => save({ labels: !get().labels }),
    toggleLang: () => save({ patientLang: get().patientLang === 'zh' ? 'en' : 'zh' }),
  }
})
