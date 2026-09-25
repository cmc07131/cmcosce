import { packSchema, type Pack } from './schema'

type GlobModule = { default?: unknown }

const modules = import.meta.glob('../../content/packs/*/pack.json', {
  eager: true,
}) as Record<string, GlobModule | unknown>

export type PackHit =
  | { ok: true; pack: Pack }
  | { ok: false; packId: string; error: string }

function folderId(path: string) {
  const match = path.match(/packs\/([^/]+)\/pack\.json$/)
  return match?.[1] ?? path
}

function unwrap(mod: GlobModule | unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) return (mod as GlobModule).default
  return mod
}

let cache: PackHit[] | null = null

export function loadPacks(): PackHit[] {
  if (cache) return cache
  cache = Object.entries(modules)
    .map(([path, mod]) => {
      const parsed = packSchema.safeParse(unwrap(mod))
      if (!parsed.success) {
        const packId = folderId(path)
        return {
          ok: false as const,
          packId,
          error: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
        }
      }
      return { ok: true as const, pack: parsed.data }
    })
    .sort((a, b) => {
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
