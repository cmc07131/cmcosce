import { packSchema, type Pack } from './schema'
import { compileStation, stationCards, stationSchema, type Station } from './station'

type GlobModule = { default?: unknown }

const modules = import.meta.glob('../../content/packs/*/pack.json', {
  eager: true,
}) as Record<string, GlobModule | unknown>

const stationModules = import.meta.glob('../../content/stations/*/*.json', {
  eager: true,
}) as Record<string, GlobModule | unknown>

export type PackHit =
  | { ok: true; pack: Pack }
  | { ok: false; packId: string; error: string }

function folderId(path: string) {
  const match = path.match(/packs\/([^/]+)\/pack\.json$/) ?? path.match(/stations\/[^/]+\/([^/]+)\.json$/)
  return match?.[1] ?? path
}

function unwrap(mod: GlobModule | unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) return (mod as GlobModule).default
  return mod
}

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
}

/** A station script becomes a pack; either can fail validation, and the gym list shows why. */
export function stationHit(path: string, raw: unknown): PackHit {
  const script = stationSchema.safeParse(raw)
  if (!script.success) return { ok: false, packId: folderId(path), error: issues(script.error) }
  try {
    const parsed = packSchema.safeParse(compileStation(script.data))
    if (!parsed.success) return { ok: false, packId: script.data.id, error: issues(parsed.error) }
    return { ok: true, pack: parsed.data }
  } catch (err) {
    return { ok: false, packId: script.data.id, error: String(err instanceof Error ? err.message : err) }
  }
}

/** Every station script that parses, for their flashcards. */
export function loadStations(): Station[] {
  return Object.values(stationModules)
    .map((mod) => stationSchema.safeParse(unwrap(mod)))
    .flatMap((r) => (r.success ? [r.data] : []))
}

/** Flashcards from station scripts, grouped by gym. */
export function stationCardsByGym(): Record<string, ReturnType<typeof stationCards>> {
  const out: Record<string, ReturnType<typeof stationCards>> = {}
  for (const st of loadStations()) (out[st.gym] ??= []).push(...stationCards(st))
  return out
}

let cache: PackHit[] | null = null

export function loadPacks(): PackHit[] {
  if (cache) return cache
  const packs = Object.entries(modules).map(([path, mod]): PackHit => {
    const parsed = packSchema.safeParse(unwrap(mod))
    if (!parsed.success) return { ok: false, packId: folderId(path), error: issues(parsed.error) }
    return { ok: true, pack: parsed.data }
  })
  const stations = Object.entries(stationModules).map(([path, mod]) => stationHit(path, unwrap(mod)))
  cache = [...packs, ...stations].sort((a, b) => {
    const ida = a.ok ? a.pack.packId : a.packId
    const idb = b.ok ? b.pack.packId : b.packId
    return ida.localeCompare(idb)
  })
  return cache
}

export function getPack(packId: string): Pack | undefined {
  for (const hit of loadPacks()) {
    if (hit.ok && hit.pack.packId === packId) return hit.pack
  }
  return undefined
}

/** Every pack that belongs to a gym: listed on the gym in world.json, or a station script naming it. */
export function packsForGym(gymId: string, listed: string[]): string[] {
  const ids = new Set(listed)
  for (const hit of loadPacks()) if (hit.ok && hit.pack.meta.gym === gymId) ids.add(hit.pack.packId)
  return [...ids]
}
