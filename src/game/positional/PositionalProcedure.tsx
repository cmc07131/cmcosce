import { useEffect, useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, TouchPad, benchMarks, type CheckRow } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { sfx } from '../sfx'

/**
 * Dix–Hallpike and Epley for right posterior canal BPPV, by hand. `pose: "epley"` starts from the right Hallpike
 * position. Side view: drag her along the couch and lie her back (fast); drag the head below the horizontal. Top
 * view: turn her head. In the Hallpike, watching her eyes shows the torsional, up-beating nystagmus after a few
 * seconds' latency, fading within half a minute.
 */

const FONT = 'Press Start 2P, monospace'
export const HALLPIKE_MARKS = ['explain', 'start', 'turn', 'drop', 'watch', 'interpret'] as const
export const EPLEY_MARKS = ['hold1', 'turn90', 'roll', 'sit', 'retest'] as const

export type Dx = 'right-posterior' | 'left-posterior' | 'horizontal' | 'central'
export type PosRun = {
  explained: boolean
  couchX: number
  rot: number
  lying: number
  dropS: number | null
  ext: number
  watchedS: number
  dx: Dx | null
  holds: number[]
  turned: boolean
  rolled: boolean
  satUp: boolean
  satFast: boolean
  retested: boolean
}
export const freshPos = (epley: boolean): PosRun =>
  epley
    ? { explained: true, couchX: 1, rot: 45, lying: 1, dropS: 1, ext: 20, watchedS: 30, dx: 'right-posterior', holds: [0, 0, 0], turned: false, rolled: false, satUp: false, satFast: false, retested: false }
    : { explained: false, couchX: 0, rot: 0, lying: 0, dropS: null, ext: 0, watchedS: 0, dx: null, holds: [0, 0, 0], turned: false, rolled: false, satUp: false, satFast: false, retested: false }

export function hallpikeRows(r: PosRun): CheckRow[] {
  return [
    { key: 'explain', label: 'Explain', value: r.explained ? 'Warned of brief dizziness; eyes kept open' : 'Not explained', range: 'Warn her; ask her to keep her eyes open', ok: r.explained, why: 'She will want to shut her eyes; then you see nothing.' },
    { key: 'start', label: 'Start position', value: r.couchX >= 0.8 ? 'Sitting so the head will hang over the end' : 'Too far up the couch', range: 'Sit her so that, lying back, her head hangs over the end', ok: r.couchX >= 0.8, why: 'The head must go below the horizontal to stimulate the posterior canal.' },
    { key: 'turn', label: 'Head turn', value: `${Math.round(Math.abs(r.rot))}° to the ${r.rot >= 0 ? 'right' : 'left'}`, range: '45° toward the side being tested (right)', ok: r.rot >= 35 && r.rot <= 55, why: '45° lines the posterior canal up with the plane of the movement.' },
    { key: 'drop', label: 'Lie back', value: r.dropS === null ? 'Not done' : `In ${r.dropS.toFixed(1)} s, head ${Math.round(r.ext)}° below the horizontal`, range: 'Quickly, with the head about 20° below the horizontal, supported', ok: r.dropS !== null && r.dropS <= 2 && r.ext >= 15 && r.ext <= 30, why: 'A slow lie-back may not move the debris.' },
    { key: 'watch', label: 'Watch', value: `${Math.round(r.watchedS)} s`, range: 'At least 30 seconds: latency, direction, duration', ok: r.watchedS >= 30, why: 'The nystagmus starts after a few seconds and fades: stop early and you miss it.' },
    { key: 'interpret', label: 'Interpret', value: r.dx ? { 'right-posterior': 'Right posterior canal BPPV', 'left-posterior': 'Left posterior canal BPPV', horizontal: 'Horizontal canal BPPV', central: 'Central cause' }[r.dx] : 'None', range: 'Torsional up-beating toward the down (right) ear, with latency and fatigue: right posterior canal BPPV', ok: r.dx === 'right-posterior', why: 'The down ear is the affected ear; a purely vertical or non-fatiguing nystagmus is central.' },
  ]
}

export function epleyRows(r: PosRun): CheckRow[] {
  return [
    { key: 'hold1', label: 'Start', value: `Right Hallpike held ${r.holds[0]} s`, range: 'Stay in the right Hallpike position for 30 seconds', ok: r.holds[0] >= 30, why: 'Let the debris settle before the next move.' },
    { key: 'turn90', label: 'Turn', value: r.turned ? `Head turned 90° to the left, held ${r.holds[1]} s` : 'Not turned', range: 'Turn the head 90° to the left, keeping it extended; 30 seconds', ok: r.turned && r.holds[1] >= 30, why: 'This rolls the debris round the canal toward the exit.' },
    { key: 'roll', label: 'Roll', value: r.rolled ? `Onto her left side, nose down, held ${r.holds[2]} s` : 'Not rolled', range: 'Roll her onto her left side, nose pointing to the floor; 30 seconds', ok: r.rolled && r.holds[2] >= 30, why: 'Nose down carries the debris out into the utricle.' },
    { key: 'sit', label: 'Sit up', value: r.satUp ? (r.satFast ? 'Sat up quickly' : 'Sat up slowly, head slightly down') : 'Still lying', range: 'Sit up slowly, chin slightly down', ok: r.satUp && !r.satFast, why: 'She will feel briefly dizzy: slowly.' },
    { key: 'retest', label: 'Retest', value: r.retested ? 'Repeat Hallpike: no nystagmus' : 'Not retested', range: 'Repeat the Dix–Hallpike', ok: r.retested, why: 'No nystagmus means treated; if it is still positive, repeat the Epley.' },
  ]
}

export function PositionalProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const epley = job.pose === 'epley'
  const titles = epley ? ['Hold', 'Turn', 'Roll', 'Sit up', 'Retest'] : ['Explain', 'Position', 'Lie back', 'Watch', 'Interpret']
  const api = useBench(() => freshPos(epley), coach)
  const { run, runRef, upd, feel, physical, why } = api
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [nys, setNys] = useState(0)
  const side = useRef<SVGSVGElement>(null)
  const top = useRef<SVGSVGElement>(null)
  const grip = useRef<{ x: number; y: number; t: number; v: number; w: number } | null>(null)
  const done = useRef(false)
  const rows = epley ? epleyRows(run) : hallpikeRows(run)
  useEffect(() => {
    const id = window.setInterval(() => setNys((n) => n + 1), 120)
    return () => window.clearInterval(id)
  }, [])
  const next = () => {
    sfx.select()
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const { marks, faults } = benchMarks(rows, (epley ? EPLEY_MARKS : HALLPIKE_MARKS) as readonly string[], job.grantMarks)
    onDone({ marks, faults, summary: epley ? (runRef.current.retested ? 'Epley done; retest negative.' : 'Epley incomplete.') : `Right Dix–Hallpike: ${runRef.current.watchedS >= 8 ? 'torsional up-beating nystagmus after a short latency, fading' : 'not watched long enough'}.` })
  }
  // Nystagmus in the Hallpike: after 4 s latency, beating for about 20 s, then fading. None after a good Epley.
  const t = run.watchedS
  const beating = !epley && run.lying >= 0.9 && t > 4 && t < 24
  const jerk = beating ? ((nys % 6) < 1 ? -3 : (nys % 6) * 0.6) : 0
  const step = titles[index]
  const holdWait = (i: number, line: string) => (
    <button type="button" className="tap io-mini" data-testid={`pos-hold-${i}`} onClick={() => (upd((r) => ({ holds: r.holds.map((h, k) => (k === i ? h + 10 : h)) })), feel(`${runRef.current.holds[i]} seconds. ${line}`))}>
      WAIT 10 SECONDS ({run.holds[i]} S)
    </button>
  )
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="pos-bench">
      <div className="hare-bar">
        <span>MRS CHAU</span>
        <span />
        <span>{run.lying >= 0.9 ? `HEAD ${Math.round(run.rot)}° ${run.rot >= 0 ? 'R' : 'L'}` : 'SITTING'}</span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={rows} onContinue={finish} testId="pos-check" />
        ) : (
          <>
            <p className="io-lede">
              {step === 'Explain' && 'Explain and warn her. Keep her eyes open throughout.'}
              {step === 'Position' && 'Side view: drag her down the couch so her head will hang over the end. Top view: turn her head 45° to the right.'}
              {step === 'Lie back' && 'Lie her back quickly (drag the side view down fast), then let the head drop about 20° below the couch, supporting it.'}
              {step === 'Watch' && 'Hold to watch her eyes. Do not stop early.'}
              {step === 'Interpret' && 'What did you see?'}
              {step === 'Hold' && 'She is in the right Hallpike position. Hold it for 30 seconds.'}
              {step === 'Turn' && 'Turn her head 90° to the left, keeping it extended over the end. Hold 30 seconds.'}
              {step === 'Roll' && 'Roll her onto her left side, turning the head on so her nose points to the floor. Hold 30 seconds.'}
              {step === 'Sit up' && 'Sit her up slowly, chin slightly down.'}
              {step === 'Retest' && 'Repeat the right Dix–Hallpike.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <TouchPad
                svg={side}
                aspect="120 / 90"
                testId="pos-side"
                onDown={(p) => (grip.current = { x: p.x, y: p.y, t: performance.now(), v: runRef.current.lying, w: runRef.current.couchX })}
                onMove={(p) => {
                  const g = grip.current
                  if (!g) return
                  const cur = runRef.current
                  if (step === 'Position') return void upd({ couchX: Math.max(0, Math.min(1, g.w + (p.x - g.x) / 40)) })
                  if (step === 'Lie back' && cur.lying < 0.95) {
                    const lying = Math.max(0, Math.min(1, g.v + (p.y - g.y) / 40))
                    upd({ lying })
                    if (lying >= 0.95) upd({ dropS: (performance.now() - g.t) / 1000 })
                    return
                  }
                  if (step === 'Lie back') return void upd({ ext: Math.max(0, Math.min(40, (p.y - g.y) * 0.8)) })
                  if (step === 'Sit up' && !cur.satUp) {
                    const lying = Math.max(0, Math.min(1, g.v - (g.y - p.y) / 40))
                    if (lying <= 0.05) {
                      const s = (performance.now() - g.t) / 1000
                      upd({ lying: 0, satUp: true, satFast: s < 1.2, rot: 0, ext: 0 })
                      if (s < 1.2) physical('She shoots up and grabs the couch: "The room\'s spinning!"')
                      else feel('Slowly up, chin down. A moment of dizziness, then it settles.')
                    } else upd({ lying })
                  }
                }}
                onUp={() => {
                  grip.current = null
                  const cur = runRef.current
                  if (step === 'Position') feel(cur.couchX >= 0.8 ? 'Her shoulders will be at the end of the couch when she lies back.' : 'She is too far up: her head would rest on the couch.')
                  if (step === 'Lie back' && cur.dropS !== null) {
                    if (cur.dropS > 2) why('Quickly: a slow lie-back may not provoke it.')
                    else if (cur.ext >= 15 && cur.ext <= 30) feel(`Down in ${cur.dropS.toFixed(1)} s; head 20° below the couch in your hands.`)
                  }
                }}
              >
                <svg ref={side} viewBox="0 0 120 90" className="block h-full w-full select-none" data-testid="pos-side-view">
                  <rect width="120" height="90" fill="#e2e8ec" />
                  <rect x="10" y="60" width="90" height="6" fill="#a8b4c0" />
                  <g transform={`translate(${(run.couchX - 1) * 30} 0)`}>
                    <rect x="62" y="50" width="34" height="10" rx="4" fill="#bcd4e8" stroke="#6a84a0" />
                    <g transform={`rotate(${-90 + run.lying * 90} 64 55)`}>
                      <rect x="30" y="50" width="34" height="10" rx="4" fill="#bcd4e8" stroke="#6a84a0" />
                      <g transform={`rotate(${run.lying >= 0.9 ? -run.ext : 0} 30 55)`}>
                        <circle cx="20" cy="55" r="9" fill="#e8b494" stroke="#8a5238" />
                      </g>
                    </g>
                  </g>
                  <text x="2" y="8" fontFamily={FONT} fontSize="4" fill="#40404c">
                    SIDE · END OF COUCH ←
                  </text>
                </svg>
              </TouchPad>
              <TouchPad
                svg={top}
                aspect="120 / 90"
                testId="pos-top"
                onDown={(p) => (grip.current = { x: p.x, y: p.y, t: 0, v: runRef.current.rot, w: 0 })}
                onMove={(p) => {
                  const g = grip.current
                  if (!g) return
                  const rot = Math.max(-150, Math.min(90, g.v + (p.x - g.x) * 1.5))
                  upd({ rot })
                }}
                onUp={() => {
                  grip.current = null
                  const cur = runRef.current
                  if (step === 'Position') feel(`Head turned ${Math.round(Math.abs(cur.rot))}° to the ${cur.rot >= 0 ? 'right' : 'left'}.`)
                  if (step === 'Turn' && cur.rot <= -35 && cur.rot >= -60 && !cur.turned) {
                    upd({ turned: true })
                    feel('Turned through 90°: now 45° to the left, still hanging over the end.')
                  }
                  if (step === 'Roll' && cur.rot <= -120 && !cur.rolled) {
                    upd({ rolled: true })
                    feel('Rolled onto her left side, the head turned on until her nose points at the floor.')
                  }
                }}
              >
                <svg ref={top} viewBox="0 0 120 90" className="block h-full w-full select-none" data-testid="pos-top-view">
                  <rect width="120" height="90" fill="#e2e8ec" />
                  <g transform={`rotate(${run.rot} 60 46)`}>
                    <ellipse cx="60" cy="46" rx="22" ry="26" fill="#e8b494" stroke="#8a5238" />
                    <path d="M60 20 L54 28 L66 28 Z" fill="#c07058" />
                    {/* the eyes, beating when the nystagmus comes */}
                    <circle cx={52 + jerk} cy="34" r="3" fill="#ffffff" stroke="#303030" />
                    <circle cx={68 + jerk} cy="34" r="3" fill="#ffffff" stroke="#303030" />
                    <circle cx={52 + jerk} cy="34" r="1.4" fill="#303030" />
                    <circle cx={68 + jerk} cy="34" r="1.4" fill="#303030" />
                  </g>
                  <text x="2" y="8" fontFamily={FONT} fontSize="4" fill="#40404c">
                    FROM ABOVE · NOSE ↑ · HER RIGHT ←
                  </text>
                </svg>
              </TouchPad>
            </div>
            <div className="io-choices mt-2">
              {step === 'Explain' && (
                <button type="button" className="tap io-mini" data-on={run.explained || undefined} data-testid="pos-explain" onClick={() => (upd({ explained: true }), feel('"This may bring on the spinning for a few seconds. Keep your eyes open and look at my nose."'))}>
                  EXPLAIN AND WARN
                </button>
              )}
              {step === 'Watch' && (
                <HoldButton testId="pos-watch" className="w-full" onTick={(dt) => upd((r) => ({ watchedS: r.watchedS + dt * 3 }))} onEnd={() => {
                  const s = runRef.current.watchedS
                  if (s < 6) feel('Nothing yet…')
                  else if (s < 24) feel('After a few seconds: a torsional, up-beating nystagmus, the top of the eyes beating toward her right ear. She grips your arm.')
                  else if (s < 30) feel('It has faded. Keep watching to 30 seconds.')
                  else feel('Latency about 4 seconds, torsional up-beating toward the right ear, faded by 20 seconds.')
                }}>
                  HOLD TO WATCH HER EYES · {Math.round(run.watchedS)} S
                </HoldButton>
              )}
              {step === 'Interpret' &&
                (['right-posterior', 'left-posterior', 'horizontal', 'central'] as Dx[]).map((d) => (
                  <button key={d} type="button" className="tap io-mini" data-on={run.dx === d || undefined} data-testid={`pos-dx-${d}`} onClick={() => (upd({ dx: d }), d === 'right-posterior' ? feel('Right posterior canal BPPV: treat with a right Epley.') : why('Torsional and up-beating, toward the down ear, with latency and fatigue: posterior canal, on the side that is down.'))}>
                    {{ 'right-posterior': 'RIGHT POSTERIOR CANAL BPPV', 'left-posterior': 'LEFT POSTERIOR CANAL BPPV', horizontal: 'HORIZONTAL CANAL BPPV', central: 'A CENTRAL CAUSE' }[d]}
                  </button>
                ))}
              {step === 'Hold' && holdWait(0, 'The dizziness settles.')}
              {step === 'Turn' && holdWait(1, 'Head to the left, still extended.')}
              {step === 'Roll' && holdWait(2, 'Nose to the floor.')}
              {step === 'Retest' && (
                <button type="button" className="tap io-mini" data-on={run.retested || undefined} data-testid="pos-retest" onClick={() => (upd({ retested: true }), feel('Right Dix–Hallpike again: no nystagmus, no spinning. Treated.'))}>
                  REPEAT THE RIGHT HALLPIKE
                </button>
              )}
            </div>
            <NextButton onClick={next} testId="pos-next">
              {titles[index + 1] ?? 'Finish'}
            </NextButton>
            <NoteLine note={api.note} />
          </>
        )}
      </div>
    </div>
  )
}
