import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * The examiner's gloved hand and white-coat sleeve, for showing how each manoeuvre is done: two fingers on a pulse, a
 * thumb on a nail bed, the backs of the fingers for warmth, a hand round the forearm or the shin, a cotton bud, a
 * neurotip, a Doppler probe. Two-handed manoeuvres (a Lachman test) use a second, mirrored one.
 *
 * Its own frame: the wrist at the origin, fingers along +Z, palm facing -Y, thumb toward +X; the sleeve runs back
 * along -Z. `place` turns it so the chosen part meets a point on the skin from outside.
 */

export type Grip = 'two-fingers' | 'press' | 'thumb' | 'flat' | 'back' | 'cup' | 'cotton' | 'neurotip' | 'doppler' | 'torch' | 'otoscope' | 'fork' | 'chart'
type ToolGrip = 'cotton' | 'neurotip' | 'doppler' | 'torch' | 'otoscope' | 'fork' | 'chart'
const TOOL_GRIPS: ToolGrip[] = ['cotton', 'neurotip', 'doppler', 'torch', 'otoscope', 'fork', 'chart']

/**
 * A 3-metre Snellen chart: rows of Sloan letters getting smaller, each row's acuity at its left. Drawn here (no
 * picture of a real chart is used).
 */
function snellenTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 792
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#fbfbf7'
    g.fillRect(0, 0, c.width, c.height)
    // Read at 3 metres: 3/3 is 6/6.
    const rows: [string, string, number][] = [
      ['H', '3/30', 150],
      ['O Z', '3/18', 92],
      ['N C K', '3/12', 64],
      ['Z H S V', '3/9', 48],
      ['D K C N R', '3/6', 34],
      ['S O V H Z D', '3/4.5', 26],
      ['K C R H N O S', '3/3', 19],
      ['V Z D S C K H', '3/2.5', 15],
    ]
    let y = 40
    for (const [letters, label, size] of rows) {
      y += size * 1.12
      g.fillStyle = '#111'
      g.font = `bold ${size}px Arial, Helvetica, sans-serif`
      g.textAlign = 'center'
      g.fillText(letters, 276, y)
      g.fillStyle = '#666'
      g.font = '15px Arial, Helvetica, sans-serif'
      g.textAlign = 'left'
      g.fillText(label, 12, y)
      y += 18
    }
    // A thin border.
    g.strokeStyle = '#c0392b'
    g.lineWidth = 3
    g.strokeRect(6, 6, c.width - 12, c.height - 12)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
export type Contact = 'fingertips' | 'index' | 'thumb' | 'palm' | 'back' | 'tool'

const GLOVE = new THREE.MeshStandardMaterial({ color: '#7fa8e3', roughness: 0.45, metalness: 0 })
const COAT = new THREE.MeshStandardMaterial({ color: '#f4f5f7', roughness: 0.8, metalness: 0 })

/** A capsule from the origin along +Z. */
function bone(len: number, r: number, mat: THREE.Material = GLOVE) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat)
  m.rotation.x = Math.PI / 2
  m.position.z = len / 2
  m.castShadow = true
  return m
}

/** A finger of three segments; each joint bends toward the palm (-Y). The pad marker sits under the tip. */
type Digit = { joints: THREE.Group[]; pad: THREE.Object3D; lens: [number, number, number]; r: number }
function finger(lens: [number, number, number], r: number): Digit {
  const joints = lens.map((len, i) => {
    const j = new THREE.Group()
    j.add(bone(len, r * (1 - i * 0.06)))
    return j
  })
  // Each segment hangs off the end of the one before.
  for (let i = 1; i < 3; i++) {
    joints[i].position.z = lens[i - 1]
    joints[i - 1].add(joints[i])
  }
  const pad = new THREE.Object3D()
  pad.position.set(0, -r * 0.75, lens[2] * 0.75)
  joints[2].add(pad)
  return { joints, pad, lens, r }
}

export class ExaminerHand {
  readonly group = new THREE.Group()
  private fingers: Digit[] = []
  private thumbBase = new THREE.Group()
  private thumb: Digit
  private palmFace = new THREE.Object3D()
  private backFace = new THREE.Object3D()
  private tools: Record<ToolGrip, { obj: THREE.Object3D; tip: THREE.Object3D }>
  grip: Grip = 'flat'

  /** `left`: the examiner's other hand (the same hand, mirrored). */
  constructor(scene: THREE.Scene, left = false) {
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.084, 0.03, 0.094, 4, 0.012), GLOVE)
    palm.position.z = 0.047
    palm.castShadow = true
    this.group.add(palm)
    // The wrist and the coat sleeve: the arm the hand belongs to.
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.05, 18), GLOVE)
    wrist.rotation.x = Math.PI / 2
    wrist.position.z = -0.012
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.3, 20, 1, true), COAT)
    sleeve.rotation.x = Math.PI / 2
    sleeve.position.z = -0.18
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.006, 8, 24), COAT)
    cuff.position.z = -0.03
    this.group.add(wrist, sleeve, cuff)

    // Index to little, across the knuckles.
    const specs: [number, [number, number, number], number][] = [
      [0.028, [0.042, 0.026, 0.021], 0.0095],
      [0.0095, [0.047, 0.03, 0.023], 0.0098],
      [-0.0095, [0.044, 0.028, 0.022], 0.0093],
      [-0.028, [0.035, 0.022, 0.019], 0.0083],
    ]
    for (const [x, lens, r] of specs) {
      const d = finger(lens, r)
      d.joints[0].position.set(x, 0, 0.092)
      this.group.add(d.joints[0])
      this.fingers.push(d)
    }
    // The thumb comes off the side of the palm, angled forward and out.
    this.thumbBase.position.set(0.034, -0.006, 0.018)
    this.group.add(this.thumbBase)
    this.thumb = finger([0.038, 0.03, 0.025], 0.0108)
    this.thumbBase.add(this.thumb.joints[0])

    this.palmFace.position.set(0, -0.016, 0.05)
    this.backFace.position.set(0, 0.012, 0.125)
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
      // Held in a pinch between thumb and index, pointing on past the fingertips.
      obj.position.set(0.03, -0.022, 0.1)
      obj.rotation.x = 0.35
      obj.visible = false
      this.group.add(obj)
      return { obj, tip }
    }
    this.tools = {
      cotton: tool(new THREE.MeshStandardMaterial({ color: '#f4f1ea' }), 0.1, 0.0022, 0.0075, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })),
      neurotip: tool(new THREE.MeshStandardMaterial({ color: '#f2c84b' }), 0.075, 0.0035, 0.003, new THREE.MeshStandardMaterial({ color: '#d0d4d8', metalness: 0.6 })),
      doppler: tool(new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.4 }), 0.1, 0.009, 0.008, new THREE.MeshStandardMaterial({ color: '#7d8a96' })),
      // A pen torch, its bulb lit.
      torch: tool(new THREE.MeshStandardMaterial({ color: '#3a4047', metalness: 0.6, roughness: 0.35 }), 0.12, 0.0055, 0.0055, new THREE.MeshStandardMaterial({ color: '#fff6c8', emissive: '#ffe680', emissiveIntensity: 1.2 })),
      // An otoscope: a black handle, the head and its speculum.
      otoscope: tool(new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.5 }), 0.1, 0.011, 0.006, new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.4 })),
      // A tuning fork: the stem, then two prongs.
      fork: (() => {
        const t = tool(new THREE.MeshStandardMaterial({ color: '#b9c0c8', metalness: 0.9, roughness: 0.25 }), 0.05, 0.003, 0.006, new THREE.MeshStandardMaterial({ color: '#b9c0c8', metalness: 0.9, roughness: 0.25 }))
        const steel = new THREE.MeshStandardMaterial({ color: '#c9d0d8', metalness: 0.9, roughness: 0.2 })
        // The prongs stand back past your fingers (the stem's end is what touches).
        for (const x of [-0.006, 0.006]) {
          const prong = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.09), steel)
          prong.position.set(x, -0.022, -0.035)
          t.obj.add(prong)
        }
        return t
      })(),
      // A 3-metre Snellen chart held by its side edge, your arm out to the side: the fingers lie across the back of it,
      // the board running on past the fingertips; its face turned the way the palm faces (toward the patient), its top
      // toward the back of your thumb's side (-X). The tip is its centre.
      chart: (() => {
        const obj = new THREE.Group()
        const W = 0.22
        const H = 0.34
        // A stiff board with a dark blue back, the chart on its face.
        const board = new THREE.Mesh(new THREE.BoxGeometry(H, 0.005, W), new THREE.MeshStandardMaterial({ color: '#34495e', roughness: 0.6 }))
        const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.006, H - 0.006), new THREE.MeshStandardMaterial({ map: typeof document === 'undefined' ? null : snellenTexture(), roughness: 0.8 }))
        // The chart's right along the fingers, its top to -X, its face to -Y (away from the palm's side of the board).
        face.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)))
        face.position.y = -0.0028
        board.castShadow = true
        obj.add(board, face)
        // Its near edge under the middle of the fingers.
        obj.position.set(0, -0.026, 0.065 + W / 2)
        const tip = new THREE.Object3D()
        obj.add(tip)
        obj.visible = false
        this.group.add(obj)
        return { obj, tip }
      })(),
    }
    if (left) this.group.scale.x = -1
    this.group.visible = false
    scene.add(this.group)
  }

  /** Shape the hand for a manoeuvre. Angles: each finger's three joints (radians, toward the palm). */
  setGrip(grip: Grip) {
    this.grip = grip
    const bend = (d: Digit, a: number, b: number, c: number) => {
      d.joints[0].rotation.x = a
      d.joints[1].rotation.x = b
      d.joints[2].rotation.x = c
    }
    const [index, middle, ring, little] = this.fingers
    const all = (a: number, b: number, c: number) => this.fingers.forEach((d) => bend(d, a, b, c))
    // The thumb: swung out from the palm (y), down toward it (x), and its two joints.
    const thumb = (out: number, down: number, b: number, c: number) => {
      this.thumbBase.rotation.set(down, out, 0)
      bend(this.thumb, 0, b, c)
    }
    for (const t of Object.values(this.tools)) t.obj.visible = false
    switch (grip) {
      case 'two-fingers':
        // Index and middle pads together on the pulse; the others tucked.
        bend(index, 0.25, 0.25, 0.15)
        bend(middle, 0.25, 0.25, 0.15)
        bend(ring, 1.3, 1.5, 1.0)
        bend(little, 1.3, 1.5, 1.0)
        thumb(0.7, 0.5, 0.4, 0.3)
        break
      case 'press':
        // A pinch: the index pad on the nail, the thumb under the fingertip; the others tucked.
        bend(index, 0.35, 0.45, 0.2)
        bend(middle, 1.2, 1.4, 0.9)
        bend(ring, 1.3, 1.5, 1.0)
        bend(little, 1.3, 1.5, 1.0)
        thumb(0.2, 1.1, 0.3, 0.2)
        break
      case 'thumb':
        // The fingers curled out of the way; the thumb points down onto the nail.
        all(1.2, 1.4, 0.9)
        thumb(0.25, 1.2, 0.15, 0.1)
        break
      case 'back':
        all(0.1, 0.1, 0.05)
        thumb(0.5, 0.2, 0.1, 0.1)
        break
      case 'cup':
        // Round the forearm: fingers wrapping one side, thumb the other.
        all(0.75, 0.8, 0.45)
        thumb(0.9, 1.1, 0.3, 0.2)
        break
      case 'chart':
        // Fingers flat up the back of it near its edge, the thumb alongside.
        all(0.05, 0.05, 0.02)
        thumb(0.25, 0.15, 0.1, 0.1)
        this.tools.chart.obj.visible = true
        break
      case 'cotton':
      case 'neurotip':
      case 'doppler':
      case 'torch':
      case 'otoscope':
      case 'fork':
        // A pinch on the stick; the other fingers tucked.
        bend(index, 0.55, 0.6, 0.3)
        bend(middle, 0.9, 1.1, 0.6)
        bend(ring, 1.2, 1.4, 0.9)
        bend(little, 1.2, 1.4, 0.9)
        thumb(0.35, 0.75, 0.2, 0.15)
        this.tools[grip].obj.visible = true
        break
      default:
        all(0.05, 0.05, 0.02)
        thumb(0.5, 0.2, 0.1, 0.1)
    }
  }

  private contactPoint(contact: Contact): THREE.Vector3 {
    const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
    const [index, middle] = this.fingers
    switch (contact) {
      case 'thumb':
        return at(this.thumb.pad)
      case 'index':
        return at(index.pad)
      case 'palm':
        return at(this.palmFace)
      case 'back':
        return at(this.backFace)
      case 'tool':
        return (TOOL_GRIPS as string[]).includes(this.grip) ? at(this.tools[this.grip as ToolGrip].tip) : at(index.pad)
      default:
        // Between the index and middle pads.
        return at(index.pad).add(at(middle.pad)).multiplyScalar(0.5)
    }
  }

  /**
   * Put the hand so that `contact` sits `gap` metres out from `point` along the skin's outward `normal`, the fingers
   * running along `along`. The palm faces the skin, except for `back` (the backs of the fingers do).
   */
  place(point: THREE.Vector3, normal: THREE.Vector3, along: THREE.Vector3, contact: Contact, gap: number) {
    this.touching = contact
    const n = normal.clone().normalize()
    const z = along.clone().sub(n.clone().multiplyScalar(along.dot(n)))
    if (z.lengthSq() < 1e-6) z.set(1, 0, 0).sub(n.clone().multiplyScalar(n.x))
    z.normalize()
    // Palm (-Y) toward the skin; for the back of the hand, +Y toward the skin.
    const y = contact === 'back' ? n.clone().negate() : n.clone()
    const x = y.clone().cross(z).normalize()
    const zz = x.clone().cross(y).normalize()
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, zz))
    // A tool or a thumb points into the skin rather than lying along it.
    if (contact === 'tool') this.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.9))
    if (contact === 'thumb') this.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.5))
    this.group.position.set(0, 0, 0)
    this.group.updateMatrixWorld(true)
    const at = this.contactPoint(contact)
    this.group.position.copy(point).addScaledVector(n, gap).sub(at)
    this.group.visible = true
    this.group.updateMatrixWorld(true)
  }

  hide() {
    this.group.visible = false
  }

  /**
   * A tool in the hand pointed: its tip at `tip`, pointing `dir` (the torch's beam), and the forearm running back from
   * the hand as near to `arm` as the grip allows.
   */
  aim(tip: THREE.Vector3, dir: THREE.Vector3, arm: THREE.Vector3) {
    this.touching = 'tool'
    const t = this.tools[this.grip as ToolGrip]
    if (!t) return
    // The tool's axis and the forearm's, in the hand's own frame.
    const frame = (a: THREE.Vector3, b: THREE.Vector3) => {
      const e1 = a.clone().normalize()
      const e2 = b.clone().addScaledVector(e1, -b.dot(e1)).normalize()
      return new THREE.Matrix4().makeBasis(e1, e2, e1.clone().cross(e2))
    }
    const local = frame(new THREE.Vector3(0, 0, 1).applyEuler(t.obj.rotation), new THREE.Vector3(0, 0, -1))
    const world = frame(dir, arm)
    this.group.quaternion.setFromRotationMatrix(world.multiply(local.transpose()))
    this.group.position.set(0, 0, 0)
    this.group.updateMatrixWorld(true)
    const at = this.contactPoint('tool')
    this.group.position.copy(tip).sub(at)
    this.group.visible = true
    this.group.updateMatrixWorld(true)
  }

  /** Hold what is in the hand (the chart) with its centre at `at`, its face turned toward `faces`, the fingers `across`. */
  hold(at: THREE.Vector3, faces: THREE.Vector3, across: THREE.Vector3) {
    this.touching = 'tool'
    const y = faces.clone().normalize().negate()
    const z = across.clone().addScaledVector(y, -across.dot(y)).normalize()
    const x = y.clone().cross(z).normalize()
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
    this.group.position.set(0, 0, 0)
    this.group.updateMatrixWorld(true)
    const centre = this.contactPoint('tool')
    this.group.position.copy(at).sub(centre)
    this.group.visible = true
    this.group.updateMatrixWorld(true)
  }

  /** What touches, as last placed. */
  private touching: Contact = 'palm'
  /** Where the part that touches is now, in the world. */
  contactNow() {
    this.group.updateMatrixWorld(true)
    return this.contactPoint(this.touching)
  }

  /**
   * Balls that fill the hand, in the world (each a centre and how far it reaches): along each finger and the thumb, over
   * the palm and the back of the hand, the wrist. For keeping the hand out of what it holds.
   */
  probes(sleeve = false): { p: THREE.Vector3; r: number }[] {
    this.group.updateMatrixWorld(true)
    const out: { p: THREE.Vector3; r: number }[] = []
    for (const d of [...this.fingers, this.thumb])
      d.joints.forEach((j, i) => {
        for (const f of [0, 0.5, 1]) out.push({ p: new THREE.Vector3(0, 0, d.lens[i] * f).applyMatrix4(j.matrixWorld), r: d.r * (i === 2 ? 0.9 : 1) })
      })
    for (const x of [-0.034, 0, 0.034])
      for (const z of [0.012, 0.047, 0.082]) for (const y of [-0.006, 0.006]) out.push({ p: new THREE.Vector3(x, y, z).applyMatrix4(this.group.matrixWorld), r: 0.009 })
    out.push({ p: new THREE.Vector3(0, 0, -0.012).applyMatrix4(this.group.matrixWorld), r: 0.03 })
    // The coat sleeve, down the forearm.
    if (sleeve) for (const z of [-0.07, -0.15, -0.23, -0.31]) out.push({ p: new THREE.Vector3(0, 0, z).applyMatrix4(this.group.matrixWorld), r: 0.046 })
    return out
  }

  /** Move the whole hand by this much (to take it out of something it went into). */
  shift(by: THREE.Vector3) {
    this.group.position.add(by)
    this.group.updateMatrixWorld(true)
  }

  /** See-through (the X-ray view): what the hand presses on shows through it. Both hands share the materials. */
  ghost(on: boolean) {
    for (const m of [GLOVE, COAT]) {
      m.transparent = on
      m.opacity = on ? 0.3 : 1
      m.depthWrite = !on
      m.needsUpdate = true
    }
  }
}
