/**
 * A density field for radiographs and CT: 0 = black (air on X-ray), 1 = white (metal, cortical bone).
 * Shapes are painted onto it in anatomical order, then it is quantised to a few grey levels with
 * ordered dithering, which gives the pixel look while keeping the anatomy where it belongs.
 * Pure numbers, so tests can measure the signs (where the trachea is, whether a bleed crosses a suture).
 */

export type Mode = 'set' | 'add' | 'max' | 'min' | 'mul'

export class Field {
  readonly w: number
  readonly h: number
  readonly d: Float32Array

  constructor(w: number, h: number, fill = 0) {
    this.w = w
    this.h = h
    this.d = new Float32Array(w * h).fill(fill)
  }

  at(x: number, y: number) {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return 0
    return this.d[yi * this.w + xi]
  }

  /** Mean over a small box: a probe for tests. */
  mean(x0: number, y0: number, x1: number, y1: number) {
    let s = 0
    let n = 0
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.w - 1, Math.ceil(x1)); x++) {
        s += this.d[y * this.w + x]
        n++
      }
    }
    return n ? s / n : 0
  }

  private put(i: number, v: number, mode: Mode, k: number) {
    const cur = this.d[i]
    let next: number
    switch (mode) {
      case 'set':
        next = v
        break
      case 'add':
        next = cur + v
        break
      case 'max':
        next = Math.max(cur, v)
        break
      case 'min':
        next = Math.min(cur, v)
        break
      case 'mul':
        next = cur * v
        break
    }
    this.d[i] = cur + (next - cur) * k
  }

  /** Paint wherever `inside(x, y)` returns a coverage 0–1. */
  paint(bounds: [number, number, number, number], v: number, mode: Mode, inside: (x: number, y: number) => number) {
    const [x0, y0, x1, y1] = bounds
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.w - 1, Math.ceil(x1)); x++) {
        const k = inside(x + 0.5, y + 0.5)
        if (k > 0) this.put(y * this.w + x, v, mode, Math.min(1, k))
      }
    }
    return this
  }

  /** Soft-edged ellipse, optionally rotated (radians). */
  ellipse(cx: number, cy: number, rx: number, ry: number, v: number, mode: Mode = 'set', soft = 1, rot = 0) {
    const r = Math.max(rx, ry) + soft
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    return this.paint([cx - r, cy - r, cx + r, cy + r], v, mode, (x, y) => {
      const dx = x - cx
      const dy = y - cy
      const u = (dx * cos + dy * sin) / rx
      const w = (-dx * sin + dy * cos) / ry
      const dist = Math.sqrt(u * u + w * w)
      const edge = (1 - dist) * Math.min(rx, ry)
      return soft <= 0 ? (dist <= 1 ? 1 : 0) : Math.max(0, Math.min(1, edge / soft + 0.5))
    })
  }

  /** Filled polygon with a soft edge. */
  poly(points: [number, number][], v: number, mode: Mode = 'set', soft = 1) {
    const xs = points.map((p) => p[0])
    const ys = points.map((p) => p[1])
    const bounds: [number, number, number, number] = [Math.min(...xs) - soft, Math.min(...ys) - soft, Math.max(...xs) + soft, Math.max(...ys) + soft]
    return this.paint(bounds, v, mode, (x, y) => {
      const inside = pointInPoly(points, x, y)
      if (soft <= 0) return inside ? 1 : 0
      const d = distToPoly(points, x, y)
      return Math.max(0, Math.min(1, (inside ? d : -d) / soft + 0.5))
    })
  }

  /** A thick line segment with round ends. */
  line(x0: number, y0: number, x1: number, y1: number, width: number, v: number, mode: Mode = 'set', soft = 0.8) {
    const r = width / 2 + soft
    return this.paint([Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r], v, mode, (x, y) => {
      const d = distToSeg(x, y, x0, y0, x1, y1)
      return Math.max(0, Math.min(1, (width / 2 - d) / Math.max(0.01, soft) + 0.5))
    })
  }

  /** A polyline through the points (curves are drawn as short segments). */
  path(points: [number, number][], width: number, v: number, mode: Mode = 'set', soft = 0.8) {
    for (let i = 1; i < points.length; i++) this.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], width, v, mode, soft)
    return this
  }

  /** Quadratic curve sampled into a path. */
  curve(p0: [number, number], c: [number, number], p1: [number, number], width: number, v: number, mode: Mode = 'set', soft = 0.8) {
    const pts: [number, number][] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      pts.push([(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]])
    }
    return this.path(pts, width, v, mode, soft)
  }

  /** Film grain, deterministic. */
  grain(amount: number, seed = 1) {
    let h = seed * 2654435761
    for (let i = 0; i < this.d.length; i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177)
      this.d[i] += (((h >>> 0) / 4294967296) - 0.5) * amount
    }
    return this
  }

  blur(passes = 1) {
    for (let p = 0; p < passes; p++) {
      const src = Float32Array.from(this.d)
      for (let y = 1; y < this.h - 1; y++) {
        for (let x = 1; x < this.w - 1; x++) {
          const i = y * this.w + x
          this.d[i] = (src[i] * 4 + src[i - 1] + src[i + 1] + src[i - this.w] + src[i + this.w]) / 8
        }
      }
    }
    return this
  }
}

function pointInPoly(pts: [number, number][], x: number, y: number) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distToSeg(x: number, y: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len)) : 0
  const px = x0 + t * dx - x
  const py = y0 + t * dy - y
  return Math.sqrt(px * px + py * py)
}

function distToPoly(pts: [number, number][], x: number, y: number) {
  let best = Infinity
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) best = Math.min(best, distToSeg(x, y, pts[j][0], pts[j][1], pts[i][0], pts[i][1]))
  return best
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Quantise to `levels` greys with a 4×4 ordered dither, tinted by `tint` (film is faintly blue-grey). */
export function toRgba(field: Field, levels = 7, tint: [number, number, number] = [0.94, 0.97, 1]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(field.w * field.h * 4)
  for (let y = 0; y < field.h; y++) {
    for (let x = 0; x < field.w; x++) {
      const i = y * field.w + x
      const v = Math.max(0, Math.min(1, field.d[i]))
      const threshold = (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5
      const q = Math.max(0, Math.min(levels - 1, Math.round(v * (levels - 1) + threshold * 0.9)))
      const g = (q / (levels - 1)) * 255
      out[i * 4] = g * tint[0]
      out[i * 4 + 1] = g * tint[1]
      out[i * 4 + 2] = g * tint[2]
      out[i * 4 + 3] = 255
    }
  }
  return out
}

/** A colour pixel-art canvas for clinical photos: a palette and a painter over RGBA. */
export class Pixels {
  readonly w: number
  readonly h: number
  readonly d: Uint8ClampedArray

  constructor(w: number, h: number, bg = '#000000') {
    this.w = w
    this.h = h
    this.d = new Uint8ClampedArray(w * h * 4)
    this.rect(0, 0, w, h, bg)
  }

  private rgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  get(x: number, y: number): string {
    const i = (Math.round(y) * this.w + Math.round(x)) * 4
    return `#${[this.d[i], this.d[i + 1], this.d[i + 2]].map((c) => c.toString(16).padStart(2, '0')).join('')}`
  }

  dot(x: number, y: number, hex: string) {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return this
    const [r, g, b] = this.rgb(hex)
    const i = (yi * this.w + xi) * 4
    this.d[i] = r
    this.d[i + 1] = g
    this.d[i + 2] = b
    this.d[i + 3] = 255
    return this
  }

  rect(x: number, y: number, w: number, h: number, hex: string) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.dot(xx, yy, hex)
    return this
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, hex: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x - cx) / rx
        const v = (y - cy) / ry
        if (u * u + v * v <= 1) this.dot(x, y, hex)
      }
    }
    return this
  }

  poly(points: [number, number][], hex: string) {
    const ys = points.map((p) => p[1])
    const xs = points.map((p) => p[0])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        if (pointInPoly(points, x + 0.5, y + 0.5)) this.dot(x, y, hex)
      }
    }
    return this
  }

  line(x0: number, y0: number, x1: number, y1: number, hex: string, width = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n
      const y = y0 + ((y1 - y0) * i) / n
      if (width <= 1) this.dot(x, y, hex)
      else this.ellipse(x, y, width / 2, width / 2, hex)
    }
    return this
  }

  /** Speckle: scattered dots inside a shape, deterministic. */
  speckle(inside: (x: number, y: number) => boolean, hex: string, density: number, seed = 3) {
    let h = seed * 2246822519
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        h = Math.imul(h ^ (h >>> 15), 2654435761)
        if (inside(x, y) && (h >>> 0) / 4294967296 < density) this.dot(x, y, hex)
      }
    }
    return this
  }
}
