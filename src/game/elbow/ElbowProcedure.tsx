import { useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench } from '../bench/core'
import { CheckCard, TouchPad, benchMarks, type CheckRow } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'

/**
 * A pulled elbow (radial head subluxation) reduced by hand: tell her father it will hurt for a second, sit her on his
 * lap, cup her elbow with your thumb over the radial head, then turn the forearm firmly into hyperpronation until you
 * feel the click; then watch her reach for a toy. Supination-flexion works too; an X-ray or a plaster does not help.
 */

const FONT = 'Press Start 2P, monospace'
export const ELBOW_MARKS = ['explain', 'hold', 'pronate', 'reassess'] as const

export type ElbowRun = { explained: boolean; lap: boolean; thumbOnHead: boolean; turn: number; method: 'pronation' | 'supination' | null; clicked: boolean; xray: boolean; plaster: boolean; watchedMin: number; reached: boolean }
export const freshElbow = (): ElbowRun => ({ explained: false, lap: false, thumbOnHead: false, turn: 0, method: null, clicked: false, xray: false, plaster: false, watchedMin: 0, reached: false })

/** Hyperpronation clicks it back past about 80° of pronation; supination clicks it at full supination with flexion. */
export function turnTo(run: ElbowRun, deg: number): Partial<ElbowRun> {
  const turn = Math.max(-100, Math.min(100, deg))
  const method = turn > 20 ? 'pronation' : turn < -20 ? 'supination' : run.method
  const clicked = run.clicked || (run.thumbOnHead && (turn >= 80 || turn <= -90))
  return { turn, method, clicked }
}

export function elbowRows(r: ElbowRun): CheckRow[] {
  return [
    { key: 'explain', label: 'Explain', value: r.explained ? 'Told her father it will hurt briefly' : 'Not explained', range: 'Warn the parent: a second of pain, then usually fixed', ok: r.explained, why: 'He will hold her better if he knows what is coming.' },
    { key: 'hold', label: 'Hold', value: [r.lap && "on her father's lap", r.thumbOnHead && 'thumb over the radial head'].filter(Boolean).join(', ') || 'Not set up', range: "On her father's lap; support the elbow, thumb over the radial head", ok: r.lap && r.thumbOnHead, why: 'Your thumb feels the click as the radial head slips back.' },
    { key: 'pronate', label: 'Reduction', value: r.xray || r.plaster ? `${r.xray ? 'X-ray first' : ''}${r.plaster ? ' plaster' : ''}` : r.clicked ? `${r.method === 'supination' ? 'Supination and flexion' : 'Hyperpronation'}: a click` : `Turned ${Math.round(Math.abs(r.turn))}°, no click`, range: 'Firm hyperpronation (or supination and flexion) until the click', ok: r.clicked && !r.xray && !r.plaster, why: 'A classic history needs no X-ray; it is a ligament, not a fracture: no plaster.' },
    { key: 'reassess', label: 'Reassess', value: r.reached ? `Reaching for the toy after ${r.watchedMin} min` : 'Not watched', range: 'Watch her use the arm, 15–30 minutes', ok: r.reached && r.watchedMin >= 15, why: 'Using the arm is the test that it is reduced.' },
  ]
}

export function ElbowProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const titles = ['Prepare', 'Reduce', 'Watch']
  const api = useBench(freshElbow, coach)
  const { run, runRef, upd, feel, physical, why } = api
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const grip = useRef<{ x: number; turn: number } | null>(null)
  const done = useRef(false)
  const next = () => {
    sfx.select()
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const { marks, faults } = benchMarks(elbowRows(runRef.current), ELBOW_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: runRef.current.clicked ? 'Reduced: she is using the arm.' : 'Not reduced.', scene: runRef.current.clicked ? [job.scene || 'reduced'] : ['not-reduced'] })
  }
  // The forearm seen end-on from her hand: the palm turns as you rotate.
  const palmDown = run.turn
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="elbow-bench">
      <div className="hare-bar">
        <span>KA-YEE · R ARM</span>
        <span />
        <span>{run.clicked ? 'CLICK' : 'HOLDING IT STILL'}</span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={elbowRows(run)} onContinue={finish} testId="elbow-check" />
        ) : (
          <>
            {index === 0 && (
              <>
                <p className="io-lede">Tell her father, sit her on his lap, and take hold of her elbow.</p>
                <div className="io-choices">
                  <button type="button" className="tap io-mini" data-on={run.explained || undefined} data-testid="elbow-explain" onClick={() => (upd({ explained: true }), feel('"It will hurt for a second, and then she should start using it again."'))}>
                    EXPLAIN TO HER FATHER
                  </button>
                  <button type="button" className="tap io-mini" data-on={run.lap || undefined} data-testid="elbow-lap" onClick={() => (upd({ lap: true }), feel('On her father’s lap, facing you, his arm round her.'))}>
                    ON HER FATHER’S LAP
                  </button>
                  <button type="button" className="tap io-mini" data-on={run.thumbOnHead || undefined} data-testid="elbow-thumb" onClick={() => (upd({ thumbOnHead: true }), feel('Your hand cups her elbow, your thumb over the radial head on the outer side.'))}>
                    THUMB OVER THE RADIAL HEAD
                  </button>
                  <button type="button" className="tap io-mini" data-testid="elbow-xray" onClick={() => (upd({ xray: true }), why('A classic history and a child who will not use the arm: no X-ray before you try.'))}>
                    X-RAY THE ELBOW FIRST
                  </button>
                </div>
              </>
            )}
            {index === 1 && (
              <>
                <p className="io-lede">With your other hand on her wrist, drag to turn the forearm. Firmly: all the way into hyperpronation.</p>
                <TouchPad
                  svg={svg}
                  aspect="1 / 1"
                  className="mx-auto max-w-[240px]"
                  testId="elbow-turn"
                  onDown={(p) => (grip.current = { x: p.x, turn: runRef.current.turn })}
                  onMove={(p) => {
                    const g = grip.current
                    if (!g) return
                    const before = runRef.current.clicked
                    const cur = upd(turnTo(runRef.current, g.turn + (p.x - g.x) * 1.4))
                    if (cur.clicked && !before) {
                      buzz(50)
                      feel('A click under your thumb. She cries for a moment.')
                    }
                  }}
                  onUp={() => {
                    grip.current = null
                    const cur = runRef.current
                    if (!cur.thumbOnHead) why('Hold the elbow with your thumb over the radial head: you feel the click there.')
                    else if (!cur.clicked) feel(`Turned ${Math.round(Math.abs(cur.turn))}°: no click yet. Further, firmly.`)
                  }}
                >
                  <svg ref={svg} viewBox="0 0 120 120" className="block h-full w-full select-none" data-testid="elbow-view">
                    <rect width="120" height="120" fill="#e2e8ec" />
                    <circle cx="60" cy="60" r="34" fill="#e8b494" stroke="#8a5238" strokeWidth="1.5" />
                    <g transform={`rotate(${palmDown} 60 60)`}>
                      <rect x="30" y="56" width="60" height="8" rx="4" fill="#f0c8a8" stroke="#8a5238" />
                      <circle cx="90" cy="60" r="5" fill="#c06040" />
                    </g>
                    <text x="4" y="10" fontFamily={FONT} fontSize="5" fill="#40404c">
                      FOREARM, END-ON · {Math.round(Math.abs(run.turn))}° {run.turn >= 0 ? 'PRONATION' : 'SUPINATION'}
                    </text>
                  </svg>
                </TouchPad>
              </>
            )}
            {index === 2 && (
              <>
                <p className="io-lede">Give her a toy and watch.</p>
                <div className="io-choices">
                  <button
                    type="button"
                    className="tap io-mini"
                    data-testid="elbow-watch"
                    onClick={() => {
                      const m = run.watchedMin + 15
                      const reached = runRef.current.clicked && m >= 15
                      upd({ watchedMin: m, reached })
                      if (reached) feel(`${m} minutes: she reaches up for the toy with her right hand.`)
                      else physical(`${m} minutes: she still holds the arm still.`)
                    }}
                  >
                    WATCH FOR 15 MINUTES
                  </button>
                  <button type="button" className="tap io-mini" data-testid="elbow-plaster" onClick={() => (upd({ plaster: true }), why('It is a ligament slipping, not a fracture: no plaster.'))}>
                    PUT THE ARM IN PLASTER
                  </button>
                </div>
              </>
            )}
            <NextButton onClick={next} testId="elbow-next">
              {titles[index + 1] ?? 'Finish'}
            </NextButton>
            <NoteLine note={api.note} />
          </>
        )}
      </div>
    </div>
  )
}
