import { useEffect, useMemo, useRef, useState } from 'react'
import { Choices, NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { DragGhost, SayIt, Tool, useToolDrag, type SayOption } from '../bench/controls'
import { Monitor, type Rhythm, type Vitals } from '../bench/Monitor'
import type { BenchResult } from '../store'
import { buzz, sfx } from '../sfx'
import { ChestBack, ChestFront, LEAD_COLOUR, Pad, Targets } from './art'
import {
  backPadSite,
  captureThreshold,
  captured,
  freshPaceRun,
  frontPadSite,
  leadSite,
  paceCaseFor,
  padPairing,
  scorePacing,
  type BackSite,
  type FrontSite,
  type Lead,
  type PaceCase,
  type PaceRun,
} from './model'

const TITLES = ['Prepare the chest', 'Pads', 'Pace', 'Check capture', 'Comfort and handover']

type Stage = BenchApi<PaceRun> & {
  c: PaceCase
  next: () => void
  padPos: PadPos
  setPadPos: (p: PadPos) => void
}

type PadPos = { front: { site: FrontSite; x: number; y: number }[]; back: { site: BackSite; x: number; y: number } | null }

/** Transcutaneous pacing for unstable complete heart block, on a working defibrillator. */
export function PacingProcedure({ seed, coach, onDone }: { seed: number; coach: boolean; onDone: (r: BenchResult) => void }) {
  const c = useMemo(() => paceCaseFor(seed), [seed])
  const api = useBench(freshPaceRun, coach)
  const [index, setIndex] = useState(0)
  const [padPos, setPadPos] = useState<PadPos>({ front: [], back: null })
  const [bp, setBp] = useState<[number, number]>([72, 40])
  const bpRef = useRef(bp)

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = api.runRef.current
      const cap = captured(r, c)
      const [s, d] = bpRef.current
      const next: [number, number] = cap ? [Math.min(108, s + 1.2), Math.min(66, d + 0.8)] : [Math.max(62, s - 0.15), Math.max(34, d - 0.08)]
      bpRef.current = next
      setBp(next)
    }, 500)
    return () => window.clearInterval(id)
  }, [c])

  function next() {
    sfx.select()
    if (index < TITLES.length - 1) {
      setIndex(index + 1)
      return
    }
    const run = api.runRef.current
    const cap = captured(run, c)
    onDone({ ...scorePacing(run, c), scene: cap ? (run.femoralWithCapture ? 'pulse' : 'paced') : 'pads' })
  }

  const stage: Stage = { ...api, c, next, padPos, setPadPos }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="pacing-bench">
      <div className="px-3 pt-1">
        <Monitor vitals={vitalsOf(api.run, c, bp)} />
      </div>
      <StepStrip titles={TITLES} index={index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {index === 0 && <Prepare {...stage} />}
        {index === 1 && <Pads {...stage} />}
        {index === 2 && <Pace {...stage} />}
        {index === 3 && <Capture {...stage} />}
        {index === 4 && <Comfort {...stage} />}
        <NoteLine note={api.note} />
      </div>
    </div>
  )
}

function vitalsOf(run: PaceRun, c: PaceCase, bp: [number, number]): Vitals {
  const k = c.hyperK && !run.calcium
  const pacingNow = run.mode === 'pacer' && run.pacing
  let rhythm: Rhythm = k ? 'hyperk' : 'chb'
  if (pacingNow) rhythm = captured(run, c) ? 'paced' : k ? 'hyperk-spikes' : 'spikes'
  return { rhythm, hr: 32, paceRate: run.rate, spo2: 94, bp, etco2: 'off' }
}

function useChestDrop() {
  const box = useRef<HTMLDivElement>(null)
  function toChest(at: { x: number; y: number }) {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: ((at.x - rect.left) / rect.width) * 200, y: ((at.y - rect.top) / rect.height) * 240 }
  }
  return { box, toChest }
}

/* ================================================================ 1. prepare */

const LEAD_NAME: Record<Lead, string> = { ra: 'RA · white', la: 'LA · black', ll: 'LL · red' }

function Prepare({ c, run, upd, feel, why, coach, next }: Stage) {
  const { box, toChest } = useChestDrop()
  const [leadPos, setLeadPos] = useState<Partial<Record<Lead, { x: number; y: number }>>>({})
  const [guide, setGuide] = useState(false)
  const { drag, begin } = useToolDrag((tool, target, at) => {
    if (target !== 'chest') return
    const p = toChest(at)
    if (!p) return
    const lead = tool as Lead
    setLeadPos((cur) => ({ ...cur, [lead]: p }))
    const ok = leadSite(lead, p)
    upd((r) => ({ leads: { ...r.leads, [lead]: ok || r.leads[lead] }, leadsWrong: r.leadsWrong || !ok }))
    sfx.select()
    if (ok) feel(`${LEAD_NAME[lead]} electrode on.`)
    else why('Limb-lead electrodes: RA right infraclavicular, LA left infraclavicular, LL left lower chest or abdomen. Keep them off the pad sites.')
  })
  return (
    <>
      <p className="io-lede">Get the chest ready and put the defibrillator’s own ECG leads on. Demand pacing senses through them.</p>
      <div ref={box} className="io-figure relative aspect-[5/6]" data-drop="chest">
        <ChestFront sweaty={c.sweaty} hairy={c.hairy} dried={run.dried} clipped={run.clipped} leads={leadPos} pads={[]}>
          {coach && guide && (
            <g fill="none" stroke="#2f7a3e" strokeDasharray="3 3">
              <circle cx="58" cy="48" r="16" />
              <circle cx="142" cy="48" r="16" />
              <circle cx="142" cy="214" r="18" />
            </g>
          )}
        </ChestFront>
      </div>
      <div className="io-tray io-tray-row">
        {(['ra', 'la', 'll'] as Lead[]).map((lead) => (
          <Tool key={lead} id={lead} caption={LEAD_NAME[lead]} onBegin={begin} state={run.leads[lead] ? 'on' : undefined}>
            <svg viewBox="0 0 20 20" width="26" height="26">
              <circle cx="10" cy="10" r="8" fill="#f8f8f8" stroke="#181820" />
              <circle cx="10" cy="10" r="3" fill={LEAD_COLOUR[lead]} stroke="#181820" strokeWidth="0.5" />
            </svg>
          </Tool>
        ))}
      </div>
      <Choices
        options={[
          {
            label: 'DRY THE SKIN',
            testId: 'dry',
            on: run.dried,
            onClick: () => {
              upd({ dried: true })
              feel(c.sweaty ? 'Towel over the chest. The sweat comes off.' : 'The skin is already dry.')
            },
          },
          {
            label: 'CLIP THE HAIR',
            testId: 'clip',
            on: run.clipped,
            onClick: () => {
              upd({ clipped: true })
              feel(c.hairy ? 'Clippers over the pad sites. Skin clear.' : 'Not much hair to clip.')
            },
          },
          ...(coach ? [{ label: guide ? 'GUIDE ON' : 'GUIDE OFF', onClick: () => setGuide((v) => !v) }] : []),
        ]}
      />
      <NextButton onClick={next}>Pads</NextButton>
      <DragGhost at={drag}>
        <svg viewBox="0 0 20 20" width="30" height="30">
          <circle cx="10" cy="10" r="8" fill="#f8f8f8" stroke="#181820" />
        </svg>
      </DragGhost>
    </>
  )
}

/* ================================================================ 2. pads */

function Pads({ c, run, upd, feel, why, coach, next, padPos, setPadPos }: Stage) {
  const { box, toChest } = useChestDrop()
  const [view, setView] = useState<'front' | 'back'>('front')
  const [guide, setGuide] = useState(false)
  const { drag, begin } = useToolDrag((_tool, target, at) => {
    if (target !== 'chest') return
    const p = toChest(at)
    if (!p) return
    sfx.select()
    buzz(15)
    if (view === 'front') {
      const site = frontPadSite(p)
      setPadPos({ ...padPos, front: [...padPos.front, { site, x: p.x, y: p.y }] })
      upd((r) => ({ padsFront: [...r.padsFront, site] }))
      if (site === 'apPad') feel('Pad on the left lower sternal edge, over the heart.')
      else if (site === 'alSternal') feel('Pad under the right clavicle.')
      else if (site === 'alApex') feel('Pad in the left mid-axilla, at the apex.')
      else why('Front pad: left lower sternal edge for anterior–posterior, or right infraclavicular plus left mid-axilla for anterior–lateral.')
    } else {
      const site = backPadSite(p)
      setPadPos({ ...padPos, back: { site, x: p.x, y: p.y } })
      upd({ padBack: site })
      if (site === 'leftScapula') feel('Back pad left of the spine, under the left scapula.')
      else why('The back pad goes left of the spine, below the left scapula, so the current runs through the heart.')
    }
  })
  return (
    <>
      <p className="io-lede">{view === 'front' ? 'The front of the chest. Drag a pad on.' : 'Rolled onto his right. His back.'}</p>
      <div ref={box} className="io-figure relative aspect-[5/6]" data-drop="chest">
        {view === 'front' ? (
          <ChestFront sweaty={c.sweaty} hairy={c.hairy} dried={run.dried} clipped={run.clipped} leads={{}} pads={padPos.front}>
            {coach && guide && <Targets view="front" />}
          </ChestFront>
        ) : (
          <ChestBack pad={padPos.back}>{coach && guide && <Targets view="back" />}</ChestBack>
        )}
      </div>
      <div className="io-tray io-tray-row">
        <Tool id="pad" caption="Pacing pad" onBegin={begin}>
          <svg viewBox="-20 -42 40 66" width="30" height="46">
            <Pad x={0} y={0} />
          </svg>
        </Tool>
      </div>
      <Choices
        options={[
          { label: view === 'front' ? 'ROLL HIM · SHOW THE BACK' : 'LAY HIM BACK · SHOW THE FRONT', testId: 'roll', onClick: () => setView(view === 'front' ? 'back' : 'front') },
          {
            label: 'PEEL THE PADS OFF',
            onClick: () => {
              setPadPos({ front: [], back: null })
              upd({ padsFront: [], padBack: null })
              feel('Pads off. Start again.')
            },
          },
          ...(coach ? [{ label: guide ? 'GUIDE ON' : 'GUIDE OFF', onClick: () => setGuide((v) => !v) }] : []),
        ]}
      />
      {padPairing(run) !== 'none' && <p className="io-small">Pads connected to the defibrillator cable: {padPairing(run) === 'ap' ? 'anterior–posterior' : 'anterior–lateral'}.</p>}
      <NextButton onClick={next}>Set the pacer</NextButton>
      <DragGhost at={drag}>
        <svg viewBox="-20 -42 40 66" width="40" height="66">
          <Pad x={0} y={0} />
        </svg>
      </DragGhost>
    </>
  )
}

/* ================================================================ 3. pace */

function Defib({ c, run, runRef, upd, feel, why, physical }: Stage) {
  const [charged, setCharged] = useState(false)
  const settle = useRef<{ from: number; t: number } | null>(null)

  function setOutput(v: number) {
    const value = Math.max(0, Math.min(200, v))
    const before = run.output
    if (!settle.current) settle.current = { from: before, t: 0 }
    window.clearTimeout(settle.current.t)
    const from = settle.current.from
    settle.current.t = window.setTimeout(() => {
      const r = runRef.current
      if (r.pacing && !captured({ ...r, output: from }, c)) {
        const step = Math.abs(r.output - from)
        if (step > r.biggestStep) upd({ biggestStep: step })
      }
      settle.current = null
    }, 600)
    upd({ output: value })
    const r = { ...run, output: value }
    if (r.pacing && value >= 50 && before < 50 && !r.analgesia) physical('He groans with every beat and grabs at the pads.')
    if (r.pacing && captured(r, c) && !captured({ ...run }, c)) buzz(20)
  }

  return (
    <div className="defib" data-testid="defib">
      <div className="defib-modes">
        {(['off', 'monitor', 'pacer', 'defib'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className="defib-key"
            data-on={run.mode === m || undefined}
            data-testid={`mode-${m}`}
            onClick={() => {
              upd({ mode: m, pacing: m === 'pacer' ? run.pacing : false })
              setCharged(false)
              sfx.cursor()
            }}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {run.mode === 'pacer' && (
        <div className="defib-panel">
          <div className="defib-row">
            <span className="defib-label">RATE</span>
            <button type="button" className="defib-key" onClick={() => upd({ rate: Math.max(30, run.rate - 10) })}>
              −
            </button>
            <b data-testid="rate">{run.rate} ppm</b>
            <button type="button" className="defib-key" onClick={() => upd({ rate: Math.min(180, run.rate + 10) })}>
              +
            </button>
          </div>
          <div className="defib-row">
            <span className="defib-label">OUTPUT</span>
            <button type="button" className="defib-key" data-testid="out-down" onClick={() => setOutput(run.output - 10)}>
              −10
            </button>
            <b data-testid="output-ma">{run.output} mA</b>
            <button type="button" className="defib-key" data-testid="out-up" onClick={() => setOutput(run.output + 10)}>
              +10
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={run.output}
            className="io-range defib-dial"
            data-testid="output"
            aria-label="Output dial"
            onChange={(event) => setOutput(Number(event.target.value))}
          />
          <div className="defib-row">
            <span className="defib-label">MODE</span>
            <button type="button" className="defib-key flex-1" data-testid="demand" onClick={() => upd({ demand: !run.demand })}>
              {run.demand ? 'DEMAND' : 'FIXED'}
            </button>
          </div>
        </div>
      )}
      {run.mode === 'pacer' && (
        <button
          type="button"
          className="tap mt-2"
          data-testid="start-pacing"
          onClick={() => {
            const on = !run.pacing
            upd({ pacing: on, stoppedPacing: run.stoppedPacing || (!on && run.captureCalled) })
            feel(on ? 'Pacing. A spike marks every paced beat on the screen.' : 'Pacing stopped.')
            if (!on && run.captureCalled) why('Stopping the pacer drops the rate straight back to 32.')
          }}
        >
          {run.pacing ? 'STOP PACING' : 'START PACING'}
        </button>
      )}
      {run.mode === 'defib' && (
        <div className="defib-row">
          <b>150 J</b>
          <button type="button" className="defib-key" data-testid="charge" onClick={() => setCharged(true)}>
            CHARGE
          </button>
          <button
            type="button"
            className="defib-key defib-shock"
            data-testid="shock"
            disabled={!charged}
            onClick={() => {
              upd({ shocked: true })
              setCharged(false)
              buzz(300)
              physical('He arches off the trolley and screams. He was awake.')
              why('He has a pulse and is conscious. Complete heart block is paced, never shocked.')
            }}
          >
            SHOCK
          </button>
        </div>
      )}
    </div>
  )
}

function Drugs({ c, run, upd, feel, why }: Stage) {
  return (
    <div className="io-choices mt-2" data-testid="drugs">
      {[
        {
          label: 'ATROPINE 1 MG IV',
          onClick: () => {
            upd({ atropine: true })
            feel('Atropine in. No change: the block is below the AV node.')
          },
        },
        {
          label: 'CALCIUM GLUCONATE 10% 30 ML',
          testId: 'calcium',
          onClick: () => {
            upd({ calcium: true })
            feel(c.hyperK ? 'Calcium over a few minutes. The peaked T waves settle.' : 'Calcium in. Nothing changes on the trace.')
          },
        },
        {
          label: 'FENTANYL 25 MICROGRAMS',
          testId: 'fentanyl',
          onClick: () => {
            upd({ analgesia: 'fentanyl' })
            feel('Fentanyl in. He settles. BP holds.')
          },
        },
        {
          label: 'KETAMINE 20 MG',
          testId: 'ketamine',
          onClick: () => {
            upd({ analgesia: 'ketamine' })
            feel('Ketamine in. He is calmer. BP holds.')
          },
        },
        {
          label: 'MIDAZOLAM 5 MG',
          onClick: () => {
            upd({ midazolam: true })
            why('Midazolam 5 mg drops the pressure in a man with a systolic in the 70s. Small opioid or ketamine instead.')
          },
        },
      ].map((d) => (
        <button key={d.label} type="button" className="tap io-mini" data-on={(d.label.startsWith('FENTANYL') && run.analgesia === 'fentanyl') || (d.label.startsWith('KETAMINE') && run.analgesia === 'ketamine') || (d.label.startsWith('CALCIUM') && run.calcium) || undefined} data-testid={d.testId} onClick={d.onClick}>
          {d.label}
        </button>
      ))}
    </div>
  )
}

function Pace(stage: Stage) {
  const { c, run, upd, feel, why, physical, coach, next } = stage
  return (
    <>
      <p className="io-lede">The defibrillator. Pace him, and call capture when you see it.</p>
      <Defib {...stage} />
      <button
        type="button"
        className="tap mt-2"
        data-testid="call-capture"
        onClick={() => {
          if (captured(run, c)) {
            upd({ captureCalled: true, thresholdSeen: run.output })
            buzz(30)
            feel(`Electrical capture at ${run.output} mA: every spike is followed by a wide QRS and a T wave.`)
          } else {
            upd({ captureCalledWrong: true })
            physical('Look again: spikes, but no QRS after them.')
            if (c.hyperK && !run.calcium) why('Peaked T waves and no capture even at high current: think hyperkalaemia. Calcium first.')
          }
        }}
      >
        I SEE ELECTRICAL CAPTURE
      </button>
      {coach && Number.isFinite(captureThreshold(run, c)) && run.captureCalled && <p className="io-small">Threshold today: {captureThreshold(run, c)} mA</p>}
      <p className="io-small mt-2">Drug drawer</p>
      <Drugs {...stage} />
      <NextButton onClick={next}>Check capture</NextButton>
    </>
  )
}

/* ================================================================ 4. capture */

function Capture(stage: Stage) {
  const { c, run, upd, feel, why, padPos, next } = stage
  const cap = captured(run, c)
  return (
    <>
      <p className="io-lede">Is the heart beating with the spikes? Then set the output just above threshold.</p>
      <div className="io-figure relative mx-auto aspect-[5/6] w-[70%]">
        <ChestFront sweaty={c.sweaty} hairy={c.hairy} dried={run.dried} clipped={run.clipped} leads={{}} pads={padPos.front} twitch={run.pacing && run.output >= 40} />
      </div>
      <Choices
        options={[
          {
            label: 'FEEL THE CAROTID',
            testId: 'pulse-carotid',
            onClick: () => {
              upd({ carotid: true })
              feel('Something jumps under your fingers with every spike. The neck and chest twitch with the current; that could be muscle, not a pulse.')
              why('Pad current makes the neck muscles jump. Feel the femoral pulse for mechanical capture.')
            },
          },
          {
            label: 'FEEL THE FEMORAL',
            testId: 'pulse-femoral',
            onClick: () => {
              upd({ femoral: true, femoralWithCapture: run.femoralWithCapture || cap })
              feel(cap ? `Femoral pulse, regular at ${run.rate}. It matches the pacer. BP is coming up.` : 'No pulse at the paced rate. That is not mechanical capture.')
            },
          },
        ]}
      />
      <Defib {...stage} />
      <Drugs {...stage} />
      <NextButton onClick={next}>Comfort and handover</NextButton>
    </>
  )
}

/* ================================================================ 5. comfort */

const SAY_CLOSE: SayOption[] = [
  { text: 'Unstable complete heart block, now paced at 70 with a femoral pulse. Pads stay on until a transvenous wire captures. CCU please.', ok: true },
  { text: 'He is captured, so we can peel the pads off for the transfer.', ok: false },
  { text: 'Pacing is working; he does not need cardiology tonight.', ok: false },
]

function Comfort(stage: Stage) {
  const { run, upd, why, next } = stage
  return (
    <>
      <p className="io-lede">Pacing hurts. Keep him comfortable without dropping his pressure, then hand over.</p>
      <Drugs {...stage} />
      <Choices
        options={[
          {
            label: 'SWITCH IT OFF SO HE CAN REST',
            onClick: () => {
              upd({ pacing: false, stoppedPacing: true })
              why('The pads and the current stay on until a wire captures. Switching off drops the rate back to 32.')
            },
          },
        ]}
      />
      <SayIt
        prompt="Hand over to CCU."
        options={SAY_CLOSE}
        picked={run.saidClose}
        onPick={(ok) => {
          upd({ saidClose: ok })
          if (!ok) why('Transcutaneous pacing is a bridge. Pads stay on, and he needs a transvenous wire.')
        }}
      />
      <NextButton onClick={next} testId="io-done">
        Hand over
      </NextButton>
    </>
  )
}
