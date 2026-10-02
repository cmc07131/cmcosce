import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { Dial, DragGhost, capture, useSpin, useToolDrag } from '../bench/controls'
import { CheckCard, PullStrap, toLocal, type Pt } from '../bench/kit'
import { usePlay, type BenchResult, type PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { BESIDE, FOOT_SITES, FootView, LegScene, ROW, X0, cmOf, xOf, type Splint } from './art'
import {
  HARE_MARKS,
  HEEL_CM,
  KNEE_CM,
  MANUAL_KG,
  OVER_KG,
  REGION_FINDING,
  SHORT_CM,
  TRACTION_OK,
  beyondHeel,
  checkHare,
  footCompromised,
  footFinding,
  freshHare,
  leftHeel,
  lengthWord,
  maxKg,
  pain,
  pull,
  releaseManual,
  scoreHare,
  shortfall,
  slide,
  strapSpot,
  wind,
  type FootCheck,
  type HareRun,
  type Region,
} from './model'

const TITLES = ['Check', 'Measure', 'Straps', 'Ankle hitch', 'Manual traction', 'Under the leg', 'Wind', 'Secure', 'Re-check']

type Stage = BenchApi<HareRun> & { next: () => void; analgesia: boolean }

/**
 * The Hare traction splint, by hand: check the leg and foot, measure on the good leg, lay out the straps, put on the
 * ankle hitch, have the nurse hold traction, slide the splint under to the ischium, wind the ratchet, strap and
 * stand, then check the foot again. Nothing stops a mistake: the leg, the foot and Mr Lo react, and it is scored.
 */
export function HareProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshHare, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const scene = usePlay((s) => s.scene)
  const analgesia = (scene ?? []).includes('analgesia')
  const done = useRef(false)

  function next() {
    sfx.select()
    if (index < TITLES.length - 1) setIndex(index + 1)
    else setChecked(true)
  }

  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const s = scoreHare(r)
    const marks = s.earned.map((k) => job.grantMarks[HARE_MARKS.indexOf(k)]).filter((m): m is string => Boolean(m))
    const kg = r.hooked ? r.kg : 0
    const ok = r.hooked && kg >= TRACTION_OK.min && kg <= TRACTION_OK.max
    onDone({
      marks,
      faults: s.faults,
      summary: `Hare splint: ${r.measuredOn ? `measured on the ${r.measuredOn} leg` : 'not measured'}, ${kg.toFixed(1)} kg of traction, left leg ${lengthWord(shortfall(r))}, pain ${pain(r, analgesia)}/10.`,
      scene: ok ? [job.scene || 'splinted'] : ['splint-loose'],
    })
  }

  const stage: Stage = { ...api, next, analgesia }
  const r = api.run
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="hare-bench">
      <div className="hare-bar" data-testid="hare-bar">
        <span>MR LO · PAIN {pain(r, analgesia)}/10</span>
        <span className="hare-pain">
          <i style={{ width: `${pain(r, analgesia) * 10}%` }} />
        </span>
        <span>L LEG {lengthWord(shortfall(r)).replace(' to the right', '').toUpperCase()}</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckTable run={r} onContinue={finish} />
        ) : (
          <>
            {index === 0 && <CheckStage {...stage} mode="before" />}
            {index === 1 && <MeasureStage {...stage} />}
            {index === 2 && <StrapStage {...stage} />}
            {index === 3 && <HitchStage {...stage} />}
            {index === 4 && <ManualStage {...stage} />}
            {index === 5 && <UnderStage {...stage} />}
            {index === 6 && <WindStage {...stage} />}
            {index === 7 && <SecureStage {...stage} />}
            {index === 8 && <CheckStage {...stage} mode="after" />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ================================================================ shared bits */

function Scene({ run, splint, onDown, onMove, onUp, hitchGhost, hookGhost, svg, dropId }: {
  run: HareRun
  splint: Splint | null
  onDown?: (p: Pt) => void
  onMove?: (p: Pt) => void
  onUp?: (p: Pt | null) => void
  hitchGhost?: number | null
  hookGhost?: Pt | null
  svg?: React.RefObject<SVGSVGElement | null>
  dropId?: string
}) {
  const own = useRef<SVGSVGElement>(null)
  const ref = svg ?? own
  const pressed = useRef(false)
  const [touch, setTouch] = useState<{ x: number; y: number; key: number } | null>(null)
  const at = (e: ReactPointerEvent) => toLocal(ref.current, e)
  return (
    <div
      className="io-figure aspect-[360/172]"
      style={{ touchAction: 'none' }}
      data-drop={dropId}
      onPointerDown={(e) => {
        const p = at(e)
        if (!p) return
        pressed.current = true
        capture(e)
        setTouch({ ...p, key: Date.now() })
        onDown?.(p)
      }}
      onPointerMove={(e) => {
        if (!pressed.current) return
        const p = at(e)
        if (p) onMove?.(p)
      }}
      onPointerUp={(e) => {
        if (!pressed.current) return
        pressed.current = false
        onUp?.(at(e))
      }}
      onPointerCancel={() => {
        pressed.current = false
        onUp?.(null)
      }}
    >
      <LegScene run={run} splint={splint} touch={touch} hitchGhost={hitchGhost} hookGhost={hookGhost} svgRef={ref} />
    </div>
  )
}

/** What a strap feels like under your fingers. */
function strapFeel(t: number, what: 'hitch' | 'ischial') {
  if (t <= 0.05) return 'Unfastened.'
  if (t < 0.35) return what === 'hitch' ? 'Loose: it slides on the heel.' : 'Loose: it would slip as you wind.'
  if (t > 0.85) return what === 'hitch' ? 'Far too tight: his toes go white and he says they tingle.' : 'Far too tight: it cuts into his groin and he yelps.'
  if (t > 0.75) return what === 'hitch' ? 'Tight: the skin blanches under the straps.' : 'Tight: it digs into the groin.'
  return what === 'hitch' ? 'Snug: two fingers slip under the straps.' : 'Snug across the groin, clear of the genitals.'
}

/* ================================================================ 1 and 9. check the leg and the foot */

function CheckStage({ run, runRef, upd, feel, physical, why, coach, next, mode }: Stage & { mode: 'before' | 'after' }) {
  const foot = useRef<SVGSVGElement>(null)
  const [pulse, setPulse] = useState<{ site: 'dp' | 'pt'; key: number } | null>(null)
  const after = mode === 'after'
  const field = after ? 'after' : 'before'

  function record(check: FootCheck) {
    upd((r) => ({ [field]: r[field].includes(check) ? r[field] : [...r[field], check] }) as Partial<HareRun>)
    feel(footFinding(runRef.current, check))
  }

  function region(p: Pt) {
    const r = runRef.current
    if (p.x < X0 + 4) return look('pelvis')
    if (Math.abs(p.y - ROW.right) < 22) return feel('That is his good leg.')
    if (Math.abs(p.y - ROW.left) > 24) return
    const cm = cmOf(p.x)
    const heel = leftHeel(r)
    if (cm < 7) return look('hip')
    if (cm < 33) {
      if (!r.exposed) return physical('Jeans cover the thigh. Cut the trouser leg to see the skin.')
      return look('thigh')
    }
    if (cm < KNEE_CM + 6) return look('knee')
    if (cm < heel - 7) return look('shin')
    if (cm < heel + 12) {
      if (!r.shoeOff) return physical('His trainer is still on: you cannot examine the ankle through it.')
      return look('ankle')
    }
  }

  function look(reg: Region) {
    if (!after) upd((r) => ({ regions: r.regions.includes(reg) ? r.regions : [...r.regions, reg] }))
    feel(REGION_FINDING[reg])
  }

  function tapFoot(e: ReactPointerEvent<HTMLDivElement>) {
    const p = toLocal(foot.current, e)
    if (!p) return
    const r = runRef.current
    if (!r.shoeOff) return physical('You cannot feel a pulse or test the skin through a trainer.')
    const near = (s: { x: number; y: number; r: number }) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r
    if (near(FOOT_SITES.dp)) {
      setPulse({ site: 'dp', key: Date.now() })
      return record('dp')
    }
    if (near(FOOT_SITES.pt)) {
      setPulse({ site: 'pt', key: Date.now() })
      return record('pt')
    }
    if (near(FOOT_SITES.nail)) return record('crt')
    if (near(FOOT_SITES.toes) || p.y < 30) return record('sens')
    feel('Your fingers on the foot. Feel for the pulses, touch the toes, press a nail bed.')
  }

  const r = run
  const done = (c: FootCheck) => r[field].includes(c)
  const compromised = after && footCompromised(r)
  return (
    <>
      <p className="io-lede">
        {after
          ? 'Check the foot again and compare with before. Tap the pulses, touch the toes, press a nail bed.'
          : 'Expose and examine. Tap the pelvis, hip, thigh, knee, shin and ankle. Then the foot: pulses, sensation, movement.'}
      </p>
      <Scene run={r} splint={after ? underSplint(r) : null} onDown={region} />
      <div className="io-figure mx-auto mt-2 aspect-[200/124] max-w-[240px]" style={{ touchAction: 'none' }} data-testid="hare-foot-tap" onPointerDown={tapFoot}>
        <FootView run={r} svgRef={foot} showSites={coach && !after} pulse={pulse} />
      </div>
      <p className="io-small" data-testid="hare-checked">
        Foot: {done('dp') || done('pt') ? 'pulse ✓' : 'pulse –'} · {done('sens') ? 'sensation ✓' : 'sensation –'} · {done('move') ? 'movement ✓' : 'movement –'} · {done('crt') ? 'refill ✓' : 'refill –'}
      </p>
      <div className="io-choices mt-2">
        {!after && (
          <button
            type="button"
            className="tap io-mini"
            data-on={r.exposed || undefined}
            data-testid="hare-expose"
            onClick={() => {
              upd({ exposed: true })
              feel('You cut the jeans up the outer seam with shears and fold them back. Blanket over his other leg.')
            }}
          >
            {r.exposed ? 'TROUSER CUT ✓' : 'CUT THE TROUSER LEG'}
          </button>
        )}
        <button
          type="button"
          className="tap io-mini"
          data-on={r.shoeOff || undefined}
          data-testid="hare-shoe"
          onClick={() => {
            if (r.shoeOff) return
            upd({ shoeOff: true })
            feel('Trainer and sock off, the leg held still while you ease them off.')
          }}
        >
          {r.shoeOff ? 'SHOE OFF ✓' : 'SHOE AND SOCK OFF'}
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="hare-wiggle"
          onClick={() => {
            if (!runRef.current.shoeOff) return physical('"I think I can move them… but the shoe is on." Take it off and watch.')
            record('move')
          }}
        >
          “WIGGLE YOUR TOES”
        </button>
      </div>
      {after && (
        <>
          {compromised && coach && <p className="io-small">The foot has changed since your first check.</p>}
          <TractionTweak run={r} upd={upd} feel={feel} physical={physical} />
        </>
      )}
      <NextButton onClick={next} testId="hare-next">
        {after ? 'Finish' : 'Measure'}
      </NextButton>
    </>
  )
}

/** Small corrections once the splint is on: a click of the ratchet either way, or ease the hitch. */
function TractionTweak({ run, upd, feel, physical }: Pick<Stage, 'run' | 'upd' | 'feel' | 'physical'>) {
  if (!run.hooked) return null
  return (
    <div className="io-choices mt-2">
      <button
        type="button"
        className="tap io-mini"
        data-testid="hare-release-click"
        onClick={() => {
          const r = upd((cur) => wind(cur, cur.kg - 0.5))
          sfx.cursor()
          feel(footCompromised(r) ? 'Click. A little less pull.' : 'Click. The foot pinks up as the pull eases.')
        }}
      >
        RATCHET: RELEASE A CLICK
      </button>
      <button
        type="button"
        className="tap io-mini"
        data-testid="hare-wind-click"
        onClick={() => {
          const r = upd((cur) => wind(cur, cur.kg + 0.5))
          sfx.cursor()
          if (pull(r) > OVER_KG) physical('He grimaces: "Too much!"')
          else feel('Click. A little more pull.')
        }}
      >
        WIND A CLICK
      </button>
      {run.hitchAt && (
        <button
          type="button"
          className="tap io-mini"
          data-testid="hare-ease-hitch"
          onClick={() => {
            const r = upd((cur) => ({ hitchTension: Math.max(0.4, cur.hitchTension - 0.15) }))
            feel(strapFeel(r.hitchTension, 'hitch'))
          }}
        >
          EASE THE HITCH
        </button>
      )}
    </div>
  )
}

function underSplint(r: HareRun): Splint | null {
  if (r.ringCm === null) return null
  return { y: ROW.left, ringCm: r.ringCm, lengthCm: r.lengthCm, straps: r.straps, fastened: r.fastened, stand: r.stand, ischial: r.ischialTension }
}

/* ================================================================ 2. measure */

function MeasureStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const dragging = useRef(false)
  function down(p: Pt) {
    const r = runRef.current
    const nearRow = (y: number) => Math.abs(p.y - y) < 20
    // Tap a leg near the hip end to lay the splint beside it.
    if (p.x < xOf(60) && (nearRow(ROW.left) || nearRow(ROW.right) || nearRow(BESIDE.left) || nearRow(BESIDE.right))) {
      if (r.locked) return feel('Locked. Unlock the collars to move it.')
      const leg = nearRow(ROW.left) || nearRow(BESIDE.left) ? 'left' : 'right'
      upd({ measuredOn: leg })
      if (leg === 'left') {
        physical('He groans as you line the splint up against the broken leg.')
        why('Measure on the uninjured leg: the broken one is shortened, and handling it hurts.')
      } else feel('Splint beside his right leg, the ring level with the ischial tuberosity.')
      return
    }
    if (!r.measuredOn) return feel('Lay the splint beside a leg first: tap the leg near the hip.')
    dragging.current = true
    move(p)
  }
  function move(p: Pt) {
    if (!dragging.current) return
    const r = runRef.current
    if (r.locked) {
      dragging.current = false
      return physical('The collars are locked. It will not extend.')
    }
    upd({ lengthCm: Math.round(Math.max(80, Math.min(128, cmOf(p.x)))) })
  }
  function up() {
    if (!dragging.current) return
    dragging.current = false
    const r = runRef.current
    feel(`Extended to ${r.lengthCm} cm: the end is about ${Math.round(beyondHeel(r))} cm past his heel.`)
  }
  const r = run
  const splint: Splint | null = r.measuredOn ? { y: BESIDE[r.measuredOn], ringCm: 0, lengthCm: r.lengthCm } : null
  return (
    <>
      <p className="io-lede">Tap a leg near the hip to lay the splint beside it. Drag along the leg to extend the foot end. Lock it.</p>
      <Scene run={r} splint={splint} onDown={down} onMove={move} onUp={up} />
      <p className="io-small">{r.measuredOn ? `Beside the ${r.measuredOn} leg · ${r.lengthCm} cm · ${Math.round(beyondHeel(r))} cm past the heel${r.locked ? ' · LOCKED' : ''}` : 'Splint folded on the trolley.'}</p>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={r.locked || undefined}
          data-testid="hare-lock"
          onClick={() => {
            if (!r.measuredOn) return feel('Measure it first.')
            upd({ locked: !r.locked })
            sfx.cursor()
            feel(r.locked ? 'Collars unlocked.' : 'You twist both collars: the length is locked.')
          }}
        >
          {r.locked ? 'LOCKED ✓' : 'LOCK THE COLLARS'}
        </button>
      </div>
      <NextButton onClick={next} testId="hare-next">
        Straps
      </NextButton>
    </>
  )
}

/* ================================================================ 3. straps */

function StrapStage({ run, runRef, upd, feel, why, next }: Stage) {
  const grab = useRef<number | null>(null)
  function down(p: Pt) {
    const r = runRef.current
    const cm = cmOf(p.x)
    let best = -1
    let bestD = 6
    r.straps.forEach((s, i) => {
      if (Math.abs(s - cm) < bestD) {
        bestD = Math.abs(s - cm)
        best = i
      }
    })
    if (best < 0) return feel('Drag a strap along the splint.')
    grab.current = best
  }
  function move(p: Pt) {
    const i = grab.current
    if (i === null) return
    const cm = Math.round(Math.max(2, Math.min(runRef.current.lengthCm - 4, cmOf(p.x))))
    upd((r) => ({ straps: r.straps.map((s, k) => (k === i ? cm : s)) }))
  }
  function up() {
    const i = grab.current
    grab.current = null
    if (i === null) return
    const spot = strapSpot(runRef.current.straps[i])
    if (spot === 'fracture') why('That strap will sit right on the fracture.')
    else if (spot === 'knee') why('That one is at the knee, over the fibular head and the common peroneal nerve.')
    else if (spot === 'ankle') why('That is where the ankle hitch goes.')
    else feel(`Strap laid open across the splint, on the ${spot}.`)
  }
  const r = run
  return (
    <>
      <p className="io-lede">The splint lies beside his left leg. Drag the four open straps to where they will sit on the leg.</p>
      <Scene run={r} splint={{ y: BESIDE.left, ringCm: 0, lengthCm: r.lengthCm, straps: r.straps }} onDown={down} onMove={move} onUp={up} />
      <NextButton onClick={next} testId="hare-next">
        Ankle hitch
      </NextButton>
    </>
  )
}

/* ================================================================ 4. ankle hitch */

function HitchStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [ghost, setGhost] = useState<number | null>(null)
  const tool = useToolDrag((_, target, at) => {
    setGhost(null)
    if (target !== 'leg') return
    const p = toLocal(svg.current, { clientX: at.x, clientY: at.y })
    if (!p || Math.abs(p.y - ROW.left) > 24) return feel('Put it on the left leg.')
    const r = runRef.current
    const cm = cmOf(p.x)
    const heel = leftHeel(r)
    if (cm < KNEE_CM) return why('That is the thigh. The hitch goes round the ankle and heel.')
    const at2 = Math.abs(cm - (heel - 3)) <= 6 ? 'ankle' : cm > heel + 3 ? 'foot' : 'calf'
    upd({ hitchAt: at2, hitchOverShoe: !r.shoeOff, hitchTension: 0 })
    sfx.select()
    if (!r.shoeOff) {
      physical('The hitch goes on over the trainer. You can no longer see or feel his foot.')
      why('Shoe off first, so you can check the foot after the splint is on.')
    } else if (at2 === 'ankle') feel('Padding behind the heel, the straps crossed over the instep, the D-ring under the sole.')
    else if (at2 === 'calf') why('On the calf it will slide up the leg as soon as you wind.')
    else why('On the forefoot it pulls on the toes and slips off.')
  })
  useEffect(() => {
    if (!tool.drag) return
    const p = toLocal(svg.current, { clientX: tool.drag.x, clientY: tool.drag.y })
    setGhost(p && Math.abs(p.y - ROW.left) < 24 ? cmOf(p.x) : null)
  }, [tool.drag])
  const r = run
  return (
    <>
      <p className="io-lede">Drag the ankle hitch onto his leg. Then pull its strap tight enough.</p>
      <Scene run={r} splint={{ y: BESIDE.left, ringCm: 0, lengthCm: r.lengthCm, straps: r.straps }} svg={svg} dropId="leg" hitchGhost={ghost} />
      <div className="io-choices mt-2">
        <div className="tool hare-tool" style={{ touchAction: 'none' }} data-testid="hare-hitch-tool" onPointerDown={(e) => tool.begin('hitch', e)}>
          <div className="tool-art">
            <span className="hare-hitch-chip" />
          </div>
          <span className="tool-caption">{r.hitchAt ? 'DRAG TO MOVE IT' : 'ANKLE HITCH'}</span>
        </div>
      </div>
      <DragGhost at={tool.drag}>
        <span className="hare-hitch-chip" />
      </DragGhost>
      <PullStrap
        label="HITCH STRAP"
        value={r.hitchTension}
        disabled={!r.hitchAt}
        testId="hare-hitch-strap"
        onChange={(v) => upd({ hitchTension: v })}
        onRelease={(v) => (v > 0.85 ? physical(strapFeel(v, 'hitch')) : feel(strapFeel(v, 'hitch')))}
      />
      <NextButton onClick={next} testId="hare-next">
        Manual traction
      </NextButton>
    </>
  )
}

/* ================================================================ 5. manual traction */

function ManualStage({ run, upd, feel, physical, why, next }: Stage) {
  const lines: { how: 'steady' | 'jerk' | 'lift'; text: string }[] = [
    { how: 'steady', text: 'Nurse Tung, hold the hitch with both hands and pull steadily in line with the leg. Keep it until I say.' },
    { how: 'jerk', text: 'Nurse Tung, give it a good sharp pull to straighten it out.' },
    { how: 'lift', text: 'Nurse Tung, just lift his foot up for me.' },
  ]
  const r = run
  return (
    <>
      <p className="io-lede">You need both hands for the splint. Tell Nurse Tung what to do.</p>
      <Scene run={r} splint={{ y: BESIDE.left, ringCm: 0, lengthCm: r.lengthCm, straps: r.straps }} />
      <div className="sayit mt-2" data-testid="hare-manual">
        <p className="sayit-prompt">SAY IT</p>
        {lines.map((l) => (
          <button
            key={l.how}
            type="button"
            className="sayit-opt"
            data-chosen={r.manualHow === l.how || undefined}
            onClick={() => {
              sfx.select()
              upd((cur) => ({ manual: true, manualHow: l.how, jerked: cur.jerked || l.how === 'jerk', painSpikes: cur.painSpikes + (l.how === 'steady' ? 0 : 1) }))
              if (l.how === 'steady') feel('She grips the hitch and leans back slowly. The leg lengthens; he breathes out.')
              if (l.how === 'jerk') {
                buzz([40, 30, 40])
                physical('She yanks. He screams as the bone ends grind.')
                why('Traction is steady and in line, never a jerk.')
              }
              if (l.how === 'lift') {
                physical('She lifts the foot. The thigh sags at the fracture and he cries out.')
                why('Lifting is not traction: she must pull steadily in line to hold the length.')
              }
            }}
          >
            “{l.text}”
          </button>
        ))}
      </div>
      <NextButton onClick={next} testId="hare-next">
        Under the leg
      </NextButton>
    </>
  )
}

/* ================================================================ 6. slide it under, ring to the ischium */

function UnderStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const [ring, setRingState] = useState<number>(() => (run.ringCm ?? leftHeel(run) + 16))
  const ringRef = useRef(ring)
  const setRing = (v: number) => {
    ringRef.current = v
    setRingState(v)
  }
  const moving = useRef(false)
  const warned = useRef(false)
  function move(p: Pt) {
    if (!moving.current) return
    const r = runRef.current
    const cm = Math.max(-8, Math.min(leftHeel(r) + 16, cmOf(p.x)))
    setRing(cm)
    if (cm < leftHeel(r) && !warned.current && !(r.manual && r.manualHow !== 'lift')) {
      warned.current = true
      buzz([40, 30, 40])
      physical('Nobody is holding traction: the leg sags as you lift it, and he screams.')
    }
  }
  function up() {
    if (!moving.current) return
    moving.current = false
    const r = runRef.current
    const ring = ringRef.current
    if (ring >= leftHeel(r)) return
    upd(slide(r, ring))
    if (ring < -3) {
      physical('The ring is jammed up into his groin.')
      why('The ring sits against the ischial tuberosity, not the perineum.')
    } else if (ring > 3) why(`The ring is ${Math.round(ring)} cm down the thigh, short of the ischium: no counter-traction.`)
    else feel('The padded ring rests snugly against the ischial tuberosity.')
  }
  const r = run
  return (
    <>
      <p className="io-lede">Slide the splint up under his leg until the ring meets the ischial tuberosity. Then fasten the ischial strap.</p>
      <Scene
        run={r}
        splint={{ y: ROW.left, ringCm: ring, lengthCm: r.lengthCm, straps: r.straps, ischial: r.ischialTension }}
        onDown={() => (moving.current = true)}
        onMove={move}
        onUp={up}
      />
      <PullStrap
        label="ISCHIAL STRAP"
        value={r.ischialTension}
        disabled={r.ringCm === null || r.ringCm > 12}
        testId="hare-ischial-strap"
        onChange={(v) => upd({ ischialTension: v })}
        onRelease={(v) => (v > 0.85 ? physical(strapFeel(v, 'ischial')) : feel(strapFeel(v, 'ischial')))}
      />
      <NextButton onClick={next} testId="hare-next">
        Wind
      </NextButton>
    </>
  )
}

/* ================================================================ 7. hook on and wind */

function WindStage({ run, runRef, upd, feel, physical, why, coach, analgesia, next }: Stage) {
  const [hook, setHookState] = useState<Pt | null>(null)
  const hookRef = useRef<Pt | null>(null)
  const setHook = (p: Pt | null) => {
    hookRef.current = p
    setHookState(p)
  }
  const spin = useSpin('cw')
  const lastTurns = useRef(0)
  const r = run
  const splint = underSplint(r) ?? { y: ROW.left, ringCm: 0, lengthCm: r.lengthCm }
  const endX = xOf(splint.ringCm + splint.lengthCm)
  const dRing = { x: xOf(leftHeel(r)) + 16, y: ROW.left }

  useEffect(() => {
    const delta = spin.turns - lastTurns.current
    lastTurns.current = spin.turns
    if (delta <= 0) return
    const cur = runRef.current
    if (!cur.hooked) return feel('The strap winds onto the spool but pulls nothing: hook it on the D-ring first.')
    const before = cur.kg
    const nextR = upd(wind(cur, cur.kg + delta * 2))
    if (nextR.kg >= maxKg(nextR) - 0.01 && maxKg(nextR) < TRACTION_OK.min) {
      physical('The windlass is up against his foot: no room left to wind.')
      return why('The splint is too short. It should reach 20–30 cm past the heel.')
    }
    const crossed = (v: number) => before < v && nextR.kg >= v
    if (crossed(OVER_KG)) {
      buzz(60)
      return physical('"Stop! It\'s pulling my foot off!" His toes look pale.')
    }
    const said: string[] = []
    if (crossed(MANUAL_KG) && nextR.manual) said.push('Nurse Tung: "I can feel it taking over."')
    if (crossed(TRACTION_OK.min)) said.push(`His face relaxes: "That's better." The heels are nearly level.`)
    if (crossed(TRACTION_OK.max + 0.5)) said.push('The left heel is now past the right one.')
    if (said.length) feel(said.join(' '))
  }, [spin.turns])

  const p = pull(r)
  return (
    <>
      <p className="io-lede">Drag the hook from the windlass to the D-ring. Wind the ratchet clockwise. Then ease the nurse off.</p>
      <Scene
        run={r}
        splint={splint}
        hookGhost={hook}
        onDown={(pt) => {
          if (runRef.current.hooked) return
          if (Math.abs(pt.x - endX) < 22 && Math.abs(pt.y - ROW.left) < 22) setHook(pt)
          else feel('The hook is on the strap at the windlass, at the foot end of the splint.')
        }}
        onMove={(pt) => hookRef.current && setHook(pt)}
        onUp={(pt) => {
          if (!hookRef.current) return
          setHook(null)
          const cur = runRef.current
          if (!pt || Math.hypot(pt.x - dRing.x, pt.y - dRing.y) > 14) return feel('Not on the D-ring. Try again.')
          if (!cur.hitchAt) return physical('There is no ankle hitch to hook onto.')
          upd({ hooked: true })
          sfx.select()
          feel('The S-hook clicks into the D-ring.')
        }}
      />
      <div className="mt-2 flex items-center justify-center gap-4">
        <Dial label="RATCHET" spin={spin} />
        <div className="io-small" data-testid="hare-ratchet">
          {r.hooked ? 'Hooked on' : 'Not hooked'}
          <br />
          {coach ? `Pull ≈ ${p.toFixed(1)} kg` : `${Math.round(r.kg * 2)} clicks`}
          <br />
          {lengthWord(shortfall(r))}
          <br />
          Pain {pain(r, analgesia)}/10
        </div>
      </div>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="hare-release-click"
          onClick={() => {
            upd((cur) => wind(cur, cur.kg - 0.5))
            sfx.cursor()
            feel('You press the release: one click back.')
          }}
        >
          RELEASE A CLICK
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="hare-ease-off"
          disabled={!r.manual}
          onClick={() => {
            const nextR = upd(releaseManual(runRef.current))
            if (nextR.releasedEarly && !r.releasedEarly) {
              buzz([40, 30, 40])
              physical('She lets go. The leg springs back short and he cries out.')
              why('Wind until the ratchet holds the length before she lets go.')
            } else feel('"Easing off… slowly." The ratchet holds the length.')
          }}
        >
          “NURSE, EASE OFF SLOWLY”
        </button>
      </div>
      <NextButton onClick={next} testId="hare-next">
        Secure
      </NextButton>
    </>
  )
}

/* ================================================================ 8. straps and stand */

function SecureStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const grab = useRef<{ i: number; x: number; moved: boolean } | null>(null)
  const r = run
  const splint = underSplint(r)
  const ring = r.ringCm ?? 0
  function down(p: Pt) {
    const cur = runRef.current
    const cm = cmOf(p.x) - ring
    let best = -1
    let bestD = 6
    cur.straps.forEach((s, i) => {
      if (Math.abs(s - cm) < bestD) {
        bestD = Math.abs(s - cm)
        best = i
      }
    })
    if (best < 0) return feel('Tap a strap to fasten it.')
    grab.current = { i: best, x: p.x, moved: false }
  }
  function move(p: Pt) {
    const g = grab.current
    if (!g || runRef.current.fastened[g.i]) return
    if (Math.abs(p.x - g.x) > 4) g.moved = true
    if (!g.moved) return
    const cm = Math.round(Math.max(2, Math.min(runRef.current.lengthCm - 4, cmOf(p.x) - ring)))
    upd((cur) => ({ straps: cur.straps.map((s, k) => (k === g.i ? cm : s)) }))
  }
  function up() {
    const g = grab.current
    grab.current = null
    if (!g) return
    const cur = runRef.current
    const spot = strapSpot(cur.straps[g.i] + ring)
    if (g.moved) return feel(`You work the strap along under the leg to the ${spot}.`)
    const on = !cur.fastened[g.i]
    upd({ fastened: cur.fastened.map((f, k) => (k === g.i ? on : f)) })
    sfx.cursor()
    if (!on) return feel('Strap undone.')
    if (spot === 'fracture') {
      buzz(40)
      physical('He cries out: that strap presses right on the fracture.')
    } else if (spot === 'knee') why('That strap crosses the fibular head: the common peroneal nerve.')
    else feel(`Velcro fastened over the ${spot}, snug.`)
  }
  return (
    <>
      <p className="io-lede">Tap each leg strap to fasten it (drag one to move it first). Lower the heel stand.</p>
      <Scene run={r} splint={splint} onDown={down} onMove={move} onUp={up} />
      <p className="io-small">
        {r.fastened.filter(Boolean).length}/4 straps fastened · stand {r.stand ? 'down' : 'up'}
        {r.manual ? ' · Nurse Tung is still holding traction' : ''}
      </p>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={r.stand || undefined}
          data-testid="hare-stand"
          onClick={() => {
            upd({ stand: !r.stand })
            feel(r.stand ? 'Stand folded.' : 'The heel stand swings down: the heel is off the trolley, the leg supported in line.')
          }}
        >
          {r.stand ? 'STAND DOWN ✓' : 'LOWER THE HEEL STAND'}
        </button>
        {r.manual && (
          <button
            type="button"
            className="tap io-mini"
            onClick={() => {
              const nextR = upd(releaseManual(runRef.current))
              if (nextR.releasedEarly && !r.releasedEarly) physical('She lets go. The leg springs back short and he cries out.')
              else feel('"Easing off… slowly." The ratchet holds.')
            }}
          >
            “NURSE, EASE OFF SLOWLY”
          </button>
        )}
      </div>
      <NextButton onClick={next} testId="hare-next">
        Re-check
      </NextButton>
    </>
  )
}

/* ================================================================ the check */

function CheckTable({ run, onContinue }: { run: HareRun; onContinue: () => void }) {
  return (
    <CheckCard
      rows={checkHare(run)}
      onContinue={onContinue}
      testId="hare-check"
      footer={`Left leg ${SHORT_CM} cm short at the start; the right heel is the dashed line at ${HEEL_CM} cm.`}
    />
  )
}
