import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { Dial, HoldButton, SlidePad, TractionStrip, useSpin } from '../bench/controls'
import { StepGoals, useStepper } from '../bench/goals'
import { CheckCard, TouchPad, benchMarks, useRub } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { ABDO, AbdomenView, BABY_AREA, BIRTH_VIEW, BabyView, BirthView, CORDV, CordView, LossView, PlacentaView, TearView, Toco, VULVA, VulvaView, cordCm, headCentre, uterusShape } from './art'
import {
  BIRTH_MARKS,
  CLAMP_CM,
  CLAMP_S,
  CORD_CM,
  EBL,
  HEAD,
  MEMBRANE_TURNS,
  THIRD_MARKS,
  cct,
  checkBirth,
  checkThird,
  clampPlaced,
  clock,
  contraction,
  crown,
  eblMeasured,
  freshBirth,
  freshThird,
  onCord,
  separated,
  traction,
  type BirthRun,
  type CordTool,
  type Sign,
  type ThirdRun,
  type View,
} from './model'
import { BIRTH_TITLES, THIRD_TITLES, birthGoals, thirdGoals } from './steps'

/**
 * A normal delivery and the active third stage on the manikin, every action done by hand and drawn as it happens.
 * `pose: "third"` opens the third stage; otherwise the birth.
 */
export function DeliveryProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  return job.pose === 'third' ? <Third job={job} coach={coach} onDone={onDone} /> : <Birth job={job} coach={coach} onDone={onDone} />
}

/** Calls `cb(dt)` about 20 times a second while `on`. */
function useTicker(on: boolean, cb: (dt: number) => void) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!on) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      ref.current(Math.min(0.1, (now - last) / 1000))
      last = now
    }, 50)
    return () => window.clearInterval(id)
  }, [on])
}

/** Say each thing once: a message for an event is shown when the event changes, not on every tick. */
function useOnce() {
  const last = useRef('')
  return (key: string, fn: () => void) => {
    if (last.current === key) return
    last.current = key
    fn()
  }
}

/** The frame of a stepped bench: steps, goals, back and redo, the closing check. */
function Frame<R>({ prefix, titles, stepper, goals, bar, check, children, note }: { prefix: string; titles: string[]; stepper: ReturnType<typeof useStepper<R>>; goals: ReturnType<typeof birthGoals>; bar: ReactNode; check: ReactNode; children: ReactNode; note: ReturnType<typeof useBench<R>>['note'] }) {
  const { index, checked, epoch, review, setReview, next, back, redo, goalsRef } = stepper
  return (
    <>
      <div className="hare-bar">{bar}</div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      {checked ? (
        <>
          {check}
          <div className="io-choices mt-2">
            <button type="button" className="tap io-mini" data-testid={`${prefix}-back`} onClick={back}>
              ◀ BACK TO {titles[titles.length - 1].toUpperCase()}
            </button>
          </div>
        </>
      ) : (
        <div key={`${index}-${epoch}`} className="contents">
          {children}
          <NoteLine note={note} />
          <NextButton onClick={() => next()} testId={`${prefix}-next`}>
            {titles[index + 1] ?? 'Finish'}
          </NextButton>
          <div ref={goalsRef}>
            <StepGoals prefix={prefix} goals={goals} review={review} onRedo={redo} onFix={() => setReview(false)} onAnyway={() => next(true)} next={titles[index + 1] ?? 'the check'} />
          </div>
          <div className="io-choices mt-2">
            <button type="button" className="tap io-mini" data-testid={`${prefix}-back`} disabled={index === 0} onClick={back}>
              ◀ BACK A STEP
            </button>
            <button type="button" className="tap io-mini" data-testid={`${prefix}-redo`} onClick={redo}>
              ↺ REDO THIS STEP
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ================================================================ the birth */

type BS = BenchApi<BirthRun>

function Birth({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshBirth, coach)
  const body = useRef<HTMLDivElement>(null)
  const stepper = useStepper(api, BIRTH_TITLES, birthGoals, body)
  const done = useRef(false)
  const r = api.run
  useEffect(() => {
    if (!r.born) return
    const id = window.setInterval(() => api.upd((x) => ({ since: x.since + 1 })), 1000)
    return () => window.clearInterval(id)
  }, [r.born])
  function finish() {
    if (done.current) return
    done.current = true
    const run = api.runRef.current
    const { marks, faults } = benchMarks(checkBirth(run), BIRTH_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: run.born ? 'A girl, crying, skin to skin on her mother.' : 'Not delivered.', scene: run.born ? [job.scene || 'born'] : ['undelivered'] })
  }
  const status = r.born ? `BORN · ${clock(r.since)}` : r.headBorn ? 'HEAD BORN' : r.head >= HEAD.crowning ? 'CROWNING' : 'HEAD VISIBLE'
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col select-none" data-testid="birth-bench">
      <div ref={body} className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        <Frame
          prefix="birth"
          titles={BIRTH_TITLES}
          stepper={stepper}
          goals={birthGoals(stepper.index, r)}
          note={api.note}
          bar={
            <>
              <span>{status}</span>
              <span />
              <span>{r.born ? 'CORD INTACT' : 'LOA · 39 WEEKS'}</span>
            </>
          }
          check={<CheckCard rows={checkBirth(r)} onContinue={finish} testId="birth-check" />}
        >
          {stepper.index === 0 && <HandsStage {...api} />}
          {stepper.index === 1 && <CrowningStage {...api} />}
          {stepper.index === 2 && <CordStage {...api} />}
          {stepper.index === 3 && <RestitutionStage {...api} />}
          {stepper.index === 4 && <ShouldersStage {...api} />}
          {stepper.index === 5 && <BabyStage {...api} />}
        </Frame>
      </div>
    </div>
  )
}

const still = { holding: false, force: 0, feeling: false }

function HandsStage({ run, runRef, upd, feel }: BS) {
  const svg = useRef<SVGSVGElement>(null)
  return (
    <>
      <p className="io-lede">The head is at the introitus. Hands on before the next contraction: tap the perineum to guard it with a pad, then tap the head to put your palm on it.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 180"
        className="mx-auto max-w-[300px]"
        testId="birth-work"
        onDown={(p) => {
          const c = headCentre(runRef.current)
          if (p.y > BIRTH_VIEW.introitus.y + 20 && Math.abs(p.x - c.x) < 44) {
            upd({ guard: true })
            return feel('Your right hand cups the perineum through a pad: it will support it as it stretches.')
          }
          if (Math.hypot(p.x - c.x, p.y - c.y) < 30) {
            upd({ palm: true })
            feel('Your left palm over the occiput, fingers spread toward the face: ready to keep the head flexed.')
          }
        }}
      >
        <BirthView run={run} frame={still} svgRef={svg} />
      </TouchPad>
    </>
  )
}

function CrowningStage({ run, runRef, upd, feel, physical, why }: BS) {
  const svg = useRef<SVGSVGElement>(null)
  const [t, setT] = useState(0)
  const tRef = useRef(0)
  const holding = useRef(false)
  const [held, setHeld] = useState(false)
  const once = useOnce()
  useTicker(!run.headBorn, (dt) => {
    tRef.current += dt
    setT(tRef.current)
    const cur = runRef.current
    const { patch, event } = crown(cur, dt, contraction(tRef.current), holding.current)
    if (Object.keys(patch).length) upd(patch)
    if (event === 'none') return
    const atCrown = cur.head >= HEAD.crowning
    if (event === 'recede') once('recede', () => feel('Between contractions the head slips back a little: it is not crowning yet.'))
    else if (event === 'advance') once(atCrown ? 'slow' : 'push', () => feel(atCrown ? 'Slowly, under your palm, she panting: the head eases out a little more.' : 'She pushes with the contraction and the head advances.'))
    else if (event === 'crowning') once('crowning', () => feel('The head stays now, even between pushes: it is crowning.'))
    else if (event === 'fast')
      once('fast', () => {
        buzz(40)
        physical('The head is coming fast!')
        why(cur.pant === null ? 'Tell her to pant now: pushing at crowning drives the head out and tears the perineum.' : 'Keep your palm pressing: hold KEEP IT FLEXED through the contraction.')
      })
    else if (event === 'born')
      once('born', () => {
        const r = runRef.current
        if (r.tear === 'second') {
          buzz([60, 40, 60])
          physical('The head shoots out over the perineum, and it tears.')
        } else feel('Born by extension, slowly: brow, face and chin sweep over the perineum. The head is out, face down.')
      })
  })
  return (
    <>
      <p className="io-lede">She pushes with each contraction. When the head crowns, tell her to pant, and hold your palm on the head through every contraction so it comes slowly.</p>
      <Toco t={t} sub={run.pant !== null && run.head >= HEAD.crowning ? 'SHE PANTS' : undefined} />
      <TouchPad svg={svg} aspect="200 / 180" className="mx-auto mt-1 max-w-[300px]" testId="birth-work">
        <BirthView run={run} frame={{ ...still, holding: held }} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.pant !== null || undefined} data-testid="birth-pant" disabled={run.headBorn} onClick={() => runRef.current.pant === null && (upd({ pant: runRef.current.head }), feel('“Pant now, little breaths: don’t push.” She pants.'))}>
          “PANT, DON’T PUSH”
        </button>
        <HoldButton
          className="io-mini"
          testId="birth-flex"
          disabled={!run.palm || run.headBorn}
          onTick={() => undefined}
          onStart={() => ((holding.current = true), setHeld(true))}
          onEnd={() => ((holding.current = false), setHeld(false))}
        >
          {run.palm ? 'HOLD: KEEP IT FLEXED' : 'NO PALM ON THE HEAD'}
        </HoldButton>
      </div>
    </>
  )
}

function CordStage({ run, runRef, upd, feel }: BS) {
  const svg = useRef<SVGSVGElement>(null)
  const [feeling, setFeeling] = useState(false)
  return (
    <>
      <p className="io-lede">Run a finger round the neck for a cord. A loose loop: ease it over the head.</p>
      <TouchPad svg={svg} aspect="200 / 180" className="mx-auto max-w-[300px]" testId="birth-work">
        <BirthView run={run} frame={{ ...still, feeling }} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <HoldButton
          className="io-mini"
          testId="birth-feel"
          disabled={!run.headBorn || run.felt >= 1}
          onStart={() => setFeeling(true)}
          onEnd={() => setFeeling(false)}
          onTick={(dt) => {
            const cur = runRef.current
            if (cur.felt >= 1) return
            const felt = Math.min(1, cur.felt + dt / 1.6)
            upd({ felt })
            if (felt >= 1) feel('Your finger finds a loop of cord round the neck: loose, it slides.')
          }}
        >
          {run.felt >= 1 ? 'FELT: A LOOSE LOOP' : 'HOLD: FEEL ROUND THE NECK'}
        </HoldButton>
      </div>
      <SlidePad
        testId="birth-loop"
        label={run.loop >= 1 ? 'THE CORD IS FREE' : 'EASE THE LOOP OVER THE HEAD ▶'}
        cmPerWidth={1.4}
        disabled={run.felt < 1 || run.loop >= 1}
        onDelta={(d) => {
          const cur = runRef.current
          const loop = Math.max(0, Math.min(1, cur.loop + d))
          upd({ loop })
          if (loop >= 1) feel('Eased up over the occiput and off: the cord is free of the neck.')
        }}
      />
    </>
  )
}

function RestitutionStage({ run, runRef, upd, feel, why }: BS) {
  const svg = useRef<SVGSVGElement>(null)
  const once = useOnce()
  useEffect(() => feel('Hands off. Watch the head.'), [])
  useTicker(run.headBorn && run.restitution < 1, (dt) => {
    const restitution = Math.min(1, runRef.current.restitution + dt / 4)
    upd({ restitution })
    if (restitution >= 1) once('turned', () => feel('The head turns on its own to face her right thigh: the shoulders have rotated into the outlet.'))
  })
  return (
    <>
      <p className="io-lede">Hands off. The head turns back in line with the shoulders: restitution, then external rotation.</p>
      <TouchPad svg={svg} aspect="200 / 180" className="mx-auto max-w-[300px]" testId="birth-work" onDown={() => runRef.current.restitution < 1 && why('Not yet: let it turn on its own.')}>
        <BirthView run={run} frame={still} svgRef={svg} />
      </TouchPad>
      <p className="io-small mt-1" data-testid="birth-turn">
        {run.restitution >= 1 ? 'Turned 90°: facing her right thigh.' : `Turning: ${Math.round(run.restitution * 90)}°`}
      </p>
    </>
  )
}

function ShouldersStage({ run, runRef, upd, feel, physical, why }: BS) {
  const svg = useRef<SVGSVGElement>(null)
  const [t, setT] = useState(0)
  const tRef = useRef(0)
  const [force, setForce] = useState(0)
  const once = useOnce()
  useTicker(!run.born, (dt) => {
    tRef.current += dt
    setT(tRef.current)
  })
  return (
    <>
      <p className="io-lede">Tap the head to put a hand either side of it. With a contraction, hold the strip a little down (green) for the anterior shoulder, then up for the posterior.</p>
      <Toco t={t} />
      <div className="mt-1 flex items-stretch justify-center gap-2">
        <TouchPad
          svg={svg}
          aspect="200 / 180"
          className="max-w-[260px] flex-1"
          testId="birth-work"
          onDown={(p) => {
            const c = headCentre(runRef.current)
            if (Math.hypot(p.x - c.x, p.y - c.y) < 36 && !runRef.current.sides) {
              upd({ sides: true })
              feel('A hand over each parietal bone, either side of her head: never round the neck.')
            }
          }}
        >
          <BirthView run={run} frame={{ ...still, force }} svgRef={svg} />
        </TouchPad>
        <TractionStrip
          up
          testId="birth-traction"
          disabled={run.born}
          onEnd={() => setForce(0)}
          onTick={(dt, f) => {
            setForce(f)
            const { patch, event } = traction(runRef.current, dt, f, contraction(tRef.current))
            if (Object.keys(patch).length) upd(patch)
            if (event === 'none') return
            if (event === 'early') once('early', () => (physical('The head has not turned yet.'), why('Wait for restitution: it tells you the shoulders have rotated.')))
            else if (event === 'no-hands') once('no-hands', () => feel('Hands either side of her head first: tap the head.'))
            else if (event === 'between') once('between', () => feel('Between contractions nothing moves: wait for the next one.'))
            else if (event === 'hard')
              once('hard', () => {
                buzz([60, 40, 60])
                physical('Too hard: the neck stretches under your hands.')
                why('Gentle traction only, in the green: hard traction on the head stretches the brachial plexus.')
              })
            else if (event === 'anterior') once('anterior', () => feel('Gently down: the anterior shoulder slides out under the pubis.'))
            else if (event === 'anterior-out' || event === 'lift-now') once('lift', () => feel('The anterior shoulder is out. Now gently up, toward her tummy.'))
            else if (event === 'posterior-first') once('posterior-first', () => (physical('Nothing comes: the anterior shoulder is still behind the pubis.'), why('Down first for the anterior shoulder, then up for the posterior.')))
            else if (event === 'posterior') once('posterior', () => feel('Upward: the posterior shoulder sweeps over the perineum.'))
            else if (event === 'born')
              once('born', () => {
                buzz(80)
                sfx.select()
                feel('The body slides out into your hands. She takes a breath and cries.')
              })
          }}
        />
      </div>
    </>
  )
}

function BabyStage({ run, runRef, upd, feel, why }: BS) {
  const svg = useRef<SVGSVGElement>(null)
  const rub = useRub(BABY_AREA, 8)
  const dried = useRef(false)
  return (
    <>
      <p className="io-lede">Onto mum’s tummy, skin to skin. Note the time. Rub her dry, swap the wet towel for a dry one and a hat, and check her.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 170"
        className="mx-auto max-w-[300px]"
        testId="birth-dry"
        onDown={(p) => runRef.current.onMum && rub.rub(p)}
        onMove={(p) => {
          if (!runRef.current.onMum || runRef.current.dryTowel) return
          rub.rub(p)
          upd({ dried: Math.max(runRef.current.dried, rub.coverage) })
        }}
        onUp={() => {
          if (runRef.current.dried >= 0.7 && !dried.current) {
            dried.current = true
            feel('Rubbed dry with the warm towel: she cries hard and pinks up.')
          }
        }}
      >
        <BabyView run={run} rub={rub} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.onMum || undefined} data-testid="birth-onmum" disabled={!run.born} onClick={() => !runRef.current.onMum && (upd({ onMum: true }), feel('Straight up onto her mother’s tummy, skin to skin, a warm towel over her.'))}>
          LIFT HER ONTO MUM
        </button>
        <button type="button" className="tap io-mini" data-on={run.timeCalled || undefined} data-testid="birth-time" disabled={!run.born} onClick={() => !runRef.current.timeCalled && (upd({ timeCalled: true }), feel('“Time of birth, 10:42.” The midwife writes it down.'))}>
          CALL OUT THE TIME
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-on={run.dryTowel || undefined}
          data-testid="birth-towel"
          disabled={!run.onMum || (run.dried < 0.7 && !run.dryTowel)}
          onClick={() => !runRef.current.dryTowel && (upd({ dryTowel: true }), feel('The wet towel off; a dry warm one over her, and a hat on.'))}
        >
          {run.dried < 0.7 && !run.dryTowel ? 'DRY TOWEL, HAT (DRY HER FIRST)' : 'DRY TOWEL AND HAT'}
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-on={run.assessed || undefined}
          data-testid="birth-assess"
          disabled={!run.onMum}
          onClick={() => {
            if (runRef.current.assessed) return
            upd({ assessed: true })
            feel('Crying, pink centrally, flexed and moving; heart rate over 100 at the cord. Well.')
            if (runRef.current.dried < 0.7) why('Dry her too: a wet baby gets cold fast.')
          }}
        >
          CHECK HER
        </button>
      </div>
    </>
  )
}

/* ================================================================ the third stage */

type TS = BenchApi<ThirdRun>

function Third({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshThird, coach)
  const body = useRef<HTMLDivElement>(null)
  const stepper = useStepper(api, THIRD_TITLES, thirdGoals, body)
  const done = useRef(false)
  const r = api.run
  useEffect(() => {
    if (stepper.checked) return
    const id = window.setInterval(() => api.upd((x) => ({ since: x.since + 1 })), 1000)
    return () => window.clearInterval(id)
  }, [stepper.checked])
  function finish() {
    if (done.current) return
    done.current = true
    const run = api.runRef.current
    const { marks, faults } = benchMarks(checkThird(run), THIRD_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: run.out ? `Placenta delivered complete; uterus firm; EBL ${eblMeasured(run)} mL.` : 'Placenta not delivered.', scene: run.out ? [job.scene || 'placenta'] : ['retained'] })
  }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col select-none" data-testid="third-bench">
      <div ref={body} className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        <Frame
          prefix="third"
          titles={THIRD_TITLES}
          stepper={stepper}
          goals={thirdGoals(stepper.index, r)}
          note={api.note}
          bar={
            <>
              <span>THIRD STAGE · {clock(r.since)}</span>
              <span />
              <span>{r.oxyAt !== null ? 'OXYTOCIN IN' : 'NO OXYTOCIN'}</span>
            </>
          }
          check={<CheckCard rows={checkThird(r)} onContinue={finish} testId="third-check" />}
        >
          {stepper.index === 0 && <TwinStage {...api} />}
          {stepper.index === 1 && <ClampStage {...api} />}
          {stepper.index === 2 && <SeparationStage {...api} />}
          {stepper.index === 3 && <TractionStage {...api} />}
          {stepper.index === 4 && <PlacentaStage {...api} />}
          {stepper.index === 5 && <ToneStage {...api} />}
        </Frame>
      </div>
    </div>
  )
}

function TwinStage({ run, runRef, upd, feel, why }: TS) {
  const svg = useRef<SVGSVGElement>(null)
  const [palpating, setPalpating] = useState(false)
  const [inject, setInject] = useState(0)
  useTicker(inject > 0 && inject < 1, (dt) => setInject((v) => Math.min(1, v + dt)))
  useEffect(() => {
    if (inject >= 1) setInject(0)
  }, [inject])
  return (
    <>
      <p className="io-lede">Feel her abdomen for a second baby. Then oxytocin 10 IU IM: tap the dashed patch on her right thigh.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 170"
        className="mx-auto max-w-[300px]"
        testId="third-work"
        onDown={(p) => {
          const { thigh } = ABDO
          if (((p.x - thigh.cx) / thigh.rx) ** 2 + ((p.y - thigh.cy) / thigh.ry) ** 2 > 1.3) return
          const cur = runRef.current
          if (cur.oxyAt !== null) return feel('The oxytocin is in.')
          const first = cur.palpated < 1
          upd({ oxyAt: cur.since, oxyFirst: first })
          setInject(0.01)
          if (first) why('Feel for a second twin before the oxytocin: it would clamp the uterus down on a baby still inside.')
          feel('Oxytocin 10 IU into the anterolateral thigh: needle in at 90°, plunger down, out.')
        }}
      >
        <AbdomenView run={run} palpating={palpating} inject={inject} twin svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <HoldButton
          className="io-mini"
          testId="third-palpate"
          disabled={run.palpated >= 1}
          onStart={() => setPalpating(true)}
          onEnd={() => setPalpating(false)}
          onTick={(dt) => {
            const palpated = Math.min(1, runRef.current.palpated + dt / 2)
            upd({ palpated })
            if (palpated >= 1) feel('One uterus, its fundus at the umbilicus; no fetal parts, no second baby.')
          }}
        >
          {run.palpated >= 1 ? 'PALPATED: NO TWIN' : 'HOLD: PALPATE THE ABDOMEN'}
        </HoldButton>
      </div>
    </>
  )
}

const TOOLS: { id: CordTool; label: string }[] = [
  { id: 'clamp', label: 'CORD CLAMP' },
  { id: 'forceps', label: 'FORCEPS' },
  { id: 'scissors', label: 'SCISSORS' },
]

function ClampStage({ run, runRef, upd, feel, physical, why }: TS) {
  const svg = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<CordTool>('clamp')
  const [pulse, setPulse] = useState(0)
  useTicker(run.cutAt === null, (dt) => setPulse((p) => (p + dt) % 10))
  return (
    <>
      <p className="io-lede">
        Leave the cord for at least a minute after the birth ({clock(CLAMP_S.min)}). Then the cord clamp near her tummy, forceps beyond it, and cut between. Time since birth: <b data-testid="third-clock">{clock(run.since)}</b>
      </p>
      <TouchPad
        svg={svg}
        aspect={`${CORDV.w} / ${CORDV.h}`}
        className="mx-auto max-w-[340px]"
        testId="third-cordpad"
        onDown={(p) => {
          if (Math.abs(p.y - CORDV.y) > 16) return
          const cm = Math.max(0.5, Math.min(CORD_CM - 1, cordCm(p.x)))
          const cur = runRef.current
          const { patch, event } = onCord(cur, tool, cm)
          if (event === 'done') return feel('The cord is cut.')
          upd(patch)
          const next = runRef.current
          if (event === 'clamp' || event === 'forceps') {
            sfx.select()
            if (cur.clampedAt === null && next.since < CLAMP_S.min) why(`Only ${next.since} s since the birth: a well baby keeps her cord for at least a minute.`)
            if (cur.clampedAt === null && next.oxyAt === null) why('The oxytocin goes in before the cord is clamped.')
          }
          if (event === 'clamp') {
            feel(`Cord clamp on, ${cm.toFixed(0)} cm from her tummy: click.`)
            if (!clampPlaced(next)) why(`Put the cord clamp ${CLAMP_CM.min}–${CLAMP_CM.max} cm from her tummy.`)
            setTool('forceps')
          } else if (event === 'forceps') {
            feel(`Forceps on the cord ${cm.toFixed(0)} cm out, the mother’s side.`)
            if (next.clampAt !== null && cm <= next.clampAt + 2) why('The forceps go beyond the cord clamp, toward the mother, with room to cut between.')
            setTool('scissors')
          } else if (event === 'cut') feel('Cut between the clamp and the forceps. The forceps stay on the mother’s side for the traction.')
          else if (event === 'bleed') {
            buzz(60)
            physical('Blood wells from the cut: you cut outside the clamps.')
          } else if (event === 'no-clamps') {
            buzz(60)
            physical('Cut with nothing clamped: it bleeds from both ends.')
          }
        }}
      >
        <CordView run={run} pulse={pulse} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        {TOOLS.map((x) => (
          <button key={x.id} type="button" className="tap io-mini" data-on={tool === x.id || undefined} data-testid={`third-tool-${x.id}`} disabled={run.cutAt !== null} onClick={() => (setTool(x.id), sfx.select())}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-testid="third-wait30" disabled={run.clampedAt !== null} onClick={() => (upd((x) => ({ since: x.since + 30 })), feel('Thirty seconds: she is pink on mum, the cord still pulsing.'))}>
          LET 30 SECONDS PASS
        </button>
      </div>
    </>
  )
}

function SeparationStage({ run, runRef, upd, feel }: TS) {
  const svg = useRef<SVGSVGElement>(null)
  const sign = (s: Sign, text: string) => {
    const cur = runRef.current
    if (!separated(cur)) return feel('Nothing yet: no gush, the forceps have not moved, the uterus is broad and soft.')
    if (!cur.saw.includes(s)) upd({ saw: [...cur.saw, s] })
    sfx.select()
    feel(text)
  }
  return (
    <>
      <p className="io-lede">Hands off the cord. Wait, and tap each sign of separation as you see it: a gush, the cord lengthening, the uterus (inset) firm and risen.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 170"
        className="mx-auto max-w-[300px]"
        testId="third-work"
        onDown={(p) => {
          const { inset } = VULVA
          if (p.x >= inset.x && p.x <= inset.x + inset.w && p.y >= inset.y && p.y <= inset.y + inset.h) return sign('uterus', 'Through the abdomen: the uterus is firm, globular and has risen.')
          const fy = VULVA.forceps.y + (separated(runRef.current) ? 12 : 0)
          if (p.y >= fy - 6 && Math.abs(p.x - 100) < 10) return sign('lengthen', 'The forceps have moved down from the vulva: the cord is lengthening.')
          if (p.y > 104 && p.y < 142 && p.x < 97 && p.x > 80) return sign('gush', 'A small gush of blood from the introitus.')
        }}
      >
        <VulvaView run={run} force={0} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-testid="third-wait" onClick={() => {
          const next = upd((x) => ({ since: x.since + 60 }))
          feel(separated(next) ? 'A minute more. Something has changed: look.' : 'A minute passes: nothing yet.')
        }}>
          WAIT A MINUTE
        </button>
      </div>
      <p className="io-small mt-1">Seen: {run.saw.length ? run.saw.map((s) => ({ gush: 'gush', lengthen: 'cord lengthening', uterus: 'uterus firm and risen' })[s]).join(', ') : 'nothing yet'}</p>
    </>
  )
}

function TractionStage({ run, runRef, upd, feel, physical, why }: TS) {
  const svg = useRef<SVGSVGElement>(null)
  const [force, setForce] = useState(0)
  const spin = useSpin('cw')
  const once = useOnce()
  const base = useRef(run.turns)
  useEffect(() => {
    const cur = runRef.current
    if (cur.descent < 1 || cur.out) return
    const turns = base.current + spin.turns
    const out = turns >= MEMBRANE_TURNS
    upd({ turns, ...(out ? { out: true, outAt: cur.since } : {}) })
    if (out) once('out', () => (sfx.select(), feel('Turned round and round, the membranes come away whole as a rope behind it. The placenta is delivered.')))
  }, [spin.turns])
  return (
    <>
      <p className="io-lede">Tap above the pubis to guard the uterus. Then hold the strip down in the green: steady, gentle traction. At the introitus, twist the membranes out.</p>
      <div className="flex items-stretch justify-center gap-2">
        <TouchPad
          svg={svg}
          aspect="200 / 170"
          className="max-w-[260px] flex-1"
          testId="third-work"
          onDown={(p) => {
            const g = VULVA.guard
            if (((p.x - g.x) / g.rx) ** 2 + ((p.y - g.y) / (g.ry + 6)) ** 2 <= 1 && !runRef.current.guarded) {
              upd({ guarded: true })
              feel('The edge of your left hand above the pubis, pushing the uterus up and back: it cannot follow the cord down.')
            }
          }}
        >
          <VulvaView run={run} force={force} guardHint svgRef={svg} />
        </TouchPad>
        <TractionStrip
          testId="third-traction"
          disabled={run.descent >= 1 || run.snapped}
          labelDown="PULL"
          onEnd={() => setForce(0)}
          onTick={(dt, f) => {
            setForce(f)
            const { patch, event } = cct(runRef.current, dt, f)
            if (Object.keys(patch).length) upd(patch)
            if (event === 'none') return
            if (event === 'early') once('early', () => (physical('The cord tightens and nothing gives: it has not separated.'), why('Wait for the signs of separation before any traction.')))
            else if (event === 'invert')
              once('invert', () => {
                buzz([80, 40, 80])
                physical('The fundus dimples down as you pull: the uterus is starting to invert!')
                why('Never pull before separation, and always guard the uterus above the pubis.')
              })
            else if (event === 'snap')
              once('snap', () => {
                buzz([60, 40, 60])
                physical('Too hard: the cord snaps.')
                why('Steady, gentle traction in the green only.')
              })
            else if (event === 'unguarded') once('unguarded', () => (physical('It comes, but nothing is holding the uterus up.'), why('Guard the uterus above the pubis with your other hand all through the traction.')))
            else if (event === 'descend') once('descend', () => feel('Steady and gentle, down along the birth canal: the cord gives and the placenta comes down.'))
            else if (event === 'at-introitus') once('at', () => feel('The placenta is at the introitus. Lift it out in both hands and twist the membranes out.'))
          }}
        />
      </div>
      {run.descent >= 1 && !run.out && (
        <div className="mt-2 flex items-center justify-center gap-3" data-testid="third-twist">
          <Dial label="TWIST" spin={spin} />
          <p className="io-small">
            Circle the dial clockwise: {Math.min(MEMBRANE_TURNS, Math.floor(run.turns))}/{MEMBRANE_TURNS} turns
          </p>
        </div>
      )}
    </>
  )
}

const VIEWS: { id: View; label: string; text: string }[] = [
  { id: 'maternal', label: 'MATERNAL SURFACE', text: 'Maternal surface: the cotyledons all there, fitting together, no gap, no ragged area.' },
  { id: 'fetal', label: 'FETAL SURFACE, MEMBRANES', text: 'Held up by the cord: a shiny fetal surface, vessels running to the edge and stopping; the membranes whole, one hole.' },
  { id: 'cord', label: 'CUT END OF THE CORD', text: 'The cut end: two arteries and a vein.' },
]

function PlacentaStage({ run, runRef, upd, feel }: TS) {
  const [view, setView] = useState<View | null>(null)
  return (
    <>
      <p className="io-lede">In the dish: check the maternal surface, the fetal surface and membranes, and the cord vessels.</p>
      <div className="io-figure mx-auto aspect-[200/150] max-w-[320px]">
        <PlacentaView view={view} />
      </div>
      <div className="io-choices mt-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="tap io-mini"
            data-on={run.seen.includes(v.id) || undefined}
            data-testid={`third-view-${v.id}`}
            disabled={!run.out}
            onClick={() => {
              setView(v.id)
              const cur = runRef.current
              if (!cur.seen.includes(v.id)) upd({ seen: [...cur.seen, v.id] })
              feel(v.text)
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      {!run.out && <p className="io-small mt-1">The placenta is not out yet: back a step.</p>}
    </>
  )
}

function ToneStage({ run, runRef, upd, feel }: TS) {
  const svg = useRef<SVGSVGElement>(null)
  const u = uterusShape(run)
  const rub = useRub({ cx: 100, cy: u.cy, rx: u.rx + 4, ry: u.ry + 4 }, 6)
  const firmed = useRef(run.rubbed >= 0.6)
  const [hand, setHand] = useState<{ x: number; y: number } | null>(null)
  const rubAt = (p: { x: number; y: number }) => {
    rub.rub(p)
    setHand(p)
    upd({ rubbed: Math.max(runRef.current.rubbed, rub.coverage) })
  }
  return (
    <>
      <p className="io-lede">Rub up the fundus in circles. Then look for tears, and measure the blood loss: the jug and the pads.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 170"
        className="mx-auto max-w-[300px]"
        testId="third-fundus"
        onDown={rubAt}
        onMove={rubAt}
        onUp={() => {
          setHand(null)
          if (runRef.current.rubbed >= 0.6 && !firmed.current) {
            firmed.current = true
            feel('The fundus firms up under your hand, at the umbilicus: well contracted.')
          }
        }}
      >
        <AbdomenView run={run} palpating={false} inject={0} rubAt={hand} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.looked || undefined} data-testid="third-look" onClick={() => (upd({ looked: true }), feel('Good light, labia parted: a first-degree tear at the fourchette, skin only, not bleeding. Vagina intact.'))}>
          LIGHT AND LOOK
        </button>
        <button type="button" className="tap io-mini" data-on={run.jug || undefined} data-testid="third-jug" onClick={() => (upd({ jug: true }), feel(`The jug reads ${EBL.jug} mL.`))}>
          MEASURE THE JUG
        </button>
        <button type="button" className="tap io-mini" data-on={run.pads || undefined} data-testid="third-pads" onClick={() => (upd({ pads: true }), feel(`The pads weigh ${EBL.pads + 60} g, ${EBL.pads} g over their dry weight: ${EBL.pads} mL.`))}>
          WEIGH THE PADS
        </button>
      </div>
      {run.looked && (
        <div className="io-figure mx-auto mt-2 aspect-[200/90] max-w-[320px]">
          <TearView />
        </div>
      )}
      {(run.jug || run.pads) && (
        <div className="io-figure mx-auto mt-2 aspect-[200/80] max-w-[320px]">
          <LossView jug={run.jug} pads={run.pads} />
        </div>
      )}
      {run.jug && run.pads && (
        <p className="io-small mt-1" data-testid="third-ebl">
          Measured blood loss: {eblMeasured(run)} mL. Under 500 mL: no PPH.
        </p>
      )}
    </>
  )
}
