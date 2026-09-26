import { useEffect, useMemo, useRef, useState } from 'react'
import { findPath, keyOf, step } from '~/engine/grid'
import type { Dir, Pos, Tile } from '~/engine/schema'
import { heldDir } from '~/game/input'
import { TILE, actorSprite } from '~/game/pixel/art'
import { grassOverlay, renderWorld } from './art'
import { charAt, tileKind, worldSolids, type World } from './model'

const STEP_MS = 180

type Visual = { x: number; y: number; facing: Dir; frame: number; bob: number }
type Glide = { sx: number; sy: number; tx: number; ty: number; facing: Dir; t: number; stride: number }

function facingBetween(a: Tile, b: Tile): Dir {
  if (b.x > a.x) return 'e'
  if (b.x < a.x) return 'w'
  if (b.y > a.y) return 's'
  return 'n'
}

/**
 * The overworld: a pre-painted map, the player on a second canvas, and a camera that follows.
 * `onArrive` fires on every completed step; the parent decides about doors and grass.
 */
export function WorldScreen({
  world,
  position,
  paused,
  closedGyms,
  onMove,
  onArrive,
  onBump,
}: {
  world: World
  position: Pos
  paused: boolean
  closedGyms: Set<string>
  onMove: (pos: Pos) => void
  onArrive: (x: number, y: number) => void
  onBump: () => void
}) {
  const { cols, rows } = world
  const solids = useMemo(() => worldSolids(world), [world])
  const frame = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLCanvasElement>(null)
  const fg = useRef<HTMLCanvasElement>(null)
  const view = useRef({ w: 0, h: 0 })
  const [scale, setScale] = useState(2)
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const visual = useRef<Visual>({ x: position.x, y: position.y, facing: position.facing, frame: 0, bob: 0 })
  const glide = useRef<Glide | null>(null)
  const stride = useRef(0)
  const pathRef = useRef<Tile[]>([])
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const cb = useRef({ onMove, onArrive, onBump })
  cb.current = { onMove, onArrive, onBump }

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      view.current = { w: rect.width, h: rect.height }
      setScale(Math.max(2, Math.min(4, Math.floor(rect.width / (TILE * 10)))))
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // The map is painted once.
  useEffect(() => {
    const cv = bg.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    c.imageSmoothingEnabled = false
    c.drawImage(renderWorld(world, closedGyms), 0, 0)
  }, [world, closedGyms])

  // A teleport or a load moves the player without walking.
  useEffect(() => {
    if (glide.current) return
    const v = visual.current
    if (Math.round(v.x) === position.x && Math.round(v.y) === position.y && v.facing === position.facing) return
    pathRef.current = []
    visual.current = { x: position.x, y: position.y, facing: position.facing, frame: 0, bob: 0 }
  }, [position.x, position.y, position.facing])

  function gridNow(): Pos {
    const v = visual.current
    return { x: Math.round(v.x), y: Math.round(v.y), facing: v.facing }
  }

  function startGlide(to: Tile, facing: Dir) {
    stride.current = stride.current === 1 ? 2 : 1
    glide.current = { sx: visual.current.x, sy: visual.current.y, tx: to.x, ty: to.y, facing, t: 0, stride: stride.current }
  }

  function tryStep() {
    if (glide.current || pausedRef.current) return
    const here = gridNow()
    const held = heldDir()
    if (held) {
      pathRef.current = []
      const next = step(here, held, solids, cols, rows)
      if (next.x === here.x && next.y === here.y) {
        if (here.facing !== held) {
          visual.current = { ...visual.current, facing: held }
          cb.current.onMove({ ...here, facing: held })
        } else cb.current.onBump()
        return
      }
      startGlide(next, held)
      return
    }
    if (pathRef.current.length) {
      const nxt = pathRef.current[0]
      pathRef.current = pathRef.current.slice(1)
      startGlide(nxt, facingBetween(here, nxt))
    }
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(32, now - last)
      last = now
      if (!pausedRef.current && glide.current) {
        glide.current.t += dt / STEP_MS
        const m = glide.current
        const t = Math.min(1, m.t)
        visual.current = { x: m.sx + (m.tx - m.sx) * t, y: m.sy + (m.ty - m.sy) * t, facing: m.facing, frame: t < 0.5 ? m.stride : 0, bob: t < 0.5 ? 1 : 0 }
        if (t >= 1) {
          glide.current = null
          visual.current = { x: m.tx, y: m.ty, facing: m.facing, frame: 0, bob: 0 }
          cb.current.onMove({ x: m.tx, y: m.ty, facing: m.facing })
          cb.current.onArrive(m.tx, m.ty)
          tryStep()
        }
      } else if (!pausedRef.current) tryStep()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world])

  function draw() {
    const cv = fg.current
    const c = cv?.getContext('2d')
    const ly = layer.current
    if (!cv || !c || !ly) return
    const v = visual.current
    c.imageSmoothingEnabled = false
    c.clearRect(0, 0, cv.width, cv.height)
    for (const [i, t] of pathRef.current.entries()) {
      c.fillStyle = i === pathRef.current.length - 1 ? '#e04858' : 'rgba(24,24,32,0.6)'
      c.fillRect(t.x * TILE + 7, t.y * TILE + 7, 2, 2)
    }
    const x = Math.round(v.x * TILE)
    const y = Math.round(v.y * TILE - 2 - v.bob)
    c.drawImage(actorSprite('doctor', v.facing, v.frame), x, y)
    const tx = Math.round(v.x)
    const ty = Math.round(v.y)
    if (tileKind(charAt(world, tx, ty)) === 'tall' && !glide.current) grassOverlay(c, tx * TILE, ty * TILE)
    const s = scaleRef.current
    const worldW = cols * TILE * s
    const worldH = rows * TILE * s
    const { w, h } = view.current
    const cx = worldW <= w ? (w - worldW) / 2 : Math.min(0, Math.max(w - worldW, w / 2 - (v.x * TILE + 8) * s))
    const cy = worldH <= h ? (h - worldH) / 2 : Math.min(0, Math.max(h - worldH, h / 2 - (v.y * TILE + 8) * s))
    ly.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`
    ly.dataset.pos = `${tx},${ty},${v.facing}`
  }

  function goTo(tile: Tile) {
    if (pausedRef.current) return
    if (solids.has(keyOf(tile))) return
    const path = findPath(gridNow(), tile, solids, cols, rows)
    if (path) pathRef.current = path
  }

  const px = TILE * scale
  const labels = [
    ...world.gyms.map((g) => ({ id: g.id, text: closedGyms.has(g.id) ? `${g.name.replace(' GYM', '')} · CLOSED` : g.name, b: world.buildings.find((b) => b.id === g.id)! })),
    ...world.places.map((p) => ({ id: p.id, text: p.name, b: world.buildings.find((b) => b.id === p.id)! })),
  ]

  return (
    <div ref={frame} className="relative min-h-0 flex-1 overflow-hidden bg-[#181820]" data-testid="world">
      <div
        ref={layer}
        data-testid="player"
        className="absolute top-0 left-0"
        style={{ width: cols * px, height: rows * px }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = Math.floor((event.clientX - rect.left) / px)
          const y = Math.floor((event.clientY - rect.top) / px)
          if (x >= 0 && y >= 0 && x < cols && y < rows) goTo({ x, y })
        }}
      >
        <canvas ref={bg} width={cols * TILE} height={rows * TILE} className="pixelated absolute inset-0 h-full w-full" />
        <canvas ref={fg} width={cols * TILE} height={rows * TILE} className="pixelated absolute inset-0 h-full w-full" />
        {labels.map((l) => (
          <span key={l.id} className="map-tag world-tag" data-closed={closedGyms.has(l.id) || undefined} style={{ left: (l.b.x + l.b.w / 2) * px, top: l.b.y * px - 2 }}>
            {l.text}
          </span>
        ))}
      </div>
    </div>
  )
}

