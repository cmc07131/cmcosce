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
import { advance, freshProgress, parseDo, toolsOf, type ExamEvent, type Plan, type Progress } from './model'
import { ExamScene, type Limb, type Posture, type View } from './scene'
import { siteLabel, siteOf } from './sites'
import { bowel, doppler, fork, heartbeat, percussNote } from './sounds'

/**
 * The physical examination, done on a 3D patient: pick a tool, then look, feel, press, percuss, listen, move a limb
 * or ask them to do something. Each exam item's `do` line says what performs it; done, it scores exactly as picking it
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
/** How long to keep a finger down for a hold tool (seconds). */
const HOLD_S: Record<string, number> = { press: 0.7, listen: 1.1, doppler: 1.1, scanner: 1 }

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
  const press = useRef<{ x: number; y: number; t: number; moved: boolean; drag?: { limb: Limb; site: string; start: Record<string, number> } } | null>(null)
  const timers = useRef<number[]>([])
  const [tool, setTool] = useState('look')
  const [side, setSide] = useState<'R' | 'L'>('R')
  const [askOpen, setAskOpen] = useState(false)
  const [view, setView] = useState<View>('whole')
  const [loading, setLoading] = useState(true)
  const [credit, setCredit] = useState<Credit | null>(null)
  const [note, setNote] = useState<Note>({ text: `${name} is on the couch. Pick a tool, then use it on them. Ask them to move or change position with ASK.`, tone: 'hint' })
  const [illus, setIllus] = useState<{ kind: IllustrationKind; text: string } | null>(null)
  const [holding, setHolding] = useState<{ x: number; y: number; need: number; t0: number } | null>(null)
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
    onClose?.()
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

  function ask(def: SayDef) {
    const s = scene.current
    if (!s) return
    const id = def.sided ? `${def.id}-${side}` : def.id
    setAskOpen(false)
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

  /* ---------------------------------------------------------------- hands on */

  const toolDef = toolById(tool)

  function down(e: React.PointerEvent) {
    const s = scene.current
    if (!s || loading || !toolDef || toolDef.use === 'menu' || toolDef.use === 'self') return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* fine */
    }
    const p = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false } as NonNullable<typeof press.current>
    if (toolDef.use === 'drag') {
      const at = s.pick(e.clientX, e.clientY)
      const limb = s.limbAt(at?.site ?? null)
      if (!limb || !at?.site) {
        setNote({ text: 'Take hold of a limb — a hand, a forearm, an arm, a foot, a leg — or the head, then move it.', tone: 'hint' })
        return
      }
      p.drag = { limb, site: at.site, start: s.angles() }
      setNote({ text: `Holding ${siteLabel(at.site)}.`, tone: 'normal' })
    }
    if (toolDef.use === 'hold') setHolding({ x: e.clientX, y: e.clientY, need: HOLD_S[tool] ?? 0.8, t0: performance.now() })
    press.current = p
  }

  function move(e: React.PointerEvent) {
    const s = scene.current
    const p = press.current
    if (!s || !p) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) p.moved = true
    const d = p.drag
    if (!d) return
    // The limb follows your finger: how far the point you hold moves on screen for a few degrees.
    const step = 6
    const a = s.siteWorld(d.site)
    const before = a ? s.screenOf(a) : null
    const after = s.probe(d.limb, step, d.site)
    if (!before || !after) return
    const vx = after.x - before.x
    const vy = after.y - before.y
    const len2 = Math.max(vx * vx + vy * vy, 64)
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    const range = JOINT_RANGE[d.limb.key.replace(/-(R|L)$/, '')] ?? [-90, 90]
    const next = Math.max(range[0], Math.min(range[1], s.angle(d.limb.key) + ((dx * vx + dy * vy) / len2) * step))
    s.setHeld(d.limb, next)
  }

  function up(e: React.PointerEvent) {
    const s = scene.current
    const p = press.current
    press.current = null
    setHolding(null)
    if (!s || !p || !toolDef) return
    if (p.drag) {
      // Every joint the drag moved through a real range counts: lifting the knee flexes the hip and the knee.
      const { limb, start, site } = p.drag
      const now = s.angles()
      const side = limb.joint.match(/-(R|L)$/)?.[1]
      const moves: string[] = []
      if (Math.abs((now[limb.key] ?? 0) - (start[limb.key] ?? 0)) >= 15) moves.push(`${limb.joint}:${limb.dof}`)
      if (side && limb.kneeWithHip && Math.abs((now[`knee-${side}`] ?? 0) - (start[`knee-${side}`] ?? 0)) >= 15) moves.push(`knee-${side}:flex`)
      if (moves.length === 0) setNote({ text: 'Move it further: through its range.', tone: 'hint' })
      for (const m of moves) handle({ tool: 'move', move: m, site })
      return
    }
    if (p.moved) return
    const held = (performance.now() - p.t) / 1000
    if (toolDef.use === 'hold' && held < (HOLD_S[tool] ?? 0.8)) {
      setNote({ text: tool === 'listen' ? 'Keep the stethoscope there a moment to listen.' : 'Hold it there a moment.', tone: 'hint' })
      return
    }
    const at = s.pick(e.clientX, e.clientY)
    if (!at) {
      setNote({ text: `Use the ${toolDef.label.toLowerCase()} on ${name.split(' ')[0] === 'The' ? 'the patient' : name}.`, tone: 'hint' })
      return
    }
    if (!at.site) {
      setNote({ text: 'Closer to a landmark: nothing to find just there.', tone: 'hint' })
      return
    }
    if (tool === 'press' && PAIN_SITES.test(at.site)) s.stimulus()
    handle({ tool, site: at.site }, at.point)
  }

  function pickTool(id: string) {
    const t = toolById(id)
    if (!t) return
    sfx.cursor()
    if (t.use === 'menu') {
      setAskOpen((o) => !o)
      return
    }
    setAskOpen(false)
    if (t.use === 'self') {
      handle({ tool: id })
      return
    }
    setTool(id)
    if (id === 'move') setNote({ text: 'Take hold of a limb or the head and move it.', tone: 'hint' })
  }

  function setViewTo(v: View) {
    setView(v)
    scene.current?.setView(v)
  }

  const groups = useMemo(() => [...new Set(SAYS.map((s) => s.group))], [])
  // Development: drive the examination from tests without picking on the canvas.
  if (import.meta.env.DEV) Object.assign(window, { __examDo: handle })
  const total = items.filter((i) => !i.option.isTrap).length
  const got = items.filter((i) => !i.option.isTrap && done.has(i.option.id)).length

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
        <div className="relative mx-3 min-h-[240px] flex-[1_1_52%] overflow-hidden rounded-md border-[3px] border-[#181820] bg-[#dfe5ea]" style={{ touchAction: 'none' }}>
          <div ref={host} className="absolute inset-0" data-testid="exam3d-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          {loading && <p className="absolute inset-0 grid place-items-center font-[Press_Start_2P,monospace] text-[8px] text-[#40404c]">Bringing {name} in…</p>}
          <div className="absolute left-1 top-1 flex max-w-[calc(100%-8px)] flex-wrap gap-1" onPointerDown={(e) => e.stopPropagation()}>
            {VIEWS.map((v) => (
              <button key={v.id} type="button" data-testid={`exam3d-view-${v.id}`} aria-pressed={view === v.id} onClick={() => setViewTo(v.id)} className={`rounded border px-1 py-0.5 font-[Press_Start_2P,monospace] text-[6px] leading-none ${view === v.id ? 'border-[#181820] bg-[#181820] text-white' : 'border-[#5a6470]/60 bg-white/85 text-[#40404c]'}`}>
                {v.label}
              </button>
            ))}
          </div>
          {holding && <HoldRing {...holding} />}
          {illus && (
            <div className="absolute bottom-6 right-1 w-[46%]" onPointerDown={(e) => e.stopPropagation()} onClick={() => setIllus(null)}>
              <Illustration kind={illus.kind} finding={illus.text} />
            </div>
          )}
          {credit &&
            (credit.href ? (
              <a href={credit.href} target="_blank" rel="noreferrer" className="absolute bottom-1 right-1 text-[8px] text-[#5a6470] opacity-70" onPointerDown={(e) => e.stopPropagation()}>
                {credit.text}
              </a>
            ) : (
              <span className="pointer-events-none absolute bottom-1 right-1 text-[8px] text-[#5a6470] opacity-70">{credit.text}</span>
            ))}
        </div>

        <div className="mx-3 mt-2 flex gap-1 overflow-x-auto pb-1" role="toolbar" aria-label="Examination tools" data-testid="exam3d-tools">
          {tools.map((t) => (
            <button key={t.id} type="button" data-testid={`exam3d-tool-${t.id}`} aria-pressed={t.use === 'menu' ? askOpen : tool === t.id} onClick={() => pickTool(t.id)} className={`flex min-w-[46px] flex-none flex-col items-center rounded border-2 px-1 py-1 ${(t.use === 'menu' ? askOpen : tool === t.id) ? 'border-[#181820] bg-[#ffe9a8]' : 'border-[#5a6470]/50 bg-white'}`}>
              <span className="text-[16px] leading-none" aria-hidden>
                {t.icon}
              </span>
              <span className="mt-0.5 font-[Press_Start_2P,monospace] text-[5px] leading-tight text-[#303040]">{t.label.toUpperCase()}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-[1_1_40%] overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
          {askOpen ? (
            <div data-testid="exam3d-ask">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-[Press_Start_2P,monospace] text-[7px]">SIDE:</span>
                {(['R', 'L'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)} className={`rounded border px-2 py-0.5 font-[Press_Start_2P,monospace] text-[7px] ${side === s ? 'border-[#181820] bg-[#181820] text-white' : 'border-[#5a6470] bg-white'}`}>
                    {s === 'R' ? 'RIGHT' : 'LEFT'}
                  </button>
                ))}
              </div>
              {groups.map((g) => (
                <div key={g} className="mb-1">
                  <p className="m-0 font-[Press_Start_2P,monospace] text-[6px] text-[#8a5a00]">{g.toUpperCase()}</p>
                  <div className="flex flex-wrap gap-1">
                    {SAYS.filter((s) => s.group === g).map((s) => (
                      <button key={s.id} type="button" data-testid={`exam3d-say-${s.id}`} onClick={() => ask(s)} className="tap io-mini">
                        {s.label}
                        {s.sided ? ` (${side === 'R' ? 'right' : 'left'})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className={`exam3d-note m-0 rounded border-2 p-2 text-[15px] leading-snug ${note.tone === 'finding' ? 'border-[#1a7a40] bg-[#e4f7e8]' : note.tone === 'warn' ? 'border-[#b8282a] bg-[#fde7e7]' : note.tone === 'hint' ? 'border-[#c0a040] bg-[#fff8d8]' : 'border-[#9aa4ad] bg-white'}`} data-testid="exam3d-note" aria-live="polite">
                {note.text}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[#50505c]">
                {toolDef?.use === 'hold' ? `${toolDef.label}: keep your finger on the spot.` : toolDef?.use === 'drag' ? 'Move: drag a limb through its range.' : toolDef ? `${toolDef.label}: tap where you want to use it.` : ''}
              </p>
            </>
          )}
          <button type="button" className="tap mt-2 w-full" data-testid="exam3d-done" onClick={onClose}>
            DONE EXAMINING
          </button>
        </div>
      </div>
    </div>
  )
}

/** A ring that fills while a hold tool is kept on the spot. */
function HoldRing({ x, y, need, t0 }: { x: number; y: number; need: number; t0: number }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setK(Math.min(1, (performance.now() - t0) / 1000 / need)), 50)
    return () => window.clearInterval(id)
  }, [need, t0])
  return (
    <svg className="pointer-events-none fixed z-50" style={{ left: x - 22, top: y - 22 }} width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r="18" fill="none" stroke="#ffffff99" strokeWidth="4" />
      <circle cx="22" cy="22" r="18" fill="none" stroke={k >= 1 ? '#58f878' : '#ffd34d'} strokeWidth="4" strokeDasharray={`${113 * k} 113`} transform="rotate(-90 22 22)" />
    </svg>
  )
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
