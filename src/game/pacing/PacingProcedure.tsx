import { useEffect, useMemo, useRef, useState } from 'react'
import { Choices, NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { DragGhost, SayIt, Tool, useToolDrag, type SayOption } from '../bench/controls'
import { Monitor, type Rhythm, type Vitals } from '../bench/Monitor'
import type { BenchResult } from '../store'
import { buzz, sfx } from '../sfx'
import { Sprite } from '../Sprite'
import { ChestBack, ChestFront, DrugCartArt, LEAD_COLOUR, Pad, Targets } from './art'
import {
  CART,
  backPadSite,
  captureThreshold,
  deliver,
  potassiumOf,
  captured,
  freshPaceRun,
  frontPadSite,
  leadSite,
  paceCaseFor,
  padPairing,
  scorePacing,
  type BackSite,
  type FrontSite,
  type Drug,
  type Lead,
  type Order,
  type PaceCase,
  type PaceRun,
} from './model'

const TITLES = ['Prepare the chest', 'Pads', 'Pain relief', 'Pace', 'Check capture', 'Handover']

type Stage = BenchApi<PaceRun> & {
  c: PaceCase
  next: () => void
  padPos: PadPos
  setPadPos: (p: PadPos) => void
  tab: 'defib' | 'cart'
  setTab: (t: 'defib' | 'cart') => void
  pending: Order[]
  order: (o: Order) => void
  elapsed: () => number
}

/** Seconds from telling the nurse to the drug being in. */
const NURSE_S = 5
/** Seconds from first capture to the gas result coming back. */
const GAS_S = 8

type PadPos = { front: { site: FrontSite; x: number; y: number }[]; back: { site: BackSite; x: number; y: number } | null }

/** Transcutaneous pacing for unstable complete heart block, on a working defibrillator. */
export function PacingProcedure({ seed, coach, onDone }: { seed: number; coach: boolean; onDone: (r: BenchResult) => void }) {
  const c = useMemo(() => paceCaseFor(seed), [seed])
  const api = useBench(freshPaceRun, coach)
  const [index, setIndex] = useState(0)
  const [padPos, setPadPos] = useState<PadPos>({ front: [], back: null })
  const [bp, setBp] = useState<[number, number]>([72, 40])
  const bpRef = useRef(bp)
  const [tab, setTab] = useState<'defib' | 'cart'>('defib')
  const opened = useRef(performance.now())
  const elapsed = () => (performance.now() - opened.current) / 1000
  const [pending, setPending] = useState<Order[]>([])
  const timers = useRef<number[]>([])
  const cap = captured(api.run, c)

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // The potassium sent earlier comes back once he is paced.
  useEffect(() => {
    if (!cap || api.runRef.current.kResult) return
    const id = window.setTimeout(() => {
      api.upd({ kResult: true })
      const { k } = potassiumOf(c)
      api.feel(`Nurse: The gas is back. Potassium ${k}.`)
      buzz(40)
    }, GAS_S * 1000)
    return () => window.clearTimeout(id)
  }, [cap])

  function order(spoken: Order) {
    const o = { ...spoken, atS: elapsed() }
    const name = CART[o.drug].name
    api.feel(`Nurse: ${name} ${o.dose} IV. Drawing it up now.`)
    setPending((cur) => [...cur, o])
    const id = window.setTimeout(() => {
      api.upd((r) => deliver(r, o))
      setPending((cur) => cur.filter((p) => p !== o))
      api.feel(`Nurse: ${name} ${o.dose} given.`)
      if (o.drug === 'calcium' && c.hyperK) api.why('Calcium stabilises the membrane and the pacing threshold falls. Recheck capture and bring the output back to 5–10 mA above it.')
    }, NURSE_S * 1000)
    timers.current.push(id)
  }

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

  const stage: Stage = { ...api, c, next, padPos, setPadPos, tab, setTab, pending, order, elapsed }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="pacing-bench">
      <div className="px-3 pt-1">
        <Monitor vitals={vitalsOf(api.run, c, bp)} />
        {api.run.kResult && <GasResult c={c} />}
      </div>
      <StepStrip titles={TITLES} index={index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {index === 0 && <Prepare {...stage} />}
        {index === 1 && <Pads {...stage} />}
        {index === 2 && <PainRelief {...stage} />}
        {index === 3 && <Pace {...stage} />}
        {index === 4 && <Capture {...stage} />}
        {index === 5 && <Comfort {...stage} />}
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

function Defib({ c, run, runRef, upd, feel, why, physical, elapsed }: Stage) {
  const [charged, setCharged] = useState(false)
  const settle = useRef<{ from: number; t: number } | null>(null)

  /** Each ±10 press is its own step. A drag on the dial counts as one jump from where it settled. */
  function setOutput(v: number, fromButton = false) {
    const value = Math.max(0, Math.min(200, v))
    const before = runRef.current.output
    if (fromButton) {
      const r = runRef.current
      const step = Math.abs(value - before)
      if (r.pacing && !captured(r, c) && step > r.biggestStep) upd({ biggestStep: step })
      upd({ output: value })
      if (r.pacing && value >= 50 && before < 50 && !r.analgesia) physical('He groans with every beat and grabs at the pads.')
      if (r.pacing && captured({ ...r, output: value }, c) && !captured(r, c)) buzz(20)
      return
    }
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
            <button type="button" className="defib-key" data-testid="out-down" onClick={() => setOutput(runRef.current.output - 10, true)}>
              −10
            </button>
            <b data-testid="output-ma">{run.output} mA</b>
            <button type="button" className="defib-key" data-testid="out-up" onClick={() => setOutput(runRef.current.output + 10, true)}>
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
            upd({ pacing: on, stoppedPacing: run.stoppedPacing || (!on && run.captureCalled), pacingStartedAtS: run.pacingStartedAtS ?? (on ? elapsed() : null) })
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

function GasResult({ c }: { c: PaceCase }) {
  const { k, ph } = potassiumOf(c)
  const high = k >= 6
  return (
    <div className="lab-card" data-high={high || undefined} data-testid="gas-result">
      <b>VENOUS GAS</b>
      <span>K+ {k.toFixed(1)} mmol/L</span>
      <span>pH {ph.toFixed(2)}</span>
    </div>
  )
}

/** The drug cart and the nurse. You choose the drug and the dose and say it; the nurse draws it up and gives it. */
function DrugCart({ run, pending, order }: Stage) {
  const [drug, setDrug] = useState<Drug | null>(null)
  const [dose, setDose] = useState<string | null>(null)
  return (
    <div className="drug-cart" data-testid="drug-cart">
      <div className="grid grid-cols-[3fr_1fr] items-end gap-2">
        <div className="io-figure aspect-[3/2]">
          <DrugCartArt
            selected={drug}
            onPick={(d) => {
              setDrug(d)
              setDose(null)
              sfx.cursor()
            }}
          />
        </div>
        <div className="flex flex-col items-center">
          <Sprite role="nurse" facing="w" scale={3} />
          <span className="io-small">Nurse</span>
        </div>
      </div>
      {drug && (
        <>
          <p className="io-small mt-2">{CART[drug].name}: what dose?</p>
          <div className="io-choices">
            {CART[drug].doses.map((d) => (
              <button key={d} type="button" className="tap io-mini" data-on={dose === d || undefined} data-testid={`dose-${d.replace(/\s+/g, '-')}`} onClick={() => setDose(d)}>
                {d}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        className="tap mt-2"
        data-testid="tell-nurse"
        disabled={!drug || !dose}
        onClick={() => {
          if (!drug || !dose) return
          sfx.select()
          order({ drug, dose })
          setDrug(null)
          setDose(null)
        }}
      >
        {drug && dose ? `TELL THE NURSE: "${CART[drug].name} ${dose} IV, please."` : 'Pick a drawer, then a dose'}
      </button>
      {(pending.length > 0 || run.orders.length > 0) && (
        <ul className="order-list" data-testid="orders">
          {pending.map((o, i) => (
            <li key={`p${i}`}>… {CART[o.drug].name} {o.dose}: drawing up</li>
          ))}
          {run.orders.map((o, i) => (
            <li key={`g${i}`}>✓ {CART[o.drug].name} {o.dose} given</li>
          ))}
        </ul>
      )}
    </div>
  )
}

const SAY_WARN: SayOption[] = [
  { text: 'This will thump your chest with every beat. I am giving you something for the pain first.', ok: true },
  { text: 'You will not feel anything.', ok: false },
  { text: 'We will sort the pain out once your heart is going.', ok: false },
]

function PainRelief(stage: Stage) {
  const { run, upd, why, next } = stage
  const [said, setSaid] = useState<boolean | null>(null)
  return (
    <>
      <p className="io-lede">He is drowsy but feels pain, and the pads will thump with every beat. Before you touch the dials: pain relief, small enough for a BP of 72.</p>
      <SayIt
        prompt="Tell him what is coming."
        options={SAY_WARN}
        picked={said}
        onPick={(ok) => {
          setSaid(ok)
          if (!ok) why('Warn him the chest will thump, and give pain relief before or as you start.')
        }}
      />
      <div className="mt-2">
        <DrugCart {...stage} />
      </div>
      {run.orders.length === 0 && stage.pending.length === 0 && <p className="io-small mt-2">You can pace without waiting for it to be given, but order it now.</p>}
      <NextButton onClick={next}>Set the pacer</NextButton>
    </>
  )
}

/** Two places at the bedside: the defibrillator, and the drug cart with the nurse. */
function Stations(stage: Stage) {
  const { tab, setTab } = stage
  return (
    <>
      <div className="bench-tabs" role="tablist">
        <button type="button" role="tab" data-on={tab === 'defib' || undefined} data-testid="tab-defib" onClick={() => setTab('defib')}>
          DEFIBRILLATOR
        </button>
        <button type="button" role="tab" data-on={tab === 'cart' || undefined} data-testid="tab-cart" onClick={() => setTab('cart')}>
          DRUG CART
        </button>
      </div>
      {tab === 'defib' ? <Defib {...stage} /> : <DrugCart {...stage} />}
    </>
  )
}

function Pace(stage: Stage) {
  const { c, run, upd, feel, why, physical, coach, next } = stage
  return (
    <>
      <p className="io-lede">The defibrillator is on the trolley; the drug cart and the nurse are beside it. Pace him, and call capture when you see it.</p>
      <Stations {...stage} />
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
            if (c.hyperK && !run.calcium) why('Peaked T waves and a high threshold: think hyperkalaemia.')
          }
        }}
      >
        I SEE ELECTRICAL CAPTURE
      </button>
      {coach && Number.isFinite(captureThreshold(run, c)) && run.captureCalled && <p className="io-small">Threshold now: {captureThreshold(run, c)} mA</p>}
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
      <Stations {...stage} />
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
      <p className="io-lede">Keep him comfortable without dropping his pressure, then hand over.</p>
      <Stations {...stage} />
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
