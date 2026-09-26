/**
 * Renders the image library to PNG contact sheets, for checking the anatomy by eye without a browser.
 *   npx tsx scripts/render-images.ts <outDir> [prefix]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { toRgba } from '../src/game/imaging/field'
import { IMAGES, imageEntry } from '../src/game/imaging/library'

function crc32(buf: Buffer) {
  let c: number
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(w: number, h: number, rgba: Uint8ClampedArray) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const out = process.argv[2] ?? 'image-check'
const prefix = process.argv[3] ?? ''
mkdirSync(out, { recursive: true })
const refs = [...Object.keys(IMAGES), 'photo:burns:chest-partial,abdomen-partial,r-arm-full,head-superficial'].filter((r) => r.startsWith(prefix))
const SCALE = 3
const CELL = 160 * SCALE
const cols = 3
for (let page = 0; page * 6 < refs.length; page++) {
  const slice = refs.slice(page * 6, page * 6 + 6)
  const rows = Math.ceil(slice.length / cols)
  const W = cols * CELL
  const H = rows * CELL
  const sheet = new Uint8ClampedArray(W * H * 4).fill(40)
  slice.forEach((ref, i) => {
    const pic = imageEntry(ref)!.make()
    const w = pic.kind === 'grey' ? pic.field.w : pic.pixels.w
    const h = pic.kind === 'grey' ? pic.field.h : pic.pixels.h
    const data = pic.kind === 'grey' ? toRgba(pic.field, ref.startsWith('us:') ? 9 : 7) : pic.pixels.d
    const ox = (i % cols) * CELL
    const oy = Math.floor(i / cols) * CELL
    for (let y = 0; y < h * SCALE; y++) {
      for (let x = 0; x < w * SCALE; x++) {
        const s = (Math.floor(y / SCALE) * w + Math.floor(x / SCALE)) * 4
        const d = ((oy + y) * W + ox + x) * 4
        sheet[d] = data[s]
        sheet[d + 1] = data[s + 1]
        sheet[d + 2] = data[s + 2]
        sheet[d + 3] = 255
      }
    }
  })
  writeFileSync(join(out, `sheet-${prefix.replace(/[^a-z]/g, '') || 'all'}-${page + 1}.png`), png(W, H, sheet))
  console.log(`sheet ${page + 1}: ${slice.join(' | ')}`)
}
