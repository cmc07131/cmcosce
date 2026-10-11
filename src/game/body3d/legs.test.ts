import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { bareLegs } from './legs'
import type { Rig } from './rig'

/**
 * A stand-in skeleton (hips, then each leg's thigh, shin, foot and toe), placed and scaled as the real models are (the
 * root not at the origin, not at scale 1), and a base mesh with a few "trouser" vertices on the right leg.
 */
function standIn() {
  const root = new THREE.Group()
  root.scale.setScalar(0.5)
  root.position.set(0, 1, 0)
  const hips = new THREE.Bone()
  root.add(hips)
  const leg = (x: number) => {
    const thigh = new THREE.Bone()
    thigh.position.set(x, -0.1, 0)
    const calf = new THREE.Bone()
    calf.position.set(0, -0.84, 0)
    const foot = new THREE.Bone()
    foot.position.set(0, -0.84, 0)
    const toe = new THREE.Bone()
    toe.position.set(0, -0.12, 0.26)
    hips.add(thigh)
    thigh.add(calf)
    calf.add(foot)
    foot.add(toe)
    return { thigh, calf, foot, toe }
  }
  const R = leg(-0.18)
  const L = leg(0.18)
  root.updateMatrixWorld(true)
  const bones = [hips, R.thigh, R.calf, R.foot, R.toe, L.thigh, L.calf, L.foot, L.toe]
  const skeleton = new THREE.Skeleton(bones)
  const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
  // Trousers: one vertex on the upper thigh (kept, above the hem), one on the shin and one on the shoe (tucked away).
  const K = at(R.calf)
  const H = at(R.thigh)
  const A = at(R.foot)
  const world = [H.clone().lerp(K, 0.2).add(new THREE.Vector3(0, 0, 0.1)), K.clone().lerp(A, 0.5).add(new THREE.Vector3(0, 0, 0.09)), A.clone().add(new THREE.Vector3(-0.08, -0.06, 0.1))]
  const boneOf = [1, 2, 3]
  const geo = new THREE.BufferGeometry()
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(world.flatMap((p) => p.clone().applyMatrix4(inv).toArray()), 3))
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(boneOf.flatMap((b) => [b, 0, 0, 0]), 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(boneOf.flatMap(() => [1, 0, 0, 0]), 4))
  geo.setIndex([0, 1, 2])
  const base = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial())
  root.add(base)
  root.updateMatrixWorld(true)
  base.bind(skeleton)
  const rig = {
    root,
    hips,
    thigh: { R: R.thigh, L: L.thigh },
    calf: { R: R.calf, L: L.calf },
    foot: { R: R.foot, L: L.foot },
    toe: { R: R.toe, L: L.toe },
    meshes: [base] as THREE.Mesh[],
    height: 0.86,
    legLength: 0.5 * (0.1 + 0.84 + 0.84 + 0.18),
    skin: new THREE.Color('#d9a68a'),
  } as unknown as Rig
  return { rig, base, R, world, at }
}

const skinned = (m: THREE.SkinnedMesh, i: number) => m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld)

test('bare legs: two skinned legs, in place in the bind pose, pickable', () => {
  const { rig } = standIn()
  const legs = bareLegs(rig)
  assert.equal(legs.length, 2)
  assert.ok(rig.meshes.includes(legs[0]) && rig.meshes.includes(legs[1]))
  rig.root.updateMatrixWorld(true)
  const leg = legs[0]
  const pos = leg.geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i += 97) {
    const built = new THREE.Vector3().fromBufferAttribute(pos, i)
    assert.ok(skinned(leg, i).distanceTo(built) < 1e-4, `vertex ${i} moved in the bind pose`)
  }
})

test('bare legs: the skin faces out of the leg; the sole is flat underneath', () => {
  const { rig, R, at } = standIn()
  const [leg] = bareLegs(rig)
  const pos = leg.geometry.attributes.position as THREE.BufferAttribute
  const nor = leg.geometry.attributes.normal as THREE.BufferAttribute
  const H = at(R.thigh)
  const A = at(R.foot)
  const sole = at(rig.hips).y - rig.legLength
  let out = 0
  let tube = 0
  let down = 0
  let soles = 0
  for (let i = 0; i < pos.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, i)
    const n = new THREE.Vector3().fromBufferAttribute(nor, i)
    if (p.y > A.y + 0.02 && p.y < H.y - 0.05) {
      // Round the bone: away from the line from hip to ankle (the leg is straight here).
      const axisPoint = new THREE.Vector3(H.x, p.y, H.z)
      tube++
      if (n.dot(p.clone().sub(axisPoint)) > 0) out++
    }
    if (p.y < sole + 0.002) {
      soles++
      if (n.y < 0) down++
    }
  }
  assert.ok(tube > 500 && out / tube > 0.99, `${out}/${tube} leg normals point out`)
  assert.ok(soles > 10 && down / soles > 0.95, `${down}/${soles} sole normals point down`)
})

test('bare legs: an effusion fills out the knee above and beside the kneecap', () => {
  const front = (rig: Rig, side: 'R' | 'L', aboveKnee: number) => {
    const leg = rig.meshes.find((m) => m.name === `bare-leg-${side}`) as THREE.SkinnedMesh
    const K = rig.calf[side].getWorldPosition(new THREE.Vector3())
    const pos = leg.geometry.attributes.position as THREE.BufferAttribute
    let best = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i)
      if (Math.abs(p.y - (K.y + aboveKnee)) < 0.01 && Math.abs(p.x - K.x) < 0.01) best = Math.max(best, p.z - K.z)
    }
    return best
  }
  const plain = standIn().rig
  bareLegs(plain)
  const swollen = standIn().rig
  bareLegs(swollen, { effusion: 'R' })
  // At half scale: the pouch above the kneecap stands out by more than half a centimetre (a centimetre full size).
  assert.ok(front(swollen, 'R', 0.04) - front(plain, 'R', 0.04) > 0.005, 'the suprapatellar pouch is full')
  assert.ok(Math.abs(front(swollen, 'L', 0.04) - front(plain, 'L', 0.04)) < 1e-6, 'the other knee is unchanged')
})

test('bare legs: below the hem the trousers and shoes are tucked inside; above it they stay', () => {
  const { rig, base, world } = standIn()
  bareLegs(rig)
  rig.root.updateMatrixWorld(true)
  assert.ok(skinned(base, 0).distanceTo(world[0]) < 1e-6, 'the shorts stay')
  assert.ok(skinned(base, 1).distanceTo(world[1]) > 0.04, 'the trouser leg is drawn in')
  assert.ok(skinned(base, 2).distanceTo(world[2]) > 0.04, 'the shoe is drawn in')
})

test('bare legs: they bend with the knee', () => {
  const { rig, R } = standIn()
  const [leg] = bareLegs(rig)
  const pos = leg.geometry.attributes.position as THREE.BufferAttribute
  // The lowest vertex of the leg (in the foot).
  let low = 0
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < pos.getY(low)) low = i
  const before = skinned(leg, low)
  R.calf.rotateX(Math.PI / 2)
  rig.root.updateMatrixWorld(true)
  leg.skeleton.update()
  const after = skinned(leg, low)
  const K = R.calf.getWorldPosition(new THREE.Vector3())
  // A quarter turn about the knee: the foot comes up level with the knee, as far from it as before.
  assert.ok(Math.abs(after.y - K.y) < 0.06, `the foot is level with the knee (${after.y.toFixed(3)} vs ${K.y.toFixed(3)})`)
  assert.ok(Math.abs(after.distanceTo(K) - before.distanceTo(K)) < 0.01)
})
