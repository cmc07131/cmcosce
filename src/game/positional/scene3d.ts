import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'
import { readCustomModel } from './customModel'

/**
 * The 3D examination room for the Dix–Hallpike and Epley: a lit clinic, an examination couch, and Mrs Chau posed
 * procedurally from a handful of numbers. She can be played by a realistic avatar (Microsoft Rocketbox, MIT), an
 * anime one (VRoid AvatarSample_B, pixiv's sample-model terms), or the player's own VRM from their device; a `Rig`
 * maps any of these skeletons onto the same joints.
 *
 * World: metres, Y up. The couch runs along +X; its head end is at x = 0. The patient's right side faces +Z, toward
 * the default camera.
 *
 * Pose:
 * - `hipX`: where her hips sit along the couch (smaller is nearer the head end).
 * - `lie`: 0 sitting up, 1 lying flat.
 * - `roll`: 0 on her back, -1 rolled onto her left side.
 * - `yaw`: head rotation in degrees, positive to her right.
 * - `ext`: head extension in degrees (when lying, below the couch).
 * - `flex`: head flexion in degrees (chin down), for sitting up at the end.
 */

export type Pose = { hipX: number; lie: number; roll: number; yaw: number; ext: number; flex: number }
export type Eyes = { torsion: number; vertical: number; closed: number; squint: number; distress: number }
export type View = 'overview' | 'front' | 'side' | 'above' | 'left' | 'eyes'
export type Joint = 'nose' | 'head' | 'chest' | 'shoulder'

export const COUCH = { top: 0.72, length: 1.9, width: 0.66 }
const DEG = Math.PI / 180
/** Hip joint to neck joint of the realistic avatar: every avatar is scaled to it, so the head clears the couch end at the same place. */
const TORSO = 0.535

/** `custom`: the player's own VRM, kept on their device (see customModel.ts). */
export type AvatarId = 'realistic' | 'anime' | 'custom'
export type Credit = { text: string; href?: string }
/** The models that ship with the app. */
export const AVATARS: { id: AvatarId; label: string; credit: string; licence: string }[] = [
  { id: 'realistic', label: 'Realistic', credit: '3D avatar © Microsoft Rocketbox (MIT)', licence: '/models/patient/LICENSE-Rocketbox.md' },
  { id: 'anime', label: 'Anime', credit: '3D avatar: VRoid AvatarSample_B © pixiv', licence: '/models/vroid-b/LICENSE-VRoid.md' },
]

type Side = 'L' | 'R'
type Pair = Record<Side, THREE.Object3D>

/** One patient model, whatever its skeleton: the joints the posing needs, and how to drive her face. */
type Rig = {
  root: THREE.Object3D
  /** Every bone the posing touches; reset to the bind pose each frame. */
  bones: THREE.Object3D[]
  neck: THREE.Object3D
  head: THREE.Object3D
  chest: THREE.Object3D
  nose: THREE.Object3D
  clavicle: Partial<Pair>
  thigh: Pair
  calf: Pair
  foot: Pair
  toe: Partial<Pair>
  upperArm: Pair
  forearm: Pair
  hand: Pair
  eye: Pair
  /** How far the eyeballs sit in front of the eye bones (the cameras on her eyes stand off this much further). */
  eyeDepth: number
  /** Height of the hip joint above the couch when she lies on it. */
  hipAbove: number
  face(e: Eyes): void
  /** After posing, each frame: hair and clothes that swing. */
  tick(dt: number): void
  /** Let swinging parts come to rest in the current pose. */
  settle(): void
  dispose(): void
}

export class ExamRoom {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.02, 30)
  /** The infrared video-goggle camera, upright on her eyes. */
  readonly eyeCam = new THREE.PerspectiveCamera(30, 2, 0.01, 2)
  /** Show the goggle view as an inset (fractions of the canvas: x, y from the top, width, height). */
  goggles: { x: number; y: number; w: number; h: number } | null = null
  private body = new THREE.Group()
  private rig: Rig | null = null
  private bind = new Map<THREE.Object3D, THREE.Quaternion>()
  private loadToken = 0
  avatar: AvatarId | null = null
  /** The credit line for whoever plays her now: the MIT notice, pixiv's, or the player's own. */
  credit: Credit | null = null
  private camPos = new THREE.Vector3(1.6, 1.55, 2.3)
  private camLook = new THREE.Vector3(0.7, 0.9, 0)
  private wantPos = this.camPos.clone()
  private wantLook = this.camLook.clone()
  private view: View = 'overview'
  private frame = 0
  private disposed = false
  pose: Pose = { hipX: 0.85, lie: 0, roll: 0, yaw: 0, ext: 0, flex: 0 }
  eyes: Eyes = { torsion: 0, vertical: 0, closed: 0, squint: 0, distress: 0 }
  ready: Promise<void> = Promise.resolve()
  onFrame: ((dt: number) => void) | null = null

  constructor(
    private host: HTMLElement,
    avatar: AvatarId = 'realistic',
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.touchAction = 'none'
    host.appendChild(this.renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.background = new THREE.Color('#dfe5ea')
    this.scene.fog = new THREE.Fog('#dfe5ea', 6, 14)

    this.buildRoom()
    this.buildCouch()
    this.scene.add(this.body)
    this.setAvatar(avatar)
    this.resize()
    this.loop()
  }

  /* ------------------------------------------------------------------ the room */

  private buildRoom() {
    const hemi = new THREE.HemisphereLight('#f4f6ff', '#9a8f86', 0.55)
    this.scene.add(hemi)
    const key = new THREE.DirectionalLight('#fff4e6', 2.4)
    key.position.set(1.8, 3.2, 2.2)
    key.target.position.set(0.6, 0.7, 0)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -1.6
    key.shadow.camera.right = 1.6
    key.shadow.camera.top = 1.6
    key.shadow.camera.bottom = -1.6
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 7
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    key.shadow.radius = 4
    this.scene.add(key, key.target)
    const rim = new THREE.DirectionalLight('#dce8ff', 1.1)
    rim.position.set(-2.2, 2.4, -2)
    this.scene.add(rim)
    const fill = new THREE.PointLight('#ffffff', 0.9, 6, 2)
    fill.position.set(-0.6, 1.9, 1.4)
    this.scene.add(fill)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: '#c9ccc8', roughness: 0.62, metalness: 0 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#eef1f2', roughness: 0.9 })
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.2), wallMat)
    back.position.set(0, 1.6, -2.8)
    back.receiveShadow = true
    this.scene.add(back)
    // A skirting strip and a curtain on its rail give the room scale.
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: '#8fa3b0', roughness: 0.6 }))
    skirt.position.set(0, 0.05, -2.79)
    this.scene.add(skirt)
    const curtain = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.1, 40, 1, true, Math.PI * 0.62, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: '#9ec3c9', roughness: 0.95, side: THREE.DoubleSide }))
    curtain.position.set(2.7, 1.15, -0.6)
    this.scene.add(curtain)
  }

  private buildCouch() {
    const vinyl = new THREE.MeshPhysicalMaterial({ color: '#3d6f80', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.5 })
    const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 1, roughness: 0.22 })
    const paper = new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.95 })
    const top = new THREE.Mesh(new RoundedBoxGeometry(COUCH.length, 0.09, COUCH.width, 4, 0.03), vinyl)
    top.position.set(COUCH.length / 2, COUCH.top - 0.045, 0)
    top.castShadow = true
    top.receiveShadow = true
    this.scene.add(top)
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(COUCH.length - 0.15, 0.004, 0.5), paper)
    sheet.position.set(COUCH.length / 2 + 0.05, COUCH.top + 0.002, 0)
    sheet.receiveShadow = true
    this.scene.add(sheet)
    const base = new THREE.Mesh(new RoundedBoxGeometry(COUCH.length - 0.3, 0.06, COUCH.width - 0.12, 3, 0.02), chrome)
    base.position.set(COUCH.length / 2, 0.08, 0)
    base.castShadow = true
    this.scene.add(base)
    for (const x of [0.25, COUCH.length - 0.25])
      for (const z of [-0.24, 0.24]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, COUCH.top - 0.13, 20), chrome)
        leg.position.set(x, (COUCH.top - 0.1) / 2 + 0.07, z)
        leg.castShadow = true
        this.scene.add(leg)
      }
  }

  /* ------------------------------------------------------------------ the patient */

  /** Swap who plays Mrs Chau. The pose carries over; the old model is let go once the new one is in. */
  setAvatar(id: AvatarId) {
    if (id === this.avatar) return this.ready
    this.avatar = id
    const token = ++this.loadToken
    this.ready = this.loadAvatar(id).then(({ rig, credit }) => {
      if (this.disposed || token !== this.loadToken) return rig.dispose()
      this.credit = credit
      if (this.rig) {
        this.body.remove(this.rig.root)
        this.rig.dispose()
      }
      this.rig = rig
      this.bind = new Map(rig.bones.map((b) => [b, b.quaternion.clone()]))
      this.headBindWorld = null
      this.body.add(rig.root)
      this.applyPose()
      this.body.updateMatrixWorld(true)
      rig.settle()
    })
    return this.ready
  }

  /** The player's own model comes from this device; if it is missing or will not load, the realistic patient stands in. */
  private async loadAvatar(id: AvatarId): Promise<{ rig: Rig; credit: Credit }> {
    if (id === 'custom') {
      const own = await readCustomModel()
      if (own) {
        const url = URL.createObjectURL(new Blob([own.bytes], { type: 'model/gltf-binary' }))
        try {
          return { rig: await this.loadVrm(url), credit: { text: own.credit } }
        } catch {
          // A file that will not load: fall through to the realistic patient.
        } finally {
          URL.revokeObjectURL(url)
        }
      }
    }
    const a = AVATARS.find((x) => x.id === id) ?? AVATARS[0]
    const rig = a.id === 'anime' ? await this.loadVrm('/models/vroid-b/AvatarSample_B.vrm') : await this.loadRocketbox()
    return { rig, credit: { text: a.credit, href: a.licence } }
  }

  private async loadRocketbox(): Promise<Rig> {
    const manager = new THREE.LoadingManager()
    // The model refers to its original TGA textures; we ship compressed WebP copies.
    manager.setURLModifier((url) => url.replace(/\.tga$/i, '.webp'))
    manager.addHandler(/\.tga$/i, new THREE.TextureLoader(manager))
    const obj = await new FBXLoader(manager).loadAsync('/models/patient/patient.fbx')
    obj.scale.setScalar(0.01)
    // Put the pelvis joint at the body group's origin.
    obj.position.set(0, -0.923, 0)
    const bones: Record<string, THREE.Bone> = {}
    let mesh: THREE.SkinnedMesh | null = null
    obj.traverse((o) => {
      const b = o as THREE.Bone
      if (b.isBone) bones[b.name] = b
      const m = o as THREE.SkinnedMesh
      if (m.isSkinnedMesh) {
        mesh = m
        m.castShadow = true
        m.receiveShadow = true
        m.frustumCulled = false
        const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshPhongMaterial[]
        m.material = mats.map((old) => this.upgrade(old))
      }
    })
    const skin = mesh as THREE.SkinnedMesh | null
    const morph: Record<string, number> = {}
    for (const [k, i] of Object.entries(skin?.morphTargetDictionary ?? {})) morph[k.replace(/^blendShape1\./, '')] = i
    const set = (k: string, v: number) => {
      const i = morph[k]
      if (i !== undefined && skin?.morphTargetInfluences) skin.morphTargetInfluences[i] = v
    }
    const pair = (n: string): Pair => ({ L: bones[`Bip01_L_${n}`], R: bones[`Bip01_R_${n}`] })
    return {
      root: obj,
      bones: Object.values(bones),
      neck: bones.Bip01_Neck,
      head: bones.Bip01_Head,
      chest: bones.Bip01_Spine2,
      nose: bones.Bip01_MNose,
      clavicle: pair('Clavicle'),
      thigh: pair('Thigh'),
      calf: pair('Calf'),
      foot: pair('Foot'),
      toe: pair('Toe0'),
      upperArm: pair('UpperArm'),
      forearm: pair('Forearm'),
      hand: pair('Hand'),
      eye: { L: bones.Bip01_LEye, R: bones.Bip01_REye },
      eyeDepth: 0,
      hipAbove: 0.11,
      face: (e) => {
        set('AK_09_EyeBlinkLeft', e.closed)
        set('AK_10_EyeBlinkRight', e.closed)
        set('AK_19_EyeSquintLeft', e.squint)
        set('AK_20_EyeSquintRight', e.squint)
        set('AK_03_BrowInnerUp', e.distress)
        set('AK_01_BrowDownLeft', e.distress * 0.4)
        set('AK_02_BrowDownRight', e.distress * 0.4)
      },
      tick: () => {},
      settle: () => {},
      dispose: () => disposeTree(obj),
    }
  }

  /** A VRM avatar: standard humanoid bones, preset expressions, spring-bone hair. */
  private async loadVrm(url: string): Promise<Rig> {
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    const gltf = await loader.loadAsync(url)
    const vrm = gltf.userData.vrm as VRM
    VRMUtils.removeUnnecessaryVertices(gltf.scene)
    VRMUtils.combineSkeletons(gltf.scene)
    // VRM 0 models face -Z; turn them to face +Z like the rest of the room expects.
    VRMUtils.rotateVRM0(vrm)
    const raw = (n: VRMHumanBoneName) => vrm.humanoid.getRawBoneNode(n) as THREE.Object3D
    const pair = (l: VRMHumanBoneName, r: VRMHumanBoneName): Pair => ({ L: raw(l), R: raw(r) })

    // Scale to the reference torso and put the hips joint at the body group's origin.
    const holder = new THREE.Group()
    holder.add(vrm.scene)
    holder.updateMatrixWorld(true)
    const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
    const hips = at(raw('hips'))
    const s = TORSO / hips.distanceTo(at(raw('neck')))
    holder.scale.setScalar(s)
    holder.position.copy(hips).multiplyScalar(-s)
    holder.updateMatrixWorld(true)

    vrm.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        m.frustumCulled = false
      }
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update()
    })

    // VRoid's eye bones sit near the middle of the head. Find the skin between the eyes, so the goggles and the nose
    // sit where they do on the realistic avatar: eyeballs about 1 cm behind the skin, the nose 4 cm ahead of them.
    const head = raw('head')
    const eyes = at(raw('leftEye')).add(at(raw('rightEye'))).multiplyScalar(0.5)
    const fwd = new THREE.Vector3(0, 0, 1)
    const skin = new THREE.Raycaster(eyes.clone().addScaledVector(fwd, 0.5), fwd.clone().negate()).intersectObject(vrm.scene, true).find((h) => {
      const mat = (h.object as THREE.Mesh).material
      return !(Array.isArray(mat) ? mat[h.face?.materialIndex ?? 0] : mat).transparent
    })
    const eyeDepth = skin ? Math.max(0, 0.5 - skin.distance - 0.012) : 0
    const nose = new THREE.Object3D()
    head.add(nose)
    nose.position.copy(head.worldToLocal(eyes.addScaledVector(fwd, eyeDepth + 0.039).add(new THREE.Vector3(0, -0.028, 0))))
    const em = vrm.expressionManager
    const bones = Object.values(vrm.humanoid.rawHumanBones).map((b) => b!.node as THREE.Object3D)
    return {
      root: holder,
      bones,
      neck: raw('neck'),
      head,
      chest: raw('chest'),
      nose,
      clavicle: pair('leftShoulder', 'rightShoulder'),
      thigh: pair('leftUpperLeg', 'rightUpperLeg'),
      calf: pair('leftLowerLeg', 'rightLowerLeg'),
      foot: pair('leftFoot', 'rightFoot'),
      toe: pair('leftToes', 'rightToes'),
      upperArm: pair('leftUpperArm', 'rightUpperArm'),
      forearm: pair('leftLowerArm', 'rightLowerArm'),
      hand: pair('leftHand', 'rightHand'),
      eye: pair('leftEye', 'rightEye'),
      eyeDepth,
      hipAbove: 0.1,
      face: (e) => {
        if (!em) return
        em.setValue('blink', Math.max(e.closed, e.squint * 0.45))
        em.setValue('sad', e.distress * 0.7)
        em.update()
      },
      // What `vrm.update` does, less the humanoid and look-at updates, which would undo the posing: constraints, hair,
      // and the materials (MToon only hands its alpha cut-off to the shader here; without it, cut-out hair goes black).
      tick: (dt) => {
        vrm.nodeConstraintManager?.update()
        vrm.springBoneManager?.update(dt)
        for (const m of vrm.materials ?? []) (m as THREE.Material & { update?: (dt: number) => void }).update?.(dt)
      },
      settle: () => {
        vrm.springBoneManager?.reset()
        for (const m of vrm.materials ?? []) (m as THREE.Material & { update?: (dt: number) => void }).update?.(0)
      },
      dispose: () => VRMUtils.deepDispose(vrm.scene),
    }
  }

  /** Physically based skin, cloth and hair from the model's Phong materials. */
  private upgrade(old: THREE.MeshPhongMaterial): THREE.Material {
    const name = old.name || ''
    const map = old.map
    if (map) map.colorSpace = THREE.SRGBColorSpace
    if (/opacity/i.test(name)) {
      return new THREE.MeshStandardMaterial({ name, map, alphaMap: undefined, transparent: false, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, normalMap: old.normalMap ?? undefined })
    }
    const head = /head/i.test(name)
    return new THREE.MeshPhysicalMaterial({
      name,
      map,
      normalMap: old.normalMap ?? undefined,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: head ? 0.52 : 0.68,
      sheen: head ? 0.35 : 0.5,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(head ? '#ffb8a0' : '#c0b8b0'),
      clearcoat: head ? 0.05 : 0,
      envMapIntensity: 0.8,
    })
  }

  /* ------------------------------------------------------------------ posing */

  /** Body orientation: face toward the foot end when sitting, face up when lying, then rolled about the couch. */
  private bodyQuat() {
    const q = new THREE.Quaternion()
    const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pose.roll * 90 * DEG)
    const lieQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.pose.lie * 90 * DEG)
    const faceQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 90 * DEG)
    return q.multiply(rollQ).multiply(lieQ).multiply(faceQ)
  }

  /** Rotate a bone, in world space, by `delta`. */
  private turn(bone: THREE.Object3D, delta: THREE.Quaternion) {
    bone.updateWorldMatrix(true, false)
    const boneW = bone.getWorldQuaternion(new THREE.Quaternion())
    const parentW = (bone.parent as THREE.Object3D).getWorldQuaternion(new THREE.Quaternion())
    bone.quaternion.copy(parentW.invert().multiply(delta.clone().multiply(boneW)))
    bone.updateMatrixWorld(true)
  }

  /** Swing a bone so that the line to its child points along `dir` (world). */
  private aim(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
    bone.updateWorldMatrix(true, true)
    const a = bone.getWorldPosition(new THREE.Vector3())
    const b = child.getWorldPosition(new THREE.Vector3())
    const cur = b.sub(a).normalize()
    this.turn(bone, new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize()))
  }

  applyPose() {
    const R = this.rig
    if (!R) return
    const p = this.pose
    for (const [bone, q] of this.bind) bone.quaternion.copy(q)
    const q = this.bodyQuat()
    this.body.quaternion.copy(q)
    this.body.position.set(p.hipX, COUCH.top + R.hipAbove, 0)
    this.body.updateMatrixWorld(true)

    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q)
    const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.roll * 90 * DEG)

    // Head first: turn about the neck, then extend (or flex), shared between the neck and the head. Where the
    // collarbones hang off the neck (the realistic skeleton), they are turned back to keep the shoulders still.
    for (const [bone, share] of [
      [R.neck, 0.4],
      [R.head, 0.6],
    ] as const) {
      const yawQ = new THREE.Quaternion().setFromAxisAngle(up, -p.yaw * DEG * share)
      const pitchQ = new THREE.Quaternion().setFromAxisAngle(right, (p.ext - p.flex) * DEG * share)
      const delta = pitchQ.multiply(yawQ)
      this.turn(bone, delta)
      if (bone === R.neck) for (const c of [R.clavicle.L, R.clavicle.R]) if (c?.parent === bone) this.turn(c, delta.clone().invert())
    }

    // Legs out along the couch; toes up (turned with any roll).
    const along = new THREE.Vector3(1, 0, 0)
    const toes = new THREE.Vector3(0.25, 1, 0).applyQuaternion(rollQ)
    for (const s of ['L', 'R'] as const) {
      const side = s === 'R' ? right : right.clone().negate()
      this.aim(R.thigh[s], R.calf[s], along.clone().addScaledVector(side, 0.04))
      this.aim(R.calf[s], R.foot[s], along.clone().addScaledVector(up, -0.01))
      const toe = R.toe[s]
      if (toe) this.aim(R.foot[s], toe, toes)
      // Arms: by her sides, forearms resting on her thighs when she sits and along her sides when she lies.
      const upperDir = up.clone().negate().addScaledVector(side, 0.18).addScaledVector(fwd, 0.08 * (1 - p.lie))
      this.aim(R.upperArm[s], R.forearm[s], upperDir)
      const foreDir = up.clone().negate().multiplyScalar(0.35 + p.lie * 0.65).addScaledVector(fwd, 0.9 * (1 - p.lie)).addScaledVector(side, 0.05)
      this.aim(R.forearm[s], R.hand[s], foreDir)
    }

    this.applyEyes()
  }

  /** Torsion about each eye's line of sight (positive: upper pole toward her right ear); vertical (positive up). */
  applyEyes() {
    const R = this.rig
    if (!R) return
    const hq = R.head.getWorldQuaternion(new THREE.Quaternion())
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.body.quaternion)
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.body.quaternion)
    // The head's own axes, from the body axes turned by the head's rotation relative to its bind pose.
    const rel = hq.clone().multiply(this.bindWorldHead().invert())
    const look = fwd.applyQuaternion(rel).normalize()
    const r = right.applyQuaternion(rel).normalize()
    for (const eye of [R.eye.R, R.eye.L]) {
      eye.quaternion.copy(this.bind.get(eye)!)
      eye.updateMatrixWorld(true)
      const tq = new THREE.Quaternion().setFromAxisAngle(look, this.eyes.torsion * DEG)
      // An eyeball turns about its centre, about 1.2 cm behind the cornea; a deeper eye bone moves the iris further
      // for the same angle, so the angle is scaled to keep the iris moving as far.
      const vq = new THREE.Quaternion().setFromAxisAngle(r, (this.eyes.vertical * DEG * 0.012) / (0.012 + R.eyeDepth))
      this.turn(eye, tq.multiply(vq))
    }
    R.face(this.eyes)
  }

  private headBindWorld: THREE.Quaternion | null = null
  /** The head bone's world rotation in the bind pose, under the current body orientation. */
  private bindWorldHead() {
    // Head and neck in the bind pose sit in the body frame, so this is body * (bind chain), cached per orientation.
    const q = this.body.quaternion.clone()
    if (!this.headBindWorld && this.rig) {
      const saved = new Map<THREE.Object3D, THREE.Quaternion>()
      for (const [b] of this.bind) saved.set(b, b.quaternion.clone())
      for (const [b, bq] of this.bind) b.quaternion.copy(bq)
      const bq0 = this.body.quaternion.clone()
      this.body.quaternion.identity()
      this.body.updateMatrixWorld(true)
      this.headBindWorld = this.rig.head.getWorldQuaternion(new THREE.Quaternion())
      this.body.quaternion.copy(bq0)
      for (const [b, sq] of saved) b.quaternion.copy(sq)
      this.body.updateMatrixWorld(true)
    }
    return this.headBindWorld ? q.multiply(this.headBindWorld.clone()) : q
  }

  /* ------------------------------------------------------------------ cameras and picking */

  setView(v: View) {
    this.view = v
  }

  private aimCamera() {
    const far = this.camera.aspect < 1 ? 1.55 : 1
    if (this.view === 'overview') {
      this.wantPos.set(this.pose.hipX + 0.5 * far, 1.3 + 0.25 * far, 2.2 * far)
      this.wantLook.set(this.pose.hipX - 0.15, 0.9, 0)
    } else if (this.view === 'front') {
      // In front of her and a little to her right, at face height: you see the face turn.
      const hx = this.pose.hipX
      this.wantPos.set(hx + 0.75 * far, 1.42, 0.62 * far)
      this.wantLook.set(hx - 0.02, 1.36, 0)
    } else if (this.view === 'side') {
      // From her right, at the head end: you see her go down and the head drop over the end.
      this.wantPos.set(0.12, 1.12 + 0.12 * far, 1.25 * far)
      this.wantLook.set(0.06, 0.86, 0)
    } else if (this.view === 'above') {
      // Standing at the head end, looking down into her upturned face (upside down to you): her left is your left,
      // and the nose sweeps straight across the screen as the head turns.
      const hx = this.pose.hipX - 0.6
      const d = this.camera.aspect < 1 ? 1.3 : 1
      this.wantPos.set(hx - 0.5 * d, 0.8 + 0.58 * d, 0)
      this.wantLook.set(hx + 0.04, 0.72, 0)
    } else if (this.view === 'left') {
      // From her left side, as she rolls toward you.
      this.wantPos.set(0.3, 1.25 + 0.18 * far, -1.05 * far)
      this.wantLook.set(0.12, 0.84, 0)
    } else {
      const eyes = this.eyeCentre()
      const head = this.rig?.head
      if (eyes && head) {
        const face = new THREE.Vector3(0, 0, 1).applyQuaternion(this.body.quaternion).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.bindWorldHead().invert()))
        this.wantPos.copy(eyes).addScaledVector(face, 0.34 + (this.rig?.eyeDepth ?? 0)).add(new THREE.Vector3(0, 0.03, 0))
        this.wantLook.copy(eyes)
      }
    }
  }

  eyeCentre() {
    const R = this.rig
    if (!R) return null
    return R.eye.R.getWorldPosition(new THREE.Vector3()).add(R.eye.L.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5)
  }

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
    this.onFrame?.(dt)
    this.applyPose()
    if (this.rig) {
      this.body.updateMatrixWorld(true)
      this.rig.tick(dt)
    }
    this.aimCamera()
    const k = 1 - Math.exp(-dt * 4)
    this.camPos.lerp(this.wantPos, k)
    this.camLook.lerp(this.wantLook, k)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, this.host.clientWidth, this.host.clientHeight)
    this.renderer.render(this.scene, this.camera)
    this.renderGoggles()
    this.frame = requestAnimationFrame(this.loop)
  }

  /** The goggle inset: both eyes, upright and close, as a video-oculography screen shows them. */
  private renderGoggles() {
    const g = this.goggles
    const eyes = this.eyeCentre()
    const head = this.rig?.head
    if (!g || !eyes || !head) return
    const rel = head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.bindWorldHead().invert())
    const face = new THREE.Vector3(0, 0, 1).applyQuaternion(this.body.quaternion).applyQuaternion(rel)
    const top = new THREE.Vector3(0, 1, 0).applyQuaternion(this.body.quaternion).applyQuaternion(rel)
    this.eyeCam.position.copy(eyes).addScaledVector(face, 0.16 + (this.rig?.eyeDepth ?? 0))
    this.eyeCam.up.copy(top)
    this.eyeCam.lookAt(eyes)
    const W = this.host.clientWidth
    const H = this.host.clientHeight
    const w = g.w * W
    const h = g.h * H
    const x = g.x * W
    const y = H - (g.y * H + h)
    this.eyeCam.aspect = w / h
    this.eyeCam.updateProjectionMatrix()
    this.renderer.setScissorTest(true)
    this.renderer.setScissor(x, y, w, h)
    this.renderer.setViewport(x, y, w, h)
    const bg = this.scene.background
    this.scene.background = new THREE.Color('#05070a')
    this.renderer.render(this.scene, this.eyeCam)
    this.scene.background = bg
    this.renderer.setScissorTest(false)
  }

  /** Where a joint would appear on screen if the pose were changed by `change`: lets a drag follow the finger. */
  probe(change: Partial<Pose>, joint: Joint = 'nose') {
    const saved = { ...this.pose }
    this.pose = { ...this.pose, ...change }
    this.applyPose()
    const at = this.screenOfJoint(joint)
    this.pose = saved
    this.applyPose()
    return at
  }

  /** Where a joint appears on screen, in CSS pixels. `shoulder` is her right shoulder. */
  screenOfJoint(joint: Joint) {
    const R = this.rig
    const bone = !R ? null : joint === 'nose' ? R.nose : joint === 'head' ? R.head : joint === 'shoulder' ? R.upperArm.R : R.chest
    if (!bone) return null
    this.camera.updateMatrixWorld()
    const v = bone.getWorldPosition(new THREE.Vector3()).project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.rig?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

/** Free a model's GPU geometry, materials and textures. */
function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
      mat.dispose()
    }
  })
}
