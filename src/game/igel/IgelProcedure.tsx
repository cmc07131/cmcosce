import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Choices, NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { HoldButton, SayIt, capture, type SayOption } from '../bench/controls'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { DeviceChip, DeviceView, FaceFront, IgelMonitor, SupineScene } from './art'
import {
  BOWL_POOL,
  EXT_OK,
  IGEL_MARKS,
  LUBE_OK,
  OPEN_OK,
  SIZES,
  WEIGHT_KG,
  freshIgelRun,
  judgeTape,
  pushTo,
  rightSize,
  scoreIgel,
  spo2Step,
  squeeze,
  withdraw,
  type IgelRun,
  type IgelSize,
  type Pt,
} from './model'

/** One expiration on the capnograph, seconds. */
const EXHALE_S = 1.8

const TITLES = ['Size', 'Lubricate', 'Position', 'Insert', 'Ventilate', 'Gastric tube', 'Secure']

type Stage = BenchApi<IgelRun> & {
  next: () => void
  /** A squeeze starts: inspiration, so the capnograph falls to zero. */
  inhale: () => void
  mask: boolean
  setMask: (on: boolean) => void
  breathAt: React.MutableRefObject<number>
  chest: number
  co2: number[]
}

/** Map a pointer into an SVG element's own user space (its transforms included). */
function toLocal(el: SVGGraphicsElement | null, event: { clientX: number; clientY: number }): Pt | null {
  const m = el?.getScreenCTM()
  if (!m) return null
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse())
  return { x: p.x, y: p.y }
}

/** i-gel insertion by hand, from choosing the size to taping it in. SpO2 falls while nobody is ventilating. */
export function IgelProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshIgelRun, coach)
  const [index, setIndex] = useState(0)
  const [mask, setMask] = useState(false)
  const maskRef = useRef(false)
  maskRef.current = mask
  const indexRef = useRef(0)
  indexRef.current = index
  const breathAt = useRef(-99)
  const exhaleUntil = useRef(-99)
  const exhaleSize = useRef(1)
  const [chest, setChest] = useState(0)
  const [co2, setCo2] = useState<number[]>(() => Array(120).fill(0))

  // Oxygen and the capnograph run on a timer (a hidden pane pauses animation frames).
  useEffect(() => {
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.5, (now - last) / 1000)
      last = now
      const r = api.runRef.current
      const t = now / 1000
      if (indexRef.current >= 3) {
        const viaDevice = r.seated && (t - breathAt.current < 6 || indexRef.current >= 5)
        const viaMask = maskRef.current && (r.depth === 0 || r.folded)
        api.upd(spo2Step(r, dt, viaDevice || viaMask))
      }
      setChest((c) => Math.max(0, c - dt * 1.2))
      if (indexRef.current >= 4) {
        // Expiration: a steep upstroke, a gently rising plateau, then down to zero at the next breath.
        const e = t - (exhaleUntil.current - EXHALE_S)
        const v = e < 0 || e > EXHALE_S ? 0 : e < 0.15 ? (e / 0.15) * 0.85 : 0.85 + 0.15 * (e / EXHALE_S)
        setCo2((a) => [...a.slice(1), v * exhaleSize.current])
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  function next() {
    sfx.select()
    setMask(false)
    if (index < TITLES.length - 1) {
      setIndex(index + 1)
      return
    }
    const s = scoreIgel(api.runRef.current)
    const marks = s.earned.map((k) => job.grantMarks[IGEL_MARKS.indexOf(k)]).filter((m): m is string => Boolean(m))
    onDone({ marks, faults: s.faults, summary: s.summary })
  }

  function breathe(heldS: number) {
    const kind = squeeze(api.runRef.current, heldS)
    const t = performance.now() / 1000
    if (kind === 'short') return
    if (kind === 'good') {
      breathAt.current = t
      exhaleUntil.current = t + EXHALE_S
      exhaleSize.current = 1
      setChest(1)
      api.upd((r) => ({ breaths: r.breaths + 1 }))
      sfx.select()
      api.feel('The chest rises and falls. A square trace on the capnograph.')
    } else if (kind === 'hard') {
      breathAt.current = t
      exhaleUntil.current = t + EXHALE_S
      exhaleSize.current = 0.6
      setChest(0.6)
      api.upd((r) => ({ hardSqueezes: r.hardSqueezes + 1 }))
      api.physical('A gurgling leak at the mouth, and air bubbling into the stomach.')
      api.why('Gentle breaths over about one second. High pressure breaks the seal and inflates the stomach.')
    } else {
      api.physical('Air hisses out around the device. No trace on the capnograph.')
      api.why('It is not seated. Ventilation through a supraglottic airway needs it at definite resistance.')
    }
  }

    function inhale() {
    const t = performance.now() / 1000
    exhaleUntil.current = Math.min(exhaleUntil.current, t)
  }

  const stage: Stage = { ...api, next, inhale, mask, setMask, breathAt, chest, co2 }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="igel-bench">
      <div className="px-3 pt-1">
        <IgelMonitor spo2={api.run.spo2} co2={index >= 4 ? co2 : null} />
      </div>
      <StepStrip titles={TITLES} index={index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {index === 0 && <SizeStep {...stage} />}
        {index === 1 && <LubeStep {...stage} />}
        {index === 2 && <PositionStep {...stage} />}
        {index === 3 && <InsertStep {...stage} />}
        {index === 4 && <VentilateStep {...stage} breathe={breathe} />}
        {index === 5 && <GastricStep {...stage} />}
        {index === 6 && <SecureStep {...stage} />}
        <NoteLine note={api.note} />
      </div>
    </div>
  )
}

/* ================================================================ 1. size */

function SizeStep({ run, upd, feel, why, next }: Stage) {
  const sizes: IgelSize[] = [3, 4, 5]
  return (
    <>
      <p className="io-lede">Manikin: a {WEIGHT_KG} kg adult. Pick the i-gel.</p>
      <div className="grid grid-cols-3 gap-2">
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            className="tool"
            data-done={run.size === s || undefined}
            data-testid={`igel-size-${s}`}
            onClick={() => {
              upd((r) => ({ size: s, sizesTried: r.sizesTried.includes(s) ? r.sizesTried : [...r.sizesTried, s] }))
              feel(`Size ${s}, ${SIZES[s].name.toLowerCase()} connector, ${SIZES[s].band}.`)
              if (!rightSize(WEIGHT_KG).includes(s)) why(`Size by weight: 3 for 30–60 kg, 4 for 50–90 kg, 5 for over 90 kg.`)
            }}
          >
            <div className="tool-art w-full">
              <DeviceChip size={s} />
            </div>
            <span className="tool-caption">
              SIZE {s} · {SIZES[s].band}
            </span>
          </button>
        ))}
      </div>
      <NextButton onClick={next}>Lubricate</NextButton>
    </>
  )
}

/* ================================================================ 2. lubricate */

function LubeStep({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const [view, setView] = useState<'front' | 'back'>('back')
  const [dabs, setDabs] = useState<Record<'front' | 'back', Pt[]>>({ front: [], back: [] })
  const svg = useRef<SVGSVGElement>(null)
  const down = useRef(false)
  const size = run.size ?? 4

  const last = useRef<Pt | null>(null)
  const lastDab = useRef<Pt | null>(null)

  /** Gel goes on by the distance you rub, so a slow careful rub and a quick one count the same. */
  function paint(event: ReactPointerEvent<HTMLDivElement>) {
    const p = toLocal(svg.current, event)
    if (!p) return
    const prev = last.current
    last.current = p
    const inCuff = ((p.x - 60) / 34) ** 2 + ((p.y - 54) / 46) ** 2 <= 1
    if (!inCuff || !prev) return
    const moved = Math.min(12, Math.hypot(p.x - prev.x, p.y - prev.y))
    const inBowl = view === 'front' && ((p.x - 60) / 18) ** 2 + ((p.y - 64) / 24) ** 2 <= 1
    if (!lastDab.current || Math.hypot(p.x - lastDab.current.x, p.y - lastDab.current.y) > 6) {
      lastDab.current = p
      setDabs((d) => ({ ...d, [view]: [...d[view].slice(-60), p] }))
    }
    const r = runRef.current
    const l = { ...r.lube }
    if (inBowl) {
      l.bowl += moved * 0.005
      if (r.lube.bowl < BOWL_POOL && l.bowl >= BOWL_POOL) {
        physical('A blob of gel is sitting in the bowl.')
        why('Lubricant in the bowl can be inhaled or block the airway opening. A thin layer on the outside only.')
      }
    } else if (view === 'back') {
      l.back = Math.min(1, l.back + moved * 0.004)
      if (r.lube.back < LUBE_OK && l.back >= LUBE_OK) feel('The back of the cuff is coated: it will glide along the palate.')
    } else {
      l.front = Math.min(1, l.front + moved * 0.004)
      if (r.lube.front < LUBE_OK && l.front >= LUBE_OK) feel('Front and sides of the cuff coated, a thin layer.')
    }
    upd({ lube: l })
  }

  return (
    <>
      <p className="io-lede">Water-based gel. Rub a thin layer over the cuff: drag on the device.</p>
      <div
        className="io-figure mx-auto aspect-[3/4] max-w-[220px]"
        style={{ touchAction: 'none' }}
        data-testid="igel-lube"
        onPointerDown={(e) => {
          down.current = true
          last.current = null
          capture(e)
          paint(e)
        }}
        onPointerMove={(e) => down.current && paint(e)}
        onPointerUp={() => (down.current = false)}
        onPointerCancel={() => (down.current = false)}
      >
        <DeviceView size={size} view={view} dabs={dabs[view]} svgRef={svg} />
      </div>
      <Choices
        options={[
          { label: 'SHOW THE BACK', testId: 'igel-view-back', on: view === 'back', onClick: () => setView('back') },
          { label: 'SHOW THE FRONT', testId: 'igel-view-front', on: view === 'front', onClick: () => setView('front') },
          {
            label: 'WIPE THE BOWL',
            testId: 'igel-wipe',
            onClick: () => {
              upd((r) => ({ lube: { ...r.lube, bowl: 0 } }))
              setDabs((d) => ({ ...d, front: d.front.filter((p) => ((p.x - 60) / 18) ** 2 + ((p.y - 64) / 24) ** 2 > 1) }))
              feel('Gel wiped out of the bowl with a gauze.')
            },
          },
        ]}
      />
      <NextButton onClick={next}>Position</NextButton>
    </>
  )
}

/* ================================================================ 3. position and grip */

function PositionStep({ run, runRef, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ mode: 'tilt' | 'chin'; x: number; y: number; ext: number; open: number } | null>(null)
  const sniff = run.pillow && run.ext >= EXT_OK.min && run.ext <= EXT_OK.max
  return (
    <>
      <p className="io-lede">Drag the forehead down to tilt the head back. Push the chin toward the chest to open the mouth.</p>
      <div
        className="io-figure aspect-[8/5]"
        style={{ touchAction: 'none' }}
        data-testid="igel-position"
        onPointerDown={(e) => {
          const p = toLocal(svg.current, e)
          if (!p) return
          capture(e)
          const r = runRef.current
          drag.current = { mode: p.x < 72 ? 'tilt' : 'chin', x: p.x, y: p.y, ext: r.ext, open: r.open }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          const p = toLocal(svg.current, e)
          if (!d || !p) return
          const dy = p.y - d.y
          // Tilt: the forehead goes down toward the trolley. Chin: pushed toward the chest opens the mouth.
          if (d.mode === 'tilt') upd({ ext: Math.max(0, Math.min(40, d.ext + dy * 0.9)) })
          else upd({ open: Math.max(0, Math.min(1, d.open + (p.x - d.x + dy) / 22)) })
        }}
        onPointerUp={() => {
          const d = drag.current
          drag.current = null
          const r = runRef.current
          if (d?.mode === 'tilt') {
            if (r.ext > EXT_OK.max) why('That is past the sniffing position. Extend the head, not the whole neck.')
            else if (r.ext >= EXT_OK.min) feel(r.pillow ? 'Sniffing the morning air: neck flexed on the pillow, head extended.' : 'Head extended.')
          }
          if (d?.mode === 'chin' && r.open >= OPEN_OK) feel('Chin pressed down. The mouth is open.')
        }}
      >
        <SupineScene ext={run.ext} open={run.open} pillow={run.pillow} size={run.size} depth={0} orientation="chin" folded={false} showDevice={false} svgRef={svg} />
      </div>
      <p className="io-small">
        Head {Math.round(run.ext)}° · mouth {run.open >= OPEN_OK ? 'open' : 'closed'} {sniff ? '· sniffing position' : ''}
      </p>
      <Choices
        options={[
          {
            label: run.pillow ? 'PILLOW ✓' : 'PILLOW UNDER THE OCCIPUT',
            testId: 'igel-pillow',
            on: run.pillow,
            onClick: () => {
              upd((r) => ({ pillow: !r.pillow }))
              feel(runRef.current.pillow ? 'A folded pillow under the occiput flexes the lower neck.' : 'Pillow out.')
            },
          },
        ]}
      />
      <p className="io-lede mt-2">How do you hold the i-gel?</p>
      <Choices
        options={[
          {
            label: 'FIRMLY ALONG THE BITE BLOCK',
            testId: 'igel-grip-block',
            on: run.grip === 'block',
            onClick: () => {
              upd({ grip: 'block' })
              feel('Held along the integral bite block, cuff outlet toward the chin.')
            },
          },
          {
            label: 'BY THE CUFF',
            testId: 'igel-grip-cuff',
            on: run.grip === 'cuff',
            onClick: () => {
              upd({ grip: 'cuff' })
              why('Holding the cuff squeezes it and your fingers get in the way. Hold along the bite block.')
            },
          },
        ]}
      />
      <NextButton onClick={next}>Insert</NextButton>
    </>
  )
}

/* ================================================================ 4. insert */

function InsertStep({ run, runRef, upd, feel, physical, why, coach, next, mask, setMask }: Stage) {
  const frame = useRef<SVGGElement>(null)
  const warned = useRef<string>('')
  const out = run.depth === 0 || run.folded
  const once = (key: string, f: () => void) => {
    if (warned.current === key) return
    warned.current = key
    f()
  }

  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const p = toLocal(frame.current, e)
    if (!p) return
    if (maskOn()) return
    const { patch, event } = pushTo(runRef.current, p)
    if (Object.keys(patch).length) upd(patch)
    if (event === 'advance') warned.current = ''
    if (event === 'teeth') once('teeth', () => physical('The teeth are closed on it. Press the chin down to open the mouth.'))
    if (event === 'tongue') once('tongue', () => physical('The tip is catching on the tongue.'))
    if (event === 'fold' || event === 'flipped-fold') {
      buzz([30, 40, 30])
      physical('It will not go: the tip has folded back. Take it out.')
      why(runRef.current.failures[runRef.current.failures.length - 1] ?? '')
    }
    if (event === 'seated') {
      buzz(40)
      sfx.select()
      feel('Definite resistance. The incisors rest on the bite block. Stop pushing.')
    }
  }
  const maskOn = () => mask && out

  return (
    <>
      <p className="io-lede">
        {run.seated ? 'Seated.' : run.folded ? 'Folded. Take it out and oxygenate.' : 'Drag the tip in along the hard palate, down behind the tongue, to definite resistance.'}
      </p>
      <div className="io-figure aspect-[8/5]" style={{ touchAction: 'none' }} data-testid="igel-insert" onPointerDown={(e) => { capture(e); move(e) }} onPointerMove={(e) => e.buttons && move(e)}>
        <SupineScene
          ext={run.ext}
          open={run.open}
          pillow={run.pillow}
          size={run.size ?? 4}
          depth={run.depth}
          orientation={run.orientation}
          folded={run.folded}
          showDevice={!mask || !out}
          showTrack={coach && !run.seated && run.attempts > 0}
          mask={mask && out}
          frameRef={frame}
        />
      </div>
      <p className="io-small" data-testid="igel-attempts">
        Attempt {Math.min(run.attempts + (run.seated ? 0 : 1), 9)} · maximum three
      </p>
      {/* The controls stay put while you insert, so the picture never moves under your finger. */}
      <Choices
        options={[
          {
            label: 'OUTLET TO THE CHIN',
            testId: 'igel-orient-chin',
            on: run.orientation === 'chin',
            onClick: () => (out && !run.seated ? upd({ orientation: 'chin' }) : physical('Take it out before you turn it.')),
          },
          {
            label: 'UPSIDE DOWN, ROTATE IN',
            testId: 'igel-orient-palate',
            on: run.orientation === 'palate',
            onClick: () => (out && !run.seated ? upd({ orientation: 'palate' }) : physical('Take it out before you turn it.')),
          },
          {
            label: 'TAKE IT OUT',
            testId: 'igel-withdraw',
            onClick: () => {
              if (run.seated) return physical('It is seated. Leave it in and ventilate.')
              if (run.depth === 0) return
              // Pulled out part way: that still used up an attempt.
              upd({ ...withdraw(), attempts: run.folded || run.depth < 0.3 ? run.attempts : run.attempts + 1 })
              warned.current = ''
              feel('Out. Mask back on between attempts.')
            },
          },
        ]}
      />
      <HoldButton testId="igel-mask" disabled={!out || run.seated} onStart={() => setMask(true)} onEnd={() => setMask(false)} onTick={() => undefined}>
        Hold · two-person mask ventilation
      </HoldButton>
      {run.attempts >= 3 && !run.seated && <p className="io-small">Three attempts. Stop and think: wake, fibreoptic, or front-of-neck access.</p>}
      <NextButton onClick={next}>Ventilate</NextButton>
    </>
  )
}

/* ================================================================ 5. ventilate and confirm */

const SAY_CONFIRM: SayOption[] = [
  { text: 'Chest rising and a square capnography trace on every breath, no large leak: it is ventilating.', ok: true },
  { text: 'The SpO2 is coming up, so it must be in.', ok: false },
  { text: 'I can hear air at the mouth, so it is in.', ok: false },
]

function VentilateStep({ run, upd, physical, why, next, chest, breathe, inhale }: Stage & { breathe: (s: number) => void }) {
  const start = useRef(0)
  const [squeezing, setSqueezing] = useState(false)
  return (
    <>
      <p className="io-lede">Bag and capnography line on the connector. Squeeze gently, one second a breath.</p>
      <div className="io-figure aspect-[8/5]">
        <SupineScene ext={run.ext} open={run.open} pillow={run.pillow} size={run.size ?? 4} depth={run.depth} orientation={run.orientation} folded={run.folded} showDevice chest={chest} bag={squeezing ? 1 : 0} />
      </div>
      <HoldButton
        testId="igel-bag"
        onStart={() => {
          start.current = performance.now()
          setSqueezing(true)
          inhale()
        }}
        onEnd={() => {
          setSqueezing(false)
          breathe((performance.now() - start.current) / 1000)
        }}
        onTick={() => undefined}
      >
        Hold · squeeze the bag ({run.breaths} breath{run.breaths === 1 ? '' : 's'})
      </HoldButton>
      <Choices
        options={[
          {
            label: 'INFLATE THE CUFF · 30 mL',
            testId: 'igel-inflate',
            onClick: () => {
              upd({ inflateTried: true })
              physical('There is no pilot balloon to fill.')
              why('The i-gel cuff is a soft gel that moulds to the larynx. Nothing to inflate.')
            },
          },
        ]}
      />
      {run.breaths >= 3 && (
        <SayIt
          prompt="Tell your assistant how you know it is working."
          options={SAY_CONFIRM}
          picked={run.saidConfirm}
          onPick={(ok) => {
            upd({ saidConfirm: ok })
            if (!ok) why('Waveform capnography is the confirmation. SpO2 lags, and air at the mouth is a leak.')
          }}
        />
      )}
      <NextButton onClick={next}>Gastric tube</NextButton>
    </>
  )
}

/* ================================================================ 6. gastric tube */

function GastricStep({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const maxFr = SIZES[run.size ?? 4].maxFr
  const stuck = useRef(false)
  return (
    <>
      <p className="io-lede">Lubricated gastric tube down the drain channel.</p>
      <div className="io-figure aspect-[8/5]">
        <SupineScene ext={run.ext} open={run.open} pillow={run.pillow} size={run.size ?? 4} depth={run.depth} orientation={run.orientation} folded={run.folded} showDevice tube={run.tube} />
      </div>
      <Choices
        options={[12, 18].map((fr) => ({
          label: `${fr} Fr TUBE`,
          testId: `igel-tube-${fr}`,
          on: run.tubeFr === fr,
          onClick: () => {
            stuck.current = false
            upd({ tubeFr: fr, tube: 0 })
          },
        }))}
      />
      {run.tubeFr && (
        <HoldButton
          testId="igel-pass-tube"
          onTick={(dt) => {
            const r = runRef.current
            if (r.tube >= 1 || !r.tubeFr) return
            if (r.tubeFr > maxFr) {
              if (r.tube < 0.08) upd({ tube: Math.min(0.08, r.tube + dt) })
              else if (!stuck.current) {
                stuck.current = true
                upd({ tubeTriedTooBig: true })
                physical('It jams at the port. It will not pass.')
                why(`The drain channel of a size ${r.size ?? 4} takes up to ${maxFr} Fr.`)
              }
              return
            }
            if (!r.seated) {
              if (!stuck.current) {
                stuck.current = true
                physical('The tube coils in the pharynx.')
                why('The drain channel lines up with the oesophagus only when the device is seated.')
              }
              return
            }
            const tube = Math.min(1, r.tube + dt * 0.6)
            upd({ tube })
            if (tube >= 1) feel('A hiss of gas and a little fluid: the stomach is decompressed. Tube on free drainage.')
          }}
        >
          Hold · pass the tube
        </HoldButton>
      )}
      <NextButton onClick={next}>Secure</NextButton>
    </>
  )
}

/* ================================================================ 7. secure */

function SecureStep({ run, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [stroke, setStroke] = useState<Pt[]>([])
  const down = useRef(false)
  return (
    <>
      <p className="io-lede">Tape it: drag a strip of tape across the face.</p>
      <div
        className="io-figure mx-auto aspect-square max-w-[260px]"
        style={{ touchAction: 'none' }}
        data-testid="igel-tape"
        onPointerDown={(e) => {
          const p = toLocal(svg.current, e)
          if (!p) return
          capture(e)
          down.current = true
          setStroke([p])
        }}
        onPointerMove={(e) => {
          if (!down.current) return
          const p = toLocal(svg.current, e)
          if (p) setStroke((s) => [...s, p])
        }}
        onPointerUp={() => {
          if (!down.current) return
          down.current = false
          const verdict = judgeTape(stroke)
          if (verdict.ok) {
            upd({ taped: true, tapeMandible: false })
            feel('Taped maxilla to maxilla, across the bite block. It will not move.')
          } else if (verdict.why) {
            if (verdict.mandible) upd({ tapeMandible: true })
            why(verdict.why)
          }
        }}
      >
        <FaceFront size={run.size ?? 4} stroke={stroke} taped={run.taped} svgRef={svg} />
      </div>
      <NextButton onClick={next} testId="io-done">
        Hand back to the examiner
      </NextButton>
    </>
  )
}
