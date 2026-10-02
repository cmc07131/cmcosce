import { useRef, useState, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, PullStrap, RubTint, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { CLAM_MARKS, HOLE, PHRENIC_X, SPACE, checkClam, freshClam, judgePericardium, judgeSide, type ClamRun } from './model'

const TITLES = ['Left', 'Right', 'Open', 'Pericardium', 'Clot', 'Close']
const SKIN = '#e0b8a0'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<ClamRun> & { next: () => void; cuts: Pt[][]; setCuts: (c: Pt[][]) => void }

/**
 * A clamshell thoracotomy by hand, while the team pours blood in: the left 4th/5th space from the mid-axillary line
 * to the sternum, then the right, divide the sternum, open wide, tent the pericardium and open it longitudinally in
 * front of the phrenic nerve, scoop out the clot, a finger in the hole until the heart beats, then close it.
 */
export function ClamshellProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshClam, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [cuts, setCuts] = useState<Pt[][]>([])
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
    const { marks, faults } = benchMarks(checkClam(r), CLAM_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: r.beating ? 'Tamponade released, the hole plugged: the heart is beating.' : 'No output yet.', scene: r.beating ? [job.scene || 'rosc'] : ['no-rosc'] })
  }
  const stage: Stage = { ...api, next, cuts, setCuts }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="clam-bench">
      <div className="hare-bar">
        <span>TRAUMATIC ARREST</span>
        <span />
        <span>{api.run.beating ? 'OUTPUT' : 'NO PULSE'}</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkClam(api.run)} onContinue={finish} testId="clam-check" />
        ) : (
          <>
            {(index === 0 || index === 1) && <InciseStage {...stage} side={index === 0 ? 'left' : 'right'} />}
            {index === 2 && <OpenStage {...stage} />}
            {index >= 3 && <InsideStage {...stage} stage={index} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

function Front({ svgRef, cuts, live, sternum, open }: { svgRef?: Ref<SVGSVGElement>; cuts: Pt[][]; live?: Pt[] | null; sternum: boolean; open: number }) {
  return (
    <svg ref={svgRef} viewBox="0 0 180 170" className="block h-full w-full select-none" data-testid="clam-front">
      <rect width="180" height="170" fill="#e2e8ec" />
      <path d="M6 20 L174 20 L170 170 L10 170 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      <rect x="84" y="30" width="12" height="96" fill="#e8c8b0" stroke="#b08060" />
      <path d={`M14 ${SPACE(14)} Q90 ${SPACE(90) - 6} 166 ${SPACE(166)}`} stroke="#c09078" strokeDasharray="2 4" fill="none" />
      <circle cx="78" cy="88" r="2" fill="#701010" />
      {cuts.map((c, i) => (
        <polyline key={i} points={c.map((p) => `${p.x},${p.y}`).join(' ')} stroke="#a01818" strokeWidth={2 + open * 8} fill="none" strokeLinecap="round" />
      ))}
      {sternum && <line x1="90" y1={SPACE(90) - 8} x2="90" y2={SPACE(90) + 8} stroke="#303030" strokeWidth="3" />}
      {live && live.length > 1 && <polyline points={live.map((p) => `${p.x},${p.y}`).join(' ')} stroke="#a01818" strokeWidth="2" fill="none" />}
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="14">FROM THE FOOT · HIS LEFT →</text>
        <text x="148" y="166">MAL</text>
        <text x="8" y="166">MAL</text>
      </g>
    </svg>
  )
}

function Inside({ run, svgRef, cut, rub }: { run: ClamRun; svgRef?: Ref<SVGSVGElement>; cut: [Pt, Pt] | null; rub?: ReturnType<typeof useRub> }) {
  const opened = run.pericardium !== null
  return (
    <svg ref={svgRef} viewBox="0 0 180 150" className="block h-full w-full select-none" data-testid="clam-inside">
      <rect width="180" height="150" fill="#5a1010" />
      <ellipse cx="30" cy="80" rx="28" ry="56" fill="#d8a0a8" opacity="0.7" />
      <ellipse cx="160" cy="80" rx="22" ry="56" fill="#d8a0a8" opacity="0.7" />
      {/* the heart, tense in its pericardium until it is opened */}
      <ellipse cx="96" cy="84" rx="48" ry="52" fill={opened ? '#a02828' : '#5a5a98'} stroke="#303050" strokeWidth="2" />
      {opened && run.clot < 0.7 && <ellipse cx="96" cy="84" rx="40" ry="42" fill="#3a0808" opacity={1 - run.clot} />}
      {run.beating && (
        <ellipse cx="96" cy="84" rx="40" ry="44" fill="none" stroke="#f08080" strokeWidth="2">
          <animate attributeName="rx" values="40;36;40" dur="0.7s" repeatCount="indefinite" />
        </ellipse>
      )}
      {opened && run.clot >= 0.7 && !run.closed && (
        <g>
          {!run.plugged && <circle cx={HOLE.x} cy={HOLE.y} r="4" fill="#ff3030" className="hare-pulse" />}
          {run.plugged && <ellipse cx={HOLE.x} cy={HOLE.y} rx="8" ry="5" fill="#d8a080" stroke="#6a3a20" />}
        </g>
      )}
      {run.closed && <path d={`M${HOLE.x - 5} ${HOLE.y - 3} l3 6 l3 -6 l3 6`} stroke="#202020" strokeWidth="1.5" fill="none" />}
      {/* phrenic nerve down the left side of the pericardium (your right) */}
      <line x1={PHRENIC_X} y1="34" x2={PHRENIC_X + 4} y2="134" stroke={run.phrenicCut ? '#a0a0a0' : '#f8f0d0'} strokeWidth="2" strokeDasharray={run.phrenicCut ? '6 4' : undefined} />
      {run.lifted && !opened && <path d="M92 40 L96 30 L100 40" stroke="#c0c8d0" strokeWidth="2" fill="none" />}
      {cut && <line x1={cut[0].x} y1={cut[0].y} x2={cut[1].x} y2={cut[1].y} stroke="#f0f0f0" strokeWidth="1.5" strokeDasharray="3 2" />}
      {rub && <RubTint rub={rub} colour="#a02828" />}
      <g fontFamily={FONT} fontSize="4.5" fill="#f0d8d8">
        <text x="4" y="10">CHEST OPEN · HEAD ↑</text>
        <text x={PHRENIC_X + 6} y="44">PHRENIC</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function InciseStage({ run, upd, feel, why, next, cuts, setCuts, side }: Stage & { side: 'left' | 'right' }) {
  const svg = useRef<SVGSVGElement>(null)
  const path = useRef<Pt[]>([])
  const [live, setLive] = useState<Pt[] | null>(null)
  return (
    <>
      <p className="io-lede">
        {side === 'left' ? 'Big knife: cut along his left 4th/5th intercostal space, from the mid-axillary line to the sternum.' : 'Mirror it on the right, then divide the sternum.'}
      </p>
      <TouchPad
        svg={svg}
        aspect="180 / 170"
        className="mx-auto max-w-[280px]"
        testId={`clam-${side}`}
        onDown={(p) => {
          path.current = [p]
          setLive([p])
        }}
        onMove={(p) => {
          path.current = [...path.current, p]
          setLive(path.current)
        }}
        onUp={() => {
          const pts = path.current
          path.current = []
          setLive(null)
          if (pts.length < 3) return
          const j = judgeSide(pts, side)
          setCuts([...cuts, pts])
          if (!j.ok) return why(j.why ?? '')
          upd({ [side]: true } as Partial<ClamRun>)
          feel(side === 'left' ? 'One long sweep through skin, muscle and the intercostals into the chest. Dark blood.' : 'The right side opened the same way.')
        }}
      >
        <Front svgRef={svg} cuts={cuts} live={live} sternum={!!run.sternum} open={0} />
      </TouchPad>
      {side === 'right' && (
        <div className="io-choices mt-2">
          <button type="button" className="tap io-mini" data-on={run.sternum === 'saw' || undefined} data-testid="clam-saw" onClick={() => (upd({ sternum: 'saw' }), feel('The Gigli saw passed under the sternum and drawn through.'))}>
            GIGLI SAW THROUGH THE STERNUM
          </button>
          <button type="button" className="tap io-mini" data-on={run.sternum === 'shears' || undefined} data-testid="clam-shears" onClick={() => (upd({ sternum: 'shears' }), feel('Heavy shears snap through the sternum.'))}>
            HEAVY SHEARS THROUGH THE STERNUM
          </button>
        </div>
      )}
      <NextButton onClick={next} testId="clam-next">
        {side === 'left' ? 'Right' : 'Open'}
      </NextButton>
    </>
  )
}

function OpenStage({ run, upd, feel, next, cuts }: Stage) {
  return (
    <>
      <p className="io-lede">Retractor in. Open the clamshell wide.</p>
      <div className="io-figure mx-auto aspect-[180/170] max-w-[260px]">
        <Front cuts={cuts} sternum={!!run.sternum} open={run.open} />
      </div>
      <PullStrap label="RETRACTOR" value={run.open} testId="clam-retract" disabled={!run.left} onChange={(v) => upd({ open: v })} onRelease={(v) => feel(v >= 0.7 ? 'The chest opens like a clamshell: the heart in its tense, blue pericardium.' : 'Wider: you need to see the whole heart.')} />
      <NextButton onClick={next} testId="clam-next">
        Pericardium
      </NextButton>
    </>
  )
}

function InsideStage({ run, runRef, upd, feel, physical, why, next, stage }: Stage & { stage: number }) {
  const svg = useRef<SVGSVGElement>(null)
  const start = useRef<Pt | null>(null)
  const [cut, setCut] = useState<[Pt, Pt] | null>(null)
  const rub = useRub({ cx: 96, cy: 84, rx: 40, ry: 42 })
  const lede: Record<number, string> = {
    3: 'Tap to tent the pericardium up with toothed forceps, then drag the scissors to open it.',
    4: 'Scoop the clot out with your hand. Find the hole and put a finger over it.',
    5: 'Close the hole.',
  }
  return (
    <>
      <p className="io-lede">{lede[stage]}</p>
      <TouchPad
        svg={svg}
        aspect="180 / 150"
        className="mx-auto max-w-[300px]"
        testId="clam-work"
        onDown={(p) => {
          const cur = runRef.current
          if (stage === 3) {
            if (!cur.lifted) {
              upd({ lifted: true })
              return feel('Toothed forceps pinch up a tent of pericardium, away from the heart.')
            }
            start.current = p
            return
          }
          if (stage === 4) {
            if (cur.clot >= 0.7 && Math.hypot(p.x - HOLE.x, p.y - HOLE.y) < 10) {
              upd({ plugged: true, beating: true })
              buzz(80)
              return feel('A jet of blood from a slit in the right ventricle. Your finger over it: the heart fills… and starts to beat.')
            }
            rub.rub(p)
          }
        }}
        onMove={(p) => {
          if (stage === 3 && start.current) setCut([start.current, p])
          if (stage === 4 && runRef.current.clot < 0.7) {
            rub.rub(p)
            upd({ clot: rub.coverage })
          }
        }}
        onUp={(p) => {
          if (stage === 4 && runRef.current.clot >= 0.7 && !runRef.current.plugged) feel('Handfuls of clot out. Blood spurts from one point on the right ventricle.')
          if (stage !== 3 || !start.current || !p) return
          const s = start.current
          start.current = null
          if (Math.hypot(p.x - s.x, p.y - s.y) < 10) return
          const j = judgePericardium(s, p)
          const how = j.longitudinal ? 'longitudinal' : 'transverse'
          upd({ pericardium: how, phrenicCut: j.crossesPhrenic || j.besideNerve })
          sfx.cursor()
          if (j.crossesPhrenic || j.besideNerve) {
            buzz([60, 40, 60])
            physical('The scissors went through the phrenic nerve.')
            return why('Open it in front of the phrenic nerve, which runs down the side of the pericardium.')
          }
          if (how === 'transverse') return why('Across the front risks the phrenic nerves and the coronary vessels. Open it longitudinally.')
          feel('Opened from top to bottom in front of the phrenic nerve: dark clot bulges out.')
        }}
      >
        <Inside run={run} svgRef={svg} cut={cut} rub={stage === 4 && run.clot < 0.7 ? rub : undefined} />
      </TouchPad>
      {stage === 5 && (
        <div className="io-choices mt-2">
          <button type="button" className="tap io-mini" data-on={run.closed === 'suture' || undefined} data-testid="clam-suture" onClick={() => (upd({ closed: 'suture' }), feel('Interrupted sutures across the slit, under your finger.'))}>
            SUTURE THE HOLE
          </button>
          <button type="button" className="tap io-mini" data-on={run.closed === 'foley' || undefined} data-testid="clam-foley" onClick={() => (upd({ closed: 'foley' }), feel('A Foley catheter through the hole, balloon inflated and pulled gently back: a bridge to theatre.'))}>
            FOLEY BALLOON AS A BRIDGE
          </button>
        </div>
      )}
      <NextButton onClick={next} testId="clam-next">
        {TITLES[stage + 1] ?? 'Finish'}
      </NextButton>
    </>
  )
}
