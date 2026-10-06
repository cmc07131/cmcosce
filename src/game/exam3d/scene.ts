import * as THREE from 'three'
import { castPatient, type AvatarId, type PatientKind } from '../body3d/cast'
import { DEG, aim, poseEyes, turn, type Credit, type Eyes, type Rig, type Side } from '../body3d/rig'
import { COUCH, buildCouch, buildRoom, createRenderer } from '../body3d/stage'
import { ExaminerHand, type Contact, type Grip } from './examiner'
import type { Anim } from './manoeuvres'
import { SITES, SITE_IDS, siteOf, type DigitRef, type JointRef } from './sites'

/**
 * The 3D examination: the patient on the couch (or sitting on its edge, standing, walking), posed from anatomical
 * joint angles so the same examination works on any model; what she does when asked; and where a tap lands on her.
 *
 * World as in body3d/stage: metres, Y up, the couch along +X with its head end at x = 0, the examiner's side at +Z.
 */

export type Posture = 'supine' | 'sitting' | 'edge' | 'standing' | 'walking' | 'heel-toe' | 'roll-R' | 'roll-L' | 'knees-up' | 'bent' | 'one-leg-R' | 'one-leg-L'
export type View = 'whole' | 'head' | 'chest' | 'abdomen' | 'hands' | 'legs' | 'feet' | 'back' | 'focus'

/** What is wrong with her that shows: for the motions she makes when asked or touched. */
export type Signs = {
  /** Intention tremor and ataxia on this side (finger–nose, heel–shin, rapid alternating movements). */
  ataxia?: Side
  gait?: 'antalgic-R' | 'antalgic-L' | 'ataxic' | 'normal'
  /** Lower motor neurone facial weakness on this side. */
  palsy?: Side
  /** Nystagmus with the fast phase to this side, worse looking that way. */
  nystagmus?: Side
  /** Eyes closed; no response to voice. */
  unconscious?: boolean
  /** What a painful stimulus brings out. */
  posturing?: 'decorticate' | 'decerebrate' | 'localises'
  /** Standing on this leg, the other side of the pelvis drops. */
  trendelenburg?: Side
  /** The pelvis is under a drape (intimate examinations). */
  drape?: boolean
  /** Anterior interosseous nerve palsy on this side: the OK sign is a flat pinch. */
  ain?: Side
  /** Bending this elbow up kinks the artery: the hand goes pale. */
  kinkOnFlex?: Side
  /** Bruises seen once the skin there is exposed (site ids). */
  bruise?: string[]
}

/** A hand shape: each finger's knuckle, middle and end joint flexion and its spread (toward the little finger); the
 * thumb's sweep across the palm and its two joints, and `tx` its swing out to the thumb side; `turn`: the forearm
 * turns the thumb side up; `ext`: the wrist bends back; `face`: what he turns toward you to show it (the ring
 * his thumb and index make, his palm, or the back of his hand). Degrees. */
type HandShape = { f: [number, number, number, number][]; t: [number, number, number]; tx?: number; turn?: 'up'; ext?: number; face?: 'ring' | 'palm' | 'back' }
const FIST: HandShape['f'] = [
  [85, 95, 60, 0],
  [85, 95, 60, 0],
  [85, 95, 60, 0],
  [85, 95, 60, 0],
]
/** Manoeuvres done with the examiner's hand. */
const HANDS_ON = new Set<string>(['pulse', 'doppler', 'crt', 'warmth', 'touch', 'pin', 'squeeze', 'stretch'])

export const HANDS: Record<string, HandShape> = {
  relaxed: { f: [[15, 20, 10, 0], [15, 22, 10, 0], [18, 24, 10, 0], [20, 25, 12, 0]], t: [10, 10, 10] },
  fist: { f: FIST, t: [35, 35, 30] },
  // Angles below were tuned by measuring the bones: the thumb straight up from the fist; the O closed tip to tip.
  'thumbs-up': { f: FIST, t: [-75, -5, -10], tx: -15, turn: 'up', ext: 35 },
  ok: { f: [[44, 43, 50, 0], [10, 10, 5, 2], [10, 10, 5, 4], [10, 10, 5, 8]], t: [40, 57, 40], tx: -46, face: 'ring' },
  // Anterior interosseous palsy: the index end joint and the thumb's stay straight (a little over), so the pads meet
  // flat, the tips overshoot, and the hole is half the size: a pinch, not an O.
  'ok-palsy': { f: [[65, 60, -10, 0], [10, 10, 5, 2], [10, 10, 5, 4], [10, 10, 5, 8]], t: [35, 42, -8], tx: -40, face: 'ring' },
  // Both straight; the middle finger swings over the back of the index to its thumb side, crossing at its middle joint.
  cross: { f: [[0, 2, 5, 45], [-25, -10, 5, -39], [75, 85, 55, 0], [75, 85, 55, 0]], t: [52, -10, 0], tx: 47, face: 'back' },
  // The thumb tip on the little fingertip.
  opposition: { f: [[15, 15, 5, 0], [15, 15, 5, 0], [25, 25, 10, 0], [47, 35, 28, 6]], t: [75, 23, 22], tx: 20, face: 'palm' },
  spread: { f: [[5, 5, 0, -16], [5, 5, 0, -5], [5, 5, 0, 7], [5, 5, 0, 18]], t: [-20, 0, 0] },
  extended: { f: [[-12, -4, 0, 0], [-12, -4, 0, 0], [-12, -4, 0, 0], [-12, -4, 0, 0]], t: [0, 0, 0] },
}

type Joints = Record<string, number>
/** A joint a drag moves: `key` is the angle; lying down, lifting the knee bends it with the hip (`kneeWithHip`). */
export type Limb = { joint: string; dof: string; key: string; kneeWithHip?: boolean }
type Place = { quat: THREE.Quaternion; pos: THREE.Vector3 }

const SIDES: Side[] = ['R', 'L']
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const smooth = (k: number) => k * k * (3 - 2 * k)

/** A body standing so: its up (head) and front (face) as world directions. */
function facing(up: THREE.Vector3, front: THREE.Vector3) {
  const y = up.clone().normalize()
  const z = front.clone().normalize()
  const x = y.clone().cross(z).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z.crossVectors(x, y)))
}

/** Resting joint angles for each posture (degrees): arms by the sides, hands in the lap when sitting. */
function rest(p: Posture): Joints {
  const j: Joints = {}
  const both = (k: string, val: number) => SIDES.forEach((s) => (j[`${k}-${s}`] = val))
  switch (p) {
    case 'supine':
    case 'roll-R':
    case 'roll-L':
      both('shoulderabd', 10)
      both('elbow', 10)
      if (p !== 'supine') {
        both('hipflex', 30)
        both('knee', 45)
      }
      break
    case 'knees-up':
      both('shoulderabd', 10)
      both('elbow', 10)
      both('hipflex', 55)
      both('knee', 105)
      both('hipabd', 28)
      break
    case 'sitting':
      both('hipflex', 90)
      both('shoulderflex', 25)
      both('elbow', 55)
      break
    case 'edge':
      both('hipflex', 90)
      both('knee', 88)
      both('shoulderflex', 18)
      both('shoulderabd', 8)
      both('elbow', 68)
      break
    case 'bent':
      j.trunk = 70
      both('shoulderflex', 60)
      both('elbow', 5)
      break
    case 'one-leg-R':
    case 'one-leg-L': {
      const lift = p === 'one-leg-R' ? 'L' : 'R'
      both('shoulderabd', 12)
      both('elbow', 10)
      j[`hipflex-${lift}`] = 35
      j[`knee-${lift}`] = 75
      break
    }
    default:
      both('shoulderabd', 6)
      both('elbow', 10)
  }
  return j
}

export class ExamScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.02, 30)
  private body = new THREE.Group()
  rig: Rig | null = null
  credit: Credit | null = null
  private bind = new Map<THREE.Object3D, THREE.Quaternion>()
  /** Landmarks pinned to the bones, by site id. */
  private anchors = new Map<string, THREE.Object3D>()
  private scale = 1
  /** Who the patient is: a woman has no scrotum to examine, a man no cervix. */
  private kind: PatientKind
  posture: Posture
  private from: { place: Place; joints: Joints } | null = null
  private moveT = 1
  /** Joints the examiner has moved by hand: they hold until she changes position. */
  held: Joints = {}
  /** What she is doing when asked: overrides joints and face for a while. */
  private motion: { id: string; t: number; dur: number } | null = null
  /** How long since a painful stimulus (for posturing). */
  private stimT = -1
  eyes: Eyes = { torsion: 0, vertical: 0, horizontal: 0, closed: 0, squint: 0, distress: 0 }
  signs: Signs
  view: View = 'whole'
  /** The landmark the camera closes in on in the `focus` view. */
  private focusSite: string | null = null
  private camPos = v(1.9, 1.7, 2.6)
  private camLook = v(0.9, 0.9, 0)
  private wantPos = this.camPos.clone()
  private wantLook = this.camLook.clone()
  private time = 0
  private frame = 0
  private disposed = false
  private finger: THREE.Mesh
  private drape: THREE.Mesh | null = null
  private marks: { mesh: THREE.Mesh; t: number }[] = []
  /** Each landmark's outward direction, in its bone's frame. */
  private normals = new Map<string, THREE.Vector3>()
  /** Hand shapes: which, and how far into it (0 relaxed … 1). */
  private hands: Record<Side, { name: string; w: number; want: number }> = { L: { name: 'relaxed', w: 0, want: 0 }, R: { name: 'relaxed', w: 0, want: 0 } }
  /** A manoeuvre being shown. */
  private act: { anim: Anim; site: string | null; side: Side; t: number; dur: number; lift0: number } | null = null
  private examiner: ExaminerHand
  private paleNow = { fingersL: 0, handL: 0, fingersR: 0, handR: 0 }
  private bruises: THREE.Mesh[] = []
  /** Seconds a capillary refill takes to come back, by side. */
  refill: Record<Side, number> = { L: 1.2, R: 1.2 }
  ready: Promise<void>
  onFrame: ((dt: number) => void) | null = null

  constructor(
    private host: HTMLElement,
    kind: PatientKind,
    look: AvatarId,
    start: Posture,
    signs: Signs,
  ) {
    this.posture = start
    this.signs = signs
    this.kind = kind
    this.renderer = createRenderer(host, this.scene)
    buildRoom(this.scene)
    buildCouch(this.scene)
    this.scene.add(this.body)
    // The examiner's finger (or pen torch) for eye movements and fields.
    this.finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.05, 6, 12), new THREE.MeshStandardMaterial({ color: '#e8b89a', roughness: 0.6 }))
    this.finger.visible = false
    this.scene.add(this.finger)
    this.examiner = new ExaminerHand(this.scene)
    this.ready = castPatient(kind, look).then(({ rig, credit }) => {
      if (this.disposed) return rig.dispose()
      this.rig = rig
      this.credit = credit
      this.scale = rig.height / 1.72
      this.pinSites(rig)
      this.bind = new Map(rig.bones.map((b) => [b, b.quaternion.clone()]))
      this.body.add(rig.root)
      if (signs.drape) this.addDrape(rig)
      for (const id of signs.bruise ?? []) this.addBruise(id)
      this.applyPose()
      this.body.updateMatrixWorld(true)
      rig.settle()
      this.aimCamera()
      this.camPos.copy(this.wantPos)
      this.camLook.copy(this.wantLook)
    })
    this.resize()
    this.loop()
  }

  /* ------------------------------------------------------------------ landmarks */

  private jointOf(rig: Rig, j: JointRef, side: Side): THREE.Object3D | undefined {
    const digit = j.match(/^(thumb|index|middle|ring|little)(1|2|3|Tip)$/)
    if (digit) {
      const bones = rig.digits[side][['thumb', 'index', 'middle', 'ring', 'little'].indexOf(digit[1])]
      return bones?.[digit[2] === 'Tip' ? 2 : Number(digit[2]) - 1] ?? rig.finger[side]
    }
    switch (j) {
      case 'eyes':
      case 'head':
        return rig.head
      case 'eye':
        return rig.eye[side]
      case 'hips':
      case 'spine':
      case 'chest':
      case 'neck':
        return rig[j]
      case 'ring':
        return rig.ring[side] ?? rig.finger[side]
      case 'little':
        return rig.digits[side][4]?.[0] ?? rig.ring[side] ?? rig.finger[side]
      case 'finger':
      case 'thumb':
      case 'toe':
      case 'clavicle':
        return rig[j][side]
      default:
        return rig[j as Exclude<JointRef, DigitRef | 'eyes' | 'eye' | 'head' | 'hips' | 'spine' | 'chest' | 'neck' | 'ring' | 'little'>][side]
    }
  }

  /** Where a joint reference is, in the bind pose (the rig not yet parented: its own frame). */
  private pointOf(rig: Rig, j: JointRef, side: Side) {
    if (j === 'eyes') return rig.eye.L.getWorldPosition(v(0, 0, 0)).add(rig.eye.R.getWorldPosition(v(0, 0, 0))).multiplyScalar(0.5)
    // A fingertip: past the end bone by most of its length.
    const tip = j.match(/^(thumb|index|middle|ring|little)Tip$/)
    if (tip) {
      const bones = rig.digits[side][['thumb', 'index', 'middle', 'ring', 'little'].indexOf(tip[1])]
      if (bones?.length === 3) {
        const end = bones[2].getWorldPosition(v(0, 0, 0))
        return end.clone().add(end.clone().sub(bones[1].getWorldPosition(v(0, 0, 0))).multiplyScalar(0.85))
      }
    }
    return this.jointOf(rig, j, side)?.getWorldPosition(v(0, 0, 0)) ?? null
  }

  /** Find each landmark on this body's skin, in the bind pose, and pin it to its bone. */
  private pinSites(rig: Rig) {
    rig.root.updateMatrixWorld(true)
    for (const m of rig.meshes) if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).skeleton.update()
    const k = this.scale
    const female = this.kind === 'woman'
    for (const id of SITE_IDS) {
      const s = siteOf(id)
      if (!s) continue
      if (female ? /^(scrotum|testis)/.test(id) : /^(vulva|cervix|adnexa)/.test(id)) continue
      const { def } = s
      const side: Side = s.side ?? 'R'
      const mirror = s.side === 'L' ? -1 : 1
      const bone = this.jointOf(rig, def.j, side)
      const at = this.pointOf(rig, def.j, side)
      if (!bone || !at) continue
      if (def.to) {
        const to = this.pointOf(rig, def.to, side)
        if (to) at.lerp(to, def.t ?? 0.5)
      }
      const [ox, oy, oz] = def.off ?? [0, 0, 0]
      at.add(v(ox * mirror * k, oy * k, oz * k))
      const dir = v(def.dir[0] * mirror, def.dir[1], def.dir[2]).normalize()
      // Of the skin the ray crosses, the surface nearest the point: not the other leg, or the head, on the way in.
      const hits = new THREE.Raycaster(at.clone().addScaledVector(dir, 0.35 * k), dir.clone().negate(), 0, 0.6 * k)
        .intersectObjects(rig.meshes, false)
        .filter((h) => {
          const mat = (h.object as THREE.Mesh).material
          return !(Array.isArray(mat) ? mat[h.face?.materialIndex ?? 0] : mat)?.transparent
        })
      // Prefer the surface on the side the spot faces (a fingertip's pad, not its nail).
      const facing = hits.filter((h) => h.point.clone().sub(at).dot(dir) > -0.002 * k)
      const hit = (facing.length ? facing : hits).sort((a, b) => a.point.distanceTo(at) - b.point.distanceTo(at))[0]
      const point = hit ? hit.point : at
      const anchor = new THREE.Object3D()
      anchor.name = id
      bone.add(anchor)
      anchor.position.copy(bone.worldToLocal(point.clone()))
      this.anchors.set(id, anchor)
      this.normals.set(id, (hit?.face?.normal ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : dir.clone()).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize())
    }
  }

  /** A small privacy drape over the genitals, pinned to the pelvis: what you work under in an intimate examination. */
  private addDrape(rig: Rig) {
    const k = this.scale
    const geo = new THREE.BoxGeometry(0.3 * k, 0.24 * k, 0.012 * k, 10, 8, 1)
    // A sheet that sags over the body: the middle nearer the skin than the edges.
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (0.15 * k)
      const y = pos.getY(i) / (0.12 * k)
      pos.setZ(i, pos.getZ(i) - 0.035 * k * (1 - x * x) * (1 - 0.4 * y * y))
    }
    geo.computeVertexNormals()
    const drape = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.95, side: THREE.DoubleSide }))
    drape.castShadow = true
    drape.receiveShadow = true
    rig.hips.add(drape)
    // In front of the pubis and the top of the thighs, tilted to face forward and down, in the rig's frame (and at its
    // true size: a bone may be scaled).
    const hipW = rig.hips.getWorldPosition(v(0, 0, 0))
    drape.position.copy(rig.hips.worldToLocal(hipW.clone().add(v(0, -0.11 * k, 0.11 * k))))
    drape.quaternion.copy(rig.hips.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), 35 * DEG)))
    drape.scale.setScalar(1 / rig.hips.getWorldScale(v(0, 0, 0)).x)
    this.drape = drape
  }

  /* ------------------------------------------------------------------ posture and asked-for movements */

  /** Change position (animated over a second). The joints you moved go back to rest. */
  setPosture(p: Posture) {
    if (p === this.posture && this.moveT >= 1) return
    this.from = { place: this.placeFor(this.posture, this.time), joints: this.jointsNow() }
    this.posture = p
    this.moveT = 0
    this.held = {}
  }

  /** Something she was asked to do, played for `dur` seconds. */
  play(id: string, dur: number) {
    this.motion = { id, t: 0, dur }
  }

  /** Uncover parts of the body (0 covered … 1 bare): trunk, arms, legs and feet. */
  expose(parts: { trunk: number; arms: number; legs: number }) {
    this.rig?.expose(parts)
  }

  /** Show a manoeuvre being done; returns how long it takes (seconds). */
  perform(anim: Anim, site: string | null, side: Side): number {
    const dur: Record<string, number> = { inspect: 2.2, look: 1.6, warmth: 2.6, crt: 3.6, pulse: 3.2, doppler: 3.2, touch: 2.4, pin: 2.4, squeeze: 2.8, stretch: 3.2, 'elbow-flex': 3.4, 'elbow-straighten': 2.6 }
    const d = anim.startsWith('pose:') ? 3.4 : (dur[anim] ?? 2)
    this.act = { anim, site, side, t: 0, dur: d, lift0: this.held[`shoulderflex-${side}`] ?? this.angle(`shoulderflex-${side}`) }
    // Looking, or laying hands on the arm: the sleeves rolled up.
    if (anim === 'inspect' || HANDS_ON.has(anim)) {
      this.rig?.expose({ trunk: 0, arms: 1, legs: 0 })
      for (const b of this.bruises) b.visible = true
    }
    if (anim.startsWith('pose:')) {
      const name = anim.slice(5)
      this.hands[side] = { name: name === 'ok' && this.signs.ain === side ? 'ok-palsy' : name, w: this.hands[side].name === name ? this.hands[side].w : 0, want: 1 }
    }
    if (anim === 'stretch') this.hands[side] = { name: 'extended', w: 0, want: 1 }
    return d
  }

  get acting() {
    return this.act !== null
  }

  private addBruise(id: string) {
    const a = this.anchors.get(id)
    const n = this.normals.get(id)
    if (!a || !n) return
    const tex = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')
      if (g) {
        const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30)
        grd.addColorStop(0, 'rgba(92,40,96,0.85)')
        grd.addColorStop(0.55, 'rgba(120,60,110,0.55)')
        grd.addColorStop(1, 'rgba(150,110,90,0)')
        g.fillStyle = grd
        g.fillRect(0, 0, 64, 64)
      }
      return new THREE.CanvasTexture(c)
    })()
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.022 * this.scale, 20), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }))
    a.add(m)
    m.scale.setScalar(1 / a.getWorldScale(v(0, 0, 0)).x)
    m.position.copy(n.clone().multiplyScalar(0.002 / a.getWorldScale(v(0, 0, 0)).x))
    m.quaternion.setFromUnitVectors(v(0, 0, 1), n)
    m.visible = false
    this.bruises.push(m)
  }

  /** The shown manoeuvre, frame by frame: the examiner's hand in and out, the skin's colour, the joint that moves. */
  private updateAct(dt: number) {
    const R = this.rig
    const a = this.act
    // Hand shapes ease in and out.
    for (const side of SIDES) {
      const h = this.hands[side]
      h.w += Math.sign(h.want - h.w) * Math.min(Math.abs(h.want - h.w), dt * 3.5)
    }
    let pale = { fingersL: 0, handL: 0, fingersR: 0, handR: 0 }
    if (R && a) {
      a.t += dt
      const k = a.t / a.dur
      const into = Math.min(1, a.t / 0.45)
      const out = Math.min(1, Math.max(0, (a.dur - a.t) / 0.45))
      const gap = 0.14 * (1 - Math.min(into, out))
      // Hands on: the examiner's hand, placed once the body is posed (see `placeExaminer`); his arm is lifted off his lap
      // and the hand turned so the spot faces you.
      this.touching = null
      const show = (grip: Grip, contact: Contact, extra = 0, stroke = 0) => {
        this.touching = { grip, contact, gap: gap + extra, stroke }
      }
      const env = smooth(Math.min(into, out))
      if (HANDS_ON.has(a.anim) && a.site) {
        this.held[`shoulderflex-${a.side}`] = a.lift0 + (40 - a.lift0) * env
        this.present = { side: a.side, site: a.site, w: env }
      }
      switch (a.anim) {
        case 'pulse':
          show('two-fingers', 'fingertips')
          break
        case 'doppler':
          show('doppler', 'tool')
          break
        case 'crt': {
          show('press', 'index', a.t > a.dur - 1.6 ? 0.03 : 0)
          // Pressed white for the press, then the colour comes back over the refill time.
          const pressEnd = a.dur - 1.6
          const blanch = a.t < 0.45 ? 0 : a.t < pressEnd ? Math.min(1, (a.t - 0.45) / 0.5) : Math.max(0, 1 - (a.t - pressEnd) / this.refill[a.side])
          if (a.side === 'L') pale.fingersL = blanch
          else pale.fingersR = blanch
          break
        }
        case 'warmth':
          show('back', 'back', 0, 0.03 * Math.sin(k * Math.PI * 2))
          break
        case 'touch':
          show('cotton', 'tool', 0.012 * Math.max(0, Math.sin(k * Math.PI * 4)))
          break
        case 'pin':
          show('neurotip', 'tool', 0.012 * Math.max(0, Math.sin(k * Math.PI * 4)))
          break
        case 'squeeze':
          show('cup', 'palm', -0.004 * Math.max(0, Math.sin(k * Math.PI * 4)))
          break
        case 'stretch':
          show('flat', 'palm')
          break
        case 'elbow-flex': {
          const up = k < 0.45 ? smooth(k / 0.45) : k < 0.7 ? 1 : 1 - smooth((k - 0.7) / 0.3)
          this.held[`elbow-${a.side}`] = this.restElbow[a.side] + (135 - this.restElbow[a.side]) * up
          this.eyes.distress = up
          break
        }
        case 'elbow-straighten': {
          const down = Math.sin(Math.PI * Math.min(1, k))
          this.held[`elbow-${a.side}`] = this.restElbow[a.side] - (this.restElbow[a.side] - 35) * down * 0.8
          this.eyes.distress = down
          this.eyes.squint = down * 0.6
          break
        }
        default:
          // Asked to do something with the hand, he lifts it up in front to show you.
          if (a.anim.startsWith('pose:')) this.held[`shoulderflex-${a.side}`] = a.lift0 + (55 - a.lift0) * env
      }
      if (a.t >= a.dur) {
        this.touching = null
        this.present = null
        if (a.anim.startsWith('pose:') || a.anim === 'stretch') this.hands[a.side].want = 0
        if (a.anim.startsWith('pose:') || HANDS_ON.has(a.anim)) this.held[`shoulderflex-${a.side}`] = a.lift0
        if (a.anim.startsWith('elbow')) {
          this.held[`elbow-${a.side}`] = this.restElbow[a.side]
          this.eyes.distress = 0
          this.eyes.squint = 0
        }
        this.act = null
      }
    }
    // A bent elbow that kinks the artery: the hand goes pale while it is bent.
    const kink = this.signs.kinkOnFlex
    if (kink) {
      const bend = this.angle(`elbow-${kink}`)
      const white = Math.max(0, Math.min(1, (bend - 100) / 25))
      if (kink === 'L') pale.handL = Math.max(pale.handL, white)
      else pale.handR = Math.max(pale.handR, white)
    }
    pale = {
      fingersL: lerp(this.paleNow.fingersL, pale.fingersL, Math.min(1, dt * 8)),
      handL: lerp(this.paleNow.handL, pale.handL, Math.min(1, dt * 3)),
      fingersR: lerp(this.paleNow.fingersR, pale.fingersR, Math.min(1, dt * 8)),
      handR: lerp(this.paleNow.handR, pale.handR, Math.min(1, dt * 3)),
    }
    this.paleNow = pale
    R?.pale(pale)
  }

  /** The examiner's hand this frame: its grip, what touches, how far off the skin; a stroke along the limb (warmth). */
  private touching: { grip: Grip; contact: Contact; gap: number; stroke: number } | null = null
  /** The spot being examined, turned toward you (`w`: how far, easing in and out). */
  private present: { side: Side; site: string; w: number } | null = null
  /** Where the examiner's hand touches, and the way the skin faces there: the camera looks along it. */
  private contact: { at: THREE.Vector3; n: THREE.Vector3; along: THREE.Vector3; profile: boolean } | null = null

  /** A spot's position and outward direction now. */
  private spotNow(site: string) {
    const at = this.siteWorld(site)
    const n = this.normals.get(site)
    const anchor = this.anchors.get(site)
    if (!at || !n || !anchor?.parent) return null
    return { at, n: n.clone().applyQuaternion(anchor.parent.getWorldQuaternion(new THREE.Quaternion())).normalize() }
  }

  /** The examiner's hand, on the posed body. */
  private placeExaminer() {
    const R = this.rig
    const a = this.act
    const t = this.touching
    this.contact = null
    const spot0 = a?.site ? this.spotNow(a.site) : null
    if (!R || !a || !t || !spot0) {
      this.examiner.hide()
      return
    }
    const elbow = R.forearm[a.side].getWorldPosition(v(0, 0, 0))
    const wrist = R.hand[a.side].getWorldPosition(v(0, 0, 0))
    const axis = wrist.clone().sub(elbow).normalize()
    let spot = spot0
    let along = axis.clone()
    if (a.anim === 'squeeze') {
      // The forearm held from above: the palm on top, the fingers wrapping round it.
      const mid = elbow.clone().lerp(wrist, 0.55)
      const up = v(0, 1, 0).sub(axis.clone().multiplyScalar(axis.y)).normalize()
      const r = Math.max(0.015, spot0.at.clone().sub(elbow).cross(axis).length())
      spot = { at: mid.addScaledVector(up, r), n: up }
      along = axis.clone().cross(up).multiplyScalar(a.side === 'L' ? 1 : -1)
    }
    // Stretching the fingers back: the hand laid along them from the palm side, not on the very tips.
    const back = a.anim === 'stretch' ? -0.03 * this.scale : 0
    const at = spot.at.clone().addScaledVector(axis, t.stroke + back)
    this.examiner.setGrip(t.grip)
    this.examiner.place(at, spot.n, along, t.contact, t.gap)
    this.contact = { at: spot.at, n: spot.n, along, profile: a.anim === 'stretch' }
  }

  /** Turn the hand about the forearm (at most a quarter turn) so the spot being examined faces you. */
  private presentSpot(R: Rig) {
    const p = this.present
    if (!p || p.w <= 0) return
    // Only spots on the hand turn with it.
    let o: THREE.Object3D | null = this.anchors.get(p.site)?.parent ?? null
    while (o && o !== R.hand[p.side]) o = o.parent
    if (!o) return
    const spot = this.spotNow(p.site)
    if (!spot) return
    const axis = R.hand[p.side].getWorldPosition(v(0, 0, 0)).sub(R.forearm[p.side].getWorldPosition(v(0, 0, 0))).normalize()
    const outward = v(p.side === 'L' ? 1 : -1, 0, 0).applyQuaternion(this.body.quaternion)
    const forward = v(0, 0, 1).applyQuaternion(this.body.quaternion)
    const want = forward.multiplyScalar(0.7).add(v(0, 0.8, 0)).add(outward.multiplyScalar(0.3))
    const flat = (d: THREE.Vector3) => d.sub(axis.clone().multiplyScalar(d.dot(axis)))
    const a = flat(spot.n.clone())
    const b = flat(want)
    if (a.lengthSq() < 1e-6 || b.lengthSq() < 1e-6) return
    a.normalize()
    b.normalize()
    const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Math.atan2(a.clone().cross(b).dot(axis), a.dot(b))))
    turn(R.hand[p.side], new THREE.Quaternion().setFromAxisAngle(axis, ang * p.w))
  }

  /** A hand shape being shown to you: where it is (see `HandShape.face`). */
  private handLook: Record<Side, { at: THREE.Vector3; n: THREE.Vector3 } | null> = { L: null, R: null }

  /** Where the elbows rest (degrees), for putting them back after a manoeuvre. */
  restElbow: Record<Side, number> = { L: 70, R: 70 }

  /** Bend each finger of a hand into its shape for this frame. */
  private poseFingers(R: Rig, side: Side) {
    const h = this.hands[side]
    const relaxed = HANDS.relaxed
    const shape = HANDS[h.name] ?? relaxed
    const w = smooth(Math.max(0, Math.min(1, h.w)))
    const digits = R.digits[side]
    if (!digits.length) return
    // Bind: arms out, palms down, thumbs forward. `frame` gives a direction in the hand as it is now.
    const frame = () => {
      const rel = R.hand[side].getWorldQuaternion(new THREE.Quaternion()).multiply(this.body.quaternion.clone().multiply(R.handBind[side]).invert())
      return (x: number, y: number, z: number) => v(x, y, z).applyQuaternion(this.body.quaternion).applyQuaternion(rel).normalize()
    }
    let world = frame()
    const out = side === 'L' ? 1 : -1
    // The forearm turns so the thumb side is up (a thumbs up), then the wrist bends back.
    if (shape.turn) {
      const a = world(out, 0, 0)
      const flat = (d: THREE.Vector3) => d.sub(a.clone().multiplyScalar(d.dot(a)))
      const r = flat(world(0, 0, 1))
      const u = flat(v(0, 1, 0))
      if (r.lengthSq() > 1e-4 && u.lengthSq() > 1e-4) {
        r.normalize()
        u.normalize()
        turn(R.hand[side], new THREE.Quaternion().setFromAxisAngle(a, Math.atan2(r.clone().cross(u).dot(a), r.dot(u)) * w))
        world = frame()
      }
    }
    if (shape.ext) {
      const a = world(out, 0, 0)
      turn(R.hand[side], new THREE.Quaternion().setFromAxisAngle(world(0, -1, 0).cross(a).normalize(), shape.ext * DEG * w))
      world = frame()
    }
    const palm = world(0, -1, 0)
    const along = world(side === 'L' ? 1 : -1, 0, 0)
    const ulnar = world(0, 0, -1)
    const radial = world(0, 0, 1)
    const turnAbout = (bone: THREE.Object3D, axis: THREE.Vector3, deg: number) => {
      if (Math.abs(deg) > 0.01) turn(bone, new THREE.Quaternion().setFromAxisAngle(axis, deg * DEG))
    }
    for (let d = 1; d < 5; d++) {
      const bones = digits[d]
      if (!bones?.length) continue
      const want = shape.f[d - 1]
      const base = relaxed.f[d - 1]
      const ang = want.map((x, i) => lerp(base[i], x, w))
      turnAbout(bones[0], along.clone().cross(ulnar).normalize(), ang[3])
      bones.forEach((b, i) => turnAbout(b, along.clone().cross(palm).normalize(), ang[i]))
    }
    const thumb = digits[0]
    if (thumb?.length) {
      const t = relaxed.t.map((x, i) => lerp(x, shape.t[i], w))
      turnAbout(thumb[0], radial.clone().cross(palm).normalize(), t[0])
      // Swung out to the thumb side, in the plane of the palm.
      turnAbout(thumb[0], along.clone().cross(radial).normalize(), (shape.tx ?? 0) * w)
      thumb.slice(1).forEach((b, i) => {
        const child = thumb[i + 2]
        const dir = child ? child.getWorldPosition(v(0, 0, 0)).sub(b.getWorldPosition(v(0, 0, 0))).normalize() : along
        turnAbout(b, dir.clone().cross(palm).normalize(), t[i + 1])
      })
    }
    // Showing you: he turns the hand about the forearm (never more than a quarter turn) so the shape faces out to his
    // side (the back of the hand: up), and the camera then looks square at it.
    const pos = (o: THREE.Object3D) => o.getWorldPosition(v(0, 0, 0))
    this.handLook[side] = null
    if (!shape.face || w < 0.05 || !thumb?.length || !digits[1]?.length) return
    let n: THREE.Vector3
    if (shape.face !== 'ring') {
      // The plane of the hand, from its bones: across the knuckles and from the wrist to the middle knuckle.
      const across = pos(digits[1][0]).sub(pos(digits[4]?.[0] ?? digits[3][0]))
      const hand = v(0, 0, 0).crossVectors(pos(digits[2][0]).sub(pos(R.hand[side])), across).normalize()
      if (hand.dot(palm) < 0) hand.negate()
      n = shape.face === 'palm' ? hand : hand.negate()
    } else {
      // The ring: thumb and index from their middle bones to their tips, as a polygon; its normal.
      const tip = (b: THREE.Object3D[]) => pos(b[2]).add(v(1, 0, 0).applyQuaternion(b[2].getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(pos(b[2]).distanceTo(pos(b[1])) * 0.8))
      const ring = [pos(thumb[1]), pos(thumb[2]), tip(thumb), tip(digits[1]), pos(digits[1][2]), pos(digits[1][1])]
      const c = ring.reduce((a, p) => a.add(p), v(0, 0, 0)).multiplyScalar(1 / ring.length)
      n = v(0, 0, 0)
      ring.forEach((p, i) => n.add(p.clone().sub(c).cross(ring[(i + 1) % ring.length].clone().sub(c))))
    }
    const axis = pos(R.hand[side]).sub(pos(R.forearm[side])).normalize()
    const flat = (d: THREE.Vector3) => d.sub(axis.clone().multiplyScalar(d.dot(axis)))
    const a = flat(n.clone())
    const outward = v(side === 'L' ? 1 : -1, 0, 0).applyQuaternion(this.body.quaternion)
    const forward = v(0, 0, 1).applyQuaternion(this.body.quaternion)
    const want = shape.face === 'back' ? outward.multiplyScalar(0.4).add(forward.multiplyScalar(0.3)).add(v(0, 1, 0)) : outward.add(forward.multiplyScalar(0.35)).add(v(0, 0.3, 0))
    const b = flat(want.clone())
    if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return
    a.normalize()
    b.normalize()
    let ang = Math.atan2(a.clone().cross(b).dot(axis), a.dot(b))
    // A ring looks the same from either side: take the nearer.
    if (shape.face === 'ring' && Math.abs(ang) > Math.PI / 2) ang -= Math.sign(ang) * Math.PI
    ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ang))
    turn(R.hand[side], new THREE.Quaternion().setFromAxisAngle(axis, ang * w))
    // What the camera looks along: the shape's own facing (a ring, toward the side it was turned to).
    n.normalize().applyAxisAngle(axis, ang * w)
    if (n.dot(want) < 0) n.negate()
    this.handLook[side] = { at: pos(R.hand[side]).lerp(pos(digits[2][0]), 1.2), n }
  }

  /** A painful stimulus: she responds as her signs say. */
  stimulus() {
    this.stimT = 0
  }

  get busy() {
    return this.motion?.id ?? null
  }

  private placeFor(p: Posture, t: number): Place {
    const R = this.rig
    const H = R?.height ?? 1.72
    const hipAbove = R?.hipAbove ?? 0.11
    const leg = R?.legLength ?? 0.9
    const lying = v(0.12 + 0.44 * H, COUCH.top + hipAbove, 0)
    switch (p) {
      case 'supine':
      case 'knees-up':
        return { quat: facing(v(-1, 0, 0), v(0, 1, 0)), pos: lying }
      case 'roll-R':
        return { quat: facing(v(-1, 0, 0), v(0, Math.cos(70 * DEG), Math.sin(70 * DEG))), pos: lying.clone().add(v(0, 0.06, -0.05)) }
      case 'roll-L':
        return { quat: facing(v(-1, 0, 0), v(0, Math.cos(70 * DEG), -Math.sin(70 * DEG))), pos: lying.clone().add(v(0, 0.06, 0.05)) }
      case 'sitting':
        return { quat: facing(v(0, 1, 0), v(1, 0, 0)), pos: v(0.4, COUCH.top + hipAbove * 0.9, 0) }
      case 'edge':
        return { quat: facing(v(0, 1, 0), v(0, 0, 1)), pos: v(1.0, COUCH.top + hipAbove * 0.85, COUCH.width / 2 - 0.08 * (H / 1.72)) }
      case 'walking':
      case 'heel-toe': {
        // Up and down the room in front of the couch, turning at each end.
        const lap = 7
        const u = (t % lap) / lap
        const out = u < 0.5
        const k = out ? u * 2 : (1 - u) * 2
        const x = lerp(0.35, 2.05, smooth(Math.min(1, Math.max(0, (k - 0.05) / 0.9))))
        const bob = Math.abs(Math.sin(t * Math.PI * 1.8)) * 0.015 * (H / 1.72)
        return { quat: facing(v(0, 1, 0), v(out ? 1 : -1, 0, 0.0001)), pos: v(x, leg - bob, 1.15) }
      }
      default:
        return { quat: facing(v(0, 1, 0), v(0, 0, 1)), pos: v(1.15, leg, 1.0) }
    }
  }

  private jointsNow(): Joints {
    const target = { ...rest(this.posture), ...this.held }
    if (!this.from || this.moveT >= 1) return target
    const k = smooth(this.moveT)
    const out: Joints = {}
    for (const key of new Set([...Object.keys(target), ...Object.keys(this.from.joints)])) out[key] = lerp(this.from.joints[key] ?? 0, target[key] ?? 0, k)
    return out
  }

  /** Joints this instant: rest, what you moved, what she is doing, how she walks. */
  private jointsAt(): Joints {
    const j = this.jointsNow()
    const t = this.time
    const S = this.signs
    if (this.posture === 'walking' || this.posture === 'heel-toe') {
      const w = t * Math.PI * 1.8
      for (const s of SIDES) {
        const phase = s === 'R' ? 0 : Math.PI
        const sore = S.gait === `antalgic-${s}`
        const stride = this.posture === 'heel-toe' ? 8 : sore ? 14 : 22
        j[`hipflex-${s}`] = stride * Math.sin(w + phase)
        j[`knee-${s}`] = Math.max(0, 40 * Math.sin(w + phase + 1.2)) * (sore ? 0.5 : 1) + 5
        j[`shoulderflex-${s}`] = -14 * Math.sin(w + phase)
        if (S.gait === 'ataxic') j[`hipabd-${s}`] = 10
      }
    }
    const m = this.motion
    if (m) {
      const k = m.t / m.dur
      const side = (m.id.match(/-(R|L)$/)?.[1] ?? 'R') as Side
      const env = Math.min(1, m.t / 0.6, (m.dur - m.t) / 0.6)
      const both = (key: string, val: number, e = env) => SIDES.forEach((s) => (j[`${key}-${s}`] = lerp(j[`${key}-${s}`] ?? 0, val, e)))
      const one = (key: string, val: number, e = env) => (j[`${key}-${side}`] = lerp(j[`${key}-${side}`] ?? 0, val, e))
      const shaky = S.ataxia === side
      switch (m.id.replace(/-(R|L)$/, '')) {
        case 'arms-out':
          both('shoulderflex', 90)
          both('elbow', 0)
          both('shoulderabd', 0)
          break
        case 'hands-out':
          both('shoulderflex', 90)
          both('elbow', 0)
          both('shoulderabd', 0)
          both('wrist', 60)
          break
        case 'finger-nose': {
          // Out to your finger, back to her nose; a tremor that grows as she nears the target if that side is ataxic.
          const cyc = (m.t / 1.6) % 1
          const reach = cyc < 0.5 ? smooth(cyc * 2) : smooth((1 - cyc) * 2)
          const near = Math.abs(reach - 0.5) * 2
          const tremor = shaky ? 9 * near * near * Math.sin(m.t * 2 * Math.PI * 5) : 0
          one('shoulderflex', lerp(55, 85, reach) + tremor)
          one('shoulderabd', lerp(18, 4, reach))
          one('elbow', lerp(140, 8, reach) + tremor * 0.6)
          break
        }
        case 'rapid-alternating':
          both('shoulderflex', 30)
          both('elbow', 80)
          break
        case 'heel-shin': {
          const slide = smooth(Math.min(1, m.t / (m.dur - 0.8)))
          const wobble = shaky ? 6 * Math.sin(m.t * 2 * Math.PI * 2.3) : 0
          one('hipflex', lerp(45, 15, slide) + wobble)
          one('knee', lerp(100, 25, slide))
          one('hipabd', -8 + wobble * 0.5)
          break
        }
        case 'raise-arm':
          one('shoulderabd', 170 * Math.sin(Math.PI * Math.min(1, k * 1.05)))
          break
        case 'lift-leg':
          one('hipflex', 70 * Math.sin(Math.PI * Math.min(1, k * 1.05)))
          one('knee', 0)
          break
        case 'bend-knee':
          one('knee', 120 * Math.sin(Math.PI * Math.min(1, k * 1.05)))
          one('hipflex', (j[`hipflex-${side}`] ?? 0) + 60 * Math.sin(Math.PI * Math.min(1, k * 1.05)))
          break
        case 'push-out':
        case 'empty-can':
          one('shoulderabd', m.id.startsWith('empty') ? 80 : 5)
          one('shoulderflex', m.id.startsWith('empty') ? 30 : 0)
          one('elbow', m.id.startsWith('empty') ? 0 : 90)
          break
        case 'wall-push':
          both('shoulderflex', 90)
          both('elbow', 20)
          break
        case 'shrug':
          j.shrug = 12 * env
          break
      }
    }
    // A hand held up to show you a sign is straight at the wrist.
    for (const s of SIDES) {
      const h = this.hands[s]
      if (HANDS[h.name]?.face) j[`wrist-${s}`] = lerp(j[`wrist-${s}`] ?? 0, 0, smooth(Math.max(0, Math.min(1, h.w))))
    }
    // A painful stimulus, unconscious: the arms flex across the chest, or extend and turn in; the legs extend.
    if (this.stimT >= 0 && S.posturing && S.posturing !== 'localises') {
      const e = Math.min(1, this.stimT / 0.8, Math.max(0, (5 - this.stimT) / 0.8))
      for (const s of SIDES) {
        if (S.posturing === 'decorticate') {
          j[`shoulderflex-${s}`] = lerp(j[`shoulderflex-${s}`] ?? 0, 35, e)
          j[`shoulderabd-${s}`] = lerp(j[`shoulderabd-${s}`] ?? 0, -12, e)
          j[`elbow-${s}`] = lerp(j[`elbow-${s}`] ?? 0, 115, e)
          j[`wrist-${s}`] = lerp(j[`wrist-${s}`] ?? 0, -60, e)
        } else {
          j[`shoulderabd-${s}`] = lerp(j[`shoulderabd-${s}`] ?? 0, 2, e)
          j[`elbow-${s}`] = lerp(j[`elbow-${s}`] ?? 0, 0, e)
          j[`shoulderrot-${s}`] = lerp(j[`shoulderrot-${s}`] ?? 0, -60, e)
          j[`wrist-${s}`] = lerp(j[`wrist-${s}`] ?? 0, -55, e)
        }
        j[`ankle-${s}`] = lerp(j[`ankle-${s}`] ?? 0, 35, e)
      }
      if (S.posturing === 'decerebrate') j.neckpitch = lerp(j.neckpitch ?? 0, 18, e)
    }
    return j
  }

  /** The face this instant: asked-for movements (weaker on a palsied side), eyes following your finger. */
  private faceAt(): Eyes {
    const e: Eyes = { ...this.eyes, brows: { R: 0, L: 0 }, shut: { R: 0, L: 0 }, smile: { R: 0, L: 0 }, cheeks: 0, mouth: 0 }
    const S = this.signs
    if (S.unconscious && this.stimT < 0) e.closed = 1
    if (S.unconscious && this.stimT >= 0) e.closed = this.stimT < 2.5 ? 0.35 : 1
    const m = this.motion
    this.finger.visible = false
    if (!m) return e
    const env = Math.min(1, m.t / 0.4, (m.dur - m.t) / 0.4)
    const weak = (s: Side) => (S.palsy === s ? 0.08 : 1)
    const per = (val: number) => ({ R: val * weak('R'), L: val * weak('L') })
    switch (m.id) {
      case 'raise-eyebrows':
        e.brows = per(env)
        break
      case 'close-eyes':
        e.shut = per(env)
        // A palsied eye cannot close: it rolls up (Bell's phenomenon) under the open lid.
        if (S.palsy) e.vertical = 25 * env
        break
      case 'show-teeth':
        e.smile = per(env)
        e.mouth = 0.12 * env
        break
      case 'puff-cheeks':
        e.cheeks = env * (S.palsy ? 0.4 : 1)
        break
      case 'open-mouth':
        e.mouth = 0.65 * env
        break
      case 'follow-finger': {
        // An H: right, up, down, back, left, up, down; your finger leads, her eyes follow.
        const path: [number, number][] = [
          [0, 0], [28, 0], [28, 18], [28, -18], [28, 0], [0, 0], [-28, 0], [-28, 18], [-28, -18], [-28, 0], [0, 0],
        ]
        const u = Math.min(0.999, m.t / m.dur) * (path.length - 1)
        const i = Math.floor(u)
        const f = smooth(u - i)
        const h = lerp(path[i][0], path[i + 1][0], f)
        const vert = lerp(path[i][1], path[i + 1][1], f)
        e.horizontal = h
        e.vertical = vert
        // Nystagmus: a slow drift back toward the middle, a quick beat toward the fast-phase side; worse looking that way.
        if (S.nystagmus) {
          const toward = S.nystagmus === 'R' ? h : -h
          const amp = toward > 10 ? 5 : toward > -10 ? 2 : 1
          const ph = (m.t * 2.8) % 1
          const saw = ph < 0.8 ? -ph / 0.8 : (ph - 0.8) / 0.2 - 1
          e.horizontal += (S.nystagmus === 'R' ? -1 : 1) * amp * (saw + 0.5)
        }
        this.placeFinger(h, vert)
        break
      }
      case 'fields': {
        const quad = Math.floor((m.t / m.dur) * 4) % 4
        this.placeFinger(quad % 2 ? 40 : -40, quad < 2 ? 25 : -25, 0.6)
        break
      }
    }
    return e
  }

  /** Your finger, held in front of her face at an angle from her line of sight (degrees, her right and up). */
  private placeFinger(h: number, vert: number, dist = 0.45) {
    const R = this.rig
    if (!R) return
    const eyes = R.eye.L.getWorldPosition(v(0, 0, 0)).add(R.eye.R.getWorldPosition(v(0, 0, 0))).multiplyScalar(0.5)
    const rel = R.head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.body.quaternion.clone().multiply(R.headBind).invert())
    const ax = (x: number, y: number, z: number) => v(x, y, z).applyQuaternion(this.body.quaternion).applyQuaternion(rel).normalize()
    const dir = ax(0, 0, 1)
      .applyAxisAngle(ax(0, 1, 0), -h * DEG)
      .applyAxisAngle(ax(-1, 0, 0), vert * DEG)
    this.finger.position.copy(eyes).addScaledVector(dir, dist)
    this.finger.quaternion.setFromUnitVectors(v(0, 1, 0), ax(0, 1, 0))
    this.finger.visible = true
  }

  /* ------------------------------------------------------------------ applying the pose */

  applyPose() {
    const R = this.rig
    if (!R) return
    for (const [bone, q] of this.bind) bone.quaternion.copy(q)
    let place = this.placeFor(this.posture, this.time)
    if (this.from && this.moveT < 1) {
      const k = smooth(this.moveT)
      place = { quat: this.from.place.quat.clone().slerp(place.quat, k), pos: this.from.place.pos.clone().lerp(place.pos, k) }
    }
    this.body.quaternion.copy(place.quat)
    this.body.position.copy(place.pos)
    // Standing on one leg with a positive Trendelenburg: the pelvis drops on the other side.
    const one = this.posture.match(/^one-leg-(R|L)$/)?.[1] as Side | undefined
    if (one && this.signs.trendelenburg === one) {
      const tilt = Math.min(1, this.moveT * 1.5) * 9 * DEG
      this.body.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), one === 'R' ? -tilt : tilt))
    }
    this.body.updateMatrixWorld(true)

    const q = this.body.quaternion
    const U = v(0, 1, 0).applyQuaternion(q)
    const F = v(0, 0, 1).applyQuaternion(q)
    const RT = v(-1, 0, 0).applyQuaternion(q)
    const j = this.jointsAt()
    const deg = (key: string) => (j[key] ?? 0) * DEG

    // Trunk: bend forward from the lumbar spine and the chest.
    if (j.trunk) {
      turn(R.spine, new THREE.Quaternion().setFromAxisAngle(RT, -deg('trunk') * 0.55))
      turn(R.chest, new THREE.Quaternion().setFromAxisAngle(RT, -deg('trunk') * 0.45))
    }
    // Head: turn and tilt, shared between the neck and the head. Where the collarbones hang off the neck, turn them back.
    for (const [bone, share] of [
      [R.neck, 0.4],
      [R.head, 0.6],
    ] as const) {
      const delta = new THREE.Quaternion()
        .setFromAxisAngle(RT, deg('neckpitch') * share)
        .multiply(new THREE.Quaternion().setFromAxisAngle(U, -deg('neckyaw') * share))
      if (delta.w > 0.99999) continue
      turn(bone, delta)
      if (bone === R.neck) for (const c of [R.clavicle.L, R.clavicle.R]) if (c?.parent === bone) turn(c, delta.clone().invert())
    }
    if (j.shrug) for (const s of SIDES) if (R.clavicle[s]) turn(R.clavicle[s]!, new THREE.Quaternion().setFromAxisAngle(F, (s === 'R' ? -1 : 1) * j.shrug * DEG))

    // Legs, from anatomical angles: flexion brings the thigh forward, abduction out; rotation turns the knee's plane.
    for (const s of SIDES) {
      const out = s === 'R' ? RT : RT.clone().negate()
      const flex = deg(`hipflex-${s}`)
      const abd = deg(`hipabd-${s}`)
      const thigh = U.clone().negate().multiplyScalar(Math.cos(flex)).addScaledVector(F, Math.sin(flex))
      thigh.multiplyScalar(Math.cos(abd)).addScaledVector(out, Math.sin(abd)).normalize()
      const kneeFront = F.clone().multiplyScalar(Math.cos(flex)).addScaledVector(U, Math.sin(flex))
      // Internal rotation (positive) turns the kneecap toward the midline.
      kneeFront.applyAxisAngle(thigh, (s === 'R' ? 1 : -1) * deg(`hiprot-${s}`))
      kneeFront.sub(thigh.clone().multiplyScalar(kneeFront.dot(thigh))).normalize()
      const knee = deg(`knee-${s}`)
      const shin = thigh.clone().multiplyScalar(Math.cos(knee)).addScaledVector(kneeFront, -Math.sin(knee))
      const footFront = kneeFront.clone().multiplyScalar(Math.cos(knee)).addScaledVector(thigh, Math.sin(knee))
      const ankle = deg(`ankle-${s}`) + 12 * DEG
      const toes = footFront.clone().multiplyScalar(Math.cos(ankle)).addScaledVector(shin, Math.sin(ankle))
      aim(R.thigh[s], R.calf[s], thigh)
      aim(R.calf[s], R.foot[s], shin)
      const toe = R.toe[s]
      if (toe) aim(R.foot[s], toe, toes)
    }

    // Arms: flexion forward, abduction out; rotation swings the forearm's plane; the elbow bends toward the front.
    const chestQ = R.chest.getWorldQuaternion(new THREE.Quaternion())
    const chestRel = chestQ.clone().multiply(this.restChest(R).invert())
    const Uc = v(0, 1, 0).applyQuaternion(q).applyQuaternion(chestRel)
    const Fc = v(0, 0, 1).applyQuaternion(q).applyQuaternion(chestRel)
    const RTc = v(-1, 0, 0).applyQuaternion(q).applyQuaternion(chestRel)
    for (const s of SIDES) {
      const out = s === 'R' ? RTc : RTc.clone().negate()
      const flex = deg(`shoulderflex-${s}`)
      const abd = deg(`shoulderabd-${s}`)
      const upper = Uc.clone().negate().multiplyScalar(Math.cos(flex) * Math.cos(abd)).addScaledVector(Fc, Math.sin(flex)).addScaledVector(out, Math.sin(abd) * Math.cos(flex)).normalize()
      const front = Fc.clone().sub(upper.clone().multiplyScalar(Fc.dot(upper)))
      if (front.lengthSq() < 1e-4) front.copy(Uc)
      front.normalize()
      // External rotation (positive) swings the forearm outward.
      front.applyAxisAngle(upper, (s === 'R' ? -1 : 1) * deg(`shoulderrot-${s}`))
      const elbow = deg(`elbow-${s}`)
      const fore = upper.clone().multiplyScalar(Math.cos(elbow)).addScaledVector(front, Math.sin(elbow))
      const wrist = deg(`wrist-${s}`)
      const back = upper.clone().cross(fore).lengthSq() > 1e-6 ? front.clone().multiplyScalar(Math.cos(elbow)).addScaledVector(upper, -Math.sin(elbow)) : front.clone()
      const hand = fore.clone().multiplyScalar(Math.cos(wrist)).addScaledVector(back, -Math.sin(wrist))
      aim(R.upperArm[s], R.forearm[s], upper)
      aim(R.forearm[s], R.hand[s], fore)
      const finger = R.finger[s]
      if (finger) aim(R.hand[s], finger, hand)
      // Pat front then back: the hand turns about the forearm.
      if (this.motion?.id === 'rapid-alternating') {
        const slow = this.signs.ataxia === s
        const flip = Math.sin(this.motion.t * Math.PI * 2 * (slow ? 1.3 : 2.4) + (slow ? Math.sin(this.motion.t * 3) : 0))
        turn(R.hand[s], new THREE.Quaternion().setFromAxisAngle(fore, flip * 1.3))
      }
    }

    for (const s of SIDES) this.poseFingers(R, s)
    this.presentSpot(R)
    poseEyes(R, this.bind, this.body, this.faceAt())
  }

  private chestRest: THREE.Quaternion | null = null
  /** The chest bone's world rotation in the bind pose under the current body orientation. */
  private restChest(R: Rig) {
    if (!this.chestRest) {
      const saved = new Map<THREE.Object3D, THREE.Quaternion>()
      for (const [b] of this.bind) saved.set(b, b.quaternion.clone())
      for (const [b, bq] of this.bind) b.quaternion.copy(bq)
      const q0 = this.body.quaternion.clone()
      this.body.quaternion.identity()
      this.body.updateMatrixWorld(true)
      this.chestRest = R.chest.getWorldQuaternion(new THREE.Quaternion())
      this.body.quaternion.copy(q0)
      for (const [b, sq] of saved) b.quaternion.copy(sq)
      this.body.updateMatrixWorld(true)
    }
    return this.body.quaternion.clone().multiply(this.chestRest)
  }

  /* ------------------------------------------------------------------ where you touch */

  /** The landmark under a screen point, if the ray meets her body near one; or null. */
  pick(clientX: number, clientY: number, loose = false): { site: string | null; point: THREE.Vector3 } | null {
    const R = this.rig
    if (!R) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    this.camera.updateMatrixWorld()
    ray.setFromCamera(ndc, this.camera)
    const targets: THREE.Object3D[] = [...R.meshes, ...(this.drape ? [this.drape] : [])]
    const hit = ray.intersectObjects(targets, false)[0]
    if (!hit) return null
    const onDrape = hit.object === this.drape
    let best: string | null = null
    let bestD = Infinity
    for (const [id, a] of this.anchors) {
      const def = siteOf(id)?.def
      if (!def || (onDrape && !def.draped)) continue
      const d = a.getWorldPosition(v(0, 0, 0)).distanceTo(hit.point) / (def.r * this.scale)
      if (d < bestD) {
        bestD = d
        best = id
      }
    }
    return { site: loose || bestD <= (onDrape ? 4 : 1.6) ? best : null, point: hit.point.clone() }
  }

  /** A site's position on screen (CSS pixels), for labels and markers. */
  screenOf(point: THREE.Vector3) {
    this.camera.updateMatrixWorld()
    const p = point.clone().project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height, behind: p.z > 1 }
  }

  hasSite(id: string) {
    return this.anchors.has(id)
  }

  siteWorld(id: string) {
    return this.anchors.get(id)?.getWorldPosition(v(0, 0, 0)) ?? null
  }

  /** A ring that fades where you touched. */
  mark(point: THREE.Vector3, color = '#ffd34d') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.018, 24), new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, side: THREE.DoubleSide }))
    ring.position.copy(point)
    ring.lookAt(this.camera.position)
    ring.renderOrder = 10
    this.scene.add(ring)
    this.marks.push({ mesh: ring, t: 0 })
  }

  /**
   * Which joint a drag on this site moves. Lying down, the leg moves as an examiner moves it: lift the knee and the
   * hip flexes with the heel sliding up the couch (the knee bending twice as fast, then the knee to the chest); lift
   * the ankle and the straight leg rises; with hip and knee both bent, the foot swings the hip into rotation.
   */
  limbAt(site: string | null): Limb | null {
    if (!site) return null
    const side = site.match(/-(R|L)$/)?.[1] as Side | undefined
    if (!side) return site === 'head' || site === 'forehead' ? { joint: 'neck', dof: 'yaw', key: 'neckyaw' } : null
    const base = site.replace(/-(R|L)$/, '')
    const j = this.jointsAt()
    const lying = ['supine', 'knees-up', 'roll-R', 'roll-L'].includes(this.posture)
    const bent = (j[`hipflex-${side}`] ?? 0) > 60 && (j[`knee-${side}`] ?? 0) > 60
    if (['foot', 'toes', 'heel', 'sole', 'lateralmalleolus', 'medialmalleolus', 'shin', 'calf', 'dp', 'pt', 'navicular', 'fifthmt'].includes(base)) {
      if (bent) return { joint: `hip-${side}`, dof: 'rot', key: `hiprot-${side}` }
      return lying ? { joint: `hip-${side}`, dof: 'flex', key: `hipflex-${side}` } : { joint: `knee-${side}`, dof: 'flex', key: `knee-${side}` }
    }
    if (['knee', 'thigh', 'medialjoint', 'lateraljoint', 'tibialtub', 'fibula', 'popliteal', 'innerthigh'].includes(base))
      return lying ? { joint: `hip-${side}`, dof: 'flex', key: `hipflex-${side}`, kneeWithHip: true } : { joint: `hip-${side}`, dof: 'flex', key: `hipflex-${side}` }
    if (['forearm', 'wrist', 'hand', 'palm', 'nails', 'pulp', 'ring', 'ringpulp', 'thumb', 'web'].includes(base))
      return (j[`elbow-${side}`] ?? 0) > 60 ? { joint: `shoulder-${side}`, dof: 'rot', key: `shoulderrot-${side}` } : { joint: `elbow-${side}`, dof: 'flex', key: `elbow-${side}` }
    if (['arm', 'elbow', 'badge', 'shoulder', 'acromion', 'tuberosity', 'bicipital'].includes(base)) return { joint: `shoulder-${side}`, dof: 'abd', key: `shoulderabd-${side}` }
    return null
  }

  /** Move a limb by hand: its angle, and the knee with the hip when the heel slides on the couch. */
  setHeld(limb: Limb, value: number) {
    this.held[limb.key] = value
    if (limb.kneeWithHip) this.held[limb.key.replace('hipflex', 'knee')] = Math.max(0, Math.min(135, 2 * value))
    else if (limb.dof === 'flex' && limb.key.startsWith('hipflex')) this.held[limb.key.replace('hipflex', 'knee')] = this.angle(limb.key.replace('hipflex', 'knee'))
  }

  /** Current angle of a joint key (degrees). */
  angle(key: string) {
    return this.jointsAt()[key] ?? 0
  }

  /** Every joint angle now, for the rules' `@` conditions. */
  angles(): Record<string, number> {
    return this.jointsAt()
  }

  /** Where the held point would appear on screen for a small change: so a drag can follow your finger. */
  probe(limb: Limb, delta: number, site: string): { x: number; y: number } | null {
    const saved = { ...this.held }
    this.setHeld(limb, this.angle(limb.key) + delta)
    this.applyPose()
    const p = this.siteWorld(site)
    this.held = saved
    this.applyPose()
    return p ? this.screenOf(p) : null
  }

  /* ------------------------------------------------------------------ camera */

  setView(view: View) {
    this.view = view
    this.orbit = { yaw: 0, pitch: 0, zoom: 1 }
  }

  /** Close in on a landmark, from the side it faces. */
  focus(site: string) {
    this.focusSite = site
    this.view = 'focus'
    this.orbit = { yaw: 0, pitch: 0, zoom: 1 }
  }

  /** Your own turn of the camera around what it looks at: drag sideways to go round, up and down to look from above. */
  private orbit = { yaw: 0, pitch: 0, zoom: 1 }

  orbitBy(dx: number, dy: number) {
    this.orbit.yaw -= dx * 0.009
    this.orbit.pitch = Math.max(-0.8, Math.min(1.1, this.orbit.pitch + dy * 0.006))
  }

  zoomBy(factor: number) {
    this.orbit.zoom = Math.max(0.4, Math.min(2.4, this.orbit.zoom * factor))
  }

  private aimCamera() {
    const R = this.rig
    if (!R) return
    const far = this.camera.aspect < 1 ? 1.4 : 1
    const H = R.height
    const at = (o: THREE.Object3D) => o.getWorldPosition(v(0, 0, 0))
    const at0 = at
    const F = v(0, 0, 1).applyQuaternion(this.body.quaternion)
    const mid = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().add(b).multiplyScalar(0.5)
    const toward = (front: number, dir: THREE.Vector3) => F.clone().multiplyScalar(front).add(dir).normalize()
    let target: THREE.Vector3
    let dir: THREE.Vector3
    let dist: number
    switch (this.view) {
      case 'focus': {
        // Hands on: from beside the contact, square to the examiner's arm (looking down it would hide the contact).
        if (this.contact) {
          const c = this.contact
          const side = c.along.clone().cross(c.n).normalize()
          if (side.dot(F) < 0) side.negate()
          target = c.at.clone()
          // Fingers pushed back into extension read best side on.
          dir = c.profile ? side.add(c.n.clone().multiplyScalar(0.3)).add(v(0, 0.15, 0)) : c.n.clone().add(side.multiplyScalar(0.75)).add(v(0, 0.2, 0))
          dist = 0.5
          break
        }
        // Showing you his hand: square on to the shape he is making.
        const shown = this.act?.anim.startsWith('pose:') ? this.handLook[this.act.side] : null
        if (shown) {
          target = shown.at.clone()
          dir = shown.n.clone()
          dist = 0.55
          break
        }
        const at = this.focusSite ? this.siteWorld(this.focusSite) : null
        target = at ?? mid(at0(R.hips), at0(R.head))
        // From outside the body toward the spot, leaning toward the examiner's side and up.
        const centre = mid(at0(R.hips), at0(R.chest))
        dir = target.clone().sub(centre).setY(0).normalize().multiplyScalar(0.6).add(v(0.1, 0.55, 0.6)).normalize()
        dist = 0.62
        break
      }
      case 'head':
        target = mid(at(R.eye.L), at(R.eye.R))
        dir = toward(0.75, v(0.1, 0.15, 0.35))
        dist = 0.5
        break
      case 'chest':
        target = at(R.chest).addScaledVector(F, 0.08 * this.scale)
        dir = toward(0.65, v(0.15, 0.2, 0.45))
        dist = 0.85
        break
      case 'abdomen':
        target = at(R.spine).addScaledVector(F, 0.08 * this.scale)
        dir = toward(0.65, v(0.15, 0.2, 0.45))
        dist = 0.85
        break
      case 'hands':
        target = mid(at(R.hand.L), at(R.hand.R))
        dir = toward(0.5, v(0.1, 0.6, 0.55))
        dist = 0.75
        break
      case 'legs':
        target = mid(at(R.calf.L), at(R.calf.R))
        dir = toward(0.35, v(0.2, 0.55, 0.85))
        dist = 1.15
        break
      case 'feet':
        target = mid(at(R.foot.L), at(R.foot.R))
        dir = toward(0.25, v(0.75, 0.45, 0.55))
        dist = 0.8
        break
      case 'back':
        target = at(R.chest).addScaledVector(F, -0.12 * this.scale)
        dir = F.clone().negate().multiplyScalar(0.8).add(v(0, 0.25, 0.2)).normalize()
        dist = 1.0
        break
      default:
        if (['standing', 'walking', 'heel-toe', 'bent', 'one-leg-R', 'one-leg-L'].includes(this.posture)) {
          // Head to toe: the gait, the stance, the pelvis.
          target = at(R.hips).add(v(0, 0.06 * H, 0))
          dir = v(0.12, 0.22, 1).normalize()
          dist = 1.15 * H + 0.45
        } else {
          target = mid(at(R.hips), at(R.head))
          dir = v(0.28, 0.45, 1).normalize()
          dist = 0.62 * H + 0.55
        }
    }
    // Your orbit: round the vertical through the target, then up or down (never through the floor).
    dir.normalize().applyAxisAngle(v(0, 1, 0), this.orbit.yaw)
    const side = v(0, 1, 0).cross(dir)
    if (side.lengthSq() > 1e-6) {
      const lifted = dir.clone().applyAxisAngle(side.normalize(), -this.orbit.pitch)
      if (lifted.y < 0.97 && lifted.y > -0.35) dir.copy(lifted)
    }
    dist *= this.orbit.zoom
    // Never from below the floor or behind the wall.
    if (dir.y < -0.2) dir.y = -0.2
    this.wantLook.copy(target)
    this.wantPos.copy(target).addScaledVector(dir.normalize(), dist * far * Math.max(0.75, this.scale))
    if (this.wantPos.z < -2.4) this.wantPos.z = -2.4
    if (this.wantPos.y < 0.15) this.wantPos.y = 0.15
  }

  /* ------------------------------------------------------------------ loop */

  resize() {
    const w = this.host.clientWidth || 300
    const h = this.host.clientHeight || 200
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private last = performance.now()
  private loop = () => {
    if (this.disposed) return
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.time += dt
    if (this.moveT < 1) this.moveT = Math.min(1, this.moveT + dt / 1.1)
    if (this.motion) {
      this.motion.t += dt
      if (this.motion.t >= this.motion.dur) this.motion = null
    }
    if (this.stimT >= 0) {
      this.stimT += dt
      if (this.stimT > 6) this.stimT = -1
    }
    this.onFrame?.(dt)
    this.updateAct(dt)
    this.applyPose()
    if (this.rig) {
      this.body.updateMatrixWorld(true)
      this.rig.tick(dt)
    }
    this.placeExaminer()
    this.aimCamera()
    const k = 1 - Math.exp(-dt * 4)
    this.camPos.lerp(this.wantPos, k)
    this.camLook.lerp(this.wantLook, k)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
    for (const m of this.marks) {
      m.t += dt
      const mat = m.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - m.t / 1.4)
      m.mesh.scale.setScalar(1 + m.t * 1.5)
    }
    for (const m of this.marks.filter((x) => x.t > 1.4)) {
      this.scene.remove(m.mesh)
      m.mesh.geometry.dispose()
    }
    this.marks = this.marks.filter((x) => x.t <= 1.4)
    this.renderer.render(this.scene, this.camera)
    this.frame = requestAnimationFrame(this.loop)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.rig?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

/** Every site id with its definition (for tools that list where to go). */
export const ALL_SITES = SITES
