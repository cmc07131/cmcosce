import { useRef, useState, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, PullStrap, TouchPad, benchMarks } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { BINDER_MARKS, CRESTS_Y, KNEES_Y, LOCK, TROCHANTERS_Y, checkBinder, freshBinder, opened, placement, type BinderRun } from './model'

const TITLES = ['Prepare', 'Slide', 'Feet', 'Tighten', 'Recheck']
const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<BinderRun> & { next: () => void }

/**
 * A pelvic binder by hand: tell her and empty her pockets, slide the binder in under the knees and saw it up to the
 * greater trochanters without rolling her, bring her feet together and tie them, tighten until it locks, write the
 * time, and recheck her pulse and pressure. The open pelvis closes as you get it right.
 */
export function BinderProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshBinder, coach)
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
    const { marks, faults } = benchMarks(checkBinder(r), BINDER_MARKS, job.grantMarks)
    const ok = r.locked && placement(r.binderY) === 'trochanters'
    onDone({ marks, faults, summary: `Binder ${r.locked ? 'locked' : 'loose'} over the ${placement(r.binderY)}.`, scene: ok ? [job.scene || 'binder'] : ['binder-poor'] })
  }
  const stage: Stage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="binder-bench">
      <div className="hare-bar">
        <span>PELVIS {opened(api.run) > 0.5 ? 'OPEN BOOK' : 'CLOSING'}</span>
        <span />
        <span>{api.run.locked ? 'LOCKED' : 'NO BINDER'}</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkBinder(api.run)} onContinue={finish} testId="binder-check" />
        ) : (
          <>
            {index === 0 && <PrepareStage {...stage} />}
            {index === 1 && <SlideStage {...stage} />}
            {index === 2 && <FeetStage {...stage} />}
            {index === 3 && <TightenStage {...stage} />}
            {index === 4 && <RecheckStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

function Body({ run, svgRef, binderY }: { run: BinderRun; svgRef?: Ref<SVGSVGElement>; binderY?: number | null }) {
  const gap = opened(run)
  const feet = 10 + run.feetGap * 26
  const y = binderY ?? run.binderY
  return (
    <svg ref={svgRef} viewBox="0 0 160 220" className="block h-full w-full select-none" data-testid="binder-body">
      <rect width="160" height="220" fill="#e2e8ec" />
      <path d="M44 0 L116 0 L122 60 L130 104 L118 220 L42 220 L30 104 L38 60 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      {/* the pelvis, sprung open */}
      <path d={`M${44 - gap * 6} ${CRESTS_Y} Q80 ${CRESTS_Y - 12} ${116 + gap * 6} ${CRESTS_Y}`} stroke="#b08060" strokeWidth="2" fill="none" />
      <line x1={80 - 2 - gap * 7} y1={TROCHANTERS_Y - 6} x2={80 - 2 - gap * 7} y2={TROCHANTERS_Y + 6} stroke="#b08060" strokeWidth="2" />
      <line x1={80 + 2 + gap * 7} y1={TROCHANTERS_Y - 6} x2={80 + 2 + gap * 7} y2={TROCHANTERS_Y + 6} stroke="#b08060" strokeWidth="2" />
      <circle cx={28 - gap * 3} cy={TROCHANTERS_Y} r="5" fill={SKIN} stroke={SKIN_EDGE} />
      <circle cx={132 + gap * 3} cy={TROCHANTERS_Y} r="5" fill={SKIN} stroke={SKIN_EDGE} />
      {/* legs and feet: rolled out and apart until you bring them together */}
      <line x1="80" y1="120" x2="80" y2="220" stroke={SKIN_EDGE} strokeWidth="1" />
      <ellipse cx={80 - feet} cy="212" rx="8" ry="6" fill={SKIN} stroke={SKIN_EDGE} transform={`rotate(${run.feetGap * -30} ${80 - feet} 212)`} />
      <ellipse cx={80 + feet} cy="212" rx="8" ry="6" fill={SKIN} stroke={SKIN_EDGE} transform={`rotate(${run.feetGap * 30} ${80 + feet} 212)`} />
      {run.tied && <rect x="70" y="204" width="20" height="5" fill="#f8f8f8" stroke="#808080" />}
      <line x1="40" y1={KNEES_Y} x2="120" y2={KNEES_Y} stroke={SKIN_EDGE} strokeDasharray="2 3" opacity="0.5" />
      {y !== null && y !== undefined && (
        <g>
          <rect x="20" y={y - 12} width="120" height="24" rx="4" fill="#303848" opacity="0.9" />
          <rect x="74" y={y - 8} width="12" height="16" fill="#e8c030" />
          {run.timed && (
            <text x="92" y={y + 3} fontFamily={FONT} fontSize="5" fill="#f8f8f8">
              14:32
            </text>
          )}
        </g>
      )}
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="2" y="8">FROM ABOVE · HEAD ↑</text>
        <text x="2" y={CRESTS_Y + 2}>CRESTS</text>
        <text x="2" y={TROCHANTERS_Y + 14}>TROCH.</text>
        <text x="2" y={KNEES_Y - 3}>KNEES</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function PrepareStage({ run, upd, feel, physical, why, next }: Stage) {
  return (
    <>
      <p className="io-lede">She is in pain and frightened. Tell her what you are doing; make sure nothing hard ends up under the binder.</p>
      <div className="io-figure mx-auto aspect-[160/220] max-w-[200px]">
        <Body run={run} />
      </div>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.explained || undefined} data-testid="binder-explain" onClick={() => (upd({ explained: true }), feel('"We are going to wrap a firm belt round your hips to hold the bones still and slow the bleeding."'))}>
          {run.explained ? 'EXPLAINED ✓' : 'EXPLAIN'}
        </button>
        <button type="button" className="tap io-mini" data-on={run.pockets || undefined} data-testid="binder-pockets" onClick={() => (upd({ pockets: true }), feel('A phone and a bunch of keys out of her pockets; her belt cut off.'))}>
          {run.pockets ? 'POCKETS EMPTY ✓' : 'EMPTY POCKETS, BELT OFF'}
        </button>
      </div>
      <NextButton onClick={next} testId="binder-next">
        Slide
      </NextButton>
    </>
  )
}

function SlideStage({ run, runRef, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [y, setY] = useState<number | null>(run.binderY)
  const startedLow = useRef(false)
  return (
    <>
      <p className="io-lede">Slide the binder under her knees, then work it up under her, side to side, to where it should sit. Drag it.</p>
      <TouchPad
        svg={svg}
        aspect="160 / 220"
        className="mx-auto max-w-[220px]"
        testId="binder-slide"
        onDown={(p) => {
          startedLow.current = p.y >= KNEES_Y - 16 || runRef.current.slidFromKnees
          if (!startedLow.current) return feel('Start at the knees: there is a gap under them to slide it through.')
          setY(p.y)
        }}
        onMove={(p) => startedLow.current && setY(Math.max(30, Math.min(KNEES_Y, p.y)))}
        onUp={() => {
          if (!startedLow.current || y === null) return
          upd({ binderY: y, slidFromKnees: true })
          sfx.cursor()
          const where = placement(y)
          if (where === 'trochanters') feel('Centred over the greater trochanters, the bumps at the sides of the hips.')
          else if (where === 'crests') why('That is over the iliac crests: too high. It can splay the pelvis further open. Down to the trochanters.')
          else why('Still on the thighs. Up to the greater trochanters.')
        }}
      >
        <Body run={run} svgRef={svg} binderY={y} />
      </TouchPad>
      <NextButton onClick={next} testId="binder-next">
        Feet
      </NextButton>
    </>
  )
}

function FeetStage({ run, runRef, upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const grip = useRef<number | null>(null)
  return (
    <>
      <p className="io-lede">Her legs lie rolled out. Drag her feet together, then tie them.</p>
      <TouchPad
        svg={svg}
        aspect="160 / 220"
        className="mx-auto max-w-[220px]"
        testId="binder-feet"
        onDown={(p) => (grip.current = p.y > 180 ? p.x : null)}
        onMove={(p) => {
          if (grip.current === null) return
          const gap = Math.max(0, Math.min(1, (Math.abs(p.x - 80) - 10) / 26))
          upd({ feetGap: gap })
        }}
        onUp={() => {
          grip.current = null
          if (runRef.current.feetGap < 0.2) feel('Feet and knees together, the legs rolled in.')
        }}
      >
        <Body run={run} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.tied || undefined} data-testid="binder-tie" onClick={() => (run.feetGap < 0.2 ? (upd({ tied: true }), feel('Tied at the ankles with a bandage, padding between.')) : feel('Bring them together first.'))}>
          {run.tied ? 'TIED ✓' : 'TIE THE FEET TOGETHER'}
        </button>
      </div>
      <NextButton onClick={next} testId="binder-next">
        Tighten
      </NextButton>
    </>
  )
}

function TightenStage({ run, runRef, upd, feel, next }: Stage) {
  return (
    <>
      <p className="io-lede">Pull the strap through until it locks. Then write the time on it.</p>
      <div className="io-figure mx-auto aspect-[160/220] max-w-[200px]">
        <Body run={run} />
      </div>
      <PullStrap
        label="BINDER STRAP"
        value={run.tension}
        disabled={run.binderY === null}
        testId="binder-strap"
        onChange={(v) => {
          const cur = runRef.current
          if (cur.locked) return
          upd({ tension: v, locked: v >= LOCK })
          if (v >= LOCK) {
            buzz(40)
            feel('Click: it locks. You feel the pelvis close under your hands.')
          }
        }}
        onRelease={(v) => !runRef.current.locked && feel(v < LOCK ? 'Not tight enough to lock.' : 'Locked.')}
      />
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.timed || undefined} data-testid="binder-time" onClick={() => (upd({ timed: true }), feel('"14:32" in marker on the binder.'))}>
          {run.timed ? 'TIME WRITTEN ✓' : 'WRITE THE TIME ON THE BINDER'}
        </button>
      </div>
      <NextButton onClick={next} testId="binder-next">
        Recheck
      </NextButton>
    </>
  )
}

function RecheckStage({ run, upd, feel, next }: Stage) {
  const good = run.locked && placement(run.binderY) === 'trochanters'
  return (
    <>
      <p className="io-lede">Did it help?</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.rechecked || undefined} data-testid="binder-recheck" onClick={() => (upd({ rechecked: true }), feel(good ? 'HR 124, BP 92/56: a little better. Keep the blood going.' : 'HR 140, BP 74/40: no better.'))}>
          {run.rechecked ? 'RECHECKED ✓' : 'PULSE AND BLOOD PRESSURE'}
        </button>
      </div>
      <NextButton onClick={next} testId="binder-next">
        Finish
      </NextButton>
    </>
  )
}
