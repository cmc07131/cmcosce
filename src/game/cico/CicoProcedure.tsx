import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Choices, NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { Dial, HoldButton, SayIt, usePress, useSpin, type SayOption } from '../bench/controls'
import { Monitor, type Vitals } from '../bench/Monitor'
import type { BenchResult } from '../store'
import { buzz, sfx } from '../sfx'
import { BladeCompass, LarynxSection, NeckFront, NeckProfile } from './art'
import {
  ARREST_SPO2,
  BOUGIE,
  NECK_FEEL_TEXT,
  STAB,
  TUBE,
  cicoCaseFor,
  desatRate,
  hypoxicHeart,
  judgeIncision,
  neckFeelAt,
  stabSiteAt,
  type CicoCase,
  type NeckFeel,
} from './case'
import { falseTract, freshCicoRun, scoreCico, tubeInTrachea, type CicoRun } from './score'

const TITLES = ['Position', 'Laryngeal handshake', 'Incision', 'Stab', 'Open the hole', 'Bougie', 'Tube', 'Confirm']

type Etco2 = 'off' | 'flat' | 'square'

type Stage = BenchApi<CicoRun> & { c: CicoCase; next: () => void; etco2: Etco2; setEtco2: (v: Etco2) => void }

/** Scalpel–bougie–tube front-of-neck access, DAS 2025. SpO2 keeps falling until the lungs are ventilated through the trachea. */
export function CicoProcedure({ seed, coach, onDone }: { seed: number; coach: boolean; onDone: (r: BenchResult) => void }) {
  const c = useMemo(() => cicoCaseFor(seed), [seed])
  const api = useBench(freshCicoRun, coach)
  const [index, setIndex] = useState(0)
  const [spo2, setSpo2] = useState(68)
  const spo2Ref = useRef(68)
  const [etco2, setEtco2] = useState<Etco2>('off')

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = api.runRef.current
      // Oxygen through a tracheal tube brings the saturation back, even under CPR.
      const ventilated = r.circuit && tubeInTrachea(r, c)
      const next = ventilated ? Math.min(97, spo2Ref.current + 0.6) : Math.max(20, spo2Ref.current - desatRate(coach) * 0.25)
      spo2Ref.current = next
      setSpo2(next)
      if (next < r.minSpo2) api.upd({ minSpo2: next })
      if (next <= ARREST_SPO2 && !r.arrested) {
        api.upd({ arrested: true })
        api.physical('The pulse is gone. Hypoxic arrest. Someone starts compressions while you keep going.')
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [c, coach])

  const r = api.run
  // After an arrest, a pulse only returns once oxygen is back up.
  const heart = r.arrested && spo2 < 70 ? { hr: 18, rhythm: 'agonal' as const } : hypoxicHeart(spo2)
  const vitals: Vitals = {
    rhythm: heart.rhythm,
    hr: heart.hr,
    spo2,
    bp: r.arrested && spo2 < 70 ? null : [Math.max(60, 80 + (spo2 - 50) * 1.2), Math.max(35, 50 + (spo2 - 50) * 0.5)],
    etco2,
  }

  function next() {
    sfx.select()
    if (index < TITLES.length - 1) {
      setIndex(index + 1)
      return
    }
    const run = api.runRef.current
    const scored = scoreCico(run, c)
    onDone({ ...scored, scene: tubeInTrachea(run, c) && run.circuit ? 'etco2' : 'no-etco2' })
  }

  const stage: Stage = { ...api, c, next, etco2, setEtco2 }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="cico-bench">
      <div className="px-3 pt-1">
        <Monitor vitals={vitals} />
      </div>
      <StepStrip titles={TITLES} index={index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {index === 0 && <Position {...stage} />}
        {index === 1 && <Larynx {...stage} />}
        {index === 2 && <Incise {...stage} />}
        {index === 3 && <Stab {...stage} />}
        {index === 4 && <Open {...stage} />}
        {index === 5 && <Bougie {...stage} />}
        {index === 6 && <Tube {...stage} />}
        {index === 7 && <Confirm {...stage} />}
        <NoteLine note={api.note} />
      </div>
    </div>
  )
}

function useNeckPointer() {
  const box = useRef<HTMLDivElement>(null)
  function toNeck(event: { clientX: number; clientY: number }) {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || !rect.width) return null
    return { x: ((event.clientX - rect.left) / rect.width) * 200, y: ((event.clientY - rect.top) / rect.height) * 300 }
  }
  return { box, toNeck }
}

/* ================================================================ 1. position */

function Position({ run, upd, feel, why, next }: Stage) {
  const [extend, setExtend] = useState(run.extended ? 1 : 0.1)
  return (
    <>
      <p className="io-lede">The i-gel stays in with 100% oxygen. Set up to cut. You are right-handed.</p>
      <div className="io-figure aspect-[10/7]">
        <NeckProfile extend={extend} side={run.side} />
      </div>
      <label className="io-row io-small mt-2">
        Extend the neck
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(extend * 100)}
          className="io-range"
          data-testid="extend"
          onChange={(event) => {
            const v = Number(event.target.value) / 100
            setExtend(v)
            const was = run.extended
            upd({ extended: v >= 0.8 })
            if (v >= 0.8 && !was) feel('Pillow out, shoulders up, chin back. The larynx comes forward.')
          }}
        />
      </label>
      <Choices
        options={[
          {
            label: "STAND ON HIS LEFT",
            testId: 'side-left',
            on: run.side === 'left',
            onClick: () => {
              upd({ side: 'left' })
              feel('Patient’s left side. Left hand on the larynx, right hand for the blade.')
            },
          },
          {
            label: "STAND ON HIS RIGHT",
            testId: 'side-right',
            on: run.side === 'right',
            onClick: () => {
              upd({ side: 'right' })
              why('Right-handed: stand on the patient’s left, so your left hand holds the larynx and your right hand cuts.')
            },
          },
        ]}
      />
      <NextButton onClick={next}>Find the larynx</NextButton>
    </>
  )
}

/* ================================================================ 2. larynx */

const SAY_SLIM: SayOption[] = [
  { text: 'Thyroid cartilage, cricothyroid membrane, cricoid: midline and palpable.', ok: true },
  { text: 'Hyoid, then the thyroid isthmus. That is where I cut.', ok: false },
  { text: 'Two finger-breadths above the sternal notch.', ok: false },
]
const SAY_OBESE: SayOption[] = [
  { text: 'I cannot feel the membrane. Vertical midline incision, then I find it with my finger.', ok: true },
  { text: 'The membrane is not palpable, so needle cricothyroidotomy.', ok: false },
  { text: 'I will wait for an ultrasound before I cut.', ok: false },
]

function Larynx({ c, run, upd, feel, why, coach, next }: Stage) {
  const { box, toNeck } = useNeckPointer()
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null)
  const [xray, setXray] = useState(false)
  const last = useRef<NeckFeel | null>(null)
  const press = usePress({
    move: (event: ReactPointerEvent<HTMLDivElement>) => {
      const p = toNeck(event)
      if (!p) return
      setFinger(p)
      const f = neckFeelAt(p.x, p.y, c.habitus)
      if (f === last.current) return
      last.current = f
      if (f === 'notch-thyroid' || f === 'thyroid' || f === 'cricoid' || f === 'hyoid') buzz(16)
      if (f === 'membrane') {
        buzz([10, 30, 10])
        upd({ palpatedMembrane: true })
      }
      feel(NECK_FEEL_TEXT[f])
    },
    up: () => setFinger(null),
  })
  const options = c.habitus === 'obese' ? SAY_OBESE : SAY_SLIM
  return (
    <>
      <p className="io-lede">Slide a finger down the midline from the chin. Then grip the larynx.</p>
      <div ref={box} className="io-figure io-leg-big relative" style={{ touchAction: 'none' }} data-testid="neck-feel" {...press}>
        <NeckFront habitus={c.habitus} xray={coach && xray} hand={run.handshake}>
          {finger && <circle cx={finger.x} cy={finger.y} r="7" fill="#88c8f0" stroke="#181820" opacity="0.85" />}
        </NeckFront>
      </div>
      <div className="io-row mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="handshake"
          data-on={run.handshake || undefined}
          onClick={() => {
            upd({ handshake: true })
            buzz(30)
            feel('Laryngeal handshake: thumb and middle finger on the thyroid laminae, rock it, slide down to the cricoid. Index finger on the membrane.')
          }}
        >
          LARYNGEAL HANDSHAKE
        </button>
        {coach && (
          <button type="button" className="tap io-mini" data-testid="xray" onClick={() => setXray((v) => !v)}>
            X-RAY {xray ? 'ON' : 'OFF'}
          </button>
        )}
      </div>
      <SayIt
        prompt="Say what you have found."
        options={options}
        picked={run.saidLandmarks}
        onPick={(ok) => {
          upd({ saidLandmarks: ok })
          if (!ok) why(c.habitus === 'obese' ? 'An impalpable membrane is not a reason to stop. DAS 2025: vertical midline incision, then find it with a finger.' : 'Name them top to bottom: thyroid, membrane, cricoid, in the midline.')
        }}
      />
      <NextButton onClick={next}>Cut the skin</NextButton>
    </>
  )
}

/* ================================================================ 3. incision */

function Incise({ c, run, upd, feel, why, physical, next }: Stage) {
  const { box, toNeck } = useNeckPointer()
  const [stroke, setStroke] = useState<{ x: number; y: number }[]>([])
  const [dissect, setDissect] = useState(0)
  const strokeRef = useRef<{ x: number; y: number }[]>([])
  const press = usePress({
    down: () => {
      strokeRef.current = []
    },
    move: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (run.incision) return
      const p = toNeck(event)
      if (!p) return
      strokeRef.current = [...strokeRef.current, p]
      setStroke(strokeRef.current)
    },
    up: () => {
      if (run.incision) return
      const s = strokeRef.current
      if (s.length < 2 || Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y) < 10) {
        setStroke([])
        return
      }
      upd({ incision: s })
      sfx.select()
      const v = judgeIncision(s)
      feel(`The skin parts along a ${v.lengthCm.toFixed(1)} cm line. It bleeds.`)
      if (!v.ok) why(v.notes[0])
    },
  })
  return (
    <>
      <p className="io-lede">The scalpel is in your right hand. Draw the skin incision with one stroke.</p>
      <div ref={box} className="io-figure io-leg-big relative" style={{ touchAction: 'none' }} data-testid="neck-cut" {...press}>
        <NeckFront habitus={c.habitus} hand={!run.lostLarynx && run.handshake} incision={run.incision ?? (stroke.length ? stroke : null)} opened={run.dissected} />
      </div>
      {run.incision && !run.dissected && (
        <HoldButton
          testId="dissect"
          onTick={(dt) => {
            const need = c.habitus === 'obese' ? 2.5 : 1.5
            setDissect((d) => {
              const n = Math.min(1, d + dt / need)
              if (n >= 1 && d < 1) {
                upd({ dissected: true })
                buzz([10, 30, 10])
                feel('Blunt dissection with your finger through fat and strap muscle. Under your fingertip now: the soft dip of the membrane.')
              }
              return n
            })
          }}
        >
          Hold · finger dissection down to the membrane ({Math.round(dissect * 100)}%)
        </HoldButton>
      )}
      <Choices
        options={[
          {
            label: 'BOTH HANDS ON THE SCALPEL',
            onClick: () => {
              upd({ lostLarynx: true })
              physical('Your left hand leaves the neck. The larynx slides sideways.')
              why('The non-dominant hand never leaves the larynx until the tube is in.')
            },
          },
        ]}
      />
      <NextButton onClick={next}>Stab the membrane</NextButton>
    </>
  )
}

/* ================================================================ 4. stab */

function Stab({ c, run, runRef, upd, feel, why, physical, coach, next }: Stage) {
  const { box, toNeck } = useNeckPointer()
  const [blade, setBlade] = useState<{ x: number; y: number } | null>(null)
  const plane = run.bladeTransverse === null ? null : run.bladeTransverse ? 'across' : 'along'
  const edge = run.edgeTowardYou === null ? null : run.edgeTowardYou ? 'you' : 'away'

  function push(dt: number) {
    const cur = runRef.current
    if (!cur.stabSite) return physical('Put the blade on the neck first.')
    if (cur.stabSite === 'thyroid' || cur.stabSite === 'cricoid') return physical('Hard cartilage. The blade will not go in.')
    const before = cur.stabDepth
    const d = Math.min(STAB.posteriorWall + 1, before + dt * 6)
    upd({ stabDepth: d, stabbed: d >= 0.5 })
    if (before < STAB.through && d >= STAB.through) {
      buzz(40)
      feel('A give as the blade goes through. A hiss of air.')
    }
    if (before < STAB.posteriorWall && d >= STAB.posteriorWall) {
      buzz(120)
      physical('The tip meets something firm at the back.')
      why('Stop at the give. The back wall of the trachea, then the oesophagus, are only about 15 mm deep.')
    }
  }

  return (
    <>
      <p className="io-lede">Tap the wound where the blade goes in, set the blade, then push.</p>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <div
          ref={box}
          className="io-figure relative aspect-[2/3]"
          data-testid="stab-site"
          onClick={(event) => {
            if (run.stabbed) return
            const p = toNeck(event)
            if (!p) return
            setBlade(p)
            const site = stabSiteAt(p.x, p.y)
            upd({ stabSite: site })
            if (site !== 'membrane') why(site === 'off' ? 'Stay in the midline.' : `That is the ${site}. The membrane is the soft dip between thyroid and cricoid.`)
          }}
        >
          <NeckFront habitus={c.habitus} hand={!run.lostLarynx && run.handshake} incision={run.incision} opened={run.dissected}>
            {blade && <path d={`M${blade.x - 6} ${blade.y} L${blade.x + 6} ${blade.y}`} stroke="#181820" strokeWidth="3" />}
          </NeckFront>
        </div>
        <div className="flex flex-col gap-2">
          <div className="io-figure aspect-square">
            <BladeCompass plane={plane} edge={edge} />
          </div>
          <div className="io-figure aspect-square">
            <LarynxSection habitus={c.habitus} site={run.stabSite} stabDepth={run.stabDepth} bladeIn={Boolean(run.stabSite)} rotated={false} bougieCm={0} falsePassage={false} tubeCm={0} cuff={0} coach={coach} />
          </div>
        </div>
      </div>
      <Choices
        options={[
          { label: 'BLADE ACROSS THE NECK', testId: 'blade-across', on: run.bladeTransverse === true, onClick: () => upd({ bladeTransverse: true }) },
          { label: 'BLADE ALONG THE NECK', on: run.bladeTransverse === false, onClick: () => upd({ bladeTransverse: false }) },
        ]}
      />
      <Choices
        options={[
          { label: 'EDGE TOWARD YOU', testId: 'edge-you', on: run.edgeTowardYou === true, onClick: () => upd({ edgeTowardYou: true }) },
          { label: 'EDGE AWAY', on: run.edgeTowardYou === false, onClick: () => upd({ edgeTowardYou: false }) },
        ]}
      />
      <HoldButton testId="stab-push" onTick={push}>
        Hold · push the blade in
      </HoldButton>
      <NextButton onClick={next}>Open the hole</NextButton>
    </>
  )
}

/* ================================================================ 5. open */

function Open({ c, run, upd, feel, why, physical, coach, next }: Stage) {
  const spin = useSpin('cw')
  useEffect(() => {
    if (spin.turns >= 0.25 && !run.rotated && run.stabbed) {
      upd({ rotated: true })
      feel('The blade turns a quarter in the hole.')
    }
  }, [spin.turns])
  return (
    <>
      <p className="io-lede">The blade is in the membrane. Turn it, then open the hole for the bougie.</p>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <div className="io-figure aspect-square">
          <LarynxSection habitus={c.habitus} site={run.stabSite} stabDepth={run.stabDepth} bladeIn={run.opened !== 'removed'} rotated={run.rotated} bougieCm={0} falsePassage={false} tubeCm={0} cuff={0} coach={coach} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="io-figure aspect-square w-full">
            <BladeCompass plane={run.rotated ? 'along' : 'across'} edge={run.edgeCaudal === null ? (run.rotated ? null : 'you') : run.edgeCaudal ? 'feet' : 'head'} />
          </div>
          {!run.rotated && <Dial label="ROTATE" spin={spin} />}
        </div>
      </div>
      {run.rotated && (
        <Choices
          options={[
            { label: 'SHARP EDGE TO THE FEET', testId: 'edge-feet', on: run.edgeCaudal === true, onClick: () => upd({ edgeCaudal: true }) },
            {
              label: 'SHARP EDGE TO THE HEAD',
              on: run.edgeCaudal === false,
              onClick: () => {
                upd({ edgeCaudal: false })
                why('Point the sharp edge to the feet, away from the vocal cords.')
              },
            },
          ]}
        />
      )}
      <Choices
        options={[
          {
            label: 'SWAP HANDS · PULL TOWARD YOU',
            testId: 'pull-lateral',
            on: run.opened === 'lateral',
            onClick: () => {
              upd({ opened: 'lateral' })
              feel('Left hand on the scalpel now, handle upright, pulled gently toward you. The hole gapes.')
            },
          },
          {
            label: 'TAKE THE BLADE OUT',
            on: run.opened === 'removed',
            onClick: () => {
              upd({ opened: 'removed' })
              physical('The blade is out. The hole closes behind it.')
              why('Keep the blade in and pull it toward you. The bougie slides down its far side.')
            },
          },
        ]}
      />
      <NextButton onClick={next}>Bougie</NextButton>
    </>
  )
}

/* ================================================================ 6. bougie */

function Bougie({ c, run, runRef, upd, feel, why, physical, coach, next }: Stage) {
  const pushedPast = useRef(0)
  const lastClick = useRef(0)
  const wrongWay = falseTract(run, c) && !run.secondPass

  function slide(dt: number) {
    const cur = runRef.current
    if (cur.bougieDone) return
    const stopAt = wrongWay && !cur.forcedHoldUp ? BOUGIE.holdUp : 20
    let d = cur.bougieDepth + dt * 3
    if (d >= stopAt) {
      d = stopAt
      if (!cur.holdUpMet) {
        upd({ holdUpMet: true })
        buzz(150)
        physical('It stops dead at about 5 cm. Firm resistance.')
      }
      pushedPast.current += dt
      if (pushedPast.current > 0.8 && !cur.forcedHoldUp) {
        upd({ forcedHoldUp: true })
        why('An early hold-up is a false passage in front of the trachea. Forcing it makes a bigger one.')
      }
    }
    if (!wrongWay && d >= BOUGIE.clicksFrom && d - lastClick.current >= 1.5) {
      lastClick.current = d
      buzz(8)
      feel('Click… click… the tip bumps over the tracheal rings.')
    }
    upd({ bougieDepth: d })
  }

  return (
    <>
      <p className="io-lede">Coudé tip down the side of the blade, into the trachea.</p>
      <div className="io-figure aspect-square">
        <LarynxSection habitus={c.habitus} site={run.stabSite} stabDepth={run.stabDepth} bladeIn={run.opened === 'lateral' && !run.bougieDone} rotated={run.rotated} bougieCm={run.bougieDepth} falsePassage={wrongWay || run.forcedHoldUp} tubeCm={0} cuff={0} coach={coach} />
      </div>
      {coach && <p className="io-small" data-testid="bougie-cm">Bougie at {run.bougieDepth.toFixed(1)} cm</p>}
      {!run.bougieDone && (
        <HoldButton testId="bougie-push" onTick={slide} onEnd={() => (pushedPast.current = 0)}>
          Hold · slide the bougie in
        </HoldButton>
      )}
      {run.holdUpMet && !run.forcedHoldUp && !run.secondPass && (
        <Choices
          options={[
            {
              label: 'STOP · FALSE PASSAGE · REDO UNDER MY FINGER',
              testId: 'redo-bougie',
              onClick: () => {
                upd({ secondPass: true, bougieDepth: 0 })
                lastClick.current = 0
                feel('Bougie out. Finger into the hole, feel the trachea, bougie slides in under your finger.')
              },
            },
            {
              label: 'PUSH THROUGH IT',
              onClick: () => {
                upd({ forcedHoldUp: true })
                why('An early hold-up is a false passage. Forcing it makes a bigger one.')
              },
            },
          ]}
        />
      )}
      {!run.bougieDone && run.bougieDepth > 0 && (
        <button
          type="button"
          className="tap mt-2"
          data-testid="bougie-done"
          onClick={() => {
            upd({ bougieDone: true })
            feel(`Bougie held at ${Math.round(run.bougieDepth)} cm. The blade comes out.`)
          }}
        >
          Bougie in · hold it there
        </button>
      )}
      <NextButton onClick={next}>Tube</NextButton>
    </>
  )
}

/* ================================================================ 7. tube */

function Tube({ c, run, runRef, upd, feel, why, physical, coach, next }: Stage) {
  const falsePath = !tubeInTrachea(run, c)
  function railroad(dt: number) {
    const cur = runRef.current
    if (cur.bougieOut) return physical('The bougie is out. Nothing to guide the tube.')
    const before = cur.tubeDepth
    const d = Math.min(TUBE.max, before + dt * 2)
    upd({ tubeDepth: d })
    if (before < TUBE.cuffThrough && d >= TUBE.cuffThrough) {
      buzz(30)
      feel('The cuff slips just through the membrane.')
    }
    if (before < TUBE.tooDeep && d >= TUBE.tooDeep) why('A front-of-neck tube sits short: stop once the cuff is through.')
  }
  return (
    <>
      <p className="io-lede">Lubricated cuffed 6.0 over the bougie, rotating as it goes.</p>
      <div className="io-figure aspect-square">
        <LarynxSection habitus={c.habitus} site={run.stabSite} stabDepth={0} bladeIn={false} rotated={run.rotated} bougieCm={run.bougieOut ? 0 : run.bougieDepth} falsePassage={falsePath} tubeCm={run.tubeDepth} cuff={Math.min(1, run.cuff)} coach={coach} />
      </div>
      {coach && <p className="io-small">Tube in {run.tubeDepth.toFixed(1)} cm past the skin</p>}
      {!run.bougieOut && (
        <HoldButton testId="railroad" onTick={railroad}>
          Hold · railroad the 6.0
        </HoldButton>
      )}
      {run.tubeDepth > 0 && !run.bougieOut && (
        <Choices
          options={[
            {
              label: 'HOLD THE TUBE · BOUGIE OUT',
              testId: 'bougie-out-held',
              onClick: () => {
                upd({ tubeHeldForBougie: true, bougieOut: true })
                feel('Tube held at the skin. The bougie slides out.')
              },
            },
            {
              label: 'PULL THE BOUGIE OUT',
              onClick: () => {
                upd({ tubeHeldForBougie: false, bougieOut: true })
                physical('The tube creeps out with the bougie.')
                why('Hold the tube at the skin while the bougie comes out.')
              },
            },
          ]}
        />
      )}
      {run.bougieOut && run.cuff < 1 && (
        <HoldButton
          testId="cuff"
          onTick={(dt) => {
            const was = runRef.current.cuff
            const n = Math.min(1.2, was + dt / 1.2)
            upd({ cuff: n })
            if (was < 1 && n >= 1) feel('The pilot balloon is firm.')
          }}
        >
          Hold · inflate the cuff
        </HoldButton>
      )}
      {run.bougieOut && !run.circuit && (
        <button
          type="button"
          className="tap mt-2"
          data-testid="circuit"
          onClick={() => {
            upd({ circuit: true })
            feel('Catheter mount and circuit on. You squeeze the bag.')
          }}
        >
          Connect the circuit and ventilate
        </button>
      )}
      <NextButton onClick={next}>Confirm</NextButton>
    </>
  )
}

/* ================================================================ 8. confirm */

const SAY_CLOSE: SayOption[] = [
  { text: 'Front-of-neck tube in, square ETCO2. I hold it until it is tied. Chest X-ray; keep him paralysed and sedated. ENT and ICU.', ok: true },
  { text: 'Tube in. Advance it to 22 cm and tape it.', ok: false },
  { text: 'The chest rose, so we do not need capnography.', ok: false },
]

function Confirm({ c, run, upd, feel, why, physical, next, etco2, setEtco2 }: Stage) {
  const inTrachea = tubeInTrachea(run, c)
  function read(choice: 'square' | 'none' | 'chest') {
    if (!run.askedEtco2) return physical('Nobody has put the capnography on yet.')
    if (choice === 'chest') {
      upd({ etco2Read: 'wrong' })
      return why('A rising chest can fool you. Only a sustained square ETCO2 waveform confirms the trachea.')
    }
    const right = (choice === 'square') === inTrachea
    upd({ etco2Read: right ? 'right' : 'wrong' })
    if (!right) why(inTrachea ? 'That is a square waveform: the tube is in the trachea.' : 'Flat line: the tube is not in the trachea. Tube out, still CICO.')
    if (right && !inTrachea) {
      upd({ pulledFalseTube: true, circuit: false })
      feel('Tube out. Still CICO.')
    }
  }
  return (
    <>
      <p className="io-lede">Is it in the trachea?</p>
      {!run.askedEtco2 && (
        <button
          type="button"
          className="tap mt-2"
          data-testid="ask-etco2"
          onClick={() => {
            upd({ askedEtco2: true })
            setEtco2(inTrachea && run.circuit ? 'square' : 'flat')
            feel('Capnography line on. Look at the monitor.')
          }}
        >
          Waveform capnography on, please
        </button>
      )}
      {run.askedEtco2 && (
        <Choices
          options={[
            { label: 'SQUARE WAVE · IN THE TRACHEA', testId: 'read-square', onClick: () => read('square') },
            { label: 'NO TRACE · TUBE OUT, STILL CICO', testId: 'read-none', onClick: () => read('none') },
            { label: 'CHEST MOVES · THAT IS ENOUGH', onClick: () => read('chest') },
          ]}
        />
      )}
      {run.pulledFalseTube && !run.secondPass && (
        <button
          type="button"
          className="tap mt-2"
          data-testid="redo-fona"
          onClick={() => {
            upd({ secondPass: true, circuit: true })
            setEtco2('square')
            feel('Finger into the hole, bougie under the finger, 6.0 railroaded again. Now a square wave.')
          }}
        >
          Finger in the hole, bougie under the finger, re-railroad
        </button>
      )}
      <Choices
        options={[
          {
            label: 'HOLD IT UNTIL TIED AND HANDED OVER',
            testId: 'hold-tube',
            on: run.holdUntilTied === true,
            onClick: () => {
              upd({ holdUntilTied: true })
              feel('You hold the tube at the skin until it is tied and the ICU registrar takes it.')
            },
          },
          {
            label: 'LET GO · WRITE THE NOTE',
            on: run.holdUntilTied === false,
            onClick: () => {
              upd({ holdUntilTied: false })
              why('A short front-of-neck tube falls out. Hold it until it is tied and a named person takes it.')
            },
          },
        ]}
      />
      {etco2 !== 'off' && (
        <SayIt
          prompt="Tell the team."
          options={SAY_CLOSE}
          picked={run.saidClose}
          onPick={(ok) => {
            upd({ saidClose: ok })
            if (!ok) why('Short tube, held until tied, confirmed by a square ETCO2 trace. Then chest X-ray and keep him paralysed.')
          }}
        />
      )}
      <NextButton onClick={next} testId="io-done">
        Hand over
      </NextButton>
    </>
  )
}
