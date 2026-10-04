import { useEffect, useMemo, useRef, useState } from 'react'
import type { Vector3 } from 'three'
import type { Action, Pack } from '~/engine/schema'
import { patientKind } from '../body3d/cast'
import type { Credit } from '../body3d/rig'
import { useButtons } from '../input'
import { useSettings } from '../settings'
import { buzz, sfx } from '../sfx'
import { CORE_TOOLS, SAYS, sayOf, toolById, TOOLS, type SayDef } from './catalog'
import { Illustration, illustrationFor, type IllustrationKind } from './Illustration'
import { SAY_FOR_POSTURE, actWords, condWords, nextAct, sitesFor, unmet } from './hints'
import { advance, freshProgress, parseDo, toolsOf, type ExamEvent, type Plan, type Progress } from './model'
import { ExamScene, type Limb, type Posture, type View } from './scene'
import { regionOf, siteLabel, siteOf, spotLabel } from './sites'
import { bowel, doppler, fork, heartbeat, percussNote } from './sounds'

/**
 * The physical examination, done on a 3D patient: tap the part of the body, then choose exactly where and what to do
 * there (look, feel, press, percuss, listen, a tool from the kit, move the joint), or talk to them. Each exam item's `do` line says what performs it; done, it scores exactly as picking it
 * from the list did. Nothing is listed or ordered for you: what you find depends on what you do, and where.
 */

type Props = { pack: Pack; action: Action; title: string; spent: string[]; onClose?: () => void; onOption: (optionId: string) => void }

type Note = { text: string; tone: 'finding' | 'normal' | 'warn' | 'hint' }

const VIEWS: { id: View; label: string }[] = [
  { id: 'whole', label: 'WHOLE' },
  { id: 'head', label: 'HEAD' },
  { id: 'chest', label: 'CHEST' },
  { id: 'abdomen', label: 'ABDO' },
  { id: 'hands', label: 'HANDS' },
  { id: 'legs', label: 'LEGS' },
  { id: 'feet', label: 'FEET' },
  { id: 'back', label: 'BACK' },
]

/** Instructions that move her to a position, and how long until she settles back. */
const POSTURE_OF: Record<string, { posture: Posture; back?: number }> = {
  'lie-flat': { posture: 'supine' },
  'sit-up': { posture: 'sitting' },
  'sit-edge': { posture: 'edge' },
  stand: { posture: 'standing' },
  'roll-R': { posture: 'roll-R' },
  'roll-L': { posture: 'roll-L' },
  'knees-up': { posture: 'knees-up' },
  'bend-forward': { posture: 'bent', back: 4 },
  walk: { posture: 'walking', back: 7.5 },
  'walk-heel-toe': { posture: 'heel-toe', back: 7.5 },
  'one-leg-R': { posture: 'one-leg-R', back: 4.5 },
  'one-leg-L': { posture: 'one-leg-L', back: 4.5 },
}

/** Instructions she acts out, and for how long. */
const MOTION_OF: Record<string, number> = {
  'arms-out': 4,
  'hands-out': 4,
  'finger-nose': 6,
  'rapid-alternating': 4,
  'heel-shin': 4.5,
  'raise-arm': 4,
  'lift-leg': 3.5,
  'bend-knee': 3.5,
  'push-out': 2.5,
  'empty-can': 2.5,
  'wall-push': 3,
  shrug: 2.5,
  'raise-eyebrows': 2.5,
  'close-eyes': 2.5,
  'show-teeth': 2.5,
  'puff-cheeks': 2.5,
  'open-mouth': 2.5,
  'follow-finger': 7,
  fields: 5,
}

/** Hands-on tools: after one of these, she has been touched. */
const TOUCH = new Set(['feel', 'press', 'percuss', 'listen', 'move', 'hammer', 'orange', 'pin', 'cotton', 'calipers', 'doppler', 'scanner', 'speculum', 'swab', 'tape', 'glucometer'])
/** Where a painful stimulus is given (for an unconscious patient's response). */
const PAIN_SITES = /^(trapezius|supraorbital|nails|pulp|sternum)/
const JOINT_RANGE: Record<string, [number, number]> = {
  knee: [0, 140],
  hipflex: [-10, 130],
  hiprot: [-45, 45],
  shoulderabd: [-10, 175],
  shoulderrot: [-70, 90],
  elbow: [0, 145],
  neckyaw: [-80, 80],
}

export default function Exam3D({ pack, action, spent, onClose, onOption }: Props) {
  const items = useMemo(() => (action.options ?? []).filter((o) => o.do).map((o) => ({ option: o, plan: parseDo(o.do!) as Plan })), [action])
  const patient = pack.cast.find((c) => c.id === 'patient') ?? pack.cast.find((c) => !['examiner', 'nurse', 'junior'].includes(c.role))
  const kind = patientKind({ role: patient?.role, name: patient?.displayName })
  const name = patient?.displayName ?? 'The patient'
  const body = pack.body ?? {}
  const tools = useMemo(() => {
    const need = new Set([...CORE_TOOLS, ...toolsOf(items.map((i) => i.plan))])
    return TOOLS.filter((t) => need.has(t.id))
  }, [items])

  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<ExamScene | null>(null)
  const progress = useRef(new Map<string, Progress>())
  const flags = useRef({ touched: false, gloved: false })
  const timers = useRef<number[]>([])
  const [panel, setPanel] = useState<{ kind: 'region'; label: string; spots: string[]; spot: string } | { kind: 'talk' } | { kind: 'expose' } | null>(null)
  const [bare, setBare] = useState({ trunk: false, arms: false, legs: false })
  /** Practice help: which item the hint is about (counted among those not yet found), and the button to press. */
  const [hint, setHint] = useState<number | null>(null)
  const [glowId, setGlowId] = useState<string | null>(null)
  const [moving, setMoving] = useState<{ limb: Limb; start: Record<string, number>; value: number } | null>(null)
  const [view, setView] = useState<View>('whole')
  const [loading, setLoading] = useState(true)
  const [credit, setCredit] = useState<Credit | null>(null)
  const [note, setNote] = useState<Note>({ text: `${name} is on the couch. Tap the part of the body you want to examine, or talk to them.`, tone: 'hint' })
  const [illus, setIllus] = useState<{ kind: IllustrationKind; text: string } | null>(null)
  const [found, setFound] = useState<string[]>([])
  const done = new Set([...spent, ...found])

  useEffect(() => {
    if (!host.current) return
    useSettings.getState().load()
    // Intimate examinations (under a drape) always have the realistic patient, whatever the 3D PATIENT setting.
    const look = body.drape ? 'realistic' : useSettings.getState().patientModel
    const s = new ExamScene(host.current, kind, look, body.posture ?? 'supine', body)
    scene.current = s
    if (import.meta.env.DEV) Object.assign(window, { __exam: s })
    s.ready.then(() => {
      setLoading(false)
      setCredit(s.credit)
    })
    const ro = new ResizeObserver(() => s.resize())
    ro.observe(host.current)
    return () => {
      ro.disconnect()
      for (const id of timers.current) window.clearTimeout(id)
      s.dispose()
      scene.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // B closes, as on every bench.
  useButtons(30, true, (btn) => {
    if (btn !== 'b') return
    sfx.back()
    if (panel) setPanel(null)
    else if (hint !== null) setHint(null)
    else onClose?.()
  })

  const later = (seconds: number, run: () => void) => timers.current.push(window.setTimeout(run, seconds * 1000))

  /* ---------------------------------------------------------------- one thing done to the patient */

  function handle(ev: Omit<ExamEvent, 'state'>, point?: Vector3) {
    const s = scene.current
    if (!s) return
    const state = { posture: s.posture, joints: s.angles(), flags: [...(flags.current.touched ? [] : ['untouched']), ...(flags.current.gloved ? ['gloved'] : [])] }
    const event: ExamEvent = { ...ev, state }
    if (TOUCH.has(ev.tool)) flags.current.touched = true
    if (ev.tool === 'gloves') flags.current.gloved = true

    let hit: (typeof items)[number] | null = null
    let partial: (typeof items)[number] | null = null
    for (const item of items) {
      if (done.has(item.option.id)) continue
      const cur = progress.current.get(item.option.id) ?? freshProgress(item.plan)
      const r = advance(item.plan, cur, event)
      progress.current.set(item.option.id, r.progress)
      if (r.done && !hit) hit = item
      else if (r.moved) partial ??= item
    }

    const site = ev.site ?? null
    // Under the drape: the drawn close-up of what you touched, or of what the item you just completed was about.
    const draped = (id: string | null | undefined) => {
      if (!id || !siteOf(id)?.def.draped) return null
      // What you are doing decides the view: the speculum shows the cervix; fingers on it, the bimanual.
      if (ev.tool === 'speculum' || ev.tool === 'swab') return 'cervix' as const
      if ((ev.tool === 'feel' || ev.tool === 'press') && /^(cervix|adnexa)/.test(id)) return 'bimanual' as const
      return illustrationFor(id)
    }
    const itemDrawn = (item: (typeof items)[number] | null) => item?.plan.flat(2).flatMap((a) => a.targets).map(draped).find(Boolean) ?? null
    if (hit) {
      const o = hit.option
      setFound((f) => [...f, o.id])
      onOption(o.id)
      const text = o.detail || o.label
      setNote({ text, tone: o.isTrap ? 'warn' : 'finding' })
      if (o.isTrap) buzz(30)
      else sfx.mark()
      const drawn = draped(site) ?? itemDrawn(hit)
      if (drawn) setIllus({ kind: drawn, text })
      sound(ev.tool, site, text)
    } else {
      // Part of something longer. Asked to do something, they respond as the case says (their palsy shows the first
      // time); hands on, you are told what you did, and what it means once the whole manoeuvre is done.
      const text = partial && ev.tool === 'say' ? partial.option.detail || acknowledge(ev, s.signs.unconscious) : partial ? acknowledge(ev, s.signs.unconscious) : normal(ev, s.signs.unconscious)
      setNote({ text, tone: 'normal' })
      const drawn = draped(site)
      if (drawn) setIllus({ kind: drawn, text: '' })
      sound(ev.tool, site, '')
    }
    if (point) s.mark(point, hit ? (hit.option.isTrap ? '#ff5a5a' : '#58f878') : '#ffd34d')
  }

  function sound(t: string, site: string | null, finding: string) {
    const base = site?.replace(/-(R|L)$/, '') ?? ''
    if (t === 'percuss') percussNote(/dull/i.test(finding) ? 'dull' : /epigastrium|umbilicus|ruq|iliac|suprapubic|flank/.test(base) ? 'tympanic' : 'resonant')
    if (t === 'listen') /epigastrium|umbilicus|ruq|iliac|suprapubic|flank/.test(base) ? bowel(/absent/i.test(finding) ? 'absent' : 'normal') : heartbeat(76, /irregular/i.test(finding))
    if (t === 'feel' && /wrist|groin|popliteal|dp|pt/.test(base)) heartbeat(80, /irregular/i.test(finding))
    if (t === 'doppler') doppler(/no arterial/i.test(finding) ? (/venous/i.test(finding) ? 'venous' : 'none') : 'arterial')
    if (t === 'fork') fork()
  }

  /* ---------------------------------------------------------------- instructions */

  function ask(def: SayDef, side: 'R' | 'L' = 'R') {
    const s = scene.current
    if (!s) return
    const id = def.sided ? `${def.id}-${side}` : def.id
    setPanel(null)
    sfx.select()
    const unconscious = s.signs.unconscious
    if (!unconscious) {
      const pose = POSTURE_OF[id]
      if (pose) {
        s.setPosture(pose.posture)
        if (pose.back) later(pose.back, () => scene.current?.setPosture('standing'))
      }
      const dur = MOTION_OF[def.id]
      if (dur) s.play(id, dur)
      if (def.id === 'follow-finger' || /face|eyes/i.test(def.group)) setViewTo('head')
      if (['walk', 'walk-heel-toe', 'stand', 'one-leg', 'bend-forward'].includes(def.id)) setViewTo('whole')
    }
    handle({ tool: 'say', say: id })
  }

  /* ---------------------------------------------------------------- hands on: tap the body, then choose */

  // A tap on the body opens that part of it: where exactly, and what to do there. Drag to turn the camera round her;
  // pinch (or scroll) to zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ x0: number; y0: number; x: number; y: number; moved: boolean; pinch: number } | null>(null)

  function down(e: React.PointerEvent) {
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* fine */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    if (pts.length === 1) gesture.current = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, pinch: 0 }
    else if (gesture.current && pts.length === 2) {
      gesture.current.moved = true
      gesture.current.pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    }
  }

  function move(e: React.PointerEvent) {
    const s = scene.current
    const g = gesture.current
    if (!s || !g || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (g.pinch > 0 && d > 0) s.zoomBy(g.pinch / d)
      g.pinch = d
      return
    }
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) g.moved = true
    if (g.moved) s.orbitBy(e.clientX - g.x, e.clientY - g.y)
    g.x = e.clientX
    g.y = e.clientY
  }

  function up(e: React.PointerEvent) {
    const s = scene.current
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) gesture.current = null
    if (!s || loading || !g || g.moved) return
    const at = s.pick(e.clientX, e.clientY, true)
    if (!at?.site) {
      setPanel(null)
      setNote({ text: 'Tap the part of the body you want to examine.', tone: 'hint' })
      return
    }
    openRegion(at.site)
  }

  function openRegion(site: string) {
    const s = scene.current
    if (!s) return
    const r = regionOf(site, (id) => s.hasSite(id))
    if (!r) return
    sfx.cursor()
    setMoving(null)
    setGlowId(null)
    setPanel({ kind: 'region', label: r.label, spots: r.sites, spot: site })
    s.focus(site)
    setView('focus')
  }

  function act(toolId: string) {
    const s = scene.current
    if (!s || panel?.kind !== 'region') return
    sfx.select()
    setGlowId(null)
    const site = panel.spot
    if (toolId === 'press' && PAIN_SITES.test(site)) s.stimulus()
    handle({ tool: toolId, site }, s.siteWorld(site) ?? undefined)
  }

  function startMove() {
    const s = scene.current
    if (!s || panel?.kind !== 'region') return
    setGlowId(null)
    const limb = s.limbAt(panel.spot)
    if (!limb) return
    setMoving({ limb, start: s.angles(), value: Math.round(s.angle(limb.key)) })
  }

  function slide(value: number) {
    const s = scene.current
    if (!s || !moving) return
    s.setHeld(moving.limb, value)
    setMoving({ ...moving, value })
  }

  /** Let go of the slider: every joint moved through a real range counts (lifting the knee flexes hip and knee). */
  function finishMove() {
    const s = scene.current
    if (!s || !moving || panel?.kind !== 'region') return
    const { limb, start } = moving
    const now = s.angles()
    const side = limb.joint.match(/-(R|L)$/)?.[1]
    const moves: string[] = []
    if (Math.abs((now[limb.key] ?? 0) - (start[limb.key] ?? 0)) >= 15) moves.push(`${limb.joint}:${limb.dof}`)
    if (side && limb.kneeWithHip && Math.abs((now[`knee-${side}`] ?? 0) - (start[`knee-${side}`] ?? 0)) >= 15) moves.push(`knee-${side}:flex`)
    if (moves.length === 0) setNote({ text: 'Move it further: through its range.', tone: 'hint' })
    for (const m of moves) handle({ tool: 'move', move: m, site: panel.spot })
    setMoving({ limb, start: s.angles(), value: Math.round(s.angle(limb.key)) })
  }

  function gloves() {
    sfx.select()
    setGlowId(null)
    handle({ tool: 'gloves' })
  }

  /** Uncover (or cover) a part of the body. The first time, it is asking them to undress for you. */
  function toggleBare(part: 'trunk' | 'arms' | 'legs' | 'none') {
    const next = part === 'none' ? { trunk: false, arms: false, legs: false } : { ...bare, [part]: !bare[part] }
    setBare(next)
    scene.current?.expose({ trunk: next.trunk ? 1 : 0, arms: next.arms ? 1 : 0, legs: next.legs ? 1 : 0 })
    sfx.select()
    setGlowId(null)
    if (part !== 'none' && next[part]) handle({ tool: 'say', say: 'expose' })
    else setNote({ text: part === 'none' ? 'Covered up again.' : 'Covered.', tone: 'normal' })
  }

  /* ---------------------------------------------------------------- practice help */

  const left = items.filter((i) => !i.option.isTrap && !done.has(i.option.id))
  const hinted = hint === null || left.length === 0 ? null : left[hint % left.length]
  const hintAct = hinted ? nextAct(hinted.plan, progress.current.get(hinted.option.id) ?? freshProgress(hinted.plan)) : null

  function showHint() {
    sfx.cursor()
    setHint((h) => (h === null ? 0 : h))
  }

  /** Where a joint is moved from: a spot whose drag changes that angle. */
  function spotForJoint(key: string): string | null {
    const s = scene.current
    if (!s) return null
    const side = key.match(/-(R|L)$/)?.[1] ?? ''
    const base = key.replace(/-(R|L)$/, '')
    const tries: Record<string, string[]> = { knee: ['knee', 'shin'], hipflex: ['thigh', 'foot', 'knee'], hiprot: ['foot'], shoulderabd: ['arm'], shoulderrot: ['hand'], elbow: ['forearm', 'hand'], neckyaw: ['head'] }
    for (const b of tries[base] ?? []) {
      const id = side ? `${b}-${side}` : b
      const limb = s.hasSite(id) ? s.limbAt(id) : null
      if (limb && (limb.key === key || (limb.kneeWithHip && base === 'knee'))) return id
    }
    return null
  }

  /** "Take me there": the step that has to come first, opened, with its button lit. */
  function takeMeThere() {
    const s = scene.current
    if (!s || !hintAct) return
    const state = { posture: s.posture, joints: s.angles(), flags: [...(flags.current.touched ? [] : ['untouched']), ...(flags.current.gloved ? ['gloved'] : [])] }
    const need = unmet(hintAct, state)
    const glow = (id: string, open?: () => void) => {
      open?.()
      window.setTimeout(() => setGlowId(id), 30)
    }
    const posture = need.find((c) => SAY_FOR_POSTURE[c])
    if (posture) return glow(`exam3d-say-${SAY_FOR_POSTURE[posture]}`, () => setPanel({ kind: 'talk' }))
    if (need.includes('gloved')) return glow('exam3d-gloves', () => setPanel(null))
    const joint = need.find((c) => c.includes('='))
    if (joint) {
      const spot = spotForJoint(joint.split('=')[0])
      if (spot) return glow('exam3d-do-move', () => openRegion(spot))
    }
    if (hintAct.tool === 'say') return glow(`exam3d-say-${hintAct.targets[0]}`, () => setPanel({ kind: 'talk' }))
    if (hintAct.tool === 'gloves') return glow('exam3d-gloves', () => setPanel(null))
    if (hintAct.tool === 'move') {
      const m = (hintAct.targets[0] ?? '').match(/^(\w+)(?:-(R|L))?(?::(\w+))?$/)
      const key = m ? `${m[1] === 'hip' ? (m[3] === 'rot' ? 'hiprot' : 'hipflex') : m[1] === 'shoulder' ? (m[3] === 'rot' ? 'shoulderrot' : 'shoulderabd') : m[1] === 'neck' ? 'neckyaw' : m[1]}${m[2] ? `-${m[2]}` : ''}` : ''
      const spot = spotForJoint(key)
      if (spot) return glow('exam3d-do-move', () => openRegion(spot))
      return
    }
    const spot = sitesFor(hintAct, (id) => s.hasSite(id))[0]
    if (spot) glow(`exam3d-do-${hintAct.tool}`, () => openRegion(spot))
  }

  function reveal() {
    if (!hinted) return
    setNote({ text: `${hinted.option.label} — ${hinted.option.detail ?? ''}`, tone: 'hint' })
  }

  // Bring the lit button into view.
  useEffect(() => {
    if (glowId) document.querySelector(`[data-testid="${glowId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [glowId, panel])

  const glowing = (id: string) => (glowId === id ? ' ring-4 ring-[#ff8a00] animate-pulse' : '')

  function setViewTo(v: View) {
    setView(v)
    scene.current?.setView(v)
  }

  const groups = useMemo(() => [...new Set(SAYS.map((s) => s.group))], [])
  // Development: drive the examination from tests without picking on the canvas.
  if (import.meta.env.DEV) Object.assign(window, { __examDo: handle, __examOpen: openRegion })
  const total = items.filter((i) => !i.option.isTrap).length
  const got = items.filter((i) => !i.option.isTrap && done.has(i.option.id)).length
  const handsOn = tools.filter((t) => !['say', 'move', 'gloves'].includes(t.id))
  const limbHere = panel?.kind === 'region' ? (scene.current?.limbAt(panel.spot) ?? null) : null
  const range = moving ? (JOINT_RANGE[moving.limb.key.replace(/-(R|L)$/, '')] ?? [-90, 90]) : [0, 0]
  const big = 'min-h-[44px] rounded-md border-2 px-2 py-1.5 text-left text-[15px] leading-tight'

  return (
    <div className="battle absolute inset-0 z-40 flex flex-col" data-testid="exam3d">
      <div className="win battle-head">
        <span className="battle-tag">EXAMINATION</span>
        <h2 className="win-title">{action.prompt}</h2>
        <button type="button" className="win-close" aria-label="Close" data-testid="exam3d-close" onClick={onClose}>
          B✕
        </button>
      </div>
      <div className="battle-body flex min-h-0 flex-1 flex-col">
        <div className="hare-bar">
          <span>{name.toUpperCase()}</span>
          <span />
          <span data-testid="exam3d-count">
            FOUND {got}/{total}
          </span>
        </div>
        <div className="relative mx-3 min-h-[220px] flex-[1_1_46%] overflow-hidden rounded-md border-[3px] border-[#181820] bg-[#dfe5ea]" style={{ touchAction: 'none' }}>
          <div ref={host} className="absolute inset-0" data-testid="exam3d-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => scene.current?.zoomBy(e.deltaY > 0 ? 1.1 : 0.9)} />
          {loading && <p className="absolute inset-0 grid place-items-center font-[Press_Start_2P,monospace] text-[8px] text-[#40404c]">Bringing {name} in…</p>}
          <div className="absolute left-1 top-1 flex max-w-[calc(100%-84px)] flex-wrap gap-1" onPointerDown={(e) => e.stopPropagation()}>
            {VIEWS.map((v) => (
              <button key={v.id} type="button" data-testid={`exam3d-view-${v.id}`} aria-pressed={view === v.id} onClick={() => setViewTo(v.id)} className={`rounded border-2 px-1.5 py-1 font-[Press_Start_2P,monospace] text-[7px] leading-none ${view === v.id ? 'border-[#181820] bg-[#181820] text-white' : 'border-[#5a6470]/60 bg-white/90 text-[#30303c]'}`}>
                {v.label}
              </button>
            ))}
          </div>
          {illus && (
            <div className="absolute bottom-6 right-1 w-[46%]" onPointerDown={(e) => e.stopPropagation()} onClick={() => setIllus(null)}>
              <Illustration kind={illus.kind} finding={illus.text} />
            </div>
          )}
          {!panel && !loading && <p className="pointer-events-none absolute bottom-1 left-2 rounded bg-white/85 px-1.5 py-0.5 text-[12px] text-[#30303c]">Tap the body to examine · drag to turn · pinch to zoom</p>}
          <button type="button" data-testid="exam3d-hint" onPointerDown={(e) => e.stopPropagation()} onClick={showHint} className="absolute right-1 top-1 rounded-md border-2 border-[#181820] bg-[#ffe9a8] px-2 py-1 text-[14px] leading-none">
            💡 Hint
          </button>
          {credit &&
            (credit.href ? (
              <a href={credit.href} target="_blank" rel="noreferrer" className="absolute bottom-1 right-1 text-[8px] text-[#5a6470] opacity-70" onPointerDown={(e) => e.stopPropagation()}>
                {credit.text}
              </a>
            ) : (
              <span className="pointer-events-none absolute bottom-1 right-1 text-[8px] text-[#5a6470] opacity-70">{credit.text}</span>
            ))}
        </div>

        <p className={`mx-3 mb-0 mt-2 rounded border-2 p-2 text-[15px] leading-snug ${note.tone === 'finding' ? 'border-[#1a7a40] bg-[#e4f7e8]' : note.tone === 'warn' ? 'border-[#b8282a] bg-[#fde7e7]' : note.tone === 'hint' ? 'border-[#c0a040] bg-[#fff8d8]' : 'border-[#9aa4ad] bg-white'}`} data-testid="exam3d-note" aria-live="polite">
          {note.text}
        </p>

        <div className="min-h-0 flex-[1_1_44%] overflow-auto px-3 pb-3 pt-2" style={{ scrollbarGutter: 'stable' }}>
          {hint !== null && (
            <div className="mb-2 rounded-md border-2 border-[#c0a040] bg-[#fff8d8] p-2" data-testid="exam3d-hintcard">
              {hinted && hintAct ? (
                <>
                  <p className="m-0 font-[Press_Start_2P,monospace] text-[7px] text-[#8a5a00]">NEXT TO FIND</p>
                  <p className="m-0 mt-1 text-[15px] leading-snug">
                    <b>{hinted.option.label}</b>
                  </p>
                  <p className="m-0 mt-1 text-[15px] leading-snug" data-testid="exam3d-hint-how">
                    {actWords(hintAct)}
                  </p>
                  {(() => {
                    const s = scene.current
                    const need = s ? unmet(hintAct, { posture: s.posture, joints: s.angles(), flags: flags.current.gloved ? ['gloved'] : [] }) : []
                    return need.length > 0 ? <p className="m-0 mt-1 text-[13px] text-[#8a5a00]">First: {need.map(condWords).join(', ')}.</p> : null
                  })()}
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button type="button" data-testid="exam3d-hint-go" onClick={takeMeThere} className={`${big} border-[#181820] bg-white`}>
                      👉 Take me there
                    </button>
                    <button type="button" data-testid="exam3d-hint-reveal" onClick={reveal} className={`${big} border-[#5a6470] bg-white`}>
                      🔎 Reveal the finding
                    </button>
                    <button type="button" onClick={() => (setHint((h) => (h ?? 0) + 1), setGlowId(null))} className={`${big} border-[#5a6470] bg-white`}>
                      ⏭ Next hint
                    </button>
                    <button type="button" onClick={() => (setHint(null), setGlowId(null))} className={`${big} border-[#5a6470] bg-white`}>
                      ✕ Hide
                    </button>
                  </div>
                </>
              ) : (
                <p className="m-0 text-[15px]">
                  Everything is found. Tap DONE EXAMINING. <button type="button" className="underline" onClick={() => setHint(null)}>Hide</button>
                </p>
              )}
            </div>
          )}
          {panel?.kind === 'region' && (
            <div data-testid="exam3d-region">
              <div className="mb-1 flex items-center justify-between">
                <b className="font-[Press_Start_2P,monospace] text-[9px]">{panel.label.toUpperCase()}</b>
                <button type="button" className="rounded border-2 border-[#5a6470] bg-white px-2 py-1 text-[13px]" data-testid="exam3d-region-close" onClick={() => (setPanel(null), setMoving(null))}>
                  ✕ Close
                </button>
              </div>
              {panel.spots.length > 1 && (
                <>
                  <p className="m-0 mb-1 font-[Press_Start_2P,monospace] text-[7px] text-[#8a5a00]">WHERE</p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {panel.spots.map((id) => (
                      <button key={id} type="button" data-testid={`exam3d-spot-${id}`} aria-pressed={panel.spot === id} onClick={() => (setPanel({ ...panel, spot: id }), scene.current?.focus(id), setMoving(null))} className={`${big} ${panel.spot === id ? 'border-[#181820] bg-[#ffe9a8]' : 'border-[#9aa4ad] bg-white'}`}>
                        {spotLabel(id)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="m-0 mb-1 font-[Press_Start_2P,monospace] text-[7px] text-[#8a5a00]">DO · {spotLabel(panel.spot).toUpperCase()}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {handsOn.map((t) => (
                  <button key={t.id} type="button" data-testid={`exam3d-do-${t.id}`} onClick={() => act(t.id)} className={`${big} flex items-center gap-2 border-[#5a6470] bg-white${glowing(`exam3d-do-${t.id}`)}`}>
                    <span className="text-[20px] leading-none" aria-hidden>
                      {t.icon}
                    </span>
                    {t.label}
                  </button>
                ))}
                {limbHere && !moving && (
                  <button type="button" data-testid="exam3d-do-move" onClick={startMove} className={`${big} flex items-center gap-2 border-[#5a6470] bg-white${glowing('exam3d-do-move')}`}>
                    <span className="text-[20px] leading-none" aria-hidden>
                      🤲
                    </span>
                    Move this joint
                  </button>
                )}
              </div>
              {moving && (
                <div className="mt-2 rounded-md border-2 border-[#181820] bg-[#fff8d8] p-2" data-testid="exam3d-move">
                  <p className="m-0 text-[15px]">
                    {moving.limb.kneeWithHip ? (
                      <>
                        Lift the knee: knee bent <b>{Math.round(scene.current?.angle(moving.limb.key.replace('hipflex', 'knee')) ?? 0)}°</b>, hip <b>{moving.value}°</b>
                      </>
                    ) : (
                      <>
                        {jointName(moving.limb.key)}: <b>{moving.value}°</b>
                      </>
                    )}
                  </p>
                  <input type="range" className="mt-1 h-10 w-full" min={range[0]} max={range[1]} value={moving.value} data-testid="exam3d-slider" onChange={(e) => slide(Number(e.target.value))} onPointerUp={finishMove} onKeyUp={finishMove} />
                  <button type="button" className={`${big} mt-1 w-full border-[#5a6470] bg-white`} onClick={() => setMoving(null)}>
                    Let go
                  </button>
                </div>
              )}
            </div>
          )}

          {panel?.kind === 'talk' && (
            <div data-testid="exam3d-ask">
              <div className="mb-1 flex items-center justify-between">
                <b className="font-[Press_Start_2P,monospace] text-[9px]">TALK TO {name.toUpperCase()}</b>
                <button type="button" className="rounded border-2 border-[#5a6470] bg-white px-2 py-1 text-[13px]" onClick={() => setPanel(null)}>
                  ✕ Close
                </button>
              </div>
              {groups.map((g) => (
                <div key={g} className="mb-2">
                  <p className="m-0 mb-1 font-[Press_Start_2P,monospace] text-[7px] text-[#8a5a00]">{g.toUpperCase()}</p>
                  <div className="flex flex-col gap-1.5">
                    {SAYS.filter((s) => s.group === g).map((s) =>
                      s.sided ? (
                        <div key={s.id} className="flex items-stretch gap-1.5">
                          <span className="flex-1 self-center text-[15px] leading-tight">“{s.label}”</span>
                          {(['R', 'L'] as const).map((side) => (
                            <button key={side} type="button" data-testid={`exam3d-say-${s.id}-${side}`} onClick={() => (setGlowId(null), ask(s, side))} className={`${big} border-[#5a6470] bg-white text-center${glowing(`exam3d-say-${s.id}-${side}`)}`}>
                              {side === 'R' ? 'Right' : 'Left'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button key={s.id} type="button" data-testid={`exam3d-say-${s.id}`} onClick={() => (setGlowId(null), ask(s))} className={`${big} border-[#5a6470] bg-white${glowing(`exam3d-say-${s.id}`)}`}>
                          “{s.label}”
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {panel?.kind === 'expose' && (
            <div data-testid="exam3d-exposepanel">
              <div className="mb-1 flex items-center justify-between">
                <b className="font-[Press_Start_2P,monospace] text-[9px]">EXPOSE</b>
                <button type="button" className="rounded border-2 border-[#5a6470] bg-white px-2 py-1 text-[13px]" onClick={() => setPanel(null)}>
                  ✕ Close
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    ['trunk', 'Chest and abdomen'],
                    ['arms', 'Arms'],
                    ['legs', 'Legs and feet'],
                  ] as const
                ).map(([part, label]) => (
                  <button key={part} type="button" data-testid={`exam3d-bare-${part}`} aria-pressed={bare[part]} onClick={() => toggleBare(part)} className={`${big} ${bare[part] ? 'border-[#181820] bg-[#ffe9a8]' : 'border-[#5a6470] bg-white'}`}>
                    {bare[part] ? '✓ ' : ''}
                    {label}
                  </button>
                ))}
                <button type="button" onClick={() => toggleBare('none')} className={`${big} border-[#5a6470] bg-white`}>
                  Cover everything up
                </button>
              </div>
            </div>
          )}

          {!panel && (
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" data-testid="exam3d-talk" onClick={() => (sfx.cursor(), setPanel({ kind: 'talk' }))} className={`${big} col-span-2 flex items-center gap-2 border-[#181820] bg-[#ffe9a8]`}>
                <span className="text-[20px]" aria-hidden>
                  💬
                </span>
                Talk to the patient, or ask them to move
              </button>
              <button type="button" data-testid="exam3d-expose" onClick={() => (sfx.cursor(), setPanel({ kind: 'expose' }))} className={`${big} col-span-2 flex items-center gap-2 border-[#5a6470] bg-white`}>
                <span className="text-[20px]" aria-hidden>
                  👕
                </span>
                Expose the patient (with a sheet for dignity)
              </button>
              <button type="button" data-testid="exam3d-gloves" onClick={gloves} className={`${big} flex items-center gap-2 border-[#5a6470] bg-white${glowing('exam3d-gloves')}`}>
                <span className="text-[20px]" aria-hidden>
                  🧤
                </span>
                Wash hands, gloves
              </button>
              <button type="button" onClick={() => setViewTo('whole')} className={`${big} flex items-center gap-2 border-[#5a6470] bg-white`}>
                <span className="text-[20px]" aria-hidden>
                  🧍
                </span>
                Whole patient
              </button>
            </div>
          )}
          <button type="button" className="tap mt-2 w-full" data-testid="exam3d-done" onClick={onClose}>
            DONE EXAMINING
          </button>
        </div>
      </div>
    </div>
  )
}

/** A joint as the slider names it. */
function jointName(key: string): string {
  const side = key.endsWith('-R') ? 'Right ' : key.endsWith('-L') ? 'Left ' : ''
  const base = key.replace(/-(R|L)$/, '')
  const name: Record<string, string> = {
    knee: 'knee bend',
    hipflex: 'hip flexion',
    hiprot: 'hip rotation (in −, out +)',
    shoulderabd: 'shoulder abduction',
    shoulderrot: 'shoulder rotation (in −, out +)',
    elbow: 'elbow bend',
    neckyaw: 'head turn',
  }
  return `${side}${name[base] ?? base}`
}

/** Part of something longer (one pulse of eight): say what you did, not yet what it means. */
function acknowledge(ev: Omit<ExamEvent, 'state'>, unconscious?: boolean): string {
  if (ev.tool === 'say') return reply(ev.say ?? '', unconscious)
  if (ev.tool === 'move') return 'Moved through its range.'
  const t = toolById(ev.tool)
  return `${t?.label ?? ev.tool} — ${ev.site ? siteLabel(ev.site) : 'done'}.`
}

/** Nothing to find that way there. */
function normal(ev: Omit<ExamEvent, 'state'>, unconscious?: boolean): string {
  if (ev.tool === 'say') return reply(ev.say ?? '', unconscious)
  const t = toolById(ev.tool)
  if (!t) return 'Done.'
  const where = ev.site ? siteLabel(ev.site) : 'there'
  return t.normal.replace('{site}', where).replace('{Site}', where.charAt(0).toUpperCase() + where.slice(1))
}

function reply(id: string, unconscious?: boolean): string {
  if (unconscious) return 'No response.'
  return sayOf(id)?.def.reply ?? 'Done.'
}
