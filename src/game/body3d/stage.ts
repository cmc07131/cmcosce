import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * The clinic the 3D benches share: renderer, lights, floor, wall and curtain, and the examination couch.
 * World: metres, Y up. The couch runs along +X; its head end is at x = 0; +Z faces the default camera.
 */

export const COUCH = { top: 0.72, length: 1.9, width: 0.66 }

/** A renderer filling `host`: ACES tone mapping, soft shadows, the room's environment light. */
export function createRenderer(host: HTMLElement, scene: THREE.Scene) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.touchAction = 'none'
  host.appendChild(renderer.domElement)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.background = new THREE.Color('#dfe5ea')
  scene.fog = new THREE.Fog('#dfe5ea', 6, 14)
  return renderer
}

export function buildRoom(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight('#f4f6ff', '#9a8f86', 0.55)
  scene.add(hemi)
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
  scene.add(key, key.target)
  const rim = new THREE.DirectionalLight('#dce8ff', 1.1)
  rim.position.set(-2.2, 2.4, -2)
  scene.add(rim)
  const fill = new THREE.PointLight('#ffffff', 0.9, 6, 2)
  fill.position.set(-0.6, 1.9, 1.4)
  scene.add(fill)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: '#c9ccc8', roughness: 0.62, metalness: 0 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  const wallMat = new THREE.MeshStandardMaterial({ color: '#eef1f2', roughness: 0.9 })
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.2), wallMat)
  back.position.set(0, 1.6, -2.8)
  back.receiveShadow = true
  scene.add(back)
  // A skirting strip and a curtain on its rail give the room scale.
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: '#8fa3b0', roughness: 0.6 }))
  skirt.position.set(0, 0.05, -2.79)
  scene.add(skirt)
  const curtain = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.1, 40, 1, true, Math.PI * 0.62, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: '#9ec3c9', roughness: 0.95, side: THREE.DoubleSide }))
  curtain.position.set(2.7, 1.15, -0.6)
  scene.add(curtain)
}

/** The examination couch; returns the top, so a bench can tilt a backrest or pick against it. */
export function buildCouch(scene: THREE.Scene) {
  const vinyl = new THREE.MeshPhysicalMaterial({ color: '#3d6f80', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.5 })
  const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 1, roughness: 0.22 })
  const paper = new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.95 })
  const top = new THREE.Mesh(new RoundedBoxGeometry(COUCH.length, 0.09, COUCH.width, 4, 0.03), vinyl)
  top.position.set(COUCH.length / 2, COUCH.top - 0.045, 0)
  top.castShadow = true
  top.receiveShadow = true
  scene.add(top)
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(COUCH.length - 0.15, 0.004, 0.5), paper)
  sheet.position.set(COUCH.length / 2 + 0.05, COUCH.top + 0.002, 0)
  sheet.receiveShadow = true
  scene.add(sheet)
  const base = new THREE.Mesh(new RoundedBoxGeometry(COUCH.length - 0.3, 0.06, COUCH.width - 0.12, 3, 0.02), chrome)
  base.position.set(COUCH.length / 2, 0.08, 0)
  base.castShadow = true
  scene.add(base)
  for (const x of [0.25, COUCH.length - 0.25])
    for (const z of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, COUCH.top - 0.13, 20), chrome)
      leg.position.set(x, (COUCH.top - 0.1) / 2 + 0.07, z)
      leg.castShadow = true
      scene.add(leg)
    }
  return top
}
