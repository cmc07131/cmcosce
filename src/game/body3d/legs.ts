import * as THREE from 'three'
import type { Rig, Side } from './rig'

/**
 * Bare legs, for a leg examination: the patient in shorts. The models wear trousers and shoes, modelled as clothes (a
 * baggy tube, a ring of vertices every few centimetres), so recolouring them never makes a knee. Instead each leg is
 * built here, from mid-thigh to the toes, in the shape of a leg (a kneecap with a hollow either side, the tibial
 * tuberosity, the calf, the ankle bones, a foot) and skinned to the patient's own thigh, shin, foot and toe bones, so
 * it bends, rolls and slides with them. Below the hem of the shorts the trousers and shoes are tucked away inside it.
 *
 * Built once, in the bind pose (standing: up +Y, face +Z, her right -X), before the landmarks are found on the skin.
 */

const SIDES: Side[] = ['R', 'L']
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
/** 0 at `a`, 1 at `b` (either way round), eased between. */
const ease = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A smooth curve through points (monotone cubic: no overshoot between them). */
function spline(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]))
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

/** A cross-section's four half-widths (m, for a 1.72 m adult): to the front, back, outside and inside. */
type Section = [number, number, number, number]

/** The thigh, from the knee (0) up toward the hip (1). */
const THIGH: [number, Section][] = [
  [0, [0.05, 0.046, 0.05, 0.052]],
  [0.07, [0.051, 0.05, 0.051, 0.056]],
  [0.15, [0.052, 0.053, 0.054, 0.06]],
  [0.28, [0.057, 0.058, 0.061, 0.061]],
  [0.45, [0.064, 0.066, 0.07, 0.064]],
  [0.65, [0.07, 0.074, 0.078, 0.07]],
  [0.85, [0.074, 0.08, 0.084, 0.076]],
]
/** The shin, from the knee (0) down to the ankle (1), and a little past it into the foot. */
const SHIN: [number, Section][] = [
  [0, [0.05, 0.046, 0.05, 0.052]],
  [0.06, [0.046, 0.05, 0.049, 0.051]],
  [0.15, [0.04, 0.056, 0.046, 0.049]],
  [0.28, [0.034, 0.066, 0.045, 0.047]],
  [0.4, [0.031, 0.064, 0.043, 0.044]],
  [0.55, [0.029, 0.052, 0.038, 0.038]],
  [0.72, [0.026, 0.04, 0.031, 0.031]],
  [0.88, [0.025, 0.032, 0.027, 0.028]],
  [1, [0.03, 0.034, 0.034, 0.034]],
  [1.08, [0.03, 0.034, 0.033, 0.033]],
]

/** A bump on the skin: where along the leg (m from the knee joint, + up), which way round (rad from the front, + to the
 * outside), how wide each way, how high (m; negative: a hollow). */
type Bump = { d: number; th: number; sd: number; sth: number; h: number }

/** What shapes a knee (and an ankle): the kneecap, the hollows beside it, the tibial tuberosity, the malleoli. */
function bumps(shin: number, effusion: boolean): Bump[] {
  const list: Bump[] = [
    { d: -0.055, th: 0, sd: 0.02, sth: 0.3, h: 0.005 },
    { d: -shin - 0.012, th: Math.PI / 2, sd: 0.014, sth: 0.35, h: 0.007 },
    { d: -shin + 0.004, th: -Math.PI / 2, sd: 0.014, sth: 0.35, h: 0.006 },
  ]
  if (!effusion)
    // The kneecap, with a hollow either side of it, and the patellar tendon below.
    return [
      ...list,
      { d: 0.028, th: 0, sd: 0.022, sth: 0.42, h: 0.013 },
      { d: 0.022, th: 0.78, sd: 0.024, sth: 0.28, h: -0.006 },
      { d: 0.022, th: -0.78, sd: 0.024, sth: 0.28, h: -0.006 },
    ]
  // A tense effusion: the pouch above the kneecap full, the hollows beside it filled out and bulging, the whole knee
  // rounder; the kneecap itself lost in it.
  return [
    ...list,
    { d: 0.028, th: 0, sd: 0.024, sth: 0.5, h: 0.012 },
    { d: 0.08, th: 0, sd: 0.042, sth: 0.95, h: 0.022 },
    { d: 0.022, th: 0.82, sd: 0.03, sth: 0.36, h: 0.013 },
    { d: 0.022, th: -0.82, sd: 0.03, sth: 0.36, h: 0.014 },
    { d: 0.035, th: 0, sd: 0.065, sth: 1.5, h: 0.008 },
  ]
}

/** The foot, along its length from behind the ankle (m, + forward), for a 1.72 m adult: half-width, and the top of it
 * above the sole; `ball` is where the toes begin. */
function footShape(ball: number, ankleUp: number) {
  const q = [-0.066, -0.056, -0.042, 0, 0.05, 0.09, ball, ball + 0.028, ball + 0.048, ball + 0.057]
  const half = [0.012, 0.024, 0.031, 0.034, 0.037, 0.042, 0.047, 0.045, 0.036, 0.016]
  const top = [0.02, 0.05, ankleUp + 0.01, ankleUp + 0.03, 0.075, 0.06, 0.04, 0.028, 0.02, 0.012]
  const bottom = [0.016, 0.004, 0, 0, 0.003, 0.006, 0, 0, 0.002, 0.005]
  return { q, half: spline(q, half), top: spline(q, top), bottom: spline(q, bottom) }
}

/** The bones a vertex is skinned to, and how much. */
type Weights = [number, number][]

/** Build the legs; returns the meshes (already added to the rig, and to its list of meshes for picking). */
export function bareLegs(rig: Rig, opts: { effusion?: Side } = {}): THREE.SkinnedMesh[] {
  const base = rig.meshes.find((m) => (m as THREE.SkinnedMesh).isSkinnedMesh && (m as THREE.SkinnedMesh).skeleton.bones.includes(rig.thigh.R as THREE.Bone)) as
    | THREE.SkinnedMesh
    | undefined
  if (!base) return []
  rig.root.updateMatrixWorld(true)
  base.skeleton.update()
  const skeleton = base.skeleton
  const boneIndex = (o: THREE.Object3D | undefined) => (o ? skeleton.bones.indexOf(o as THREE.Bone) : -1)
  // The models load in their bind pose, where every bone's world transform times its inverse bind matrix is one and the
  // same (the model's own placing): the new skin binds with it.
  const bindToWorld = base.matrixWorld.clone().multiply(base.bindMatrix.clone().invert())
  const k = rig.height / 1.72
  const at = (o: THREE.Object3D) => o.getWorldPosition(v())
  const sole = at(rig.hips).y - rig.legLength
  // The patient's own skin tone, as it is read from the face.
  const material = new THREE.MeshStandardMaterial({ name: 'bare-legs', roughness: 0.62, metalness: 0 })
  material.color = rig.skin
  const made: THREE.SkinnedMesh[] = []

  for (const s of SIDES) {
    const H = at(rig.thigh[s])
    const K = at(rig.calf[s])
    const A = at(rig.foot[s])
    const toe = rig.toe[s]
    const T = toe ? at(toe) : A.clone().add(v(0, -0.05, 0.13).multiplyScalar(k))
    const thighLen = H.distanceTo(K)
    const shinLen = K.distanceTo(A)
    const up = H.clone().sub(K).normalize()
    const down = A.clone().sub(K).normalize()
    const outward = v(s === 'R' ? -1 : 1, 0, 0)
    const ids = { thigh: boneIndex(rig.thigh[s]), calf: boneIndex(rig.calf[s]), foot: boneIndex(rig.foot[s]), toe: boneIndex(toe) }
    if (ids.thigh < 0 || ids.calf < 0 || ids.foot < 0) continue
    const pos: number[] = []
    const skinIndex: number[] = []
    const skinWeight: number[] = []
    const index: number[] = []
    /** For each vertex, a point inside the leg behind it: each triangle is wound to face away from it. */
    const inside: THREE.Vector3[] = []
    const add = (p: THREE.Vector3, w: Weights, core: THREE.Vector3) => {
      pos.push(p.x, p.y, p.z)
      inside.push(core)
      const top = w.filter(([i, x]) => i >= 0 && x > 0).sort((a, b) => b[1] - a[1]).slice(0, 4)
      const sum = top.reduce((a, [, x]) => a + x, 0) || 1
      for (let j = 0; j < 4; j++) {
        skinIndex.push(top[j]?.[0] ?? 0)
        skinWeight.push((top[j]?.[1] ?? 0) / sum)
      }
    }
    /** Join ring after ring of `n` points into a tube. */
    const tube = (first: number, rings: number, n: number) => {
      for (let r = 0; r < rings - 1; r++)
        for (let j = 0; j < n; j++) {
          const a = first + r * n + j
          const b = first + r * n + ((j + 1) % n)
          const c = a + n
          const d = b + n
          index.push(a, c, b, b, c, d)
        }
    }

    // The leg: rings round the bone, from inside the shorts to just inside the foot.
    const N = 32
    const thighRows = THIGH.map(([x, r]) => [x * thighLen, r] as const)
    const shinRows = SHIN.map(([y, r]) => [-y * shinLen, r] as const)
    const rows = [...shinRows.slice().reverse(), ...thighRows.slice(1)]
    const ds = rows.map(([d]) => d)
    const radius = [0, 1, 2, 3].map((c) => spline(ds, rows.map(([, r]) => r[c] * k)))
    const lumps = bumps(shinLen / k, opts.effusion === s).map((b) => ({ ...b, sd: b.sd * k, h: b.h * k, d: b.d * k }))
    const dTop = 0.85 * thighLen
    const dBottom = -1.08 * shinLen
    const legStart = pos.length / 3
    const steps = 72
    for (let i = 0; i <= steps; i++) {
      const d = dTop + ((dBottom - dTop) * i) / steps
      // The centre on the bone; the frame turns from the thigh's to the shin's over the knee.
      const centre = d >= 0 ? K.clone().addScaledVector(up, d) : K.clone().addScaledVector(down, -d)
      const blend = ease(0.04 * k, -0.04 * k, d)
      const axis = up.clone().negate().lerp(down, blend).normalize()
      const front = v(0, 0, 1).addScaledVector(axis, -axis.z).normalize()
      const side = outward.clone().addScaledVector(axis, -axis.dot(outward)).addScaledVector(front, -front.dot(outward)).normalize()
      const [rf, rb, rl, rm] = radius.map((f) => f(d))
      // Skinning: the thigh above the knee, the shin below, blended across the joint; the foot below the ankle.
      const toCalf = ease(0.035 * k, -0.03 * k, d)
      const toFoot = ease(-shinLen + 0.03 * k, -shinLen - 0.015 * k, d)
      const w: Weights = [
        [ids.thigh, 1 - toCalf],
        [ids.calf, toCalf * (1 - toFoot)],
        [ids.foot, toFoot],
      ]
      for (let j = 0; j < N; j++) {
        const th = (j / N) * Math.PI * 2
        const c = Math.cos(th)
        const sn = Math.sin(th)
        const a = c >= 0 ? rf : rb
        const b = sn >= 0 ? rl : rm
        let r = 1 / Math.sqrt((c / a) ** 2 + (sn / b) ** 2)
        for (const L of lumps) {
          const dth = Math.atan2(Math.sin(th - L.th), Math.cos(th - L.th))
          r += L.h * Math.exp(-((d - L.d) ** 2) / (2 * L.sd * L.sd) - (dth * dth) / (2 * L.sth * L.sth))
        }
        add(centre.clone().addScaledVector(front, c * r).addScaledVector(side, sn * r), w, centre)
      }
    }
    tube(legStart, steps + 1, N)

    // The foot: sections across it from the heel to the toes, flat on the sole.
    const fwd = T.clone().sub(A).setY(0).normalize()
    const across = v(0, 1, 0).cross(fwd).normalize()
    if (across.dot(outward) < 0) across.negate()
    // The toe bone sits near the ball of the foot (on some models further on): a man's foot is about 26 cm long.
    const ball = Math.min(0.14 * k, Math.max(0.12 * k, A.clone().sub(T).setY(0).length()))
    const shape = footShape(ball / k, (A.y - sole) / k)
    const M = 24
    const footStart = pos.length / 3
    const fSteps = 40
    const q0 = shape.q[0]
    const q1 = shape.q[shape.q.length - 1]
    for (let i = 0; i <= fSteps; i++) {
      const q = q0 + ((q1 - q0) * i) / fSteps
      const half = shape.half(q) * k
      const top = sole + shape.top(q) * k
      const bottom = sole + shape.bottom(q) * k
      const mid = (top + bottom) / 2
      const hh = Math.max(0.002, (top - bottom) / 2)
      const centre = v(A.x, mid, A.z).addScaledVector(fwd, q * k)
      const toToe = ids.toe >= 0 ? ease(ball - 0.015 * k, ball + 0.015 * k, q * k) : 0
      for (let j = 0; j < M; j++) {
        const th = (j / M) * Math.PI * 2
        // Rounded, a little square at the sides, flat underneath (smooth all round: no crease along the sole).
        const c = Math.cos(th)
        const sn = Math.sin(th)
        const x = c * (1.1 - 0.1 * c * c) * half
        const y = sn >= 0 ? sn * hh : -(2 * -sn - sn * sn) * hh
        const p = centre.clone().addScaledVector(across, x).add(v(0, y, 0))
        // Over the front of the ankle the skin goes with the shin as the foot moves.
        const toShin = ease(A.y - 0.02 * k, A.y + 0.03 * k, p.y) * 0.8
        add(
          p,
          [
            [ids.calf, toShin],
            [ids.foot, (1 - toShin) * (1 - toToe)],
            [ids.toe, (1 - toShin) * toToe],
          ],
          centre,
        )
      }
    }
    tube(footStart, fSteps + 1, M)
    // Close the heel and the tip of the toes (the inside point a little way back into the foot).
    for (const ring of [0, fSteps]) {
      const first = footStart + ring * M
      const c = v()
      for (let j = 0; j < M; j++) c.add(v(pos[(first + j) * 3], pos[(first + j) * 3 + 1], pos[(first + j) * 3 + 2]))
      c.multiplyScalar(1 / M)
      const centreIndex = pos.length / 3
      add(c, ring && ids.toe >= 0 ? [[ids.toe, 1]] : [[ids.foot, 1]], c.clone().addScaledVector(fwd, ring ? -0.03 * k : 0.03 * k))
      for (let j = 0; j < M; j++) index.push(centreIndex, first + j, first + ((j + 1) % M))
    }

    // Every triangle wound to face out (away from the inside of the leg or the foot behind it).
    const P = (i: number) => v(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    for (let t = 0; t < index.length; t += 3) {
      const [a, b, c] = [P(index[t]), P(index[t + 1]), P(index[t + 2])]
      const n = b.clone().sub(a).cross(c.clone().sub(a))
      const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3)
      if (n.dot(mid.sub(inside[index[t]])) < 0) [index[t + 1], index[t + 2]] = [index[t + 2], index[t + 1]]
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
    geo.setIndex(index)
    geo.computeVertexNormals()
    const mesh = new THREE.SkinnedMesh(geo, material)
    mesh.name = `bare-leg-${s}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    rig.root.add(mesh)
    mesh.bind(skeleton, bindToWorld.clone().invert())
    made.push(mesh)
    // The shoe goes onto a line through the middle of the bare foot (the toe bone can sit beyond its toes).
    const heel = v(A.x, sole + 0.04 * k, A.z)
    tuckTrousers(rig, s, { H, K, A, F0: heel, F1: heel.clone().addScaledVector(fwd, 0.12 * k), hem: 0.42 })
  }
  rig.meshes.push(...made)
  return made
}

/**
 * Below the hem of the shorts, the trouser leg and the shoe drawn in tight round the bone: inside the bare leg, out of
 * sight. Only vertices that move mostly with this leg's bones.
 */
function tuckTrousers(rig: Rig, s: Side, g: { H: THREE.Vector3; K: THREE.Vector3; A: THREE.Vector3; F0: THREE.Vector3; F1: THREE.Vector3; hem: number }) {
  const legBones = new Set<THREE.Object3D | undefined>([rig.thigh[s], rig.calf[s], rig.foot[s], rig.toe[s]])
  const p = v()
  const near = (a: THREE.Vector3, b: THREE.Vector3, x: THREE.Vector3) => {
    const ab = b.clone().sub(a)
    const u = Math.max(0, Math.min(1, x.clone().sub(a).dot(ab) / ab.lengthSq()))
    return { u, c: a.clone().addScaledVector(ab, u) }
  }
  for (const mesh of rig.meshes) {
    const m = mesh as THREE.SkinnedMesh
    if (!m.isSkinnedMesh || m.name.startsWith('bare-leg')) continue
    const idx = m.geometry.attributes.skinIndex as THREE.BufferAttribute | undefined
    const wgt = m.geometry.attributes.skinWeight as THREE.BufferAttribute | undefined
    const position = m.geometry.attributes.position as THREE.BufferAttribute
    if (!idx || !wgt) continue
    const toLocal = new THREE.Matrix3().setFromMatrix4(m.matrixWorld.clone().invert())
    let changed = false
    for (let i = 0; i < idx.count; i++) {
      let best = -1
      let bestW = -1
      for (let j = 0; j < 4; j++) {
        const w = wgt.getComponent(i, j)
        if (w > bestW) {
          bestW = w
          best = idx.getComponent(i, j)
        }
      }
      const bone = m.skeleton.bones[best]
      if (!legBones.has(bone)) continue
      m.getVertexPosition(i, p)
      p.applyMatrix4(m.matrixWorld)
      let c: THREE.Vector3
      if (bone === rig.thigh[s]) {
        const n = near(g.H, g.K, p)
        if (n.u <= g.hem) continue
        c = n.c
      } else if (bone === rig.calf[s]) c = near(g.K, g.A, p).c
      else c = near(g.F0, g.F1, p).c
      // Almost onto the bone: well inside the leg and the foot.
      const move = c.sub(p).multiplyScalar(0.97).applyMatrix3(toLocal)
      position.setXYZ(i, position.getX(i) + move.x, position.getY(i) + move.y, position.getZ(i) + move.z)
      changed = true
    }
    if (changed) {
      position.needsUpdate = true
      m.geometry.computeBoundingSphere()
      m.computeBoundingSphere()
    }
  }
}
