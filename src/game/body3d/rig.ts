import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'

/**
 * A patient model, whatever its skeleton: Microsoft Rocketbox avatars (FBX, Biped bones, ARKit face shapes) or VRM
 * avatars (VRoid, the player's own). Each loads into a `Rig` that names the joints the 3D benches pose, drives the face,
 * and measures the body it was given.
 *
 * Every rig stands in its own frame like this: metres, Y up, the face toward +Z, the patient's right toward -X, the
 * hip joint at the origin. A bench parents `rig.root` to its body group and turns that.
 */

export const DEG = Math.PI / 180
/** Hip joint to neck joint of the realistic adult avatar. VRM adults are scaled to it (their own scales vary). */
export const TORSO = 0.535

export type Side = 'L' | 'R'
export type Pair = Record<Side, THREE.Object3D>
export type Sides = Record<Side, number>
export type Credit = { text: string; href?: string }

/**
 * Eyes and face. Eye angles in degrees: `torsion` about the line of sight (positive: upper pole to her right ear),
 * `vertical` (up), `horizontal` (to her right). The rest 0..1. Movements she is asked for are per side, as a palsy is.
 */
export type Eyes = {
  torsion: number
  vertical: number
  horizontal?: number
  closed: number
  squint: number
  distress: number
  brows?: Sides
  shut?: Sides
  smile?: Sides
  cheeks?: number
  mouth?: number
}

export type Rig = {
  root: THREE.Object3D
  /** Every bone the posing touches; reset to the bind pose each frame. */
  bones: THREE.Object3D[]
  hips: THREE.Object3D
  spine: THREE.Object3D
  chest: THREE.Object3D
  neck: THREE.Object3D
  head: THREE.Object3D
  /** A point at the tip of the nose (some skeletons have no nose bone). */
  nose: THREE.Object3D
  clavicle: Partial<Pair>
  upperArm: Pair
  forearm: Pair
  hand: Pair
  /** Index finger, first bone: where the nails and pulps are. */
  finger: Partial<Pair>
  /** Ring finger, first bone. */
  ring: Partial<Pair>
  /** Each hand's digits, thumb to little finger, each its bones from the knuckle out. */
  digits: Record<Side, THREE.Object3D[][]>
  /** Each hand bone's rotation in the body frame, in the bind pose (for finding the palm when posed). */
  handBind: Record<Side, THREE.Quaternion>
  thumb: Partial<Pair>
  thigh: Pair
  calf: Pair
  foot: Pair
  toe: Partial<Pair>
  eye: Pair
  /** The head bone's rotation in the body frame, in the bind pose. */
  headBind: THREE.Quaternion
  /** How far the eyeballs sit in front of the eye bones (cameras on the eyes stand off this much further). */
  eyeDepth: number
  /** Height of the hip joint above a couch she lies on: the depth of her back below the joint. */
  hipAbove: number
  /** Standing height, top of the head to the soles. */
  height: number
  /** Height of the hip joint above the soles, standing. */
  legLength: number
  /** Every mesh of the body, for picking where a finger lands. */
  meshes: THREE.Mesh[]
  face(e: Eyes): void
  /**
   * Uncover parts of the body (0 covered … 1 bare). On the realistic models the clothes there take her skin tone;
   * VRM models keep their clothes (their bodies are not modelled underneath).
   */
  expose(parts: { trunk: number; arms: number; legs: number }): void
  /** Blanch the skin (0 … 1): the fingertips (a capillary refill press) or the whole hand (no blood getting there). */
  pale(p: { fingersL: number; handL: number; fingersR: number; handR: number }): void
  /** After posing, each frame: hair and clothes that swing; material animation. */
  tick(dt: number): void
  /** Let swinging parts come to rest in the current pose. */
  settle(): void
  dispose(): void
}

/* ------------------------------------------------------------------ posing helpers */

/** Rotate a bone, in world space, by `delta`. */
export function turn(bone: THREE.Object3D, delta: THREE.Quaternion) {
  bone.updateWorldMatrix(true, false)
  const boneW = bone.getWorldQuaternion(new THREE.Quaternion())
  const parentW = (bone.parent as THREE.Object3D).getWorldQuaternion(new THREE.Quaternion())
  bone.quaternion.copy(parentW.invert().multiply(delta.clone().multiply(boneW)))
  bone.updateMatrixWorld(true)
}

/** Swing a bone so that the line to its child points along `dir` (world). */
export function aim(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
  bone.updateWorldMatrix(true, true)
  const a = bone.getWorldPosition(new THREE.Vector3())
  const b = child.getWorldPosition(new THREE.Vector3())
  const cur = b.sub(a)
  if (cur.lengthSq() < 1e-10) return
  turn(bone, new THREE.Quaternion().setFromUnitVectors(cur.normalize(), dir.clone().normalize()))
}

/**
 * Turn each eye about its own centre: torsion about the line of sight, then up and across. An eyeball turns about a
 * centre about 1.2 cm behind the cornea; a deeper eye bone moves the iris further for the same angle, so the up and
 * across angles are scaled to keep the iris moving as far.
 */
export function poseEyes(rig: Rig, bind: Map<THREE.Object3D, THREE.Quaternion>, body: THREE.Object3D, e: Eyes) {
  const rel = rig.head.getWorldQuaternion(new THREE.Quaternion()).multiply(body.quaternion.clone().multiply(rig.headBind).invert())
  const axis = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(body.quaternion).applyQuaternion(rel).normalize()
  const look = axis(0, 0, 1)
  const right = axis(-1, 0, 0)
  const up = axis(0, 1, 0)
  const lever = 0.012 / (0.012 + rig.eyeDepth)
  for (const eye of [rig.eye.R, rig.eye.L]) {
    const q = bind.get(eye)
    if (q) eye.quaternion.copy(q)
    eye.updateMatrixWorld(true)
    const delta = new THREE.Quaternion()
      .setFromAxisAngle(look, e.torsion * DEG)
      .multiply(new THREE.Quaternion().setFromAxisAngle(right, e.vertical * DEG * lever))
      .multiply(new THREE.Quaternion().setFromAxisAngle(up, -((e.horizontal ?? 0) * DEG * lever)))
    turn(eye, delta)
  }
  rig.face(e)
}

/* ------------------------------------------------------------------ Rocketbox (FBX) */

/** A Rocketbox avatar from `<dir>/patient.fbx` and its WebP textures (see scripts/slim-rocketbox.py). */
export async function loadRocketbox(dir: string): Promise<Rig> {
  const manager = new THREE.LoadingManager()
  // The model refers to its original TGA textures; we ship compressed WebP copies.
  manager.setURLModifier((url) => url.replace(/\.tga$/i, '.webp'))
  manager.addHandler(/\.tga$/i, new THREE.TextureLoader(manager))
  const obj = await new FBXLoader(manager).loadAsync(`${dir}/patient.fbx`)
  obj.scale.setScalar(0.01)
  const bones: Record<string, THREE.Bone> = {}
  const meshes: THREE.Mesh[] = []
  let skin: THREE.SkinnedMesh | null = null
  obj.traverse((o) => {
    const b = o as THREE.Bone
    if (b.isBone) bones[b.name] = b
    const m = o as THREE.SkinnedMesh
    if (m.isSkinnedMesh) {
      skin ??= m
      meshes.push(m)
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshPhongMaterial[]
      m.material = mats.map(upgrade)
    }
  })
  // Put the pelvis joint at the origin.
  obj.updateMatrixWorld(true)
  obj.position.sub(bones.Bip01_Pelvis.getWorldPosition(new THREE.Vector3()))
  obj.updateMatrixWorld(true)

  const face = skin as THREE.SkinnedMesh | null
  const exposure = exposable(meshes)
  const shape = (re: RegExp) => Object.entries(face?.morphTargetDictionary ?? {}).find(([k]) => re.test(k))?.[1]
  const S = {
    blinkL: shape(/EyeBlinkLeft/),
    blinkR: shape(/EyeBlinkRight/),
    squintL: shape(/EyeSquintLeft/),
    squintR: shape(/EyeSquintRight/),
    browInner: shape(/BrowInnerUp/),
    browDownL: shape(/BrowDownLeft/),
    browDownR: shape(/BrowDownRight/),
    browOuterL: shape(/BrowOuterUpLeft/),
    browOuterR: shape(/BrowOuterUpRight/),
    smileL: shape(/MouthSmileLeft/),
    smileR: shape(/MouthSmileRight/),
    stretchL: shape(/MouthStretchLeft/),
    stretchR: shape(/MouthStretchRight/),
    cheeks: shape(/CheekPuff/),
    jaw: shape(/JawOpen/),
  }
  const set = (i: number | undefined, v: number) => {
    if (i !== undefined && face?.morphTargetInfluences) face.morphTargetInfluences[i] = Math.max(0, Math.min(1, v))
  }
  const pair = (n: string): Pair => ({ L: bones[`Bip01_L_${n}`], R: bones[`Bip01_R_${n}`] })
  const rig: Rig = {
    root: obj,
    bones: Object.values(bones),
    hips: bones.Bip01_Pelvis,
    spine: bones.Bip01_Spine,
    chest: bones.Bip01_Spine2,
    neck: bones.Bip01_Neck,
    head: bones.Bip01_Head,
    nose: bones.Bip01_MNose,
    clavicle: pair('Clavicle'),
    upperArm: pair('UpperArm'),
    forearm: pair('Forearm'),
    hand: pair('Hand'),
    finger: pair('Finger1'),
    ring: pair('Finger3'),
    digits: {
      L: [0, 1, 2, 3, 4].map((d) => [`Bip01_L_Finger${d}`, `Bip01_L_Finger${d}1`, `Bip01_L_Finger${d}2`].map((n) => bones[n]).filter(Boolean)),
      R: [0, 1, 2, 3, 4].map((d) => [`Bip01_R_Finger${d}`, `Bip01_R_Finger${d}1`, `Bip01_R_Finger${d}2`].map((n) => bones[n]).filter(Boolean)),
    },
    handBind: { L: bones.Bip01_L_Hand.getWorldQuaternion(new THREE.Quaternion()), R: bones.Bip01_R_Hand.getWorldQuaternion(new THREE.Quaternion()) },
    thumb: pair('Finger0'),
    thigh: pair('Thigh'),
    calf: pair('Calf'),
    foot: pair('Foot'),
    toe: pair('Toe0'),
    eye: { L: bones.Bip01_LEye, R: bones.Bip01_REye },
    headBind: bones.Bip01_Head.getWorldQuaternion(new THREE.Quaternion()),
    eyeDepth: 0,
    hipAbove: 0.11,
    height: 1.7,
    legLength: 0.9,
    meshes,
    face: (e) => {
      const shut = e.shut ?? { L: 0, R: 0 }
      const brows = e.brows ?? { L: 0, R: 0 }
      const smile = e.smile ?? { L: 0, R: 0 }
      set(S.blinkL, Math.max(e.closed, shut.L))
      set(S.blinkR, Math.max(e.closed, shut.R))
      set(S.squintL, Math.max(e.squint, shut.L * 0.8))
      set(S.squintR, Math.max(e.squint, shut.R * 0.8))
      set(S.browInner, Math.max(e.distress, (brows.L + brows.R) / 2))
      set(S.browOuterL, brows.L)
      set(S.browOuterR, brows.R)
      set(S.browDownL, e.distress * 0.4)
      set(S.browDownR, e.distress * 0.4)
      set(S.smileL, smile.L)
      set(S.smileR, smile.R)
      set(S.stretchL, smile.L * 0.5)
      set(S.stretchR, smile.R * 0.5)
      set(S.cheeks, e.cheeks ?? 0)
      set(S.jaw, e.mouth ?? 0)
    },
    expose: (parts) => exposure.set(parts.trunk, parts.arms, parts.legs),
    pale: (p) => exposure.pale(p),
    tick: () => {},
    settle: () => {},
    dispose: () => disposeTree(obj),
  }
  measure(rig, false)
  return rig
}

/**
 * Let the clothes on a Rocketbox body give way to skin, part by part: each vertex is tagged by the bone that moves it
 * most (trunk, arms, legs and feet; hands, head and neck are skin already), and the body material blends its colour to
 * a skin tone sampled from the patient's own face where that part is uncovered.
 */
function exposable(meshes: THREE.Mesh[]) {
  const on = new THREE.Vector3(0, 0, 0)
  const pallor = new THREE.Vector4(0, 0, 0, 0)
  const paleTone = new THREE.Color('#f1e7e2')
  const tone = new THREE.Color('#d9a68a')
  const region = (name: string) =>
    /Pelvis|Spine|Clavicle/.test(name) ? 1 : /UpperArm|Forearm/.test(name) ? 2 : /Thigh|Calf|Foot|Toe/.test(name) ? 3 : /L_Finger/.test(name) ? 4 : /L_Hand/.test(name) ? 5 : /R_Finger/.test(name) ? 6 : /R_Hand/.test(name) ? 7 : 0
  for (const mesh of meshes) {
    const m = mesh as THREE.SkinnedMesh
    if (!m.isSkinnedMesh) continue
    const idx = m.geometry.attributes.skinIndex
    const wgt = m.geometry.attributes.skinWeight
    const tags = new Float32Array(idx.count)
    for (let i = 0; i < idx.count; i++) {
      let best = 0
      let bestW = -1
      for (let k = 0; k < 4; k++) {
        const w = wgt.getComponent(i, k)
        if (w > bestW) {
          bestW = w
          best = idx.getComponent(i, k)
        }
      }
      tags[i] = region(m.skeleton.bones[best]?.name ?? '')
    }
    m.geometry.setAttribute('exposeRegion', new THREE.BufferAttribute(tags, 1))
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (!/body/i.test(mat.name)) continue
      // Her skin tone, from the face texture once it has loaded (the middle of the cheek).
      const head = (Array.isArray(m.material) ? m.material : [m.material]).find((x) => /head/i.test(x.name)) as THREE.MeshStandardMaterial | undefined
      sampleSkin(head?.map ?? null, tone)
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.exposeOn = { value: on }
        shader.uniforms.pallor = { value: pallor }
        shader.uniforms.paleTone = { value: paleTone }
        shader.uniforms.skinTone = { value: tone }
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float exposeRegion;\nuniform vec3 exposeOn;\nuniform vec4 pallor;\nvarying float vExpose;\nvarying float vPale;')
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvExpose = exposeRegion < 0.5 ? 0.0 : exposeRegion < 1.5 ? exposeOn.x : exposeRegion < 2.5 ? exposeOn.y : exposeRegion < 3.5 ? exposeOn.z : 0.0;\nvPale = exposeRegion < 3.5 ? 0.0 : exposeRegion < 4.5 ? pallor.x : exposeRegion < 5.5 ? pallor.y : exposeRegion < 6.5 ? pallor.z : pallor.w;',
          )
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 skinTone;\nuniform vec3 paleTone;\nvarying float vExpose;\nvarying float vPale;')
          .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, skinTone, vExpose);\ndiffuseColor.rgb = mix(diffuseColor.rgb, paleTone, vPale);')
      }
      mat.needsUpdate = true
    }
  }
  return {
    set: (trunk: number, arms: number, legs: number) => on.set(trunk, arms, legs),
    // A pale hand still has a fingertip: the fingers blanch at least as much as the hand.
    pale: (p: { fingersL: number; handL: number; fingersR: number; handR: number }) => pallor.set(Math.max(p.fingersL, p.handL), p.handL, Math.max(p.fingersR, p.handR), p.handR),
  }
}

/** The colour of the middle of the cheek on a face texture, once its image is there (linear, as shaders want it). */
function sampleSkin(map: THREE.Texture | null, into: THREE.Color) {
  const read = () => {
    const img = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined
    if (!img?.width) return false
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 8
      const g = c.getContext('2d')
      if (!g) return true
      // Rocketbox face maps: the cheek sits a little below and to the side of the centre.
      g.drawImage(img, img.width * 0.3, img.height * 0.52, img.width * 0.08, img.height * 0.08, 0, 0, 8, 8)
      const d = g.getImageData(0, 0, 8, 8).data
      let r = 0
      let gr = 0
      let b = 0
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]
        gr += d[i + 1]
        b += d[i + 2]
      }
      const n = d.length / 4
      into.setRGB(r / n / 255, gr / n / 255, b / n / 255, THREE.SRGBColorSpace)
    } catch {
      // A tainted canvas or no 2D context: keep the default tone.
    }
    return true
  }
  if (!read()) {
    const id = window.setInterval(() => read() && window.clearInterval(id), 300)
    window.setTimeout(() => window.clearInterval(id), 15000)
  }
}

/** Physically based skin, cloth and hair from Rocketbox's Phong materials. */
function upgrade(old: THREE.MeshPhongMaterial): THREE.Material {
  const name = old.name || ''
  const map = old.map
  if (map) map.colorSpace = THREE.SRGBColorSpace
  if (/opacity/i.test(name)) {
    return new THREE.MeshStandardMaterial({ name, map, transparent: false, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, normalMap: old.normalMap ?? undefined })
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

/* ------------------------------------------------------------------ VRM */

/** A VRM avatar: standard humanoid bones, preset expressions, spring-bone hair. Scaled to the adult torso. */
export async function loadVrm(url: string): Promise<Rig> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  const gltf = await loader.loadAsync(url)
  const vrm = gltf.userData.vrm as VRM
  VRMUtils.removeUnnecessaryVertices(gltf.scene)
  VRMUtils.combineSkeletons(gltf.scene)
  // VRM 0 models face -Z; turn them to face +Z like the rest of the room expects.
  VRMUtils.rotateVRM0(vrm)
  const raw = (n: VRMHumanBoneName) => vrm.humanoid.getRawBoneNode(n) as THREE.Object3D
  const opt = (n: VRMHumanBoneName) => (vrm.humanoid.getRawBoneNode(n) as THREE.Object3D | null) ?? undefined
  const pair = (l: VRMHumanBoneName, r: VRMHumanBoneName): Pair => ({ L: raw(l), R: raw(r) })

  // Scale to the reference torso and put the hips joint at the origin.
  const holder = new THREE.Group()
  holder.add(vrm.scene)
  holder.updateMatrixWorld(true)
  const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
  const hips = at(raw('hips'))
  const s = TORSO / hips.distanceTo(at(raw('neck')))
  holder.scale.setScalar(s)
  holder.position.copy(hips).multiplyScalar(-s)
  holder.updateMatrixWorld(true)

  const meshes: THREE.Mesh[] = []
  vrm.scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      meshes.push(m)
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false
    }
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update()
  })

  const head = raw('head')
  const nose = new THREE.Object3D()
  head.add(nose)
  const em = vrm.expressionManager
  const bones = Object.values(vrm.humanoid.rawHumanBones).map((b) => b!.node as THREE.Object3D)
  const update = (dt: number) => {
    for (const m of vrm.materials ?? []) (m as THREE.Material & { update?: (dt: number) => void }).update?.(dt)
  }
  const rig: Rig = {
    root: holder,
    bones,
    hips: raw('hips'),
    spine: raw('spine'),
    chest: opt('upperChest') ?? raw('chest'),
    neck: raw('neck'),
    head,
    nose,
    clavicle: pair('leftShoulder', 'rightShoulder'),
    upperArm: pair('leftUpperArm', 'rightUpperArm'),
    forearm: pair('leftLowerArm', 'rightLowerArm'),
    hand: pair('leftHand', 'rightHand'),
    finger: { L: opt('leftIndexProximal'), R: opt('rightIndexProximal') } as Partial<Pair>,
    ring: { L: opt('leftRingProximal'), R: opt('rightRingProximal') } as Partial<Pair>,
    digits: {
      L: vrmDigits('left', opt),
      R: vrmDigits('right', opt),
    },
    handBind: { L: raw('leftHand').getWorldQuaternion(new THREE.Quaternion()), R: raw('rightHand').getWorldQuaternion(new THREE.Quaternion()) },
    thumb: { L: opt('leftThumbProximal') ?? opt('leftThumbMetacarpal'), R: opt('rightThumbProximal') ?? opt('rightThumbMetacarpal') } as Partial<Pair>,
    thigh: pair('leftUpperLeg', 'rightUpperLeg'),
    calf: pair('leftLowerLeg', 'rightLowerLeg'),
    foot: pair('leftFoot', 'rightFoot'),
    toe: { L: opt('leftToes'), R: opt('rightToes') } as Partial<Pair>,
    eye: pair('leftEye', 'rightEye'),
    headBind: head.getWorldQuaternion(new THREE.Quaternion()),
    eyeDepth: 0,
    hipAbove: 0.1,
    height: 1.7,
    legLength: 0.9,
    meshes,
    face: (e) => {
      if (!em) return
      const shut = e.shut ?? { L: 0, R: 0 }
      const brows = e.brows ?? { L: 0, R: 0 }
      const smile = e.smile ?? { L: 0, R: 0 }
      // VRM presets: lids per side; brows, smile and cheeks only for both sides together.
      em.setValue('blink', Math.max(e.closed, e.squint * 0.45))
      em.setValue('blinkLeft', shut.L)
      em.setValue('blinkRight', shut.R)
      em.setValue('surprised', Math.max(brows.L, brows.R) * 0.7)
      em.setValue('sad', e.distress * 0.7)
      em.setValue('ih', Math.max(smile.L, smile.R) * 0.8)
      em.setValue('ou', (e.cheeks ?? 0) * 0.8)
      em.setValue('aa', e.mouth ?? 0)
      em.update()
    },
    // What `vrm.update` does, less the humanoid and look-at updates, which would undo the posing: constraints, hair,
    // and the materials (MToon only hands its alpha cut-off to the shader here; without it, cut-out hair goes black).
    expose: () => {},
    pale: () => {},
    tick: (dt) => {
      vrm.nodeConstraintManager?.update()
      vrm.springBoneManager?.update(dt)
      update(dt)
    },
    settle: () => {
      vrm.springBoneManager?.reset()
      update(0)
    },
    dispose: () => VRMUtils.deepDispose(vrm.scene),
  }
  measure(rig, true)
  return rig
}

/** A VRM hand's digits, thumb to little finger (VRM 1 names; three-vrm maps VRM 0 thumbs onto them). */
function vrmDigits(side: 'left' | 'right', opt: (n: VRMHumanBoneName) => THREE.Object3D | undefined): THREE.Object3D[][] {
  const thumb = (['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'] as const).map((n) => opt(`${side}${n}` as VRMHumanBoneName))
  const finger = (f: string) => (['Proximal', 'Intermediate', 'Distal'] as const).map((n) => opt(`${side}${f}${n}` as VRMHumanBoneName))
  return [thumb, finger('Index'), finger('Middle'), finger('Ring'), finger('Little')].map((d) => d.filter((b): b is THREE.Object3D => !!b))
}

/* ------------------------------------------------------------------ measuring the body */

/**
 * Measure what differs between bodies, in the bind pose (the rig not yet parented): her height, and from it the depth
 * of her back below the hip joint; and for a VRM (`placeNose`), the skin between the eyes (VRoid eye bones sit near the middle of the
 * head) and a nose tip, as it has no nose bone.
 */
function measure(rig: Rig, placeNose: boolean) {
  rig.root.updateMatrixWorld(true)
  for (const m of rig.meshes) if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).skeleton.update()
  const opaque = (h: THREE.Intersection) => {
    const mat = (h.object as THREE.Mesh).material
    const m = Array.isArray(mat) ? mat[h.face?.materialIndex ?? 0] : mat
    return !!m && !m.transparent && m.visible
  }
  const hit = (from: THREE.Vector3, dir: THREE.Vector3) => new THREE.Raycaster(from, dir.clone().normalize()).intersectObjects(rig.meshes, false).find(opaque)
  const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())

  // Height: from the soles to the top of the head. The depth of the back below the hip joint scales with it (measured
  // directly, a skirt or a coat flaring behind would lift her off the couch): 11 cm for a 1.72 m adult.
  const top = hit(at(rig.head).add(new THREE.Vector3(0, 0.6, 0)), new THREE.Vector3(0, -1, 0))
  const sole = Math.min(at(rig.foot.L).y, at(rig.foot.R).y) - 0.08
  if (top) rig.height = top.point.y - sole
  rig.legLength = at(rig.hips).y - sole
  rig.hipAbove = (0.11 * rig.height) / 1.72

  // The skin between the eyes, and the nose tip ahead of the eyeballs.
  const eyes = at(rig.eye.L).add(at(rig.eye.R)).multiplyScalar(0.5)
  const skin = hit(eyes.clone().add(new THREE.Vector3(0, 0, 0.5)), new THREE.Vector3(0, 0, -1))
  // (Rocketbox eye bones are the eyeball centres already, and it has a nose bone.)
  if (placeNose) {
    if (skin) rig.eyeDepth = Math.max(0, skin.point.z - eyes.z - 0.012)
    rig.nose.position.copy(rig.head.worldToLocal(eyes.clone().add(new THREE.Vector3(0, -0.028, rig.eyeDepth + 0.039))))
  }
}

/** Free a model's GPU geometry, materials and textures. */
export function disposeTree(root: THREE.Object3D) {
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
