import { create } from 'zustand'
import type { PatientLang } from '~/engine/lang'
import type { AvatarId } from './positional/scene3d'

const KEY = 'osce-gym:settings'

/** Practice help: `guided` shows the objective and exactly what to do next; `objectives` only the phase; `off` like the exam. */
export type Coach = 'guided' | 'objectives' | 'off'

/** `hard`: harder presentations (the TCA patient arrives fitting). */
export type Difficulty = 'normal' | 'hard'

/** How fast you walk and run (on the map and in the room), and how fast the 3D examinations play: a multiplier. */
export const SPEEDS = [0.75, 1, 1.5, 2] as const
export type Speed = (typeof SPEEDS)[number]
export const speedLabel = (x: number) => (x === 0.75 ? 'SLOW' : x === 1 ? 'NORMAL' : x === 1.5 ? 'FAST' : 'FASTEST')

type Stored = { sound: boolean; labels: boolean; patientLang: PatientLang; coach: Coach; difficulty: Difficulty; patientModel: AvatarId; customModelName: string | null; walkSpeed: Speed; animSpeed: Speed }

/**
 * `labels` shows NPC name tags on the map. Kit labels always show. Patients speak Cantonese by default.
 * `coach` is guided by default: the phase, and the next action in the perfect script. `patientModel`: who plays the
 * patient in the 3D benches, realistic by default; `customModelName` names the player's own model kept on this device.
 */
const defaults: Stored = { sound: false, labels: false, patientLang: 'zh', coach: 'guided', difficulty: 'normal', patientModel: 'realistic', customModelName: null, walkSpeed: 1, animSpeed: 1 }

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const stored = JSON.parse(raw) as Partial<Stored> & { objectives?: boolean }
    // Older saves had an on/off objectives switch.
    const coach = stored.coach ?? (stored.objectives === false ? 'off' : defaults.coach)
    const speed = (x: unknown): Speed => (SPEEDS as readonly unknown[]).includes(x) ? (x as Speed) : 1
    return { ...defaults, ...stored, coach, walkSpeed: speed(stored.walkSpeed), animSpeed: speed(stored.animSpeed) }
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
  setPatientModel: (patientModel: AvatarId, customModelName?: string | null) => void
  cycleWalkSpeed: () => void
  cycleAnimSpeed: () => void
}

const nextSpeed = (x: Speed): Speed => SPEEDS[(SPEEDS.indexOf(x) + 1) % SPEEDS.length]

/** Sound is off until the player turns it on. Loaded on the client only, so SSR renders the defaults. */
export const useSettings = create<SettingsState>((set, get) => {
  const save = (patch: Partial<Stored>) => {
    const next: Stored = { sound: get().sound, labels: get().labels, patientLang: get().patientLang, coach: get().coach, difficulty: get().difficulty, patientModel: get().patientModel, customModelName: get().customModelName, walkSpeed: get().walkSpeed, animSpeed: get().animSpeed, ...patch }
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
    setPatientModel: (patientModel, customModelName) => save(customModelName === undefined ? { patientModel } : { patientModel, customModelName }),
    cycleWalkSpeed: () => save({ walkSpeed: nextSpeed(get().walkSpeed) }),
    cycleAnimSpeed: () => save({ animSpeed: nextSpeed(get().animSpeed) }),
    cycleCoach: () => save({ coach: get().coach === 'guided' ? 'objectives' : get().coach === 'objectives' ? 'off' : 'guided' }),
  }
})
