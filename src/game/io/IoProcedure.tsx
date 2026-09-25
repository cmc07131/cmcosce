import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { buzz, drill, sfx } from '../sfx'
import {
  ANATOMY,
  FEEL_TEXT,
  FINDING_TEXT,
  NEEDLE_MM,
  caseFor,
  drillRate,
  farCortexDepth,
  feelAt,
  judgeLandmark,
  lineVisible,
  maxDepth,
  popDepth,
  rightNeedle,
  type Feel,
  type NeedleColour,
  type Side,
} from './case'
import {
  CalfSlice,
  CrossSection,
  DriverArt,
  ExtensionArt,
  GloveArt,
  HandArt,
  HubZoom,
  LegFront,
  NeedleCaseArt,
  PressureBagArt,
  StabilizerArt,
  SwabArt,
  SyringeArt,
  TowelArt,
  VialArt,
  ViseArt,
  WristbandArt,
  NEEDLE_HEX,
} from './art'
import { Dial, DragGhost, HoldButton, SayIt, Tool, capture, usePress, useSpin, useToolDrag, type SayOption } from '../bench/controls'
import { freshRun, leaks, scoreRun, type Run, type Scored } from './score'

const STAGES = ['survey', 'kit', 'position', 'landmark', 'clean', 'insert', 'secure', 'finish'] as const
type Stage = (typeof STAGES)[number]
const STAGE_TITLE: Record<Stage, string> = {
  survey: 'Choose the bone',
  kit: 'Assemble the EZ-IO',
  position: 'Position the leg',
  landmark: 'Find the landmark',
  clean: 'Clean the skin',
  insert: 'Insert',
  secure: 'Secure and confirm',
  finish: 'Finish',
}

type Note = { text: string; tone: 'feel' | 'coach' | 'bad' } | null

/**
 * EZ-IO, proximal tibia, as on a real patient. Nothing blocks you: mistakes carry on and are scored at the end.
 * `coach` shows the why after a mistake and unlocks the X-ray view and the anatomy card.
 */
export function IoProcedure({ seed, coach, onDone }: { seed: number; coach: boolean; onDone: (result: Scored) => void }) {
  const c = useMemo(() => caseFor(seed), [seed])
  const [stage, setStage] = useState<Stage>('survey')
  const [run, setRun] = useState<Run>(freshRun)
  const runRef = useRef(run)
  const [note, setNote] = useState<Note>(null)
  const index = STAGES.indexOf(stage)

  function upd(patch: Partial<Run> | ((r: Run) => Partial<Run>)) {
    const cur = runRef.current
    const next = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }
    runRef.current = next
    setRun(next)
    return next
  }
  function feel(text: string) {
    setNote({ text, tone: 'feel' })
  }
  function why(text: string) {
    if (coach) setNote({ text, tone: 'coach' })
  }
  function physical(text: string) {
    setNote({ text, tone: 'bad' })
    sfx.bump()
  }
  function go(next: Stage) {
    setNote(null)
    setStage(next)
    sfx.select()
  }
  function nextStage() {
    const following = STAGES[index + 1]
    if (following) go(following)
    else {
      drill.stop()
      onDone(scoreRun(runRef.current, c))
    }
  }

  useEffect(() => () => drill.stop(), [])

  const ctx: Ctx = { c, run, runRef, upd, feel, why, physical, coach, next: nextStage }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="io-bench">
      <div className="io-steps" aria-label={`Step ${index + 1} of ${STAGES.length}`}>
        {STAGES.map((s, i) => (
          <span key={s} data-on={i === index || undefined} data-done={i < index || undefined} />
        ))}
        <b>
          {index + 1}/{STAGES.length} {STAGE_TITLE[stage].toUpperCase()}
        </b>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {stage === 'survey' && <Survey {...ctx} />}
        {stage === 'kit' && <Kit {...ctx} />}
        {stage === 'position' && <Position {...ctx} />}
        {stage === 'landmark' && <Landmark {...ctx} />}
        {stage === 'clean' && <Clean {...ctx} />}
        {stage === 'insert' && <Insert {...ctx} />}
        {stage === 'secure' && <Secure {...ctx} />}
        {stage === 'finish' && <Finish {...ctx} />}
        {note && (
          <p className="io-note" data-tone={note.tone} data-testid="io-note">
            {note.tone === 'coach' ? 'WHY · ' : note.tone === 'bad' ? '! ' : ''}
            {note.text}
          </p>
        )}
      </div>
    </div>
  )
}

type Ctx = {
  c: ReturnType<typeof caseFor>
  run: Run
  runRef: React.MutableRefObject<Run>
  upd: (patch: Partial<Run> | ((r: Run) => Partial<Run>)) => Run
  feel: (text: string) => void
  why: (text: string) => void
  physical: (text: string) => void
  coach: boolean
  next: () => void
}

function NextButton({ children, onClick, testId = 'io-next' }: { children: ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className="tap io-next mt-3" data-testid={testId} onClick={onClick}>
      {children} ▶
    </button>
  )
}

/* ================================================================ 1. choose the bone */

function Survey({ c, run, upd, feel, why, next }: Ctx) {
  const sides: Side[] = ['right', 'left']
  return (
    <>
      <p className="io-lede">Both legs are under the blanket. You are at the foot of the trolley.</p>
      <div className="grid grid-cols-2 gap-2">
        {sides.map((side) => (
          <div key={side} className="io-card">
            <p className="io-card-title">PATIENT'S {side.toUpperCase()}</p>
            <div className="io-leg-small">
              <LegFront side={side} finding={run.exposed[side] ? c.legs[side] : 'clean'} blanket={!run.exposed[side]} />
            </div>
            {!run.exposed[side] ? (
              <button
                type="button"
                className="tap mt-1"
                data-testid={`expose-${side}`}
                onClick={() => {
                  upd((r) => ({ exposed: { ...r.exposed, [side]: true } }))
                  feel(`${side === 'left' ? 'Left' : 'Right'} leg: ${FINDING_TEXT[c.legs[side]]}`)
                }}
              >
                Expose and feel
              </button>
            ) : (
              <p className="io-small">{FINDING_TEXT[c.legs[side]]}</p>
            )}
            <button
              type="button"
              className="tap mt-1"
              data-testid={`use-${side}`}
              onClick={() => {
                const r = upd({ side })
                if (c.legs[side] !== 'clean') why('That bone is out: fracture, infection, burn, prosthesis, or an IO in the last 48 hours. Use the other leg or the humerus.')
                else if (!(r.exposed.left && r.exposed.right)) why('Look at both legs before you choose. The other leg might be the only clean one, or this one might hide a problem under the blanket.')
                next()
              }}
            >
              Use this tibia
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

/* ================================================================ 2. assemble */

const VIAL_TEXT = { plain2: 'Lidocaine 2% plain, preservative-free', adr1: 'Lidocaine 1% + adrenaline 1:200,000' }

function Kit({ run, runRef, upd, feel, physical, next }: Ctx) {
  const [salineOn, setSalineOn] = useState(false)
  const [prime, setPrime] = useState(run.primed ? 1 : 0)
  const primeRef = useRef(prime)
  const { drag, begin } = useToolDrag((tool, target) => {
    if (tool.startsWith('needle-')) {
      if (target !== 'driver') return physical('The needle set seats on the magnetic tip of the driver.')
      const colour = tool.slice(7) as NeedleColour
      upd({ needle: colour })
      sfx.select()
      buzz(20)
      feel(`Click. ${colour[0].toUpperCase()}${colour.slice(1)} ${NEEDLE_MM[colour]} mm needle set is on the driver, cap still on.`)
      return
    }
    if (tool === 'saline') {
      if (target !== 'extension') return physical('The saline syringe goes on the end of the extension set.')
      setSalineOn(true)
      feel('Saline syringe on the extension. Push to fill the line.')
      return
    }
    if (tool === 'plain2' || tool === 'adr1') {
      if (target !== 'lido-syringe') return physical('Draw it up into the empty syringe.')
      upd({ lidoVial: tool, lidoMl: 0 })
      feel(`Drawing up: ${VIAL_TEXT[tool]}. Set the volume.`)
    }
  })

  const ghost = drag
    ? drag.tool.startsWith('needle-')
      ? <NeedleCaseArt colour={drag.tool.slice(7) as NeedleColour} size={30} />
      : drag.tool === 'saline'
        ? <SyringeArt fill="saline" size={60} />
        : <VialArt kind={drag.tool as 'plain2' | 'adr1'} size={26} />
    : null

  return (
    <>
      <p className="io-lede">The EZ-IO case is open on the trolley. Drag parts together.</p>
      <div className="io-tray">
        <Tool id="driver" dropId="driver" caption="EZ-IO driver" state={run.needle ? `${run.needle} on` : 'no needle'}>
          <DriverArt size={64} needle={run.needle} />
        </Tool>
        {(['pink', 'blue', 'yellow'] as NeedleColour[]).map((colour) => (
          <Tool key={colour} id={`needle-${colour}`} caption={`${colour} ${NEEDLE_MM[colour]} mm`} onBegin={begin}>
            <NeedleCaseArt colour={colour} size={26} />
          </Tool>
        ))}
        <Tool id="extension" dropId="extension" caption="EZ-Connect extension" state={run.primed ? 'primed' : salineOn ? 'syringe on' : 'dry'}>
          <ExtensionArt size={56} primed={run.primed} />
        </Tool>
        <Tool id="saline" caption="10 mL saline" onBegin={begin} disabled={salineOn}>
          <SyringeArt fill="saline" size={56} />
        </Tool>
        <Tool id="lido-syringe" dropId="lido-syringe" caption="Empty 5 mL syringe" state={run.lidoVial ? `${run.lidoMl.toFixed(1)} mL` : 'empty'}>
          <SyringeArt fill={run.lidoVial && run.lidoMl > 0 ? 'lido' : 'empty'} size={56} />
        </Tool>
        <Tool id="plain2" caption={VIAL_TEXT.plain2} onBegin={begin}>
          <VialArt kind="plain2" size={22} />
        </Tool>
        <Tool id="adr1" caption={VIAL_TEXT.adr1} onBegin={begin}>
          <VialArt kind="adr1" size={22} />
        </Tool>
        <Tool id="stab" caption="EZ-Stabilizer">
          <StabilizerArt size={34} />
        </Tool>
        <Tool id="vise" caption="NeedleVISE">
          <ViseArt size={34} />
        </Tool>
        <Tool id="swab" caption="Chlorhexidine">
          <SwabArt size={44} />
        </Tool>
      </div>
      {salineOn && !run.primed && (
        <HoldButton
          testId="prime"
          onTick={(dt) => {
            primeRef.current = Math.min(1, primeRef.current + dt / 1.2)
            setPrime(primeRef.current)
            if (primeRef.current >= 1 && !runRef.current.primed) {
              upd({ primed: true })
              feel('Saline to the tip of the line. No air.')
            }
          }}
        >
          Hold · push saline through the extension ({Math.round(prime * 100)}%)
        </HoldButton>
      )}
      {run.lidoVial && (
        <div className="io-row mt-2">
          <span className="io-small">Draw up:</span>
          <button type="button" className="tap io-mini" onClick={() => upd((r) => ({ lidoMl: Math.max(0, +(r.lidoMl - 0.5).toFixed(1)) }))}>
            −
          </button>
          <b className="io-readout" data-testid="lido-ml">{run.lidoMl.toFixed(1)} mL</b>
          <button type="button" className="tap io-mini" onClick={() => upd((r) => ({ lidoMl: Math.min(5, +(r.lidoMl + 0.5).toFixed(1)) }))}>
            +
          </button>
        </div>
      )}
      <NextButton onClick={next}>Take the kit to the bedside</NextButton>
      <DragGhost at={drag}>{ghost}</DragGhost>
    </>
  )
}

/* ================================================================ 3. position */

function Position({ run, upd, feel, why, next }: Ctx) {
  const { drag, begin } = useToolDrag((tool, target) => {
    if (tool === 'gloves') {
      upd({ gloves: true })
      feel('Gloves on.')
      return
    }
    if (tool === 'towel') {
      if (target !== 'under') return feel('The towel goes under the calf.')
      upd({ towel: true })
      feel('Towel rolled under the calf. The knee is slightly flexed and supported.')
      return
    }
    if (tool === 'hand') {
      if (!target) return
      const before = !run.gloves
      if (target === 'behind') {
        upd({ handBehind: true, handsBeforeGloves: run.handsBeforeGloves || before })
        why('Never behind the bone. If the needle goes through, it goes into your hand.')
        return feel('Your hand is under the calf, behind the tibia.')
      }
      if (target === 'medial' || target === 'lateral') {
        upd((r) => ({ hands: { ...r.hands, [target]: true }, handsBeforeGloves: r.handsBeforeGloves || !r.gloves }))
        if (before) why('Gloves before you touch the limb.')
        feel(`Hand on the ${target} side of the shin.`)
      }
    }
  })
  return (
    <>
      <p className="io-lede">A slice through the upper calf. Set the leg up to be drilled.</p>
      <div className="io-figure relative aspect-[5/4]">
        <CalfSlice towel={run.towel} gloves={run.gloves} medial={run.hands.medial} lateral={run.hands.lateral} behind={run.handBehind} />
        <div className="absolute top-[30%] left-0 h-[40%] w-[28%]" data-drop="medial" />
        <div className="absolute top-[30%] right-0 h-[40%] w-[28%]" data-drop="lateral" />
        <div className="absolute bottom-[14%] left-[30%] h-[18%] w-[40%]" data-drop="behind" />
        <div className="absolute right-[20%] bottom-0 left-[20%] h-[12%]" data-drop="under" />
      </div>
      <div className="io-tray io-tray-row">
        <Tool id="gloves" caption="Gloves" onBegin={begin} disabled={run.gloves}>
          <GloveArt size={30} />
        </Tool>
        <Tool id="towel" caption="Towel" onBegin={begin} disabled={run.towel}>
          <TowelArt size={48} />
        </Tool>
        <Tool id="hand" caption="Your hand" onBegin={begin}>
          <HandArt size={30} gloved={run.gloves} />
        </Tool>
      </div>
      <NextButton onClick={next}>Find the landmark</NextButton>
      <DragGhost at={drag}>
        {drag?.tool === 'towel' ? <TowelArt size={60} /> : drag?.tool === 'gloves' ? <GloveArt size={36} /> : <HandArt size={36} gloved={run.gloves} />}
      </DragGhost>
    </>
  )
}

/* ================================================================ 4. landmark */

const SAY_LANDMARK: SayOption[] = [
  { text: 'Flat anteromedial tibia, about 2 cm medial to the tuberosity. I aim 90° to the bone.', ok: true },
  { text: 'On the tibial tuberosity, angled up toward the knee.', ok: false },
  { text: 'Lateral to the tibial crest, 2 cm below the joint line.', ok: false },
]

function useLegPointer(side: Side) {
  const box = useRef<HTMLDivElement>(null)
  function toLeg(event: { clientX: number; clientY: number }) {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || !rect.width) return null
    let x = ((event.clientX - rect.left) / rect.width) * 200
    const y = ((event.clientY - rect.top) / rect.height) * 300
    if (side === 'right') x = 200 - x
    return { x, y }
  }
  return { box, toLeg }
}

function Landmark({ c, run, upd, feel, why, coach, next }: Ctx) {
  const side = run.side ?? 'left'
  const { box, toLeg } = useLegPointer(side)
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null)
  const [xray, setXray] = useState(false)
  const [card, setCard] = useState(false)
  const lastFeel = useRef<Feel | null>(null)
  const hold = useRef<{ x: number; y: number; t: number } | null>(null)
  const timer = useRef(0)

  function touch(event: ReactPointerEvent<HTMLDivElement>) {
    const p = toLeg(event)
    if (!p) return
    setFinger(p)
    const f = feelAt(p.x, p.y)
    if (f !== lastFeel.current) {
      lastFeel.current = f
      if (f === 'patella' || f === 'tuberosity' || f === 'fibula' || f === 'crest') buzz(18)
      feel(FEEL_TEXT[f])
    }
    const h = hold.current
    if (!h || Math.hypot(p.x - h.x, p.y - h.y) > 4) {
      hold.current = { ...p, t: performance.now() }
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => mark(p), 650)
    }
  }

  function mark(p: { x: number; y: number }) {
    upd({ dent: p, saidLandmark: null })
    sfx.select()
    buzz(40)
    const v = judgeLandmark(p.x, p.y)
    feel('You press a dent with your fingernail.')
    if (!v.ok) why(v.note)
  }

  function release() {
    window.clearTimeout(timer.current)
    hold.current = null
    setFinger(null)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])
  const press = usePress({ move: touch, up: release })

  return (
    <>
      <p className="io-lede">
        Patient's {side} knee, from the front. Slide a finger to feel. Press and hold still to mark the spot.
      </p>
      <div
        ref={box}
        className="io-figure io-leg-big relative"
        style={{ touchAction: 'none' }}
        data-testid="landmark-leg"
        {...press}
      >
        <LegFront side={side} finding={c.legs[side]} xray={coach && xray} dent={run.dent}>
          {finger && <circle cx={finger.x} cy={finger.y} r="7" fill="#f0c8a0" stroke="#181820" strokeWidth="1" opacity="0.85" />}
        </LegFront>
      </div>
      {coach && (
        <div className="io-row mt-2">
          <button type="button" className="tap io-mini" data-testid="xray" onClick={() => setXray((v) => !v)}>
            X-RAY {xray ? 'ON' : 'OFF'}
          </button>
          <button type="button" className="tap io-mini" data-testid="anatomy-card" onClick={() => setCard(true)}>
            ANATOMY CARD
          </button>
        </div>
      )}
      {run.dent && (
        <SayIt
          prompt="Tell the examiner where you will go in."
          options={SAY_LANDMARK}
          picked={run.saidLandmark}
          onPick={(ok) => {
            upd({ saidLandmark: ok })
            if (!ok) why('Say the landmark: the flat anteromedial tibia, about 2 cm medial to the tuberosity, 90° to the bone.')
          }}
        />
      )}
      <NextButton onClick={next}>Clean the skin</NextButton>
      {card && <AnatomyCard side={side} onClose={() => setCard(false)} />}
    </>
  )
}

/** Reference card: the landmarks in front view, and the needle at 90° in side view. Drawn for this app. */
export function AnatomyCard({ side, onClose }: { side: Side; onClose: () => void }) {
  const t = ANATOMY.target
  const tags = [
    'Patella: round, slides under the skin',
    'Joint line: the soft gap below it',
    'Tibial tuberosity: the bump where the tendon ends',
    'Fibular head: lateral knob; the peroneal nerve wraps round it',
    'IO site (red X): flat bone, 2 cm medial to the tuberosity',
  ]
  return (
    <div className="io-modal" data-testid="anatomy-modal" onClick={onClose}>
      <div className="win io-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="win-title">PROXIMAL TIBIA · ADULT</h3>
          <button type="button" className="win-close" onClick={onClose}>
            B✕
          </button>
        </div>
        <div className="grid grid-cols-[3fr_2fr] gap-2">
          <div className="aspect-[2/3]">
            <LegFront side={side} xray>
              <g>
                <circle cx={t.x} cy={t.y} r="6" fill="none" stroke="#d03848" strokeWidth="2" />
                <path d={`M${t.x - 4} ${t.y - 4} L${t.x + 4} ${t.y + 4} M${t.x + 4} ${t.y - 4} L${t.x - 4} ${t.y + 4}`} stroke="#d03848" strokeWidth="2" />
                <path d={`M${t.x} ${t.y} L${ANATOMY.tuberosity.x} ${t.y}`} stroke="#d03848" strokeDasharray="2 2" />
              </g>
            </LegFront>
          </div>
          <SideView />
        </div>
        <ul className="io-card-list">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <p className="io-small">
          Adult: flat anteromedial surface, about 2 cm medial to the tibial tuberosity (about 3 cm below the lower pole of the patella). Needle 90° to the bone. Child: about 1 cm below the
          tuberosity, away from the growth plate.
        </p>
      </div>
    </div>
  )
}

function SideView() {
  return (
    <svg viewBox="0 0 120 180" className="block h-full w-full rounded border-2 border-[#181820] bg-[#eef3f8]">
      <text x="6" y="12" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#40404c">SIDE VIEW</text>
      <path d="M20 20 L56 20 L60 70 Q64 84 50 90 L30 90 Q16 84 20 70 Z" fill="#dce6fa" stroke="#5a6f9a" />
      <ellipse cx="64" cy="72" rx="6" ry="12" fill="#eef3ff" stroke="#5a6f9a" />
      <path d="M22 94 L58 94 Q66 100 64 110 L60 116 L56 175 L30 175 L28 110 Q20 100 22 94 Z" fill="#dce6fa" stroke="#5a6f9a" />
      <ellipse cx="62" cy="112" rx="4" ry="5" fill="#eef3ff" stroke="#5a6f9a" />
      <path d="M58 124 L96 124" stroke="#181820" strokeWidth="2" />
      <rect x="96" y="120" width="10" height="8" fill="#3a78d8" stroke="#181820" />
      <path d="M58 118 L58 130" stroke="#2f7a3e" strokeDasharray="2 2" />
      <text x="70" y="140" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#2f7a3e">90°</text>
      <text x="6" y="172" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">TIBIA</text>
      <text x="6" y="30" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">FEMUR</text>
    </svg>
  )
}

/* ================================================================ 5. clean */

function Clean({ c, run, runRef, upd, feel, why, next }: Ctx) {
  const side = run.side ?? 'left'
  const { box, toLeg } = useLegPointer(side)
  const last = useRef<{ x: number; y: number } | null>(null)
  /** The stroke that finished the scrub may carry on; only a fresh touch afterwards counts as touching. */
  const finishedThisStroke = useRef(false)
  const [wet, setWet] = useState(false)
  const [swab, setSwab] = useState<{ x: number; y: number } | null>(null)
  const dent = run.dent ?? ANATOMY.target

  useEffect(() => {
    if (!wet) return
    const id = window.setTimeout(() => {
      setWet(false)
      upd({ dry: true })
      feel('The chlorhexidine has dried.')
    }, 3000)
    return () => window.clearTimeout(id)
  }, [wet])

  function scrub(event: ReactPointerEvent<HTMLDivElement>) {
    const p = toLeg(event)
    if (!p) return
    setSwab(p)
    const r = runRef.current
    if (r.scrub >= 1) {
      if (finishedThisStroke.current) return
      if (Math.hypot(p.x - dent.x, p.y - dent.y) < 30 && !r.touchedPrep) {
        upd({ touchedPrep: true, dry: false })
        setWet(true)
        why('Once it is clean, do not touch it again. Clean again and let it dry.')
      }
      return
    }
    const prev = last.current
    last.current = p
    if (!prev || Math.hypot(p.x - dent.x, p.y - dent.y) > 34) return
    const next = Math.min(1, r.scrub + Math.hypot(p.x - prev.x, p.y - prev.y) / 700)
    upd({ scrub: next })
    if (next >= 1) {
      finishedThisStroke.current = true
      setWet(true)
      feel('Scrubbed back and forth for 30 seconds. Now it has to dry.')
    }
  }

  const press = usePress({
    down: () => {
      last.current = null
      finishedThisStroke.current = false
    },
    move: scrub,
    up: () => setSwab(null),
  })

  return (
    <>
      <p className="io-lede">Scrub the marked spot with the chlorhexidine applicator, then let it dry.</p>
      <div
        ref={box}
        className="io-figure io-leg-big relative"
        style={{ touchAction: 'none' }}
        data-testid="clean-leg"
        {...press}
      >
        <LegFront side={side} finding={c.legs[side]} dent={run.dent} prep={run.scrub} wet={wet}>
          {swab && <rect x={swab.x - 7} y={swab.y - 5} width="14" height="10" rx="2" fill="#f08840" stroke="#181820" />}
        </LegFront>
      </div>
      <div className="io-meter mt-2">
        <span style={{ width: `${run.scrub * 100}%` }} />
      </div>
      <p className="io-small">{run.scrub < 1 ? 'Scrubbing…' : wet ? 'Drying (about 30 seconds)…' : 'Dry.'}</p>
      <NextButton onClick={next}>Insert</NextButton>
    </>
  )
}

/* ================================================================ 6. insert */

function sayLine(visible: boolean): SayOption[] {
  return [
    { text: 'Tip on bone and a black 5 mm line shows above the skin. The length is enough.', ok: visible },
    { text: 'Tip on bone and no black line shows. I need a longer needle.', ok: !visible },
    { text: 'The line does not matter with a powered driver.', ok: false },
  ]
}

function Insert({ c, run, runRef, upd, feel, why, physical, coach, next }: Ctx) {
  const [capOn, setCapOn] = useState(true)
  const [angle, setAngle] = useState(22)
  const [zoom, setZoom] = useState(false)
  const [pressure, setPressure] = useState(0)
  const [drilling, setDrilling] = useState(false)
  const [popped, setPopped] = useState(false)
  const hardFor = useRef(0)
  const trig = useRef<{ y: number } | null>(null)
  const raf = useRef(0)
  const pressureRef = useRef(0)
  const lineOptions = useMemo(() => (run.needle ? sayLine(lineVisible(run.needle, c.tissueMm)) : []), [run.needle, c.tissueMm])
  const inBone = run.depth > c.tissueMm + 0.2
  const onDriver = !run.driverOff

  function reachBone() {
    upd({ depth: c.tissueMm, contact: true, contactAngle: angle })
    buzz(30)
    feel('Hard resistance. The tip is on bone.')
  }

  function push(dt: number) {
    const r = runRef.current
    if (!r.needle) return physical('There is no needle on the driver.')
    if (capOn) return physical('The cap is still on the needle.')
    if (r.contact) return
    const depth = r.depth + dt * 10
    if (depth >= c.tissueMm) reachBone()
    else upd({ depth })
  }

  function startDrill(event: ReactPointerEvent<HTMLDivElement>) {
    const r = runRef.current
    if (!r.needle) return physical('There is no needle on the driver.')
    if (capOn) return physical('The cap is still on the needle.')
    if (r.driverOff) return
    capture(event)
    trig.current = { y: event.clientY }
    setDrilling(true)
    drill.start()
    drill.pitch(r.depth >= popDepth(c) ? 150 : 220)
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const cur = runRef.current
      const p = pressureRef.current
      if (p > 0.85) hardFor.current += dt
      if (hardFor.current > 0.6 && !cur.tooHard) {
        upd({ tooHard: true })
        why('Gentle, steady pressure. Let the driver do the work.')
      }
      if (!cur.contact) {
        upd({ drilledBeforeContact: true })
        const d = cur.depth + dt * 12
        if (d >= c.tissueMm) reachBone()
        else upd({ depth: d })
      } else {
        const rate = drillRate(cur.depth, p, c)
        const before = cur.depth
        const d = Math.min(maxDepth(cur.needle!), before + rate * dt)
        upd({ depth: d, drilled: true })
        if (before < popDepth(c) && d >= popDepth(c)) {
          setPopped(true)
          buzz([30, 30, 60])
          drill.pitch(150)
          sfx.select()
          feel('Sudden give. You are in the marrow.')
        }
        if (d >= farCortexDepth(c) && before < farCortexDepth(c)) buzz(120)
      }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }

  function stopDrill() {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    trig.current = null
    pressureRef.current = 0
    setPressure(0)
    setDrilling(false)
    drill.stop()
  }

  useEffect(() => () => stopDrill(), [])

  function pickNeedle(colour: NeedleColour) {
    if (inBone) return physical('The needle is already in bone.')
    upd({ needle: colour, contact: false, depth: -6, lineChecked: false, saidLine: null })
    setCapOn(true)
    setZoom(false)
    feel(`${colour[0].toUpperCase()}${colour.slice(1)} ${NEEDLE_MM[colour]} mm needle set on the driver.`)
  }

  const spin = useSpin('ccw')
  useEffect(() => {
    if (spin.turns >= 1 && !run.styletOut) {
      upd({ styletOut: true })
      feel('The stylet unscrews and lifts out. The hub stands proud and firm.')
    }
  }, [spin.turns])
  useEffect(() => {
    if (spin.opposed) physical('That way tightens it. The stylet unscrews counter-clockwise.')
  }, [spin.opposed])

  return (
    <>
      <div className="io-figure relative aspect-[200/260]">
        <CrossSection c={c} colour={run.needle} depth={run.depth} angle={run.contact ? (run.contactAngle ?? angle) : angle} capOn={capOn} onDriver={onDriver} styletIn={!run.styletOut} popped={popped} coach={coach} />
        {zoom && run.needle && (
          <div className="io-zoom" data-testid="zoom">
            <HubZoom colour={run.needle} tissueMm={c.tissueMm} />
          </div>
        )}
      </div>

      {!run.drilled && (
        <>
          <div className="io-row mt-2">
            <span className="io-small">Needle:</span>
            {(['pink', 'blue', 'yellow'] as NeedleColour[]).map((colour) => (
              <button
                key={colour}
                type="button"
                className="tap io-mini"
                data-on={run.needle === colour || undefined}
                style={{ borderColor: NEEDLE_HEX[colour] }}
                onClick={() => pickNeedle(colour)}
              >
                {NEEDLE_MM[colour]}
              </button>
            ))}
            {capOn && run.needle && (
              <button type="button" className="tap io-mini" data-testid="cap-off" onClick={() => setCapOn(false)}>
                CAP OFF
              </button>
            )}
          </div>
          {!run.contact && (
            <label className="io-row mt-2 io-small">
              Tilt
              <input
                type="range"
                min={-35}
                max={35}
                value={angle}
                data-testid="tilt"
                onChange={(event) => setAngle(Number(event.target.value))}
                className="io-range"
              />
              {coach && <b>{Math.abs(angle) === 0 ? '90°' : `${90 - Math.abs(angle)}°`}</b>}
            </label>
          )}
          {!run.contact && (
            <HoldButton testId="push" onTick={push}>
              Hold · push through the skin, no drill
            </HoldButton>
          )}
          {run.contact && (
            <button
              type="button"
              className="tap mt-2"
              data-testid="look-hub"
              onClick={() => {
                setZoom(true)
                upd({ lineChecked: true })
              }}
            >
              Look at the hub
            </button>
          )}
          {zoom && run.needle && run.saidLine === null && (
            <SayIt
              prompt="What do you see at the skin?"
              options={lineOptions}
              picked={run.saidLine}
              onPick={(ok) => {
                upd({ saidLine: ok })
                if (!ok) why('With the tip on bone, at least one black 5 mm line must show above the skin. If not, the needle may not reach the marrow.')
                const verdict = rightNeedle(run.needle!, c.tissueMm)
                if (!verdict.ok) why(verdict.note)
              }}
            />
          )}
        </>
      )}

      {!run.driverOff && (
        <div
          className="io-trigger mt-2"
          data-drilling={drilling || undefined}
          data-testid="trigger"
          style={{ touchAction: 'none' }}
          onPointerDown={startDrill}
          onPointerMove={(event) => {
            if (!trig.current) return
            const p = Math.max(0, Math.min(1, (event.clientY - trig.current.y) / 90))
            pressureRef.current = p
            setPressure(p)
          }}
          onPointerUp={stopDrill}
          onPointerCancel={stopDrill}
        >
          <span>{drilling ? 'DRILLING' : 'HOLD TRIGGER'}</span>
          <span className="io-small">slide down to press harder</span>
          <div className="io-pressure">
            <span style={{ height: `${pressure * 100}%` }} data-hard={pressure > 0.85 || undefined} />
          </div>
        </div>
      )}

      {run.drilled && !run.driverOff && !drilling && (
        <div className="io-row mt-2">
          <button type="button" className="tap io-mini" data-on={run.hubHeld || undefined} data-testid="hold-hub" onClick={() => upd({ hubHeld: true })}>
            {run.hubHeld ? 'HUB HELD' : 'HOLD THE HUB'}
          </button>
          <button
            type="button"
            className="tap io-mini"
            data-testid="driver-off"
            onClick={() => {
              upd({ driverOff: true })
              if (!run.hubHeld) {
                physical('The catheter wobbled as the driver came off.')
                why('Steady the hub with your other hand, then lift the driver straight off.')
              } else feel('The driver lifts straight off the magnetic hub.')
            }}
          >
            LIFT DRIVER OFF
          </button>
        </div>
      )}

      {run.driverOff && !run.styletOut && (
        <div className="mt-2 flex items-center gap-3">
          <Dial label="STYLET" spin={spin} />
          <p className="io-small">Circle your finger round the dial to unscrew the stylet.</p>
        </div>
      )}

      {run.styletOut && run.styletSafe === null && (
        <div className="io-row mt-2">
          <button
            type="button"
            className="tap io-mini"
            data-testid="stylet-vise"
            onClick={() => {
              upd({ styletSafe: true })
              feel('Stylet straight down into the NeedleVISE.')
            }}
          >
            <ViseArt size={24} /> NEEDLEVISE
          </button>
          <button
            type="button"
            className="tap io-mini"
            onClick={() => {
              upd({ styletSafe: false })
              why('A loose stylet on the bed is a needlestick. Straight into the NeedleVISE.')
            }}
          >
            LAY IT ON THE BED
          </button>
        </div>
      )}

      <NextButton onClick={next}>Secure</NextButton>
    </>
  )
}

/* ================================================================ 7. secure and confirm */

type Attached = 'empty' | 'lido' | 'saline' | null

const SAY_CLOSE: SayOption[] = [
  { text: 'Proximal tibial IO, flushed, calf soft. A bridge, up to 24 hours: we convert to an IV or a central line.', ok: true },
  { text: 'IO in. It can stay until the ward round.', ok: false },
  { text: 'IO in. No need to flush if it is in bone.', ok: false },
]

function Secure({ c, run, runRef, upd, feel, why, physical, next }: Ctx) {
  const side = run.side ?? 'left'
  const [syringe, setSyringe] = useState<Attached>(null)
  const [aspirate, setAspirate] = useState(0)
  const [dwell, setDwell] = useState(0)
  const spin = useSpin('cw')
  const lidoLeft = Math.max(0, run.lidoMl - run.lidoFirstMl - run.lidoSecondMl)

  useEffect(() => {
    if (spin.turns >= 0.5 && run.extension && !run.locked) {
      upd({ locked: true })
      feel('Click. The extension is locked on the hub.')
    }
  }, [spin.turns])

  const { drag, begin } = useToolDrag((tool, target) => {
    if (target !== 'hub') return
    if (tool === 'stab') {
      upd({ stabilizer: true })
      feel('Stabilizer dressing over the hub, pressed flat on the skin.')
      return
    }
    if (tool === 'ext') {
      if (!run.stabilizer) {
        upd({ extBeforeStabilizer: true })
        physical('The extension will not seat. The stabilizer goes on the hub first.')
        return
      }
      upd({ extension: true })
      if (!run.primed) {
        physical('The line is dry. Air is going to go in.')
        why('Prime the extension with saline before it goes on.')
      } else feel('Primed extension on the hub. Twist it to lock.')
      return
    }
    if (!run.extension) return physical('Connect the extension first. The syringes go on its end.')
    if (tool === 'empty' || tool === 'lido' || tool === 'saline') {
      if (tool === 'lido' && !run.lidoVial) return physical('You did not draw up any lidocaine.')
      setSyringe(tool)
      feel(tool === 'empty' ? 'Empty 10 mL syringe on the line.' : tool === 'lido' ? 'Lidocaine syringe on the line.' : '10 mL saline flush on the line.')
    }
  })

  function giveLido(dt: number, fast: boolean) {
    const r = runRef.current
    const left = Math.max(0, r.lidoMl - r.lidoFirstMl - r.lidoSecondMl)
    if (left <= 0) return
    const ml = Math.min(left, dt * (fast ? 4 : 0.5))
    if (fast && !r.lidoFast) {
      upd({ lidoFast: true })
      why('Lidocaine into the marrow goes in slowly, over about 2 minutes.')
    }
    if (r.flush === 'none') upd({ lidoFirstMl: +(r.lidoFirstMl + ml).toFixed(3) })
    else upd({ lidoSecondMl: +(r.lidoSecondMl + ml).toFixed(3) })
  }

  function finishFlush(fast: boolean) {
    const r = runRef.current
    const swelling = c.extravasates || leaks(r, c)
    upd({ flush: fast ? 'fast' : 'slow', flushBeforeLido: r.lidoFirstMl === 0, swelling })
    if (r.lidoFirstMl === 0) {
      physical('He groans and pulls his leg away as the flush goes in.')
      why('He withdraws to pain. The flush hurts more than the drill: plain lidocaine first.')
    } else if (!fast) {
      physical('It trickles in against resistance.')
      why('No flush, no flow. Push the 10 mL hard and fast to open the marrow space.')
    } else feel(swelling ? 'The flush goes in… and the calf around the site is filling up.' : 'The flush goes in easily. No swelling.')
    setSyringe(null)
  }

  const ghost =
    drag?.tool === 'stab' ? <StabilizerArt size={36} /> : drag?.tool === 'ext' ? <ExtensionArt size={56} primed={run.primed} /> : drag ? <SyringeArt fill={drag.tool === 'lido' ? 'lido' : drag.tool === 'saline' ? 'saline' : 'empty'} size={60} /> : null

  return (
    <>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <div className="io-figure relative aspect-square" data-drop="hub" data-testid="hub-site">
          <HubScene run={run} syringe={syringe} marrow={aspirate >= 1 && c.marrowOnAspirate} spin={spin} />
        </div>
        <div className="io-figure aspect-[2/3]">
          <LegFront side={side} dent={run.dent} swelling={run.swelling} />
        </div>
      </div>
      <div className="io-tray io-tray-row">
        <Tool id="stab" caption="Stabilizer" onBegin={begin} disabled={run.stabilizer}>
          <StabilizerArt size={30} />
        </Tool>
        <Tool id="ext" caption={run.primed ? 'Extension (primed)' : 'Extension (dry)'} onBegin={begin} disabled={run.extension}>
          <ExtensionArt size={44} primed={run.primed} />
        </Tool>
        <Tool id="empty" caption="Empty 10 mL" onBegin={begin}>
          <SyringeArt size={44} />
        </Tool>
        <Tool id="lido" caption={run.lidoVial ? `Lidocaine ${lidoLeft.toFixed(1)} mL left` : 'No lidocaine'} onBegin={begin} disabled={!run.lidoVial}>
          <SyringeArt size={44} fill="lido" />
        </Tool>
        <Tool id="saline" caption="10 mL flush" onBegin={begin} disabled={run.flush !== 'none'}>
          <SyringeArt size={44} fill="saline" />
        </Tool>
      </div>

      {run.extension && !run.locked && (
        <div className="mt-2 flex items-center gap-3">
          <Dial label="LOCK" spin={spin} />
          <p className="io-small">Twist the connector to lock it.</p>
        </div>
      )}

      {syringe === 'empty' && (
        <HoldButton
          testId="aspirate"
          onTick={(dt) =>
            setAspirate((a) => {
              const n = Math.min(1, a + dt / 1.2)
              if (n >= 1 && a < 1) {
                upd({ aspirated: true })
                feel(c.marrowOnAspirate ? 'Dark red marrow comes back into the syringe.' : 'Nothing comes back. A firm needle that flushes easily is still a good IO.')
              }
              return n
            })
          }
        >
          Hold · pull back on the plunger
        </HoldButton>
      )}

      {syringe === 'lido' && (
        <>
          <p className="io-small mt-2" data-testid="lido-given">
            Given: {(run.lidoFirstMl + run.lidoSecondMl).toFixed(1)} mL · in syringe {lidoLeft.toFixed(1)} mL
          </p>
          <div className="grid grid-cols-2 gap-2">
            <HoldButton testId="lido-slow" onTick={(dt) => giveLido(dt, false)}>
              Hold · push slowly
            </HoldButton>
            <HoldButton testId="lido-fast" onTick={(dt) => giveLido(dt, true)}>
              Hold · push fast
            </HoldButton>
          </div>
          {run.lidoFirstMl > 0 && run.flush === 'none' && !run.dwell && (
            <HoldButton
              testId="dwell"
              onTick={(dt) =>
                setDwell((d) => {
                  const n = Math.min(1, d + dt / 2)
                  if (n >= 1 && d < 1) {
                    upd({ dwell: true })
                    feel('One minute. The lidocaine has sat in the marrow.')
                  }
                  return n
                })
              }
            >
              Hold · wait for it to work ({Math.round(dwell * 60)} s)
            </HoldButton>
          )}
          <button type="button" className="tap mt-2" onClick={() => setSyringe(null)}>
            Take the syringe off
          </button>
        </>
      )}

      {syringe === 'saline' && (
        <div className="grid grid-cols-2 gap-2">
          <HoldButton testId="flush-slow" onTick={() => undefined} onEnd={() => finishFlush(false)}>
            Hold · push gently
          </HoldButton>
          <button type="button" className="tap hold" data-testid="flush-fast" onClick={() => finishFlush(true)}>
            Push 10 mL hard, fast
          </button>
        </div>
      )}

      {run.flush !== 'none' && run.calf === null && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="tap mt-2"
            data-testid="calf-ok"
            onClick={() => {
              upd({ calf: run.swelling ? 'carried-on' : 'soft-ok' })
              if (run.swelling) why('Look at the calf. Tight swelling around the site is extravasation. Stop, remove the IO, and use a different bone.')
              else feel('Calf soft. Fluid runs.')
            }}
          >
            Calf soft · carry on
          </button>
          <button
            type="button"
            className="tap mt-2"
            data-testid="calf-stop"
            onClick={() => {
              upd({ calf: 'stopped' })
              if (!run.swelling) why('The calf was soft. A working IO was pulled.')
              else feel('Infusion stopped. The IO has to come out.')
            }}
          >
            Calf swelling · stop
          </button>
        </div>
      )}

      {run.calf === 'stopped' && run.removal === null && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="tap mt-2" data-testid="remove-straight" onClick={() => upd({ removal: 'straight' })}>
            Syringe on the hub, rotate clockwise, pull straight
          </button>
          <button
            type="button"
            className="tap mt-2"
            onClick={() => {
              upd({ removal: 'rocked' })
              why('Rocking can break the needle or the bone. Rotate clockwise and pull straight.')
            }}
          >
            Rock it side to side until it comes
          </button>
        </div>
      )}

      <NextButton onClick={next}>Finish</NextButton>
      <DragGhost at={drag}>{ghost}</DragGhost>
    </>
  )
}

/** Close-up of the insertion site from above. */
function HubScene({ run, syringe, marrow, spin }: { run: Run; syringe: Attached; marrow: boolean; spin: ReturnType<typeof useSpin> }) {
  const hub = run.needle ? NEEDLE_HEX[run.needle] : '#9098a8'
  const turn = run.locked ? 0 : spin.turns * 360
  return (
    <svg viewBox="0 0 120 120" className="block h-full w-full">
      <rect width="120" height="120" fill="#e8b494" />
      <circle cx="40" cy="30" r="30" fill="#f0c4a4" opacity="0.5" />
      {run.stabilizer && (
        <g>
          <rect x="30" y="38" width="60" height="44" rx="10" fill="#e8f4ec" stroke="#58a070" opacity="0.9" />
          <rect x="54" y="52" width="12" height="16" rx="3" fill="#78b890" />
        </g>
      )}
      <circle cx="60" cy="60" r="8" fill={hub} stroke="#181820" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="3" fill={run.styletOut ? '#181820' : '#c8d0d8'} />
      {run.extension && (
        <g transform={`rotate(${turn} 60 60)`}>
          <rect x="56" y="56" width="8" height="8" fill="#606874" />
          <path d="M64 60 Q90 60 100 90 L110 112" stroke="#181820" strokeWidth="5" fill="none" />
          <path d="M64 60 Q90 60 100 90 L110 112" stroke={run.primed ? '#a8d4f8' : '#f0f4f8'} strokeWidth="3" fill="none" />
          <rect x="82" y="64" width="8" height="5" fill="#e8b030" />
        </g>
      )}
      {syringe && (
        <g>
          <rect x="96" y="100" width="22" height="12" fill="#181820" />
          <rect x="97" y="101" width="20" height="10" fill={syringe === 'saline' ? '#b8dcf8' : syringe === 'lido' ? '#d8f0c8' : marrow ? '#c84848' : '#f4f8fc'} />
        </g>
      )}
      {!run.driverOff && (
        <text x="6" y="12" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">
          DRIVER STILL ON
        </text>
      )}
    </svg>
  )
}

/* ================================================================ 8. finish */

function Finish({ run, upd, feel, why, next }: Ctx) {
  return (
    <>
      <p className="io-lede">Make it safe to hand over.</p>
      <div className="io-tray io-tray-row">
        <button
          type="button"
          className="tool"
          data-testid="wristband"
          data-done={run.wristband || undefined}
          onClick={() => {
            upd({ wristband: true })
            feel('Wristband on: IO, side, date, and time in.')
          }}
        >
          <div className="tool-art">
            <WristbandArt size={48} />
          </div>
          <span className="tool-caption">{run.wristband ? 'Wristband ✓' : 'Wristband: time + site'}</span>
        </button>
        <button
          type="button"
          className="tool"
          data-testid="pressure-bag"
          data-done={run.pressureBag || undefined}
          onClick={() => {
            upd({ pressureBag: true })
            feel('The fluid bag is in a pressure bag at 300 mmHg.')
          }}
        >
          <div className="tool-art">
            <PressureBagArt size={30} />
          </div>
          <span className="tool-caption">{run.pressureBag ? 'Pressure bag ✓' : 'Pressure-bag the fluid'}</span>
        </button>
      </div>
      <SayIt
        prompt="Tell the team what you have done."
        options={SAY_CLOSE}
        picked={run.saidClose}
        onPick={(ok) => {
          upd({ saidClose: ok })
          if (!ok) why('An IO is temporary: up to 24 hours. Flush it, and plan an IV or central line.')
        }}
      />
      <NextButton onClick={next} testId="io-done">
        Hand over
      </NextButton>
    </>
  )
}
