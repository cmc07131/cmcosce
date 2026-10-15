import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Rig } from './rig'

/**
 * A rigid cervical collar fitted to this patient's neck, and what goes with it: head blocks, tape, earrings to take off
 * first. Built once in the bind pose (standing: up +Y, face +Z, her right -X), shaped to the skin (found by casting
 * rays in toward the neck), each part riding on the neck or the head bone, hidden until it is put on.
 *
 * Each part sits in a holder whose axes are the body's in the bind pose; moving the part within its holder (along the
 * body's own right, up, front) brings it in from where it comes from: the back of the collar from the side, slid under
 * the neck; the front up from the chest; the blocks in from each side.
 */

export type CollarKit = {
  back: THREE.Object3D
  front: THREE.Object3D
  straps: THREE.Object3D
  blocks: { R: THREE.Object3D; L: THREE.Object3D }
  tape: { forehead: THREE.Object3D; chin: THREE.Object3D }
  earrings: THREE.Object3D[]
  /** Where a hand holds each part (in the part's own frame): the side of the back, the front of the chin piece. */
  grips: { back: THREE.Vector3; front: THREE.Vector3; blockR: THREE.Vector3; blockL: THREE.Vector3 }
  dispose(): void
}

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

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

export function buildCollar(rig: Rig): CollarKit {
  rig.root.updateMatrixWorld(true)
  for (const m of rig.meshes) if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).skeleton.update()
  const k = rig.height / 1.72
  const at = (o: THREE.Object3D) => o.getWorldPosition(v())
  const N = at(rig.neck)
  const H = at(rig.head)
  const eyes = at(rig.eye.L).add(at(rig.eye.R)).multiplyScalar(0.5)
  const span = Math.max(0.04 * k, H.y - N.y)
  const skin = rig.meshes.filter((m) => !m.name.startsWith('bare-leg'))
  const left = v(1, 0, 0)
  const front = v(0, 0, 1)
  /** Out from the neck's axis at this angle (0 the front, + toward her left). */
  const dirAt = (th: number) => front.clone().multiplyScalar(Math.cos(th)).addScaledVector(left, Math.sin(th))
  const centreAt = (y: number) => {
    const t = Math.max(-1, Math.min(1.5, (y - N.y) / span))
    return v(N.x + (H.x - N.x) * t, y, N.z + (H.z - N.z) * t)
  }
  /** The skin's distance from the axis, from outside in. */
  const skinR = (th: number, y: number) => {
    const c = centreAt(y)
    const d = dirAt(th)
    const hit = new THREE.Raycaster(c.clone().addScaledVector(d, 0.3 * k), d.clone().negate(), 0, 0.3 * k).intersectObjects(skin, false)[0]
    return hit ? 0.3 * k - hit.distance : 0.08 * k
  }
  // Where the collar runs: from the shoulders (lower at the front and back) up to under the chin (front), below the
  // ears (sides), to the base of the skull (back).
  const top = (th: number) => N.y + span * (0.45 + 0.3 * Math.max(0, Math.cos(th)) ** 1.5 + 0.45 * Math.max(0, -Math.cos(th)) ** 1.5)
  const bottom = (th: number) => N.y - span * (0.6 - 0.2 * Math.sin(th) ** 2)
  const ROWS = 9
  const COLS = 40
  // Radii on a grid round the neck, smoothed (the skin, and the clothes on some models, are not smooth).
  const grid: number[][] = []
  for (let i = 0; i <= COLS; i++) {
    const th = -Math.PI + (i / COLS) * Math.PI * 2
    const col: number[] = []
    for (let j = 0; j <= ROWS; j++) {
      const y = bottom(th) + ((top(th) - bottom(th)) * j) / ROWS
      col.push(Math.min(skinR(th, y), 0.115 * k))
    }
    grid.push(col)
  }
  const smooth = (g: number[][]) =>
    g.map((col, i) => col.map((_, j) => {
      let s = 0
      let n = 0
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const r = g[(i + di + COLS) % COLS]?.[j + dj]
          if (r !== undefined) {
            s += r
            n++
          }
        }
      return s / n
    }))
  const radii = smooth(smooth(grid))
  const pad = 0.004 * k
  const thick = 0.011 * k

  /** One half of the collar: a shell from angle `a` to `b`, padding inside, plastic outside, rims between. */
  const shell = (a: number, b: number, chin: boolean) => {
    // A dark shell over grey foam: it stands out against skin (or a pale manikin).
    const plastic = new THREE.MeshStandardMaterial({ color: '#56616e', roughness: 0.5, side: THREE.DoubleSide })
    const foam = new THREE.MeshStandardMaterial({ color: '#8d969f', roughness: 0.95, side: THREE.DoubleSide })
    const cols = 26
    const pt = (th: number, j: number, out: boolean) => {
      // The grid runs from -π to π: the back half wraps round.
      const u = ((Math.atan2(Math.sin(th), Math.cos(th)) + Math.PI) / (Math.PI * 2)) * COLS
      const i0 = Math.max(0, Math.min(COLS - 1, Math.floor(u)))
      const f = u - i0
      const r0 = radii[i0][j] * (1 - f) + radii[i0 + 1][j] * f
      // The chin piece: the top of the front stands a little further out, a cup under the jaw.
      const cup = chin ? 0.012 * k * Math.max(0, Math.cos(th)) ** 3 * (j / ROWS) ** 2 : 0
      const y = bottom(th) + ((top(th) - bottom(th)) * j) / ROWS
      return centreAt(y).addScaledVector(dirAt(th), r0 + pad + cup + (out ? thick : 0)).sub(N)
    }
    const surface = (out: boolean) => {
      const pos: number[] = []
      const idx: number[] = []
      for (let c = 0; c <= cols; c++)
        for (let j = 0; j <= ROWS; j++) pos.push(...pt(a + ((b - a) * c) / cols, j, out).toArray())
      for (let c = 0; c < cols; c++)
        for (let j = 0; j < ROWS; j++) {
          const p = c * (ROWS + 1) + j
          idx.push(p, p + ROWS + 1, p + 1, p + 1, p + ROWS + 1, p + ROWS + 2)
        }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      return g
    }
    // The rims: top and bottom edges, and the two ends, joining inside to outside.
    const rim = () => {
      const pos: number[] = []
      const edge = (list: [number, number][]) => {
        for (let n = 0; n < list.length - 1; n++) {
          const [t0, j0] = list[n]
          const [t1, j1] = list[n + 1]
          const q = [pt(t0, j0, false), pt(t0, j0, true), pt(t1, j1, true), pt(t1, j1, false)]
          pos.push(...q[0].toArray(), ...q[1].toArray(), ...q[2].toArray(), ...q[0].toArray(), ...q[2].toArray(), ...q[3].toArray())
        }
      }
      const along = (j: number) => Array.from({ length: cols + 1 }, (_, c) => [a + ((b - a) * c) / cols, j] as [number, number])
      edge(along(0))
      edge(along(ROWS))
      edge(Array.from({ length: ROWS + 1 }, (_, j) => [a, j] as [number, number]))
      edge(Array.from({ length: ROWS + 1 }, (_, j) => [b, j] as [number, number]))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.computeVertexNormals()
      return g
    }
    const group = new THREE.Group()
    group.add(new THREE.Mesh(surface(true), plastic), new THREE.Mesh(surface(false), foam), new THREE.Mesh(rim(), plastic))
    return group
  }

  // The front comes round to the sides, the back from side to side behind; they overlap where the straps fasten.
  const back = shell(Math.PI * 0.42, Math.PI * 1.58, false)
  const frontHalf = shell(-Math.PI * 0.58, Math.PI * 0.58, true)
  // The airway hole in the front.
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: '#15191d', roughness: 1, side: THREE.DoubleSide }))
  const mid = Math.round(ROWS * 0.45)
  const holeAt = centreAt(bottom(0) + ((top(0) - bottom(0)) * mid) / ROWS).addScaledVector(front, radii[COLS / 2][mid] + pad + thick + 0.0015 * k)
  hole.position.copy(holeAt.clone().sub(N))
  hole.scale.set(0.012 * k, 0.017 * k, 1)
  frontHalf.add(hole)
  // Velcro straps at each side, where the front laps over the back.
  const strapMat = new THREE.MeshStandardMaterial({ color: '#1d2228', roughness: 0.95 })
  const straps = new THREE.Group()
  for (const s of [-1, 1]) {
    const th = (s * Math.PI) / 2
    const j = Math.round(ROWS * 0.5)
    const y = bottom(th) + ((top(th) - bottom(th)) * j) / ROWS
    const r = radii[Math.round(((th + Math.PI) / (Math.PI * 2)) * COLS)][j] + pad + thick + 0.002 * k
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.004 * k, 0.03 * k, 0.05 * k), strapMat)
    strap.position.copy(centreAt(y).addScaledVector(dirAt(th), r).sub(N))
    straps.add(strap)
  }

  // Head blocks either side of the head, resting on the couch behind it.
  const headR = (() => {
    const hit = new THREE.Raycaster(H.clone().add(v(-0.3 * k, 0.05 * k, 0)), left.clone(), 0, 0.3 * k).intersectObjects(skin, false)[0]
    return hit ? 0.3 * k - hit.distance : 0.08 * k
  })()
  const blockMat = new THREE.MeshStandardMaterial({ color: '#ee8a2c', roughness: 0.7 })
  const block = () => new THREE.Mesh(new RoundedBoxGeometry(0.055 * k, 0.15 * k, 0.12 * k, 3, 0.012 * k), blockMat)
  const blockAt = (side: number) => v(H.x + side * (headR + 0.032 * k), H.y + 0.06 * k, H.z - 0.025 * k)
  const blockR = block()
  const blockL = block()
  // Tape: across the forehead from block to block, then across the chin piece.
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#f1efe4', roughness: 0.8, side: THREE.DoubleSide })
  const foreheadZ = (() => {
    const y = eyes.y + 0.045 * k
    const hit = new THREE.Raycaster(v(eyes.x, y, eyes.z + 0.3 * k), front.clone().negate(), 0, 0.3 * k).intersectObjects(skin, false)[0]
    return hit ? hit.point.z : eyes.z + 0.012 * k
  })()
  /** A strap from her right to her left, through the points given, `w` wide (up and down the body); its origin at its
   * right end, so it can be laid on from there. */
  const strip = (points: THREE.Vector3[], w: number) => {
    const curve = new THREE.CatmullRomCurve3(points)
    const pos: number[] = []
    const idx: number[] = []
    const n = 24
    const start = points[0]
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n).sub(start)
      pos.push(p.x, p.y - w / 2, p.z, p.x, p.y + w / 2, p.z)
      if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return { mesh: new THREE.Mesh(g, tapeMat), start }
  }
  const bR = blockAt(-1)
  const bL = blockAt(1)
  const fy = eyes.y + 0.045 * k
  const forehead = strip(
    [bR.clone().add(v(0, 0, 0.062 * k)), v(eyes.x - 0.05 * k, fy, foreheadZ - 0.01 * k), v(eyes.x, fy + 0.004 * k, foreheadZ + 0.003 * k), v(eyes.x + 0.05 * k, fy, foreheadZ - 0.01 * k), bL.clone().add(v(0, 0, 0.062 * k))],
    0.025 * k,
  )
  const chinFront = pt0(0)
  function pt0(th: number) {
    const j = ROWS - 1
    const y = bottom(th) + ((top(th) - bottom(th)) * j) / ROWS
    return centreAt(y).addScaledVector(dirAt(th), radii[Math.round(((th + Math.PI) / (Math.PI * 2)) * COLS)][j] + pad + thick + 0.012 * k + 0.003 * k)
  }
  const chin = strip([bR.clone().add(v(0, -0.06 * k, 0.062 * k)), pt0(-0.6), chinFront, pt0(0.6), bL.clone().add(v(0, -0.06 * k, 0.062 * k))], 0.022 * k)

  // Earrings: a small gold ring at each lobe.
  const gold = new THREE.MeshStandardMaterial({ color: '#d8b24a', metalness: 0.9, roughness: 0.25 })
  const earrings: THREE.Object3D[] = []
  for (const s of [-1, 1]) {
    const lobeY = eyes.y - 0.04 * k
    const lobeZ = eyes.z - 0.075 * k
    const hit = new THREE.Raycaster(v(eyes.x + s * 0.3 * k, lobeY, lobeZ), v(-s, 0, 0), 0, 0.3 * k).intersectObjects(skin, false)[0]
    const lobe = hit ? hit.point : v(eyes.x + s * 0.075 * k, lobeY, lobeZ)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0055 * k, 0.0012 * k, 8, 20), gold)
    ring.rotation.y = Math.PI / 2
    const holder = new THREE.Group()
    holder.add(ring)
    ring.position.set(s * 0.002 * k, -0.005 * k, 0)
    earrings.push(holderOn(rig.head, lobe, holder))
  }

  const kit: CollarKit = {
    back: holderOn(rig.neck, N, back),
    front: holderOn(rig.neck, N, frontHalf),
    straps: holderOn(rig.neck, N, straps),
    blocks: { R: holderOn(rig.head, bR, blockR), L: holderOn(rig.head, bL, blockL) },
    tape: { forehead: holderOn(rig.head, forehead.start, forehead.mesh), chin: holderOn(rig.head, chin.start, chin.mesh) },
    earrings,
    grips: {
      back: centreAt(N.y).addScaledVector(dirAt(-Math.PI * 0.55), 0.1 * k).sub(N),
      front: chinFront.clone().sub(N),
      blockR: v(-0.028 * k, 0, 0.03 * k),
      blockL: v(0.028 * k, 0, 0.03 * k),
    },
    dispose: () => {
      for (const o of [kit.back, kit.front, kit.straps, kit.blocks.R, kit.blocks.L, kit.tape.forehead, kit.tape.chin, ...kit.earrings])
        o.traverse((x) => {
          const m = x as THREE.Mesh
          if (m.isMesh) m.geometry.dispose()
        })
    },
  }
  return kit
}
