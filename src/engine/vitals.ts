import type { Vitals } from './schema'

export type VitalKey = 'hr' | 'sbp' | 'dbp' | 'spo2' | 'rr' | 'temp' | 'etco2' | 'gcs' | 'glucose'
export type VitalsNow = Partial<Record<VitalKey, number>> & { rhythm: string }

const KEYS: VitalKey[] = ['hr', 'sbp', 'dbp', 'spo2', 'rr', 'temp', 'etco2', 'gcs', 'glucose']

const LIMITS: Record<VitalKey, [number, number]> = {
  hr: [0, 250],
  sbp: [0, 260],
  dbp: [0, 160],
  spo2: [0, 100],
  rr: [0, 60],
  temp: [28, 43],
  etco2: [0, 12],
  gcs: [3, 15],
  glucose: [0.5, 50],
}

function clamp(key: VitalKey, value: number) {
  const [lo, hi] = LIMITS[key]
  return Math.min(hi, Math.max(lo, value))
}

/**
 * The patient's numbers `elapsedS` seconds into the station. `sceneAt` says when each scene flag was set.
 * Drift runs until the first `stop` flag; `set` effects replace a value from their moment on, `add` effects
 * ease in over `overS` seconds, so fluids bring the pressure up over half a minute rather than instantly.
 */
export function vitalsAt(v: Vitals, sceneAt: Record<string, number>, elapsedS: number): VitalsNow {
  const stops = (v.stop ?? []).map((s) => sceneAt[s]).filter((t): t is number => t !== undefined && t <= elapsedS)
  const driftEnd = Math.min(elapsedS, ...stops)
  const drift = (key: VitalKey, from: number, to: number) => ((v.drift?.[key] ?? 0) * Math.max(0, Math.min(to, driftEnd) - from)) / 60
  const out: VitalsNow = { rhythm: v.rhythm ?? 'sinus' }
  const setAt: Partial<Record<VitalKey, number>> = {}
  for (const key of KEYS) {
    const base = v[key]
    if (base === undefined) continue
    out[key] = base
  }
  const effects = (v.effects ?? [])
    .map((e) => ({ e, t: sceneAt[e.scene] }))
    .filter((row): row is { e: (typeof row)['e']; t: number } => row.t !== undefined && row.t <= elapsedS)
    .sort((a, b) => a.t - b.t)
  for (const { e, t } of effects) {
    for (const key of KEYS) {
      const s = e.set?.[key]
      if (s !== undefined) {
        out[key] = s
        setAt[key] = t
      }
      const a = e.add?.[key]
      if (a !== undefined && out[key] !== undefined) {
        const over = e.overS ?? 30
        out[key] = (out[key] as number) + a * Math.min(1, (elapsedS - t) / Math.max(1, over))
      }
    }
    if (e.rhythm) out.rhythm = e.rhythm
  }
  for (const key of KEYS) {
    if (out[key] === undefined) continue
    out[key] = clamp(key, (out[key] as number) + drift(key, setAt[key] ?? 0, elapsedS))
  }
  return out
}

const NO_OUTPUT = new Set(['vf', 'asystole', 'pea', 'torsades'])

/** Pulseless rhythms show no pressure or saturation trace on the monitor. */
export function hasOutput(now: VitalsNow) {
  return !NO_OUTPUT.has(now.rhythm) && (now.sbp ?? 1) > 0
}

/** The HUD chip: short enough for a phone. */
export function vitalsLine(now: VitalsNow) {
  if (!hasOutput(now)) return `${now.rhythm.toUpperCase()} · no pulse`
  const r = (n?: number) => (n === undefined ? '—' : Math.round(n))
  return `${r(now.hr)} ${r(now.sbp)}/${r(now.dbp)} ${r(now.spo2)}%`
}

/** Are the leads on? Stations with `showWhen` keep the monitor dark until the nurse attaches them. */
export function monitored(vitals: { showWhen?: string } | undefined, scene: string[]) {
  return !vitals?.showWhen || scene.includes(vitals.showWhen)
}
