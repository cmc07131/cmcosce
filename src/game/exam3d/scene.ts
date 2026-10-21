import * as THREE from 'three'
import { castPatient, type AvatarId, type PatientKind } from '../body3d/cast'
import { CollarKit } from '../body3d/collar'
import { COLLAR_OFF, COLLAR_ON, type CollarPose } from '../body3d/stifneck'
import { bareLegs } from '../body3d/legs'
import { DEG, aim, poseEyes, turn, type Credit, type Eyes, type Rig, type Side } from '../body3d/rig'
import { COUCH, buildCouch, buildRoom, createRenderer } from '../body3d/stage'
import { ExaminerHand, type Contact, type Grip } from './examiner'
import { antalgic } from './gait'
import type { Anim } from './manoeuvres'
import { SITES, SITE_IDS, onLeg, siteOf, type DigitRef, type JointRef } from './sites'

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
  /** In shorts: bare legs from mid-thigh down (a leg examination). */
  shorts?: boolean
  /** A cervical collar, head blocks and tape to fit (and earrings to take off first). */
  collar?: boolean
  /** A plastic manikin, not a person. */
  manikin?: boolean
  /** A knee effusion on this side (bare legs): the knee swells and will not bend past 80°. */
  effusion?: Side
  /** A torn anterior cruciate ligament: the Lachman test draws this shin forward. */
  acl?: Side
  /** Places that hurt when pressed (site ids). */
  tender?: string[]
}

/** A hand shape: each finger's knuckle, middle and end joint flexion and its spread (toward the little finger); the
 * thumb's sweep across the palm and its two joints, and `tx` its swing out to the thumb side; `turn`: the forearm
 * turns the thumb side up; `ext`: the wrist bends back; `face`: what he turns toward you to show it (the ring
 * his thumb and index make, his palm, or the back of his hand). Degrees. */
type HandShape = { f: [number, number, number, number][]; t: [number, number, number]; tx?: number; turn?: 'up'; ext?: number; lift?: number; face?: 'ring' | 'palm' | 'back' }
const FIST: HandShape['f'] = [
  [85, 95, 60, 0],
  [85, 95, 60, 0],
  [85, 95, 60, 0],
  [85, 95, 60, 0],
]
/** Manoeuvres done with the examiner's hands. */
const HANDS_ON = new Set<string>(['pulse', 'doppler', 'crt', 'warmth', 'touch', 'pin', 'squeeze', 'stretch', 'patellar-tap', 'joint-line', 'bone', 'knee-passive', 'lachman', 'drawer', 'stress', 'hip-roll'])
/** What a manoeuvre is about, lit up in the X-ray view: by where it is done, and by what it is. */
const LIGHTS_BY_SITE: Record<string, string[]> = {
  medialjoint: ['medial-meniscus', 'mcl'],
  lateraljoint: ['lateral-meniscus'],
  patella: ['patella'],
  fibula: ['fibula', 'nerve'],
  tibialtub: ['tibia'],
  dp: ['arteries'],
  pt: ['arteries'],
}
const LIGHTS_BY_ANIM: Record<string, string[]> = {
  lachman: ['acl'],
  drawer: ['pcl'],
  stress: ['mcl', 'lcl'],
  'patellar-tap': ['effusion', 'patella'],
  slr: ['patella'],
  'foot-up': ['nerve'],
}
/** Manoeuvres are shown this much faster than they are timed below; a capillary refill and walking keep real time. */
const SPEED = 2.5
/** How much faster than life the patient's own movements are shown (a finger–nose, a face moving). */
const PATIENT_PACE = 1.35
const REAL_TIME = new Set<string>(['crt', 'walk', 'speech', 'eyes-h', 'finger-nose', 'rapid-alt', 'tone-arm', 'tone-leg', 'heel-shin', 'sit-trunk', 'grip', 'acuity', 'pin-at', 'fields-hand', 'torch-eyes', 'face-touch', 'clench', 'otoscope', 'look-mouth', 'parotid', 'whisper', 'fork', 'weber'])
/** How long each manoeuvre takes (seconds, before `SPEED`); asking for a hand shape, 3.4. */
const DURATION: Record<string, number> = {
  inspect: 2.2,
  look: 1.6,
  warmth: 2.6,
  crt: 3.6,
  pulse: 3.2,
  doppler: 3.2,
  touch: 2.4,
  pin: 2.4,
  squeeze: 2.8,
  stretch: 3.2,
  'elbow-flex': 3.4,
  'elbow-straighten': 2.6,
  walk: 6.8,
  'patellar-tap': 4,
  'joint-line': 3.8,
  bone: 2.6,
  'knee-bend': 5.2,
  'knee-passive': 5.6,
  slr: 3.8,
  lachman: 4.6,
  drawer: 5.4,
  stress: 6,
  'foot-up': 3.2,
  'hip-roll': 3.8,
  mils: 1.6,
  jewellery: 2,
  measure: 2.4,
  size: 4.6,
  'collar-back': 4.8,
  'collar-front': 5.4,
  fit: 2.4,
  blocks: 5.6,
  'collar-all': 24,
  midline: 3,
  'rotate-head': 4.4,
  // The cerebellar examination: her own movements, in real seconds.
  speech: 2.6,
  'eyes-h': 6.4,
  'finger-nose': 5,
  'rapid-alt': 3.6,
  'tone-arm': 3.6,
  'heel-shin': 5.6,
  'tone-leg': 3.6,
  'sit-trunk': 6.6,
  grip: 2.8,
  // The cranial nerves, in real seconds.
  acuity: 4,
  'fields-hand': 5,
  'torch-eyes': 4,
  'face-touch': 2.4,
  'pin-at': 2.4,
  clench: 2.6,
  otoscope: 3,
  'look-mouth': 3,
  parotid: 2.6,
  whisper: 4,
  fork: 4,
  weber: 3,
}

/** Asked of the patient in a focused examination (a face moving, a shrug): how long each takes, in real seconds. */
const ASK_FOR: Record<string, number> = { 'raise-eyebrows': 2.6, 'close-eyes': 3, 'show-teeth': 2.6, 'puff-cheeks': 2.6, 'open-mouth': 3, shrug: 3, 'arms-out': 4.5, 'clench-jaw': 2.6 }

/** The collar's steps in order: each shown from where the ones before it leave it. */
const COLLAR_STEPS = ['mils', 'jewellery', 'measure', 'size', 'collar-back', 'collar-front', 'fit', 'blocks'] as const
type CollarStep = (typeof COLLAR_STEPS)[number]
/** Each step's slot in the whole fit shown start to finish (seconds, before `SPEED`). */
const COLLAR_SLOTS: [CollarStep, number, number][] = [
  ['mils', 0, 1.2],
  ['jewellery', 1.2, 2.8],
  ['measure', 2.8, 4.6],
  ['size', 4.6, 8.4],
  ['collar-back', 8.4, 12.4],
  ['collar-front', 12.4, 17],
  ['fit', 17, 18.8],
  ['blocks', 18.8, 23.6],
]
/**
 * How far on each part is (0 … 1): hands holding the head in line; each earring (1: in); the collar, stage by stage;
 * the head blocks; the tape over the forehead and over the chin support.
 */
type KitState = { mils: number; earR: number; earL: number; collar: CollarPose; blockR: number; blockL: number; tapeF: number; tapeC: number }
const KIT_OFF: KitState = { mils: 0, earR: 1, earL: 1, collar: { ...COLLAR_OFF }, blockR: 0, blockL: 0, tapeF: 0, tapeC: 0 }
/** Where the collar is when this step begins: every step before it done. */
function kitBefore(step: CollarStep): KitState {
  const i = COLLAR_STEPS.indexOf(step)
  const done = (name: CollarStep) => (COLLAR_STEPS.indexOf(name) < i ? 1 : 0)
  const sized = done('size')
  const back = done('collar-back')
  const front = done('collar-front')
  return {
    mils: done('mils'),
    earR: 1 - done('jewellery'),
    earL: 1 - done('jewellery'),
    collar: { out: sized, preform: sized, approach: back, feed: back, wrap: front, fasten: front },
    blockR: 0,
    blockL: 0,
    tapeF: 0,
    tapeC: 0,
  }
}
/** Where a hand goes and how it lies: a point, the way the surface there faces, the way the fingers point. */
type Spot = { at: THREE.Vector3; n: THREE.Vector3; along: THREE.Vector3 }
/** Part of the way from one spot to another. */
function between(a: Spot, b: Spot, f: number): Spot {
  return { at: a.at.clone().lerp(b.at, f), n: a.n.clone().lerp(b.n, f).normalize(), along: a.along.clone().lerp(b.along, f).normalize() }
}

/**
 * One of the hands on the patient: its grip, what touches, how far off the skin, a stroke along the limb (or across
 * it). `left`: your other hand; `hand`: which of the four (0 and 1 yours, 2 and 3 an assistant's). `at` and `n`: a
 * point and its outward direction instead of a landmark (a hand on the collar as it goes on); `along`: the way the
 * fingers point, in the body's own frame (up, front, her left).
 */
type Touch = {
  grip: Grip
  contact: Contact
  gap: number
  stroke: number
  site: string
  left?: boolean
  across?: boolean
  hand?: number
  at?: THREE.Vector3
  n?: THREE.Vector3
  along?: [number, number, number]
  /** Where the hand goes, worked out once the body is posed (a hand on the collar as it goes on). */
  spot?: () => Spot | null
  /** Where your arm comes from: beside him and a little behind, on the side of the spot (an ear, a mastoid); or
   * straight down from above it (a hand on the far side of someone lying down). */
  from?: 'behind' | 'above'
}

export const HANDS: Record<string, HandShape> = {
  relaxed: { f: [[15, 20, 10, 0], [15, 22, 10, 0], [18, 24, 10, 0], [20, 25, 12, 0]], t: [10, 10, 10] },
  fist: { f: FIST, t: [35, 35, 30] },
  // Angles below were tuned by measuring the bones: the thumb up from the fist within its natural range (the forearm
  // level, turned thumb side up); the O closed tip to tip.
  'thumbs-up': { f: FIST, t: [-40, -20, 5], tx: 18, turn: 'up', ext: 35, lift: 30 },
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
  // The index out straight, the rest curled in (to touch a target: the finger–nose test).
  point: { f: [[-4, -2, 0, 0], [85, 95, 60, 0], [85, 95, 60, 0], [85, 95, 60, 0]], t: [30, 30, 25] },
}

type Joints = Record<string, number>
/** A joint a drag moves: `key` is the angle; lying down, lifting the knee bends it with the hip (`kneeWithHip`). */
export type Limb = { joint: string; dof: string; key: string; kneeWithHip?: boolean }
type Place = { quat: THREE.Quaternion; pos: THREE.Vector3 }

const SIDES: Side[] = ['R', 'L']
const LEG_JOINTS = new Set<JointRef>(['thigh', 'calf', 'foot', 'toe'])
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const smooth = (k: number) => k * k * (3 - 2 * k)

/**
 * Where your finger is in the H, `t` seconds into `dur` (degrees from her line of sight, her right and up): to her right
 * and held there, up, down, back to the middle; then the same to her left.
 */
function gazePath(t: number, dur: number) {
  const keys: [number, number, number][] = [
    [0, 0, 0],
    [0.09, 28, 0],
    [0.24, 28, 0],
    [0.31, 28, 16],
    [0.37, 28, -16],
    [0.43, 28, 0],
    [0.5, 0, 0],
    [0.59, -28, 0],
    [0.74, -28, 0],
    [0.81, -28, 16],
    [0.87, -28, -16],
    [0.93, -28, 0],
    [1, 0, 0],
  ]
  const u = Math.max(0, Math.min(1, t / dur))
  let i = 0
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++
  const [u0, h0, v0] = keys[i]
  const [u1, h1, v1] = keys[i + 1]
  const f = smooth(Math.max(0, Math.min(1, (u - u0) / Math.max(1e-6, u1 - u0))))
  return { h: h0 + (h1 - h0) * f, v: v0 + (v1 - v0) * f }
}

/**
 * Nystagmus added to the gaze (degrees): a slow drift back toward the middle, a quick beat toward the fast-phase side;
 * worse looking that way, little looking ahead, a beat or two looking away.
 */
function nystagmusBeat(t: number, h: number, side: Side) {
  const toward = side === 'R' ? h : -h
  const amp = toward > 10 ? 5 : toward > -10 ? 2 : 1
  const ph = (t * 2.8) % 1
  const saw = ph < 0.8 ? -ph / 0.8 : (ph - 0.8) / 0.2 - 1
  return (side === 'R' ? -1 : 1) * amp * (saw + 0.5)
}

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
  /** How long the change of position takes (seconds). */
  private moveDur = 1.1
  /** Joints the examiner has moved by hand: they hold until she changes position. */
  held: Joints = {}
  /** Joints she keeps so whatever position she is in (a painful knee held a little bent): `body.holds`. */
  rests: Joints = {}
  /** Each bone's place in the bind pose (only the shins ever move from theirs). */
  private bindPos = new Map<THREE.Object3D, THREE.Vector3>()
  /** How far each shin is drawn forward at the knee (m; back if negative): a Lachman test, a drawer. */
  private tibia: Record<Side, number> = { L: 0, R: 0 }
  /** The way the front of each shin faces now. */
  private shinFront: Record<Side, THREE.Vector3> = { L: v(0, 0, 1), R: v(0, 0, 1) }
  /** What is uncovered (0 … 1). */
  private bare = { trunk: 0, arms: 0, legs: 0 }
  /** When she set off walking (each lap starts by the couch). */
  private walkFrom = 0
  /** A manoeuvre filmed from a set place (from the side for a Lachman test): until the camera is moved. */
  private shot: { target: () => THREE.Vector3 | null; dir: THREE.Vector3; dist: number } | null = null
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
  /**
   * A manoeuvre being shown: on a leg or not; the knee and hip angles it started from; the position to go back to
   * after walking.
   */
  private act: { anim: Anim; site: string | null; side: Side; t: number; dur: number; speed: number; lift0: number; leg: boolean; k0: number; h0: number; back?: Posture } | null = null
  private examiner: ExaminerHand
  private examiner2: ExaminerHand
  /** An assistant's hands (in-line stabilisation from the head end). */
  private assistant: [ExaminerHand, ExaminerHand]
  /** The collar and what goes with it, and how far on it is. */
  private kit: CollarKit | null = null
  private kitState: KitState = { ...KIT_OFF }
  /**
   * Where a fingertip or a heel must be this frame (the finger–nose and heel–shin tests), and which way the elbow or the
   * knee points; and where each was when the test began (to go back to).
   */
  private reachTo: { arm: Partial<Record<Side, { at: THREE.Vector3; pole: THREE.Vector3; tip?: 'palm' }>>; leg: Partial<Record<Side, { at: THREE.Vector3; pole: THREE.Vector3 }>> } = { arm: {}, leg: {} }
  private reachFrom = new Map<string, THREE.Vector3>()
  /** Leaning to one side, sitting up (degrees, toward her right): truncal ataxia. */
  private lean = 0
  /** Which step of a whole collar fit is being filmed (to move the camera when the next begins). */
  private slotShown: CollarStep | null = null
  /** The arc that shows how far the head turns (45° each way). */
  private arc: THREE.Line | null = null
  /** Bare legs built for a leg examination, and what is under their skin (see body3d/legs.ts). */
  private legs: THREE.Mesh[] = []
  private anatomy: THREE.Mesh[] = []
  /** The X-ray view: the skin of the bare legs see-through, the bones, ligaments and vessels under it showing. */
  xray = false
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
    this.examiner2 = new ExaminerHand(this.scene, true)
    this.assistant = [new ExaminerHand(this.scene), new ExaminerHand(this.scene, true)]
    this.ready = castPatient(kind, look).then(({ rig, credit }) => {
      if (this.disposed) return rig.dispose()
      this.rig = rig
      this.credit = credit
      this.scale = rig.height / 1.72
      // Bare legs first (with any swelling): the landmarks are then found on their skin.
      if (signs.shorts) ({ legs: this.legs, anatomy: this.anatomy } = bareLegs(rig, { effusion: signs.effusion, acl: signs.acl }))
      this.pinSites(rig)
      this.bind = new Map(rig.bones.map((b) => [b, b.quaternion.clone()]))
      this.bindPos = new Map(rig.bones.map((b) => [b, b.position.clone()]))
      this.body.add(rig.root)
      if (signs.drape) this.addDrape(rig)
      if (signs.collar) this.kit = new CollarKit(rig, this.scene)
      if (signs.manikin) this.plastic(rig)
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
      // Below the hem of the shorts, on the bare leg (the trousers are tucked away inside it).
      const bare = this.legs.length > 0 && LEG_JOINTS.has(def.j) && !(def.j === 'thigh' && (def.t ?? 0) < 0.45)
      const hits = new THREE.Raycaster(at.clone().addScaledVector(dir, 0.35 * k), dir.clone().negate(), 0, 0.6 * k)
        .intersectObjects(bare ? this.legs : rig.meshes, false)
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
  setPosture(p: Posture, seconds = 1.1) {
    if (p === this.posture && this.moveT >= 1) return
    this.moveDur = seconds
    this.from = { place: this.placeFor(this.posture, this.time), joints: this.jointsNow() }
    if ((p === 'walking' || p === 'heel-toe') && this.posture !== p) this.walkFrom = this.time
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
    this.bare = { ...parts }
    // In shorts the legs are bare already: what would be uncovered there is the shorts.
    this.rig?.expose({ ...parts, legs: this.signs.shorts ? 0 : parts.legs })
  }

  /** Show a manoeuvre being done; returns how long it takes (seconds). */
  perform(anim: Anim, site: string | null, side: Side): number {
    // One at a time: whatever was being shown is finished first.
    if (this.act) this.endAct()
    const ask = anim.startsWith('ask:') ? anim.slice(4) : null
    const d = anim.startsWith('pose:') ? 3.4 : ask ? (ASK_FOR[ask] ?? 2.6) : (DURATION[anim] ?? 2)
    // A capillary refill and walking take the time they take; the patient's own movements run a little brisker than life;
    // the rest is shown at speed.
    const speed = anim === 'crt' || anim === 'walk' ? 1 : REAL_TIME.has(anim) || ask ? PATIENT_PACE : SPEED
    // Something asked of her (a face moving, a shrug): she does it, as she would if asked in conversation.
    if (ask) this.play(ask, d)
    const leg = !!site && onLeg(site)
    this.act = {
      anim,
      site,
      side,
      t: 0,
      dur: d,
      speed,
      lift0: this.held[`shoulderflex-${side}`] ?? this.angle(`shoulderflex-${side}`),
      leg,
      k0: this.angle(`knee-${side}`),
      h0: this.angle(`hipflex-${side}`),
    }
    // Looking, or laying hands on a limb: uncovered (the sleeves rolled up; the legs bare).
    if (anim === 'inspect' || HANDS_ON.has(anim)) {
      this.expose({ ...this.bare, [leg ? 'legs' : 'arms']: 1 })
      for (const b of this.bruises) b.visible = true
    }
    if (anim.startsWith('pose:')) {
      const name = anim.slice(5)
      this.hands[side] = { name: name === 'ok' && this.signs.ain === side ? 'ok-palsy' : name, w: this.hands[side].name === name ? this.hands[side].w : 0, want: 1 }
    }
    if (anim === 'stretch') this.hands[side] = { name: 'extended', w: 0, want: 1 }
    // Walking: off the couch, up and down the room, and back to where she was.
    if (anim === 'walk') {
      this.act.back = this.posture
      this.setPosture('walking', 0.8)
    }
    this.shot = this.shotFor(anim, site, side)
    this.light([...(LIGHTS_BY_ANIM[anim] ?? []), ...(site ? (LIGHTS_BY_SITE[site.replace(/-(R|L)$/, '')] ?? []) : [])], side)
    return d / speed
  }

  get canXray() {
    return this.anatomy.length > 0
  }

  /**
   * See through the skin of the bare legs (or not): the skin a dark glass, the anatomy drawn over it, the examiner's
   * hands ghosted so what they press shows through.
   */
  setXray(on: boolean) {
    this.xray = on
    for (const m of this.legs) {
      const mat = m.material as THREE.MeshStandardMaterial
      if (!this.skinColour) this.skinColour = mat.color
      mat.color = on ? new THREE.Color('#1b2c46') : this.skinColour
      mat.transparent = on
      mat.opacity = on ? 0.5 : 1
      mat.depthWrite = !on
      mat.needsUpdate = true
      m.renderOrder = on ? 1 : 0
    }
    for (const m of this.anatomy) m.visible = on
    this.examiner.ghost(on)
  }
  /** The legs' own skin colour (shared with the rig: it follows the tone read from the face). */
  private skinColour: THREE.Color | null = null

  /** A manikin: the body in smooth plastic (its shape kept, its skin and clothes gone). */
  private plastic(rig: Rig) {
    const mat = new THREE.MeshStandardMaterial({ color: '#e3c7aa', roughness: 0.42, metalness: 0 })
    for (const m of rig.meshes) {
      const old = m.material
      m.material = Array.isArray(old) ? old.map(() => mat) : mat
    }
  }

  /** Each part where its progress puts it: the collar bent to its stage, the earrings, the blocks and the tape. */
  private applyKit() {
    const kit = this.kit
    if (!kit) return
    const st = this.kitState
    const k = this.scale
    this.body.updateMatrixWorld(true)
    kit.collar.setCouch(COUCH.top)
    kit.collar.update(st.collar)
    kit.collar.sync()
    kit.earrings.forEach((o, i) => {
      const left = i === 1
      const w = left ? st.earL : st.earR
      o.visible = w > 0.02
      o.position.set((left ? 1 : -1) * 0.04 * (1 - w) * k, -0.02 * (1 - w) * k, 0)
    })
    kit.place(st, COUCH.top + 0.004, this.body.quaternion)
  }

  /** Light up these structures of one leg in the X-ray view (none: all dark). */
  private light(names: string[], side: Side) {
    for (const m of this.anatomy) {
      const [, name, s] = m.name.match(/^xray-(.+)-(R|L)$/) ?? []
      const on = s === side && names.includes(name)
      const mat = m.material as THREE.MeshStandardMaterial
      if (on) mat.emissive.set('#ffae00')
      else mat.emissive.copy(mat.color)
      mat.emissiveIntensity = on ? 1 : 0.25
    }
  }

  /** Finish the manoeuvre being shown: hands off, the limb back where it rests, back on the couch. */
  private endAct() {
    const a = this.act
    if (!a) return
    this.touches = []
    this.present = null
    this.tibia = { L: 0, R: 0 }
    if (a.anim.startsWith('pose:') || a.anim === 'stretch') this.hands[a.side].want = 0
    if (!a.leg && (a.anim.startsWith('pose:') || HANDS_ON.has(a.anim))) this.held[`shoulderflex-${a.side}`] = a.lift0
    if (a.anim.startsWith('elbow')) this.held[`elbow-${a.side}`] = this.restElbow[a.side]
    // The leg goes back to how she keeps it.
    if (a.leg) for (const key of ['knee', 'hipflex', 'hiprot', 'ankle']) delete this.held[`${key}-${a.side}`]
    if (a.back) this.setPosture(a.back, 0.8)
    if (a.anim === 'rotate-head') delete this.held.neckyaw
    if (a.anim === 'tone-leg') for (const key of [`hiprot-${a.side}`, `ankle-${a.side}`]) delete this.held[key]
    if (['finger-nose', 'grip', 'acuity'].includes(a.anim)) for (const s of SIDES) this.hands[s].want = 0
    if (a.anim.startsWith('ask:')) this.motion = null
    if (['rapid-alt', 'tone-arm', 'sit-trunk', 'grip'].includes(a.anim))
      for (const key of Object.keys(this.held)) if (/^(shoulderflex|shoulderabd|shoulderrot|elbow|wrist)-(R|L)$/.test(key)) delete this.held[key]
    this.reachFrom.clear()
    this.lean = 0
    if (this.arc) this.arc.visible = false
    // A whole fit shown: everything on, the hands off.
    if (a.anim === 'collar-all') this.kitState = { mils: 0, earR: 0, earL: 0, collar: { ...COLLAR_ON }, blockR: 1, blockL: 1, tapeF: 1, tapeC: 1 }
    else if ((COLLAR_STEPS as readonly string[]).includes(a.anim)) this.finishStep(a.anim as CollarStep)
    this.light([], a.side)
    this.eyes.distress = 0
    this.eyes.squint = 0
    this.act = null
  }

  /**
   * Where the camera watches a leg manoeuvre from: the knee from her other side (your arms come from this one), the
   * whole leg as it bends or lifts, both knees from the end of the couch, a spot under one hand face on. Null (not a
   * leg): close in on the examiner's hand.
   */
  private shotFor(anim: Anim, site: string | null, side: Side) {
    const R = this.rig
    const neck = this.neckShot(anim, side)
    if (neck) return neck
    if (!R || !site || !onLeg(site)) return null
    const q = this.body.quaternion
    const U = v(0, 1, 0).applyQuaternion(q)
    const F = v(0, 0, 1).applyQuaternion(q)
    const RT = v(-1, 0, 0).applyQuaternion(q)
    const at = (o: THREE.Object3D) => o.getWorldPosition(v(0, 0, 0))
    // You stand at her right, your arms coming from there: the camera watches from her other side, high enough to see
    // the right leg over the left one.
    const fromSide = (lift: number, toFeet: number) => RT.clone().negate().addScaledVector(F, side === 'R' ? lift + 0.35 : lift).addScaledVector(U, -toFeet)
    switch (anim) {
      case 'inspect':
        // From the end of the couch, high enough to see both knees over the feet.
        return { target: () => at(R.calf.L).add(at(R.calf.R)).multiplyScalar(0.5), dir: U.clone().negate().multiplyScalar(0.75).addScaledVector(F, 1.3).addScaledVector(RT, 0.25), dist: 1.05 }
      case 'patellar-tap':
      case 'stress':
        return { target: () => at(R.calf[side]), dir: fromSide(0.6, 0.2), dist: 0.85 }
      case 'lachman':
      case 'drawer':
        // Lower and closer, to see the shin move on the thigh.
        return { target: () => at(R.calf[side]), dir: fromSide(0.25, 0.1), dist: 0.55 }
      case 'knee-bend':
      case 'knee-passive':
      case 'slr':
      case 'hip-roll':
      case 'tone-leg':
        return { target: () => at(R.calf[side]).lerp(at(R.thigh[side]), 0.35), dir: fromSide(0.45, 0.1), dist: 1.4 }
      case 'foot-up':
        return { target: () => at(R.foot[side]), dir: fromSide(0.5, 0.6), dist: 0.7 }
      default: {
        // One hand on the leg: the spot face on, from a little above and toward the feet, far enough back to see the
        // hand and what is round it.
        const spot = this.spotNow(site)
        if (!spot) return null
        const dir = spot.n.clone().addScaledVector(F, 0.6).addScaledVector(U, -0.35).normalize()
        // Never from under the couch (a spot behind the ankle faces down).
        if (dir.dot(F) < 0.5) dir.addScaledVector(F, 0.5 - dir.dot(F))
        return { target: () => this.siteWorld(site), dir, dist: 0.95 }
      }
    }
  }

  /**
   * The neck and the head: the head from above (hands holding it, earrings, blocks and tape); the neck from her right
   * as the collar is measured, goes behind and comes round; the collar in the hands while it is sized; the back of the
   * neck from behind; the head turning from in front.
   */
  private neckShot(anim: Anim, side: Side = 'R'): { target: () => THREE.Vector3 | null; dir: THREE.Vector3; dist: number } | null {
    const R = this.rig
    if (!R) return null
    const q = this.body.quaternion
    const U = v(0, 1, 0).applyQuaternion(q)
    const F = v(0, 0, 1).applyQuaternion(q)
    const RT = v(-1, 0, 0).applyQuaternion(q)
    const at = (o: THREE.Object3D) => o.getWorldPosition(v(0, 0, 0))
    const neck = () => at(R.neck).lerp(at(R.head), 0.5)
    switch (anim) {
      case 'mils':
      case 'jewellery':
        return { target: () => at(R.head).lerp(at(R.neck), 0.4), dir: RT.clone().multiplyScalar(0.2).addScaledVector(F, 1).addScaledVector(U, 0.3), dist: 0.8 }
      case 'blocks':
        return { target: () => at(R.head).lerp(at(R.neck), 0.3), dir: RT.clone().multiplyScalar(0.45).addScaledVector(F, 1).addScaledVector(U, 0.2), dist: 0.85 }
      case 'measure':
        return { target: neck, dir: RT.clone().addScaledVector(F, 0.5).addScaledVector(U, 0.15), dist: 0.7 }
      case 'size': {
        const kit = this.kit
        // Square on to its plastic face, held up in the hands.
        return { target: () => (kit ? kit.collar.grip(118, 0.45).at : neck()), dir: RT.clone().multiplyScalar(0.78).addScaledVector(F, 0.62).addScaledVector(U, 0.05), dist: 0.52 }
      }
      case 'collar-back':
        // From above her left shoulder (your arms come from the other side): the collar held open round the neck, the
        // rear panel going in under it and the tail showing on this side.
        return { target: neck, dir: RT.clone().multiplyScalar(-0.75).addScaledVector(F, 1).addScaledVector(U, -0.3), dist: 0.8 }
      case 'collar-front':
        // From the foot end, above the chest: the front coming round under the chin, the tail fastened on her left.
        return { target: neck, dir: RT.clone().multiplyScalar(-0.3).addScaledVector(F, 1).addScaledVector(U, -0.85), dist: 0.75 }
      case 'fit':
        return { target: neck, dir: RT.clone().multiplyScalar(-0.45).addScaledVector(F, 1).addScaledVector(U, 0.1), dist: 0.6 }
      case 'collar-all':
        return this.neckShot('measure')
      // The cerebellar examination.
      case 'speech':
        return { target: () => this.eyesAt()?.addScaledVector(U, -0.05 * this.scale) ?? at(R.head), dir: F.clone().addScaledVector(RT, 0.55).addScaledVector(U, 0.05), dist: 0.5 }
      case 'eyes-h':
        // From the foot of the bed, above: her eyes, and your finger above them moving clear of the line of sight.
        // Sitting up: from in front, a little to his right.
        if (this.posture !== 'supine') return { target: () => this.eyesAt()?.addScaledVector(F, 0.15 * this.scale) ?? at(R.head), dir: F.clone().addScaledVector(RT, 0.45).addScaledVector(U, 0.12), dist: 0.8 }
        return { target: () => this.eyesAt()?.addScaledVector(F, 0.17 * this.scale) ?? at(R.head), dir: F.clone().addScaledVector(U, -0.55).addScaledVector(RT, 0.08), dist: 0.85 }
      case 'finger-nose':
        // Her face, the arm reaching up, your finger above: the right arm from her left; the left arm from the foot of
        // the bed (your arm comes from her right).
        return side === 'R'
          ? { target: () => at(R.neck).addScaledVector(F, 0.24 * this.scale).addScaledVector(U, -0.04 * this.scale), dir: RT.clone().multiplyScalar(-1).addScaledVector(F, 0.45).addScaledVector(U, -0.3), dist: 1.15 }
          : { target: () => at(R.neck).addScaledVector(F, 0.24 * this.scale).addScaledVector(U, -0.06 * this.scale), dir: F.clone().multiplyScalar(0.55).addScaledVector(U, -1).addScaledVector(RT, -0.25), dist: 1.25 }
      case 'rapid-alt':
        return { target: () => at(R.hips).addScaledVector(F, 0.05 * this.scale), dir: F.clone().addScaledVector(RT, 0.35).addScaledVector(U, 0.25), dist: 0.85 }
      case 'tone-arm':
        // From above, toward her feet: the arm bending up, your arms coming in from her right out of the way.
        return { target: () => at(R.forearm[side]).addScaledVector(F, 0.08 * this.scale), dir: F.clone().addScaledVector(U, -0.6).addScaledVector(RT, side === 'R' ? 0.2 : -0.3), dist: 0.95 }
      case 'heel-shin':
        // From the other side: the shin the heel runs down is nearest, the leg doing it beyond.
        return { target: () => at(R.calf.R).lerp(at(R.calf.L), 0.5).addScaledVector(F, 0.1 * this.scale), dir: RT.clone().multiplyScalar(side === 'R' ? -0.9 : 0.9).addScaledVector(F, 0.85).addScaledVector(U, -0.35), dist: 1.45 }
      case 'sit-trunk':
        return { target: () => at(R.chest), dir: v(1, 0.35, 0.4), dist: 1.6 }
      // The cranial nerves: the face from in front and a little to his right (your side); the left ear from his left.
      case 'acuity':
      case 'fields-hand':
      case 'torch-eyes':
      case 'clench':
      case 'look-mouth':
      case 'ask:raise-eyebrows':
      case 'ask:close-eyes':
      case 'ask:show-teeth':
      case 'ask:puff-cheeks':
      case 'ask:open-mouth':
        return anim === 'fields-hand'
          ? { target: () => this.eyesAt()?.addScaledVector(F, 0.25 * this.scale) ?? at(R.head), dir: RT.clone().addScaledVector(F, 0.35).addScaledVector(U, 0.15), dist: 0.95 }
          : { target: () => this.eyesAt()?.addScaledVector(U, -0.03 * this.scale) ?? at(R.head), dir: F.clone().addScaledVector(RT, 0.3).addScaledVector(U, 0.08), dist: 0.55 }
      case 'face-touch':
        return { target: () => this.eyesAt()?.addScaledVector(U, -0.03 * this.scale) ?? at(R.head), dir: F.clone().multiplyScalar(0.8).addScaledVector(RT, side === 'L' ? -0.6 : 0.6).addScaledVector(U, 0.1), dist: 0.6 }
      case 'whisper':
      case 'weber':
        return { target: () => this.eyesAt()?.addScaledVector(U, -0.02 * this.scale) ?? at(R.head), dir: F.clone().addScaledVector(U, 0.1), dist: 0.75 }
      case 'parotid':
      case 'otoscope':
      case 'fork': {
        // The ear and the mastoid side on, from a little in front (you stand beside him, a little behind).
        const head = () => this.siteWorld(`ear-${side}`) ?? at(R.head)
        return { target: head, dir: RT.clone().multiplyScalar(side === 'L' ? -1 : 1).addScaledVector(F, 0.45).addScaledVector(U, 0.1), dist: 0.55 }
      }
      case 'ask:shrug':
      case 'ask:arms-out':
        return { target: () => at(R.chest).addScaledVector(U, 0.05 * this.scale), dir: F.clone().addScaledVector(RT, 0.35).addScaledVector(U, 0.15), dist: 1.35 }
      case 'grip':
        // Her right hand round your fingers (the left the same, beyond).
        return { target: () => this.siteWorld('palm-R') ?? at(R.hips), dir: RT.clone().addScaledVector(F, 0.9).addScaledVector(U, -0.15), dist: 0.75 }
      case 'midline':
        return { target: () => at(R.neck).lerp(at(R.head), 0.4), dir: F.clone().negate().addScaledVector(RT, 0.55).addScaledVector(U, 0.25), dist: 0.6 }
      case 'rotate-head':
        return { target: () => at(R.head), dir: F.clone().addScaledVector(U, 0.75), dist: 0.75 }
      default:
        return null
    }
  }

  /** A collar step done: its part on (the blocks and tape, and the hands come off). */
  private finishStep(step: CollarStep) {
    const st = kitBefore(step)
    if (step === 'mils') st.mils = 1
    if (step === 'jewellery') Object.assign(st, { earR: 0, earL: 0 })
    if (step === 'size') Object.assign(st.collar, { out: 1, preform: 1 })
    if (step === 'collar-back') Object.assign(st.collar, { approach: 1, feed: 1 })
    if (step === 'collar-front') Object.assign(st.collar, { wrap: 1, fasten: 1 })
    if (step === 'blocks') Object.assign(st, { blockR: 1, blockL: 1, tapeF: 1, tapeC: 1, mils: 0 })
    this.kitState = st
  }

  /** The bone a leg landmark rides on, from it toward the next joint down (thigh to knee, shin to ankle…). */
  private limbAxis(site: string): THREE.Vector3 {
    const R = this.rig
    const bone = this.anchors.get(site)?.parent
    if (R && bone)
      for (const s of SIDES)
        for (const [a, b] of [
          [R.thigh[s], R.calf[s]],
          [R.calf[s], R.foot[s]],
          [R.foot[s], R.toe[s]],
        ] as const)
          if (bone === a && b) return b.getWorldPosition(v(0, 0, 0)).sub(a.getWorldPosition(v(0, 0, 0))).normalize()
    return v(1, 0, 0)
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

  /** The shown manoeuvre, frame by frame: the examiner's hands in and out, the skin's colour, the joint that moves. */
  private updateAct(dt: number) {
    const R = this.rig
    const a = this.act
    // Hand shapes ease in and out.
    for (const side of SIDES) {
      const h = this.hands[side]
      h.w += Math.sign(h.want - h.w) * Math.min(Math.abs(h.want - h.w), dt * 3.5)
    }
    let pale = { fingersL: 0, handL: 0, fingersR: 0, handR: 0 }
    this.touches = []
    this.reachTo = { arm: {}, leg: {} }
    if (R && a) {
      a.t += dt * a.speed
      const k = a.t / a.dur
      const into = Math.min(1, a.t / 0.45)
      const out = Math.min(1, Math.max(0, (a.dur - a.t) / 0.45))
      const gap = 0.14 * (1 - Math.min(into, out))
      // Hands on: the examiner's hand, placed once the body is posed (see `placeExaminer`); his arm is lifted off his lap
      // and the hand turned so the spot faces you.
      const show = (grip: Grip, contact: Contact, extra = 0, stroke = 0) => {
        if (a.site) this.touches.push({ grip, contact, gap: gap + extra, stroke, site: a.site })
      }
      const env = smooth(Math.min(into, out))
      if (HANDS_ON.has(a.anim) && a.site && !a.leg) {
        this.held[`shoulderflex-${a.side}`] = a.lift0 + (40 - a.lift0) * env
        this.present = { side: a.side, site: a.site, w: env }
      }
      const s = a.side
      /** 0 before `from`, 1 after `to`, eased between. */
      const ramp = (from: number, to: number) => smooth(Math.max(0, Math.min(1, (a.t - from) / (to - from))))
      /** A hand on between `from` and `to`, easing on and off over 0.4 s. */
      const on = (from: number, to: number) => smooth(Math.max(0, Math.min(1, (a.t - from) / 0.4, (to - a.t) / 0.4)))
      /** `n` pushes or tugs between `from` and `to` (0 … 1 each). */
      const pulses = (from: number, to: number, n: number) => (a.t < from || a.t > to ? 0 : (0.5 - 0.5 * Math.cos(((a.t - from) / (to - from)) * Math.PI * 2 * n)) ** 2)
      /** A hand of the examiner's on a landmark of this leg, `w` of the way on. */
      const grip = (site: string, g: Grip, contact: Contact, w: number, extra = 0, more: Partial<Touch> = {}) => {
        if (w > 0.02) this.touches.push({ grip: g, contact, gap: 0.14 * (1 - w) + extra, stroke: 0, site: `${site}-${s}`, ...more })
      }
      /** The knee bent so far, the heel on the couch (the hip bends half as much). */
      const bend = (deg: number) => {
        this.held[`knee-${s}`] = deg
        this.held[`hipflex-${s}`] = deg / 2
      }
      const swollen = this.signs.effusion === s
      const sore = (site: string | null) => !!site && (this.signs.tender ?? []).includes(site)
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
        case 'walk':
          // Back to the couch in time to lie down before the end.
          if (a.back && a.t >= a.dur - 0.9) {
            this.setPosture(a.back, 0.8)
            a.back = undefined
          }
          break
        case 'patellar-tap':
          // The left hand slides down the thigh, emptying the pouch into the joint, and stays; the right index taps the
          // kneecap down onto the femur.
          grip('suprapatellar', 'flat', 'palm', on(0, 4), 0, { left: true, stroke: -0.05 * (1 - ramp(0.4, 1.4)) })
          grip('patella', 'press', 'index', on(1.4, 3.8), 0.012 * (1 - pulses(1.7, 3.5, 3)))
          break
        case 'joint-line': {
          // The knee bent up; a fingertip runs along the joint line.
          bend(lerp(a.k0, 70, ramp(0, 0.9)) + (a.k0 - 70) * ramp(2.9, 3.7))
          const w = on(0.9, 2.9)
          if (a.site && w > 0.02) this.touches.push({ grip: 'press', contact: 'index', gap: 0.14 * (1 - w), stroke: 0.015 * Math.sin((a.t - 0.9) * Math.PI * 1.5), site: a.site, across: true })
          if (sore(a.site)) this.eyes.distress = w
          break
        }
        case 'bone': {
          const press = pulses(0.5, 2.2, 2)
          show('press', 'index', 0.008 * (1 - press))
          if (sore(a.site)) this.eyes.distress = press
          break
        }
        case 'knee-bend':
        case 'knee-passive': {
          // Up as far as it goes (not far, with a tense effusion), straight, and back to where it rests.
          const max = swollen ? 80 : 130
          const lag = a.anim === 'knee-passive' ? 0.3 : 0
          const knee =
            a.t < 2.8 + lag ? lerp(a.k0, max, ramp(0.2 + lag, 2.2 + lag)) : a.t < 4.2 + lag ? lerp(max, 0, ramp(2.8 + lag, 4 + lag)) : lerp(0, a.k0, ramp(4.2 + lag, 5 + lag))
          bend(knee)
          if (swollen) this.eyes.distress = Math.max(0, Math.min(1, (knee - max + 20) / 20))
          if (a.anim === 'knee-passive') {
            // A hand on the kneecap for crepitus, the other holding the ankle.
            grip('patella', 'flat', 'palm', on(0, 5.6), 0.004, { left: true })
            grip('lateralmalleolus', 'cup', 'palm', on(0, 5.6))
          }
          break
        }
        case 'slr': {
          // Straighten the knee, lift the straight leg, put it down, rest it bent again.
          const lift = 50 * (ramp(0.4, 1.7) - ramp(2.3, 3.4))
          const rest = 1 - ramp(0, 0.4) + ramp(3.4, 3.8)
          this.held[`knee-${s}`] = a.k0 * rest
          this.held[`hipflex-${s}`] = a.h0 * rest + lift
          if (swollen) this.eyes.distress = 0.35 * (lift / 50)
          break
        }
        case 'lachman':
          // At 20–30°: the left hand steadies the thigh, the right draws the shin forward, twice. A torn ACL lets it come
          // a centimetre, with a soft end; an intact one a few millimetres, then a firm stop.
          bend(lerp(a.k0, 25, ramp(0, 0.8)) + (a.k0 - 25) * ramp(4, 4.6))
          grip('suprapatellar', 'cup', 'palm', on(0.6, 4.2), 0, { left: true })
          grip('tibialtub', 'cup', 'palm', on(0.8, 4.2))
          this.tibia[s] = (this.signs.acl === s ? 0.013 : 0.003) * pulses(1.4, 3.6, 2) * this.scale
          break
        case 'drawer': {
          // Bent as far as he can; a look along the shin for a sag; then both hands round the top of the shin push it back.
          const flex = swollen ? 80 : 90
          bend(lerp(a.k0, flex, ramp(0, 1.2)) + (a.k0 - flex) * ramp(4.6, 5.4))
          grip('lateraltibia', 'cup', 'palm', on(2.2, 4.4), 0, { left: true })
          grip('medialtibia', 'cup', 'palm', on(2.2, 4.4))
          this.tibia[s] = -0.0015 * pulses(2.7, 4.1, 2) * this.scale
          break
        }
        case 'stress': {
          // At 30°, then straight: the knee pushed in (valgus) with the ankle drawn out, then the other way (varus).
          bend(a.t < 3 ? lerp(a.k0, 30, ramp(0, 0.6)) : a.t < 5.6 ? lerp(30, 0, ramp(3, 3.5)) : lerp(0, a.k0, ramp(5.6, 6)))
          const valgus = Math.max(on(0.6, 1.8), on(3.5, 4.6))
          const varus = Math.max(on(1.8, 3), on(4.6, 5.7))
          const push = -0.003 * (pulses(0.8, 1.6, 1) + pulses(2, 2.8, 1) + pulses(3.7, 4.4, 1) + pulses(4.8, 5.5, 1))
          // The leg taken a little out to the side, so your hand fits between the knees; the ankle held throughout; the
          // hand at the knee goes over the top of it from one side to the other.
          this.held[`hipabd-${s}`] = 16 * (ramp(0, 0.6) - ramp(5.6, 6))
          grip('ankle', 'cup', 'palm', on(0.6, 5.7))
          if (valgus > 0.5) grip('lateraljoint', 'flat', 'palm', valgus, push, { left: true })
          else if (varus > 0.5) grip('medialjoint', 'flat', 'palm', varus, push, { left: true })
          else if (a.t > 0.6 && a.t < 5.7) grip('patella', 'flat', 'palm', 1, 0.07, { left: true })
          break
        }
        case 'foot-up':
          this.held[`ankle-${s}`] = -18 * (ramp(0.3, 1) - ramp(1.3, 1.7)) + 30 * (ramp(1.8, 2.4) - ramp(2.6, 3.1))
          break
        case 'hip-roll': {
          // Both hands flat on the leg, rolling it in and out: the hip turns.
          const w = on(0, 3.8)
          grip('thigh', 'flat', 'palm', w, 0, { left: true })
          grip('shin', 'flat', 'palm', w)
          this.held[`hiprot-${s}`] = 22 * Math.sin(Math.max(0, a.t - 0.6) * Math.PI * 1.4) * (ramp(0.4, 0.9) - ramp(3, 3.5))
          break
        }
        case 'tone-leg': {
          // Rolled to and fro through the trousers, both hands flat on the leg; a floppy leg lets the foot flop over
          // further than the roll.
          const w = on(0, a.dur)
 if (w > 0.02)
            for (const [i, site] of [
              [1, 'thigh'],
              [0, 'shin'],
            ] as const) {
              const sp = this.spotNow(`${site}-${s}`)
              if (sp) this.touches.push({ grip: 'flat', contact: 'palm', gap: 0.14 * (1 - w), stroke: 0, site: `${site}-${s}`, hand: i, from: 'above', spot: () => ({ at: sp.at, n: sp.n, along: sp.n.clone() }) })
            }
          const roll = Math.sin(Math.max(0, a.t - 0.5) * Math.PI * 1.5) * (ramp(0.3, 0.8) - ramp(a.dur - 0.7, a.dur - 0.2))
          this.held[`hiprot-${s}`] = 22 * roll
          if (this.signs.ataxia === s) this.held[`ankle-${s}`] = 14 * Math.sin(Math.max(0, a.t - 0.75) * Math.PI * 1.5) * (ramp(0.3, 0.8) - ramp(a.dur - 0.7, a.dur - 0.2))
          break
        }
        case 'mils':
        case 'jewellery':
        case 'measure':
        case 'size':
        case 'collar-back':
        case 'collar-front':
        case 'fit':
        case 'blocks':
          this.collarStep(a.anim, a.t, a.dur)
          break
        case 'collar-all': {
          // The whole fit, start to finish: each step in its slot, filmed as that step is.
          const slot = COLLAR_SLOTS.find(([, t0, t1]) => a.t >= t0 && a.t < t1) ?? COLLAR_SLOTS[COLLAR_SLOTS.length - 1]
          if (this.slotShown !== slot[0]) {
            this.slotShown = slot[0]
            this.shot = this.neckShot(slot[0])
          }
          this.collarStep(slot[0], Math.min(slot[2] - slot[1], a.t - slot[1]), slot[2] - slot[1])
          break
        }
        case 'speech':
          // Said aloud (see faceAt for the mouth).
          break
        case 'eyes-h': {
          // Your index finger held up in front of her eyes, moved in an H; her eyes follow it (see faceAt).
          const w = on(0, a.dur)
          const g = gazePath(a.t, a.dur)
          const at = this.fingerPoint(g.h, g.v, 0.38 * this.scale)
          const eyes = this.eyesAt()
          if (at && eyes && w > 0.02) {
            const head = this.headAxes()
            this.touches.push({ grip: 'press', contact: 'index', gap: 0.14 * (1 - w), stroke: 0, site: 'eye-R', spot: () => ({ at, n: at.clone().sub(eyes).normalize(), along: head.up.clone() }) })
          }
          break
        }
        case 'finger-nose':
          this.fingerNose(a.side, a.t, a.dur)
          break
        case 'rapid-alt': {
          // Fingers on the front of each thigh near the hip, patting it, front then back (the turn is in applyPose).
          const e = smooth(Math.min(1, a.t / 0.45, (a.dur - a.t) / 0.45))
          const F = v(0, 0, 1).applyQuaternion(this.body.quaternion)
          for (const side of SIDES) {
            const key = `pulp-${side}`
            if (!this.reachFrom.has(key)) {
              const p0 = this.siteWorld(key)
              if (p0) this.reachFrom.set(key, p0)
            }
            const rest = this.reachFrom.get(key)
            if (!rest) continue
            const hip = R.thigh[side].getWorldPosition(v(0, 0, 0))
            const knee = R.calf[side].getWorldPosition(v(0, 0, 0))
            const pat = Math.abs(Math.sin(a.t * Math.PI * 2 * (this.signs.ataxia === side ? 1.25 : 2.5)))
            const onThigh = hip.lerp(knee, 0.42).addScaledVector(F, (0.085 + 0.025 * pat) * this.scale)
            const out = v(side === 'R' ? -1 : 1, 0, 0).applyQuaternion(this.body.quaternion)
            this.reachTo.arm[side] = { at: rest.clone().lerp(onThigh, e), pole: out.clone().addScaledVector(F, -0.2) }
          }
          break
        }
        case 'tone-arm': {
          // One hand round her wrist, the other over the front of the elbow: bend and straighten it, rolling the wrist. A
          // floppy arm (the side of the lesion) lets the hand flop about at the wrist.
          const w = on(0, a.dur)
          const floppy = this.signs.ataxia === s
          this.held[`elbow-${s}`] = this.restElbow[s] + (95 - this.restElbow[s]) * (0.5 - 0.5 * Math.cos(Math.max(0, a.t - 0.4) * Math.PI * 1.2)) * w
          this.held[`wrist-${s}`] = (floppy ? 38 : 12) * Math.sin(Math.max(0, a.t - 0.55) * Math.PI * 1.2) * w
          // Palms down on top of her wrist and of her elbow, fingers across the arm, each arm coming from your shoulder
          // (never along the raised forearm, its sleeve down into the couch).
          // One hand holds his wrist from the outer side; the other rests on his upper arm just above the elbow (which
          // stays on the bed while the forearm comes up).
          const outward = v(s === 'R' ? -1 : 1, 0, 0).applyQuaternion(this.body.quaternion)
          const wristSide = (): Spot => {
            const wr = R.hand[s].getWorldPosition(v(0, 0, 0)).lerp(R.forearm[s].getWorldPosition(v(0, 0, 0)), 0.12)
            return { at: wr.addScaledVector(outward, 0.028 * this.scale), n: outward.clone(), along: v(0, 1, 0) }
          }
          // The outer side of the arm just above the elbow, the fingers toward the shoulder: the forearm comes up clear of it.
          const aboveElbow = (): Spot => {
            const sh = R.upperArm[s].getWorldPosition(v(0, 0, 0))
            const el = R.forearm[s].getWorldPosition(v(0, 0, 0))
            const n = outward.clone().addScaledVector(v(0, 1, 0), 0.35).normalize()
            return { at: sh.clone().lerp(el, 0.7).addScaledVector(n, 0.04 * this.scale), n, along: sh.sub(el).normalize() }
          }
          if (w > 0.02) {
            this.touches.push({ grip: 'cup', contact: 'palm', gap: 0.14 * (1 - w), stroke: 0, site: `wrist-${s}`, hand: 0, from: 'above', spot: wristSide })
            this.touches.push({ grip: 'flat', contact: 'palm', gap: 0.14 * (1 - w), stroke: 0, site: `antecubital-${s}`, hand: 1, from: 'above', spot: aboveElbow })
          }
          break
        }
        case 'heel-shin':
          this.heelShin(a.side, a.t, a.dur)
          break
        case 'sit-trunk': {
          // Sat up, arms folded, nothing to hold: she sways, and leans over to the side of the lesion; your hand is there
          // to catch her shoulder. Then back down.
          if (a.t < 0.1 && this.posture !== 'sitting') {
            a.back = this.posture
            this.setPosture('sitting', 1.1)
          }
          const e = smooth(Math.min(1, a.t / 0.9, (a.dur - a.t) / 0.7))
          // Arms folded: the forearms across the chest, one over the other.
          for (const side of SIDES) {
            this.held[`shoulderflex-${side}`] = 22 * e
            this.held[`shoulderabd-${side}`] = 6 * e
            this.held[`shoulderrot-${side}`] = (side === 'R' ? 80 : 72) * e
            this.held[`elbow-${side}`] = 100 * e
          }
          const toward = this.signs.ataxia === 'L' ? -1 : this.signs.ataxia === 'R' ? 1 : 0
          const sway = ramp(1.2, 2) * (toward * (10 + 12 * ramp(2.6, 3.4) - 9 * ramp(3.7, 4.3)) + 4 * Math.sin(a.t * Math.PI * 1.3)) * (1 - ramp(a.dur - 1.2, a.dur - 0.5))
          this.lean = sway
          const catchW = on(2.5, a.dur - 1.1)
          if (toward && catchW > 0.02) this.touches.push({ grip: 'flat', contact: 'palm', gap: 0.14 * (1 - catchW) + 0.02 * (1 - ramp(3.2, 3.6)), stroke: 0, site: `shoulder-${toward > 0 ? 'R' : 'L'}`, along: [1, 0, 0] })
          if (a.back && a.t >= a.dur - 0.8) {
            this.setPosture(a.back, 0.8)
            a.back = undefined
          }
          break
        }
        case 'acuity': {
          // The eye not being read covered with her own palm, the fingers on her forehead; then the other.
          const first: Side = a.site?.endsWith('-L') ? 'R' : 'L'
          const cover: Side = a.t < a.dur / 2 ? first : first === 'R' ? 'L' : 'R'
          const eye = this.siteWorld(`eye-${cover}`)
          const head = this.headAxes()
          const key = `palm-${cover}`
          if (!this.reachFrom.has(key)) {
            const p0 = this.siteWorld(key)
            if (p0) this.reachFrom.set(key, p0)
          }
          const rest = this.reachFrom.get(key)
          const half = a.dur / 2
          const local = a.t < half ? a.t : a.t - half
          const e = smooth(Math.max(0, Math.min(1, local / 0.45, (half - local) / 0.45)))
          if (eye && rest) {
            const out = v(cover === 'R' ? -1 : 1, 0, 0).applyQuaternion(this.body.quaternion)
            // The palm cupped just in front of the eye.
            const over = eye.addScaledVector(head.face, 0.035 * this.scale)
            this.reachTo.arm[cover] = { at: rest.clone().lerp(over, e), pole: out.clone().addScaledVector(head.up, -0.6), tip: 'palm' }
          }
          this.hands[cover] = { name: 'extended', w: this.hands[cover].name === 'extended' ? this.hands[cover].w : 0, want: 1 }
          break
        }
        case 'fields-hand': {
          // Your finger held out at arm's length between you, wiggled in each quarter of her field in turn.
          const w = on(0, a.dur)
          // Each quarter held, then a glide to the next.
          const u = Math.min(3.999, (a.t / a.dur) * 4)
          const quad = Math.floor(u)
          const glide = smooth(Math.max(0, Math.min(1, (u - quad - 0.7) / 0.3)))
          const corner = (q: number) => ({ h: q % 2 ? 38 : -38, v: q < 2 ? 24 : -24 })
          const c0 = corner(quad)
          const c1 = corner(Math.min(3, quad + 1))
          const at = this.fingerPoint(c0.h + (c1.h - c0.h) * glide, c0.v + (c1.v - c0.v) * glide, 0.55 * this.scale)
          const eyes = this.eyesAt()
          if (at && eyes && w > 0.02) {
            const head = this.headAxes()
            const wiggle = 0.008 * this.scale * Math.sin(a.t * Math.PI * 2 * 3)
            this.touches.push({ grip: 'press', contact: 'index', gap: 0.14 * (1 - w), stroke: 0, site: 'eye-R', spot: () => ({ at: at.clone().addScaledVector(head.up, wiggle), n: at.clone().sub(eyes).normalize(), along: head.up.clone() }) })
          }
          break
        }
        case 'torch-eyes': {
          // A pen torch brought in from the side to each eye in turn, a hand's breadth away.
          const w = on(0, a.dur)
          const eR = this.siteWorld('eye-R')
          const eL = this.siteWorld('eye-L')
          if (eR && eL && w > 0.02) {
            const head = this.headAxes()
            const fromR = head.face.clone().multiplyScalar(0.9).addScaledVector(head.right, 0.45).normalize()
            const fromL = head.face.clone().multiplyScalar(0.9).addScaledVector(head.right, -0.45).normalize()
            const atR = eR.clone().addScaledVector(fromR, 0.09 * this.scale)
            const atL = eL.clone().addScaledVector(fromL, 0.09 * this.scale)
            // Held at each eye; between, carried out in front of the nose and across.
            const f = smooth(Math.max(0, Math.min(1, (a.t / a.dur - 0.42) / 0.16)))
            const at = atR.clone().lerp(atL, f).addScaledVector(head.face, 0.1 * this.scale * Math.sin(Math.PI * f))
            const n = fromR.clone().lerp(fromL, f).normalize()
            this.touches.push({ grip: 'torch', contact: 'tool', gap: 0.14 * (1 - w), stroke: 0, site: f < 0.5 ? 'eye-R' : 'eye-L', spot: () => ({ at, n, along: head.up.clone() }) })
          }
          break
        }
        case 'face-touch':
        case 'pin-at':
        case 'parotid':
        case 'otoscope': {
          // Cotton wool dabbed on the face; two fingers pressing in front of the ear; the otoscope into the ear canal.
          const w = on(0, a.dur)
          const head = this.headAxes()
          const spot = a.site ? this.spotNow(a.site) : null
          if (spot && w > 0.02) {
            const dab = a.anim === 'face-touch' || a.anim === 'pin-at' ? 0.01 * Math.max(0, Math.sin(k * Math.PI * 4)) : 0
            const grip: Grip = a.anim === 'face-touch' ? 'cotton' : a.anim === 'pin-at' ? 'neurotip' : a.anim === 'otoscope' ? 'otoscope' : 'two-fingers'
            const contact: Contact = a.anim === 'parotid' ? 'fingertips' : 'tool'
            const ear = a.anim === 'parotid' || a.anim === 'otoscope'
            const lying = this.posture === 'supine'
            this.touches.push({ grip, contact, gap: 0.14 * (1 - w) + dab, stroke: 0, site: a.site!, hand: ear && a.site?.endsWith('-L') ? 1 : 0, from: ear ? 'behind' : lying ? 'above' : undefined, spot: () => ({ at: spot.at, n: spot.n, along: head.up.clone() }) })
          }
          break
        }
        case 'look-mouth': {
          // Mouth wide open (see faceAt), a torch shone in from in front.
          const w = on(0, a.dur)
          const mouth = this.siteWorld('mouth')
          if (mouth && w > 0.02) {
            const head = this.headAxes()
            const from = head.face.clone().addScaledVector(head.up, -0.25).addScaledVector(head.right, 0.2).normalize()
            const at = mouth.clone().addScaledVector(from, 0.1 * this.scale)
            this.touches.push({ grip: 'torch', contact: 'tool', gap: 0.14 * (1 - w), stroke: 0, site: 'mouth', spot: () => ({ at, n: from.clone(), along: head.up.clone() }) })
          }
          break
        }
        case 'clench': {
          // Fingers on both masseters as he clenches.
          const w = on(0, a.dur)
          if (w > 0.02)
            for (const [i, side] of [
              [0, 'R'],
              [1, 'L'],
            ] as const) {
              const spot = this.spotNow(`jaw-${side}`)
              const head = this.headAxes()
              if (spot) this.touches.push({ grip: 'two-fingers', contact: 'fingertips', gap: 0.14 * (1 - w), stroke: 0, site: `jaw-${side}`, hand: i, spot: () => ({ at: spot.at, n: spot.n, along: head.up.clone() }) })
            }
          break
        }
        case 'whisper': {
          // One ear at a time: your fingertip rubs the tragus of the other ear (masking it) while you whisper into this one.
          const w = on(0, a.dur / 2)
          const w2 = on(a.dur / 2, a.dur)
          const head = this.headAxes()
          for (const [ww, rub] of [
            [w, 'R'],
            [w2, 'L'],
          ] as const) {
            if (ww <= 0.02) continue
            const spot = this.spotNow(`ear-${rub}`)
            if (spot) this.touches.push({ grip: 'press', contact: 'index', gap: 0.14 * (1 - ww) + 0.003 * Math.abs(Math.sin(a.t * Math.PI * 2 * 4)), stroke: 0, site: `ear-${rub}`, hand: rub === 'R' ? 0 : 1, from: 'behind', spot: () => ({ at: spot.at, n: spot.n, along: head.up.clone() }) })
          }
          break
        }
        case 'fork':
        case 'weber': {
          // Rinne: the stem on the mastoid, then the prongs beside the ear canal. Weber: the stem on the forehead.
          const w = on(0, a.dur)
          const head = this.headAxes()
          const rinne = !!a.site?.startsWith('mastoid')
          const side = (a.site?.match(/-(R|L)$/)?.[1] ?? 'L') as Side
          const bone = a.site ? this.spotNow(a.site) : null
          const ear = this.spotNow(`ear-${side}`)
          if (bone && w > 0.02) {
            const moved = rinne && ear ? smooth(Math.max(0, Math.min(1, (a.t - a.dur * 0.45) / 0.4))) : 0
            const at = ear && moved > 0 ? bone.at.clone().lerp(ear.at.clone().addScaledVector(ear.n, 0.025 * this.scale), moved) : bone.at
            const n = ear && moved > 0 ? bone.n.clone().lerp(ear.n, moved).normalize() : bone.n
            this.touches.push({ grip: 'fork', contact: 'tool', gap: 0.14 * (1 - w), stroke: 0, site: a.site!, hand: rinne && side === 'L' ? 1 : 0, from: rinne ? 'behind' : undefined, spot: () => ({ at, n, along: head.up.clone() }) })
          }
          break
        }
        case 'ask:shrug': {
          // Your hands flat on top of his shoulders, pushing down as he shrugs up.
          const w = on(0.2, a.dur)
          if (w > 0.02)
            for (const [i, side] of [
              [0, 'R'],
              [1, 'L'],
            ] as const)
              this.touches.push({ grip: 'flat', contact: 'palm', gap: 0.14 * (1 - w), stroke: 0, site: `trapezius-${side}`, hand: i, along: [0, 1, 0] })
          break
        }
        case 'grip': {
          // He brings his forearms up off the bed, hands open toward you; then your two fingers go into each hand and he
          // squeezes them; your fingers come out before his arms go down.
          const w = on(0.5, a.dur - 0.5)
          const up = smooth(Math.max(0, Math.min(1, a.t / 0.5, (a.dur - a.t) / 0.5)))
          for (const side of SIDES) {
            this.held[`elbow-${side}`] = 85 * up
            this.held[`shoulderflex-${side}`] = 10 * up
            this.hands[side] = { name: 'fist', w: this.hands[side].name === 'fist' ? this.hands[side].w : 0, want: a.t > 0.9 && a.t < a.dur - 1 ? 0.55 : 0 }
          }
          if (w > 0.02)
            for (const [i, side] of [
              [0, 'R'],
              [1, 'L'],
            ] as const) {
              const sp = this.spotNow(`palm-${side}`)
              if (sp) this.touches.push({ grip: 'two-fingers', contact: 'fingertips', gap: 0.14 * (1 - w), stroke: 0, site: `palm-${side}`, hand: i, from: 'above', spot: () => ({ at: sp.at, n: sp.n, along: sp.n.clone() }) })
            }
          break
        }
        case 'midline': {
          // Two fingers walk down the spinous processes, from the base of the skull to the bottom of the neck.
          const w = on(0, 3)
          if (w > 0.02) this.touches.push({ grip: 'two-fingers', contact: 'fingertips', gap: 0.14 * (1 - w) + 0.004 * (1 - pulses(0.4, 2.6, 4)), stroke: 0.035 * this.scale * (ramp(0.4, 2.6) - 0.5), site: 'cspine', along: [-1, 0, 0] })
          break
        }
        case 'rotate-head': {
          // Left as far as it goes (45°), back, right, back: the arc shows how far.
          const yaw = -45 * (ramp(0.3, 1.1) - ramp(1.6, 2.2)) + 45 * (ramp(2.4, 3.2) - ramp(3.7, 4.3))
          this.held.neckyaw = yaw
          this.showArc(yaw)
          break
        }
        default:
          // Asked to do something with the hand, he lifts it up in front to show you.
          if (a.anim.startsWith('pose:')) this.held[`shoulderflex-${a.side}`] = a.lift0 + ((HANDS[this.hands[a.side].name]?.lift ?? 55) - a.lift0) * env
      }
      if (a.t >= a.dur) this.endAct()
    }
    // Someone holds the head in line (from the head end) until the blocks and tape are on: palms over the sides of the
    // head above the ears (the lobes left free); as each block comes in, that hand moves onto its top and holds it there.
    const hold = this.kitState.mils
    const kit = this.kit
    if (R && kit && hold > 0.02)
      for (const [i, s] of [
        [2, 'R'],
        [3, 'L'],
      ] as const) {
        const f = smooth(Math.max(0, Math.min(1, ((s === 'R' ? this.kitState.blockR : this.kitState.blockL) - 0.45) / 0.45)))
        const toFeet = v(0, -1, 0).applyQuaternion(this.body.quaternion)
        const temple = (): Spot | null => {
          const spot = this.spotNow(`temple-${s}`)
          return spot && { at: spot.at, n: spot.n, along: toFeet.clone() }
        }
        const spot = (): Spot | null => {
          const a = temple()
          const top = kit.blockSpot(s, 'top')
          if (!a || f <= 0 || !top) return a
          return between(a, { at: top.at, n: top.n, along: toFeet.clone() }, f)
        }
        this.touches.push({ grip: 'flat', contact: 'palm', gap: 0.14 * (1 - smooth(Math.min(1, hold))) + 0.025 * Math.sin(Math.PI * f), stroke: 0, site: `temple-${s}`, hand: i, spot })
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

  /**
   * One step of fitting the collar, `t` seconds into its `dur`: the parts before it already on, its own part coming on,
   * your hands doing it.
   */
  private collarStep(step: CollarStep, t: number, dur: number) {
    const kit = this.kit
    if (!kit) return
    const st = kitBefore(step)
    const c = st.collar
    const p = Math.max(0, Math.min(1, t / dur))
    const into = (a: number, b: number) => smooth(Math.max(0, Math.min(1, (p - a) / (b - a))))
    /** A hand on between `a` and `b` (fractions of the step), easing on and off over `e`. */
    const on = (a: number, b: number, e = 0.07) => smooth(Math.max(0, Math.min(1, (p - a) / e, (b - p) / e)))
    /** `n` presses between `a` and `b` (0 … 1 each). */
    const presses = (a: number, b: number, n: number) => (p < a || p > b ? 0 : (0.5 - 0.5 * Math.cos(((p - a) / (b - a)) * Math.PI * 2 * n)) ** 2)
    const q = this.body.quaternion
    const toFeet = v(0, -1, 0).applyQuaternion(q)
    /** A place on the collar: the plastic (or the foam) at `s` round it and `v` up it, the fingers that way along it. */
    const band = (s: number, vv: number, way: 'along' | 'back' | 'up' | 'down', plastic = true) => (): Spot => {
      const g = kit.collar.grip(s, vv, plastic)
      return { at: g.at, n: g.n, along: way === 'along' ? g.along : way === 'back' ? g.along.negate() : way === 'up' ? g.up : g.up.negate() }
    }
    /** A hand at a spot, `w` of the way on; gliding to another spot as `f` goes from 0 to 1, lifted a little on the way. */
    const hand = (i: number, w: number, a: () => Spot | null, grip: Grip = 'flat', contact: Contact = 'palm', extra = 0, b?: () => Spot | null, f = 0) => {
      if (w <= 0.02) return
      const spot = () => {
        const s0 = a()
        const s1 = b?.()
        return s0 && s1 && f > 0 ? between(s0, s1, f) : s0
      }
      this.touches.push({ grip, contact, gap: 0.14 * (1 - w) + extra + 0.03 * Math.sin(Math.PI * f), stroke: 0, site: 'neck', hand: i, spot })
    }
    /** A hand resting at each key's spot from its time on, gliding there over `glide` before it (the grip changing half way). */
    type Key = [number, () => Spot | null, Grip, Contact]
    const route = (i: number, w: number, keys: Key[], glide = 0.07, extra = 0) => {
      let j = 0
      while (j + 1 < keys.length && p >= keys[j + 1][0]) j++
      const next = keys[j + 1]
      const f = next ? smooth(Math.max(0, Math.min(1, (p - (next[0] - glide)) / glide))) : 0
      const now = next && f > 0.5 ? next : keys[j]
      hand(i, w, keys[j][1], now[2], now[3], extra, next?.[1], f)
    }
    switch (step) {
      case 'mils':
        st.mils = into(0, 0.6)
        break
      case 'jewellery':
        // A pinch at each lobe: the earrings come out, her right then her left.
        st.earR = 1 - into(0.24, 0.4)
        st.earL = 1 - into(0.68, 0.84)
        if (on(0.04, 0.5) > 0.02) this.touches.push({ grip: 'press', contact: 'index', gap: 0.14 * (1 - on(0.04, 0.5)), stroke: 0, site: 'ear-R', along: [-1, 0, 0] })
        if (on(0.5, 0.96) > 0.02) this.touches.push({ grip: 'press', contact: 'index', gap: 0.14 * (1 - on(0.5, 0.96)), stroke: 0, site: 'ear-L', hand: 1, along: [-1, 0, 0] })
        break
      case 'measure': {
        // Fingers flat on the side of the neck, stacked from the top of the shoulder up to the line of the chin.
        const w = on(0.04, 0.96, 0.15)
        if (w > 0.02) this.touches.push({ grip: 'flat', contact: 'palm', gap: 0.14 * (1 - w), stroke: 0, site: 'neckside-R', along: [0, 1, 0] })
        break
      }
      case 'size':
        // Out of the packet and held flat; the same fingers on it from the edge of the plastic to the size window; the
        // lock tab pressed each side; then bent round into shape.
        c.out = into(0, 0.12)
        c.preform = into(0.74, 0.96)
        hand(1, on(0, 1.1), band(316, 0.5, 'along'))
        route(
          0,
          on(0.14, 1.1),
          [
            [0, band(112, 0.2, 'back'), 'flat', 'palm'],
            [0.52, band(104, 0.68, 'along'), 'press', 'index'],
            [0.66, band(14, 0.68, 'along'), 'press', 'index'],
            [0.8, band(100, 0.5, 'along'), 'flat', 'palm'],
          ],
          0.07,
          0.004 * (presses(0.53, 0.6, 1) + presses(0.67, 0.74, 1)),
        )
        break
      case 'collar-back': {
        // Opened out and brought down beside the neck, tail first; the rear panel slid flat along the couch behind it
        // (the hand pushing it in) until the tail shows on her other side. The other hand keeps the front up.
        c.approach = into(0, 0.3)
        c.feed = into(0.32, 0.92)
        const front = c.feed > 0 ? 385 - (385 - 190) * smooth(c.feed) : 385
        hand(1, on(0, 1.1), band(62, 0.5, 'along'))
        hand(0, on(0, 1.1), band(Math.max(120, front - 85), 0.5, 'back'))
        break
      }
      case 'collar-front':
        // The chin support brought round and up under the chin, the side held in to the neck; then the front held in
        // place while the tail is pulled round over it and pressed down.
        c.wrap = into(0.02, 0.5)
        c.fasten = into(0.62, 0.88)
        route(1, on(0, 1.1), [
          [0, band(98, 0.55, 'along'), 'flat', 'palm'],
          [0.61, band(381, 0.5, 'along'), 'press', 'index'],
        ], 0.09)
        route(0, on(0, 1.1), [
          [0, band(128, 0.62, 'back'), 'flat', 'palm'],
          [0.58, band(96, 0.45, 'along'), 'flat', 'palm'],
        ], 0.09)
        break
      case 'fit':
        // A finger on the chin support (the chin sits in it), then along the jaw line: no gaps; the airway hole clear.
        route(
          0,
          on(0.04, 1.1),
          [
            [0, band(50, 0.92, 'along'), 'press', 'index'],
            [0.58, band(98, 0.86, 'along'), 'press', 'index'],
          ],
          0.12,
          0.004 * (presses(0.1, 0.4, 2) + presses(0.62, 0.92, 2)),
        )
        break
      case 'blocks': {
        // A block slid in along the couch each side; the hands at the head move onto them. Then tape: across the
        // forehead from block to block, then across the chin support; and only then do the hands come off.
        st.blockR = into(0.03, 0.28)
        st.blockL = into(0.1, 0.35)
        st.tapeF = into(0.42, 0.66)
        st.tapeC = into(0.7, 0.92)
        st.mils = 1 - into(0.94, 1)
        const block = (side: 'R' | 'L') => (): Spot | null => {
          const b = kit.blockSpot(side, 'out')
          return b && { at: b.at, n: b.n, along: toFeet.clone() }
        }
        const tape = (which: 'forehead' | 'chin') => (): Spot | null => {
          const e = kit.ends[which]
          if (!e) return null
          // Fingers along the tape, never pointing up much: the arm stays above the head and off the couch.
          const along = e.along.clone()
          along.y = Math.min(along.y, 0.2)
          return { at: e.at, n: e.n, along: along.normalize() }
        }
        hand(0, on(0, 0.32), block('R'))
        hand(1, on(0.06, 0.39), block('L'))
        if (p > 0.36 && p < 0.69) hand(0, on(0.36, 0.69, 0.05), tape('forehead'), 'press', 'index')
        if (p >= 0.69) hand(0, on(0.67, 0.95, 0.05), tape('chin'), 'press', 'index')
        break
      }
    }
    this.kitState = st
  }

  /**
   * The way the fingers point for a hand on a spot: away from the shoulder the arm comes from (you stand at her right
   * side; the assistant holding the head at the head end), squared to the surface; as asked if that leaves no way.
   */
  private reach(i: number, spot: Spot, from?: 'behind' | 'above') {
    const R = this.rig
    if (!R) return spot.along
    const q = this.body.quaternion
    const U = v(0, 1, 0).applyQuaternion(q)
    const F = v(0, 0, 1).applyQuaternion(q)
    const RT = v(-1, 0, 0).applyQuaternion(q)
    const k = this.scale
    const neck = R.neck.getWorldPosition(v(0, 0, 0))
    // Reaching to her far side, you lean over her chest: the arm comes from lower down the body and higher up.
    const far = i < 2 && spot.at.clone().sub(neck).dot(RT) < -0.02 * k
    // Sitting up: you stand in front of him and a little to his right, your shoulder above his head.
    if (i < 2 && !from && this.posture !== 'supine' && !this.posture.startsWith('roll')) {
      const flatF = F.clone().setY(0).normalize()
      const flatRT = RT.clone().setY(0).normalize()
      const standing = neck.clone().addScaledVector(flatF, 0.5 * k).addScaledVector(flatRT, (i === 0 ? 0.32 : 0.12) * k)
      standing.y = Math.max(neck.y + 0.28 * k, 1.42 * k)
      const away = spot.at.clone().sub(standing)
      away.addScaledVector(spot.n, -away.dot(spot.n))
      if (away.lengthSq() > 1e-6) return away.normalize().multiplyScalar(0.8).addScaledVector(spot.along, 0.2).normalize()
    }
    const behind = spot.at.clone().sub(neck).dot(RT) >= 0 ? 1 : -1
    const shoulder = from === 'above'
      ? spot.at.clone().addScaledVector(F, 0.6 * k).addScaledVector(RT, 0.12 * k).addScaledVector(U, -0.08 * k)
      : from === 'behind'
      ? neck.addScaledVector(RT, behind * 0.42 * k).addScaledVector(F, -0.22 * k).addScaledVector(U, 0.25 * k)
      : i >= 2
        ? neck.addScaledVector(U, 0.62 * k).addScaledVector(F, 0.42 * k).addScaledVector(RT, (i === 2 ? 0.18 : -0.18) * k)
        : neck
            .addScaledVector(RT, (far ? 0.3 : 0.5) * k)
            .addScaledVector(F, (far ? 0.62 : 0.5) * k)
            .addScaledVector(U, ((i === 0 ? -0.2 : 0.12) - (far ? 0.3 : 0)) * k)
    const away = spot.at.clone().sub(shoulder)
    away.addScaledVector(spot.n, -away.dot(spot.n))
    if (away.lengthSq() < 1e-6) return spot.along
    // Mostly away from the shoulder; a little of the way asked (how the hand holds what it holds).
    return away.normalize().multiplyScalar(0.8).addScaledVector(spot.along, 0.2).normalize()
  }

  /**
   * How far each part of a hand (and its sleeve, if asked) is inside something: the neck and head, the collar on them,
   * the blocks, the couch. The deepest, and which way is out of it.
   */
  private clash(hand: ExaminerHand, sleeve: boolean) {
    const kit = this.kit
    let worst = 0
    let total = 0
    let way = v(0, 1, 0)
    const caps = this.bodyNow()
    for (const { p, r } of hand.probes(sleeve)) {
      let d = 0
      let out = way
      // Into the body: the core of a limb, the trunk, the head (a hand on the skin is clear of it).
      for (const c of caps) {
        const ab = c.B.clone().sub(c.A)
        const t = Math.max(0, Math.min(1, ab.lengthSq() > 1e-9 ? p.clone().sub(c.A).dot(ab) / ab.lengthSq() : 0))
        const near = c.A.clone().addScaledVector(ab, t)
        const dist = p.distanceTo(near)
        const into = c.r + (c.rB - c.r) * t + r - dist
        if (into > d) {
          d = into
          out = dist > 1e-6 ? p.clone().sub(near).divideScalar(dist) : v(0, 1, 0)
        }
      }
      if (kit) {
        const a = kit.collar.depthIn(p, r)
        if (a.depth > d) {
          d = a.depth
          out = a.out
        }
        const b = kit.blockDepth(p, r)
        if (b.depth > d) {
          d = b.depth
          out = b.out
        }
      }
      if (p.x > 0 && p.x < COUCH.length && Math.abs(p.z) < COUCH.width / 2 && COUCH.top + 0.003 + r - p.y > d) {
        d = COUCH.top + 0.003 + r - p.y
        out = v(0, 1, 0)
      }
      total += d
      if (d > worst) {
        worst = d
        way = out
      }
    }
    return { worst, total, way }
  }

  /** The body as capsules (bone to bone, the core of the limb there) and the head as a ball: their radii, found once. */
  private caps: { a: THREE.Object3D; b: THREE.Object3D | null; r: number; rB: number }[] | null = null
  /** Where each capsule is now (its radius tapering from one end to the other). */
  private bodyNow(): { A: THREE.Vector3; B: THREE.Vector3; r: number; rB: number }[] {
    const R = this.rig
    if (!R) return []
    const at = (o: THREE.Object3D) => o.getWorldPosition(v(0, 0, 0))
    const headBall = () => {
      const eyes = this.eyesAt() ?? at(R.head)
      return eyes.addScaledVector(this.headAxes().face, -0.06 * this.scale)
    }
    if (!this.caps) {
      const segs: [THREE.Object3D, THREE.Object3D][] = []
      for (const s of SIDES) segs.push([R.upperArm[s], R.forearm[s]], [R.forearm[s], R.hand[s]], [R.thigh[s], R.calf[s]], [R.calf[s], R.foot[s]])
      segs.push([R.hips, R.spine], [R.spine, R.chest], [R.chest, R.neck])
      const verts: THREE.Vector3[] = []
      const p = v(0, 0, 0)
      for (const m of R.meshes) {
        if (m.name.startsWith('bare-leg')) continue
        const sm = m as THREE.SkinnedMesh
        const pos = m.geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i += 3) {
          if (sm.isSkinnedMesh) sm.getVertexPosition(i, p)
          else p.fromBufferAttribute(pos, i)
          verts.push(p.clone().applyMatrix4(m.matrixWorld))
        }
      }
      // Each bit of skin belongs to the bone it is nearest; a fifth of a bone's skin, at each end, lies nearer its line
      // than this: a little in from there (a hand resting on the skin is clear of it).
      const lines = segs.map(([a, b]) => ({ A: at(a), B: at(b) }))
      const along = (q: THREE.Vector3, l: { A: THREE.Vector3; B: THREE.Vector3 }) => {
        const ab = l.B.clone().sub(l.A)
        const t = q.clone().sub(l.A).dot(ab) / Math.max(1e-9, ab.lengthSq())
        return { t, d: q.distanceTo(l.A.clone().addScaledVector(ab, Math.max(0, Math.min(1, t)))) }
      }
      const near: { t: number; d: number }[][] = lines.map(() => [])
      for (const q of verts) {
        let best = -1
        let bd = 0.25 * this.scale
        let bt = 0
        lines.forEach((l, i) => {
          const x = along(q, l)
          if (x.d < bd) {
            bd = x.d
            best = i
            bt = x.t
          }
        })
        if (best >= 0) near[best].push({ t: bt, d: bd })
      }
      const core = (i: number, from: number, to: number) => {
        const ds = near[i].filter((x) => x.t >= from && x.t <= to).map((x) => x.d).sort((x, y) => x - y)
        return Math.max(0.012, (ds.length ? ds[Math.floor(ds.length * 0.2)] : 0.03) - 0.006)
      }
      this.caps = segs.map(([a, b], i) => ({ a, b, r: core(i, 0.1, 0.45), rB: core(i, 0.55, 0.9) }))
      this.caps.push({ a: R.head, b: null, r: 0.068 * this.scale, rB: 0.068 * this.scale })
    }
    return this.caps.map((c) => (c.b ? { A: at(c.a), B: at(c.b), r: c.r, rB: c.rB } : { A: headBall(), B: headBall(), r: c.r, rB: c.rB }))
  }

  /** Lift a hand out of anything it has gone into: out the way it was put on, unless that does not take it out. */
  private release(hand: ExaminerHand, n: THREE.Vector3) {
    for (let k = 0; k < 6; k++) {
      const c = this.clash(hand, false)
      if (c.worst < 0.0005) break
      const way = n.dot(c.way) > 0.3 ? n : c.way
      hand.shift(way.clone().multiplyScalar(c.worst + 0.0005))
    }
  }

  /** How each hand was turned last frame (no hand turns faster than a wrist can). */
  private lastTurn = new Map<ExaminerHand, THREE.Quaternion>()
  private frameDt = 1 / 30
  /** Turn a hand no faster than about 300° a second from how it was, about the point that touches. */
  private steady(hand: ExaminerHand) {
    const prev = this.lastTurn.get(hand)
    if (prev) {
      const most = 300 * DEG * this.frameDt
      if (prev.angleTo(hand.group.quaternion) > most) {
        const keep = hand.contactNow()
        const want = hand.group.quaternion.clone()
        hand.group.quaternion.copy(prev).rotateTowards(want, most)
        hand.group.updateMatrixWorld(true)
        hand.shift(keep.sub(hand.contactNow()))
      }
    }
    this.lastTurn.set(hand, hand.group.quaternion.clone())
  }

  /** How each hand last sat, from the way its arm comes: turned about the spot, its fingers tilted off it, lifted. */
  private turned: { yaw: number; pitch: number; lift: number }[] = [0, 1, 2, 3].map(() => ({ yaw: 0, pitch: 0, lift: 0 }))

  /**
   * Put a hand on a spot the way a real one would go: its fingers pointing away from the shoulder its arm comes from,
   * flat on the surface; or turned about the spot, or its fingers tilted off the surface (the heel of the hand still on
   * it), as little as it takes for the hand and its sleeve to clear the patient, the collar, the blocks and the couch.
   * Then lifted off anything it still touches.
   */
  private settle(hand: ExaminerHand, i: number, spot: Spot, contact: Contact, gap: number, from?: 'behind' | 'above', prefer?: THREE.Vector3) {
    // The way the fingers would point, turned from only as far as needed to keep the hand and sleeve out of her.
    const pref = prefer ? prefer.clone().addScaledVector(spot.n, -prefer.dot(spot.n)).normalize() : this.reach(i, spot, from)
    // A hand just put out goes straight to its best way; one already there turns to it.
    const fresh = !this.lastTurn.has(hand)
    const last = this.turned[i]
    const k = this.scale
    const pose = (yaw: number, pitch: number, lift: number) => {
      const along = pref.clone().applyAxisAngle(spot.n, yaw)
      const n = spot.n.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(along, -Math.sin(pitch))
      along.multiplyScalar(Math.cos(pitch)).addScaledVector(spot.n, Math.sin(pitch))
      hand.place(spot.at.clone().addScaledVector(spot.n, lift), n, along, contact, gap)
    }
    // Every way to try, the least change first (an unclashing one ends the search); at most so many a frame.
    const tries: { yaw: number; pitch: number; lift: number; cost: number }[] = []
    for (const yd of [0, 25, -25, 50, -50, 80, -80, 115, -115, 150, -150, 180])
      for (const pd of [0, 15, 30])
        for (const ld of [0, 0.02, 0.045]) {
          const yaw = (yd * Math.PI) / 180
          const pitch = (pd * Math.PI) / 180
          const lift = ld * k
          tries.push({ yaw, pitch, lift, cost: Math.abs(yd) / 180 + (pd / 30) * 0.3 + (ld / 0.045) * 0.5 + (Math.abs(yaw - last.yaw) + Math.abs(pitch - last.pitch) + Math.abs(lift - last.lift) * 10) * 0.15 })
        }
    tries.sort((a, b) => a.cost - b.cost)
    let best = { ...last, cost: Infinity }
    let tried = 0
    for (const t of tries) {
      if (t.cost >= best.cost || tried++ > 40) break
      pose(t.yaw, t.pitch, t.lift)
      const cost = t.cost + this.clash(hand, true).total * 50
      if (cost < best.cost) best = { ...t, cost }
    }
    // Move only part of the way each frame toward it (no flicking).
    const step = (from: number, to: number, most: number) => from + Math.max(-most, Math.min(most, to - from))
    this.turned[i] = fresh ? { yaw: best.yaw, pitch: best.pitch, lift: best.lift } : { yaw: step(last.yaw, best.yaw, 0.2), pitch: step(last.pitch, best.pitch, 0.15), lift: step(last.lift, best.lift, 0.006) }
    pose(this.turned[i].yaw, this.turned[i].pitch, this.turned[i].lift)
    this.release(hand, spot.n)
  }

  /** Her eyes, between the two. */
  private eyesAt() {
    const R = this.rig
    return R ? R.eye.L.getWorldPosition(v(0, 0, 0)).add(R.eye.R.getWorldPosition(v(0, 0, 0))).multiplyScalar(0.5) : null
  }

  /** The head's own directions now: where the face looks, and up toward the top of the head. */
  private headAxes() {
    const R = this.rig!
    const rel = R.head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.body.quaternion.clone().multiply(R.headBind).invert())
    const ax = (x: number, y: number, z: number) => v(x, y, z).applyQuaternion(this.body.quaternion).applyQuaternion(rel).normalize()
    return { face: ax(0, 0, 1), up: ax(0, 1, 0), right: ax(-1, 0, 0) }
  }

  /**
   * The finger–nose test on one side: your finger held up at her arm's length, moved once between tries; she touches it,
   * then her nose, twice. On an ataxic side the finger shakes more the nearer it gets (intention tremor) and overshoots
   * past your finger before it comes back to it (past-pointing).
   */
  private fingerNose(side: Side, t: number, dur: number) {
    const R = this.rig
    const eyes = this.eyesAt()
    if (!R || !eyes) return
    const k = this.scale
    const q = this.body.quaternion
    const U = v(0, 1, 0).applyQuaternion(q)
    const F = v(0, 0, 1).applyQuaternion(q)
    const out = v(side === 'R' ? -1 : 1, 0, 0).applyQuaternion(q)
    const shaky = this.signs.ataxia === side
    this.hands[side] = { name: 'point', w: this.hands[side].name === 'point' ? this.hands[side].w : 0, want: 1 }
    const tipKey = `pulp-${side}`
    if (!this.reachFrom.has(tipKey)) {
      const tip0 = this.siteWorld(tipKey)
      if (tip0) this.reachFrom.set(tipKey, tip0)
    }
    const rest = this.reachFrom.get(tipKey)
    if (!rest) return
    const head = this.headAxes()
    const nose = eyes.clone().addScaledVector(head.face, 0.03 * k).addScaledVector(head.up, -0.035 * k)
    const shoulder = R.upperArm[side].getWorldPosition(v(0, 0, 0))
    // Your finger: in front of her shoulder at arm's length; then up and across for the second try.
    const moved = smooth(Math.max(0, Math.min(1, (t - 2.25) / 0.3)))
    const yours = shoulder
      .clone()
      .addScaledVector(F, 0.47 * k)
      .addScaledVector(U, (0.08 + 0.1 * moved) * k)
      .addScaledVector(out, (0.05 - 0.15 * moved) * k)
    // How far she is from her nose (0) to your finger (1), and how near the end of a move she is (for the tremor).
    const tries = [0.45, 2.55]
    let u = 0
    let near = 0
    let landed = -1
    for (const t0 of tries) {
      const x = t - t0
      if (x < 0 || x > 1.9) continue
      if (x < 0.75) {
        u = smooth(x / 0.75)
        near = u * u
      } else if (x < 0.98) {
        u = 1
        near = 1
        landed = x - 0.75
      } else if (x < 1.7) {
        u = 1 - smooth((x - 0.98) / 0.72)
        near = (1 - u) * (1 - u) * 0.7
      }
    }
    const path = yours.clone().sub(nose)
    const across = path.clone().cross(U).normalize()
    const up2 = across.clone().cross(path).normalize()
    let at = nose.clone().lerp(yours, u)
    if (shaky) {
      // Overshooting past your finger, out to her side, then coming back onto it.
      const over = landed >= 0 ? 1 - smooth(landed / 0.2) : u > 0.85 ? (u - 0.85) / 0.15 : 0
      at.addScaledVector(path.clone().normalize(), 0.022 * k * over).addScaledVector(out, 0.03 * k * over)
      const amp = 0.02 * k * near
      at.addScaledVector(across, amp * Math.sin(t * Math.PI * 2 * 4.2)).addScaledVector(up2, amp * 0.7 * Math.cos(t * Math.PI * 2 * 3.4))
    }
    // From her side to her nose at the start, back down at the end.
    const into = smooth(Math.min(1, t / 0.45))
    const outOf = smooth(Math.max(0, Math.min(1, (t - (dur - 0.55)) / 0.55)))
    at = rest.clone().lerp(at, into * (1 - outOf))
    this.reachTo.arm[side] = { at, pole: out.clone().addScaledVector(F, -0.35).addScaledVector(U, -0.3) }
    // Your hand, pad toward her.
    const w = smooth(Math.max(0, Math.min(1, t / 0.4, (dur - 0.3 - t) / 0.4)))
    if (w > 0.02) this.touches.push({ grip: 'press', contact: 'index', gap: 0.14 * (1 - w) + 0.004, stroke: 0, site: tipKey, spot: () => ({ at: yours, n: yours.clone().sub(shoulder).normalize(), along: head.up.clone() }) })
  }

  /**
   * The heel–shin test on one side: the heel lifted onto the other knee and run down the front of the shin, twice. On an
   * ataxic side it wobbles from side to side and slips off the shin.
   */
  private heelShin(side: Side, t: number, dur: number) {
    const R = this.rig
    if (!R) return
    const k = this.scale
    const q = this.body.quaternion
    const F = v(0, 0, 1).applyQuaternion(q)
    const out = v(side === 'R' ? -1 : 1, 0, 0).applyQuaternion(q)
    const other: Side = side === 'R' ? 'L' : 'R'
    const shaky = this.signs.ataxia === side
    const key = `heel-${side}`
    if (!this.reachFrom.has(key)) {
      const h0 = this.siteWorld(key)
      if (h0) this.reachFrom.set(key, h0)
    }
    const rest = this.reachFrom.get(key)
    if (!rest) return
    const knee = R.calf[other].getWorldPosition(v(0, 0, 0))
    const ankle = R.foot[other].getWorldPosition(v(0, 0, 0))
    /** On the front of the other shin, `u` of the way from just below the knee to the ankle. */
    const onShin = (u: number) => knee.clone().lerp(ankle, 0.08 + 0.8 * u).addScaledVector(F, (0.06 - 0.022 * u) * k)
    // Lift over onto the knee; down the shin; up and back to the knee; down again; back down beside it.
    let at: THREE.Vector3
    const lift = (a: THREE.Vector3, b: THREE.Vector3, f: number) => a.clone().lerp(b, smooth(f)).addScaledVector(F, 0.09 * k * Math.sin(Math.PI * f))
    if (t < 0.9) at = lift(rest, onShin(0), t / 0.9)
    else if (t < 2.5) at = onShin(smooth((t - 0.9) / 1.6))
    else if (t < 3.1) at = lift(onShin(1), onShin(0), (t - 2.5) / 0.6)
    else if (t < 4.6) at = onShin(smooth((t - 3.1) / 1.5))
    else at = lift(onShin(1), rest, Math.min(1, (t - 4.6) / (dur - 4.6)))
    if (shaky && t > 0.7 && t < 4.7) {
      // Side to side off the line of the shin, unevenly; once right off it, and lifted back on.
      const wob = 0.028 * k * (Math.sin(t * Math.PI * 2 * 1.7) + 0.6 * Math.sin(t * Math.PI * 2 * 2.9 + 1))
      const off = 0.055 * k * Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, (t - 1.7) / 0.55))))
      at.addScaledVector(out, wob + off).addScaledVector(F, 0.012 * k * Math.abs(Math.sin(t * Math.PI * 2 * 1.7)) + 0.4 * off)
    }
    this.reachTo.leg[side] = { at, pole: F.clone().addScaledVector(out, 0.45) }
  }

  /**
   * Bring the end of a limb (a fingertip, a heel) to a point: two bones, the joint between them bending toward `pole`;
   * then the lower bone swung so the end lands on it.
   */
  private reachLimb(root: THREE.Object3D, mid: THREE.Object3D, tipSite: string, target: THREE.Vector3, pole: THREE.Vector3, maxBend = 140, end?: THREE.Object3D) {
    let goal = target
    for (let i = 0; i < 2; i++) {
      root.updateWorldMatrix(true, true)
      const A = root.getWorldPosition(v(0, 0, 0))
      const B = mid.getWorldPosition(v(0, 0, 0))
      const C = this.siteWorld(tipSite)
      if (!C) return
      const l1 = A.distanceTo(B)
      const l2 = B.distanceTo(C)
      const to = target.clone().sub(A)
      // Bent no further than the joint goes (`maxBend`): nearer than that, the end goes as close as it can.
      const tightest = Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((180 - maxBend) * DEG)))
      const d = Math.max(Math.abs(l1 - l2) + 1e-3, tightest, Math.min(l1 + l2 - 1e-3, to.length()))
      const dir = to.normalize()
      goal = A.clone().addScaledVector(dir, d)
      const along = (l1 * l1 + d * d - l2 * l2) / (2 * d)
      const h = Math.sqrt(Math.max(0, l1 * l1 - along * along))
      const bend = pole.clone().addScaledVector(dir, -pole.dot(dir))
      if (bend.lengthSq() < 1e-8) return
      bend.normalize()
      const joint = A.clone().addScaledVector(dir, along).addScaledVector(bend, h)
      turn(root, new THREE.Quaternion().setFromUnitVectors(B.sub(A).normalize(), joint.sub(A).normalize()))
      mid.updateWorldMatrix(true, true)
      const B2 = mid.getWorldPosition(v(0, 0, 0))
      const C2 = this.siteWorld(tipSite)
      if (!C2) return
      turn(mid, new THREE.Quaternion().setFromUnitVectors(C2.sub(B2).normalize(), goal.clone().sub(B2).normalize()))
    }
    // The last of the way by the wrist (at most 75°): a finger brought to the nose.
    if (end && goal.distanceTo(target) > 1e-3) {
      end.updateWorldMatrix(true, true)
      const W = end.getWorldPosition(v(0, 0, 0))
      const C3 = this.siteWorld(tipSite)
      if (!C3) return
      const q = new THREE.Quaternion().setFromUnitVectors(C3.sub(W).normalize(), target.clone().sub(W).normalize())
      turn(end, new THREE.Quaternion().slerp(q, Math.min(1, (75 * DEG) / Math.max(1e-6, 2 * Math.acos(Math.min(1, Math.abs(q.w)))))))
    }
  }

  /** An arc over the head from 45° one way to 45° the other, and a line showing which way the face points now. */
  private showArc(yaw: number) {
    const R = this.rig
    if (!R) return
    if (!this.arc) {
      this.arc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffb000', depthTest: false }))
      this.arc.renderOrder = 20
      this.scene.add(this.arc)
    }
    const q = this.body.quaternion
    const U = v(0, 1, 0).applyQuaternion(q)
    const F = v(0, 0, 1).applyQuaternion(q)
    const centre = R.head.getWorldPosition(v(0, 0, 0)).addScaledVector(U, 0.13 * this.scale)
    const r = 0.11 * this.scale
    const pts: THREE.Vector3[] = []
    const dir = (deg: number) => F.clone().applyAxisAngle(U, (-deg * Math.PI) / 180)
    // The arc, with ticks at each end; then the face's line.
    for (let d = -45; d <= 45; d += 5) pts.push(centre.clone().addScaledVector(dir(d), r))
    pts.push(centre.clone().addScaledVector(dir(45), r * 1.15), centre.clone().addScaledVector(dir(45), r), centre.clone())
    pts.push(centre.clone().addScaledVector(dir(-45), r), centre.clone().addScaledVector(dir(-45), r * 1.15), centre.clone().addScaledVector(dir(-45), r), centre.clone())
    pts.push(centre.clone().addScaledVector(dir(yaw), r * 1.25))
    this.arc.geometry.setFromPoints(pts)
    this.arc.visible = true
  }

  /** The examiner's hands this frame (see `Touch`). */
  private touches: Touch[] = []
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

  /** The examiner's hands, on the posed body. */
  private placeExaminer() {
    const R = this.rig
    const a = this.act
    this.contact = null
    const placed = new Set<ExaminerHand>()
    const all = [this.examiner, this.examiner2, ...this.assistant]
    const q = this.body.quaternion
    const U = v(0, 1, 0).applyQuaternion(q)
    const F = v(0, 0, 1).applyQuaternion(q)
    const LT = v(1, 0, 0).applyQuaternion(q)
    for (const t of R ? this.touches : []) {
      const hand = all[t.hand ?? (t.left ? 1 : 0)]
      if (!R || placed.has(hand)) continue
      if (t.spot) {
        // Somewhere worked out now the body is posed (on the collar as it goes on): the hand kept out of what it holds.
        const spot = t.spot()
        if (!spot) continue
        placed.add(hand)
        hand.setGrip(t.grip)
        this.settle(hand, t.hand ?? 0, spot, t.contact, t.gap, t.from)
        continue
      }
      const found = this.spotNow(t.site)
      const spot0 = t.at && t.n ? { at: t.at, n: t.n.clone().normalize() } : found
      if (!spot0) continue
      placed.add(hand)
      hand.setGrip(t.grip)
      if (t.along) {
        // Fingers the way asked (in the body's frame), squared to the skin; a stroke runs that way.
        const along = U.clone().multiplyScalar(t.along[0]).addScaledVector(F, t.along[1]).addScaledVector(LT, t.along[2]).normalize()
        const at = spot0.at.clone().addScaledVector(along, t.stroke)
        if (this.kit) this.settle(hand, t.hand ?? (t.left ? 1 : 0), { at, n: spot0.n, along }, t.contact, t.gap)
        else {
          hand.place(at, spot0.n, along, t.contact, t.gap)
          this.release(hand, spot0.n)
        }
        if (!this.contact && !this.shot) this.contact = { at: spot0.at, n: spot0.n, along, profile: false }
        continue
      }
      if (!a) continue
      if (onLeg(t.site)) {
        // On a leg: on top of it, your hand comes from your side, the fingers across it; on either side of it, the fingers
        // point up the leg and the forearm lies along it. A stroke runs along the leg, or across it.
        const axis = this.limbAxis(t.site)
        const across = axis.clone().cross(spot0.n).normalize()
        const toYou = v(0, 0, 1)
        if (Math.abs(across.dot(toYou)) > 0.3 ? across.dot(toYou) > 0 : across.y > 0) across.negate()
        const flank = Math.abs(spot0.n.dot(toYou)) > 0.5
        const along = t.across === false ? axis.clone() : flank ? axis.clone().negate() : across
        const at = spot0.at.clone().addScaledVector(t.across ? across : axis, t.stroke)
        this.settle(hand, t.hand ?? (t.left ? 1 : 0), { at, n: spot0.n, along }, t.contact, t.gap, undefined, along)
        if (!this.contact && !this.shot) this.contact = { at: spot0.at, n: spot0.n, along, profile: false }
        continue
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
      // Your arm from your shoulder, in front of her, not along her forearm from her elbow.
      this.settle(hand, t.hand ?? (t.left ? 1 : 0), { at, n: spot.n, along }, t.contact, t.gap)
      if (!this.contact) this.contact = { at: spot.at, n: spot.n, along, profile: a.anim === 'stretch' }
    }
    for (const h of all) {
      if (!placed.has(h)) {
        h.hide()
        this.lastTurn.delete(h)
      } else this.steady(h)
    }
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
    this.roll(R, p.side, axis, ang * p.w)
  }

  /** The forearm's axis, elbow to wrist. */
  private forearmAxis(R: Rig, side: Side) {
    return R.hand[side].getWorldPosition(v(0, 0, 0)).sub(R.forearm[side].getWorldPosition(v(0, 0, 0))).normalize()
  }

  /**
   * The hand's own frame, from its bones (the bind pose's idea of the palm is tilted on some models): along (wrist to
   * the middle knuckle), radial (little knuckle to index knuckle), back (the dorsum). `palmish` only settles the side.
   */
  private handFrame(R: Rig, side: Side, palmish: THREE.Vector3) {
    const d = R.digits[side]
    const pos = (o: THREE.Object3D) => o.getWorldPosition(v(0, 0, 0))
    const along = pos(d[2][0]).sub(pos(R.hand[side])).normalize()
    const radial = pos(d[1][0]).sub(pos(d[4]?.[0] ?? d[3][0]))
    radial.sub(along.clone().multiplyScalar(radial.dot(along))).normalize()
    const back = along.clone().cross(radial).normalize()
    if (back.dot(palmish) > 0) back.negate()
    return { along, radial, back }
  }

  /** Turn the hand about the forearm as the forearm really does: most of it along the forearm, the rest at the wrist. */
  private roll(R: Rig, side: Side, axis: THREE.Vector3, ang: number) {
    turn(R.forearm[side], new THREE.Quaternion().setFromAxisAngle(axis, ang * 0.6))
    turn(R.hand[side], new THREE.Quaternion().setFromAxisAngle(axis, ang * 0.4))
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
    // The forearm turns so the thumb side is up (a thumbs up), then the wrist bends back toward the back of the hand.
    if (shape.turn) {
      const f = this.forearmAxis(R, side)
      const flat = (d: THREE.Vector3) => d.sub(f.clone().multiplyScalar(d.dot(f)))
      const r = flat(this.handFrame(R, side, world(0, -1, 0)).radial)
      const u = flat(v(0, 1, 0))
      if (r.lengthSq() > 1e-4 && u.lengthSq() > 1e-4) {
        r.normalize()
        u.normalize()
        this.roll(R, side, f, Math.atan2(r.clone().cross(u).dot(f), r.dot(u)) * w)
        world = frame()
      }
    }
    if (shape.ext) {
      const h = this.handFrame(R, side, world(0, -1, 0))
      turn(R.hand[side], new THREE.Quaternion().setFromAxisAngle(h.along.clone().cross(h.back).normalize(), shape.ext * DEG * w))
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
    this.roll(R, side, axis, ang * w)
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
        // Up and down the room in front of the couch, turning at each end; limping, a few slow steps each way.
        const sore = p === 'walking' ? this.limp() : null
        const lap = sore ? 5.2 : 7
        const u = ((t - this.walkFrom) % lap) / lap
        const out = u < 0.5
        const k = out ? u * 2 : (1 - u) * 2
        const x = sore ? lerp(0.65, 1.55, smooth(Math.min(1, Math.max(0, (k - 0.05) / 0.9)))) : lerp(0.35, 2.05, smooth(Math.min(1, Math.max(0, (k - 0.05) / 0.9))))
        const bob = sore ? antalgic(t - this.walkFrom, sore).dip * 0.028 * (H / 1.72) : Math.abs(Math.sin(t * Math.PI * 1.8)) * 0.015 * (H / 1.72)
        return { quat: facing(v(0, 1, 0), v(out ? 1 : -1, 0, 0.0001)), pos: v(x, leg - bob, 1.15) }
      }
      default:
        return { quat: facing(v(0, 1, 0), v(0, 0, 1)), pos: v(1.15, leg, 1.0) }
    }
  }

  /** The sore side, if she is walking with an antalgic gait. */
  private limp(): Side | null {
    const g = this.signs.gait
    return this.posture === 'walking' && g?.startsWith('antalgic') ? (g.slice(-1) as Side) : null
  }

  private jointsNow(): Joints {
    const target = { ...rest(this.posture), ...this.rests, ...this.held }
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
    const sore = this.limp()
    if (sore) {
      // Antalgic: off the sore leg as fast as she can, the knee held bent and stiff (see gait.ts).
      const g = antalgic(t - this.walkFrom, sore)
      for (const s of SIDES) {
        j[`hipflex-${s}`] = g.legs[s].hip
        j[`knee-${s}`] = g.legs[s].knee
        j[`ankle-${s}`] = g.legs[s].ankle
        j[`shoulderflex-${s}`] = g.arms[s]
      }
      j.trunk = 4
    } else if (this.posture === 'walking' || this.posture === 'heel-toe') {
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
    // A wince each time the weight goes onto the sore leg.
    const sore = this.limp()
    if (sore) e.distress = Math.max(e.distress, 0.75 * antalgic(this.time - this.walkFrom, sore).pain)
    const m = this.motion
    this.finger.visible = false
    const a = this.act
    if (a?.anim === 'speech') {
      // 'Bri-tish con-sti-tu-tion': a syllable at a time; slurred and broken up (staccato) on a cerebellar lesion.
      const ataxic = !!S.ataxia
      const beats = ataxic ? [0.25, 0.55, 0.95, 1.2, 1.55, 1.75, 2.1] : [0.3, 0.48, 0.7, 0.88, 1.05, 1.22, 1.4]
      let open = 0
      for (const b of beats) open = Math.max(open, Math.max(0, 1 - Math.abs(a.t - b) / (ataxic ? 0.11 : 0.09)))
      e.mouth = 0.32 * open
    }
    if (a?.anim === 'look-mouth') e.mouth = 0.65 * smooth(Math.min(1, a.t / 0.5, (a.dur - a.t) / 0.5))
    if (a?.anim === 'eyes-h') {
      const g = gazePath(a.t, a.dur)
      e.horizontal = g.h
      e.vertical = g.v
      if (S.nystagmus) e.horizontal += nystagmusBeat(a.t, g.h, S.nystagmus)
    }
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
        if (S.nystagmus) e.horizontal += nystagmusBeat(m.t, h, S.nystagmus)
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
    const at = this.fingerPoint(h, vert, dist)
    if (!R || !at) return
    this.finger.position.copy(at)
    this.finger.quaternion.setFromUnitVectors(v(0, 1, 0), this.headAxes().up)
    this.finger.visible = true
  }

  /** A point in front of her eyes, at an angle from her line of sight (degrees, her right and up), `dist` away. */
  private fingerPoint(h: number, vert: number, dist: number) {
    const eyes = this.eyesAt()
    if (!eyes) return null
    const a = this.headAxes()
    const dir = a.face
      .clone()
      .applyAxisAngle(a.up, -h * DEG)
      .applyAxisAngle(a.right, vert * DEG)
    return eyes.addScaledVector(dir, dist)
  }

  /* ------------------------------------------------------------------ applying the pose */

  applyPose() {
    const R = this.rig
    if (!R) return
    for (const [bone, q] of this.bind) bone.quaternion.copy(q)
    for (const s of SIDES) {
      const p0 = this.bindPos.get(R.calf[s])
      if (p0) R.calf[s].position.copy(p0)
    }
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

    // Leaning to one side, sat up (truncal ataxia): from the lumbar spine and the chest.
    if (this.lean) {
      turn(R.spine, new THREE.Quaternion().setFromAxisAngle(F, this.lean * DEG * 0.55))
      turn(R.chest, new THREE.Quaternion().setFromAxisAngle(F, this.lean * DEG * 0.45))
    }
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
      this.shinFront[s].copy(footFront)
      // The shin drawn forward (or pushed back) at the knee: the whole lower leg slides on the femur.
      if (this.tibia[s]) {
        const parent = R.calf[s].parent
        if (parent) {
          parent.updateWorldMatrix(true, false)
          const to = R.calf[s].getWorldPosition(v(0, 0, 0)).addScaledVector(footFront, this.tibia[s])
          R.calf[s].position.copy(parent.worldToLocal(to))
        }
      }
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
      const patT = this.motion?.id === 'rapid-alternating' ? this.motion.t : this.act?.anim === 'rapid-alt' ? this.act.t : null
      if (patT !== null) {
        // Front, back, front on the thigh, fast and even; on an ataxic side slow, irregular and clumsy, not turning
        // fully over.
        const slow = this.signs.ataxia === s
        const e = this.act?.anim === 'rapid-alt' ? Math.min(1, patT / 0.4, (this.act.dur - patT) / 0.4) : 1
        const flip = slow ? Math.sin(patT * Math.PI * 2 * 1.25 + 0.8 * Math.sin(patT * 2.7)) * (0.75 + 0.25 * Math.sin(patT * 4.1)) : Math.sin(patT * Math.PI * 2 * 2.5)
        turn(R.hand[s], new THREE.Quaternion().setFromAxisAngle(fore, flip * 1.4 * Math.max(0, e)))
      }
    }

    for (const s of SIDES) this.poseFingers(R, s)
    // A fingertip or a heel brought to where it must be (the finger–nose and heel–shin tests).
    for (const s of SIDES) {
      const arm = this.reachTo.arm[s]
      if (arm) this.reachLimb(R.upperArm[s], R.forearm[s], `${arm.tip ?? 'pulp'}-${s}`, arm.at, arm.pole, 140, R.hand[s])
      const leg = this.reachTo.leg[s]
      if (leg) this.reachLimb(R.thigh[s], R.calf[s], `heel-${s}`, leg.at, leg.pole, 135)
    }
    this.presentSpot(R)
    poseEyes(R, this.bind, this.body, this.faceAt())
    this.applyKit()
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
      if (!def || def.grip || (onDrape && !def.draped)) continue
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
    if (['knee', 'patella', 'thigh', 'medialjoint', 'lateraljoint', 'tibialtub', 'fibula', 'popliteal', 'innerthigh'].includes(base))
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
    this.shot = null
    this.orbit = { yaw: 0, pitch: 0, zoom: 1 }
  }

  /** Close in on a landmark, from the side it faces. */
  focus(site: string) {
    this.focusSite = site
    this.view = 'focus'
    this.shot = null
    this.orbit = { yaw: 0, pitch: 0, zoom: 1 }
  }

  /** Whether a manoeuvre is being filmed from a set place (so not to be zoomed in on). */
  get filmed() {
    return this.shot !== null
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
        // A leg manoeuvre filmed from its set place.
        const shot = this.shot?.target()
        if (this.shot && shot) {
          target = shot
          dir = this.shot.dir.clone()
          dist = this.shot.dist
          break
        }
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
        if (this.posture === 'walking') {
          // Walking: close enough to see what the legs are doing, from the side.
          target = at(R.hips).add(v(0, -0.05 * H, 0))
          dir = v(0.1, 0.18, 1).normalize()
          dist = 0.95 * H + 0.35
        } else if (['standing', 'heel-toe', 'bent', 'one-leg-R', 'one-leg-L'].includes(this.posture)) {
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
    this.frameDt = Math.max(1 / 240, dt)
    this.last = now
    this.time += dt
    if (this.moveT < 1) this.moveT = Math.min(1, this.moveT + dt / this.moveDur)
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
    this.kit?.dispose()
    this.rig?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

/** Every site id with its definition (for tools that list where to go). */
export const ALL_SITES = SITES
