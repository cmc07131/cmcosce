import { useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, RubTint, Syringe, TouchPad, benchMarks, useRub } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { GroinView, UsImage, panOf, probeZone } from './art'
import {
  ALIQUOT_ML,
  BLOCK_MARKS,
  MAX_MG,
  MG_PER_ML,
  TARGET_ML,
  WEIGHT_KG,
  checkBlock,
  featureAt,
  freshBlock,
  inject,
  moveTip,
  toxicity,
  totalMl,
  underFasciaMl,
  type BlockRun,
  type Feature,
  type Pt,
  type Region,
} from './model'

const TITLES = ['Prepare', 'Scan', 'Identify', 'Needle', 'Inject', 'After']

type Stage = BenchApi<BlockRun> & { next: () => void }

const REGION_FEEL: Partial<Record<Region, string>> = {
  subcut: 'The tip is in the subcutaneous fat.',
  above: 'Through the fascia lata, in the plane above the fascia iliaca.',
  target: 'A second pop: the tip sits just under the fascia iliaca, lateral to the nerve.',
  medial: 'Under the fascia, but right next to the nerve and the artery.',
  muscle: 'The tip is deep in the iliacus muscle.',
}

/**
 * An ultrasound-guided fascia iliaca block by hand: clean and cover the probe, find the image below the inguinal
 * ligament, name the artery, nerve and fascia, steer the needle in plane under the fascia, test with 2 mL and watch
 * it lift, then inject in aliquots with aspiration. Mrs Ma tells you when something goes wrong.
 */
export function UsBlockProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshBlock, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  const next = () => {
    sfx.select()
    if (index < TITLES.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const { marks, faults } = benchMarks(checkBlock(r), BLOCK_MARKS, job.grantMarks)
    const ok = underFasciaMl(r) >= 30
    onDone({ marks, faults, summary: `Fascia iliaca block: ${totalMl(r).toFixed(0)} mL of 0.25% levobupivacaine, ${underFasciaMl(r).toFixed(0)} mL under the fascia.`, scene: ok ? [job.scene || 'block'] : ['block-failed'] })
  }
  const stage: Stage = { ...api, next }
  const mg = totalMl(api.run) * MG_PER_ML
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="usblock-bench">
      <div className="hare-bar">
        <span>MRS MA · {WEIGHT_KG} KG</span>
        <span />
        <span>
          {totalMl(api.run).toFixed(0)} ML · {mg.toFixed(0)}/{MAX_MG} MG
        </span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkBlock(api.run)} onContinue={finish} testId="usblock-check" />
        ) : (
          <>
            {index === 0 && <PrepareStage {...stage} />}
            {index === 1 && <ScanStage {...stage} />}
            {index === 2 && <IdentifyStage {...stage} />}
            {(index === 3 || index === 4) && <NeedleStage {...stage} inject={index === 4} />}
            {index === 5 && <AfterStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ================================================================ 1. prepare */

function PrepareStage({ run, upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const rub = useRub({ cx: 128, cy: 86, rx: 54, ry: 30 })
  const said = useRef(false)
  return (
    <>
      <p className="io-lede">Rub chlorhexidine over the groin below the ligament. Put the probe in a sterile cover with gel.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 160"
        className="mx-auto max-w-[280px]"
        testId="usblock-clean"
        onDown={(p) => rub.rub(p)}
        onMove={(p) => {
          rub.rub(p)
          upd({ cleaned: rub.coverage })
          if (rub.coverage >= 0.7 && !said.current) {
            said.current = true
            feel('The groin is clean from the ligament down.')
          }
        }}
        onUp={() => upd({ cleaned: rub.coverage })}
      >
        <GroinView svgRef={svg}>
          <RubTint rub={rub} />
        </GroinView>
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.cover || undefined}
          data-testid="usblock-cover"
          onClick={() => {
            upd({ cover: true })
            feel('Gel inside a sterile sheath, the probe slid in, sterile gel on the outside.')
          }}
        >
          {run.cover ? 'PROBE COVERED ✓' : 'STERILE COVER AND GEL ON THE PROBE'}
        </button>
      </div>
      <NextButton onClick={next} testId="usblock-next">
        Scan
      </NextButton>
    </>
  )
}

/* ================================================================ 2. scan */

function ScanStage({ run, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [probe, setProbe] = useState<Pt | null>(null)
  const [pulse, setPulse] = useState(false)
  return (
    <>
      <p className="io-lede">Feel for the femoral pulse. Drag the probe onto the groin, transverse, and find the image you need.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 160"
        className="mx-auto max-w-[280px]"
        testId="usblock-scan"
        onDown={(p) => setProbe(p)}
        onMove={(p) => {
          setProbe(p)
          upd({ probe: probeZone(p) })
        }}
        onUp={(p) => {
          if (!p) return
          const zone = probeZone(p)
          upd({ probe: zone })
          if (zone === 'above') why('Above the inguinal ligament you are looking at bowel. Below it, at the femoral crease.')
          else if (zone === 'medial') feel('The vessels fill the middle of the screen: the vein medially, the artery, the nerve just lateral. Slide laterally.')
          else if (zone === 'lateral') feel('Only muscle: the artery has gone off the medial edge. Slide back medially.')
          else feel('The artery at the medial edge, the nerve beside it, the fascia iliaca running laterally over the iliacus.')
        }}
      >
        <GroinView svgRef={svg} probe={probe} pulse={pulse} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="usblock-pulse"
          onClick={() => {
            setPulse(true)
            feel('The femoral pulse, just below the midpoint of the ligament.')
          }}
        >
          FEEL THE FEMORAL PULSE
        </button>
      </div>
      <div className="io-figure mt-2 aspect-[240/160]">
        <UsImage probe={run.probe} doppler={run.doppler} />
      </div>
      <NextButton onClick={next} testId="usblock-next">
        Identify
      </NextButton>
    </>
  )
}

/* ================================================================ 3. identify */

const NAMES: Record<Feature, string> = { artery: 'FEMORAL ARTERY', vein: 'FEMORAL VEIN', nerve: 'FEMORAL NERVE', fascia: 'FASCIA ILIACA' }

function IdentifyStage({ run, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [labels, setLabels] = useState<{ p: Pt; text: string }[]>([])
  const pan = panOf(run.probe)
  return (
    <>
      <p className="io-lede">Tap each structure to name it: the artery, the nerve, and the fascia iliaca. Colour Doppler confirms a vessel.</p>
      <TouchPad
        svg={svg}
        aspect="240 / 160"
        testId="usblock-identify"
        onDown={(p) => {
          const base = { x: p.x - pan, y: p.y }
          const f = featureAt(base)
          if (!f) {
            upd((r) => ({ misnamed: r.misnamed + 1 }))
            return feel('Speckle and muscle. Nothing to name there.')
          }
          sfx.cursor()
          setLabels((l) => (l.some((x) => x.text === NAMES[f]) ? l : [...l, { p: base, text: NAMES[f] }]))
          upd((r) => ({ named: r.named.includes(f) ? r.named : [...r.named, f] }))
          if (f === 'artery') feel('Round, black and pulsing, and it does not compress: the femoral artery.')
          if (f === 'vein') feel('Larger, medial, and it squashes flat when you press: the femoral vein.')
          if (f === 'nerve') feel('A bright honeycomb triangle under the fascia, lateral to the artery: the femoral nerve.')
          if (f === 'fascia') feel('The bright line over the iliacus, running laterally: the fascia iliaca. That is your plane.')
          if (run.probe !== 'good') why('Get the right image first: the artery at the medial edge, the iliacus laterally.')
        }}
      >
        <UsImage probe={run.probe} doppler={run.doppler} svgRef={svg} labels={labels} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.doppler || undefined}
          data-testid="usblock-doppler"
          onClick={() => {
            upd({ doppler: !run.doppler })
            feel(run.doppler ? 'Doppler off.' : 'Colour Doppler: pulsatile red in the artery, steady blue in the vein. Nothing in the nerve.')
          }}
        >
          COLOUR DOPPLER
        </button>
      </div>
      <p className="io-small">Named: {run.named.map((n) => NAMES[n].toLowerCase()).join(', ') || 'nothing yet'}</p>
      <NextButton onClick={next} testId="usblock-next">
        Needle
      </NextButton>
    </>
  )
}

/* ================================================================ 4 and 5. needle and inject */

function NeedleStage({ run, runRef, upd, feel, physical, why, next, inject: injecting }: Stage & { inject: boolean }) {
  const svg = useRef<SVGSVGElement>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const lastRegion = useRef<Region | null>(run.region)
  const pushed = useRef(false)
  const pan = panOf(run.probe)
  const r = run
  const syringeLeft = r.syringe === 1 ? 20 - totalMl(r) : 20 - (totalMl(r) - r.swapAt)
  const pools = { under: underFasciaMl(r), above: (r.injected.above ?? 0) + (r.injected.subcut ?? 0), muscle: r.injected.muscle ?? 0, at: r.tip }

  function steer(p: Pt) {
    const base = { x: p.x - pan, y: Math.max(1, p.y) }
    const { patch, event } = moveTip(runRef.current, base)
    upd(patch)
    setFlash(null)
    const cur = runRef.current
    if (cur.plane !== 'in' && !injecting) {
      if (lastRegion.current !== 'subcut') why('Out of plane you cannot see the shaft or the tip. Never advance a needle you cannot see.')
      lastRegion.current = cur.region
      return
    }
    if (event === 'nerve') {
      if (lastRegion.current !== 'nerve') {
        buzz([40, 30, 40])
        physical('"Ah! An electric shock down my leg!" The tip is in the nerve. Pull back.')
      }
    } else if (event === 'vessel') {
      if (lastRegion.current !== cur.region) physical('The tip slips into the vessel.')
    } else if (event === 'pop') feel(cur.pops >= 2 ? 'A second pop.' : 'A pop through the fascia lata.')
    else if (cur.region && cur.region !== lastRegion.current && REGION_FEEL[cur.region]) feel(REGION_FEEL[cur.region]!)
    lastRegion.current = cur.region
  }

  return (
    <>
      <p className="io-lede">
        {injecting
          ? `Aspirate, then 2 mL and watch where it goes. Then the rest in ${ALIQUOT_ML} mL aliquots, aspirating between. You can still move the needle.`
          : 'Choose your approach, then drag the needle in from the lateral side, watching the tip all the way.'}
      </p>
      {!injecting && (
        <div className="io-choices">
          {(['in', 'out'] as const).map((pl) => (
            <button
              key={pl}
              type="button"
              className="tap io-mini"
              data-on={r.plane === pl || undefined}
              data-testid={`usblock-plane-${pl}`}
              onClick={() => {
                upd({ plane: pl })
                feel(pl === 'in' ? 'The needle lined up along the long axis of the probe, from lateral: you see the whole shaft.' : 'Out of plane: the needle crosses the beam at one point only.')
              }}
            >
              {pl === 'in' ? 'IN-PLANE, FROM LATERAL' : 'OUT-OF-PLANE'}
            </button>
          ))}
        </div>
      )}
      <TouchPad svg={svg} aspect="240 / 160" className="mt-2" testId="usblock-needle" onDown={steer} onMove={steer}>
        <UsImage probe={r.probe} doppler={r.doppler} tip={r.tip} plane={r.plane} pools={pools} svgRef={svg} />
      </TouchPad>
      {injecting && (
        <>
          <Syringe
            capacity={20}
            drug={Math.max(0, syringeLeft)}
            drugLabel="0.25% levobupivacaine"
            flash={flash}
            disabled={!r.tip}
            testId="usblock-syringe"
            onPull={() => {
              const cur = runRef.current
              upd((c) => ({ aspirations: c.aspirations + 1, sinceAspirate: 0 }))
              if (cur.region === 'artery') {
                setFlash('#e02020')
                physical('Bright red blood pulses back: the artery. Do not inject. Withdraw.')
                return { kind: 'blood' }
              }
              if (cur.region === 'vein') {
                setFlash('#601010')
                physical('Dark blood: you are in the vein. Withdraw.')
                return { kind: 'blood' }
              }
              feel('Negative aspiration: no blood.')
              return { kind: 'none' }
            }}
            onInject={(ml) => {
              const cur = runRef.current
              if (cur.region === 'nerve') {
                buzz(60)
                physical('High resistance, and she cries out with pain down the thigh. Stop: the tip is in the nerve.')
                return false
              }
              const res = inject(cur, ml)
              if (!res.ok) return false
              pushed.current = true
              upd(res.patch)
              return true
            }}
            onRelease={() => {
              if (!pushed.current) return
              pushed.current = false
              const cur = runRef.current
              const tox = toxicity(cur)
              if (tox) {
                buzz([60, 40, 60])
                return physical(tox)
              }
              if (cur.sinceAspirate > ALIQUOT_ML + 1) return why(`${cur.sinceAspirate.toFixed(0)} mL without aspirating. ${ALIQUOT_ML} mL at a time, aspirate between.`)
              const where = cur.region
              if (where === 'target' || where === 'medial') feel(underFasciaMl(cur) < 4 ? 'The fascia lifts off the iliacus as a black lens opens under it: hydrodissection.' : 'The pool spreads under the fascia, medially toward the nerve.')
              else if (where === 'above' || where === 'subcut') why('The fluid spreads above the fascia iliaca: wrong plane. Advance through the fascia.')
              else if (where === 'muscle') why('The muscle swells, no plane opens: too deep. Withdraw until the tip is just under the fascia.')
              else if (where === 'artery' || where === 'vein') physical('Nothing spreads on the screen: it is going into the vessel.')
            }}
          />
          <div className="io-choices mt-2">
            <button
              type="button"
              className="tap io-mini"
              data-testid="usblock-refill"
              disabled={syringeLeft > 5 || r.syringe >= 2}
              onClick={() => {
                upd((c) => ({ syringe: 2, swapAt: totalMl(c) }))
                feel('The second 20 mL syringe on the extension, keeping the needle still.')
              }}
            >
              SECOND SYRINGE
            </button>
          </div>
          <p className="io-small">
            {totalMl(r).toFixed(0)}/{TARGET_ML} mL · {underFasciaMl(r).toFixed(0)} mL under the fascia
          </p>
        </>
      )}
      <NextButton onClick={next} testId="usblock-next">
        {injecting ? 'After' : 'Inject'}
      </NextButton>
    </>
  )
}

/* ================================================================ 6. after */

function AfterStage({ run, upd, feel, next }: Stage) {
  const btn = (key: 'labelled' | 'observed' | 'documented', text: string, line: string) => (
    <button
      type="button"
      className="tap io-mini"
      data-on={run[key] || undefined}
      data-testid={`usblock-${key}`}
      onClick={() => {
        upd({ [key]: true } as Partial<BlockRun>)
        feel(line)
      }}
    >
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Needle out, pressure, dressing. Then make it safe for the next team.</p>
      <div className="io-choices">
        {btn('labelled', 'LABEL HER WRISTBAND', '"FIB, levobupivacaine 0.25% 40 mL, 14:20" on her wristband.')}
        {btn('observed', 'OBSERVE FOR TOXICITY', 'Monitoring on for 30 minutes; the nurse knows to ask about tingling lips, tinnitus, and to call you.')}
        {btn('documented', 'DOCUMENT', 'Drug, dose, time, approach, aspiration, spread, complications: none.')}
      </div>
      <NextButton onClick={next} testId="usblock-next">
        Finish
      </NextButton>
    </>
  )
}
