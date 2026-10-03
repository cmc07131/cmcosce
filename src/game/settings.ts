import { create } from 'zustand'
import type { PatientLang } from '~/engine/lang'
import type { AvatarId } from './positional/scene3d'

const KEY = 'osce-gym:settings'

/** Practice help: `guided` shows the objective and exactly what to do next; `objectives` only the phase; `off` like the exam. */
export type Coach = 'guided' | 'objectives' | 'off'

/** `hard`: harder presentations (the TCA patient arrives fitting). */
export type Difficulty = 'normal' | 'hard'

type Stored = { sound: boolean; labels: boolean; patientLang: PatientLang; coach: Coach; difficulty: Difficulty; avatar: AvatarId }

/**
 * `labels` shows NPC name tags on the map. Kit labels always show. Patients speak Cantonese by default.
 * `coach` is guided by default: the phase, and the next action in the perfect script. `avatar`: who plays the patient
 * in the 3D benches.
 */
const defaults: Stored = { sound: false, labels: false, patientLang: 'zh', coach: 'guided', difficulty: 'normal', avatar: 'anime' }

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const stored = JSON.parse(raw) as Partial<Stored> & { objectives?: boolean }
    // Older saves had an on/off objectives switch.
    const coach = stored.coach ?? (stored.objectives === false ? 'off' : defaults.coach)
    return { ...defaults, ...stored, coach }
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
  cycleCoach: () => void
  toggleDifficulty: () => void
  setAvatar: (avatar: AvatarId) => void
}

/** Sound is off until the player turns it on. Loaded on the client only, so SSR renders the defaults. */
export const useSettings = create<SettingsState>((set, get) => {
  const save = (patch: Partial<Stored>) => {
    const next: Stored = { sound: get().sound, labels: get().labels, patientLang: get().patientLang, coach: get().coach, difficulty: get().difficulty, avatar: get().avatar, ...patch }
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
    toggleDifficulty: () => save({ difficulty: get().difficulty === 'normal' ? 'hard' : 'normal' }),
    setAvatar: (avatar) => save({ avatar }),
    cycleCoach: () => save({ coach: get().coach === 'guided' ? 'objectives' : get().coach === 'objectives' ? 'off' : 'guided' }),
  }
})
