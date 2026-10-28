import { useEffect, useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { Dial, HoldButton, useSpin } from '../bench/controls'
import { CheckCard, RubTint, Syringe, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import {
  BedSide,
  BodyDrape,
  ChestXray,
  EcgStrip,
  Glove,
  HeadTop,
  LumenTray,
  NeckView,
  Operator,
  SIDE,
  SecureView,
  SideView,
  US,
  UsScreen,
  cxrTipY,
  wirePoint,
} from './art'
import {
  CATH_OK,
  CVC_MARKS,
  DILATE_OK,
  DRY_SECONDS,
  ECTOPY_CM,
  GARB,
  LUMENS,
  NECK,
  ROTATION_MAX,
  SKIN_GRIP_CM,
  STROKES_NEEDED,
  TILT_OK,
  arteryAt,
  checkCvc,
  feedWire,
  freshCvc,
  insideAfterNeedle,
  levelAt,
  moveNeedle,
  needleInBeam,
  offsetMm,
  overlap,
  slide,
  tailAt,
  tailFree,
  tipOf,
  tipZone,
  veinShape,
  veinXOnNeck,
  type CvcRun,
  type Garb,
  type Lumen,
} from './model'

const TITLES = ['Position', 'Pre-scan', 'Scrub', 'Prep', 'Kit', 'Needle', 'Wire', 'Confirm', 'Dilate', 'Catheter', 'Secure', 'X-ray']

type Shared = { probe: Pt }
type Stage = BenchApi<CvcRun> & { next: () => void; shared: React.MutableRefObject<Shared> }

/** Runs `fn(dt)` every 50 ms while `on`. */
function useTicker(on: boolean, fn: (dt: number) => void) {
  const f = useRef(fn)
  f.current = fn
  useEffect(() => {
    if (!on) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      f.current(Math.min(0.2, (now - last) / 1000))
      last = now
    }, 50)
    return () => window.clearInterval(id)
  }, [on])
}

/** A value that eases to 1 over `ms` once started: scripted moves (a stitch, a drape settling). */
function usePlay(ms: number) {
  const [t, setT] = useState<number | null>(null)
  const raf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  function play(after?: () => void) {
    cancelAnimationFrame(raf.current)
    const start = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      setT(k)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else {
        setT(null)
        after?.()
      }
    }
    raf.current = requestAnimationFrame(step)
  }
  return { t, play, playing: t !== null }
}

/**
 * An ultrasound-guided right internal jugular line on the manikin, every step done by hand and shown as it is done:
 * tilt the bed and turn the head, pre-scan and compress, gown and glove, scrub and drape, flush the lumens and sheath
 * the probe, numb the skin, track the needle tip into the vein, steady the needle and feed the wire, see the wire in
 * the vein both ways, nick, dilate to the vein only, railroad the catheter with the wire held at its hub, take the wire
 * out and show it whole, aspirate and flush every lumen, stitch and dress, and read the X-ray.
 */
export function CvcProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshCvc, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const shared = useRef<Shared>({ probe: { x: veinXOnNeck(NECK.apexY), y: NECK.apexY } })
  const done = useRef(false)
  const body = useRef<HTMLDivElement>(null)
  // What everything looked like as you began each step: going back puts it all back, mistakes included.
  const snaps = useRef<{ run: CvcRun; probe: Pt }[]>([{ run: api.runRef.current, probe: shared.current.probe }])
  const [epoch, setEpoch] = useState(0)
  const restore = (i: number) => {
    const snap = snaps.current[i]
    if (!snap) return
    api.upd({ ...snap.run })
    shared.current.probe = snap.probe
    setEpoch((e) => e + 1)
  }
  const next = () => {
    sfx.select()
    if (index < TITLES.length - 1) {
      snaps.current[index + 1] = { run: api.runRef.current, probe: shared.current.probe }
      setIndex(index + 1)
    } else {
      snaps.current[TITLES.length] = { run: api.runRef.current, probe: shared.current.probe }
      setChecked(true)
    }
    body.current?.scrollTo({ top: 0 })
  }
  const back = () => {
    sfx.back()
    // Back keeps what you did; REDO THIS STEP is what starts a step again from scratch.
    if (checked) {
      setChecked(false)
      setEpoch((e) => e + 1)
      api.feel(`Back to the ${TITLES[TITLES.length - 1].toLowerCase()}, as you left it.`)
    } else if (index > 0) {
      restore(index)
      setIndex(index - 1)
      api.feel(`Back to the ${TITLES[index - 1].toLowerCase()}, as you left it. REDO THIS STEP starts it again.`)
    }
    body.current?.scrollTo({ top: 0 })
  }
  const redo = () => {
    sfx.back()
    restore(index)
    api.feel(`${TITLES[index]}: from the start of this step again.`)
    body.current?.scrollTo({ top: 0 })
  }
  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const { marks, faults } = benchMarks(checkCvc(r), CVC_MARKS, job.grantMarks)
    const ok = r.wireOut && r.catheterPlaced && r.wireIn === 'vein' && !r.dilatedArtery
    onDone({
      marks,
      faults,
      summary: ok ? `Right IJ line in at ${r.catheterCm.toFixed(0)} cm, wire out and shown whole.` : 'The line is not safely in.',
      scene: ok ? [job.scene || 'line'] : ['no-line'],
    })
  }
  const stage: Stage = { ...api, next, shared }
  const r = api.run
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col select-none" data-testid="cvc-bench">
      <div className="hare-bar">
        <span>MANIKIN · R IJV</span>
        <span />
        <span>{r.wireCm > 0 && !r.wireOut ? `WIRE ${r.needleOut ? 'IN' : r.wireCm.toFixed(0) + ' CM'}` : r.catheterCm > 0 ? `LINE ${r.catheterCm.toFixed(0)} CM` : `${r.tilt.toFixed(0)}° HEAD-DOWN`}</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div ref={body} className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <>
            <CheckCard rows={checkCvc(r)} onContinue={finish} testId="cvc-check" />
            <div className="io-choices mt-2">
              <button type="button" className="tap io-mini" data-testid="cvc-back" onClick={back}>
                ◀ BACK TO THE X-RAY
              </button>
            </div>
          </>
        ) : (
          <div key={`${index}-${epoch}`} className="contents">
            {index === 0 && <PositionStage {...stage} />}
            {index === 1 && <ScanStage {...stage} />}
            {index === 2 && <ScrubStage {...stage} />}
            {index === 3 && <PrepStage {...stage} />}
            {index === 4 && <KitStage {...stage} />}
            {index === 5 && <NeedleStage {...stage} />}
            {index === 6 && <WireStage {...stage} />}
            {index === 7 && <ConfirmStage {...stage} />}
            {index === 8 && <DilateStage {...stage} />}
            {index === 9 && <CatheterStage {...stage} />}
            {index === 10 && <SecureStage {...stage} />}
            {index === 11 && <XrayStage {...stage} />}
            <div className="io-choices mt-2">
              <button type="button" className="tap io-mini" data-testid="cvc-back" disabled={index === 0} onClick={back}>
                ◀ BACK A STEP
              </button>
              <button type="button" className="tap io-mini" data-testid="cvc-redo" onClick={redo}>
                ↺ REDO THIS STEP
              </button>
            </div>
          </div>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x])

/* ================================================================ shared controls */

/**
 * A strip to drag along: right pushes toward the patient, left draws back. `cmPerWidth`: how far one full sweep
 * moves it. More reliable on a phone than dragging along a thin wire in the picture.
 */
function SlidePad({ label, cmPerWidth, onDelta, onEnd, disabled, testId }: { label: string; cmPerWidth: number; onDelta: (cm: number) => void; onEnd?: () => void; disabled?: boolean; testId: string }) {
  const last = useRef<number | null>(null)
  const [x, setX] = useState(0.5)
  return (
    <div
      className="io-figure mt-2 aspect-[200/30]"
      style={{ touchAction: 'none', opacity: disabled ? 0.45 : 1 }}
      data-testid={testId}
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = e.clientX
      }}
      onPointerMove={(e) => {
        if (last.current === null) return
        const rect = e.currentTarget.getBoundingClientRect()
        const dx = e.clientX - last.current
        last.current = e.clientX
        setX(clamp((e.clientX - rect.left) / rect.width, 0.05, 0.95))
        onDelta((dx / rect.width) * cmPerWidth)
      }}
      onPointerUp={() => {
        last.current = null
        setX(0.5)
        onEnd?.()
      }}
      onPointerCancel={() => (last.current = null)}
    >
      <svg viewBox="0 0 200 30" className="block h-full w-full select-none">
        <rect width="200" height="30" fill="#e8f0f6" />
        <rect x="8" y="17" width="184" height="6" rx="3" fill="#b8c8d8" />
        <g transform={`translate(${8 + x * 184} 20)`}>
          <rect x="-12" y="-7" width="24" height="14" rx="4" fill="#3a6f92" stroke="#203848" />
          <path d="M-5 0 L-1 -3 L-1 3 Z M5 0 L1 -3 L1 3 Z" fill="#f8f8f8" />
        </g>
        <text x="8" y="11" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#203040">
          {label}
        </text>
      </svg>
    </div>
  )
}

/** Where your hand holds the wire. Moving it is a deliberate act, never a side effect of a drag. */
function GripButtons({ run, upd, feel, tailName }: Pick<Stage, 'run' | 'upd' | 'feel'> & { tailName: string }) {
  const skinFree = !run.sleeve || run.sleeve.front > SKIN_GRIP_CM + 0.4
  const tailOk = tailFree(run.inside, run.sleeve)
  return (
    <div className="io-choices mt-2">
      <button
        type="button"
        className="tap io-mini"
        data-on={run.grip === 'skin' || undefined}
        data-testid="cvc-grip-skin"
        disabled={run.grip === 'skin' || !skinFree}
        onClick={() => {
          upd({ grip: 'skin' })
          sfx.cursor()
          feel('You pinch the wire where it leaves the skin.')
        }}
      >
        {run.grip === 'skin' ? 'HOLDING AT THE SKIN ✓' : 'HOLD THE WIRE AT THE SKIN'}
      </button>
      <button
        type="button"
        className="tap io-mini"
        data-on={run.grip === 'tail' || undefined}
        data-testid="cvc-grip-tail"
        disabled={run.grip === 'tail' || !tailOk}
        onClick={() => {
          const hub = Boolean(run.sleeve && run.sleeve.kind === 'catheter' && run.sleeve.front > 0)
          upd((c) => ({ grip: 'tail', hubGrip: c.hubGrip || hub }))
          sfx.cursor()
          feel(hub ? 'The wire comes out of the brown hub: you hold it there. Now the catheter can go in.' : `You hold the wire where it comes out of the back of the ${tailName}.`)
        }}
      >
        {run.grip === 'tail' ? `HOLDING ${tailName === 'catheter' ? 'AT THE BROWN HUB' : 'THE TAIL'} ✓` : tailOk ? `HOLD THE WIRE ${tailName === 'catheter' ? 'AT THE BROWN HUB' : 'AT ITS TAIL'}` : `WIRE STILL INSIDE THE ${tailName.toUpperCase()}`}
      </button>
    </div>
  )
}

/* ================================================================ 1. position */

function PositionStage({ run, upd, feel, why, next }: Stage) {
  const bed = useRef<SVGSVGElement>(null)
  const head = useRef<SVGSVGElement>(null)
  return (
    <>
      <p className="io-lede">Drag the head end of the bed down: head-down fills the vein. Then drag her nose to turn her head a little to the left.</p>
      <TouchPad
        svg={bed}
        aspect="200 / 110"
        testId="cvc-tilt"
        onMove={(p) => {
          if (p.x > 96) return
          upd({ tilt: Math.round(clamp((Math.atan2(p.y - 60, 100 - p.x) * 180) / Math.PI, -10, 25)) })
        }}
        onUp={() => {
          const t = run.tilt
          if (t >= TILT_OK.min && t <= TILT_OK.max) feel(`${t}° head-down: the neck veins fill, and air cannot be drawn in.`)
          else if (t > TILT_OK.max) why(`${t}° is steeper than you need: ${TILT_OK.min}–${TILT_OK.max}° is enough, and he is ventilated.`)
          else why('Not head-down enough: the vein stays small and air can be sucked in through an open needle.')
        }}
      >
        <BedSide tilt={run.tilt} svgRef={bed} />
      </TouchPad>
      <div className="mx-auto mt-2 max-w-[200px]">
        <TouchPad
          svg={head}
          aspect="1 / 1"
          testId="cvc-rotate"
          onMove={(p) => upd({ rotation: Math.round(clamp((Math.asin(clamp((p.x - 50) / 26, -1, 1)) * 180) / Math.PI, 0, 90)) })}
          onUp={() => {
            const a = run.rotation
            if (a <= ROTATION_MAX && a >= 10) feel(`Turned ${a}° to the left: the right neck is open, the vein still lateral to the carotid.`)
            else if (a > ROTATION_MAX) why(`At ${a}° the vein rolls over the carotid: a needle through its back wall would find the artery. Turn it only slightly.`)
            else feel('Head straight. A slight turn to the left opens up the right neck.')
          }}
        >
          <HeadTop rotation={run.rotation} svgRef={head} />
        </TouchPad>
      </div>
      <NextButton onClick={next} testId="cvc-next">
        Pre-scan
      </NextButton>
    </>
  )
}

/* ================================================================ 2. pre-scan */

function usPoint(screen: Pt, probeX: number) {
  return { x: probeX - (screen.x - US.w / 2) / US.mm, z: screen.y / US.mm }
}

function ScanStage({ run, runRef, upd, feel, why, next, shared }: Stage) {
  const neck = useRef<SVGSVGElement>(null)
  const us = useRef<SVGSVGElement>(null)
  const [probe, setProbe] = useState<Pt | null>(null)
  const [press, setPress] = useState(0)
  const pressing = useRef(false)
  const [doppler, setDoppler] = useState(false)
  const [labels, setLabels] = useState<{ x: number; y: number; text: string }[]>([])
  const level = probe ? levelAt(probe.y) : null
  const probeX = probe ? offsetMm(probe) : 0
  useTicker(press > 0 || pressing.current, (dt) => {
    setPress((p) => {
      const np = clamp(p + (pressing.current ? dt * 1.6 : -dt * 2.5), 0, 1)
      if (np >= 0.85 && level === 'apex' && Math.abs(probeX) <= 4 && !runRef.current.pressedFlat) {
        upd({ pressedFlat: true })
        feel('The vein squashes flat under gentle pressure and springs back as you ease off. The carotid stays round and pulsing.')
      }
      return np
    })
  })
  return (
    <>
      <p className="io-lede">Pre-scan before you scrub. Drag the probe across the neck, transverse, marker to your left. Centre the vein. Press to compress it; tap the vein and the artery to name them.</p>
      <TouchPad
        svg={neck}
        aspect="200 / 150"
        testId="cvc-scan"
        onDown={(p) => setProbe(p)}
        onMove={(p) => setProbe(p)}
        onUp={(p) => {
          if (!p) return
          const lv = levelAt(p.y)
          const off = offsetMm(p)
          shared.current.probe = p
          upd({ scanLevel: lv, scanOffset: off })
          if (lv === 'low') why('Down by the clavicle the pleura is close under the vein. Go up to the apex of the triangle, at the cricoid.')
          else if (lv === 'high') why('Up by the jaw the vein is smaller and the carotid divides. Come down to the cricoid.')
          else if (Math.abs(off) > 3) feel(`The vein sits ${Math.abs(off).toFixed(0)} mm ${off > 0 ? 'to the right of' : 'to the left of'} the centre of the screen. Slide to centre it.`)
          else feel('The vein is centred: under the apex of the triangle, at the level of the cricoid.')
        }}
      >
        <NeckView svgRef={neck} probe={probe} hands />
      </TouchPad>
      <TouchPad
        svg={us}
        aspect="240 / 160"
        className="mt-2"
        testId="cvc-us-scan"
        onDown={(p) => {
          if (!probe) return feel('No image: put the probe on the neck.')
          const at = usPoint(p, probeX)
          const v = veinShape(run.tilt, press)
          const a = arteryAt(run.rotation)
          const inV = ((at.x - v.x) / (v.rx + 1)) ** 2 + ((at.z - v.z) / (v.rz + 1)) ** 2 <= 1
          const inA = Math.hypot(at.x - a.x, at.z - a.z) <= a.r + 1
          if (!inV && !inA) return feel('Muscle and speckle. Nothing to name there.')
          const name = inA ? 'artery' : 'vein'
          sfx.cursor()
          setLabels((l) => (l.some((x) => x.text === (inA ? 'CAROTID' : 'IJV')) ? l : [...l, { x: p.x, y: p.y, text: inA ? 'CAROTID' : 'IJV' }]))
          upd((c) => ({ named: toggle(c.named, name) }))
          feel(inA ? 'Round, thick-walled, pulsing, does not squash: the common carotid, medial.' : 'Larger, oval, thin-walled, lateral, and it squashes when you press: the internal jugular vein.')
        }}
      >
        <UsScreen svgRef={us} on={Boolean(probe)} level={level} probeX={probeX} tilt={run.tilt} rotation={run.rotation} press={press} doppler={doppler} labels={labels} />
      </TouchPad>
      <div className="io-choices mt-2">
        <HoldButton
          testId="cvc-press"
          className="io-mini"
          disabled={!probe}
          onStart={() => {
            pressing.current = true
            setPress((p) => p + 0.01)
          }}
          onEnd={() => (pressing.current = false)}
          onTick={() => undefined}
        >
          HOLD: PRESS DOWN
        </HoldButton>
        <button type="button" className="tap io-mini" data-on={doppler || undefined} data-testid="cvc-doppler" onClick={() => (setDoppler(!doppler), feel(doppler ? 'Doppler off.' : 'Colour Doppler: pulsatile flow in the carotid, steady blue in the vein.'))}>
          COLOUR DOPPLER
        </button>
      </div>
      {run.rotation > ROTATION_MAX && probe && <p className="io-small">The vein lies {Math.round(overlap(run.tilt, run.rotation) * 100)}% over the carotid with her head turned this far.</p>}
      <NextButton onClick={next} testId="cvc-next">
        Scrub
      </NextButton>
    </>
  )
}

/* ================================================================ 3. scrub */

function ScrubStage({ run, upd, feel, why, next }: Stage) {
  const anim = usePlay(1600)
  const [busy, setBusy] = useState<Garb | null>(null)
  return (
    <>
      <p className="io-lede">Full barrier precautions. Put each on, in the order you would in theatre.</p>
      <div className="mx-auto max-w-[220px] aspect-[100/110]">
        <Operator garb={run.garb} scrubbing={busy === 'scrub' && anim.playing} />
      </div>
      <div className="io-choices mt-2">
        {GARB.map((g) => {
          const on = run.garb.includes(g.id)
          return (
            <button
              key={g.id}
              type="button"
              className="tap io-mini"
              data-on={on || undefined}
              data-testid={`cvc-garb-${g.id}`}
              disabled={on || anim.playing}
              onClick={() => {
                setBusy(g.id)
                anim.play(() => setBusy(null))
                const cur = [...run.garb, g.id]
                upd({ garb: cur })
                feel(g.line)
                const at = (x: Garb) => cur.indexOf(x)
                if (g.id === 'scrub' && (at('cap') < 0 || at('mask') < 0)) why('Cap and mask go on before you scrub: once your hands are clean they touch nothing else.')
                if (g.id === 'gown' && at('scrub') < 0) why('Scrub your hands before the gown.')
                if (g.id === 'gloves' && at('gown') < 0) why('Gown first: the glove cuffs go over the gown sleeves.')
              }}
            >
              {on ? `${g.label} ✓` : g.label}
            </button>
          )
        })}
      </div>
      <NextButton onClick={next} testId="cvc-next">
        Prep
      </NextButton>
    </>
  )
}

/* ================================================================ 4. prep and drape */

function PrepStage({ run, upd, feel, why, physical, next }: Stage) {
  const neck = useRef<SVGSVGElement>(null)
  const body = useRef<SVGSVGElement>(null)
  const rub = useRub({ cx: 96, cy: 74, rx: 72, ry: 54 }, 9)
  const last = useRef<Pt | null>(null)
  const dir = useRef(0)
  const [sponge, setSponge] = useState<Pt | null>(null)
  const scrubbing = useRef(false)
  const startedDrape = useRef(false)
  const dryNow = run.strokes > 0 && !scrubbing.current
  useTicker(dryNow && run.drySec < DRY_SECONDS, (dt) => {
    const d = Math.min(DRY_SECONDS, run.drySec + dt * 6)
    upd({ drySec: d })
    if (d >= DRY_SECONDS) feel('The chlorhexidine has dried: the skin is matt again. Now it works.')
  })
  const wet = run.strokes > 0 ? 1 - run.drySec / DRY_SECONDS : 0
  return (
    <>
      <p className="io-lede">Scrub 2% chlorhexidine in 70% alcohol back and forth over the whole neck and upper chest for 30 s. Let it dry. Then pull the full-length drape down from head to foot.</p>
      <TouchPad
        svg={neck}
        aspect="200 / 150"
        testId="cvc-prep"
        onDown={(p) => {
          scrubbing.current = true
          last.current = p
          setSponge(p)
        }}
        onMove={(p) => {
          setSponge(p)
          const prev = last.current
          // The sponge wipes everything between two samples of the finger.
          const n = prev ? Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / 5) : 1
          for (let i = 1; i <= n; i++) rub.rub(prev ? { x: prev.x + ((p.x - prev.x) * i) / n, y: prev.y + ((p.y - prev.y) * i) / n } : p)
          last.current = p
          if (!prev) return
          const dx = p.x - prev.x
          if (Math.abs(dx) < 2) return
          const sign = Math.sign(dx)
          if (dir.current !== 0 && sign !== dir.current) upd((c) => ({ strokes: c.strokes + 1, drySec: 0 }))
          dir.current = sign
          upd({ prepCoverage: rub.coverage, drySec: 0 })
        }}
        onUp={() => {
          scrubbing.current = false
          setSponge(null)
          upd({ prepCoverage: rub.coverage })
          if (run.strokes >= STROKES_NEEDED && rub.coverage >= 0.8) feel('Scrubbed for 30 seconds, friction back and forth, the whole field. Now leave it to dry.')
          else if (rub.coverage < 0.8) why('Cover the whole field: the neck from the jaw to the clavicle, out to the shoulder.')
          else why(`Keep going: back-and-forth friction for 30 seconds (${run.strokes}/${STROKES_NEEDED} strokes).`)
        }}
      >
        <NeckView svgRef={neck} hands={false} wet={wet} prepTint={<RubTint rub={rub} colour="#e89838" />}>
          {sponge && (
            <g pointerEvents="none">
              <rect x={sponge.x - 10} y={sponge.y - 7} width="20" height="14" rx="3" fill="#f0d8a0" stroke="#a08040" />
              <rect x={sponge.x - 3} y={sponge.y + 7} width="6" height="24" fill="#f4f4f4" stroke="#909090" />
            </g>
          )}
        </NeckView>
      </TouchPad>
      <p className="io-small">
        {run.strokes}/{STROKES_NEEDED} strokes · {Math.round(rub.coverage * 100)}% · {run.strokes === 0 ? 'not started' : wet > 0 ? `wet, drying ${Math.round(run.drySec)}/${DRY_SECONDS} s` : 'dry'}
      </p>
      <div className="mx-auto mt-2 max-w-[150px] aspect-[100/170]">
        <TouchPad
          svg={body}
          aspect="100 / 170"
          testId="cvc-drape"
          onDown={() => {
            if (startedDrape.current) return
            startedDrape.current = true
            if (run.strokes > 0 && run.drySec < DRY_SECONDS) {
              upd({ drapedWet: true })
              physical('The drape sticks to the wet chlorhexidine.')
              why('Alcohol-based chlorhexidine works as it dries: drape only once it is dry.')
            }
          }}
          onMove={(p) => upd((c) => ({ draped: Math.max(c.draped, clamp((p.y - 6) / 150, 0, 1)) }))}
          onUp={() => {
            if (run.draped >= 0.95) feel('A full-length sterile drape from head to foot, its window over the right neck.')
            else why('All the way to the feet: a full-length drape, not a towel.')
          }}
        >
          <BodyDrape svgRef={body} draped={run.draped} />
        </TouchPad>
      </div>
      <NextButton onClick={next} testId="cvc-next">
        Kit
      </NextButton>
    </>
  )
}

/* ================================================================ 5. kit */

function KitStage({ run, upd, feel, why, next }: Stage) {
  const tray = useRef<SVGSVGElement>(null)
  const sheath = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<Lumen | null>(null)
  const [fill, setFill] = useState(0)
  const [syringe, setSyringe] = useState(10)
  const [slid, setSlid] = useState(run.probeCover ? 1 : 0)
  const [gel, setGel] = useState(run.probeCover)
  return (
    <>
      <p className="io-lede">Tap a lumen and push saline through it until it drips from the tip. Clamp the blue and the white; leave the brown open: the wire comes out through it. Then gel, and sheathe the probe.</p>
      <TouchPad
        svg={tray}
        aspect="200 / 110"
        testId="cvc-kit"
        onDown={(p) => {
          const i = LUMENS.findIndex((_, k) => Math.abs(p.y - (26 + k * 30)) < 12)
          if (i < 0) return
          const l = LUMENS[i].id
          if (p.x > 104 && p.x < 128 && l !== 'distal') {
            if (!run.flushed.includes(l)) return why('Flush it first, then clamp it full of saline.')
            upd((c) => ({ clamped: toggle(c.clamped, l) }))
            sfx.cursor()
            return feel(`The ${LUMENS[i].name} line clamped, full of saline.`)
          }
          setActive(l)
          setFill(run.flushed.includes(l) ? 1 : 0)
          sfx.cursor()
        }}
      >
        <LumenTray svgRef={tray} flushed={run.flushed} clamped={run.clamped} active={active} fill={fill} />
      </TouchPad>
      <Syringe
        capacity={10}
        drug={syringe}
        drugLabel="saline"
        disabled={!active}
        testId="cvc-flush"
        onPull={() => ({ kind: 'none' })}
        onInject={(ml) => {
          if (!active) return false
          setSyringe((s) => Math.max(0, s - ml))
          setFill((f) => {
            const nf = Math.min(1, f + ml / 1.5)
            if (nf >= 1 && !run.flushed.includes(active)) {
              upd((c) => ({ flushed: toggle(c.flushed, active) }))
              feel(`Saline runs out of the tip: the ${LUMENS.find((l) => l.id === active)?.name} lumen is flushed, no air in it.`)
            }
            return nf
          })
          return true
        }}
        onRelease={() => syringe < 2 && setSyringe(10)}
      />
      <p className="io-small mt-2">Probe: gel into the sheath, then slide the probe in.</p>
      <TouchPad
        svg={sheath}
        aspect="200 / 60"
        testId="cvc-sheath"
        onDown={(p) => {
          if (!gel && p.x > 110) {
            setGel(true)
            feel('A blob of sterile gel squeezed into the sheath.')
          }
        }}
        onMove={(p) => {
          if (!gel) return
          const s = clamp((p.x - 30) / 120, 0, 1)
          setSlid((v) => Math.max(v, s))
          if (s >= 0.95 && !run.probeCover) {
            upd({ probeCover: true })
            feel('The nurse holds the sheath open; the probe slides into the gel, the sheath unrolled down the cable and banded. Sterile gel on the outside.')
          }
        }}
      >
        <svg ref={sheath} viewBox="0 0 200 60" className="block h-full w-full select-none">
          <rect width="200" height="60" fill="#4f8fb8" />
          <rect x="100" y="16" width="94" height="28" rx="6" fill="#e8f4fa" opacity="0.55" stroke="#90a8b8" />
          {gel && <ellipse cx="186" cy="30" rx="6" ry="8" fill="#bfe8ff" opacity="0.9" />}
          <g transform={`translate(${30 + slid * 120} 30)`}>
            <path d="M-60 0 L-8 0" stroke="#202830" strokeWidth="3" />
            <rect x="-8" y="-9" width="40" height="18" rx="5" fill="#3a4250" stroke="#181c24" />
            <circle cx="28" cy="-6" r="1.6" fill="#f0c040" />
          </g>
          {slid >= 0.95 && <rect x="104" y="14" width="10" height="32" fill="#5aa8e0" opacity="0.8" />}
          <text x="4" y="10" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#f8f8f8">
            {gel ? 'DRAG THE PROBE IN →' : 'TAP THE SHEATH FOR GEL'}
          </text>
        </svg>
      </TouchPad>
      <NextButton onClick={next} testId="cvc-next">
        Needle
      </NextButton>
    </>
  )
}

/* ================================================================ 6. local and needle */

function NeedleStage({ run, runRef, upd, feel, why, physical, next, shared }: Stage) {
  const neck = useRef<SVGSVGElement>(null)
  const us = useRef<SVGSVGElement>(null)
  const [probe, setProbe] = useState<Pt>(shared.current.probe)
  const [entryPt, setEntryPt] = useState<Pt | null>(null)
  const grab = useRef<{ what: 'probe' | 'needle'; y: number; x: number } | null>(null)
  const [cut, setCut] = useState(false)
  const said = useRef<Set<string>>(new Set())
  const once = (k: string, f: () => void) => {
    if (said.current.has(k)) return
    said.current.add(k)
    f()
  }
  const numbed = run.lidocaine >= 2
  // The needle goes in 1 cm toward you from the probe, so at 45° it meets the beam at 1 cm deep.
  const entry = run.depth > 0 && entryPt ? entryPt : { x: probe.x, y: probe.y + run.beam * NECK.scale }
  const probeX = offsetMm(probe)

  function moveTo(depth: number) {
    const cur = runRef.current
    const before = cur.where
    const { patch, event } = moveNeedle(cur, depth, offsetMm(probe))
    if (cur.depth <= 0 && (patch.depth ?? 0) > 0) setEntryPt({ x: probe.x, y: probe.y + cur.beam * NECK.scale })
    upd(patch)
    const now = runRef.current
    if (event === 'tent')
      once(`tent${now.passes}`, () =>
        Math.abs(tipOf(now.depth).y - now.beam) <= 3 ? feel('On the screen the front wall of the vein dents under the dot: tenting. A little further.') : feel('A little resistance at the tip, but the dot is not on the screen. Find the tip before you go on.'),
      )
    if (event === 'pop') {
      if (now.aspirating) feel('A give, and dark, non-pulsatile blood fills the syringe. The tip is in the vein. Stop. Hold it still.')
      else {
        feel('A give: the dent springs back.')
        why('No flash because you were not aspirating. Pull back on the plunger all the way in, or you will not know when you are in.')
      }
    }
    if (event === 'artery') {
      buzz([60, 40, 60])
      physical('Bright red blood pulses into the syringe on its own: the carotid. Do not pass a wire. Out, and press for 10 minutes.')
    }
    if (event === 'through') {
      buzz(40)
      physical('The flash stops: the tip has gone out through the back wall.')
      why('Withdraw slowly, aspirating, until the flash comes back. Track the tip so it never happens.')
    }
    if (event === 'deep') once('deep', () => physical('Deep and still nothing: stop. Withdraw to the skin and re-aim under ultrasound.'))
    if (event === 'out' && before !== 'outside') feel('Out of the skin.')
    if (now.depth > 0 && now.blindMm > 3) once(`blind${now.passes}`, () => why('You are pushing past the beam: the dot on the screen is the shaft, not the tip. Slide the probe on until the dot vanishes, then advance until it just comes back.'))
  }

  const dot = needleInBeam(run.depth, run.beam)
  const tip = tipOf(run.depth)
  return (
    <>
      <p className="io-lede">
        {!numbed
          ? 'Numb the skin first: push lidocaine at the needle entry, 1 cm toward you from the probe.'
          : 'Pull back on the plunger. Drag the syringe toward the probe to advance; drag the probe toward the chest to follow the tip. Advance only until the dot comes back; then slide on.'}
      </p>
      <TouchPad
        svg={neck}
        aspect="200 / 150"
        testId="cvc-needle"
        onDown={(p) => {
          const nearProbe = Math.abs(p.y - probe.y) < 14 && Math.abs(p.x - probe.x) < 42
          grab.current = { what: nearProbe ? 'probe' : 'needle', y: p.y, x: p.x }
        }}
        onMove={(p) => {
          const g = grab.current
          if (!g) return
          if (g.what === 'probe') {
            // Before the needle is in, the probe and the entry move together; after, only the probe slides.
            const np = run.depth > 0 && entryPt ? { x: clamp(probe.x + (p.x - g.x), 30, 160), y: clamp(p.y, entryPt.y - 80, entryPt.y - 6) } : { x: clamp(p.x, 30, 160), y: clamp(p.y, 40, 112) }
            g.x = p.x
            setProbe(np)
            shared.current.probe = np
            if (run.depth > 0 && entryPt) upd({ beam: (entryPt.y - np.y) / NECK.scale })
            return
          }
          if (!numbed) return
          const dy = g.y - p.y
          g.y = p.y
          moveTo(runRef.current.depth + dy * 0.55)
        }}
        onUp={() => (grab.current = null)}
      >
        <NeckView
          svgRef={neck}
          probe={probe}
          sheathed
          draped
          hands
          wheal={run.lidocaine > 0 ? { x: entry.x, y: entry.y, size: Math.min(1, run.lidocaine / 3) } : null}
          needle={numbed ? { at: entry, depth: run.depth, flash: run.flash, aspirating: run.aspirating } : null}
        />
      </TouchPad>
      <div className="io-figure mt-2 aspect-[240/160]">
        <UsScreen svgRef={us} on level={levelAt(probe.y)} probeX={probeX} tilt={run.tilt} rotation={run.rotation} needle={run.depth > 0 && run.entryX !== null ? { entryX: run.entryX, depth: run.depth, beam: run.beam, tent: run.tent } : null} />
      </div>
      {!numbed ? (
        <Syringe
          capacity={5}
          drug={Math.max(0, 5 - run.lidocaine)}
          drugLabel="1% lidocaine"
          testId="cvc-lidocaine"
          onPull={() => ({ kind: 'none' })}
          onInject={(ml) => {
            upd((c) => ({ lidocaine: c.lidocaine + ml }))
            return true
          }}
          onRelease={() => {
            const ml = runRef.current.lidocaine
            if (ml >= 2) feel(`A wheal of ${ml.toFixed(0)} mL 1% lidocaine raised at the entry and along the track, aspirating before each push.`)
          }}
        />
      ) : (
        <div className="io-choices mt-2">
          <button
            type="button"
            className="tap io-mini"
            data-on={run.aspirating || undefined}
            data-testid="cvc-aspirate"
            onClick={() => {
              const on = !run.aspirating
              upd({ aspirating: on })
              if (on && runRef.current.where === 'vein') upd({ flash: 'dark' })
              feel(on ? 'Plunger drawn back a little: negative pressure all the way in.' : 'Plunger let go.')
            }}
          >
            {run.aspirating ? 'ASPIRATING ✓' : 'PULL BACK ON THE PLUNGER'}
          </button>
          <button type="button" className="tap io-mini" data-on={cut || undefined} data-testid="cvc-cutaway" onClick={() => setCut(!cut)}>
            {cut ? 'HIDE THE CUT-AWAY' : 'SHOW DR HUNG A CUT-AWAY'}
          </button>
        </div>
      )}
      {cut && numbed && <TrackCut depth={run.depth} beam={run.beam} entryX={run.entryX ?? probeX} tilt={run.tilt} rotation={run.rotation} />}
      <p className="io-small">
        {run.depth > 0 ? `Needle ${(run.depth / 10).toFixed(1)} cm in · beam ${(run.beam / 10).toFixed(1)} cm on · ${dot ? (dot.isTip ? 'you see the tip' : 'you see the shaft') : 'tip short of the beam'}` : 'Needle at the skin'}
        {run.depth > 0 && tip.y > run.beam + 6 ? ' · far past the beam' : ''}
      </p>
      <NextButton onClick={next} testId="cvc-next">
        Wire
      </NextButton>
    </>
  )
}

/** For the junior: the neck cut along the needle, the beam as a line, so you see why the dot may not be the tip. */
function TrackCut({ depth, beam, entryX, tilt, rotation }: { depth: number; beam: number; entryX: number; tilt: number; rotation: number }) {
  const k = 3
  const v = veinShape(tilt)
  const h = Math.abs(entryX) < v.rx ? v.rz * Math.sqrt(1 - (entryX / v.rx) ** 2) : 0
  const a = arteryAt(rotation)
  const hitsArtery = Math.abs(entryX - a.x) < a.r
  const tip = tipOf(depth)
  return (
    <div className="io-figure mt-2 aspect-[200/90]">
      <svg viewBox="0 0 200 90" className="block h-full w-full" data-testid="cvc-cutaway-view">
        <rect width="200" height="90" fill="#e8c8b0" />
        <rect width="200" height="8" fill="#d8e4ec" />
        <rect y="8" width="200" height="1.6" fill="#9a7258" />
        {h > 0 && <rect x="0" y={8 + (v.z - h) * k} width="200" height={2 * h * k} fill="#4a5ca8" opacity="0.8" />}
        {hitsArtery && <rect x="0" y={8 + (a.z - a.r) * k} width="200" height={2 * a.r * k} fill="#c83030" opacity="0.7" />}
        <line x1={30 + beam * k} y1="0" x2={30 + beam * k} y2="90" stroke="#f8d030" strokeDasharray="3 2" />
        <line x1={30} y1={8} x2={30 + tip.y * k} y2={8 + tip.z * k} stroke="#808890" strokeWidth="2" />
        <circle cx={30 + tip.y * k} cy={8 + tip.z * k} r="2" fill="#202020" />
        <text x="4" y="6" fontFamily="Press Start 2P, monospace" fontSize="4.5" fill="#506070">
          CUT ALONG THE NEEDLE · BEAM ┊
        </text>
      </svg>
    </div>
  )
}

/* ================================================================ 7. wire */

function WireStage({ run, runRef, upd, feel, why, physical, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const unscrew = useSpin('ccw')
  const feed = useRef<number | null>(null)
  const grab = useRef<{ x: number; y: number } | null>(null)
  const [advancer, setAdvancer] = useState(run.wireCm > 0)
  const [needleAt, setNeedleAt] = useState<number | null>(run.needleOut ? null : run.depth)
  const lost = useRef(false)

  useEffect(() => {
    if (run.syringeOff || unscrew.turns < 0.05) return
    if (!run.steadied && !lost.current) {
      lost.current = true
      const { patch } = moveNeedle(runRef.current, Math.max(1, runRef.current.depth - 9), runRef.current.entryX ?? 0)
      upd({ ...patch, aspirating: false })
      setNeedleAt(runRef.current.depth)
      physical('Twisting without a hand on the needle pulls it back: no blood comes. The tip has slipped out of the vein.')
      why('Anchor the needle with your other hand, resting on her neck, before you take the syringe off.')
    }
    if (unscrew.turns >= 1) {
      upd({ syringeOff: true })
      const w = runRef.current.where
      if (w === 'vein') feel('The syringe is off: dark blood drips steadily from the hub, not pulsing. Venous. Thumb over the hub.')
      else if (w === 'artery') physical('Bright blood spurts from the hub in time with the pulse: arterial.')
      else feel('The syringe is off. Nothing drips back.')
    }
  }, [unscrew.turns])

  useTicker(run.syringeOff && !run.thumb && !advancer, (dt) => {
    upd((c) => ({ openSec: c.openSec + dt }))
    if (runRef.current.openSec > 3) why('The hub has been open to air for seconds. Thumb over it while you get the wire.')
  })

  const ready = run.syringeOff && advancer
  const cmLabel = run.needleOut ? `${run.inside.toFixed(0)} CM INSIDE` : `${run.wireCm.toFixed(0)} CM AT THE HUB`
  return (
    <>
      <p className="io-lede">
        {!run.syringeOff
          ? 'Tap the needle hub to steady it with your left hand, resting on her neck. Then twist the syringe off.'
          : !advancer
            ? 'Thumb over the hub. Then put the wire advancer into the hub.'
            : !run.needleOut
              ? 'Feed the J-wire with your thumb: drag right along the advancer. Watch the monitor. Then take the wire at the skin and slide the needle out over it.'
              : 'Needle out, wire in, and your hand never left it.'}
      </p>
      <TouchPad
        svg={svg}
        aspect="200 / 150"
        testId="cvc-wire-field"
        onDown={(p) => {
          grab.current = p
          const hub = wirePoint((64 - (needleAt ?? 0)) / 10)
          if (!run.steadied && !run.needleOut && Math.hypot(p.x - SIDE.entry.x, p.y - SIDE.entry.y) < 40) {
            upd({ steadied: true, grip: 'needle' })
            sfx.cursor()
            return feel('Left hand on her neck, finger and thumb on the needle hub: it will not move.')
          }
          if (run.syringeOff && !run.thumb && !advancer && Math.hypot(p.x - hub.x, p.y - hub.y) < 20) {
            upd({ thumb: true })
            return feel('Thumb over the hub: no air in, no blood out.')
          }
          const skin = wirePoint(SKIN_GRIP_CM)
          if (run.wireCm > 0 && Math.hypot(p.x - skin.x, p.y - skin.y) < 14 && run.grip !== 'skin') {
            upd({ grip: 'skin' })
            sfx.cursor()
            return feel(run.needleOut ? 'You pinch the wire where it leaves the skin.' : 'Your left hand moves from the needle to the wire just above the skin, pinching it.')
          }
        }}
        onMove={(p) => {
          const g = grab.current
          if (!g || run.wireCm <= 0 || run.needleOut || needleAt === null) return
          // Drag the needle back along its track, up and to the left.
          const along = (g.x - p.x + (g.y - p.y)) * Math.SQRT1_2
          if (along < 4) return
          const nd = Math.max(0, (needleAt ?? 0) - along * 0.8)
          setNeedleAt(nd)
          g.x = p.x
          g.y = p.y
          if (nd <= 0) {
            const cur = runRef.current
            const patch: Partial<CvcRun> = { needleOut: true, inside: insideAfterNeedle(cur) }
            if (cur.grip !== 'skin') {
              patch.letGo = cur.letGo + 1
              patch.inside = (patch.inside ?? 0) + 3
              patch.grip = 'none'
              buzz([60, 40, 60])
              physical('Nothing held the wire as the needle came off it: it slid 3 cm further in.')
              why('Pinch the wire at the skin before the needle clears it. Never let go of the wire.')
            } else feel('The needle slides off the end of the wire. The wire stays, held at the skin.')
            setNeedleAt(null)
            upd(patch)
          }
        }}
        onUp={() => (grab.current = null)}
      >
        <SideView
          svgRef={svg}
          needle={needleAt}
          syringe={run.syringeOff ? 'off' : unscrew.turns > 0.05 ? 'turning' : 'on'}
          turn={unscrew.turns}
          flash={run.flash}
          thumb={run.thumb && !advancer}
          steadied={run.steadied && run.grip === 'needle' && !run.needleOut}
          advancer={advancer && !run.needleOut}
          wireCm={run.wireCm}
          inside={run.inside}
          grip={run.needleOut || run.grip === 'skin' ? run.grip : undefined}
        />
      </TouchPad>
      {run.wireCm > 0 && (
        <div className="io-figure mt-2 aspect-[200/40]">
          <EcgStrip ectopy={run.wireCm > ECTOPY_CM && run.wireIn === 'vein' && !run.needleOut} />
        </div>
      )}
      <div className="io-choices mt-2">
        {!run.syringeOff && (
          <div className="flex items-center gap-2">
            <Dial label="TWIST OFF ↺" spin={unscrew} />
          </div>
        )}
        {run.syringeOff && !advancer && (
          <button
            type="button"
            className="tap io-mini"
            data-testid="cvc-advancer"
            onClick={() => {
              setAdvancer(true)
              feel('The advancer straightens the J; its tip slides into the hub as your thumb lifts off.')
            }}
          >
            ADVANCER INTO THE HUB
          </button>
        )}
      </div>
      {ready && !run.needleOut && (
        <div
          className="io-figure mt-2 aspect-[200/34]"
          style={{ touchAction: 'none' }}
          data-testid="cvc-feed"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            feed.current = e.clientX
          }}
          onPointerMove={(e) => {
            if (feed.current === null) return
            const rect = e.currentTarget.getBoundingClientRect()
            const dcm = ((e.clientX - feed.current) / rect.width) * 10
            feed.current = e.clientX
            const cur = runRef.current
            const { patch, event } = feedWire(cur, cur.wireCm + dcm)
            upd(patch)
            if (event === 'resist') physical('Resistance. Do not force a wire: the tip is not in the lumen.')
            if (event === 'ectopy' && !cur.ectopy) {
              buzz(30)
              physical('Ectopics on the monitor: the J tip is in the right atrium. Pull the wire back a few centimetres.')
            }
          }}
          onPointerUp={() => {
            feed.current = null
            const c = runRef.current
            if (c.wireCm >= 12 && c.wireCm <= 20) feel(`Wire at ${c.wireCm.toFixed(0)} cm at the hub: smooth, no resistance, sinus rhythm.`)
          }}
        >
          <svg viewBox="0 0 200 34" className="block h-full w-full select-none">
            <rect width="200" height="34" fill="#e8f0f6" />
            <rect x="10" y="12" width="180" height="10" rx="5" fill="#5aa8e0" stroke="#2a6890" />
            <line x1="10" y1="17" x2={10 + Math.min(180, (run.wireCm / 30) * 180)} y2="17" stroke="#f4f4f4" strokeWidth="2" />
            <g transform={`translate(${20 + ((run.wireCm * 7) % 160)} 6)`}>
              <Glove x={0} y={8} angle={90} scale={0.45} />
            </g>
            <text x="12" y="9" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#203040">
              FEED → · ← BACK · {cmLabel}
            </text>
          </svg>
        </div>
      )}
      <NextButton onClick={next} testId="cvc-next">
        Confirm
      </NextButton>
    </>
  )
}

/* ================================================================ 8. confirm the wire */

function ConfirmStage({ run, upd, feel, physical, next, shared }: Stage) {
  const us = useRef<SVGSVGElement>(null)
  const [long, setLong] = useState(false)
  const turning = usePlay(700)
  const probe = shared.current.probe
  const probeX = clamp(offsetMm(probe), -3, 3)
  return (
    <>
      <p className="io-lede">Before anything goes over the wire: find it on ultrasound. Tap it in the short axis; then turn the probe along the vein and tap it again.</p>
      <TouchPad
        svg={us}
        aspect="240 / 160"
        testId="cvc-confirm"
        onDown={(p) => {
          if (!run.wireIn) return feel('No wire to see.')
          if (long) {
            if (p.y > 40 && p.y < 140) {
              upd({ seenLong: true })
              feel(run.wireIn === 'vein' ? 'Long axis: a bright line entering the vein and running down it toward the chest. It is in the IJV.' : 'Long axis: no wire runs in the vein.')
            }
            return
          }
          const v = veinShape(run.tilt)
          const a = arteryAt(run.rotation)
          const sx = (mm: number) => US.w / 2 - (mm - probeX) * US.mm
          const at = run.wireIn === 'vein' ? { x: sx(v.x) + 4, y: (v.z + v.rz * 0.4) * US.mm } : { x: sx(a.x) + 2, y: (a.z + 1) * US.mm }
          if (Math.hypot(p.x - at.x, p.y - at.y) > 14) return feel('That is not the wire: look for a bright dot with a shadow under it, inside a vessel.')
          upd({ seenShort: true })
          if (run.wireIn === 'vein') feel('A bright dot with a shadow, inside the compressible vein, lateral to the carotid: the wire is in the IJV.')
          else {
            buzz([60, 40, 60])
            physical('The dot is inside the round, pulsing carotid. The wire is in the artery. Do not dilate.')
          }
        }}
      >
        <UsScreen svgRef={us} on probeX={probeX} tilt={run.tilt} rotation={run.rotation} long={long} wire={run.wireIn} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={long || undefined}
          data-testid="cvc-long"
          disabled={turning.playing}
          onClick={() => turning.play(() => setLong(!long))}
        >
          {turning.playing ? 'TURNING…' : long ? 'BACK TO SHORT AXIS' : 'TURN THE PROBE 90°: LONG AXIS'}
        </button>
      </div>
      {turning.playing && (
        <div className="io-figure mt-2 aspect-[200/60]">
          <svg viewBox="0 0 200 60" className="block h-full w-full">
            <rect width="200" height="60" fill="#4f8fb8" />
            <g transform={`translate(100 30) rotate(${(long ? 1 - (turning.t ?? 0) : turning.t ?? 0) * 90})`}>
              <rect x="-30" y="-7" width="60" height="14" rx="5" fill="#c8dce8" stroke="#90a8b8" />
              <circle cx="-26" cy="0" r="2" fill="#f0c040" />
            </g>
          </svg>
        </div>
      )}
      <p className="io-small">
        Short axis {run.seenShort ? '✓' : '·'} · Long axis {run.seenLong ? '✓' : '·'}
      </p>
      <NextButton onClick={next} testId="cvc-next">
        Dilate
      </NextButton>
    </>
  )
}

/* ================================================================ 9. nick and dilate */

function DilateStage({ run, runRef, upd, feel, why, physical, next }: Stage) {
  const nickSvg = useRef<SVGSVGElement>(null)
  const side = useRef<SVGSVGElement>(null)
  const spin = useSpin('cw')
  const lastTurns = useRef(0)
  const [stroke, setStroke] = useState<{ a: Pt; b: Pt } | null>(null)
  const [blade, setBlade] = useState<Pt | null>(null)
  const [ooze, setOoze] = useState(0)
  const grab = useRef<Pt | null>(null)
  const W = { x: 100, y: 46 }
  const sleeve = run.sleeve

  const lostOnce = useRef(false)
  function along(cm: number) {
    const cur = runRef.current
    if (!cur.sleeve) return
    const front = cur.sleeve.front + cm
    // Under the skin the dilator only goes in by twisting.
    if (cm < 0 && cur.sleeve.front <= 0) return
    const target = cm < 0 && cur.sleeve.front > 0 ? Math.max(0, front) : front
    const { patch, event } = slide(cur, target)
    if (cur.grip === 'none' && cm !== 0 && !lostOnce.current) {
      lostOnce.current = true
      patch.letGo = cur.letGo + 1
    }
    upd(patch)
    if (event === 'blocked-hand') feel('Your fingers at the skin are in the way. Take the wire where it comes out of the back of the dilator.')
    if (event === 'blocked-tail') feel('Your hand is on the tail. Hold the wire at the skin, then slide the dilator off.')
    if (event === 'off') {
      feel('Dilator off the wire. Gauze pressure on the site: it oozes.')
      setOoze(1)
    }
  }

  useEffect(() => {
    const dt = spin.turns - lastTurns.current
    lastTurns.current = spin.turns
    const cur = runRef.current
    if (!cur.sleeve || cur.sleeve.kind !== 'dilator' || dt <= 0) return
    if (cur.sleeve.front > 0.05) return feel('Bring the dilator down to the skin first.')
    const before = cur.dilatorMax
    const { patch } = slide(cur, cur.sleeve.front - dt * 0.8)
    upd(patch)
    const now = runRef.current
    if (before < DILATE_OK.min && now.dilatorMax >= DILATE_OK.min) {
      if (now.wireIn === 'artery') {
        buzz([80, 40, 80])
        physical('Pulsatile bleeding around the dilator: you have dilated the carotid. Leave it in, call the vascular surgeon.')
      } else feel('A give as it passes through the vein wall. That is deep enough: the vein is about 1.5 cm in.')
    }
    if (before <= DILATE_OK.max && now.dilatorMax > DILATE_OK.max) {
      physical('It keeps going, deep past the vein.')
      why('The dilator only needs to open the skin and the vein wall. Deeper, it tears the back wall or worse.')
    }
  }, [spin.turns])

  const nickDone = run.nick !== null
  return (
    <>
      <p className="io-lede">
        {!nickDone
          ? 'Nick the skin with the #11 blade: drag from the wire outward about 4 mm, the sharp edge away from the wire.'
          : !sleeve && !run.dilated
            ? 'Thread the dilator onto the wire.'
            : sleeve
              ? 'Drag it down the wire to the skin; take the tail when it comes out of the back. Twist it in through the skin, to the vein only. Then drag it back out and off.'
              : 'Press on the site with gauze while the catheter is made ready.'}
      </p>
      {!nickDone ? (
        <TouchPad
          svg={nickSvg}
          aspect="200 / 100"
          testId="cvc-nick"
          onDown={(p) => {
            grab.current = p
            setBlade(p)
          }}
          onMove={(p) => {
            setBlade(p)
            if (grab.current) setStroke({ a: grab.current, b: p })
          }}
          onUp={(p) => {
            const a = grab.current
            grab.current = null
            setBlade(null)
            if (!a || !p) return
            const len = Math.hypot(p.x - a.x, p.y - a.y) / 8
            if (len < 1) return
            const startD = Math.hypot(a.x - W.x, a.y - W.y) / 8
            // The cut crosses the wire if the wire lies between its two ends.
            const t = ((W.x - a.x) * (p.x - a.x) + (W.y - a.y) * (p.y - a.y)) / Math.max(1, (p.x - a.x) ** 2 + (p.y - a.y) ** 2)
            const closest = Math.hypot(a.x + t * (p.x - a.x) - W.x, a.y + t * (p.y - a.y) - W.y) / 8
            const crossed = t > 0.15 && t < 0.85 && closest < 0.8
            upd({ nick: { len, crossed } })
            setStroke({ a, b: p })
            if (crossed) {
              physical('The blade grates across the wire.')
              why('Start the blade at the wire and cut away from it, the sharp edge facing away. A nicked wire can shear.')
            } else if (startD > 2.5) why('Start the nick right where the wire enters the skin, or the dilator snags on an intact bridge of skin.')
            else if (len > 7) why(`A ${len.toFixed(0)} mm cut: bigger than needed. It will ooze around the line.`)
            else if (len < 2) why('Too small: the dilator will catch on the skin.')
            else feel(`A ${len.toFixed(0)} mm stab at the wire, the edge away from it. The wire is untouched.`)
          }}
        >
          <svg ref={nickSvg} viewBox="0 0 200 100" className="block h-full w-full select-none">
            <rect width="200" height="100" fill="#4f8fb8" />
            <ellipse cx="100" cy="50" rx="92" ry="46" fill="#e8cdb2" />
            <ellipse cx="100" cy="50" rx="92" ry="46" fill="#f0a040" opacity="0.12" />
            {/* the wire comes out of the skin and runs away toward you */}
            <line x1={W.x} y1={W.y} x2={W.x - 50} y2={W.y + 60} stroke="#f4f4f4" strokeWidth="2" />
            <circle cx={W.x} cy={W.y} r="2.4" fill="#a05040" />
            {stroke && <line x1={stroke.a.x} y1={stroke.a.y} x2={stroke.b.x} y2={stroke.b.y} stroke="#a01818" strokeWidth="2.2" />}
            {blade && (
              <g transform={`translate(${blade.x} ${blade.y}) rotate(${(Math.atan2(blade.y - W.y, blade.x - W.x) * 180) / Math.PI + 180})`}>
                <path d="M0 0 L12 -4 L18 -2 L18 1 Z" fill="#c8d0d8" stroke="#808890" strokeWidth="0.5" />
                <rect x="18" y="-1.8" width="30" height="3.6" rx="1" fill="#2a6890" />
              </g>
            )}
            <text x="4" y="8" fontFamily="Press Start 2P, monospace" fontSize="4.5" fill="#f8f8f8">
              FROM ABOVE · 8 = 1 MM
            </text>
          </svg>
        </TouchPad>
      ) : (
        <TouchPad
          svg={side}
          aspect="200 / 150"
          testId="cvc-dilate-field"
          onDown={(p) => {
            grab.current = p
            const cur = runRef.current
            const tail = wirePoint(tailAt(cur.inside))
            if (Math.hypot(p.x - tail.x, p.y - tail.y) < 22 && cur.grip !== 'tail' && tailFree(cur.inside, cur.sleeve)) {
              grab.current = null
              upd({ grip: 'tail' })
              sfx.cursor()
              return feel('You hold the wire where it comes out of the back of the dilator.')
            }
          }}
          onMove={(p) => {
            const g = grab.current
            if (!g) return
            // Down the wire toward the skin is down and to the right.
            const d = ((p.x - g.x + (p.y - g.y)) * Math.SQRT1_2) / 4
            if (Math.abs(d) < 0.2) return
            grab.current = p
            along(-d * (runRef.current.sleeve && runRef.current.sleeve.front > 15 ? 4.4 : 1))
          }}
          onUp={() => (grab.current = null)}
        >
          <SideView svgRef={side} needle={null} inside={run.inside} grip={run.grip} sleeve={sleeve} twist={spin.turns} ooze={ooze} gauze={run.gauze} nick={null} />
        </TouchPad>
      )}
      {nickDone && (
        <div className="io-choices mt-2">
          {!sleeve && !run.dilated && (
            <button
              type="button"
              className="tap io-mini"
              data-testid="cvc-thread-dilator"
              onClick={() => {
                upd({ sleeve: { kind: 'dilator', front: tailAt(run.inside) - 0.3 } })
                feel('The tapered tip of the dilator threaded onto the end of the wire.')
              }}
            >
              THREAD THE DILATOR
            </button>
          )}
          {sleeve?.kind === 'dilator' && sleeve.front <= 0.05 && <Dial label="TWIST IN ↻" spin={spin} />}
          {!sleeve && run.dilated && (
            <HoldButton
              testId="cvc-gauze"
              className="io-mini"
              onStart={() => upd({ gauze: true })}
              onEnd={() => upd({ gauze: false })}
              onTick={(dt) =>
                setOoze((o) => {
                  const n = Math.max(0, o - dt * 0.6)
                  if (o > 0 && n === 0) feel('The ooze has stopped.')
                  return n
                })
              }
            >
              HOLD: GAUZE PRESSURE
            </HoldButton>
          )}
        </div>
      )}
      {nickDone && sleeve?.kind === 'dilator' && (
        <>
          <SlidePad testId="cvc-dilator-pad" label={sleeve.front <= 0.05 ? '◀ DRAW IT BACK · TWIST TO GO IN' : '◀ BACK · DILATOR DOWN THE WIRE ▶'} cmPerWidth={sleeve.front > 15 ? 40 : 10} onDelta={(cm) => along(-cm)} />
          <GripButtons run={run} upd={upd} feel={feel} tailName="dilator" />
        </>
      )}
      {sleeve?.kind === 'dilator' && <p className="io-small">{sleeve.front < 0 ? `Dilator ${(-sleeve.front * 10).toFixed(0)} mm in along the track` : `Dilator tip ${sleeve.front.toFixed(0)} cm from the skin`}</p>}
      <NextButton onClick={next} testId="cvc-next">
        Catheter
      </NextButton>
    </>
  )
}

/* ================================================================ 10. catheter */

function CatheterStage({ run, runRef, upd, feel, why, physical, next }: Stage) {
  const side = useRef<SVGSVGElement>(null)
  const grab = useRef<Pt | null>(null)
  const pullGrab = useRef<number | null>(null)
  const sleeve = run.sleeve?.kind === 'catheter' ? run.sleeve : null
  const placed = sleeve !== null && sleeve.front < 0
  useEffect(() => {
    if (runRef.current.sleeve?.kind !== 'dilator') return
    upd({ sleeve: null, grip: 'skin' })
    feel('First the dilator comes off, the wire pinched at the skin.')
  }, [])

  function along(cm: number) {
    const cur = runRef.current
    if (!cur.sleeve) return
    const before = cur.sleeve.front
    const { patch, event } = slide(cur, before + cm)
    if (cur.grip === 'none') patch.letGo = cur.letGo + (before > 0 && before + cm <= 0 ? 1 : 0)
    upd(patch)
    const now = runRef.current
    if (event === 'blocked-hand') feel(tailFree(now.inside, now.sleeve) ? 'Your fingers at the skin block it. The wire is out of the brown hub: hold it there.' : 'Your fingers at the skin block it, and the wire is still inside the catheter. Feed the wire out of the brown hub first: pull it back at the skin.')
    if (event === 'skin') {
      if (cur.grip !== 'tail') physical('The catheter tip enters the skin with no hand on the wire.')
      else feel('The catheter follows the wire through the skin, a gentle twist as it goes.')
    }
    if (now.catheterCm > 18 && before > -18) physical('Ectopics: the tip is in the atrium. Pull back.')
  }

  function depthNote() {
    const c = runRef.current
    if (c.sleeve && c.sleeve.front < 0 && !c.wireOut) {
      const cm = -c.sleeve.front
      if (cm >= CATH_OK.min && cm <= CATH_OK.max) feel(`${cm.toFixed(0)} cm at the skin: for a right IJ the tip sits near the cavo-atrial junction.`)
    }
  }

  function pullWire(cm: number) {
    const cur = runRef.current
    if (cm <= 0) return
    if (cur.catheterCm <= 0) {
      // Before the catheter is in: pull the wire out at the skin so its tail reaches the brown hub.
      const inside = Math.max(0, cur.inside - cm)
      upd({ inside })
      if (inside < 8) why('Careful: little wire is left in the vein.')
      return
    }
    const inside = Math.max(0, cur.inside - cm)
    upd({ inside })
    if (inside === 0 && !cur.wireOut) {
      upd({ wireOut: true, grip: 'none', catheterPlaced: true })
      feel('The wire is out through the brown hub, your other hand holding the catheter at the skin. Thumb over the hub.')
    }
  }

  return (
    <>
      <p className="io-lede">
        {!sleeve
          ? 'Thread the catheter tip onto the wire.'
          : !placed
            ? 'Slide it down the wire. Before its tip reaches the skin, the wire must come out of the brown hub: take it there. Then drag the catheter in to 15 cm at the skin.'
            : !run.wireOut
              ? 'Hold the catheter still and draw the wire out through the brown hub: drag the tail away.'
              : 'Show the wire whole: tap its J tip.'}
      </p>
      <TouchPad
        svg={side}
        aspect="200 / 150"
        testId="cvc-cath-field"
        onDown={(p) => {
          grab.current = p
          const cur = runRef.current
          const tail = wirePoint(tailAt(cur.inside))
          if (!cur.wireOut && cur.sleeve && Math.hypot(p.x - tail.x, p.y - tail.y) < 22 && cur.grip !== 'tail' && tailFree(cur.inside, cur.sleeve)) {
            grab.current = null
            upd({ grip: 'tail', hubGrip: cur.sleeve.front > 0 || cur.hubGrip })
            sfx.cursor()
            return feel('The wire comes out of the brown hub: you hold it there. Now the catheter can go in.')
          }
          if (placed && !cur.wireOut) pullGrab.current = p.x + p.y
        }}
        onMove={(p) => {
          const g = grab.current
          if (!g) return
          const d = ((p.x - g.x + (p.y - g.y)) * Math.SQRT1_2) / 4
          if (Math.abs(d) < 0.15) return
          grab.current = p
          const cur = runRef.current
          // Once the wire is out the catheter is held still at the skin for stitching.
          if (cur.wireOut) return
          if (placed && pullGrab.current !== null) return pullWire(-d * 2)
          if (!cur.sleeve) {
            // No catheter on yet: pulling at the skin draws the wire out.
            return
          }
          along(-d * (cur.sleeve.front > 15 ? 4.4 : 1))
        }}
        onUp={() => {
          grab.current = null
          pullGrab.current = null
          depthNote()
        }}
      >
        <SideView svgRef={side} needle={null} inside={run.wireOut ? 0 : run.inside} grip={run.wireOut ? undefined : run.grip} sleeve={sleeve} />
      </TouchPad>
      <div className="io-choices mt-2">
        {!sleeve && (
          <button
            type="button"
            className="tap io-mini"
            data-testid="cvc-thread-catheter"
            disabled={run.inside <= 0}
            onClick={() => {
              upd({ sleeve: { kind: 'catheter', front: tailAt(run.inside) - 0.3 } })
              feel('The catheter tip threaded onto the end of the wire, the brown hub at the back.')
            }}
          >
            THREAD THE CATHETER
          </button>
        )}
      </div>
      {sleeve && !run.wireOut && (
        <>
          {!placed || run.grip === 'tail' ? (
            <SlidePad testId="cvc-cath-pad" label={placed ? '◀ BACK · CATHETER IN ▶' : '◀ BACK · CATHETER DOWN THE WIRE ▶'} cmPerWidth={sleeve.front > 15 ? 40 : 12} onDelta={(cm) => along(-cm)} onEnd={depthNote} />
          ) : null}
          {placed && (
            <SlidePad testId="cvc-wire-pad" label="◀ DRAW THE WIRE OUT OF THE BROWN HUB" cmPerWidth={24} onDelta={(cm) => pullWire(-cm)} />
          )}
          {!placed && <GripButtons run={run} upd={upd} feel={feel} tailName="catheter" />}
          <p className="io-small">{placed ? `Catheter ${(-sleeve.front).toFixed(0)} cm at the skin · wire ${run.inside.toFixed(0)} cm in` : `Catheter tip ${sleeve.front.toFixed(0)} cm from the skin`}</p>
        </>
      )}
      {run.wireOut && (
        <div className="io-figure mt-2 aspect-[200/70]" data-testid="cvc-wire-tray">
          <svg
            viewBox="0 0 200 70"
            className="block h-full w-full select-none"
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const x = ((e.clientX - rect.left) / rect.width) * 200
              const y = ((e.clientY - rect.top) / rect.height) * 70
              if (Math.hypot(x - 168, y - 30) < 18) {
                upd({ wireCounted: true })
                sfx.select()
                feel('The whole wire, its J tip intact, shown to the nurse: one wire out. She says it back.')
              } else feel('Find the tip: the J at the end.')
            }}
          >
            <rect width="200" height="70" fill="#4f8fb8" />
            <path d="M20 40 Q60 10 100 40 Q140 66 160 34 Q168 22 176 30 Q180 36 172 38" stroke="#f4f4f4" strokeWidth="2" fill="none" />
            {run.wireCounted && <circle cx="172" cy="33" r="10" fill="none" stroke="#f8d030" strokeWidth="1.4" />}
            <text x="4" y="10" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#f8f8f8">
              THE WIRE ON THE TRAY {run.wireCounted ? '· COUNTED ✓' : ''}
            </text>
          </svg>
        </div>
      )}
      <NextButton onClick={next} testId="cvc-next">
        Secure
      </NextButton>
    </>
  )
}

/* ================================================================ 11. aspirate, flush, secure */

function SecureStage({ run, upd, feel, why, next }: Stage) {
  const tray = useRef<SVGSVGElement>(null)
  const sec = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<Lumen>('distal')
  const [drawn, setDrawn] = useState(0)
  const [saline, setSaline] = useState(5)
  const stitch = usePlay(900)
  const [stitching, setStitching] = useState<number | null>(null)
  const [dressY, setDressY] = useState(0)
  const name = LUMENS.find((l) => l.id === active)?.name
  return (
    <>
      <p className="io-lede">Each lumen: unclamp, draw back blood, flush it with saline, cap it. Then stitch both wings and put the chlorhexidine dressing on.</p>
      <TouchPad
        svg={tray}
        aspect="200 / 110"
        testId="cvc-after-tray"
        onDown={(p) => {
          const i = LUMENS.findIndex((_, k) => Math.abs(p.y - (26 + k * 30)) < 12)
          if (i < 0) return
          const l = LUMENS[i].id
          if (p.x > 140 && run.flushedAfter.includes(l)) {
            upd((c) => ({ capped: toggle(c.capped, l) }))
            return feel(`The ${LUMENS[i].name} hub capped.`)
          }
          setActive(l)
          setDrawn(0)
          setSaline(5)
          sfx.cursor()
        }}
      >
        <LumenTray svgRef={tray} flushed={run.flushedAfter} clamped={[]} active={active} aspirated={run.aspirated} capped={run.capped} fill={drawn > 0 ? 0.5 : 0} />
      </TouchPad>
      <Syringe
        capacity={10}
        drug={saline}
        drawn={drawn}
        drawnColour="#6a1018"
        drugLabel="saline"
        testId="cvc-after-syringe"
        onPull={(ml) => {
          setDrawn((d) => Math.min(3, d + ml))
          if (!run.aspirated.includes(active)) {
            upd((c) => ({ aspirated: toggle(c.aspirated, active) }))
            feel(`Dark blood draws back easily from the ${name} lumen.`)
          }
          return { kind: 'blood', colour: '#6a1018' }
        }}
        onInject={(ml) => {
          if (!run.aspirated.includes(active)) {
            why('Draw back first: blood from every lumen proves it is in the vein, and clears air.')
            return false
          }
          // The blood drawn back goes in first, then the saline behind it.
          if (drawn > 0) {
            setDrawn((d) => Math.max(0, d - ml))
            return true
          }
          setSaline((s) => Math.max(0, s - ml))
          if (saline - ml <= 2 && !run.flushedAfter.includes(active)) {
            upd((c) => ({ flushedAfter: toggle(c.flushedAfter, active) }))
            feel(`The ${name} lumen flushed clear. Tap its hub to cap it.`)
          }
          return true
        }}
      />
      <TouchPad
        svg={sec}
        aspect="200 / 150"
        className="mt-2"
        testId="cvc-secure-field"
        onDown={(p) => {
          if (run.sutures < 2) {
            if (![76, 124].some((x) => Math.hypot(p.x - x, p.y - 76) < 16)) return
            const i = run.sutures
            setStitching(i)
            stitch.play(() => {
              setStitching(null)
              upd((c) => ({ sutures: Math.max(c.sutures, i + 1) }))
              feel(i === 0 ? 'A stitch through the skin and the first wing, tied.' : 'The second wing stitched. The line will not move.')
            })
            return
          }
          if (p.y < 60) setDressY(0.01)
        }}
        onMove={(p) => {
          if (run.sutures < 2 || run.dressing || dressY <= 0) return
          const y = clamp((p.y - 10) / 90, 0, 1)
          setDressY(y)
          if (y >= 0.95) {
            upd({ dressing: true })
            feel('A chlorhexidine-impregnated transparent dressing over the site, the gel pad on the puncture.')
          }
        }}
      >
        <SecureView svgRef={sec} sutures={run.sutures} stitching={stitching} dressing={run.dressing} dressingY={dressY} />
      </TouchPad>
      <p className="io-small">{run.sutures < 2 ? 'Tap each blue wing to stitch it.' : run.dressing ? 'Secured.' : 'Drag the dressing down from the top over the site.'}</p>
      <NextButton onClick={next} testId="cvc-next">
        X-ray
      </NextButton>
    </>
  )
}

/* ================================================================ 12. X-ray and record */

function XrayStage({ run, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [marks, setMarks] = useState<{ x: number; y: number; text: string }[]>([])
  const tipY = cxrTipY(run.catheterCm)
  return (
    <>
      <p className="io-lede">Before the noradrenaline goes in: tap the catheter tip on the film, then look at the edge of each lung.</p>
      <div className="mx-auto max-w-[320px]">
        <TouchPad
          svg={svg}
          aspect="1 / 1"
          testId="cvc-xray"
          onDown={(p) => {
            if (!run.catheterPlaced) return feel('No line on this film: the catheter is not in yet. Go back and place it.')
            if (Math.hypot(p.x - 87, p.y - tipY) < 18) {
              upd({ tipSeen: true })
              setMarks((m) => [...m.filter((x) => x.text !== 'TIP'), { x: 87, y: tipY, text: 'TIP' }])
              const z = tipZone(run.catheterCm)
              if (z === 'junction') return feel('The tip lies about two vertebral bodies below the carina, where the SVC meets the right atrium. Good.')
              if (z === 'atrium') return why('The tip is down in the right atrium: pull the line back to about 15 cm.')
              return why('The tip is high in the SVC: fine to use, but it is not at the junction.')
            }
            const side = p.x < 78 ? 'right' : p.x > 122 ? 'left' : null
            if (side && p.y < 175 && p.y > 40) {
              upd((c) => ({ lungsChecked: toggle(c.lungsChecked, side) }))
              setMarks((m) => (m.some((x) => x.text === side.toUpperCase()) ? m : [...m, { x: p.x, y: p.y, text: side.toUpperCase() }]))
              return feel(`Lung markings out to the chest wall on the ${side}: no pneumothorax.`)
            }
            if (Math.abs(p.y - 80) < 10 && Math.abs(p.x - 100) < 14) return feel('The carina: the tip should lie about two vertebral bodies below it.')
            feel('Find the white line of the catheter and follow it down to its end.')
          }}
        >
          <ChestXray svgRef={svg} catheterCm={run.catheterPlaced ? run.catheterCm : null} marks={marks} />
        </TouchPad>
      </div>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.documented || undefined}
          data-testid="cvc-document"
          onClick={() => {
            upd({ documented: true })
            feel(`Recorded: consent, time-out, ultrasound guidance, ${run.passes} pass${run.passes === 1 ? '' : 'es'}, ${run.catheterCm.toFixed(0)} cm at the skin, wire out and counted, X-ray checked, safe to use.`)
          }}
        >
          {run.documented ? 'DOCUMENTED ✓' : 'DOCUMENT AND CONFIRM THE WIRE COUNT'}
        </button>
      </div>
      <NextButton onClick={next} testId="cvc-next">
        Finish
      </NextButton>
    </>
  )
}

