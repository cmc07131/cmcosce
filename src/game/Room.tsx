import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  DIR_DELTA,
  buildSolids,
  findPath,
  keyOf,
  keyToDir,
  planActivation,
  step,
  targetTilesFor,
  tilesOf,
} from '~/engine/grid'
import { readoutText, type Dir, type Pack, type Pos, type Tile } from '~/engine/schema'
import { ActorSprite, PropArt } from './sprites'

export type RoomHandle = {
  useFacing: () => void
  setJoy: (dir: Dir | null) => void
}

const STEP_MS = 190

type Visual = { x: number; y: number; facing: Dir; frame: number; bob: number }
type Glide = { sx: number; sy: number; tx: number; ty: number; facing: Dir; t: number }

function facingBetween(a: Tile, b: Tile): Dir {
  if (b.x > a.x) return 'e'
  if (b.x < a.x) return 'w'
  if (b.y > a.y) return 's'
  return 'n'
}

function patientPose(scene: string[]) {
  const found = [...scene].reverse().find((flag) => flag.startsWith('pose:'))
  if (!found) return undefined
  return found.slice(5) === 'lateral' ? 'lateral' : 'knee'
}

function SceneMarks({ scene }: { scene: string[] }) {
  return (
    <>
      {scene.includes('lift') && <span className="absolute right-0 bottom-1 h-2 w-2 bg-[#f4d7b8] border border-[#303848]" />}
      {scene.includes('cover') && <span className="absolute bottom-0 left-1 h-2 w-3 bg-[#f7f7f2] border border-[#303848]" />}
      {scene.includes('listen') && <span className="absolute top-1 left-0 h-2 w-2 rounded-full bg-[#3070c0]" />}
      {scene.includes('cannula') && <span className="absolute top-2 right-0 h-2 w-1 bg-[#d85a6a]" />}
    </>
  )
}

function hitAt(pack: Pack, x: number, y: number) {
  const npc = pack.cast.find((c) => c.spawn.x === x && c.spawn.y === y)
  if (npc) return npc.id
  const item = pack.room.interactables.find((entry) =>
    tilesOf(entry).some((tile) => tile.x === x && tile.y === y),
  )
  return item?.id ?? null
}

const FLOORS: Record<string, [string, string]> = {
  'resus-bay': ['#efe6c8', '#e4d7b0'],
  cubicle: ['#f3ead4', '#e7dcc0'],
  'skills-bench': ['#e7f0d4', '#d5e4bc'],
  'teaching-room': ['#e7eef8', '#d5e0f0'],
}

export const Room = forwardRef<RoomHandle, {
  pack: Pack
  position: Pos
  paused: boolean
  talkIds: string[]
  scene: string[]
  onMove: (pos: Pos) => void
  onUse: (targetId: string) => void
  onEmpty: () => void
}>(function Room({ pack, position, paused, talkIds, scene, onMove, onUse, onEmpty }, ref) {
  const { cols, rows } = pack.room
  const solids = useRef(buildSolids(pack))
  solids.current = buildSolids(pack)
  const visualRef = useRef<Visual>({ x: position.x, y: position.y, facing: position.facing, frame: 0, bob: 0 })
  const [visual, setVisual] = useState(visualRef.current)
  const glide = useRef<Glide | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const joyRef = useRef<Dir | null>(null)
  const keyRef = useRef<Dir | null>(null)
  const heldRef = useRef<Dir | null>(null)
  const pathRef = useRef<Tile[]>([])
  const pendingRef = useRef<string | null>(null)
  const pendingFacing = useRef<Dir>('n')
  const moveRef = useRef(onMove)
  const useRefCb = useRef(onUse)
  const emptyRef = useRef(onEmpty)
  moveRef.current = onMove
  useRefCb.current = onUse
  emptyRef.current = onEmpty
  const [ghost, setGhost] = useState<Tile[]>([])
  const frame = useRef<HTMLDivElement>(null)
  const [tilePx, setTilePx] = useState(28)

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const size = Math.floor(Math.min(rect.width / cols, rect.height / rows))
      setTilePx(Math.max(12, size))
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [cols, rows])

  function gridNow(): Pos {
    const v = visualRef.current
    return { x: Math.round(v.x), y: Math.round(v.y), facing: v.facing }
  }

  function show(next: Visual) {
    visualRef.current = next
    setVisual(next)
  }

  function tryStep() {
    if (glide.current || pausedRef.current) return
    const here = gridNow()
    const held = heldRef.current
    if (held) {
      pathRef.current = []
      pendingRef.current = null
      setGhost([])
      const next = step(here, held, solids.current, cols, rows)
      if (next.x === here.x && next.y === here.y) {
        if (here.facing !== held) show({ ...visualRef.current, facing: held, bob: 0, frame: 0 })
        return
      }
      glide.current = { sx: visualRef.current.x, sy: visualRef.current.y, tx: next.x, ty: next.y, facing: held, t: 0 }
      return
    }
    if (pathRef.current.length) {
      const nxt = pathRef.current[0]
      pathRef.current = pathRef.current.slice(1)
      const facing = pathRef.current.length ? facingBetween(here, nxt) : pendingFacing.current
      glide.current = { sx: visualRef.current.x, sy: visualRef.current.y, tx: nxt.x, ty: nxt.y, facing, t: 0 }
      setGhost([...pathRef.current])
      return
    }
    if (pendingRef.current) {
      const id = pendingRef.current
      pendingRef.current = null
      const faced = { ...here, facing: pendingFacing.current }
      show({ ...visualRef.current, facing: pendingFacing.current, bob: 0, frame: 0 })
      moveRef.current(faced)
      useRefCb.current(id)
    }
  }

  useEffect(() => {
    if (glide.current) return
    const v = visualRef.current
    if (Math.round(v.x) === position.x && Math.round(v.y) === position.y && v.facing === position.facing) return
    const next = { x: position.x, y: position.y, facing: position.facing, frame: 0, bob: 0 }
    visualRef.current = next
    setVisual(next)
  }, [position.x, position.y, position.facing])

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
        show({
          x: m.sx + (m.tx - m.sx) * t,
          y: m.sy + (m.ty - m.sy) * t,
          facing: m.facing,
          frame: Math.floor(t * 4) % 2,
          bob: Math.sin(t * Math.PI),
        })
        if (t >= 1) {
          glide.current = null
          show({ x: m.tx, y: m.ty, facing: m.facing, frame: 0, bob: 0 })
          moveRef.current({ x: m.tx, y: m.ty, facing: m.facing })
          tryStep()
        }
      } else if (!pausedRef.current) {
        tryStep()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [cols, rows])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const dir = keyToDir(event.key)
      if (!dir) return
      event.preventDefault()
      keyRef.current = dir
      heldRef.current = dir
    }
    const up = (event: KeyboardEvent) => {
      const dir = keyToDir(event.key)
      if (!dir) return
      if (keyRef.current === dir) keyRef.current = null
      heldRef.current = keyRef.current ?? joyRef.current
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  function goTo(tile: Tile) {
    if (pausedRef.current) return
    const here = gridNow()
    const hit = hitAt(pack, tile.x, tile.y)
    if (hit) {
      const plan = planActivation(here, targetTilesFor(pack, hit), solids.current, cols, rows)
      if (!plan) {
        emptyRef.current()
        return
      }
      pendingFacing.current = plan.facing
      if (!plan.path.length) {
        const next = { ...here, facing: plan.facing }
        show({ ...visualRef.current, facing: plan.facing, bob: 0, frame: 0 })
        moveRef.current(next)
        useRefCb.current(hit)
        return
      }
      pendingRef.current = hit
      pathRef.current = plan.path
      setGhost(plan.path)
      return
    }
    if (solids.current.has(keyOf(tile))) return
    const path = findPath(here, tile, solids.current, cols, rows)
    if (!path) return
    pendingRef.current = null
    pathRef.current = path
    setGhost(path)
  }

  useImperativeHandle(ref, () => ({
    setJoy: (dir) => {
      joyRef.current = dir
      heldRef.current = keyRef.current ?? dir
    },
    useFacing: () => {
      if (pausedRef.current || glide.current) return
      const pos = gridNow()
      const d = DIR_DELTA[pos.facing]
      const hit = hitAt(pack, pos.x + d.x, pos.y + d.y)
      if (!hit) {
        emptyRef.current()
        return
      }
      useRefCb.current(hit)
    },
  }))

  const colors = FLOORS[pack.room.template ?? 'resus-bay'] ?? FLOORS['resus-bay']
  const boardW = tilePx * cols
  const boardH = tilePx * rows

  return (
    <div ref={frame} className="relative min-h-0 flex-1" data-testid="bay">
      <div
        className="absolute top-1/2 left-1/2"
        style={{ width: boardW, height: boardH, transform: 'translate(-50%, -50%)' }}
      >
        {Array.from({ length: rows }, (_, y) =>
          Array.from({ length: cols }, (_, x) => (
            <div
              key={`f${x}-${y}`}
              className="absolute"
              style={{
                left: x * tilePx,
                top: y * tilePx,
                width: tilePx,
                height: tilePx,
                background: (x + y) % 2 === 0 ? colors[0] : colors[1],
              }}
            />
          )),
        )}
        {pack.room.props.map((prop) =>
          tilesOf(prop).map((tile, index) => (
            <div
              key={`${prop.id}-${index}`}
              className="absolute"
              style={{ left: tile.x * tilePx, top: tile.y * tilePx, width: tilePx, height: tilePx }}
            >
              <PropArt kind={prop.kind} />
            </div>
          )),
        )}
        {pack.room.props.map((prop) => {
          const text = readoutText(prop.readout, scene)
          if (!text) return null
          return (
            <div
              key={`${prop.id}-readout`}
              className="pointer-events-none absolute z-[6]"
              data-testid={`readout-${prop.id}`}
              style={{
                left: prop.x * tilePx,
                top: prop.y * tilePx,
                width: (prop.w ?? 1) * tilePx,
                height: (prop.h ?? 1) * tilePx,
              }}
            >
              <span className="absolute right-0 bottom-1 left-0 text-center font-body text-[10px] leading-none text-[#9dff7a]">
                {text}
              </span>
            </div>
          )
        })}
        {pack.room.interactables.map((item) => (
          <div
            key={item.id}
            className="pointer-events-none absolute"
            style={{ left: item.x * tilePx, top: item.y * tilePx, width: (item.w ?? 1) * tilePx, height: (item.h ?? 1) * tilePx }}
          >
            {item.kind !== 'bed' && <PropArt kind={item.kind} />}
            {item.label.trim() && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 border border-[#303848] bg-[#f8f8e0] px-0.5 font-body text-[10px] leading-none whitespace-nowrap text-[#28241c]">
                {item.label}
              </span>
            )}
          </div>
        ))}
        {ghost.map((tile, index) => (
          <div
            key={`g${index}-${tile.x}-${tile.y}`}
            className="pointer-events-none absolute rounded-full bg-white/70"
            style={{
              left: tile.x * tilePx + tilePx / 2 - 3,
              top: tile.y * tilePx + tilePx / 2 - 3,
              width: 6,
              height: 6,
              background: '#303848',
            }}
          />
        ))}
        {pack.cast.map((npc) => (
          <div
            key={npc.id}
            className="pointer-events-none absolute"
            style={{ left: npc.spawn.x * tilePx, top: npc.spawn.y * tilePx, width: tilePx, height: tilePx }}
            data-testid={`npc-${npc.id}`}
          >
            <ActorSprite
              role={npc.pixelKey ?? npc.role}
              facing="s"
              talk={talkIds.includes(npc.id)}
              pose={npc.id === 'patient' ? patientPose(scene) : undefined}
            />
            {npc.id === 'patient' && <SceneMarks scene={scene} />}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#f8f8e0] px-0.5 font-body text-[10px] leading-none text-[#303848]">
              {npc.displayName}
            </span>
          </div>
        ))}
        <div
          className="pointer-events-none absolute z-10"
          data-testid="player"
          data-pos={`${Math.round(visual.x)},${Math.round(visual.y)},${visual.facing}`}
          style={{
            left: visual.x * tilePx,
            top: visual.y * tilePx - visual.bob * 3,
            width: tilePx,
            height: tilePx,
          }}
        >
          <ActorSprite role="doctor" facing={visual.facing} frame={visual.frame} gloved={scene.includes('dress')} talk={talkIds.includes('player')} />
        </div>
        {Array.from({ length: rows }, (_, y) =>
          Array.from({ length: cols }, (_, x) => (
            <button
              key={`t${x}-${y}`}
              type="button"
              data-testid={`tile-${x}-${y}`}
              aria-label={`Tile ${x},${y}`}
              className="absolute z-20 bg-transparent"
              style={{ left: x * tilePx, top: y * tilePx, width: tilePx, height: tilePx }}
              onClick={() => goTo({ x, y })}
            />
          )),
        )}
      </div>
    </div>
  )
})
