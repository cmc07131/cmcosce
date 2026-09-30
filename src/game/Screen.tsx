import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  DIR_DELTA,
  buildSolids,
  findPath,
  keyOf,
  planActivation,
  step,
  targetTilesFor,
  tilesOf,
} from '~/engine/grid'
import { readoutText, type Dir, type Pack, type Pos, type Tile } from '~/engine/schema'
import { heldDir } from './input'
import {
  FLOOR_KINDS,
  INK,
  LOOKS,
  TILE,
  actorSprite,
  drawFloor,
  drawPatientInBed,
  drawProp,
  drawWallFace,
  drawWallTop,
  type BedPose,
  type PropBox,
} from './pixel/art'

export type Walk = { token: number; npcId: string; stops: string[] }

type Walker = {
  token: number
  stops: string[]
  index: number
  path: Tile[]
  from: Tile
  to: Tile | null
  t: number
  /** Where to look on arrival. */
  face: Tile | null
  /** Waiting at a stop until this time (ms). */
  pauseUntil: number
  /** If the walk has not reached the stop by then (a paused tab), it snaps there. */
  deadline: number
  carrying: boolean
}

export type ScreenHandle = {
  useFacing: () => void
  /** Just for fun: the NPC slaps the player (a wrong drug). A hand swipe, a burst, a shake. */
  slap: (npcId: string) => void
}

const STEP_MS = 190

type Visual = { x: number; y: number; facing: Dir; frame: number; bob: number }
type Glide = { sx: number; sy: number; tx: number; ty: number; facing: Dir; t: number; stride: number }

function facingBetween(a: Tile, b: Tile): Dir {
  if (b.x > a.x) return 'e'
  if (b.x < a.x) return 'w'
  if (b.y > a.y) return 's'
  return 'n'
}

function bedPose(scene: string[]): BedPose {
  const found = [...scene].reverse().find((flag) => flag.startsWith('pose:'))
  if (!found) return 'supine'
  return found.slice(5) === 'lateral' ? 'lateral' : 'knee'
}

function hitAt(pack: Pack, x: number, y: number, npcTiles: Record<string, Tile>) {
  const npc = pack.cast.find((c) => (npcTiles[c.id] ?? c.spawn).x === x && (npcTiles[c.id] ?? c.spawn).y === y)
  if (npc) return npc.id
  const item = pack.room.interactables.find((entry) => tilesOf(entry).some((tile) => tile.x === x && tile.y === y))
  return item?.id ?? null
}

function boxOf(entry: { id: string; kind: string; x: number; y: number; w?: number; h?: number }): PropBox {
  return { id: entry.id, kind: entry.kind, x: entry.x, y: entry.y, w: entry.w ?? 1, h: entry.h ?? 1 }
}

function inside(t: Tile, b: PropBox) {
  return t.x >= b.x && t.y >= b.y && t.x < b.x + b.w && t.y < b.y + b.h
}

/** Heart rate for the animated trace, read from whatever the monitor says right now. */
function bpmOf(text: string | null) {
  if (!text) return 80
  const m = text.match(/(?:HR|Pulse)\s*(\d+)/i) ?? text.match(/(\d+)\s*bpm/i)
  return m ? Number(m[1]) : 80
}

export const Screen = forwardRef<
  ScreenHandle,
  {
    pack: Pack
    position: Pos
    paused: boolean
    talkingId: string | null
    scene: string[]
    labels: boolean
    /** Live heart rate from the station's vitals; 0 draws a flat line. Undefined reads the pack readout. */
    monitorBpm?: number
    /** No leads on yet: the monitor screen is dark. */
    monitorOff?: boolean
    /**
     * Cast members on the move: each walk visits its stops in turn — an interactable or cast id ('cart',
     * 'patient'), '@player' (stand beside the candidate) or '@home' (back to their spot).
     */
    walks?: Walk[]
    onWalkStop?: (token: number, index: number, npcId: string) => void
    onWalkDone?: (token: number, npcId: string) => void
    onMove: (pos: Pos) => void
    onUse: (targetId: string) => void
    onEmpty: () => void
    onFacing: (targetId: string | null) => void
    onBump: () => void
  }
>(function Screen({ pack, position, paused, talkingId, scene, labels, monitorBpm, monitorOff, walks, onWalkStop, onWalkDone, onMove, onUse, onEmpty, onFacing, onBump }, ref) {
  const { cols, rows } = pack.room
  // Where each cast member stands now; most never move, the examiner may walk over.
  const npcTile = useRef<Record<string, Tile>>(Object.fromEntries(pack.cast.map((c) => [c.id, c.spawn])))
  const npcVis = useRef<Record<string, { x: number; y: number; facing: Dir | null }>>(
    Object.fromEntries(pack.cast.map((c) => [c.id, { x: c.spawn.x, y: c.spawn.y, facing: null }])),
  )
  const walkers = useRef(new Map<string, Walker>())
  const startedWalks = useRef(new Set<number>())
  const [tagTiles, setTagTiles] = useState<Record<string, Tile>>(npcTile.current)
  const solidsNow = () => {
    const set = buildSolids(pack)
    for (const c of pack.cast) {
      set.delete(keyOf(c.spawn))
      set.add(keyOf(npcTile.current[c.id] ?? c.spawn))
    }
    return set
  }
  const solids = useRef(solidsNow())
  solids.current = solidsNow()
  const targetsOf = (id: string) => (npcTile.current[id] ? [npcTile.current[id]] : targetTilesFor(pack, id))
  const visual = useRef<Visual>({ x: position.x, y: position.y, facing: position.facing, frame: 0, bob: 0 })
  const glide = useRef<Glide | null>(null)
  const stride = useRef(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const pathRef = useRef<Tile[]>([])
  const pendingRef = useRef<string | null>(null)
  const pendingFacing = useRef<Dir>('n')
  const facingHit = useRef<string | null | undefined>(undefined)
  const cb = useRef({ onMove, onUse, onEmpty, onFacing, onBump, onWalkStop, onWalkDone })
  cb.current = { onMove, onUse, onEmpty, onFacing, onBump, onWalkStop, onWalkDone }
  const drawState = useRef({ talkingId, scene, monitorBpm, monitorOff })
  drawState.current = { talkingId, scene, monitorBpm, monitorOff }
  const [slapFx, setSlapFx] = useState<{ key: number; x: number; y: number; fromLeft: boolean } | null>(null)

  const frame = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const view = useRef({ w: 0, h: 0 })
  const [scale, setScale] = useState(2)
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      view.current = { w: rect.width, h: rect.height }
      const byWidth = Math.floor(rect.width / (TILE * 10))
      const byHeight = Math.floor(rect.height / (TILE * 7))
      setScale(Math.max(1, Math.min(byWidth, byHeight, 4)))
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

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
      pendingRef.current = null
      const next = step(here, held, solids.current, cols, rows)
      if (next.x === here.x && next.y === here.y) {
        if (here.facing !== held) {
          visual.current = { ...visual.current, facing: held, bob: 0, frame: 0 }
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
      return
    }
    if (pendingRef.current) {
      const id = pendingRef.current
      pendingRef.current = null
      const faced = { ...here, facing: pendingFacing.current }
      visual.current = { ...visual.current, facing: pendingFacing.current, bob: 0, frame: 0 }
      cb.current.onMove(faced)
      cb.current.onUse(id)
    }
  }

  useEffect(() => {
    if (glide.current) return
    const v = visual.current
    if (Math.round(v.x) === position.x && Math.round(v.y) === position.y && v.facing === position.facing) return
    visual.current = { x: position.x, y: position.y, facing: position.facing, frame: 0, bob: 0 }
  }, [position.x, position.y, position.facing])

  function draw(now: number) {
    const cv = canvas.current
    const wd = world.current
    if (!cv || !wd) return
    const c = cv.getContext('2d')
    if (!c) return
    const { talkingId: talking, scene: flags } = drawState.current
    const template = pack.room.template ?? 'resus-bay'
    c.imageSmoothingEnabled = false
    c.fillStyle = INK
    c.fillRect(0, 0, cv.width, cv.height)

    const walls = new Set<string>()
    for (const prop of pack.room.props) if (prop.kind === 'wall') for (const t of tilesOf(prop)) walls.add(keyOf(t))
    const isWall = (x: number, y: number) => walls.has(`${x},${y}`)
    const inRoom = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!isWall(x, y)) {
          drawFloor(c, x, y, template)
          continue
        }
        const below = inRoom(x, y + 1) && !isWall(x, y + 1)
        const topRow = !inRoom(x, y - 1)
        if (below && topRow) drawWallFace(c, x, y)
        else
          drawWallTop(c, x, y, {
            n: inRoom(x, y - 1) && !isWall(x, y - 1),
            s: below,
            w: inRoom(x - 1, y) && !isWall(x - 1, y),
            e: inRoom(x + 1, y) && !isWall(x + 1, y),
          })
      }
    }

    const monitorProp = pack.room.props.find((p) => p.kind === 'monitor')
    const live = drawState.current.monitorBpm
    const bpm = live ?? bpmOf(monitorProp ? readoutText(monitorProp.readout, flags) : null)

    const drawn = new Set<string>()
    const boxes: PropBox[] = []
    for (const prop of pack.room.props) {
      if (prop.kind === 'wall') continue
      const b = boxOf(prop)
      drawn.add(`${b.kind}@${b.x},${b.y}`)
      boxes.push(b)
    }
    for (const item of pack.room.interactables) {
      const b = boxOf(item)
      if (drawn.has(`${b.kind}@${b.x},${b.y}`)) continue
      boxes.push(b)
    }

    for (const b of boxes) {
      if (b.kind !== 'door') continue
      const matY = b.y === rows - 1 ? b.y - 1 : b.y === 0 ? b.y + 1 : null
      if (matY !== null && !solids.current.has(`${b.x},${matY}`)) drawProp(c, { ...b, kind: 'mat', y: matY }, now)
    }
    for (const b of boxes) if (FLOOR_KINDS.has(b.kind)) drawProp(c, b, now)
    for (const b of boxes) if (!FLOOR_KINDS.has(b.kind)) drawProp(c, b, now, bpm || 60, live === 0, drawState.current.monitorOff)

    for (const [i, t] of pathRef.current.entries()) {
      c.fillStyle = i === pathRef.current.length - 1 ? '#e04858' : '#303848'
      c.fillRect(t.x * TILE + 7, t.y * TILE + 7, 2, 2)
    }

    const v = visual.current
    const beds = boxes.filter((b) => b.kind === 'bed')
    type Drawable = { y: number; paint: () => void }
    const actors: Drawable[] = []
    for (const npc of pack.cast) {
      const role = npc.pixelKey ?? npc.role
      const bedBox = role === 'patient' ? beds.find((b) => inside(npc.spawn, b) && b.w >= b.h) : undefined
      if (bedBox) {
        drawPatientInBed(c, bedBox, LOOKS.patient, bedPose(flags), flags, talking === npc.id && Math.floor(now / 140) % 2 === 0)
        continue
      }
      const at = npcVis.current[npc.id] ?? { x: npc.spawn.x, y: npc.spawn.y, facing: null }
      const dx = v.x - at.x
      const dy = v.y - at.y
      const near = Math.abs(dx) + Math.abs(dy) <= 2.2
      const walk = walkers.current.get(npc.id)
      const facing: Dir = at.facing ?? (near ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n') : 's')
      const stepFrame = walk && walk.to && walk.t < 0.5 ? 1 : 0
      const mouth = talking === npc.id && Math.floor(now / 140) % 2 === 0
      const carrying = Boolean(walk?.carrying)
      actors.push({
        y: at.y,
        paint: () => {
          const x = Math.round(at.x * TILE)
          const y = Math.round(at.y * TILE - 2)
          c.drawImage(actorSprite(role, facing, stepFrame, false, mouth), x, y)
          // Something in hand: a small tray carried at chest height.
          if (carrying) {
            c.fillStyle = INK
            c.fillRect(x + 4, y + 8, 8, 5)
            c.fillStyle = '#f4f4ec'
            c.fillRect(x + 5, y + 9, 6, 3)
            c.fillStyle = '#d84848'
            c.fillRect(x + 7, y + 9, 2, 2)
          }
        },
      })
    }
    const playerMouth = talking === 'player' && Math.floor(now / 140) % 2 === 0
    actors.push({
      y: v.y,
      paint: () => {
        const sprite = actorSprite('doctor', v.facing, v.frame, flags.includes('dress'), playerMouth)
        c.drawImage(sprite, Math.round(v.x * TILE), Math.round(v.y * TILE - 2 - v.bob))
      },
    })
    actors.sort((a, b) => a.y - b.y)
    for (const a of actors) a.paint()

    const s = scaleRef.current
    const worldW = cols * TILE * s
    const worldH = rows * TILE * s
    const { w, h } = view.current
    const cx = worldW <= w ? (w - worldW) / 2 : Math.min(0, Math.max(w - worldW, w / 2 - (v.x * TILE + 8) * s))
    const cy = worldH <= h ? (h - worldH) / 2 : Math.min(0, Math.max(h - worldH, h / 2 - (v.y * TILE + 8) * s))
    wd.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`
    wd.dataset.pos = `${Math.round(v.x)},${Math.round(v.y)},${v.facing}`
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
        visual.current = {
          x: m.sx + (m.tx - m.sx) * t,
          y: m.sy + (m.ty - m.sy) * t,
          facing: m.facing,
          frame: t < 0.5 ? m.stride : 0,
          bob: t < 0.5 ? 1 : 0,
        }
        if (t >= 1) {
          glide.current = null
          visual.current = { x: m.tx, y: m.ty, facing: m.facing, frame: 0, bob: 0 }
          cb.current.onMove({ x: m.tx, y: m.ty, facing: m.facing })
          tryStep()
        }
      } else if (!pausedRef.current) {
        tryStep()
      }
      stepNpc(dt)
      const here = gridNow()
      const d = DIR_DELTA[here.facing]
      const front = glide.current ? null : hitAt(pack, here.x + d.x, here.y + d.y, npcTile.current)
      if (front !== facingHit.current) {
        facingHit.current = front
        cb.current.onFacing(front)
      }
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, cols, rows])

  function goTo(tile: Tile) {
    if (pausedRef.current) return
    const here = gridNow()
    const hit = hitAt(pack, tile.x, tile.y, npcTile.current)
    if (hit) {
      const plan = planActivation(here, targetsOf(hit), solids.current, cols, rows)
      if (!plan) {
        cb.current.onEmpty()
        return
      }
      pendingFacing.current = plan.facing
      if (!plan.path.length) {
        const next = { ...here, facing: plan.facing }
        visual.current = { ...visual.current, facing: plan.facing, bob: 0, frame: 0 }
        cb.current.onMove(next)
        cb.current.onUse(hit)
        return
      }
      pendingRef.current = hit
      pathRef.current = plan.path
      return
    }
    if (solids.current.has(keyOf(tile))) return
    const path = findPath(here, tile, solids.current, cols, rows)
    if (!path) return
    pendingRef.current = null
    pathRef.current = path
  }

  /** Tiles the stop is reached from, and the tile to face once there. */
  function spotsFor(npcId: string, stop: string): { spots: Tile[]; face: Tile | null } {
    const here = gridNow()
    const around = (t: Tile) => Object.values(DIR_DELTA).map((d) => ({ x: t.x + d.x, y: t.y + d.y }))
    if (stop === '@player') return { spots: around(here), face: here }
    if (stop === '@home') {
      const home = pack.cast.find((c) => c.id === npcId)?.spawn
      return home ? { spots: [home, ...around(home)], face: null } : { spots: [], face: null }
    }
    const targets = targetsOf(stop)
    return { spots: targets.flatMap(around), face: targets[0] ?? null }
  }

  /** Plan the walk to the walker's current stop; null when there is nowhere to stand. */
  function plan(npcId: string, w: Walker) {
    const from = npcTile.current[npcId]
    const { spots, face } = spotsFor(npcId, w.stops[w.index])
    const blocked = solidsNow()
    blocked.delete(keyOf(from))
    blocked.add(keyOf(gridNow()))
    let best: Tile[] | null = null
    for (const spot of spots) {
      if (spot.x === from.x && spot.y === from.y) {
        best = []
        break
      }
      const path = findPath(from, spot, blocked, cols, rows)
      if (path && (!best || path.length < best.length)) best = path
    }
    w.face = face
    w.from = from
    w.to = null
    w.t = 0
    w.path = best ?? []
    w.deadline = performance.now() + w.path.length * STEP_MS * 1.25 + 1500
  }

  function arriveAt(npcId: string, w: Walker) {
    const at = npcTile.current[npcId]
    const stop = w.stops[w.index]
    const face = w.face && (w.face.x !== at.x || w.face.y !== at.y) ? facingBetween(at, w.face) : npcVis.current[npcId]?.facing ?? null
    npcVis.current[npcId] = { x: at.x, y: at.y, facing: face }
    if (stop === '@player') {
      // The candidate turns to whoever came over.
      const here = gridNow()
      const turn = facingBetween(here, at)
      visual.current = { ...visual.current, facing: turn, bob: 0, frame: 0 }
      cb.current.onMove({ ...here, facing: turn })
    }
    if (stop === 'cart' || stop === 'trolley') w.carrying = true
    else if (w.carrying && stop !== '@home') w.carrying = false
    setTagTiles({ ...npcTile.current })
    cb.current.onWalkStop?.(w.token, w.index, npcId)
    // A short pause to pick up or hand over; none when coming to talk or going home.
    w.pauseUntil = performance.now() + (stop.startsWith('@') ? 0 : 800)
    w.path = []
    w.to = null
    w.index += 0.5 // marks "arrived, waiting"; the next whole index is planned after the pause
  }

  function finishStop(npcId: string, w: Walker) {
    w.index = Math.floor(w.index) + 1
    if (w.index >= w.stops.length) {
      walkers.current.delete(npcId)
      if (npcVis.current[npcId]) npcVis.current[npcId] = { ...npcVis.current[npcId], facing: null }
      cb.current.onWalkDone?.(w.token, npcId)
      return
    }
    plan(npcId, w)
  }

  /** Move every walker one frame (animation). Pauses and stalls are also handled by a timer, below. */
  function stepNpc(dt: number) {
    for (const [npcId, w] of walkers.current) {
      if (!Number.isInteger(w.index)) continue
      if (!w.to) {
        const next = w.path.shift()
        if (!next) {
          arriveAt(npcId, w)
          continue
        }
        w.to = next
        w.t = 0
        npcVis.current[npcId] = { ...npcVis.current[npcId], facing: facingBetween(w.from, next) }
      }
      w.t += dt / (STEP_MS * 1.25)
      const t = Math.min(1, w.t)
      npcVis.current[npcId] = { x: w.from.x + (w.to.x - w.from.x) * t, y: w.from.y + (w.to.y - w.from.y) * t, facing: npcVis.current[npcId].facing }
      if (t >= 1) {
        npcTile.current[npcId] = w.to
        w.from = w.to
        w.to = null
      }
    }
  }

  // Start new walks.
  useEffect(() => {
    for (const walk of walks ?? []) {
      if (startedWalks.current.has(walk.token) || !npcTile.current[walk.npcId]) continue
      startedWalks.current.add(walk.token)
      const w: Walker = { token: walk.token, stops: walk.stops, index: 0, path: [], from: npcTile.current[walk.npcId], to: null, t: 0, face: null, pauseUntil: 0, deadline: 0, carrying: false }
      walkers.current.set(walk.npcId, w)
      plan(walk.npcId, w)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walks])

  // Pauses end, and stalled walks snap to their stop, on a timer: the game never waits on a paused animation.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now()
      for (const [npcId, w] of walkers.current) {
        if (!Number.isInteger(w.index)) {
          if (now >= w.pauseUntil) finishStop(npcId, w)
          continue
        }
        if (now > w.deadline) {
          const end = w.path.length ? w.path[w.path.length - 1] : (w.to ?? npcTile.current[npcId])
          npcTile.current[npcId] = end
          w.path = []
          w.to = null
          arriveAt(npcId, w)
        }
      }
    }, 120)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    useFacing: () => {
      if (pausedRef.current || glide.current) return
      const pos = gridNow()
      const d = DIR_DELTA[pos.facing]
      const hit = hitAt(pack, pos.x + d.x, pos.y + d.y, npcTile.current)
      if (!hit) {
        cb.current.onEmpty()
        return
      }
      cb.current.onUse(hit)
    },
    slap: (npcId) => {
      const me = visual.current
      const them = npcVis.current[npcId] ?? me
      const key = Date.now()
      setSlapFx({ key, x: me.x, y: me.y, fromLeft: them.x <= me.x })
      window.setTimeout(() => setSlapFx((cur) => (cur?.key === key ? null : cur)), 1200)
    },
  }))

  const px = TILE * scale
  const tags = [
    ...pack.room.interactables
      .filter((item) => item.label.trim() && item.kind !== 'door')
      .map((item) => ({ id: item.id, label: item.label, x: item.x + (item.w ?? 1) / 2, y: item.y, npc: false })),
    ...(labels
      ? pack.cast.map((npc) => {
          const at = tagTiles[npc.id] ?? npc.spawn
          return { id: npc.id, label: npc.displayName, x: at.x + 0.5, y: at.y + 1, npc: true }
        })
      : []),
  ]

  return (
    <div ref={frame} className="relative min-h-0 flex-1 overflow-hidden bg-[#181820]" data-testid="bay">
      <div
        ref={world}
        data-testid="player"
        data-shake={slapFx ? 'on' : undefined}
        className="absolute top-0 left-0"
        style={{ width: cols * px, height: rows * px }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = Math.floor((event.clientX - rect.left) / px)
          const y = Math.floor((event.clientY - rect.top) / px)
          if (x >= 0 && y >= 0 && x < cols && y < rows) goTo({ x, y })
        }}
      >
        <canvas ref={canvas} width={cols * TILE} height={rows * TILE} className="pixelated block h-full w-full" />
        {slapFx && (
          <div
            key={slapFx.key}
            className="slap-fx"
            data-from={slapFx.fromLeft ? 'left' : 'right'}
            data-testid="slap"
            style={{ left: (slapFx.x + 0.5) * px, top: slapFx.y * px, width: px * 2, height: px * 2 }}
          >
            <svg viewBox="0 0 16 16" className="slap-hand pixelated" aria-hidden>
              <path d="M3 9h1V5h1v3h1V3h1v5h1V4h1v5h1V6h1v5h-1v2H9v1H5v-1H4v-2H3z" fill="#f0c090" stroke="#704828" strokeWidth="0.6" />
            </svg>
            <span className="slap-word">SLAP!</span>
          </div>
        )}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={`map-tag ${tag.npc ? 'map-tag-npc' : ''}`}
            style={{ left: tag.x * px, top: tag.y * px - (tag.npc ? 4 : 6) }}
          >
            {tag.label}
          </span>
        ))}
      </div>
    </div>
  )
})
