import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useBench, type BenchApi } from '../bench/core'
import { HoldButton, SlidePad } from '../bench/controls'
import { StepFrame, useOnce, useStepper, useTicker } from '../bench/goals'
import { CheckCard, TouchPad, benchMarks } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { LavageView, ReturnPot, VIEW, type LavageFrame } from './art'
import { ALIQUOT, END, FOOT, FUNNEL_MAX, HEIGHT, LAVAGE_MARKS, MEASURE, POUR, advance, checkLavage, clear, flow, freshLavage, inStomach, swallow, withdraw, type LavageRun } from './model'
import { LAVAGE_TITLES, lavageGoals } from './steps'

type S = BenchApi<LavageRun>

const L = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml)} mL`)

/**
 * Gastric lavage on the manikin, the Hong Kong protocol by hand: position, measure, pass, confirm, siphon and
 * sample, aliquots by gravity until 3 L and a clear return, charcoal, the tube out.
 */
export function LavageProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshLavage, coach)
  const body = useRef<HTMLDivElement>(null)
  const stepper = useStepper(api, LAVAGE_TITLES, lavageGoals, body)
  const done = useRef(false)
  const r = api.run
  function finish() {
    if (done.current) return
    done.current = true
    const run = api.runRef.current
    const { marks, faults } = benchMarks(checkLavage(run), LAVAGE_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: `${L(run.inTotal)} of lavage, the return ${clear(run) ? 'clear' : 'still cloudy'}; ${run.charcoal ? 'charcoal down the tube' : 'no charcoal'}.`, scene: [job.scene || 'lavaged'] })
  }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col select-none" data-testid="lavage-bench">
      <div ref={body} className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        <StepFrame
          prefix="lavage"
          titles={LAVAGE_TITLES}
          stepper={stepper}
          goals={lavageGoals(stepper.index, r)}
          note={api.note}
          bar={
            <>
              <span>{r.depth > 0 && r.out < r.depth ? `TUBE ${Math.round(r.depth - r.out)} CM` : 'NO TUBE'}</span>
              <span />
              <span>
                IN {L(r.inTotal)} · OUT {L(r.outTotal)}
              </span>
            </>
          }
          check={<CheckCard rows={checkLavage(r)} onContinue={finish} testId="lavage-check" />}
        >
          {stepper.index === 0 && <PositionStage {...api} />}
          {stepper.index === 1 && <MeasureStage {...api} />}
          {stepper.index === 2 && <PassStage {...api} />}
          {stepper.index === 3 && <ConfirmStage {...api} />}
          {stepper.index === 4 && <SiphonStage {...api} />}
          {stepper.index === 5 && <LavageStage {...api} />}
          {stepper.index === 6 && <FinishStage {...api} />}
        </StepFrame>
      </div>
    </div>
  )
}

function Picture({ run, frame }: { run: LavageRun; frame: LavageFrame }) {
  const svg = useRef<SVGSVGElement>(null)
  return (
    <TouchPad svg={svg} aspect={`${VIEW.w} / ${VIEW.h}`} className="mx-auto max-w-[360px]" testId="lavage-work">
      <LavageView run={run} frame={frame} svgRef={svg} />
    </TouchPad>
  )
}

function PositionStage({ run, runRef, upd, feel, why }: S) {
  return (
    <>
      <p className="io-lede">Roll her onto her left side, raise the foot of the trolley about 20 cm, and have the suction on at her mouth.</p>
      <Picture run={run} frame={{ end: 'none' }} />
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.lateral || undefined} data-testid="lavage-roll" onClick={() => !runRef.current.lateral && (upd({ lateral: true }), sfx.select(), feel('With the nurse, you roll her onto her left side, knees bent, facing you.'))}>
          ROLL HER ONTO HER LEFT SIDE
        </button>
        <button type="button" className="tap io-mini" data-on={run.suction || undefined} data-testid="lavage-suction" onClick={() => !runRef.current.suction && (upd({ suction: true }), feel('Suction on: the Yankauer by her mouth.'))}>
          SUCTION ON
        </button>
      </div>
      <SlidePad
        testId="lavage-foot"
        label={`FOOT OF THE TROLLEY: ${Math.round(run.foot)} CM ▶`}
        cmPerWidth={60}
        onDelta={(d) => {
          const foot = Math.max(0, Math.min(FOOT.top, runRef.current.foot + d))
          upd({ foot })
        }}
        onEnd={() => {
          const f = runRef.current.foot
          if (f > FOOT.max) why(`${Math.round(f)} cm is steeper than she will tolerate: about ${FOOT.target} cm.`)
          else if (f >= FOOT.min) feel(`Foot up ${Math.round(f)} cm: head down, so anything she brings up runs out of her mouth.`)
        }}
      />
    </>
  )
}

function MeasureStage({ run, runRef, upd, feel, why }: S) {
  return (
    <>
      <p className="io-lede">Lay the tube along her from the mouth to the epigastrium, and tape it at her lips: that mark tells you when it is in the stomach.</p>
      <Picture run={run} frame={{ end: 'none' }} />
      <SlidePad
        testId="lavage-lay"
        label={`LAY THE TUBE: ${Math.round(run.laid)} CM ▶`}
        cmPerWidth={70}
        disabled={!run.lateral}
        onDelta={(d) => upd({ laid: Math.max(0, Math.min(MEASURE.top, runRef.current.laid + d)), mark: null })}
      />
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.mark !== null || undefined}
          data-testid="lavage-tape"
          disabled={run.laid < 5}
          onClick={() => {
            const laid = runRef.current.laid
            upd({ mark: laid })
            sfx.select()
            if (Math.abs(laid - MEASURE.true) <= MEASURE.tol) feel(`Taped at ${Math.round(laid)} cm, level with her lips.`)
            else why(`${Math.round(laid)} cm does not reach the epigastrium: lay it again, tip on the dashed circle.`)
          }}
        >
          TAPE THE MARK
        </button>
      </div>
    </>
  )
}

function PassStage({ run, runRef, upd, feel, physical, why }: S) {
  const [spraying, setSpraying] = useState(false)
  const [lubing, setLubing] = useState(false)
  const once = useOnce()
  /** She gagged during this push: the tube stops until you lift your finger. A new push while she gags is forcing. */
  const stopped = useRef(false)
  return (
    <>
      <p className="io-lede">Spray her throat, mouth gag in, lubricate the tube, then pass it gently. When she gags, stop: ask her to swallow, and go on with the swallow, to the tape.</p>
      <Picture run={run} frame={{ end: 'none', spraying, lubing }} />
      <div className="io-choices mt-2">
        <HoldButton
          className="io-mini"
          testId="lavage-spray"
          onStart={() => setSpraying(true)}
          onEnd={() => setSpraying(false)}
          onTick={() => {
            if (runRef.current.sprayed) return
            upd({ sprayed: true })
            feel('Lignocaine spray to the back of her throat. “有少少苦，喉嚨會麻。”')
          }}
        >
          {run.sprayed ? 'THROAT SPRAYED' : 'HOLD: SPRAY THE THROAT'}
        </HoldButton>
        <button type="button" className="tap io-mini" data-on={run.gagIn || undefined} data-testid="lavage-gag" onClick={() => !runRef.current.gagIn && (upd({ gagIn: true }), feel('Mouth gag between her teeth: she cannot bite the tube.'))}>
          MOUTH GAG IN
        </button>
        <HoldButton
          className="io-mini"
          testId="lavage-lube"
          onStart={() => setLubing(true)}
          onEnd={() => setLubing(false)}
          onTick={(dt) => {
            const lubed = Math.min(1, runRef.current.lubed + dt)
            upd({ lubed })
            if (lubed >= 1) once('lubed', () => feel('The end of the tube glistens with lubricant.'))
          }}
        >
          {run.lubed >= 1 ? 'LUBRICATED' : 'HOLD: LUBRICATE'}
        </HoldButton>
        <button
          type="button"
          className="tap io-mini"
          data-testid="lavage-swallow"
          onClick={() => {
            upd(swallow())
            feel(runRef.current.depth > 0 ? '“吞，吞。” She swallows; the gag eases.' : '“吞啖口水。” She swallows.')
          }}
        >
          “SWALLOW”
        </button>
      </div>
      <SlidePad
        testId="lavage-advance"
        label={`ADVANCE THE TUBE: ${Math.round(run.depth)} CM${run.mark !== null ? ` · TAPE ${Math.round(run.mark)}` : ''} ▶`}
        cmPerWidth={30}
        disabled={!run.lateral}
        onEnd={() => (stopped.current = false)}
        onDelta={(d) => {
          if (stopped.current) return
          const cur = runRef.current
          if (d > 0 && cur.lubed < 1) once('dry', () => why('Lubricate the tube first: a dry tube drags on the pharynx.'))
          const { patch, event } = advance(cur, d)
          upd(patch)
          if (event === 'no-gag') return once('no-gag', () => why('Mouth gag in first.'))
          if (event === 'gag') {
            stopped.current = true
            physical('She gags as the tube reaches the back of her throat. Stop.')
          }
          else if (event === 'forced') {
            stopped.current = true
            once('forced', () => {
              buzz([60, 40, 60])
              physical('You pushed while she gagged: she retches hard round the tube.')
              why('Stop at the gag. Ask her to swallow, and advance with the swallow.')
            })
          }
          else if (event === 'past-gag') once('past', () => feel('With the swallow, the tube slips into the oesophagus.'))
          else if (event === 'at-mark') once('mark', () => feel('The tape is at her lips: the tip should be in the stomach.'))
          else if (event === 'past-mark') once('past-mark', () => why('Past the tape: it coils in the stomach. Back to the tape.'))
        }}
      />
    </>
  )
}

function ConfirmStage({ run, runRef, upd, feel, physical, why }: S) {
  const [aspirating, setAspirating] = useState(false)
  const [listening, setListening] = useState(false)
  const check = (kind: 'aspirate' | 'air') => {
    const cur = runRef.current
    if (!inStomach(cur)) {
      upd({ missed: true })
      physical(kind === 'aspirate' ? 'Nothing comes back into the syringe.' : 'You hear nothing at the epigastrium.')
      why('The tip is not in the stomach: check the measurement and advance to the tape.')
      return
    }
    if (kind === 'aspirate') {
      upd({ aspirated: true })
      feel('Cloudy fluid with white flecks of tablet: gastric contents. It is in the stomach.')
    } else {
      upd({ whoosh: true })
      feel('50 mL of air in: a loud whoosh over the epigastrium.')
    }
  }
  return (
    <>
      <p className="io-lede">Before any fluid: prove the tube is in the stomach. Aspirate with the 50 mL syringe, or put air in while you listen over the epigastrium.</p>
      <Picture run={run} frame={{ end: 'syringe', aspirating, listening }} />
      <div className="io-choices mt-2">
        <HoldButton className="io-mini" testId="lavage-aspirate" onStart={() => setAspirating(true)} onEnd={() => (setAspirating(false), check('aspirate'))} onTick={() => undefined}>
          {run.aspirated ? 'ASPIRATED: GASTRIC' : 'HOLD: ASPIRATE'}
        </HoldButton>
        <HoldButton className="io-mini" testId="lavage-air" onStart={() => setListening(true)} onEnd={() => (setListening(false), check('air'))} onTick={() => undefined}>
          {run.whoosh ? 'HEARD: WHOOSH' : 'HOLD: AIR IN, LISTEN'}
        </HoldButton>
      </div>
    </>
  )
}

/** Where you hold the funnel: drag it up or down; it stays where you leave it. */
function FunnelStrip({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  const H = 150
  const set = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onChange(Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)))
  }
  const y = (h: number) => (1 - h) * H
  return (
    <div
      className="io-figure"
      style={{ touchAction: 'none', width: 56, aspectRatio: `40 / ${H}` }}
      data-testid="lavage-funnel"
      data-height={value.toFixed(2)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        set(e)
      }}
      onPointerMove={(e) => e.buttons && set(e)}
    >
      <svg viewBox={`0 0 40 ${H}`} className="block h-full w-full select-none">
        <rect width="40" height={H} fill="#eef2f4" />
        <rect y="0" width="40" height={y(HEIGHT.up)} fill="#c8eac0" />
        <rect y={y(HEIGHT.down)} width="40" height={H - y(HEIGHT.down)} fill="#c8daf0" />
        <text x="20" y="10" textAnchor="middle" fontFamily="Press Start 2P, monospace" fontSize="4.4" fill="#2a6a30">
          UP: IN
        </text>
        <text x="20" y={H - 4} textAnchor="middle" fontFamily="Press Start 2P, monospace" fontSize="4.4" fill="#204a80">
          DOWN: OUT
        </text>
        <g transform={`translate(20 ${y(value)})`}>
          <path d="M-12 -6 L12 -6 L3 6 L-3 6 Z" fill="#f8fbfd" stroke="#203848" />
        </g>
        <text x="20" y={H / 2 + 2} textAnchor="middle" fontFamily="Press Start 2P, monospace" fontSize="3.6" fill="#506070">
          FUNNEL
        </text>
      </svg>
    </div>
  )
}

/** The funnel and the tube, running in or draining, on a tick. */
function useFlow(api: S, on: boolean) {
  const { runRef, upd, feel, physical, why } = api
  const once = useOnce()
  useTicker(on, (dt) => {
    const { patch, event } = flow(runRef.current, dt, runRef.current.height)
    if (Object.keys(patch).length) upd(patch)
    if (event === 'not-in') once('not-in', () => (buzz([80, 40, 80]), physical('She coughs and splutters: the fluid is going up, not into the stomach!'), why('The tube is not in the stomach. Never run fluid in before the tube is confirmed.')))
    else if (event === 'vomit') once('vomit', () => (buzz([80, 40, 80]), physical('Too much in: she vomits round the tube. Suction!'), why(`Aliquots of about ${ALIQUOT.ml} mL, drained back each time.`)))
    else if (event === 'overfill') once('overfill', () => why(`Over ${ALIQUOT.max} mL in one go: that pushes tablets through the pylorus. About ${ALIQUOT.ml} mL each time.`))
    else if (event === 'unsiphoned') once('unsiphoned', () => why('Siphon her stomach first: fluid on top of a full stomach overfills it.'))
    else if (event === 'spill') once('spill', () => feel('Held low over the bucket, the funnel just empties into it: raise it to run fluid in.'))
    else if (event === 'clear') once('clear', () => feel('The return is clear now: no more flecks of tablet. Carry on to 3 L.'))
    else if (event === 'end') once('end', () => (sfx.select(), feel('3 L in, the return clear, all of it back out.')))
  })
}

function SiphonStage(api: S) {
  const { run, runRef, upd, feel, why } = api
  useFlow(api, true)
  return (
    <>
      <p className="io-lede">Siphon off what is in her stomach first: move the funnel down below her, over the bucket. Save a specimen of that first return.</p>
      <div className="flex items-stretch justify-center gap-2">
        <div className="max-w-[300px] flex-1">
          <Picture run={run} frame={{ end: 'funnel' }} />
        </div>
        <FunnelStrip value={run.height} onChange={(height) => upd({ height })} />
      </div>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.sample !== 'none' || undefined}
          data-testid="lavage-sample"
          disabled={run.outTotal < 20}
          onClick={() => {
            const cur = runRef.current
            if (cur.sample !== 'none') return
            const sample = cur.inTotal > 0 ? 'diluted' : 'neat'
            upd({ sample })
            if (sample === 'neat') feel('A pot of the first return, labelled, for toxicology.')
            else why('That return is diluted by lavage fluid: the specimen comes from the first return, before any goes in.')
          }}
        >
          SAVE A SPECIMEN
        </button>
      </div>
      {run.sample !== 'none' && (
        <div className="io-figure mx-auto mt-2 aspect-[60/40] max-w-[160px]">
          <ReturnPot cloud={run.sample === 'neat' ? 0.9 : 0.3} label="TOX" />
        </div>
      )}
      <p className="io-small mt-1" data-testid="lavage-stomach">
        Stomach: {Math.round(run.stomach)} mL{run.siphoned ? ' · siphoned' : ''}
      </p>
    </>
  )
}

function LavageStage(api: S) {
  const { run, runRef, upd } = api
  const [pouring, setPouring] = useState(false)
  useFlow(api, true)
  return (
    <>
      <p className="io-lede">Pour about 200 mL into the funnel, raise it about 2 feet above her to run it in, then lower it over the bucket to drain it all back. Again and again until 3 L are used and the return is clear.</p>
      <div className="flex items-stretch justify-center gap-2">
        <div className="max-w-[300px] flex-1">
          <Picture run={run} frame={{ end: 'funnel', pouring }} />
        </div>
        <FunnelStrip value={run.height} onChange={(height) => upd({ height })} />
      </div>
      <div className="io-choices mt-2">
        <HoldButton
          className="io-mini"
          testId="lavage-pour"
          onStart={() => setPouring(true)}
          onEnd={() => setPouring(false)}
          onTick={(dt) => {
            const cur = runRef.current
            const add = Math.min(POUR * dt, FUNNEL_MAX - cur.funnel)
            if (add > 0) upd({ funnel: cur.funnel + add, poured: cur.poured + add })
          }}
        >
          HOLD: POUR FROM THE JUG
        </HoldButton>
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <div className="io-figure aspect-[60/40] w-[120px]">
          <ReturnPot cloud={run.returnCloud} label={clear(run) ? 'CLEAR' : 'CLOUDY'} />
        </div>
        <p className="io-small" data-testid="lavage-tally">
          Funnel {Math.round(run.funnel)} mL · in {L(run.inTotal)} of {L(END.total)} · stomach {Math.round(run.stomach)} mL · return {clear(run) ? 'clear' : 'cloudy'}
        </p>
      </div>
    </>
  )
}

function FinishStage({ run, runRef, upd, feel, physical, why }: S) {
  const once = useOnce()
  const tubeIn = run.out < run.depth
  return (
    <>
      <p className="io-lede">Activated charcoal down the tube while it is in. Then pinch the tube and withdraw it in one smooth pull. Gag out, suction her mouth.</p>
      <Picture run={run} frame={{ end: run.charcoal ? 'none' : 'funnel' }} />
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.charcoal || undefined}
          data-testid="lavage-charcoal"
          disabled={!tubeIn || !inStomach(run)}
          onClick={() => {
            if (runRef.current.charcoal) return
            upd({ charcoal: true })
            feel('Activated charcoal 50 g as a slurry, down the funnel and the tube.')
          }}
        >
          CHARCOAL 50 G DOWN THE TUBE
        </button>
        <button type="button" className="tap io-mini" data-on={run.pinched || undefined} data-testid="lavage-pinch" disabled={!tubeIn} onClick={() => !runRef.current.pinched && (upd({ pinched: true }), feel('Tube pinched shut between your fingers near her lips.'))}>
          PINCH THE TUBE
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-on={run.gagOut || undefined}
          data-testid="lavage-gagout"
          disabled={tubeIn}
          onClick={() => !runRef.current.gagOut && (upd({ gagOut: true }), feel('Gag out; a quick suction of her mouth. She stays on her left side. “做完喇，你做得好好。”'))}
        >
          GAG OUT, SUCTION
        </button>
      </div>
      <SlidePad
        testId="lavage-withdraw"
        label={tubeIn ? `◀ WITHDRAW: ${Math.round(run.depth - run.out)} CM IN` : 'TUBE OUT'}
        cmPerWidth={70}
        disabled={!tubeIn}
        onDelta={(d) => {
          if (d >= 0) return
          const cur = runRef.current
          if (!cur.charcoal) once('charcoal', () => why('Charcoal first, while the tube is still in.'))
          const { patch, event } = withdraw(cur, -d)
          upd(patch)
          if (event === 'dribble') once('dribble', () => (physical('Fluid runs out of the open tube into her pharynx: she coughs.'), why('Pinch the tube before you withdraw it.')))
          else if (event === 'out') once('out', () => feel('Out in one smooth pull.'))
        }}
      />
    </>
  )
}
