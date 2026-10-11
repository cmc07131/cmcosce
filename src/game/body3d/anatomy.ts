import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * What lies under the skin of a bare leg, for the X-ray view: the bones (femur, patella, tibia, fibula, the bones of
 * the foot), the knee's menisci and ligaments (a torn ACL in two frayed stumps), blood in the joint, the arteries whose
 * pulses you feel in the foot, and the common peroneal nerve round the neck of the fibula.
 *
 * Built in the bind pose (standing: up +Y, face +Z) from the joints' positions, for a 1.72 m adult scaled by `k`, as
 * geometry already carrying its skinning (which bones move each part): see legs.ts, which binds it to the patient.
 */

export type Weights = [number, number][]

/** A structure: its geometry (with skin indices and weights), its colour, and whether it is see-through. */
export type Part = { geo: THREE.BufferGeometry; color: string; clear?: boolean }

export type Frame = { x: THREE.Vector3; y: THREE.Vector3; z: THREE.Vector3 }

export type LegGeometry = {
  /** Knee and ankle joints, and the sole's height. */
  K: THREE.Vector3
  A: THREE.Vector3
  sole: number
  /** The thigh's frame and the shin's (x out to the side, y up the bone, z to the front). */
  thigh: Frame
  shin: Frame
  /** Along the foot, and across it (outward). */
  fwd: THREE.Vector3
  across: THREE.Vector3
  /** Where the toes begin, from the ankle (m). */
  ball: number
  k: number
  /** Skin weights for a point anywhere on the leg (blended across the knee and the ankle). */
  weightsAt: (p: THREE.Vector3) => Weights
  bones: { thigh: number; calf: number; foot: number; toe: number }
}

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

/** Give a primitive its place and its skinning. */
function piece(geo: THREE.BufferGeometry, m: THREE.Matrix4, weights: Weights | ((p: THREE.Vector3) => Weights)) {
  const g = geo
  g.applyMatrix4(m)
  g.deleteAttribute('uv')
  const pos = g.attributes.position as THREE.BufferAttribute
  const index: number[] = []
  const weight: number[] = []
  const p = v()
  for (let i = 0; i < pos.count; i++) {
    const w = (typeof weights === 'function' ? weights(p.fromBufferAttribute(pos, i)) : weights).filter(([b, x]) => b >= 0 && x > 0).sort((a, b) => b[1] - a[1]).slice(0, 4)
    const sum = w.reduce((a, [, x]) => a + x, 0) || 1
    for (let j = 0; j < 4; j++) {
      index.push(w[j]?.[0] ?? 0)
      weight.push((w[j]?.[1] ?? 0) / sum)
    }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4))
  return g
}

/** A unit sphere stretched to radii (across, up, front) in a frame, at a point. */
function ellipsoid(at: THREE.Vector3, f: Frame, rx: number, ry: number, rz: number) {
  const m = new THREE.Matrix4().makeBasis(f.x.clone().multiplyScalar(rx), f.y.clone().multiplyScalar(ry), f.z.clone().multiplyScalar(rz)).setPosition(at)
  return { geo: new THREE.SphereGeometry(1, 20, 14), m }
}

/** A rod from `a` to `b` (tapering from `ra` to `rb`); `flat` squashes it across into a band. */
function rod(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb = ra, flat?: THREE.Vector3) {
  const dir = b.clone().sub(a)
  const len = dir.length()
  const y = dir.normalize()
  const x = (flat ?? (Math.abs(y.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0))).clone()
  x.sub(y.clone().multiplyScalar(x.dot(y))).normalize()
  const z = x.clone().cross(y).normalize()
  const m = new THREE.Matrix4().makeBasis(x.multiplyScalar(flat ? 0.3 : 1), y.multiplyScalar(len), z).setPosition(a.clone().add(b).multiplyScalar(0.5))
  return { geo: new THREE.CylinderGeometry(rb, ra, 1, 12, 6), m }
}

/** A smooth tube through points (a vessel, a nerve). */
function tube(points: THREE.Vector3[], r: number) {
  return { geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, r, 8), m: new THREE.Matrix4() }
}

/** A meniscus: a C lying on the tibial plateau, its gap facing `gap`. */
function meniscus(at: THREE.Vector3, f: Frame, r: number, arc: number, gap: THREE.Vector3, k: number) {
  const geo = new THREE.TorusGeometry(r, 0.0042 * k, 8, 36, arc)
  // Torus in its own XY plane, from angle 0 round to `arc`: the gap is centred on (arc + 2π) / 2.
  geo.rotateZ(Math.atan2(gap.dot(f.z), gap.dot(f.x)) - (arc + Math.PI * 2) / 2)
  geo.scale(1, 1, 0.65)
  const m = new THREE.Matrix4().makeBasis(f.x, f.z, f.y.clone().negate()).setPosition(at)
  return { geo, m }
}

export function legAnatomy(g: LegGeometry, opts: { effusion: boolean; torn: boolean }): Record<string, Part> {
  const { K, A, thigh: TF, shin: SF, k, bones: b } = g
  /** A point by the knee: so far up the thigh (or, negative, down the shin), out to the side, to the front. */
  const at = (d: number, out: number, front: number) => {
    const f = d >= 0 ? TF : SF
    return K.clone().addScaledVector(f.y, d * k).addScaledVector(f.x, out * k).addScaledVector(f.z, front * k)
  }
  /** A point by the ankle (up the shin, out, front). */
  const ankle = (up: number, out: number, front: number) => A.clone().addScaledVector(SF.y, up * k).addScaledVector(SF.x, out * k).addScaledVector(SF.z, front * k)
  /** A point in the foot: forward from the ankle, out, up from the sole. */
  const foot = (fwd: number, out: number, up: number) => v(A.x, g.sole + up * k, A.z).addScaledVector(g.fwd, fwd * k).addScaledVector(g.across, out * k)
  const footFrame: Frame = { x: g.across, y: v(0, 1, 0), z: g.fwd }
  const make = (list: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[], w: Weights | ((p: THREE.Vector3) => Weights)) =>
    mergeGeometries(list.map(({ geo, m }) => piece(geo, m, w)))!
  const T: Weights = [[b.thigh, 1]]
  const C: Weights = [[b.calf, 1]]
  const F: Weights = [[b.foot, 1]]
  const toes: Weights = b.toe >= 0 ? [[b.toe, 1]] : F

  const parts: Record<string, Part> = {
    femur: {
      color: '#f4f1e8',
      geo: make(
        [
          rod(at(0.3, 0, 0), at(0.085, 0, 0), 0.0135 * k),
          rod(at(0.09, 0, -0.002), at(0.03, 0, -0.004), 0.014 * k, 0.031 * k),
          ellipsoid(at(0.016, 0.021, -0.004), TF, 0.019 * k, 0.023 * k, 0.028 * k),
          ellipsoid(at(0.016, -0.021, -0.004), TF, 0.019 * k, 0.023 * k, 0.028 * k),
        ],
        T,
      ),
    },
    // The kneecap rides down the femur as the knee bends: partly with the shin.
    patella: {
      color: '#f4f1e8',
      geo: make([ellipsoid(at(0.03, 0, 0.041), TF, 0.021 * k, 0.024 * k, 0.009 * k)], [
        [b.thigh, 0.6],
        [b.calf, 0.4],
      ]),
    },
    tibia: {
      color: '#f4f1e8',
      geo: make(
        [
          ellipsoid(at(-0.014, 0.001, -0.002), SF, 0.037 * k, 0.011 * k, 0.029 * k),
          rod(at(-0.018, 0, 0), at(-0.085, -0.002, 0.004), 0.03 * k, 0.014 * k),
          ellipsoid(at(-0.062, 0, 0.02), SF, 0.009 * k, 0.012 * k, 0.007 * k),
          rod(at(-0.085, -0.002, 0.004), ankle(0.07, -0.004, 0.006), 0.012 * k),
          rod(ankle(0.07, -0.004, 0.006), ankle(0.01, -0.002, 0.002), 0.012 * k, 0.021 * k),
          ellipsoid(ankle(-0.004, -0.021, 0), SF, 0.007 * k, 0.014 * k, 0.01 * k),
        ],
        C,
      ),
    },
    fibula: {
      color: '#f4f1e8',
      geo: make(
        [
          ellipsoid(at(-0.03, 0.03, -0.012), SF, 0.009 * k, 0.01 * k, 0.009 * k),
          rod(at(-0.03, 0.03, -0.012), ankle(-0.012, 0.024, -0.006), 0.005 * k),
          ellipsoid(ankle(-0.012, 0.024, -0.006), SF, 0.007 * k, 0.016 * k, 0.01 * k),
        ],
        C,
      ),
    },
    'foot-bones': {
      color: '#f4f1e8',
      geo: mergeGeometries([
        make(
          [
            ellipsoid(ankle(-0.012, 0, 0.005), footFrame, 0.017 * k, 0.012 * k, 0.02 * k),
            ellipsoid(foot(-0.03, 0, 0.032), footFrame, 0.016 * k, 0.022 * k, 0.035 * k),
            ellipsoid(foot(0.045, -0.004, 0.045), footFrame, 0.025 * k, 0.014 * k, 0.018 * k),
            ...[0, 1, 2, 3, 4].map((i) => rod(foot(0.062, -0.022 + 0.011 * i, 0.038 - 0.003 * i), foot(g.ball / k, -0.026 + 0.0125 * i, 0.018), (i === 0 ? 0.006 : 0.0045) * k)),
          ],
          F,
        ),
        make(
          [0, 1, 2, 3, 4].map((i) => rod(foot(g.ball / k + 0.006, -0.026 + 0.0125 * i, 0.015), foot(g.ball / k + (i === 0 ? 0.05 : 0.042 - 0.004 * i), -0.026 + 0.0122 * i, 0.012), (i === 0 ? 0.006 : 0.0042) * k)),
          toes,
        ),
      ])!,
    },
    'medial-meniscus': { color: '#8fd3f0', geo: make([meniscus(at(-0.003, -0.019, 0), SF, 0.0165 * k, Math.PI * 1.55, SF.x, k)], C) },
    'lateral-meniscus': { color: '#8fd3f0', geo: make([meniscus(at(-0.003, 0.019, 0), SF, 0.0135 * k, Math.PI * 1.8, SF.x.clone().negate(), k)], C) },
    // Each ligament runs from the femur to the shin: it stretches as the shin moves on the femur.
    pcl: { color: '#e7b98a', geo: make([rod(at(0.012, -0.008, 0.008), at(-0.008, 0, -0.022), 0.0048 * k)], g.weightsAt) },
    mcl: { color: '#e7b98a', geo: make([rod(at(0.034, -0.042, -0.004), at(-0.07, -0.035, 0.002), 0.006 * k, 0.006 * k, SF.x)], g.weightsAt) },
    lcl: { color: '#e7b98a', geo: make([rod(at(0.03, 0.044, -0.006), at(-0.03, 0.031, -0.012), 0.0028 * k)], g.weightsAt) },
    arteries: {
      color: '#d1342f',
      geo: make(
        [
          // Anterior tibial, on into the dorsalis pedis between the first and second metatarsals.
          tube([ankle(0.08, -0.002, 0.022), ankle(0.005, -0.004, 0.028), foot(0.05, -0.006, 0.062), foot(0.09, -0.012, 0.05), foot(g.ball / k - 0.01, -0.016, 0.03)], 0.0022 * k),
          // Posterior tibial, behind the medial malleolus, into the sole.
          tube([at(-0.18, -0.012, -0.022), ankle(0.06, -0.016, -0.018), ankle(-0.012, -0.025, -0.016), foot(0.0, -0.022, 0.02), foot(0.06, -0.012, 0.012)], 0.0022 * k),
        ],
        g.weightsAt,
      ),
    },
    nerve: {
      color: '#f2c230',
      geo: make([tube([at(0.06, 0.02, -0.036), at(0.01, 0.034, -0.03), at(-0.035, 0.037, -0.016), at(-0.05, 0.035, 0.0), at(-0.065, 0.026, 0.012)], 0.0022 * k)], g.weightsAt),
    },
  }
  if (opts.torn) {
    // Torn: a stump from each end, frayed, with nothing between.
    const fem = at(0.012, 0.008, -0.012)
    const tib = at(-0.004, -0.003, 0.012)
    parts.acl = {
      color: '#d0342c',
      geo: mergeGeometries([make([rod(fem, fem.clone().lerp(tib, 0.38), 0.0045 * k, 0.0015 * k)], T), make([rod(tib, tib.clone().lerp(fem, 0.3), 0.0045 * k, 0.0015 * k)], C)])!,
    }
  } else parts.acl = { color: '#e7b98a', geo: make([rod(at(0.012, 0.008, -0.012), at(-0.004, -0.003, 0.012), 0.0045 * k)], g.weightsAt) }
  if (opts.effusion)
    // Blood: in the pouch above the kneecap, and round the front of the joint.
    parts.effusion = {
      color: '#8e1b22',
      clear: true,
      geo: make([ellipsoid(at(0.062, 0, 0.029), TF, 0.034 * k, 0.042 * k, 0.011 * k), ellipsoid(at(0.012, 0, 0.027), TF, 0.04 * k, 0.022 * k, 0.008 * k)], g.weightsAt),
    }
  return parts
}
