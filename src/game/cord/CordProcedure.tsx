import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Choices, NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { HoldButton, SayIt, usePress, type SayOption } from '../bench/controls'
import { FetalMonitor, type FetalSample } from '../bench/FetalMonitor'
import type { BenchResult } from '../store'
import { buzz, sfx } from '../sfx'
import { PelvisSection, PerineumView, PoseCard } from './art'
import { contracting, cordCaseFor, fhrTarget, freshCordRun, scoreCord, type CordCase, type CordRun, type Pose } from './model'

const TITLES = ['Look', 'Lift the head', 'The cord', 'Position', 'Fetal heart', 'Theatre', 'Transfer']

type Stage = BenchApi<CordRun> & {
  c: CordCase
  next: () => void
  fhr: number
  elapsed: () => number
  spasm: () => void
  spasmOn: boolean
}

/** Cord prolapse, managed with your hands. The fetal heart answers every move. */
export function CordProcedure({ seed, coach, onDone }: { seed: number; coach: boolean; onDone: (r: BenchResult) => void }) {
  const c = useMemo(() => cordCaseFor(seed), [seed])
  const api = useBench(freshCordRun, coach)
  const [index, setIndex] = useState(0)
  const start = useRef(performance.now())
  const spasmUntil = useRef(-1)
  const [fhr, setFhr] = useState(c.compressedFhr)
  const fhrRef = useRef(c.compressedFhr)
  const [history, setHistory] = useState<FetalSample[]>([])
  const [clock, setClock] = useState(0)
  const elapsed = () => (performance.now() - start.current) / 1000

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = elapsed()
      const r = api.runRef.current
      const target = fhrTarget(c, r, t, spasmUntil.current)
      const cur = fhrRef.current
      const next = cur + Math.max(-8, Math.min(6, target - cur))
      fhrRef.current = next
      setFhr(next)
      setClock(t)
      const squeeze = contracting(c, r, t) ? 1 : 0
      setHistory((h) => [...h.slice(-400), { fhr: next, toco: squeeze }])
      if (next < 110) api.upd({ lowFhrS: r.lowFhrS + 0.5 })
    }, 500)
    return () => window.clearInterval(id)
  }, [c])

  // With the Doppler on and sound enabled, you hear every beat.
  useEffect(() => {
    if (!api.run.doppler) return
    let id = 0
    const beat = () => {
      sfx.doppler()
      id = window.setTimeout(beat, 60000 / Math.max(40, fhrRef.current))
    }
    beat()
    return () => window.clearTimeout(id)
  }, [api.run.doppler])

  function spasm() {
    spasmUntil.current = elapsed() + 15
    buzz([20, 40, 20])
  }

  function next() {
    sfx.select()
    if (index < TITLES.length - 1) {
      setIndex(index + 1)
      return
    }
    const run = api.runRef.current
    const flags: string[] = []
    if (run.transferPose === 'lateral' || run.bayPose === 'lateral') flags.push('pose:lateral')
    else if (run.bayPose === 'knee-chest') flags.push('pose:knee')
    if (run.elevated && !run.handOut) flags.push('lift')
    if (run.gauze) flags.push('cover')
    if (run.doppler) flags.push('listen')
    onDone({ ...scoreCord(run, c), scene: flags })
  }

  const stage: Stage = { ...api, c, next, fhr, elapsed, spasm, spasmOn: clock < spasmUntil.current }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="cord-bench">
      <div className="px-3 pt-1">
        <FetalMonitor history={api.run.doppler ? history : []} fhr={fhr} clockS={clock} doppler={api.run.doppler} />
      </div>
      <StepStrip titles={TITLES} index={index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {index === 0 && <Look {...stage} />}
        {index === 1 && <Lift {...stage} />}
        {index === 2 && <CordCare {...stage} />}
        {index === 3 && <Position {...stage} />}
        {index === 4 && <Heart {...stage} />}
        {index === 5 && <Theatre {...stage} />}
        {index === 6 && <Transfer {...stage} />}
        <NoteLine note={api.note} />
      </div>
    </div>
  )
}

/* ================================================================ 1. look */

const SAY_OVERT: SayOption[] = [
  { text: 'This is an overt cord prolapse: cord outside, in front of the presenting part. Obstetric emergency.', ok: true },
  { text: 'Membranes have ruptured. Speculum later; no rush.', ok: false },
  { text: 'That is a show. I will reassess in an hour.', ok: false },
]

function Look({ c, run, upd, feel, why, next }: Stage) {
  return (
    <>
      <p className="io-lede">She is on the trolley, legs covered. Her waters went with a gush at home.</p>
      <div className="io-figure aspect-[4/3]">
        <PerineumView exposed={run.exposed} visible={c.visible} gauze={run.gauze} />
      </div>
      <Choices
        options={[
          { label: run.gloves ? 'GLOVES ✓' : 'GLOVES ON', testId: 'gloves', on: run.gloves, onClick: () => upd({ gloves: true }) },
          { label: run.apron ? 'APRON ✓' : 'APRON ON', testId: 'apron', on: run.apron, onClick: () => upd({ apron: true }) },
          {
            label: 'EXPOSE AND LOOK',
            testId: 'expose',
            on: run.exposed,
            onClick: () => {
              const early = !(run.gloves && run.apron)
              upd({ exposed: true, exposedBeforePpe: run.exposedBeforePpe || early })
              if (early) why('Gloves and apron before you expose her: you will have your hand in the vagina in a moment.')
              feel(c.visible ? 'Screen drawn, chaperone in. A loop of cord lies at the introitus.' : 'Screen drawn, chaperone in. Clear liquor. No cord at the introitus.')
            },
          },
        ]}
      />
      {run.exposed && c.visible && (
        <SayIt
          prompt="Say what you see."
          options={SAY_OVERT}
          picked={run.saidRecognised}
          onPick={(ok) => {
            upd({ saidRecognised: ok })
            if (!ok) why('A loop of cord below the presenting part after ruptured membranes is cord prolapse. Say it, and call for help.')
          }}
        />
      )}
      <NextButton onClick={next}>Lift the presenting part</NextButton>
    </>
  )
}

/* ================================================================ 2. lift */

const SAY_OCCULT: SayOption[] = [
  { text: 'Cord felt below the presenting part: this is a cord prolapse. Obstetric emergency.', ok: true },
  { text: 'Something soft in the vagina. I will re-examine in an hour.', ok: false },
  { text: 'That is the cervix. She is in normal labour.', ok: false },
]

function Lift({ c, run, runRef, upd, feel, why, physical, elapsed, spasm, spasmOn, next }: Stage) {
  const box = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const press = usePress({
    down: (event: ReactPointerEvent<HTMLDivElement>) => {
      startY.current = event.clientY
    },
    move: (event: ReactPointerEvent<HTMLDivElement>) => {
      const r = runRef.current
      if (r.elevated) return
      const h = box.current?.getBoundingClientRect().height ?? 200
      const lift = Math.max(0, Math.min(1, (startY.current - event.clientY) / (h * 0.45)))
      upd({ lift })
      if (lift >= 0.8) {
        upd({ elevated: true, elevatedAtS: elapsed() })
        buzz(40)
        feel('Your fingers push the head up off the cord. The cord pulses freely under them. Your hand stays there.')
      }
    },
    up: () => {
      const r = runRef.current
      if (!r.elevated) upd({ lift: 0 })
    },
  })
  const canLift = c.visible || run.examined
  return (
    <>
      <p className="io-lede">{canLift ? 'Gloved hand in. Press on the head and push it up, away from the cord.' : 'Nothing visible. Examine gently.'}</p>
      <div ref={box} className="io-figure relative aspect-[10/9]" style={{ touchAction: 'none' }} data-testid="lift-area" {...(canLift ? press : {})}>
        <PelvisSection lift={run.elevated ? 1 : run.lift} handIn={(run.elevated && !run.handOut) || run.lift > 0} visible={c.visible} examined={run.examined || c.visible} spasm={spasmOn} bladderMl={run.bladderMl} />
      </div>
      {!canLift && (
        <HoldButton
          testId="examine"
          onTick={() => {
            if (runRef.current.examined) return
            upd({ examined: true })
            feel('Two fingers in, gently: a soft pulsating loop below the head.')
          }}
        >
          Hold · gentle vaginal examination
        </HoldButton>
      )}
      {!c.visible && run.examined && (
        <SayIt
          prompt="Say what you feel."
          options={SAY_OCCULT}
          picked={run.saidRecognised}
          onPick={(ok) => {
            upd({ saidRecognised: ok })
            if (!ok) why('A cord below the presenting part is a cord prolapse, seen or not.')
          }}
        />
      )}
      {canLift && !run.elevated && <p className="io-small">Drag upward on the picture to lift the head.</p>}
      <Choices
        options={[
          {
            label: 'PUSH THE CORD BACK UP',
            onClick: () => {
              upd({ replacedCord: true })
              spasm()
              physical('The cord goes into spasm under your fingers. The heart drops.')
              why('Do not replace the cord. Handling it causes spasm; lift the head off it instead.')
            },
          },
          {
            label: 'SQUEEZE THE CORD FOR A PULSE',
            onClick: () => {
              upd((r) => ({ handledCord: r.handledCord + 1 }))
              spasm()
              physical('The cord tightens and the heart slows.')
              why('Minimal handling. The Doppler tells you about the heart; the cord does not need squeezing.')
            },
          },
        ]}
      />
      <NextButton onClick={next}>The cord</NextButton>
    </>
  )
}

/* ================================================================ 3. cord care */

function CordCare({ c, run, upd, feel, why, physical, spasm, next }: Stage) {
  return (
    <>
      <p className="io-lede">{c.visible ? 'A loop lies outside, getting cold and dry.' : 'The cord is inside the vagina.'}</p>
      <div className="io-figure aspect-[4/3]">
        <PerineumView exposed={run.exposed} visible={c.visible} gauze={run.gauze} />
      </div>
      {c.visible ? (
        <Choices
          options={[
            {
              label: 'LOOSE WARM SALINE GAUZE',
              testId: 'gauze',
              on: run.gauze && !run.gauzeTight,
              onClick: () => {
                upd({ gauze: true, gauzeTight: false })
                feel('Warm saline-soaked gauze laid loosely over the loop. No squeezing.')
              },
            },
            {
              label: 'WRAP IT TIGHTLY',
              onClick: () => {
                upd({ gauze: true, gauzeTight: true })
                spasm()
                physical('The heart dips as the wrap tightens.')
                why('Loose, warm and moist. A tight wrap is handling.')
              },
            },
          ]}
        />
      ) : (
        <Choices
          options={[
            { label: 'LEAVE IT WHERE IT IS', testId: 'leave-cord', onClick: () => feel('You leave it alone. Your hand stays on the head.') },
            {
              label: 'PULL IT OUT TO LOOK',
              onClick: () => {
                upd((r) => ({ handledCord: r.handledCord + 1 }))
                spasm()
                physical('Cold air and fingers: the cord goes into spasm.')
                why('A cord inside the vagina stays inside. Handling and cold both cause spasm.')
              },
            },
          ]}
        />
      )}
      <NextButton onClick={next}>Position</NextButton>
    </>
  )
}

/* ================================================================ 4. position in the bay */

const POSES: { pose: Pose; label: string }[] = [
  { pose: 'knee-chest', label: 'KNEE–CHEST' },
  { pose: 'lateral', label: 'LEFT LATERAL · HEAD DOWN' },
  { pose: 'supine', label: 'FLAT ON HER BACK' },
  { pose: 'sitting', label: 'SIT HER UP' },
]

function Position({ run, upd, feel, why, next }: Stage) {
  return (
    <>
      <p className="io-lede">Still in the bay. Your hand stays on the head. How should she lie?</p>
      <div className="grid grid-cols-2 gap-2">
        {POSES.map((p) => (
          <button
            key={p.pose}
            type="button"
            className="tool"
            data-done={run.bayPose === p.pose || undefined}
            data-testid={`bay-${p.pose}`}
            onClick={() => {
              upd({ bayPose: p.pose })
              if (p.pose === 'knee-chest') feel('On all fours, chest down, bottom up. Gravity takes the head off the cord.')
              else if (p.pose === 'lateral') feel('Left lateral, head down. Good for moving; in the bay knee–chest does more.')
              else if (p.pose === 'supine') why('Flat on her back, the head sits on the cord.')
              else why('Sitting up drives the head down onto the cord.')
            }}
          >
            <div className="tool-art w-full">
              <PoseCard pose={p.pose} />
            </div>
            <span className="tool-caption">{p.label}</span>
          </button>
        ))}
      </div>
      <NextButton onClick={next}>Fetal heart</NextButton>
    </>
  )
}

/* ================================================================ 5. fetal heart */

function Heart({ run, upd, fhr, why, feel, next }: Stage) {
  const [heard, setHeard] = useState<number | null>(null)
  const options = useMemo<SayOption[]>(() => {
    const rate = Math.round((heard ?? 0) / 5) * 5
    return [
      { text: `Fetal heart about ${rate}. Still category 1: we go now.`, ok: true },
      { text: 'The heart is fine, so we can slow down and wait for the list.', ok: false },
      { text: 'No heart heard, so crash caesarean anyway.', ok: false },
    ]
  }, [heard])
  return (
    <>
      <p className="io-lede">Handheld Doppler on the abdomen. Listen, and say the rate.</p>
      {!run.doppler ? (
        <button
          type="button"
          className="tap mt-2"
          data-testid="doppler"
          onClick={() => {
            upd({ doppler: true })
            setHeard(fhr)
            feel('Doppler on. You hear the fetal heart, and the strip starts to draw.')
          }}
        >
          Doppler on the abdomen
        </button>
      ) : (
        <SayIt
          prompt="Tell the room the fetal heart."
          options={options}
          picked={run.saidFhr}
          onPick={(ok) => {
            upd({ saidFhr: ok })
            if (!ok) why('Say the number you hear. Whatever it is, this is still a category 1 caesarean.')
          }}
        />
      )}
      <NextButton onClick={next}>Theatre</NextButton>
    </>
  )
}

/* ================================================================ 6. theatre and delay */

function Theatre({ c, run, runRef, upd, feel, why, next }: Stage) {
  const [foley, setFoley] = useState(run.bladderMl > 0)
  const [volume, setVolume] = useState(500)
  return (
    <>
      <div className="io-note" data-tone="feel" data-testid="theatre-news">
        O&amp;G on the phone: {c.delayed ? 'obstetric theatre is busy. About 20 minutes before we can start.' : 'obstetric theatre is ready. Bring her now.'}
      </div>
      <p className="io-lede mt-2">Anything else before she moves?</p>
      {!foley ? (
        <button
          type="button"
          className="tap mt-1"
          data-testid="foley"
          onClick={() => {
            setFoley(true)
            feel('Foley catheter in, giving set of warm saline on the end.')
          }}
        >
          Insert a Foley for bladder filling
        </button>
      ) : (
        <>
          <div className="io-row mt-1">
            <span className="io-small">Fill:</span>
            <button type="button" className="tap io-mini" onClick={() => setVolume((v) => Math.max(100, v - 50))}>
              −
            </button>
            <b className="io-readout" data-testid="fill-ml">
              {volume} mL
            </b>
            <button type="button" className="tap io-mini" onClick={() => setVolume((v) => Math.min(1000, v + 50))}>
              +
            </button>
          </div>
          <HoldButton
            testId="fill"
            onTick={(dt) => {
              const cur = runRef.current.bladderMl
              if (cur >= volume) return
              upd({ bladderMl: Math.min(volume, Math.round(cur + dt * 250)) })
            }}
          >
            Hold · run the saline in ({run.bladderMl} mL)
          </HoldButton>
          <Choices
            options={[
              {
                label: run.bladderClamped ? 'CLAMPED ✓' : 'CLAMP THE CATHETER',
                testId: 'clamp',
                on: run.bladderClamped,
                onClick: () => {
                  upd({ bladderClamped: true })
                  feel('Catheter clamped. The full bladder lifts the head off the cord.')
                },
              },
            ]}
          />
        </>
      )}
      <Choices
        options={[
          {
            label: run.terbutaline ? 'TERBUTALINE GIVEN' : 'TERBUTALINE 0.25 MG SC',
            testId: 'terbutaline',
            on: run.terbutaline,
            onClick: () => {
              upd({ terbutaline: true })
              if (c.contractions) feel('Terbutaline in. The contractions ease off.')
              else why('No contractions to stop. Terbutaline is for a delayed birth when the heart stays abnormal after elevation.')
            },
          },
        ]}
      />
      <NextButton onClick={next}>Transfer</NextButton>
    </>
  )
}

/* ================================================================ 7. transfer */

const TRANSFER: { pose: Pose | 'walk'; label: string }[] = [
  { pose: 'lateral', label: 'LEFT LATERAL · HEAD DOWN · PILLOW UNDER LEFT HIP' },
  { pose: 'knee-chest', label: 'KNEE–CHEST ON THE TROLLEY' },
  { pose: 'walk', label: 'SHE WALKS TO THEATRE' },
]

const SAY_BLADDER: SayOption[] = [
  { text: 'Her bladder is full on purpose: unclamp and empty it before the knife.', ok: true },
  { text: 'Leave the bladder full; it helps in theatre.', ok: false },
  { text: 'Take the catheter out now.', ok: false },
]

function Transfer({ run, upd, feel, why, physical, next }: Stage) {
  return (
    <>
      <p className="io-lede">To the labour-ward theatre. How does she travel, and where is your hand?</p>
      <div className="grid grid-cols-3 gap-2">
        {TRANSFER.map((t) => (
          <button
            key={t.pose}
            type="button"
            className="tool"
            data-done={run.transferPose === t.pose || undefined}
            data-testid={`transfer-${t.pose}`}
            onClick={() => {
              upd({ transferPose: t.pose })
              if (t.pose === 'lateral') feel('Exaggerated Sims: left lateral, head tipped down, pillow under the left hip. Your hand is still in.')
              else if (t.pose === 'knee-chest') why('Knee–chest on a moving trolley falls off in the lift. Transfer left lateral, head down.')
              else why('She never walks with a prolapsed cord.')
            }}
          >
            <div className="tool-art w-full">
              <PoseCard pose={t.pose} />
            </div>
            <span className="tool-caption">{t.label}</span>
          </button>
        ))}
      </div>
      <Choices
        options={[
          { label: 'MY HAND STAYS IN', testId: 'hand-stays', on: !run.handOut, onClick: () => feel('You ride on the trolley, hand in, until O&G takes over.') },
          {
            label: 'HAND OUT FOR THE LIFT',
            onClick: () => {
              upd({ handOut: true })
              physical('The head comes back down. The Doppler slows.')
              why('Your hand stays in until the obstetrician takes over, even in the lift.')
            },
          },
        ]}
      />
      {run.bladderMl > 0 && (
        <SayIt
          prompt="Tell theatre about the bladder."
          options={SAY_BLADDER}
          picked={run.saidEmptyBladder}
          onPick={(ok) => {
            upd({ saidEmptyBladder: ok })
            if (!ok) why('A full bladder is in the way of the caesarean. Empty it before the incision.')
          }}
        />
      )}
      <NextButton onClick={next} testId="io-done">
        Hand over to O&amp;G
      </NextButton>
    </>
  )
}
