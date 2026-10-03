import * as THREE from 'three'
import { castPatient, type AvatarId } from '../body3d/cast'
import { DEG, aim, poseEyes, turn, type Credit, type Eyes, type Rig } from '../body3d/rig'
import { COUCH, buildCouch, buildRoom, createRenderer } from '../body3d/stage'

export type { AvatarId } from '../body3d/cast'
export type { Credit, Eyes } from '../body3d/rig'
export { COUCH } from '../body3d/stage'

/**
 * The 3D examination room for the Dix–Hallpike and Epley: a lit clinic, an examination couch, and Mrs Chau posed
 * procedurally from a handful of numbers. Who plays her comes from the 3D PATIENT setting (see body3d/cast.ts).
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
export type View = 'overview' | 'front' | 'side' | 'above' | 'left' | 'eyes'
export type Joint = 'nose' | 'head' | 'chest' | 'shoulder'

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
    this.renderer = createRenderer(host, this.scene)
    buildRoom(this.scene)
    buildCouch(this.scene)
    this.scene.add(this.body)
    this.setAvatar(avatar)
    this.resize()
    this.loop()
  }

  /* ------------------------------------------------------------------ the patient */

  /** Swap who plays Mrs Chau. The pose carries over; the old model is let go once the new one is in. */
  setAvatar(id: AvatarId) {
    if (id === this.avatar) return this.ready
    this.avatar = id
    const token = ++this.loadToken
    this.ready = castPatient('woman', id).then(({ rig, credit }) => {
      if (this.disposed || token !== this.loadToken) return rig.dispose()
      this.credit = credit
      if (this.rig) {
        this.body.remove(this.rig.root)
        this.rig.dispose()
      }
      this.rig = rig
      this.bind = new Map(rig.bones.map((b) => [b, b.quaternion.clone()]))
      this.body.add(rig.root)
      this.applyPose()
      this.body.updateMatrixWorld(true)
      rig.settle()
    })
    return this.ready
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
      turn(bone, delta)
      if (bone === R.neck) for (const c of [R.clavicle.L, R.clavicle.R]) if (c?.parent === bone) turn(c, delta.clone().invert())
    }

    // Legs out along the couch; toes up (turned with any roll).
    const along = new THREE.Vector3(1, 0, 0)
    const toes = new THREE.Vector3(0.25, 1, 0).applyQuaternion(rollQ)
    for (const s of ['L', 'R'] as const) {
      const side = s === 'R' ? right : right.clone().negate()
      aim(R.thigh[s], R.calf[s], along.clone().addScaledVector(side, 0.04))
      aim(R.calf[s], R.foot[s], along.clone().addScaledVector(up, -0.01))
      const toe = R.toe[s]
      if (toe) aim(R.foot[s], toe, toes)
      // Arms: by her sides, forearms resting on her thighs when she sits and along her sides when she lies.
      const upperDir = up.clone().negate().addScaledVector(side, 0.18).addScaledVector(fwd, 0.08 * (1 - p.lie))
      aim(R.upperArm[s], R.forearm[s], upperDir)
      const foreDir = up.clone().negate().multiplyScalar(0.35 + p.lie * 0.65).addScaledVector(fwd, 0.9 * (1 - p.lie)).addScaledVector(side, 0.05)
      aim(R.forearm[s], R.hand[s], foreDir)
    }

    poseEyes(R, this.bind, this.body, this.eyes)
  }

  /** The head bone's world rotation in the bind pose, under the current body orientation. */
  private bindWorldHead() {
    const q = this.body.quaternion.clone()
    return this.rig ? q.multiply(this.rig.headBind) : q
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
