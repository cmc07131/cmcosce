import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * The examiner's gloved hand, for showing how each manoeuvre is done: two fingers on a pulse, a thumb on a nail bed,
 * the backs of the fingers for warmth, a palm on the forearm, a cotton bud, a neurotip, a Doppler probe.
 *
 * Its own frame: fingers along +Z, palm facing -Y, thumb toward +X. `place` turns it so the chosen part meets a point
 * on the skin from outside.
 */

export type Grip = 'two-fingers' | 'thumb' | 'flat' | 'back' | 'cup' | 'cotton' | 'neurotip' | 'doppler'
export type Contact = 'fingertips' | 'thumb' | 'palm' | 'back' | 'tool'

const GLOVE = new THREE.MeshStandardMaterial({ color: '#6b9bd6', roughness: 0.5, metalness: 0 })

function capsule(len: number, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat)
  m.rotation.x = Math.PI / 2
  m.position.z = len / 2 + r
  m.castShadow = true
  return m
}

/** A digit: two segments that curl toward the palm. Returns its knuckle and the tip marker. */
function digit(len1: number, len2: number, r: number) {
  const base = new THREE.Group()
  base.add(capsule(len1, r, GLOVE))
  const mid = new THREE.Group()
  mid.position.z = len1 + r * 1.6
  base.add(mid)
  mid.add(capsule(len2, r * 0.95, GLOVE))
  const tip = new THREE.Object3D()
  tip.position.set(0, -r * 0.6, len2 + r * 1.8)
  mid.add(tip)
  return { base, mid, tip }
}

export class ExaminerHand {
  readonly group = new THREE.Group()
  private fingers: ReturnType<typeof digit>[] = []
  private thumbD: ReturnType<typeof digit>
  private palmFace = new THREE.Object3D()
  private backFace = new THREE.Object3D()
  private tools: Record<'cotton' | 'neurotip' | 'doppler', { obj: THREE.Object3D; tip: THREE.Object3D }>
  grip: Grip = 'flat'

  constructor(scene: THREE.Scene) {
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.024, 0.085, 3, 0.01), GLOVE)
    palm.castShadow = true
    this.group.add(palm)
    // Index to little, across the front of the palm.
    for (const [i, x] of [0.026, 0.009, -0.009, -0.026].entries()) {
      const d = digit(i === 3 ? 0.026 : 0.032, i === 3 ? 0.022 : 0.028, 0.0082)
      d.base.position.set(x, 0, 0.04)
      this.group.add(d.base)
      this.fingers.push(d)
    }
    this.thumbD = digit(0.026, 0.024, 0.0092)
    this.thumbD.base.position.set(0.038, -0.004, 0.0)
    this.thumbD.base.rotation.y = 0.75
    this.group.add(this.thumbD.base)
    this.palmFace.position.set(0, -0.013, 0.01)
    this.backFace.position.set(0, 0.014, 0.075)
    this.group.add(this.palmFace, this.backFace)

    const tool = (stick: THREE.Material, len: number, r: number, tipR: number, tipMat: THREE.Material) => {
      const obj = new THREE.Group()
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), stick)
      body.rotation.x = Math.PI / 2
      body.position.z = len / 2
      const head = new THREE.Mesh(new THREE.SphereGeometry(tipR, 14, 10), tipMat)
      head.position.z = len
      obj.add(body, head)
      const tip = new THREE.Object3D()
      tip.position.z = len + tipR
      obj.add(tip)
      // Held between the thumb and the index finger, pointing on past the fingertips.
      obj.position.set(0.02, -0.018, 0.02)
      obj.rotation.x = 0.25
      obj.visible = false
      this.group.add(obj)
      return { obj, tip }
    }
    this.tools = {
      cotton: tool(new THREE.MeshStandardMaterial({ color: '#f4f1ea' }), 0.11, 0.0022, 0.0075, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })),
      neurotip: tool(new THREE.MeshStandardMaterial({ color: '#f2c84b' }), 0.08, 0.0035, 0.003, new THREE.MeshStandardMaterial({ color: '#d0d4d8', metalness: 0.6 })),
      doppler: tool(new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.4 }), 0.1, 0.009, 0.008, new THREE.MeshStandardMaterial({ color: '#7d8a96' })),
    }
    this.group.visible = false
    scene.add(this.group)
  }

  /** Shape the hand for a manoeuvre. */
  setGrip(grip: Grip) {
    this.grip = grip
    const curl = (d: ReturnType<typeof digit>, a: number, b = a) => {
      d.base.rotation.x = a
      d.mid.rotation.x = b
    }
    const [index, middle, ring, little] = this.fingers
    const all = (a: number, b = a) => this.fingers.forEach((d) => curl(d, a, b))
    for (const t of Object.values(this.tools)) t.obj.visible = false
    this.thumbD.base.rotation.set(0, 0.75, 0)
    curl(this.thumbD, 0.15)
    switch (grip) {
      case 'two-fingers':
        curl(index, 0.15, 0.1)
        curl(middle, 0.15, 0.1)
        curl(ring, 1.4, 1.3)
        curl(little, 1.4, 1.3)
        curl(this.thumbD, 0.6)
        break
      case 'thumb':
        all(1.3, 1.2)
        this.thumbD.base.rotation.set(0.5, 0.2, 0)
        curl(this.thumbD, 0.5, 0.1)
        break
      case 'back':
        all(0.05)
        break
      case 'cup':
        all(0.55, 0.5)
        curl(this.thumbD, 0.5)
        break
      case 'cotton':
      case 'neurotip':
      case 'doppler':
        all(1.1, 1.0)
        curl(index, 0.5, 0.4)
        curl(this.thumbD, 0.5)
        this.tools[grip].obj.visible = true
        break
      default:
        all(0.05)
    }
  }

  private contactPoint(contact: Contact): THREE.Object3D {
    const [index, middle] = this.fingers
    switch (contact) {
      case 'thumb':
        return this.thumbD.tip
      case 'palm':
        return this.palmFace
      case 'back':
        return this.backFace
      case 'tool':
        return this.grip === 'cotton' || this.grip === 'neurotip' || this.grip === 'doppler' ? this.tools[this.grip].tip : index.tip
      default: {
        // Between the index and middle fingertips.
        const mid = new THREE.Object3D()
        mid.position.copy(index.tip.getWorldPosition(new THREE.Vector3()).add(middle.tip.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5))
        return mid
      }
    }
  }

  /**
   * Put the hand so that `contact` sits `gap` metres out from `point` along the skin's outward `normal`, the fingers
   * running along `along`. The palm faces the skin, except for `back` (the backs of the fingers do).
   */
  place(point: THREE.Vector3, normal: THREE.Vector3, along: THREE.Vector3, contact: Contact, gap: number) {
    const n = normal.clone().normalize()
    const z = along.clone().sub(n.clone().multiplyScalar(along.dot(n)))
    if (z.lengthSq() < 1e-6) z.set(1, 0, 0).sub(n.clone().multiplyScalar(n.x))
    z.normalize()
    // Palm (-Y) toward the skin; for the back of the hand, +Y toward the skin.
    const y = contact === 'back' ? n.clone().negate() : n.clone()
    const x = y.clone().cross(z).normalize()
    const zz = x.clone().cross(y).normalize()
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, zz))
    // A tool points into the skin rather than lying along it.
    if (contact === 'tool') this.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.9))
    this.group.position.set(0, 0, 0)
    this.group.updateMatrixWorld(true)
    const c = this.contactPoint(contact)
    const at = c.parent ? c.getWorldPosition(new THREE.Vector3()) : c.position.clone()
    this.group.position.copy(point).addScaledVector(n, gap).sub(at)
    this.group.visible = true
  }

  hide() {
    this.group.visible = false
  }
}
