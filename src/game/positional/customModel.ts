/**
 * The player's own patient model, kept in this browser only (IndexedDB): never uploaded, never part of the app.
 *
 * Takes a VRM (.vrm), or a VRoid Studio .xroid (a zip whose `Base` entry is the VRM).
 */

const DB = 'osce-gym'
const STORE = 'models'
const KEY = 'custom'

export type CustomModel = { name: string; credit: string; bytes: ArrayBuffer }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function readCustomModel(): Promise<CustomModel | null> {
  try {
    return ((await tx('readonly', (s) => s.get(KEY))) as CustomModel | undefined) ?? null
  } catch {
    return null
  }
}

export async function removeCustomModel() {
  await tx('readwrite', (s) => s.delete(KEY))
}

/** Check the file is a VRM model and keep it. Throws a message fit to show the player. */
export async function saveCustomModel(file: File): Promise<CustomModel> {
  let bytes = await file.arrayBuffer()
  if (isZip(bytes)) bytes = await unzipEntry(bytes, 'Base')
  const json = glbJson(bytes)
  const ext = (json.extensions ?? {}) as Record<string, { meta?: Record<string, unknown> }>
  const meta = ext.VRMC_vrm?.meta ?? ext.VRM?.meta
  if (!meta) throw new Error('That model has no VRM data. Export it from VRoid Studio as VRM.')
  const name = String(meta.name ?? meta.title ?? file.name.replace(/\.\w+$/, '')) || 'My model'
  const authors = Array.isArray(meta.authors) ? meta.authors.join(', ') : String(meta.author ?? '')
  const model: CustomModel = { name, credit: `3D avatar: ${name}${authors ? ` by ${authors}` : ''} (yours, on this device only)`, bytes }
  await tx('readwrite', (s) => s.put(model, KEY))
  return model
}

/* ------------------------------------------------------------------ formats */

const isZip = (b: ArrayBuffer) => new DataView(b).getUint32(0, true) === 0x04034b50

function glbJson(b: ArrayBuffer): Record<string, unknown> {
  const v = new DataView(b)
  if (b.byteLength < 20 || v.getUint32(0, true) !== 0x46546c67) throw new Error('That file is not a VRM model (.vrm or .xroid).')
  const len = v.getUint32(12, true)
  return JSON.parse(new TextDecoder().decode(new Uint8Array(b, 20, len))) as Record<string, unknown>
}

/** One entry of a zip archive, by name (stored or deflated). */
async function unzipEntry(b: ArrayBuffer, want: string): Promise<ArrayBuffer> {
  const v = new DataView(b)
  // The end-of-central-directory record is in the last 64 KiB.
  let end = -1
  for (let i = b.byteLength - 22; i >= Math.max(0, b.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('That .xroid file looks damaged.')
  const count = v.getUint16(end + 10, true)
  let at = v.getUint32(end + 16, true)
  for (let n = 0; n < count; n++) {
    if (v.getUint32(at, true) !== 0x02014b50) break
    const method = v.getUint16(at + 10, true)
    const size = v.getUint32(at + 20, true)
    const nameLen = v.getUint16(at + 28, true)
    const extraLen = v.getUint16(at + 30, true)
    const commentLen = v.getUint16(at + 32, true)
    const local = v.getUint32(at + 42, true)
    const name = new TextDecoder().decode(new Uint8Array(b, at + 46, nameLen))
    at += 46 + nameLen + extraLen + commentLen
    if (name !== want) continue
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const data = new Uint8Array(b, start, size)
    if (method === 0) return data.slice().buffer
    if (method !== 8) break
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Response(stream).arrayBuffer()
  }
  throw new Error('No VRM model inside that .xroid file.')
}
