import { useEffect, useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench } from '../bench/core'
import { CheckCard, benchMarks } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { useSettings } from '../settings'
import { ExamRoom, type Credit, type Joint, type Pose, type View } from './scene3d'
import { EPLEY_MARKS, HALLPIKE_MARKS, epleyRows, freshPos, hallpikeRows, headOverEnd, nystagmus, provoking, type Dx, type PosRun } from './model'

/**
 * The Dix–Hallpike and Epley in 3D. Mrs Chau sits on the couch; you move her with your hands: slide her down the
 * couch, hold her head and turn it, lie her back briskly so the head drops over the end, and watch her eyes on the
 * video goggles. Whatever you hold follows your finger. `pose: "epley"` starts in the right Hallpike position.
 */

/** Simulated seconds per real second while you wait in a position. */
const TIME = 2.5

type Grab = { kind: 'slide' | 'head' | 'drop' | 'roll' | 'sit'; x: number; y: number; t0: number; rollAtStart: number }

export default function Positional3D({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const epley = job.pose === 'epley'
  const titles = epley ? ['Hold', 'Turn', 'Roll', 'Sit up', 'Retest'] : ['Explain', 'Position', 'Turn', 'Lie back', 'Watch', 'Interpret']
  const api = useBench(() => freshPos(epley), coach)
  const { run, runRef, upd, feel, physical, why } = api
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [says, setSays] = useState<string | null>(null)
  const patientModel = useSettings((s) => s.patientModel)
  const [credit, setCredit] = useState<Credit | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const room = useRef<ExamRoom | null>(null)
  const grab = useRef<Grab | null>(null)
  const sim = useRef({ provokedS: 0, retestS: -1, said: new Set<string>(), uiTick: 0 })
  const stageRef = useRef(titles[0])
  stageRef.current = titles[index]
  const done = useRef(false)

  /* ---------------------------------------------------------------- the 3D room */

  useEffect(() => {
    if (!host.current) return
    useSettings.getState().load()
    const r = new ExamRoom(host.current, useSettings.getState().patientModel)
    room.current = r
    if (import.meta.env.DEV) Object.assign(window, { __room: r, __posRun: runRef })
    r.ready.then(() => {
      setLoading(false)
      setCredit(r.credit)
    })
    const ro = new ResizeObserver(() => r.resize())
    ro.observe(host.current)
    r.onFrame = (dt) => frame(r, dt)
    return () => {
      ro.disconnect()
      r.dispose()
      room.current = null
    }
  }, [])

  // A change of patient model in the settings recasts her; the pose and every timer carry on.
  // (Read from the store: on the first render the hook may still hold the default, before saved settings load.)
  useEffect(() => {
    const r = room.current
    const want = useSettings.getState().patientModel
    if (!r || r.avatar === want) return
    setLoading(true)
    r.setAvatar(want).then(() => {
      if (r.avatar !== want) return
      setLoading(false)
      setCredit(r.credit)
    })
  }, [patientModel])

  const say = (key: string, line: string) => {
    if (sim.current.said.has(key)) return
    sim.current.said.add(key)
    setSays(line)
    window.setTimeout(() => setSays((s) => (s === line ? null : s)), 3500)
  }

  /** Every frame: pose her from the run; run the clocks; drive her eyes and face. */
  function frame(r: ExamRoom, dt: number) {
    const cur = runRef.current
    const stage = stageRef.current
    const pose: Pose = { hipX: cur.hipX, lie: cur.lie, roll: cur.roll, yaw: cur.yaw, ext: cur.ext, flex: cur.flex }
    // The retest: a quick right Hallpike, then back up.
    const s = sim.current
    if (s.retestS >= 0) {
      s.retestS += dt
      const k = Math.min(1, s.retestS / 1.2)
      const back = s.retestS > 5 ? Math.min(1, (s.retestS - 5) / 1.5) : 0
      Object.assign(pose, { hipX: 0.55, yaw: 45 * k * (1 - back), lie: k * (1 - back), roll: 0, ext: 20 * k * (1 - back), flex: 0 })
      if (s.retestS > 6.6) {
        s.retestS = -1
        upd({ retested: true, yaw: 0, lie: 0, ext: 0, flex: 0 })
        feel('Right Dix–Hallpike repeated: no nystagmus, no spinning. Treated.')
      }
    }
    r.pose = pose
    r.setView(viewFor(stage, epley))
    r.goggles = (stage === 'Watch' || stage === 'Interpret' || (epley && stage === 'Retest')) ? { x: 0.02, y: 0.03, w: 0.5, h: 0.3 } : null

    // Nystagmus: only in the provoking position, only in the first Hallpike.
    const prov = !epley && provoking(cur)
    s.provokedS = prov ? s.provokedS + dt * TIME : Math.max(0, s.provokedS - dt * 4)
    const n = !epley ? nystagmus(s.provokedS) : { torsion: 0, vertical: 0, strength: 0 }
    const shut = n.strength > 0.25 && !cur.eyesOpenAsked
    r.eyes = { torsion: n.torsion, vertical: n.vertical, closed: shut ? 1 : 0, squint: n.strength * 0.4, distress: n.strength * 0.8 }
    if (n.strength > 0.3) say('spin', cur.eyesOpenAsked ? '"Oh! The room’s spinning!" She grips your arm, but keeps her eyes on you.' : '"Oh! It’s spinning!" She squeezes her eyes shut.')

    // Clocks.
    s.uiTick += dt
    const patch: Partial<PosRun> = {}
    if (stage === 'Watch' && !shut) {
      patch.watchedS = cur.watchedS + dt * TIME
      if (n.strength > 0.4) patch.sawNystagmus = true
    }
    if (epley) {
      const holds = [...cur.holds]
      if (stage === 'Hold' && cur.lie > 0.95 && cur.yaw >= 30) holds[0] += dt * TIME
      if (stage === 'Turn' && cur.turned && cur.yaw <= -35 && cur.ext >= 10) holds[1] += dt * TIME
      if (stage === 'Roll' && cur.rolled && cur.roll <= -0.85) holds[2] += dt * TIME
      if (holds.some((h, i) => h !== cur.holds[i])) patch.holds = holds
    }
    if (Object.keys(patch).length) {
      Object.assign(runRef.current, patch)
      if (s.uiTick > 0.2) {
        s.uiTick = 0
        upd({})
      }
    }
  }

  /* ---------------------------------------------------------------- hands on her */

  /** Pose the room from the run right now, so picking and dragging never use a stale frame. */
  function sync(r: ExamRoom) {
    const c = runRef.current
    r.pose = { hipX: c.hipX, lie: c.lie, roll: c.roll, yaw: c.yaw, ext: c.ext, flex: c.flex }
    r.applyPose()
  }

  function near(r: ExamRoom, joint: Joint, x: number, y: number, px = 110) {
    sync(r)
    const p = r.screenOfJoint(joint)
    return !!p && Math.hypot(p.x - x, p.y - y) <= px
  }

  function down(e: React.PointerEvent) {
    const r = room.current
    if (!r || loading) return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* fine */
    }
    const stage = stageRef.current
    const cur = runRef.current
    const g: Grab = { kind: 'head', x: e.clientX, y: e.clientY, t0: performance.now(), rollAtStart: cur.roll }
    if (stage === 'Position') g.kind = 'slide'
    else if (stage === 'Roll') {
      g.kind = 'roll'
      if (!near(r, 'shoulder', e.clientX, e.clientY, 150) && !near(r, 'chest', e.clientX, e.clientY, 150)) return feel('Take hold of her right shoulder and hip, and pull her toward you.')
    }
    else if (stage === 'Sit up') g.kind = 'sit'
    else if (stage === 'Lie back') g.kind = 'drop'
    else if (stage !== 'Turn') return
    if ((g.kind === 'head' || g.kind === 'drop' || g.kind === 'sit') && !near(r, 'head', e.clientX, e.clientY)) return feel('Put your hands on her head: hold it either side.')
    grab.current = g
    sfx.cursor()
  }

  /** Move the value so that the joint follows the finger: probe how the joint moves on screen for a small change. */
  function follow(r: ExamRoom, dx: number, dy: number, key: keyof Pose, step: number, joint: 'nose' | 'head' | 'chest' | 'shoulder') {
    sync(r)
    const cur = runRef.current as unknown as Pose
    const a = r.probe({}, joint)
    const b = r.probe({ [key]: cur[key] + step } as Partial<Pose>, joint)
    if (!a || !b) return 0
    const vx = b.x - a.x
    const vy = b.y - a.y
    const len2 = vx * vx + vy * vy
    if (len2 < 0.5) return 0
    return ((dx * vx + dy * vy) / len2) * step
  }

  /**
   * A wide turn: one steady direction on screen, from where the joint is at `from` to where it is at `to`, for the
   * whole arc. Following the instantaneous direction stalls and reverses wherever the arc runs toward the camera.
   */
  function followArc(r: ExamRoom, dx: number, dy: number, key: keyof Pose, from: number, to: number, joint: 'nose' | 'head' | 'chest' | 'shoulder') {
    sync(r)
    const a = r.probe({ [key]: from } as Partial<Pose>, joint)
    const b = r.probe({ [key]: to } as Partial<Pose>, joint)
    if (!a || !b) return 0
    const vx = b.x - a.x
    const vy = b.y - a.y
    // Never more than 90° for 120 px of finger, however short the arc looks.
    const len2 = Math.max(vx * vx + vy * vy, 120 * 120)
    return ((dx * vx + dy * vy) / len2) * (to - from)
  }

  function move(e: React.PointerEvent) {
    const r = room.current
    const g = grab.current
    if (!r || !g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    g.x = e.clientX
    g.y = e.clientY
    const cur = runRef.current
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    if (g.kind === 'slide') upd({ hipX: clamp(cur.hipX + follow(r, dx, dy, 'hipX', -0.05, 'chest'), 0.5, 0.9) })
    if (g.kind === 'head') {
      const turn = epley ? followArc(r, dx, dy, 'yaw', 45, -45, 'nose') : follow(r, dx, dy, 'yaw', 8, 'nose')
      const yaw = clamp(cur.yaw + turn, -75, 75)
      upd({ yaw })
      if (epley && stageRef.current === 'Turn' && yaw <= -35 && !cur.turned) {
        upd({ turned: true })
        feel('Through 90°: her head now turned 45° to the left, still hanging over the end.')
      }
    }
    if (g.kind === 'drop') {
      if (cur.lie < 1) {
        const lie = clamp(cur.lie + follow(r, dx, dy, 'lie', 0.08, 'head'), 0, 1)
        if (cur.lie < 0.05 && lie >= 0.05) g.t0 = performance.now()
        upd({ lie })
        if (lie >= 0.97 && cur.dropS === null) {
          upd({ lie: 1, dropS: (performance.now() - g.t0) / 1000, yawAtDrop: cur.yaw })
          if (!headOverEnd(cur)) physical('Her head lands on the couch: she is too far up for it to hang over the end.')
        }
      } else if (headOverEnd(cur)) {
        const ext = clamp(cur.ext + follow(r, dx, dy, 'ext', 5, 'nose'), 0, 40)
        upd({ ext, extAtDrop: ext })
      }
    }
    if (g.kind === 'roll') {
      // You stand on her left and pull her right side over toward you: down the screen, 160 px for the whole roll.
      // (Her shoulder itself barely moves on screen from here: it swings up and then straight at you.)
      const roll = clamp(cur.roll - dy / 160, -1, 0)
      upd({ roll })
      if (roll <= -0.85 && !cur.rolled) {
        upd({ rolled: true })
        feel('Rolled onto her left side, her head turned on with her so her nose points to the floor.')
      }
    }
    if (g.kind === 'sit') {
      const lie = clamp(cur.lie + follow(r, dx, dy, 'lie', -0.08, 'head'), 0, 1)
      const k = lie
      upd({ lie, roll: g.rollAtStart * k, yaw: cur.yaw * Math.min(1, k + 0.2), ext: cur.ext * k, flex: 20 * (1 - k) })
      if (lie <= 0.03 && !cur.satUp) {
        const s = (performance.now() - g.t0) / 1000
        upd({ lie: 0, roll: 0, yaw: 0, ext: 0, satUp: true, satFast: s < 1.5 })
        if (s < 1.5) physical('She comes up fast and grabs the couch: "Whoa, it’s spinning again!"')
        else feel('Slowly up, chin a little down. A moment of dizziness, then it settles.')
      }
    }
  }

  function up() {
    const g = grab.current
    grab.current = null
    if (!g) return
    const cur = runRef.current
    const stage = stageRef.current
    if (stage === 'Position') feel(headOverEnd(cur) ? 'Her shoulders are at the end of the couch: lying back, her head will hang over it.' : 'She is still too far up the couch.')
    if (stage === 'Turn' && !epley) feel(`Her head turned ${Math.round(Math.abs(cur.yaw))}° to the ${cur.yaw >= 0 ? 'right' : 'left'}.`)
    if (stage === 'Roll' && !cur.rolled) feel(`Rolled ${Math.round(-cur.roll * 90)}° toward you: keep pulling, right over onto her left side.`)
    if (stage === 'Turn' && epley && !cur.turned) feel(`Her head is ${Math.round(Math.abs(cur.yaw))}° to the ${cur.yaw >= 0 ? 'right' : 'left'}: keep turning it to her left, until it is 45° past the middle.`)
    if (stage === 'Lie back' && cur.dropS !== null) {
      if (cur.dropS > 2.5) why('Briskly: a slow lie-back may not provoke it.')
      else if (cur.ext < 15) feel('Flat, but her head is level with the couch: let it drop a little further over the end.')
      else feel(`Down in ${cur.dropS.toFixed(1)} s, her head ${Math.round(cur.ext)}° below the couch, supported in your hands.`)
    }
  }

  /* ---------------------------------------------------------------- flow */

  const next = () => {
    sfx.select()
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  const rows = epley ? epleyRows(run) : hallpikeRows(run)
  function finish() {
    if (done.current) return
    done.current = true
    const { marks, faults } = benchMarks(rows, (epley ? EPLEY_MARKS : HALLPIKE_MARKS) as readonly string[], job.grantMarks)
    onDone({ marks, faults, summary: epley ? (runRef.current.retested ? 'Epley done; retest negative.' : 'Epley incomplete.') : runRef.current.sawNystagmus ? 'Right Dix–Hallpike: torsional up-beating nystagmus after a short latency, fading.' : 'Right Dix–Hallpike: the nystagmus was not seen.' })
  }

  const stage = titles[index]
  const lede: Record<string, string> = {
    Explain: 'Tell her what you are about to do.',
    Position: 'Drag her down the couch until her shoulders reach the head end.',
    Turn: epley ? 'You are at her head, looking down at her face: her left is your left. Drag her head through 90° to her left, keeping it hanging back over the end.' : 'Hold her head with both hands and turn it 45° to her right.',
    'Lie back': 'Holding her head, lie her back briskly; keep going so her head drops about 20° below the couch.',
    Watch: 'Watch her eyes on the goggle screen, for at least 30 seconds.',
    Interpret: 'What did you see?',
    Hold: 'Positive right Hallpike. Hold her here for 30 seconds.',
    Roll: 'You are on her left. Take her right shoulder and pull her toward you (drag down) until she is on her left side. Her head turns with her until her nose points to the floor.',
    'Sit up': 'Bring her up to sitting: drag her head up, slowly.',
    Retest: 'Repeat the right Dix–Hallpike.',
  }
  const hold = (i: number) => (
    <span>
      ⏱ {Math.min(30, Math.round(run.holds[i]))}/30 S
    </span>
  )

  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="pos3d-bench">
      <div className="hare-bar">
        <span>MRS CHAU</span>
        <span />
        <span>
          {stage === 'Watch' ? `⏱ ${Math.round(run.watchedS)} S` : epley && stage === 'Hold' ? hold(0) : epley && stage === 'Turn' ? <>{`HEAD ${Math.round(Math.abs(run.yaw))}° ${run.yaw >= 0 ? 'R' : 'L'} · `}{hold(1)}</> : epley && stage === 'Roll' ? <>{`ROLL ${Math.round(-run.roll * 90)}° · `}{hold(2)}</> : run.lie > 0.95 ? `HEAD ${Math.round(Math.abs(run.yaw))}° ${run.yaw >= 0 ? 'R' : 'L'} · ${Math.round(run.ext)}° DOWN` : `HEAD ${Math.round(Math.abs(run.yaw))}° ${run.yaw >= 0 ? 'R' : 'L'}`}
        </span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      {checked ? (
        <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
          <CheckCard rows={rows} onContinue={finish} testId="pos3d-check" />
        </div>
      ) : (
        <>
          <div className="relative mx-3 min-h-[260px] flex-[1_1_55%] overflow-hidden rounded-md border-[3px] border-[#181820] bg-[#dfe5ea]" style={{ touchAction: 'none' }}>
            <div ref={host} className="absolute inset-0" data-testid="pos3d-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            {loading && <p className="absolute inset-0 grid place-items-center font-[Press_Start_2P,monospace] text-[8px] text-[#40404c]">Bringing Mrs Chau in…</p>}
            {(stage === 'Watch' || stage === 'Interpret' || (epley && stage === 'Retest')) && (
              <div className="pointer-events-none absolute left-[2%] top-[3%] h-[30%] w-[50%] rounded border-2 border-[#58f878]">
                <span className="absolute left-1 top-1 font-[Press_Start_2P,monospace] text-[6px] text-[#58f878]">VIDEO GOGGLES · REC</span>
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
            {says && <p className="pointer-events-none absolute bottom-2 left-2 right-2 rounded bg-white/90 p-2 text-[11px] leading-snug text-[#202028] shadow">{says}</p>}
          </div>
          <div className="min-h-0 flex-[1_1_45%] overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
            <p className="io-lede">{lede[stage]}</p>
            <div className="io-choices">
              {stage === 'Explain' && (
                <>
                  <button type="button" className="tap io-mini" data-on={run.explained || undefined} data-testid="pos3d-explain" onClick={() => (upd({ explained: true }), feel('"I’m going to lie you back quickly with your head turned. It may make you dizzy for a few seconds; I’ll hold you."'))}>
                    “IT MAY MAKE YOU DIZZY; I’LL HOLD YOU”
                  </button>
                  <button type="button" className="tap io-mini" data-on={run.eyesOpenAsked || undefined} data-testid="pos3d-eyes" onClick={() => (upd({ eyesOpenAsked: true }), feel('"Keep your eyes open and look at my nose the whole time, even if it spins."'))}>
                    “KEEP YOUR EYES OPEN ON MY NOSE”
                  </button>
                </>
              )}
              {stage === 'Watch' && !run.eyesOpenAsked && (
                <button type="button" className="tap io-mini" data-testid="pos3d-open" onClick={() => (upd({ eyesOpenAsked: true }), why('Ask before you start: by now you may have missed the first beats.'))}>
                  “OPEN YOUR EYES, LOOK AT ME”
                </button>
              )}
              {stage === 'Interpret' &&
                (['right-posterior', 'left-posterior', 'horizontal', 'central'] as Dx[]).map((d) => (
                  <button key={d} type="button" className="tap io-mini" data-on={run.dx === d || undefined} data-testid={`pos3d-dx-${d}`} onClick={() => (upd({ dx: d }), d === 'right-posterior' ? feel('Right posterior canal BPPV: treat with a right Epley.') : why('Torsional and up-beating toward the down ear, with latency and fatigue: posterior canal, on the side that is down.'))}>
                    {{ 'right-posterior': 'RIGHT POSTERIOR CANAL BPPV', 'left-posterior': 'LEFT POSTERIOR CANAL BPPV', horizontal: 'HORIZONTAL CANAL BPPV', central: 'A CENTRAL CAUSE' }[d]}
                  </button>
                ))}
              {stage === 'Retest' && (
                <button
                  type="button"
                  className="tap io-mini"
                  data-on={run.retested || undefined}
                  data-testid="pos3d-retest"
                  disabled={!run.satUp || sim.current.retestS >= 0}
                  onClick={() => {
                    sim.current.retestS = 0
                    buzz(20)
                    feel('Head 45° to the right, and back… watching her eyes.')
                  }}
                >
                  REPEAT THE RIGHT HALLPIKE
                </button>
              )}
            </div>
            <NextButton onClick={next} testId="pos3d-next">
              {titles[index + 1] ?? 'Finish'}
            </NextButton>
            <NoteLine note={api.note} />
          </div>
        </>
      )}
    </div>
  )
}

function viewFor(stage: string, epley: boolean): View {
  if (stage === 'Explain' || stage === 'Position' || stage === 'Sit up') return 'overview'
  if (epley) return stage === 'Roll' ? 'left' : stage === 'Turn' ? 'above' : 'side'
  return stage === 'Turn' ? 'front' : 'side'
}
