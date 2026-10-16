import * as THREE from 'three'
import type { Rig } from './rig'

/**
 * A Laerdal Stifneck Select–style extrication collar, fitted to this patient's neck, and how it goes on someone lying
 * down, after the maker's directions: sized flat, locked and bent into shape; held open, the rear panel slid behind the
 * neck from one side, tail first; the front brought round with the chin support under the chin; the tail pulled round
 * over the front and fastened.
 *
 * The collar is one band, bent as it goes on. Its shape is worked out afresh each frame from how far each stage has
 * gone: the part already round the neck lies on it; the rest is a free curve leaving it at a tangent, bent the way the
 * hands hold it. Nothing passes through the patient: the band is kept outside a map of the skin round the neck and the
 * head (built once from the model's own surface) and above the couch.
 *
 * Its frame is the neck's, from the bind pose: origin the neck joint, `U` up the neck, `F` to the front, `L` to her
 * left. An angle round the neck is measured from the front toward her left (her right is negative). Along the band, `s`
 * counts degrees of wrap in the finished fit: from the left edge of the front panel (0), round her right side and
 * behind, to the end of the Velcro tail (385), which laps over the front panel.
 */

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const DEG = Math.PI / 180
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const ease = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** An angle brought within half a turn of zero. */
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const lerpAngle = (a: number, b: number, t: number) => a + wrapPi(b - a) * t

/** How far each stage of putting the collar on has gone (0 … 1). */
export type CollarPose = {
  /** Out of the packet, held flat beside her (to size and lock it). */
  out: number
  /** Bent round into shape, in the hands. */
  preform: number
  /** Opened and brought down beside the neck, the tail at the gap under it. */
  approach: number
  /** The rear panel slid behind the neck, tail first. */
  feed: number
  /** The front brought round: the chin support under the chin. */
  wrap: number
  /** The tail pulled round over the front and fastened. */
  fasten: number
}
export const COLLAR_OFF: CollarPose = { out: 0, preform: 0, approach: 0, feed: 0, wrap: 0, fasten: 0 }
export const COLLAR_ON: CollarPose = { out: 1, preform: 1, approach: 1, feed: 1, wrap: 1, fasten: 1 }

/** The skin round the neck and head: its distance from the neck's axis at each angle and height (the outermost). */
class NeckMap {
  readonly nTh = 96
  readonly nH: number
  readonly h0: number
  readonly dh = 0.004
  readonly r: Float32Array
  constructor(
    readonly U: THREE.Vector3,
    readonly F: THREE.Vector3,
    readonly L: THREE.Vector3,
    origin: THREE.Vector3,
    meshes: THREE.Mesh[],
    k: number,
  ) {
    this.h0 = -0.1 * k
    this.nH = Math.ceil((0.38 * k) / this.dh)
    const nTh = this.nTh
    const raw = new Float32Array(nTh * this.nH).fill(-1)
    // Each triangle of the skin drawn into the grid (angle round, height up): every cell it covers keeps the furthest
    // out the skin is there.
    const d = v3()
    const polar = (q: THREE.Vector3) => {
      d.copy(q).sub(origin)
      const x = d.dot(F)
      const y = d.dot(L)
      return { u: (Math.atan2(y, x) / (Math.PI * 2)) * nTh, w: (d.dot(U) - this.h0) / this.dh - 0.5, rho: Math.hypot(x, y) }
    }
    const keep = (i: number, j: number, rho: number) => {
      if (j < 0 || j >= this.nH) return
      const at = j * nTh + (((i % nTh) + nTh) % nTh)
      if (rho > raw[at]) raw[at] = rho
    }
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const P = [polar(a), polar(b), polar(c)]
      if (P.every((q) => q.rho > 0.24 * k || q.w < -2 || q.w > this.nH + 1)) return
      // Round the same way as the first corner (no triangle wraps the long way round); none too close to the axis.
      for (const q of P.slice(1)) q.u = P[0].u + ((((q.u - P[0].u + nTh / 2) % nTh) + nTh) % nTh) - nTh / 2
      if (Math.max(...P.map((q) => q.u)) - Math.min(...P.map((q) => q.u)) > nTh / 6) return
      for (const q of P) if (q.rho <= 0.24 * k) keep(Math.round(q.u), Math.round(q.w), q.rho)
      const [A, B, C] = P
      const det = (B.w - C.w) * (A.u - C.u) + (C.u - B.u) * (A.w - C.w)
      if (Math.abs(det) < 1e-9) return
      for (let i = Math.ceil(Math.min(A.u, B.u, C.u)); i <= Math.floor(Math.max(A.u, B.u, C.u)); i++)
        for (let j = Math.ceil(Math.min(A.w, B.w, C.w)); j <= Math.floor(Math.max(A.w, B.w, C.w)); j++) {
          const l1 = ((B.w - C.w) * (i - C.u) + (C.u - B.u) * (j - C.w)) / det
          const l2 = ((C.w - A.w) * (i - C.u) + (A.u - C.u) * (j - C.w)) / det
          const l3 = 1 - l1 - l2
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue
          const rho = l1 * A.rho + l2 * B.rho + l3 * C.rho
          if (rho <= 0.24 * k) keep(i, j, rho)
        }
    }
    const a = v3()
    const b = v3()
    const c = v3()
    for (const mesh of meshes) {
      const m = mesh as THREE.SkinnedMesh
      const pos = m.geometry.attributes.position as THREE.BufferAttribute
      const world = (i: number, into: THREE.Vector3) => (m.isSkinnedMesh ? m.getVertexPosition(i, into) : into.fromBufferAttribute(pos, i)).applyMatrix4(m.matrixWorld)
      const index = m.geometry.index
      const count = index ? index.count : pos.count
      const corner = (n: number) => (index ? index.getX(n) : n)
      // Each vertex once, in the world.
      const all = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i++) world(i, a).toArray(all, i * 3)
      for (let t = 0; t + 2 < count; t += 3) tri(a.fromArray(all, corner(t) * 3), b.fromArray(all, corner(t + 1) * 3), c.fromArray(all, corner(t + 2) * 3))
    }
    // The few cells no triangle reached take the largest of their neighbours' (from the pass before: no flooding).
    for (let pass = 0; pass < 3; pass++) {
      const was = raw.slice()
      for (let j = 0; j < this.nH; j++)
        for (let i = 0; i < nTh; i++) {
          if (was[j * nTh + i] >= 0) continue
          let best = -1
          for (const [di, dj] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const jj = j + dj
            if (jj >= 0 && jj < this.nH) best = Math.max(best, was[jj * nTh + ((i + di + nTh) % nTh)])
          }
          if (best >= 0) raw[j * nTh + i] = best
        }
    }
    for (let n = 0; n < raw.length; n++) if (raw[n] < 0) raw[n] = 0
    const out = new Float32Array(raw.length)
    for (let j = 0; j < this.nH; j++)
      for (let i = 0; i < this.nTh; i++) {
        let s = 0
        let w = 0
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const jj = j + dj
            if (jj < 0 || jj >= this.nH) continue
            s += raw[jj * this.nTh + ((i + di + this.nTh) % this.nTh)]
            w++
          }
        out[j * this.nTh + i] = Math.max(s / w, raw[j * this.nTh + i])
      }
    this.r = out
    // The core: the skin with what sticks out thinly (an ear, the nose) and the corners it makes (where the neck meets
    // the shoulder, under the chin) taken back, a little inside it everywhere. A hand touching the skin is clear of it;
    // one that has gone through is not.
    const core = new Float32Array(out.length)
    for (let j = 0; j < this.nH; j++)
      for (let i = 0; i < this.nTh; i++) {
        let m = Infinity
        for (let dj = -3; dj <= 3; dj++)
          for (let di = -2; di <= 2; di++) {
            const jj = j + dj
            if (jj >= 0 && jj < this.nH) m = Math.min(m, out[jj * this.nTh + ((i + di + this.nTh) % this.nTh)])
          }
        core[j * this.nTh + i] = Math.max(0, m - 0.003 * k)
      }
    this.c = core
  }
  /** Inside the skin, for keeping hands out (see the constructor). */
  readonly c: Float32Array
  core(th: number, h: number) {
    return this.look(this.c, th, h)
  }
  /** The skin's distance from the axis at this angle (radians) and height (m). */
  radius(th: number, h: number) {
    return this.look(this.r, th, h)
  }
  /** The collar's own rigid shell there: smooth, bridging the hollows of the skin (never inside it). */
  shell(th: number, h: number) {
    return this.look(this.s ?? this.r, th, h)
  }
  private s: Float32Array | null = null
  private look(r: Float32Array, th: number, h: number) {
    const u = ((((th / (Math.PI * 2)) * this.nTh) % this.nTh) + this.nTh) % this.nTh
    const i0 = Math.floor(u) % this.nTh
    const fi = u - Math.floor(u)
    const i1 = (i0 + 1) % this.nTh
    const w = Math.max(0, Math.min(this.nH - 1.001, (h - this.h0) / this.dh - 0.5))
    const j0 = Math.floor(w)
    const fj = w - j0
    const n = this.nTh
    return (r[j0 * n + i0] * (1 - fi) + r[j0 * n + i1] * fi) * (1 - fj) + (r[(j0 + 1) * n + i0] * (1 - fi) + r[(j0 + 1) * n + i1] * fi) * fj
  }

  /**
   * Make the shell: at each angle, over the collar's height there (`span`), the skin's profile with its hollows bridged
   * (its upper hull, going up the neck), then smoothed round the neck; never inside the skin.
   */
  makeShell(span: (th: number) => { lo: number; hi: number }) {
    const n = this.nTh
    const s = this.r.slice()
    const hOf = (j: number) => this.h0 + (j + 0.5) * this.dh
    for (let i = 0; i < n; i++) {
      const { lo, hi } = span((i / n) * Math.PI * 2)
      const j0 = Math.max(0, Math.floor((lo - this.h0) / this.dh))
      const j1 = Math.min(this.nH - 1, Math.ceil((hi - this.h0) / this.dh))
      const hull: number[] = []
      for (let j = j0; j <= j1; j++) {
        // Keep the chain concave: drop a point that lies under the line from the one before it to this one.
        while (hull.length >= 2) {
          const a = hull[hull.length - 2]
          const b = hull[hull.length - 1]
          const cross = (hOf(b) - hOf(a)) * (this.r[j * n + i] - this.r[a * n + i]) - (this.r[b * n + i] - this.r[a * n + i]) * (hOf(j) - hOf(a))
          if (cross >= 0) hull.pop()
          else break
        }
        hull.push(j)
      }
      for (let q = 0; q + 1 < hull.length; q++) {
        const a = hull[q]
        const b = hull[q + 1]
        for (let j = a; j <= b; j++) s[j * n + i] = this.r[a * n + i] + ((this.r[b * n + i] - this.r[a * n + i]) * (j - a)) / Math.max(1, b - a)
      }
    }
    // Smoothed round the neck and up it, and never in from the skin.
    for (let pass = 0; pass < 3; pass++) {
      const was = s.slice()
      for (let j = 0; j < this.nH; j++)
        for (let i = 0; i < n; i++) {
          const up = Math.min(this.nH - 1, j + 1)
          const dn = Math.max(0, j - 1)
          const v = (2 * was[j * n + i] + was[j * n + ((i + 1) % n)] + was[j * n + ((i + n - 1) % n)] + was[up * n + i] + was[dn * n + i]) / 6
          s[j * n + i] = Math.max(v, this.r[j * n + i])
        }
    }
    this.s = s
  }
  inRange(h: number) {
    return h > this.h0 && h < this.h0 + (this.nH - 1) * this.dh
  }
}

/** The band's length, in degrees of wrap; one column of the mesh every `STEP`. */
const S_END = 385
const STEP = 2.5
const COLS = S_END / STEP
const ROWS = 16
/** The Velcro tail: the free end, from here on. */
const S_TAIL = 352
/** Where the tail goes in behind the neck (her right, toward the back); and the band there once the rear panel is in. */
const TH_ENTRY = -140 * DEG
const S_ENTRY = 50 + 140
/** The middle of the band, where it is held before it goes on. */
const S_HOLD = 192.5
/** Where each part of the band sits round the neck in the finished fit. */
const finalAngle = (s: number) => (50 - s) * DEG

export class Stifneck {
  readonly group = new THREE.Group()
  private map: NeckMap
  private k: number
  private pad: number
  private thick: number
  /** Each column's bottom and top edge (m, up the neck). */
  private lo: number[] = []
  private hi: number[] = []
  /** The band's middle, out from the neck's axis in the finished fit; and the length of each step along it. */
  private rFit: number[] = []
  private seg: number[] = []
  private geo = new THREE.BufferGeometry()
  private solid: boolean[] = []
  /** Where each vertex of the grid is on the band (`s`, then `v`), the openings' edges smoothed. */
  private sv: number[] = []
  private rims: [number, number, number, number][] = []
  private decals: { mesh: THREE.Mesh; s: number; v: number; out: number; tab: boolean }[] = []
  // This frame's layout, column by column: on the neck (its angle and how far it stands off) or free (where its middle
  // is, which way it runs, how far along it is from where it leaves the neck, how far the hold lifts it).
  private free = new Uint8Array(COLS + 1)
  private th = new Float64Array(COLS + 1)
  private lift = new Float64Array(COLS + 1)
  private cx = new Float64Array(COLS + 1)
  private cy = new Float64Array(COLS + 1)
  private psi = new Float64Array(COLS + 1)
  private ell = new Float64Array(COLS + 1)
  private du = new Float64Array(COLS + 1)
  private fade = new Float64Array(COLS + 1)
  private thF = 0
  /** The plastic outside and the foam inside, as laid out (collar frame). */
  private outer: THREE.Vector3[] = []
  private inner: THREE.Vector3[] = []
  /** The couch, in the collar's frame (set by the scene each frame). */
  couch: { n: THREE.Vector3; d: number } | null = null
  pose: CollarPose = { ...COLLAR_OFF }

  constructor(rig: Rig) {
    rig.root.updateMatrixWorld(true)
    for (const m of rig.meshes) if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).skeleton.update()
    this.k = rig.height / 1.72
    const k = this.k
    const N = rig.neck.getWorldPosition(v3())
    const H = rig.head.getWorldPosition(v3())
    const U = H.clone().sub(N).normalize()
    const F = v3(0, 0, 1).addScaledVector(U, -U.z).normalize()
    const L = U.clone().cross(F).normalize()
    this.map = new NeckMap(U, F, L, N, rig.meshes.filter((m) => !m.name.startsWith('bare-leg')), k)
    this.pad = 0.003 * k
    this.thick = 0.008 * k
    this.shape()
    this.build()
    for (let i = 0; i < (COLS + 1) * (ROWS + 1); i++) {
      this.outer.push(v3())
      this.inner.push(v3())
    }
    // On the neck bone, its axes the body's in the bind pose; the group's own axes her left, up the neck, the front.
    const holder = new THREE.Group()
    rig.neck.add(holder)
    holder.position.copy(rig.neck.worldToLocal(N.clone()))
    holder.quaternion.copy(rig.neck.getWorldQuaternion(new THREE.Quaternion()).invert())
    holder.scale.setScalar(1 / rig.neck.getWorldScale(v3()).x)
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(L, U, F))
    holder.add(this.group)
    this.group.visible = false
  }

  /**
   * The finished collar's outline: up to just under the chin at the front (the chin support cupping it), under the jaw
   * at the sides, to the base of the skull behind; down to where the chest, the shoulders and the upper back begin. The
   * tail is a strap, narrower than the band.
   */
  private shape() {
    const m = this.map
    const k = this.k
    /** Going from `h` by `step` (up or down), the first height where the skin stands `rise` further out than at the start. */
    const until = (th: number, h: number, step: number, rise: number, stop: number) => {
      const r0 = m.radius(th, h)
      while ((step > 0 ? h < stop : h > stop) && m.radius(th, h + step) < r0 + rise) h += step
      return h
    }
    const dh = 0.002
    // The landmarks: the chin and the base of the skull above; the chest, the upper back and the trapezius below.
    const chin = until(0, 0.03 * k, dh, 0.015 * k, 0.12 * k)
    const skull = until(Math.PI, 0.03 * k, dh, 0.015 * k, 0.13 * k)
    const chest = until(0, 0.01 * k, -dh, 0.015 * k, -0.05 * k)
    const back = Math.max(-0.035 * k, until(Math.PI, 0.01 * k, -dh, 0.015 * k, -0.05 * k))
    const shoulder = Math.max(until(Math.PI / 2, 0.03 * k, -dh, 0.015 * k, -0.04 * k), until(-Math.PI / 2, 0.03 * k, -dh, 0.015 * k, -0.04 * k))
    // Under the jaw and the ear lobes at the sides.
    const side = Math.min(chin, skull) - 0.008 * k
    const outline = (th: number) => {
      const f = Math.max(0, Math.cos(th)) ** 1.5
      const b = Math.max(0, -Math.cos(th)) ** 1.5
      return { lo: shoulder + 0.004 * k + (chest + 0.003 * k - shoulder) * f + (back - shoulder) * b, hi: side + (chin - side) * f + (skull - side) * b }
    }
    m.makeShell((th) => {
      const o = outline(th)
      return { lo: o.lo - 0.015 * k, hi: o.hi + 0.012 * k }
    })
    for (let c = 0; c <= COLS; c++) {
      const o = outline(finalAngle(Math.min(c * STEP, S_TAIL)))
      this.hi.push(o.hi)
      this.lo.push(o.lo)
    }
    for (const edge of [this.lo, this.hi])
      for (let pass = 0; pass < 6; pass++) {
        const copy = [...edge]
        for (let c = 1; c < COLS; c++) edge[c] = (copy[c - 1] + 2 * copy[c] + copy[c + 1]) / 4
      }
    const cT = Math.round(S_TAIL / STEP)
    const mid = (this.lo[cT] + this.hi[cT]) / 2
    for (let c = cT + 1; c <= COLS; c++) {
      const t = (c * STEP - S_TAIL) / (S_END - S_TAIL)
      const half = 0.017 * k * (1 - 0.2 * t)
      this.lo[c] = lerp(this.lo[cT], mid - half, ease(t / 0.35))
      this.hi[c] = lerp(this.hi[cT], mid + half, ease(t / 0.35))
    }
    for (let c = 0; c <= COLS; c++) {
      const s = c * STEP
      this.rFit.push(m.shell(finalAngle(s), this.hMid(c)) + this.pad + this.thick / 2 + (s > S_TAIL ? this.thick : 0))
    }
    for (let c = 0; c < COLS; c++) this.seg.push(((this.rFit[c] + this.rFit[c + 1]) / 2) * STEP * DEG)
  }

  private hMid(c: number) {
    return (this.lo[c] + this.hi[c]) / 2
  }
  private hAt(c: number, r: number) {
    return this.lo[c] + ((this.hi[c] - this.lo[c]) * r) / ROWS
  }

  /** The band's mesh: plastic outside, foam inside, rims round every edge, the two openings cut out; and its marks. */
  private build() {
    // The tracheal opening at the front; the rear opening behind; the rest solid.
    const holes = [
      { s: 50, v: 0.46, rs: 17, rv: 0.3 },
      { s: 230, v: 0.5, rs: 8, rv: 0.26 },
    ]
    const opening = (s: number, v: number) => holes.some((e) => ((s - e.s) / e.rs) ** 2 + ((v - e.v) / e.rv) ** 2 < 1)
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) this.solid.push(!opening((c + 0.5) * STEP, (r + 0.5) / ROWS))
    const grid = (COLS + 1) * (ROWS + 1)
    const idx = (c: number, r: number, inner: boolean) => (inner ? grid : 0) + c * (ROWS + 1) + r
    const index: number[] = []
    const solid = (c: number, r: number) => c >= 0 && c < COLS && r >= 0 && r < ROWS && this.solid[c * ROWS + r]
    // Where each vertex is on the band; those round an opening moved onto its edge, so the edge is smooth, not stepped.
    for (let c = 0; c <= COLS; c++)
      for (let r = 0; r <= ROWS; r++) {
        let s = c * STEP
        let v = r / ROWS
        const near = [
          [c - 1, r - 1],
          [c, r - 1],
          [c - 1, r],
          [c, r],
        ].filter(([a, b]) => a >= 0 && a < COLS && b >= 0 && b < ROWS)
        if (near.some(([a, b]) => !solid(a, b)) && near.some(([a, b]) => solid(a, b))) {
          const e = holes.reduce((x, y) => (Math.hypot((s - y.s) / y.rs, (v - y.v) / y.rv) < Math.hypot((s - x.s) / x.rs, (v - x.v) / x.rv) ? y : x))
          const ds = (s - e.s) / e.rs
          const dv = (v - e.v) / e.rv
          const d = Math.hypot(ds, dv)
          if (d > 1e-6) {
            s = e.s + (ds / d) * e.rs
            v = e.v + (dv / d) * e.rv
          }
        }
        this.sv.push(s, v)
      }
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) {
        if (!solid(c, r)) continue
        index.push(idx(c, r, false), idx(c + 1, r, false), idx(c, r + 1, false), idx(c, r + 1, false), idx(c + 1, r, false), idx(c + 1, r + 1, false))
        index.push(idx(c, r, true), idx(c, r + 1, true), idx(c + 1, r, true), idx(c, r + 1, true), idx(c + 1, r + 1, true), idx(c + 1, r, true))
        // A rim wherever the next cell is not solid: an edge of the band or of an opening.
        if (!solid(c, r - 1)) this.rims.push([idx(c, r, false), idx(c + 1, r, false), idx(c + 1, r, true), idx(c, r, true)])
        if (!solid(c, r + 1)) this.rims.push([idx(c + 1, r + 1, false), idx(c, r + 1, false), idx(c, r + 1, true), idx(c + 1, r + 1, true)])
        if (!solid(c - 1, r)) this.rims.push([idx(c, r + 1, false), idx(c, r, false), idx(c, r, true), idx(c, r + 1, true)])
        if (!solid(c + 1, r)) this.rims.push([idx(c + 1, r, false), idx(c + 1, r + 1, false), idx(c + 1, r + 1, true), idx(c + 1, r, true)])
      }
    // Rims have vertices of their own (crisp edges), copied from the grid each frame.
    const rimStart = grid * 2
    this.rims.forEach((_, n) => {
      const b = rimStart + n * 4
      index.push(b, b + 1, b + 2, b, b + 2, b + 3)
    })
    const count = rimStart + this.rims.length * 4
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    // The light shell; the darker front panel round the opening; the chin support; the dark Velcro tail; grey foam.
    const color = new Float32Array(count * 3)
    const shell = new THREE.Color('#e6e4dc')
    const panel = new THREE.Color('#5a5f66')
    const chin = new THREE.Color('#f2f0e9')
    const velcro = new THREE.Color('#2a2e33')
    const foam = new THREE.Color('#646a72')
    const tone = (s: number, v: number) =>
      s > S_TAIL + 6 ? velcro : v > 0.8 && s > 16 && s < 84 ? chin : s > 4 && s < 112 && v > 0.06 && v < 0.8 ? panel : shell
    for (let c = 0; c <= COLS; c++)
      for (let r = 0; r <= ROWS; r++) {
        const s = c * STEP
        tone(s, r / ROWS).toArray(color, idx(c, r, false) * 3)
        ;(s > S_TAIL + 6 ? velcro : foam).toArray(color, idx(c, r, true) * 3)
      }
    this.rims.forEach((quad, n) => {
      const c = Math.floor((quad[0] % grid) / (ROWS + 1))
      for (let j = 0; j < 4; j++) (c * STEP > S_TAIL + 6 ? velcro : shell).toArray(color, (rimStart + n * 4 + j) * 3)
    })
    this.geo.setAttribute('color', new THREE.BufferAttribute(color, 3))
    this.geo.setIndex(index)
    const mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, side: THREE.DoubleSide }))
    mesh.castShadow = true
    mesh.frustumCulled = false
    this.group.add(mesh)

    // The round label beside the opening; a lock tab and a column of sizing holes in a window each side of the front
    // panel; ventilation holes behind.
    const k = this.k
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const g = cv.getContext('2d')
    if (g) {
      g.fillStyle = '#f4f3ee'
      g.beginPath()
      g.arc(64, 64, 62, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#3b3f45'
      g.font = 'bold 17px Arial'
      g.textAlign = 'center'
      g.fillText('STIFNECK', 64, 50)
      g.fillStyle = '#c0392b'
      g.beginPath()
      g.ellipse(64, 72, 46, 15, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffffff'
      g.font = 'bold italic 19px Arial'
      g.fillText('SELECT', 64, 79)
      g.fillStyle = '#3b3f45'
      g.font = '12px Arial'
      g.fillText('Laerdal', 64, 103)
    }
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const disc = (r: number, mat: THREE.Material) => new THREE.Mesh(new THREE.CircleGeometry(r * k, 28), mat)
    const hole = new THREE.MeshStandardMaterial({ color: '#16191c', roughness: 0.9 })
    const tabMat = new THREE.MeshStandardMaterial({ color: '#2f3338', roughness: 0.45 })
    const windowMat = new THREE.MeshStandardMaterial({ color: '#cfd3d6', roughness: 0.3 })
    const redMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 })
    this.decals.push({ mesh: disc(0.013, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })), s: 90, v: 0.42, out: 0.0012, tab: false })
    for (const s of [14, 104]) {
      const tab = new THREE.Mesh(new THREE.CylinderGeometry(0.0055 * k, 0.006 * k, 0.003 * k, 20), tabMat)
      this.decals.push({ mesh: tab, s, v: 0.68, out: 0.0015, tab: true })
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.0075 * k, 0.026 * k), windowMat)
      this.decals.push({ mesh: win, s, v: 0.32, out: 0.0009, tab: false })
      for (const v of [0.2, 0.28, 0.36]) this.decals.push({ mesh: disc(0.0018, hole), s, v, out: 0.0013, tab: false })
      // The red sizing mark at the top of the window: the fingers are matched from here to the bottom of the plastic.
      this.decals.push({ mesh: new THREE.Mesh(new THREE.PlaneGeometry(0.0068 * k, 0.0024 * k), redMat), s, v: 0.44, out: 0.0013, tab: false })
    }
    for (const s of [200, 212, 248, 260]) this.decals.push({ mesh: disc(0.004, hole), s, v: 0.5, out: 0.0008, tab: false })
    for (const d of this.decals) {
      d.mesh.renderOrder = 1
      this.group.add(d.mesh)
    }
  }

  /* ------------------------------------------------------------------ layout */

  /**
   * Lay the free part of the band out as a curve, from an anchor at column `ca` (where it is, which way it runs toward
   * the start of the band) bending by `kap` (1/m) at each column; columns `from`…`to`.
   */
  private march(ca: number, x0: number, y0: number, psi0: number, kap: (c: number) => number, from: number, to = COLS) {
    let x = x0
    let y = y0
    let psi = psi0
    let at = ca
    let ell = 0
    for (let c = Math.min(to, Math.floor(ca)); c >= from; c--) {
      const step = (at - c) * this.seg[Math.min(c, COLS - 1)]
      const k = kap(c)
      const mid = psi + (k * step) / 2
      x += step * Math.cos(mid)
      y += step * Math.sin(mid)
      psi += k * step
      ell += step
      this.set(c, x, y, psi, ell)
      at = c
    }
    x = x0
    y = y0
    psi = psi0
    at = ca
    ell = 0
    for (let c = Math.max(from, Math.ceil(ca)); c <= to; c++) {
      if (c === ca) continue
      const step = (c - at) * this.seg[Math.max(0, c - 1)]
      const k = kap(c)
      const mid = psi - (k * step) / 2
      x -= step * Math.cos(mid)
      y -= step * Math.sin(mid)
      psi -= k * step
      ell += step
      this.set(c, x, y, psi, ell)
      at = c
    }
  }
  private set(c: number, x: number, y: number, psi: number, ell: number) {
    this.free[c] = 1
    this.cx[c] = x
    this.cy[c] = y
    this.psi[c] = psi
    this.ell[c] = ell
  }

  /** Where every column of the band is, for this stage of putting it on. */
  private layout(p: CollarPose) {
    const k = this.k
    this.lift.fill(0)
    this.fade.fill(0)
    this.du.fill(0)
    // How the band bends: into its ring; held open (the rear panel flat, out to her right; the front curled up beside
    // the neck); arched just clear of the neck.
    const ring = (c: number) => (c * STEP <= S_TAIL ? 1 / this.rFit[c] : 0)
    const open = (c: number) => (c * STEP < 150 ? 0.6 / this.rFit[c] : 0)
    const arch = (c: number) => 1 / (this.rFit[c] + 0.035 * k)
    this.hold = null
    if (p.feed <= 0 && p.wrap <= 0) {
      // In the hands above her right shoulder, held by its middle: flat and on its edge, plastic toward you (to size
      // and lock it), then bent into shape; turned to face the neck; then opened and brought down by its tail to the
      // gap under the neck.
      const pre = ease(p.preform)
      const turn = ease(p.approach / 0.35)
      const a = ease((p.approach - 0.35) / 0.65)
      const pivot = { f: 0.34 * k, l: -0.3 * k - 0.3 * k * (1 - ease(p.out)), u: -0.04 * k }
      this.march(S_HOLD / STEP, pivot.f, pivot.l, 0, (c) => pre * ring(c), 0)
      if (a > 0) {
        const t0 = Math.atan2(this.cy[COLS], this.cx[COLS])
        const r0 = Math.hypot(this.cx[COLS], this.cy[COLS])
        const psi0 = this.psi[COLS]
        const rE = this.map.shell(TH_ENTRY, this.hMid(COLS)) + this.pad + this.thick / 2
        const t = lerpAngle(t0, TH_ENTRY, a)
        const r = lerp(r0, rE, a)
        this.march(COLS, r * Math.cos(t), r * Math.sin(t), lerpAngle(psi0, TH_ENTRY + Math.PI / 2, a), (c) => lerp(pre * ring(c), open(c), a), 0)
        this.du.fill(pivot.u * (1 - a))
      } else {
        this.du.fill(pivot.u)
        // Its own way in the hands: along the body, standing on its edge, the plastic up and toward you.
        if (turn < 1) {
          const F = v3(1, 0, 0)
          const L = v3(0, 1, 0)
          const U = v3(0, 0, 1)
          const face = L.clone().multiplyScalar(-0.78).addScaledVector(F, 0.62).normalize()
          const along = U.clone().negate()
          const up = face.clone().cross(along)
          const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, face.clone().negate(), up))
          this.hold = { q: q.slerp(new THREE.Quaternion(), turn), pivot: v3(pivot.f, pivot.l, pivot.u) }
        }
      }
    } else {
      // Round the neck from a frontier: behind it as the rear panel goes in (the frontier where it goes in); then round
      // the front as the front comes down (the frontier moving round from her right side to her left).
      const sf = p.wrap > 0 ? S_ENTRY * (1 - ease(p.wrap)) : S_END - (S_END - S_ENTRY) * ease(p.feed)
      const thf = p.wrap > 0 ? finalAngle(sf) : TH_ENTRY
      const cf = sf / STEP
      for (let c = 0; c <= COLS; c++)
        if (c >= cf - 1e-6) {
          this.free[c] = 0
          this.th[c] = thf - (c * STEP - sf) * DEG
        }
      if (cf > 1e-6) {
        const w = p.wrap > 0 ? 1 : ease(p.feed)
        const c0 = Math.min(COLS, Math.floor(cf))
        const hm = lerp(this.hMid(c0), this.hMid(Math.min(COLS, c0 + 1)), cf - c0)
        const r = this.map.shell(thf, hm) + this.pad + this.thick / 2
        this.march(cf, r * Math.cos(thf), r * Math.sin(thf), thf + Math.PI / 2, (c) => lerp(open(c), arch(c), w), 0, Math.ceil(cf) - 1)
        this.thF = thf
        for (let c = 0; c < cf; c++) this.fade[c] = 1 - ease(this.ell[c] / (0.03 * k))
      }
      this.tail(p, sf, thf)
    }
    this.sortBins()
    if (!this.hold) this.pushOut()
  }

  /**
   * The Velcro tail, once round at the front: held open, hinged off the band, until it is pulled round and fastened;
   * then lying on the front panel.
   */
  private tail(p: CollarPose, sf: number, thf: number) {
    const k = this.k
    const over = this.thick + 0.0015 * k
    const front = (th: number) => clamp01((Math.cos(th) - 0.1) / 0.3)
    const sH = Math.max(S_TAIL, sf)
    const thH = thf - (sH - sf) * DEG
    const open = (1 - ease(p.fasten)) * front(thH)
    const cH = Math.round(sH / STEP)
    const rH = this.map.shell(thH, this.hMid(cH)) + this.pad + this.thick / 2 + over * front(thH)
    const alpha = open * 65 * DEG
    for (let c = 0; c <= COLS; c++) {
      const s = c * STEP
      if (this.free[c] || s <= S_TAIL) continue
      const base = over * front(this.th[c])
      if (s <= sH || open <= 0) {
        this.lift[c] = base
        continue
      }
      const d = (s - sH) * DEG * rH
      const tx = Math.sin(thH)
      const ty = -Math.cos(thH)
      const nx = Math.cos(thH)
      const ny = Math.sin(thH)
      const px = rH * nx + d * (Math.cos(alpha) * tx + Math.sin(alpha) * nx)
      const py = rH * ny + d * (Math.cos(alpha) * ty + Math.sin(alpha) * ny)
      const t2 = this.th[c] + wrapPi(Math.atan2(py, px) - this.th[c])
      const th = lerp(this.th[c], t2, open)
      const onTrack = this.map.shell(th, this.hMid(c)) + this.pad + this.thick / 2
      this.th[c] = th
      this.lift[c] = Math.max(0, lerp(base, Math.hypot(px, py) - onTrack, open))
    }
  }

  /**
   * Keep the free part off the skin and off the band already round the neck: a column that would come too close is
   * moved straight out, and its neighbours with it, so the band bends smoothly round what it clears.
   */
  private pushOut() {
    const k = this.k
    const need = new Float64Array(COLS + 1)
    let any = false
    for (let c = 0; c <= COLS; c++) {
      if (!this.free[c]) continue
      for (let r = 0; r <= ROWS; r += 2) {
        const h = this.hAt(c, r)
        const d = this.delta(c, h)
        const x = this.cx[c] + Math.sin(this.psi[c]) * d
        const y = this.cy[c] - Math.cos(this.psi[c]) * d
        const rho = Math.hypot(x, y)
        const th = Math.atan2(y, x)
        const hh = h + this.du[c]
        const want = Math.max(this.map.radius(th, hh) + this.pad, this.trackOuter(th, hh, false) + 0.001 * k) + this.thick / 2 + 0.0015 * k
        if (want > rho) {
          need[c] = Math.max(need[c], want - rho)
          any = true
        }
      }
    }
    if (!any) return
    const W = 8
    for (let c = 0; c <= COLS; c++) {
      if (!this.free[c]) continue
      let best = 0
      for (let j = Math.max(0, c - W); j <= Math.min(COLS, c + W); j++) best = Math.max(best, need[j] * Math.cos(((Math.PI / 2) * Math.abs(c - j)) / (W + 1)) ** 2)
      if (best <= 0) continue
      const rho = Math.max(1e-6, Math.hypot(this.cx[c], this.cy[c]))
      this.cx[c] += (this.cx[c] / rho) * best
      this.cy[c] += (this.cy[c] / rho) * best
    }
  }

  /** How far the per-row shape of the band where it leaves the neck still carries on, out along a free column. */
  private delta(c: number, h: number) {
    const f = this.fade[c]
    return f > 0 ? (this.map.shell(this.thF, h) - this.map.shell(this.thF, this.hMid(c))) * f : 0
  }

  /**
   * The outside of the band lying round the neck at this angle and height (0 where it is not), the tail too or not.
   */
  private trackOuter(th: number, h: number, tail: boolean) {
    let best = 0
    const bin = this.bins[(((Math.round(th / DEG) % 360) + 360) % 360)]
    for (const c of bin) {
      if (this.free[c] || (!tail && c * STEP > S_TAIL)) continue
      if (Math.abs(wrapPi(th - this.th[c])) > (STEP * DEG) / 2 + 1e-4) continue
      if (h < this.lo[c] - 0.002 * this.k || h > this.hi[c] + 0.002 * this.k) continue
      best = Math.max(best, this.map.shell(this.th[c], h) + this.pad + this.thick + this.lift[c])
    }
    return best
  }

  /** The columns lying round the neck, by whole degree round it (for finding the band at an angle quickly). */
  private bins: number[][] = Array.from({ length: 360 }, () => [])
  private sortBins() {
    for (const b of this.bins) b.length = 0
    for (let c = 0; c <= COLS; c++) {
      if (this.free[c]) continue
      const d = this.th[c] / DEG
      for (let x = Math.floor(d - STEP / 2 - 1); x <= Math.ceil(d + STEP / 2 + 1); x++) this.bins[((x % 360) + 360) % 360].push(c)
    }
  }

  /** A point of the band (column, row), `off` out from its middle (plastic +, foam −), in the collar's frame. */
  private pointAt(c: number, v: number, off: number, out: THREE.Vector3) {
    const h = this.lo[c] + (this.hi[c] - this.lo[c]) * v
    if (!this.free[c]) {
      const th = this.th[c]
      const rho = this.map.shell(th, h) + this.pad + this.thick / 2 + this.lift[c] + off
      out.set(rho * Math.sin(th), h, rho * Math.cos(th))
    } else {
      const d = this.delta(c, h) + off
      const x = this.cx[c] + Math.sin(this.psi[c]) * d
      const y = this.cy[c] - Math.cos(this.psi[c]) * d
      if (this.hold) {
        // Turned about its middle, the way it is held (worked in the neck's front, left, up; then to the collar's frame).
        const q = this.tmp2.set(x, y, h + this.du[c]).sub(this.hold.pivot).applyQuaternion(this.hold.q).add(this.hold.pivot)
        out.set(q.y, q.z, q.x)
      } else out.set(y, h + this.du[c], x)
    }
    // Never into the couch.
    const couch = this.couch
    if (couch) {
      const below = couch.d + 0.004 * this.k - couch.n.dot(out)
      if (below > 0) out.addScaledVector(couch.n, below)
    }
    return out
  }

  /** A point anywhere on the band (between columns: between their points). */
  private pointSV(s: number, v: number, off: number, out: THREE.Vector3) {
    const c = s / STEP
    const c0 = Math.min(COLS, Math.max(0, Math.floor(c + 1e-9)))
    const f = c - c0
    this.pointAt(c0, v, off, out)
    if (f < 1e-6 || c0 >= COLS) return out
    return out.lerp(this.pointAt(c0 + 1, v, off, this.tmp), f)
  }
  private tmp = v3()
  private tmp2 = v3()
  /** While it is in the hands: how it is turned, about its middle (front, left, up). */
  private hold: { q: THREE.Quaternion; pivot: THREE.Vector3 } | null = null

  /** Lay the band out for this stage of putting it on. */
  update(pose: CollarPose) {
    this.pose = { ...pose }
    this.group.visible = pose.out > 0.01
    if (!this.group.visible) return
    this.layout(pose)
    const pos = this.geo.attributes.position as THREE.BufferAttribute
    const grid = (COLS + 1) * (ROWS + 1)
    const half = this.thick / 2
    for (let c = 0; c <= COLS; c++)
      for (let r = 0; r <= ROWS; r++) {
        const i = c * (ROWS + 1) + r
        const o = this.pointSV(this.sv[i * 2], this.sv[i * 2 + 1], half, this.outer[i])
        const n = this.pointSV(this.sv[i * 2], this.sv[i * 2 + 1], -half, this.inner[i])
        pos.setXYZ(i, o.x, o.y, o.z)
        pos.setXYZ(grid + i, n.x, n.y, n.z)
      }
    const rimStart = grid * 2
    this.rims.forEach((quad, n) => {
      for (let j = 0; j < 4; j++) pos.setXYZ(rimStart + n * 4 + j, pos.getX(quad[j]), pos.getY(quad[j]), pos.getZ(quad[j]))
    })
    pos.needsUpdate = true
    this.geo.computeVertexNormals()
    this.geo.computeBoundingSphere()
    for (const d of this.decals) {
      const { p, n } = this.surface(d.s, d.v, true)
      d.mesh.position.copy(p).addScaledVector(n, d.out * this.k)
      d.mesh.quaternion.setFromUnitVectors(d.tab ? v3(0, 1, 0) : v3(0, 0, 1), n)
    }
  }

  /** A point on the plastic (or the foam), between the columns and rows, and which way that face looks (collar frame). */
  private surface(s: number, v: number, plastic: boolean) {
    const grid = plastic ? this.outer : this.inner
    const other = plastic ? this.inner : this.outer
    const c = Math.max(0, Math.min(COLS - 1e-6, s / STEP))
    const r = Math.max(0, Math.min(ROWS - 1e-6, v * ROWS))
    const c0 = Math.floor(c)
    const r0 = Math.floor(r)
    const fc = c - c0
    const fr = r - r0
    const at = (g: THREE.Vector3[], cc: number, rr: number) => g[Math.max(0, Math.min(COLS, cc)) * (ROWS + 1) + Math.max(0, Math.min(ROWS, rr))]
    const bil = (g: THREE.Vector3[]) =>
      at(g, c0, r0)
        .clone()
        .multiplyScalar((1 - fc) * (1 - fr))
        .addScaledVector(at(g, c0 + 1, r0), fc * (1 - fr))
        .addScaledVector(at(g, c0, r0 + 1), (1 - fc) * fr)
        .addScaledVector(at(g, c0 + 1, r0 + 1), fc * fr)
    const p = bil(grid)
    const ci = Math.round(c)
    const ri = Math.round(r)
    const ds = at(grid, ci + 1, ri).clone().sub(at(grid, ci - 1, ri))
    const dv = at(grid, ci, ri + 1).clone().sub(at(grid, ci, ri - 1))
    const n = ds.clone().cross(dv).normalize()
    if (n.dot(p.clone().sub(bil(other))) < 0) n.negate()
    return { p, n, ds: ds.normalize(), dv: dv.normalize() }
  }

  /**
   * Where a hand holds the band, in the world: a point on the plastic (or the foam), the way that face looks, the way
   * the band runs toward its start, and the way across it toward its top edge.
   */
  grip(s: number, v: number, plastic = true) {
    const { p, n, ds, dv } = this.surface(s, v, plastic)
    this.group.updateWorldMatrix(true, false)
    const q = this.group.getWorldQuaternion(new THREE.Quaternion())
    return { at: p.applyMatrix4(this.group.matrixWorld), n: n.applyQuaternion(q), along: ds.negate().applyQuaternion(q), up: dv.applyQuaternion(q) }
  }

  /** Set the couch's top (world height) in the collar's own frame. */
  setCouch(y: number) {
    this.group.updateWorldMatrix(true, false)
    const inv = this.group.matrixWorld.clone().invert()
    const p0 = v3(0, y, 0).applyMatrix4(inv)
    const n = v3(0, y + 1, 0).applyMatrix4(inv).sub(p0).normalize()
    this.couch = { n, d: n.dot(p0) }
  }

  /**
   * How far a ball (`r` across) at a point in the world is inside the neck and head (their core: a hand resting on the
   * skin is clear), or the collar on them; and the way out (straight out from the neck's axis). Zero when clear.
   */
  depthIn(world: THREE.Vector3, r = 0): { depth: number; out: THREE.Vector3 } {
    const local = world.clone().applyMatrix4(this.inv)
    const h = local.y
    if (!this.map.inRange(h)) return { depth: 0, out: v3() }
    const x = local.z
    const y = local.x
    const th = Math.atan2(y, x)
    const rho = Math.hypot(x, y)
    const skin = this.map.core(th, h)
    const band = this.group.visible ? this.trackOuter(th, h, true) : 0
    const depth = Math.max(0, Math.max(skin, band) + r - rho)
    return { depth, out: v3(Math.sin(th), 0, Math.cos(th)).applyQuaternion(this.turn) }
  }

  /** Where the collar's frame is in the world now (for `depthIn`, many times a frame): call once the body is posed. */
  sync() {
    this.group.updateWorldMatrix(true, false)
    this.inv.copy(this.group.matrixWorld).invert()
    this.group.getWorldQuaternion(this.turn)
  }
  private inv = new THREE.Matrix4()
  private turn = new THREE.Quaternion()

  /** The chin support's front, in the world: where the chin strap runs across it (her right to her left). */
  chinLine(n = 9) {
    const out: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const g = this.grip(110 - (110 * i) / (n - 1), 0.86)
      out.push(g.at.addScaledVector(g.n, 0.0025 * this.k))
    }
    return out
  }

  /** The middle of the band (for the camera, while it is in the hands). */
  middle() {
    return this.grip(S_HOLD, 0.5).at
  }

  dispose() {
    this.geo.dispose()
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.geometry !== this.geo) m.geometry.dispose()
    })
    this.group.removeFromParent()
  }
}
