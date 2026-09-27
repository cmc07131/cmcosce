import stationIndex from 'virtual:station-index'
import { packSchema, type Pack } from './schema'
import { compileStation, stationSchema } from './station'

/**
 * Stations load on demand. The lists (world, gym, title) read a build-time index (see vite.config.ts),
 * so the first screen does not carry every script.
 */

type Loader = () => Promise<unknown>

const stationFiles = import.meta.glob('../../content/stations/*/*.json', { import: 'default' }) as Record<string, Loader>

const packFiles = import.meta.glob('../../content/packs/*/pack.json', { import: 'default' }) as Record<string, Loader>

export type PackHit =
  | { ok: true; pack: Pack }
  | { ok: false; packId: string; error: string }

/** What a list needs to show a station without loading it. */
export type PackInfo = {
  packId: string
  title: string
  stationType: Pack['meta']['stationType']
  timeLimitSec: number
  gym?: string
  placeholder?: boolean
}

function stationIdOf(path: string) {
  const m = path.match(/stations\/([^/]+)\/([^/]+)\.json$/)
  return m ? { gym: m[1], id: m[2] } : null
}

function packIdOf(path: string) {
  return path.match(/packs\/([^/]+)\/pack\.json$/)?.[1] ?? path
}

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
}

/** A station script becomes a pack; either can fail validation, and the play screen shows why. */
export function stationHit(path: string, raw: unknown): PackHit {
  const script = stationSchema.safeParse(raw)
  if (!script.success) return { ok: false, packId: stationIdOf(path)?.id ?? path, error: issues(script.error) }
  try {
    const parsed = packSchema.safeParse(compileStation(script.data))
    if (!parsed.success) return { ok: false, packId: script.data.id, error: issues(parsed.error) }
    return { ok: true, pack: parsed.data }
  } catch (err) {
    return { ok: false, packId: script.data.id, error: String(err instanceof Error ? err.message : err) }
  }
}

const catalog: PackInfo[] = [...stationIndex.packs, ...stationIndex.stations]
  .map((st): PackInfo => ({ packId: st.id, title: st.title ?? st.id, stationType: (st.type ?? 'resus') as PackInfo['stationType'], timeLimitSec: st.time ?? 420, gym: st.gym }))
  .sort((a, b) => a.packId.localeCompare(b.packId))

const byId = new Map(catalog.map((info) => [info.packId, info]))

/** Every station and pack, for lists. Cheap: nothing is parsed. */
export function packCatalog(): PackInfo[] {
  return catalog
}

export function packInfo(packId: string): PackInfo | undefined {
  return byId.get(packId)
}

const loaded = new Map<string, Promise<PackHit>>()

/** Loads, validates and compiles one station (or legacy pack) the first time it is asked for. */
export function loadPack(packId: string): Promise<PackHit> {
  const hit = loaded.get(packId)
  if (hit) return hit
  const stationPath = Object.keys(stationFiles).find((p) => stationIdOf(p)?.id === packId)
  const packPath = Object.keys(packFiles).find((p) => packIdOf(p) === packId)
  const next: Promise<PackHit> = stationPath
    ? stationFiles[stationPath]().then((raw) => stationHit(stationPath, raw))
    : packPath
      ? packFiles[packPath]().then((raw): PackHit => {
          const parsed = packSchema.safeParse(raw)
          return parsed.success ? { ok: true, pack: parsed.data } : { ok: false, packId, error: issues(parsed.error) }
        })
      : Promise.resolve({ ok: false, packId, error: 'No station with this id.' })
  loaded.set(packId, next)
  return next
}

/** Every pack that belongs to a gym: listed on the gym in world.json, or a station filed under it. */
export function packsForGym(gymId: string, listed: string[]): string[] {
  const ids = new Set(listed)
  for (const info of catalog) if (info.gym === gymId) ids.add(info.packId)
  return [...ids]
}
