import * as THREE from 'three'
import type { ExamScene } from './scene'

/**
 * Development only: tools for looking at the examination animations frame by frame from the browser console, and for
 * auditing them (hands that jump or spin, hands and sleeves in the body, joints bent past what they go).
 *
 * `__shots(entries, times)` shows a grid of frames; `__audit(entries)` reports what is wrong with each manoeuvre.
 * Entries are focus entries (`finger-nose@pulp-R`) or anims (`ask:shrug`).
 */

type Win = Window & Record<string, unknown>

export function installDevtools(scene: ExamScene, manoeuvres: Record<string, { anim: string }>) {
  const w = window as unknown as Win
  const s = scene as unknown as {
    perform: (anim: string, site: string | null, side: 'R' | 'L') => number
    loop: () => void
    frame: number
    last: number
    aimCamera: () => void
    camPos: THREE.Vector3
    camLook: THREE.Vector3
    wantPos: THREE.Vector3
    wantLook: THREE.Vector3
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    examiner: { group: THREE.Group }
    examiner2: { group: THREE.Group }
    assistant: { group: THREE.Group }[]
    clash: (hand: unknown, sleeve: boolean) => { worst: number }
    rig: Record<string, Record<string, THREE.Object3D>> | null
  }
  w.__exam = scene
  const parse = (entry: string) => {
    const [key, site = null] = entry.split('@')
    const anim = manoeuvres[key]?.anim ?? key
    const side = (site?.match(/-(R|L)$/)?.[1] ?? 'R') as 'R' | 'L'
    return { anim, site, side }
  }
  /** Run one manoeuvre on a fake clock, calling `each` every frame. */
  const run = (entry: string, each: (t: number) => void) => {
    const { anim, site, side } = parse(entry)
    const dur = s.perform(anim, site, side)
    const realNow = performance.now.bind(performance)
    let fake = s.last
    performance.now = () => fake
    try {
      for (let i = 0; i < Math.round(dur * 30) + 4; i++) {
        fake += 1000 / 30
        s.loop()
        cancelAnimationFrame(s.frame)
        s.aimCamera()
        s.camPos.copy(s.wantPos)
        s.camLook.copy(s.wantLook)
        // `__cam = [x, y, z, dist]`: look at the chest from that way (world axes) instead, to see the whole of it.
        const cam = w.__cam as number[] | undefined
        const chest = s.rig?.chest as unknown as THREE.Object3D | undefined
        if (cam && chest) {
          const at = chest.getWorldPosition(new THREE.Vector3())
          s.camLook.copy(at)
          s.camPos.copy(at).addScaledVector(new THREE.Vector3(cam[0], cam[1], cam[2]).normalize(), cam[3] ?? 1.6)
        }
        each((i + 1) / 30)
      }
    } finally {
      performance.now = realNow
      s.last = realNow()
      s.loop()
    }
    return dur
  }
  const grab = (label: string, shots: [string, HTMLCanvasElement][]) => {
    s.camera.position.copy(s.camPos)
    s.camera.lookAt(s.camLook)
    s.renderer.render(s.scene, s.camera)
    const el = s.renderer.domElement
    const c = document.createElement('canvas')
    c.width = 420
    c.height = 400
    const k = Math.min(420 / el.width, 400 / el.height)
    c.getContext('2d')?.drawImage(el, 0, 0, el.width * k, el.height * k)
    shots.push([label, c])
  }
  const grid = (shots: [string, HTMLCanvasElement][]) => {
    const big = document.createElement('canvas')
    big.width = 840
    big.height = 400 * Math.ceil(shots.length / 2)
    const g = big.getContext('2d')
    if (!g) return
    shots.forEach(([n, c], i) => {
      g.drawImage(c, (i % 2) * 420, Math.floor(i / 2) * 400)
      g.fillStyle = '#000'
      g.font = '16px sans-serif'
      g.fillText(n, (i % 2) * 420 + 6, Math.floor(i / 2) * 400 + 18)
    })
    let img = document.getElementById('__snapimg') as HTMLImageElement | null
    if (!img) {
      img = document.createElement('img')
      img.id = '__snapimg'
      document.body.appendChild(img)
    }
    img.style.cssText = 'position:fixed;left:0;top:0;width:620px;z-index:99999;border:3px solid red;background:#fff'
    img.src = big.toDataURL()
  }
  w.__shots = (list: [string, number[]][]) => {
    s.renderer.setSize(420, 400, false)
    s.camera.aspect = 420 / 400
    s.camera.updateProjectionMatrix()
    const shots: [string, HTMLCanvasElement][] = []
    for (const [entry, times] of list) {
      const want = [...times]
      run(entry, (t) => {
        while (want.length && t >= want[0] - 1e-6) grab(`${entry} ${want.shift()!.toFixed(2)}s`, shots)
      })
    }
    grid(shots)
    return shots.length
  }
  /** One hand's speed (cm per frame) and how far into the body, frame by frame: where a jump comes from. */
  w.__trace = (entry: string, i = 0) => {
    const h = [s.examiner, s.examiner2, ...s.assistant][i]
    let last: THREE.Vector3 | null = null
    const rows: string[] = []
    run(entry, (t) => {
      if (!h.group.visible) {
        last = null
        return
      }
      const p = h.group.position.clone()
      const d = last ? p.distanceTo(last) * 100 : 0
      last = p
      rows.push(`${t.toFixed(2)} ${d.toFixed(1)}cm in${(s.clash(h, false).worst * 100).toFixed(1)} sl${(s.clash(h, true).worst * 100).toFixed(1)}`)
    })
    return rows.join('\n')
  }
  w.__audit = (entries: string[]) => {
    const hands = [s.examiner, s.examiner2, ...s.assistant]
    const R = s.rig
    const P = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
    const out: Record<string, string> = {}
    for (const entry of entries) {
      const r = { jump: 0, spin: 0, hand: 0, sleeve: 0, elbow: 0, knee: 0 }
      // When each worst moment was, and which hand (0 the examiner's right).
      const when: Record<string, string> = {}
      const worse = (k: keyof typeof r, x: number, t: number, i = 0) => {
        if (x <= r[k]) return
        r[k] = x
        when[k] = ` @${t.toFixed(2)}s#${i}`
      }
      const last: ({ p: THREE.Vector3; q: THREE.Quaternion } | null)[] = hands.map(() => null)
      const dur = run(entry, (t) => {
        hands.forEach((h, i) => {
          if (!h.group.visible) {
            last[i] = null
            return
          }
          const p = h.group.position.clone()
          const q = h.group.quaternion.clone()
          const l = last[i]
          if (l) {
            worse('jump', p.distanceTo(l.p) * 30, t, i)
            worse('spin', q.angleTo(l.q) * 30 * (180 / Math.PI), t, i)
          }
          last[i] = { p, q }
          worse('hand', s.clash(h, false).worst, t, i)
          worse('sleeve', s.clash(h, true).worst, t, i)
        })
        if (!R) return
        for (const side of ['R', 'L']) {
          const bend = (a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D) => 180 - P(a).sub(P(b)).angleTo(P(c).sub(P(b))) * (180 / Math.PI)
          worse('elbow', bend(R.upperArm[side], R.forearm[side], R.hand[side]), t)
          worse('knee', bend(R.thigh[side], R.calf[side], R.foot[side]), t)
        }
      })
      const bad = [
        r.jump > 1.5 ? `jump ${r.jump.toFixed(1)} m/s${when.jump}` : '',
        r.spin > 320 ? `spin ${r.spin.toFixed(0)}°/s${when.spin}` : '',
        r.hand > 0.004 ? `hand in ${(r.hand * 100).toFixed(1)} cm${when.hand}` : '',
        r.sleeve > 0.006 ? `sleeve in ${(r.sleeve * 100).toFixed(1)} cm${when.sleeve}` : '',
        r.elbow > 145 ? `elbow ${r.elbow.toFixed(0)}°${when.elbow}` : '',
        r.knee > 140 ? `knee ${r.knee.toFixed(0)}°${when.knee}` : '',
      ].filter(Boolean)
      out[entry] = `${dur.toFixed(1)}s ${bad.join(', ') || 'ok'}`
    }
    return out
  }
}
