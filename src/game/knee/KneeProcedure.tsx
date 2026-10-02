import { useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, RubTint, Syringe, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { KneeAxial, KneeFront } from './art'
import { KNEE_MARKS, checkKnee, draw, freshKnee, inSyringe, milk, remaining, siteAt, tipRegion, type KneeRun, type Pot } from './model'

const TITLES = ['Examine', 'Mark', 'Clean', 'Local', 'Aspirate', 'Samples', 'Finish']

type Stage = BenchApi<KneeRun> & { next: () => void; mark: Pt | null; setMark: (p: Pt | null) => void }

/**
 * Knee aspiration by hand: consent and look, confirm the effusion, mark a lateral site clear of the cellulitis, clean,
 * raise a skin wheal, steer the needle under the patella, draw the fluid (milking the pouch when it stops), fill the
 * pots, then dress and send. Nothing stops you injecting steroid or going through the cellulitis.
 */
export function KneeProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshKnee, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [mark, setMark] = useState<Pt | null>(null)
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
    const { marks, faults } = benchMarks(checkKnee(r), KNEE_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: `Knee aspiration: ${r.drawn.toFixed(0)} mL of turbid fluid from the ${r.site ?? 'unmarked'} site into ${r.pots.length} pots.` })
  }
  const stage: Stage = { ...api, next, mark, setMark }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="knee-bench">
      <div className="hare-bar">
        <span>MR PATEL · 38.9 °C</span>
        <span />
        <span>{api.run.drawn.toFixed(0)} ML DRAWN</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkKnee(api.run)} onContinue={finish} testId="knee-check" />
        ) : (
          <>
            {index === 0 && <ExamineStage {...stage} />}
            {index === 1 && <MarkStage {...stage} />}
            {index === 2 && <CleanStage {...stage} />}
            {index === 3 && <LocalStage {...stage} />}
            {index === 4 && <AspirateStage {...stage} />}
            {index === 5 && <SampleStage {...stage} />}
            {index === 6 && <FinishStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

function ExamineStage({ run, upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const btn = (key: 'consent' | 'askedProsthesis' | 'extended', text: string, line: string) => (
    <button
      type="button"
      className="tap io-mini"
      data-on={run[key] || undefined}
      data-testid={`knee-${key}`}
      onClick={() => {
        upd({ [key]: true } as Partial<KneeRun>)
        feel(line)
      }}
    >
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Explain and consent. Look at the skin, and press on the patella to feel for an effusion.</p>
      <TouchPad
        svg={svg}
        aspect="1 / 1"
        className="mx-auto max-w-[260px]"
        testId="knee-examine"
        onDown={(p) => {
          const s = siteAt(p)
          if (s === 'cellulitis') {
            upd({ sawSkin: true })
            return feel('Red, hot, tender skin spreading over the medial side and below the patella: cellulitis. Not through there.')
          }
          if (s === 'patella') {
            if (!run.extended) return feel('The knee is bent and his thigh tense: the patella will not move. Straighten and relax it first.')
            upd({ tapped: true })
            return feel('You sweep the pouch down and press the patella: it bounces off the femur. A large effusion.')
          }
          upd({ sawSkin: true })
          feel('Warm and swollen; the lateral skin is intact and not red. No scar from a joint replacement.')
        }}
      >
        <KneeFront svgRef={svg} extended={run.extended} />
      </TouchPad>
      <div className="io-choices mt-2">
        {btn('consent', 'EXPLAIN AND CONSENT', '"I\'d like to take some fluid from the knee with a needle to find out if it\'s infected." He agrees.')}
        {btn('askedProsthesis', '“ANY KNEE REPLACEMENT?”', '"No, just the old injury." No replacement: you can aspirate it here.')}
        {btn('extended', 'STRAIGHTEN AND RELAX THE KNEE', 'Knee straight on the bed, a towel under it, thigh muscles relaxed.')}
      </div>
      <NextButton onClick={next} testId="knee-next">
        Mark
      </NextButton>
    </>
  )
}

function MarkStage({ run, upd, feel, why, next, mark, setMark }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  return (
    <>
      <p className="io-lede">Feel the edge of the patella and mark your entry point with the pen.</p>
      <TouchPad
        svg={svg}
        aspect="1 / 1"
        className="mx-auto max-w-[260px]"
        testId="knee-mark"
        onDown={(p) => {
          const s = siteAt(p)
          setMark(p)
          upd({ site: s })
          sfx.cursor()
          if (s === 'superolateral') feel('Marked just above and lateral to the superolateral corner of the patella.')
          else if (s === 'lateral') feel('Marked at the lateral edge, halfway down the patella.')
          else if (s === 'cellulitis') why('That is cellulitic skin. You would carry the infection into the joint.')
          else if (s === 'patella') why('That is on the patella itself: bone.')
          else if (s === 'tendon') why('That is the patellar tendon. Go in laterally, under the patella.')
          else why('Too far from the joint. Use the edge of the patella as your landmark.')
        }}
      >
        <KneeFront svgRef={svg} extended={run.extended} mark={mark} />
      </TouchPad>
      <NextButton onClick={next} testId="knee-next">
        Clean
      </NextButton>
    </>
  )
}

function CleanStage({ upd, feel, next, mark, run }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const centre = mark ?? { x: 72, y: 80 }
  const rub = useRub({ cx: centre.x, cy: centre.y, rx: 26, ry: 26 })
  const said = useRef(false)
  return (
    <>
      <p className="io-lede">Sterile gloves. Rub chlorhexidine around your mark, wide, and let it dry.</p>
      <TouchPad
        svg={svg}
        aspect="1 / 1"
        className="mx-auto max-w-[260px]"
        testId="knee-clean"
        onDown={(p) => rub.rub(p)}
        onMove={(p) => {
          rub.rub(p)
          upd({ cleaned: rub.coverage })
          if (rub.coverage >= 0.7 && !said.current) {
            said.current = true
            feel('Clean around the mark. You do not touch it again.')
          }
        }}
      >
        <KneeFront svgRef={svg} extended={run.extended} mark={mark}>
          <RubTint rub={rub} />
        </KneeFront>
      </TouchPad>
      <NextButton onClick={next} testId="knee-next">
        Local
      </NextButton>
    </>
  )
}

function LocalStage({ run, upd, feel, next }: Stage) {
  return (
    <>
      <p className="io-lede">Orange needle at the mark, 1% lidocaine: raise a skin wheal.</p>
      <Syringe
        capacity={5}
        drug={Math.max(0, 5 - run.wheal)}
        drugLabel="1% lidocaine"
        testId="knee-local"
        onPull={() => ({ kind: 'none' })}
        onInject={(ml) => {
          upd((c) => ({ wheal: c.wheal + ml }))
          return true
        }}
        onRelease={() => run.wheal > 0 && feel('A pale wheal rises under the skin at the mark. He says it stings.')}
      />
      <NextButton onClick={next} testId="knee-next">
        Aspirate
      </NextButton>
    </>
  )
}

function AspirateStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const last = useRef<string>('')
  const r = run
  function steer(p: Pt) {
    const reg = tipRegion(p, remaining(runRef.current))
    const prev = runRef.current.region
    upd((c) => ({ tip: p, region: reg, boneHits: c.boneHits + (reg === 'bone' && prev !== 'bone' ? 1 : 0) }))
    if (reg === last.current) return
    last.current = reg
    if (reg === 'bone') {
      buzz(30)
      physical('Hard: the tip is on bone. Withdraw a little and angle under the patella.')
    } else if (reg === 'fluid') feel('A give as the tip enters the joint, under the patella.')
    else if (reg === 'soft') feel('The needle is in the soft tissue beside the patella.')
  }
  return (
    <>
      <p className="io-lede">Drag the needle in from the lateral side, under the patella, aspirating as you go.</p>
      <TouchPad svg={svg} aspect="240 / 140" testId="knee-aspirate" onDown={steer} onMove={steer}>
        <KneeAxial svgRef={svg} tip={r.tip} remaining={remaining(r)} />
      </TouchPad>
      <Syringe
        capacity={20}
        drug={0}
        drawn={inSyringe(r)}
        drawnColour="#e8d070"
        disabled={!r.tip}
        testId="knee-syringe"
        onPull={(ml) => {
          const res = draw(runRef.current, ml)
          upd(res.patch)
          return { kind: res.kind }
        }}
        onInject={() => {
          why('Never push fluid back into an infected joint.')
          return false
        }}
        onRelease={() => {
          const cur = runRef.current
          if (cur.region !== 'fluid') return feel(cur.drawn ? 'Nothing more comes.' : 'Nothing comes back: you are not in the joint.')
          if (cur.drawn >= cur.reachable) feel('The flow stops. Squeeze the pouch above the patella toward the needle.')
          else feel('Turbid yellow fluid fills the syringe.')
        }}
      />
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="knee-milk"
          onClick={() => {
            upd(milk(runRef.current))
            feel('Your other hand presses the suprapatellar pouch down toward the needle.')
          }}
        >
          MILK THE POUCH
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="knee-steroid"
          onClick={() => {
            upd({ steroid: true })
            buzz([60, 40, 60])
            physical('You inject triamcinolone into the joint.')
            why('Never steroid into a joint that may be septic: it feeds the infection.')
          }}
        >
          INJECT TRIAMCINOLONE
        </button>
      </div>
      <NextButton onClick={next} testId="knee-next">
        Samples
      </NextButton>
    </>
  )
}

const POTS: { id: Pot; label: string; line: string }[] = [
  { id: 'gram', label: 'STERILE POT: GRAM AND CULTURE', line: 'Sterile pot for Gram stain and culture: filled and labelled.' },
  { id: 'count', label: 'EDTA: CELL COUNT', line: 'EDTA tube for the cell count: filled and labelled.' },
  { id: 'crystals', label: 'PLAIN: CRYSTALS', line: 'Plain tube for crystals: filled and labelled.' },
  { id: 'bc', label: 'BLOOD CULTURE BOTTLES', line: 'Synovial fluid into a pair of blood culture bottles: better yield for culture.' },
]

function SampleStage({ run, upd, feel, physical, next }: Stage) {
  return (
    <>
      <p className="io-lede">{inSyringe(run).toFixed(0)} mL in the syringe. Fill the pots, about 5 mL each.</p>
      <div className="io-choices" data-testid="knee-pots">
        {POTS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="tap io-mini"
            data-on={run.pots.includes(p.id) || undefined}
            data-testid={`knee-pot-${p.id}`}
            onClick={() => {
              if (run.pots.includes(p.id)) return
              if (inSyringe(run) < 2) return physical('The syringe is empty. Draw more first.')
              upd({ pots: [...run.pots, p.id] })
              sfx.cursor()
              feel(p.line)
            }}
          >
            {run.pots.includes(p.id) ? `${p.label} ✓` : p.label}
          </button>
        ))}
      </div>
      <NextButton onClick={next} testId="knee-next">
        Finish
      </NextButton>
    </>
  )
}

function FinishStage({ run, upd, feel, next }: Stage) {
  return (
    <>
      <p className="io-lede">Needle out. Then the samples.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.dressed || undefined} data-testid="knee-dress" onClick={() => (upd({ dressed: true }), feel('Pressure for a minute, then a sterile dressing.'))}>
          {run.dressed ? 'DRESSED ✓' : 'PRESSURE AND DRESSING'}
        </button>
        <button type="button" className="tap io-mini" data-on={run.sent || undefined} data-testid="knee-send" onClick={() => (upd({ sent: true }), feel('Porter called: urgent Gram stain, cell count and crystals; the lab is phoned.'))}>
          {run.sent ? 'SENT ✓' : 'SEND URGENTLY'}
        </button>
      </div>
      <NextButton onClick={next} testId="knee-next">
        Done
      </NextButton>
    </>
  )
}
