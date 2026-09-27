import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { NextButton, NoteLine, useBench } from '../bench/core'
import { useButtons } from '../input'
import { sfx } from '../sfx'
import type { BenchResult, PerformJob } from '../store'
import {
  ARM_CM,
  EXTREME,
  GLANCE_S,
  HOLD_S,
  NOSE,
  SHOULDER,
  examSpec,
  fingertip,
  freshEyes,
  freshFingerNose,
  gazeOf,
  nystagmus,
  reachOf,
  scoreEyes,
  scoreFingerNose,
  zoneOf,
  type ExamScore,
  type Pt,
  type Side,
} from './model'

/** One examination test done by hand. The finding is the station's; the bench judges the technique. */
export function ExamBench({ job, onDone }: { job: PerformJob; onDone: (r: BenchResult) => void }) {
  const spec = examSpec(job.pose)
  function finish(score: ExamScore) {
    sfx.select()
    onDone({
      marks: score.ok ? job.grantMarks : [],
      faults: score.faults,
      summary: `${job.reply} ${score.technique}`.trim(),
    })
  }
  if (!spec) return <p className="io-lede px-3">This test is not ready yet.</p>
  if (spec.test === 'eyes') return <EyesTest side={spec.side} onFinish={finish} />
  return <FingerNoseTest side={spec.side} onFinish={finish} />
}

/* ---------------------------------------------------------------- shared pointer stage */

function usePointerStage(onMove: (p: { x: number; y: number }) => void, enabled = true) {
  const ref = useRef<HTMLDivElement>(null)
  function local(event: PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    }
  }
  return {
    ref,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (!enabled) return
        event.currentTarget.setPointerCapture(event.pointerId)
        const p = local(event)
        if (p) onMove(p)
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (!enabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return
        const p = local(event)
        if (p) onMove(p)
      },
    },
  }
}

/* ---------------------------------------------------------------- eye movements */

function EyesTest({ side, onFinish }: { side: Side; onFinish: (s: ExamScore) => void }) {
  const api = useBench(freshEyes, true)
  const [pen, setPen] = useState({ x: 50, y: 42 })
  const penRef = useRef(pen)
  const [t, setT] = useState(0)
  const hold = useRef<{ zone: ReturnType<typeof zoneOf>; since: number }>({ zone: null, since: 0 })
  const warnedExtreme = useRef(false)

  /** Credit the steady hold at the current pen position up to now. Runs on a timer and before each move. */
  function flushHold(now: number) {
    const run = api.runRef.current
    const g = gazeOf(penRef.current.x, penRef.current.y)
    const zone = run.toldHeadStill ? zoneOf(g.h, g.v) : null
    const h = hold.current
    if (zone !== h.zone) {
      h.zone = zone
      h.since = now
      return
    }
    if (zone && now - h.since > run.held[zone]) api.upd({ held: { ...run.held, [zone]: now - h.since } })
  }

  function movePen(p: { x: number; y: number }) {
    const now = performance.now() / 1000
    const prev = penRef.current
    const moved = Math.hypot(p.x - prev.x, p.y - prev.y) > 1.2
    if (moved) flushHold(now)
    penRef.current = p
    setPen(p)
    if (moved) {
      // A moving pen is not a hold: start timing again from here.
      hold.current.zone = null
      flushHold(now)
    }
    const run = api.runRef.current
    const g = gazeOf(p.x, p.y)
    if (!run.toldHeadStill && !run.headFollowed && Math.hypot(p.x - 50, p.y - 42) > 12) {
      api.upd({ headFollowed: true })
      api.physical('He turns his whole head to follow the pen. Ask him to keep his head still.')
    }
    if (run.toldHeadStill && !run.extreme && (Math.abs(g.h) > EXTREME || Math.abs(g.v) > EXTREME)) {
      api.upd({ extreme: true })
      if (!warnedExtreme.current) {
        warnedExtreme.current = true
        api.why('That is the extreme of gaze: a few beats of nystagmus are normal out there. Stop at about 30°.')
      }
    }
  }

  // Hold timing on a timer (keeps counting even if animation frames pause); the eyes animate per frame.
  useEffect(() => {
    const id = window.setInterval(() => flushHold(performance.now() / 1000), 100)
    let raf = 0
    const tick = () => {
      setT(performance.now() / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      window.clearInterval(id)
      cancelAnimationFrame(raf)
    }
  }, [])

  useButtons(31, true, (btn) => {
    const p = penRef.current
    const step = 5
    if (btn === 'left') movePen({ x: Math.max(0, p.x - step), y: p.y })
    else if (btn === 'right') movePen({ x: Math.min(100, p.x + step), y: p.y })
    else if (btn === 'up') movePen({ x: p.x, y: Math.max(0, p.y - step) })
    else if (btn === 'down') movePen({ x: p.x, y: Math.min(100, p.y + step) })
    else return false
  })

  const stage = usePointerStage(movePen)
  const run = api.run
  const g = gazeOf(pen.x, pen.y)
  const still = run.toldHeadStill
  const eyeH = still ? g.h : 0
  const jerk = still ? nystagmus(t, g.h, side) : 0
  const eyeV = still ? g.v : 0
  const headShift = still ? 0 : -g.h * 16
  const done = (s: number, need: number) => (s >= need ? '✓' : '·')

  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col px-3 pb-3">
      <p className="io-lede">Drag your pen (or use the D-pad) about 50 cm from his face. Trace an H and pause at each side.</p>
      <div
        ref={stage.ref}
        {...stage.handlers}
        className="relative my-2 aspect-[4/3] w-full max-w-[420px] self-center border-4 border-[#181820] bg-[#dfe8f0]"
        style={{ touchAction: 'none' }}
        data-testid="exam-eyes"
      >
        <svg viewBox="0 0 200 150" className="pixelated absolute inset-0 h-full w-full" shapeRendering="crispEdges">
          <Face shiftX={headShift} eyeH={eyeH} eyeV={eyeV} jerk={jerk} />
          <g transform={`translate(${pen.x * 2} ${pen.y * 1.5})`}>
            <rect x={-4} y={-4} width={8} height={8} fill="#d83838" stroke="#181820" strokeWidth={1} />
            <rect x={-2} y={4} width={4} height={26} fill="#283048" />
          </g>
        </svg>
      </div>
      <div className="io-row">
        <button type="button" className="tap io-mini" data-on={run.toldHeadStill || undefined} onClick={() => {
          api.upd({ toldHeadStill: true })
          hold.current.zone = null
          flushHold(performance.now() / 1000)
          api.feel('"Keep your head still and follow the pen with your eyes." He nods and holds still.')
        }}>
          “Head still, eyes follow”
        </button>
        <button type="button" className="tap io-mini" data-on={run.askedDiplopia || undefined} onClick={() => {
          api.upd({ askedDiplopia: true })
          api.feel('"Tell me if you see double." He sees single throughout.')
        }}>
          “Any double vision?”
        </button>
      </div>
      <p className="io-small" data-testid="exam-eyes-held">
        His right {done(run.held.right, HOLD_S)} · his left {done(run.held.left, HOLD_S)} · up {done(run.held.up, GLANCE_S)} · down {done(run.held.down, GLANCE_S)}
      </p>
      <NoteLine note={api.note} />
      <NextButton testId="exam-finish" onClick={() => {
        flushHold(performance.now() / 1000)
        onFinish(scoreEyes(api.runRef.current, side))
      }}>Finish</NextButton>
    </div>
  )
}

/**
 * A face drawn facing you: its right eye is on your left. The nystagmus beat is drawn larger than life
 * (a few pixels) so it can be seen on a phone.
 */
function Face({ shiftX, eyeH, eyeV, jerk }: { shiftX: number; eyeH: number; eyeV: number; jerk: number }) {
  const ix = -eyeH * 6 - jerk * 28
  const iy = -eyeV * 3.5
  return (
    <g transform={`translate(${shiftX} 0)`}>
      <rect x={52} y={14} width={96} height={122} rx={40} fill="#e8c2a0" stroke="#302018" strokeWidth={2} />
      <rect x={52} y={10} width={96} height={30} rx={14} fill="#403028" />
      {[76, 124].map((cx) => (
        <g key={cx}>
          <rect x={cx - 14} y={60} width={28} height={16} rx={7} fill="#fbfbf6" stroke="#302018" strokeWidth={1.5} />
          <circle cx={cx + ix} cy={68 + iy} r={5.5} fill="#5a3a20" />
          <circle cx={cx + ix} cy={68 + iy} r={2.4} fill="#101010" />
          <rect x={cx - 15} y={52} width={30} height={3} fill="#403028" />
        </g>
      ))}
      <rect x={96} y={78} width={8} height={20} fill="#d4a888" />
      <rect x={84} y={108} width={32} height={4} fill="#a05048" />
    </g>
  )
}

/* ---------------------------------------------------------------- finger–nose */

const CYCLES_S = 4

function FingerNoseTest({ side, onFinish }: { side: Side; onFinish: (s: ExamScore) => void }) {
  const api = useBench(freshFingerNose, true)
  const [arm, setArm] = useState<'right' | 'left'>('right')
  const [target, setTarget] = useState<Pt>({ x: 62, y: 56 })
  const [cm, setCm] = useState(30)
  const [playing, setPlaying] = useState<number | null>(null)
  const [t, setT] = useState(0)

  useEffect(() => {
    if (playing === null) return
    let raf = 0
    const tick = () => {
      setT((performance.now() - playing) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // The try ends on a timer, so a paused animation never leaves the bench stuck.
    const end = window.setTimeout(() => setPlaying(null), CYCLES_S * 1000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(end)
    }
  }, [playing])

  const stage = usePointerStage((p) => setTarget({ x: Math.max(20, Math.min(180, p.x * 2)), y: Math.max(12, Math.min(120, p.y * 1.6)) }), playing === null)

  useButtons(31, true, (btn) => {
    if (playing !== null) return
    const step = 6
    if (btn === 'left') setTarget((p) => ({ ...p, x: Math.max(0, p.x - step) }))
    else if (btn === 'right') setTarget((p) => ({ ...p, x: Math.min(200, p.x + step) }))
    else if (btn === 'up') setTarget((p) => ({ ...p, y: Math.max(8, p.y - step) }))
    else if (btn === 'down') setTarget((p) => ({ ...p, y: Math.min(120, p.y + step) }))
    else return false
  })

  function go() {
    if (playing !== null) return
    const reach = reachOf(cm)
    api.upd((r) => ({ attempts: [...r.attempts, { arm, target, cm, reach }] }))
    setPlaying(performance.now())
    sfx.select()
    if (reach === 'close') api.physical('He barely has to reach. At this distance the tremor will not show.')
    else if (reach === 'far') api.physical('Your finger is beyond his reach; he strains and topples forward.')
    else if (side === arm) api.feel(`His ${arm} finger wobbles more and more as it nears yours, and overshoots.`)
    else api.feel(`His ${arm} finger goes straight to yours and back.`)
  }

  const ataxic = side === arm
  const reachNow = reachOf(cm)
  // Out of reach, his finger stops short of yours.
  const aim = reachNow === 'far' ? shortOf(target, ARM_CM / cm) : target
  // Tremor shows only near full stretch.
  const tip = playing !== null ? fingertip(t, aim, ataxic && reachNow !== 'close') : NOSE
  // Nearer fingers look bigger.
  const scale = 1.25 - cm / 160
  const inactive = arm === 'right' ? 'left' : 'right'

  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col px-3 pb-3">
      <p className="io-lede">Place your finger (drag or D-pad) and set how far it is from his face. Choose his arm, then say go. Test both sides.</p>
      <div
        ref={stage.ref}
        {...stage.handlers}
        className="relative my-2 aspect-[5/4] w-full max-w-[420px] self-center border-4 border-[#181820] bg-[#e8e0cc]"
        style={{ touchAction: 'none' }}
        data-testid="exam-finger-nose"
      >
        <svg viewBox="0 0 200 160" className="pixelated absolute inset-0 h-full w-full" shapeRendering="crispEdges">
          <Seated />
          <ArmLine from={SHOULDER[inactive]} to={{ x: SHOULDER[inactive].x + (inactive === 'right' ? -6 : 6), y: 150 }} />
          <ArmLine from={SHOULDER[arm]} to={tip} active />
          {/* Your hand, reaching up into the scene from below: finger, fist, blue sleeve. */}
          <g transform={`translate(${target.x} ${target.y}) scale(${scale})`}>
            <rect x={-4} y={12} width={12} height={160} fill="#3c78d8" stroke="#181820" strokeWidth={1} />
            <rect x={-6} y={4} width={16} height={12} rx={3} fill="#f2d2b4" stroke="#302018" strokeWidth={1} />
            {/* Index finger up at the edge of the fist, thumb tucked across: a pointing hand. */}
            <rect x={-6} y={-9} width={5} height={14} rx={2} fill="#f2d2b4" stroke="#302018" strokeWidth={1} />
            <rect x={-2} y={6} width={9} height={4} rx={2} fill="#e8c0a0" stroke="#302018" strokeWidth={1} />
          </g>
        </svg>
      </div>
      <label className="io-small flex flex-col gap-1" data-testid="exam-distance">
        Your finger is {cm} cm from his face
        <input className="io-range" type="range" min={20} max={95} step={5} value={cm} disabled={playing !== null} onChange={(e) => setCm(Number(e.target.value))} />
      </label>
      <div className="io-row">
        {(['right', 'left'] as const).map((a) => (
          <button key={a} type="button" className="tap io-mini" data-on={arm === a || undefined} disabled={playing !== null} onClick={() => setArm(a)}>
            His {a} arm
          </button>
        ))}
      </div>
      <div className="io-row">
        <button type="button" className="tap io-mini" data-on={api.run.instructed || undefined} onClick={() => {
          api.upd({ instructed: true })
          api.feel('You show him: your finger, your nose, back again, as quickly as he can.')
        }}>
          Explain and demonstrate
        </button>
        <button type="button" className="tap io-mini" data-testid="exam-go" disabled={playing !== null} onClick={go}>
          “Touch my finger, then your nose”
        </button>
      </div>
      <NoteLine note={api.note} />
      <NextButton testId="exam-finish" onClick={() => onFinish(scoreFingerNose(api.runRef.current, side))}>Finish</NextButton>
    </div>
  )
}

/** A point on the way from his nose to your finger: where his fingertip stops when you are out of reach. */
function shortOf(target: Pt, k: number): Pt {
  return { x: NOSE.x + (target.x - NOSE.x) * k, y: NOSE.y + (target.y - NOSE.y) * k }
}

function Seated() {
  return (
    <g>
      <rect x={60} y={86} width={80} height={74} rx={10} fill="#8aa8c8" stroke="#302018" strokeWidth={2} />
      <rect x={92} y={70} width={16} height={18} fill="#e8c2a0" />
      <circle cx={100} cy={44} r={20} fill="#e8c2a0" stroke="#302018" strokeWidth={2} />
      <rect x={80} y={22} width={40} height={10} rx={4} fill="#403028" />
      <rect x={90} y={38} width={5} height={4} fill="#302018" />
      <rect x={105} y={38} width={5} height={4} fill="#302018" />
      <rect x={98} y={46} width={4} height={7} fill="#c89878" />
    </g>
  )
}

function ArmLine({ from, to, active }: { from: Pt; to: Pt; active?: boolean }) {
  // A simple two-segment arm with the elbow dropped below the straight line.
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + (active ? 10 : 4) }
  return (
    <g stroke="#302018" strokeLinecap="round">
      <polyline points={`${from.x},${from.y} ${mid.x},${mid.y} ${to.x},${to.y}`} fill="none" strokeWidth={9} />
      <polyline points={`${from.x},${from.y} ${mid.x},${mid.y} ${to.x},${to.y}`} fill="none" stroke="#e8c2a0" strokeWidth={6} />
      <circle cx={to.x} cy={to.y} r={active ? 4 : 3} fill={active ? '#f2a0a0' : '#e8c2a0'} stroke="#302018" strokeWidth={1} />
    </g>
  )
}
