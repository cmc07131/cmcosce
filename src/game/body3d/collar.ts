import * as THREE from 'three'
import type { Rig } from './rig'
import { Stifneck } from './stifneck'

/**
 * Everything for immobilising the neck: the collar (a Stifneck, see stifneck.ts), a head block each side, tape across
 * the forehead and across the collar's chin support, and earrings to take off first.
 *
 * The blocks and the tape belong to the room, not the body: the blocks stand on the couch either side of the head and
 * slide in along it; the tape is laid over the forehead (found on the model's own skin) and the chin support from one
 * block to the other, a little more of it each frame.
 */

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

type Side = 'R' | 'L'

/** Put an object built in bind-pose world coordinates (about `origin`) on a bone, so it follows the bone from now on. */
function holderOn(bone: THREE.Object3D, origin: THREE.Vector3, part: THREE.Object3D) {
  const holder = new THREE.Group()
  bone.add(holder)
  holder.position.copy(bone.worldToLocal(origin.clone()))
  holder.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert())
  holder.scale.setScalar(1 / bone.getWorldScale(v()).x)
  holder.add(part)
  part.visible = false
  return part
}

/** A strip of tape through points in the world, laid on from its first end. */
class Strip {
  readonly mesh: THREE.Mesh
  private n = 64
  private geo = new THREE.BufferGeometry()
  constructor(mat: THREE.Material) {
    const idx: number[] = []
    for (let i = 0; i < this.n; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.n + 1) * 2 * 3), 3))
    this.geo.setIndex(idx)
    this.mesh = new THREE.Mesh(this.geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
  }
  /** The first `p` of it laid through `points`, `w` wide across `across`; where its end is and which way it runs. */
  lay(points: THREE.Vector3[], w: number, across: THREE.Vector3, p: number) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    const pos = this.geo.attributes.position as THREE.BufferAttribute
    const end = Math.max(0.001, Math.min(1, p))
    for (let i = 0; i <= this.n; i++) {
      const q = curve.getPointAt((end * i) / this.n)
      pos.setXYZ(i * 2, q.x - (across.x * w) / 2, q.y - (across.y * w) / 2, q.z - (across.z * w) / 2)
      pos.setXYZ(i * 2 + 1, q.x + (across.x * w) / 2, q.y + (across.y * w) / 2, q.z + (across.z * w) / 2)
    }
    pos.needsUpdate = true
    this.geo.computeVertexNormals()
    this.mesh.visible = p > 0.01
    return { at: curve.getPointAt(end), along: curve.getTangentAt(end) }
  }
  dispose() {
    this.geo.dispose()
  }
}

/** How far on each part is: the head blocks, and the tape over the forehead and over the chin support (0 … 1). */
export type HeadState = { blockR: number; blockL: number; tapeF: number; tapeC: number }

export class CollarKit {
  readonly collar: Stifneck
  readonly earrings: THREE.Object3D[] = []
  private k: number
  private head: THREE.Object3D
  /** Between the ears, and the forehead from her right round to her left (the head's own frame, from the bind pose). */
  private ears: THREE.Vector3
  private brow: THREE.Vector3[] = []
  /** Half the head's width across the ears. */
  private half: number
  private blocks: Record<Side, THREE.Mesh | null> = { R: null, L: null }
  /** Each block's size: along the body, its height, its thickness, the bevel; and how far its middle is past the ear. */
  private size = { len: 0, tall: 0, wide: 0, bevel: 0, past: 0 }
  private blockMat = new THREE.MeshStandardMaterial({ color: '#ee8a2c', roughness: 0.75 })
  private tapes: { forehead: Strip; chin: Strip }
  /** Where each tape's free end is now, and which way it runs and faces. */
  ends: { forehead: { at: THREE.Vector3; along: THREE.Vector3; n: THREE.Vector3 } | null; chin: { at: THREE.Vector3; along: THREE.Vector3; n: THREE.Vector3 } | null } = { forehead: null, chin: null }

  constructor(
    rig: Rig,
    private scene: THREE.Scene,
  ) {
    this.collar = new Stifneck(rig)
    rig.root.updateMatrixWorld(true)
    const k = (this.k = rig.height / 1.72)
    this.head = rig.head
    const at = (o: THREE.Object3D) => o.getWorldPosition(v())
    const eyes = at(rig.eye.L).add(at(rig.eye.R)).multiplyScalar(0.5)
    const skin = rig.meshes.filter((m) => !m.name.startsWith('bare-leg'))
    const hitFrom = (from: THREE.Vector3, dir: THREE.Vector3) => new THREE.Raycaster(from, dir, 0, 0.6 * k).intersectObjects(skin, false)[0]
    // Earrings: a small gold ring at each lobe.
    const gold = new THREE.MeshStandardMaterial({ color: '#d8b24a', metalness: 0.9, roughness: 0.25 })
    const lobes: THREE.Vector3[] = []
    for (const s of [-1, 1]) {
      const lobeY = eyes.y - 0.04 * k
      const lobeZ = eyes.z - 0.075 * k
      const hit = hitFrom(v(eyes.x + s * 0.3 * k, lobeY, lobeZ), v(-s, 0, 0))
      const lobe = hit ? hit.point : v(eyes.x + s * 0.075 * k, lobeY, lobeZ)
      lobes.push(lobe)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0055 * k, 0.0012 * k, 8, 20), gold)
      ring.rotation.y = Math.PI / 2
      const holder = new THREE.Group()
      holder.add(ring)
      ring.position.set(s * 0.002 * k, -0.005 * k, 0)
      this.earrings.push(holderOn(rig.head, lobe, holder))
    }
    // The head's width across the ears: the widest it is, from the lobes up past the temples.
    let half = 0
    for (const dy of [-0.05, -0.03, -0.01, 0.01, 0.03, 0.05])
      for (const dz of [-0.03, -0.06, -0.09, -0.12])
        for (const s of [-1, 1]) {
          const hit = hitFrom(v(eyes.x + s * 0.3 * k, eyes.y + dy * k, eyes.z + dz * k), v(-s, 0, 0))
          if (hit) half = Math.max(half, Math.abs(hit.point.x - eyes.x))
        }
    this.half = half || 0.085 * k
    this.ears = rig.head.worldToLocal(lobes[0].clone().add(lobes[1]).multiplyScalar(0.5).add(v(0, 0.02 * k, 0)))
    // The forehead, a band round the head above the eyebrows: from her right side, over the front, to her left side.
    const y = eyes.y + 0.045 * k
    const centre = v(eyes.x, y, eyes.z - 0.085 * k)
    for (let deg = -115; deg <= 115; deg += 5) {
      const d = v(Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180))
      const hit = hitFrom(centre.clone().addScaledVector(d, 0.3 * k), d.clone().negate())
      if (hit) this.brow.push(rig.head.worldToLocal(hit.point.clone().addScaledVector(d, 0.0018 * k)))
    }
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#f3f1e8', roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
    this.tapes = { forehead: new Strip(tapeMat), chin: new Strip(tapeMat) }
    scene.add(this.tapes.forehead.mesh, this.tapes.chin.mesh)
  }

  /** The body's directions in the world now, flattened to the couch: toward the head, and to her left. */
  private axes(q: THREE.Quaternion) {
    const up = v(0, 1, 0).applyQuaternion(q).setY(0).normalize()
    const left = v(1, 0, 0).applyQuaternion(q).setY(0).normalize()
    return { up, left }
  }

  /**
   * A block for one side, made the first time it is needed (the patient lying down by then): a foam block standing on
   * the couch, long enough to take the tape over the forehead and over the chin support, with a hole for the ear.
   */
  private block(side: Side, couch: number, q: THREE.Quaternion) {
    const have = this.blocks[side]
    if (have) return have
    const k = this.k
    const { up } = this.axes(q)
    const ear = this.head.localToWorld(this.ears.clone())
    const brow = this.head.localToWorld(this.brow[Math.floor(this.brow.length / 2)].clone())
    const chin = this.collar.chinLine(3)[1]
    // Along the body, from just short of the chin support to just past the forehead (relative to the ear).
    const along = (p: THREE.Vector3) => p.clone().sub(ear).dot(up)
    const from = Math.min(along(chin) - 0.012 * k, -0.06 * k)
    const to = Math.max(along(brow) + 0.025 * k, 0.06 * k)
    const earHigh = ear.y - couch
    const s = (this.size = { len: to - from, tall: Math.max(earHigh + 0.05 * k, 0.14 * k), wide: 0.055 * k, bevel: 0.007 * k, past: (from + to) / 2 })
    const b = s.bevel
    const r = 0.02 * k
    // Drawn side on: along the body (x), up from the couch (y), the ear's hole; then given its thickness outward (z).
    const x0 = -s.len / 2 + b
    const x1 = s.len / 2 - b
    const y0 = b
    const y1 = s.tall - b
    const shape = new THREE.Shape()
    shape.moveTo(x0 + r, y0)
    shape.lineTo(x1 - r, y0)
    shape.quadraticCurveTo(x1, y0, x1, y0 + r)
    shape.lineTo(x1, y1 - r)
    shape.quadraticCurveTo(x1, y1, x1 - r, y1)
    shape.lineTo(x0 + r, y1)
    shape.quadraticCurveTo(x0, y1, x0, y1 - r)
    shape.lineTo(x0, y0 + r)
    shape.quadraticCurveTo(x0, y0, x0 + r, y0)
    const hole = new THREE.Path()
    // The right block's x runs toward the feet (its z points out to her right), so its hole is drawn the other way.
    const hx = (side === 'L' ? -1 : 1) * s.past
    hole.absarc(hx, Math.min(earHigh, s.tall - 0.035 * k), 0.021 * k, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: s.wide - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 18 })
    geo.translate(0, 0, b)
    const mesh = new THREE.Mesh(geo, this.blockMat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.visible = false
    this.scene.add(mesh)
    this.blocks[side] = mesh
    return mesh
  }

  /** Where a block's frame is (its inner face against the head when `slide` is 0), and its directions. */
  private blockFrame(side: Side, couch: number, q: THREE.Quaternion, slide: number) {
    const { up, left } = this.axes(q)
    const out = side === 'L' ? left.clone() : left.clone().negate()
    const ear = this.head.localToWorld(this.ears.clone())
    const origin = ear.clone().setY(couch).addScaledVector(out, this.half + 0.003 * this.k + slide).addScaledVector(up, this.size.past)
    // Its x along the body (toward the head on the left, toward the feet on the right), y up, z out.
    const x = side === 'L' ? up.clone() : up.clone().negate()
    return { origin, x, y: v(0, 1, 0), z: out, up }
  }

  /** Lay the blocks and the tape where they are now. */
  place(st: HeadState, couch: number, q: THREE.Quaternion) {
    const k = this.k
    for (const side of ['R', 'L'] as Side[]) {
      const p = side === 'R' ? st.blockR : st.blockL
      if (p <= 0.01 && !this.blocks[side]) continue
      const mesh = this.block(side, couch, q)
      mesh.visible = p > 0.01
      const f = this.blockFrame(side, couch, q, (1 - ease(p)) * 0.22 * k)
      mesh.position.copy(f.origin)
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.x, f.y, f.z))
      mesh.updateMatrixWorld(true)
    }
    const across = this.axes(q).up
    // The forehead: from the outside of the right block, over its top, across the forehead, to the left block.
    this.ends.forehead = null
    this.ends.chin = null
    const tapeF = this.tapes.forehead
    const tapeC = this.tapes.chin
    tapeF.mesh.visible = false
    tapeC.mesh.visible = false
    if (!this.blocks.R || !this.blocks.L) return
    const top = couch + this.size.tall + 0.0015 * k
    const edge = (side: Side, at: THREE.Vector3, outer: boolean) => {
      const f = this.blockFrame(side, couch, q, 0)
      const u = Math.max(-this.size.len / 2 + 0.015 * k, Math.min(this.size.len / 2 - 0.015 * k, at.clone().sub(f.origin).dot(f.up)))
      return f.origin.clone().setY(top).addScaledVector(f.up, u).addScaledVector(f.z, outer ? this.size.wide + 0.002 * k : -0.002 * k)
    }
    const headMid = this.head.localToWorld(this.ears.clone())
    if (st.tapeF > 0.01) {
      const arc = this.brow.map((p) => this.head.localToWorld(p.clone())).filter((p) => p.y > top + 0.004 * k)
      if (arc.length > 1) {
        const pts = [edge('R', arc[0], true), edge('R', arc[0], false), ...arc, edge('L', arc[arc.length - 1], false), edge('L', arc[arc.length - 1], true)]
        const end = tapeF.lay(pts, 0.025 * k, across, st.tapeF)
        this.ends.forehead = { ...end, n: this.faceOut(end.at, end.along, across, headMid) }
      }
    }
    if (st.tapeC > 0.01) {
      const line = this.collar.chinLine(12)
      const pts = [edge('R', line[0], true), edge('R', line[0], false), ...line, edge('L', line[line.length - 1], false), edge('L', line[line.length - 1], true)]
      const end = tapeC.lay(pts, 0.022 * k, across, st.tapeC)
      this.ends.chin = { ...end, n: this.faceOut(end.at, end.along, across, headMid) }
    }
  }

  /** The way the tape faces at a point: square to it, away from the head. */
  private faceOut(at: THREE.Vector3, along: THREE.Vector3, across: THREE.Vector3, mid: THREE.Vector3) {
    const n = along.clone().cross(across).normalize()
    return n.dot(at.clone().sub(mid)) < 0 ? n.negate() : n
  }

  /** The middle of a block's outer face (where a hand pushes it in), or of its top (where hands hold it down). */
  blockSpot(side: Side, face: 'out' | 'top') {
    const mesh = this.blocks[side]
    if (!mesh || !mesh.visible) return null
    const m = mesh.matrixWorld
    const x = v().setFromMatrixColumn(m, 0)
    const z = v().setFromMatrixColumn(m, 2)
    const s = this.size
    const local = face === 'out' ? v(0, s.tall * 0.55, s.wide) : v((side === 'L' ? 1 : -1) * 0.01 * this.k, s.tall, s.wide * 0.45)
    return { at: local.applyMatrix4(m), n: face === 'out' ? z.normalize() : v(0, 1, 0), x: x.normalize() }
  }

  /** How far a ball (`r` across) at a point in the world is inside either block, and the way out of it. */
  blockDepth(p: THREE.Vector3, r = 0): { depth: number; out: THREE.Vector3 } {
    let best = { depth: 0, out: v() }
    for (const side of ['R', 'L'] as Side[]) {
      const mesh = this.blocks[side]
      if (!mesh || !mesh.visible) continue
      const local = mesh.worldToLocal(p.clone())
      const s = this.size
      const faces: [number, THREE.Vector3][] = [
        [local.x + s.len / 2 + r, v(-1, 0, 0)],
        [s.len / 2 + r - local.x, v(1, 0, 0)],
        [local.y + r, v(0, -1, 0)],
        [s.tall + r - local.y, v(0, 1, 0)],
        [local.z + r, v(0, 0, -1)],
        [s.wide + r - local.z, v(0, 0, 1)],
      ]
      if (faces.some(([d]) => d <= 0)) continue
      const [depth, n] = faces.reduce((a, b) => (b[0] < a[0] ? b : a))
      if (depth > best.depth) best = { depth, out: n.transformDirection(mesh.matrixWorld) }
    }
    return best
  }

  dispose() {
    this.collar.dispose()
    this.tapes.forehead.dispose()
    this.tapes.chin.dispose()
    for (const m of [this.tapes.forehead.mesh, this.tapes.chin.mesh]) this.scene.remove(m)
    for (const side of ['R', 'L'] as Side[]) {
      const b = this.blocks[side]
      if (b) {
        b.geometry.dispose()
        this.scene.remove(b)
      }
    }
    for (const e of this.earrings)
      e.traverse((x) => {
        const m = x as THREE.Mesh
        if (m.isMesh) m.geometry.dispose()
      })
  }
}
