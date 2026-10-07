import { useEffect, useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, TouchPad, benchMarks, type CheckRow } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'

/**
 * The modified Valsalva manoeuvre (REVERT trial; RCUK), by hand: record a strip, sit her at 45°, have her blow into a
 * 10 mL syringe hard enough to move the plunger for 15 seconds, then at once lie her flat and lift her legs to 45°
 * for 15 seconds, and look at the rhythm. It works only if the sequence is right.
 */

const FONT = 'Press Start 2P, monospace'
export const VALSALVA_MARKS = ['explain', 'position', 'strain', 'legs', 'rhythm'] as const

export type ValsalvaRun = { explained: boolean; strip: boolean; backAngle: number; strainAngle: number | null; strainS: number; strainEndedAt: number | null; legsAt: number | null; legsUp: number; legsS: number; checked: boolean; carotid: boolean }
export const freshValsalva = (): ValsalvaRun => ({ explained: false, strip: false, backAngle: 80, strainAngle: null, strainS: 0, strainEndedAt: null, legsAt: null, legsUp: 0, legsS: 0, checked: false, carotid: false })

export const converted = (r: ValsalvaRun) =>
  r.strainAngle !== null && Math.abs(r.strainAngle - 45) <= 12 && r.strainS >= 15 && r.strainEndedAt !== null && r.legsAt !== null && r.legsAt - r.strainEndedAt <= 8 && r.legsUp >= 0.8 && r.legsS >= 15 && !r.carotid

export function valsalvaRows(r: ValsalvaRun): CheckRow[] {
  const gap = r.strainEndedAt !== null && r.legsAt !== null ? r.legsAt - r.strainEndedAt : null
  return [
    { key: 'explain', label: 'Explain and record', value: [r.explained && 'explained', r.strip && 'rhythm strip running'].filter(Boolean).join(', ') || 'Neither', range: 'Explain; record a rhythm strip throughout', ok: r.explained && r.strip, why: 'The strip shows what happens at the moment it breaks.' },
    { key: 'position', label: 'Start position', value: r.strainAngle === null ? 'No strain' : `Back at ${Math.round(r.strainAngle)}° during the strain`, range: 'Semi-recumbent, about 45°', ok: r.strainAngle !== null && Math.abs(r.strainAngle - 45) <= 12, why: 'The strain then the change of posture gives the biggest vagal surge.' },
    { key: 'strain', label: 'Strain', value: `${Math.round(r.strainS)} s blowing into the syringe`, range: 'Blow to move the plunger of a 10 mL syringe (about 40 mmHg) for 15 seconds', ok: r.strainS >= 15, why: 'A short or weak strain is the commonest reason it fails.' },
    { key: 'legs', label: 'Legs up', value: gap === null ? 'Not done' : `Flat and legs up ${gap.toFixed(0)} s after the strain, held ${Math.round(r.legsS)} s`, range: 'Immediately flat, legs raised to 45° for 15 seconds', ok: gap !== null && gap <= 8 && r.legsUp >= 0.8 && r.legsS >= 15, why: 'The venous return surge right after the strain is what makes the modified Valsalva work.' },
    { key: 'rhythm', label: 'Rhythm', value: r.carotid ? 'Pressed on both carotids' : r.checked ? 'Rhythm checked on the strip' : 'Not checked', range: 'Check the rhythm; adenosine if it has not worked', ok: r.checked && !r.carotid, why: 'Never both carotids at once: you can stop the brain’s blood supply.', critical: r.carotid },
  ]
}

function Strip({ sinus }: { sinus: boolean }) {
  const pts: string[] = []
  for (let i = 0; i < 200; i++) {
    const beat = sinus ? 34 : 16
    const ph = (i % beat) / beat
    let y = 20
    if (sinus && ph > 0.1 && ph < 0.18) y -= 3
    if (ph > 0.3 && ph < 0.34) y -= 16
    if (ph >= 0.34 && ph < 0.38) y += 5
    if (ph > 0.55 && ph < 0.7) y -= sinus ? 4 : 3
    pts.push(`${i},${y}`)
  }
  return (
    <svg viewBox="0 0 200 36" className="block h-full w-full" data-testid="valsalva-strip">
      <rect width="200" height="36" fill="#081008" />
      <polyline points={pts.join(' ')} fill="none" stroke="#58f878" strokeWidth="1" />
      <text x="4" y="33" fontFamily={FONT} fontSize="5" fill="#58f878">
        {sinus ? 'SINUS 88' : 'NARROW, REGULAR 190'}
      </text>
    </svg>
  )
}

export function ValsalvaProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const titles = ['Prepare', 'Strain', 'Legs up', 'Rhythm']
  const api = useBench(freshValsalva, coach)
  // `pose: "refractory"`: done right, it still does not revert (it fails in about half), and the station moves to adenosine.
  const refractory = job.pose === 'refractory'
  const reverts = (r: ValsalvaRun) => converted(r) && !refractory
  const { run, runRef, upd, feel, physical, why } = api
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [clock, setClock] = useState(0)
  const svg = useRef<SVGSVGElement>(null)
  const grip = useRef<{ y: number; v: number; mode: 'back' | 'legs' } | null>(null)
  const done = useRef(false)
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 0.25), 250)
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
    const r = runRef.current
    const { marks, faults } = benchMarks(valsalvaRows(r), VALSALVA_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: reverts(r) ? 'Modified Valsalva: reverted to sinus rhythm.' : 'Modified Valsalva: still in SVT.', scene: reverts(r) ? [job.scene || 'sinus'] : ['svt'] })
  }
  const legsAngle = run.legsUp * 45
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="valsalva-bench">
      <div className="px-3 pt-1">
        <div className="io-figure aspect-[200/36]">
          <Strip sinus={run.checked && reverts(run)} />
        </div>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={valsalvaRows(run)} onContinue={finish} testId="valsalva-check" />
        ) : (
          <>
            <p className="io-lede">
              {index === 0 && 'Explain, start the strip, and sit her up at 45°: drag the back of the trolley.'}
              {index === 1 && 'She blows into a 10 mL syringe hard enough to move the plunger. Hold for her 15 seconds.'}
              {index === 2 && 'The moment she stops: drag the back flat and lift her legs to 45°. Hold for 15 seconds.'}
              {index === 3 && 'Look at the rhythm.'}
            </p>
            <TouchPad
              svg={svg}
              aspect="200 / 110"
              testId="valsalva-bed"
              onDown={(p) => {
                const mode = p.x < 110 ? 'back' : 'legs'
                grip.current = { y: p.y, v: mode === 'back' ? runRef.current.backAngle : runRef.current.legsUp, mode }
              }}
              onMove={(p) => {
                const g = grip.current
                if (!g) return
                if (g.mode === 'back') upd({ backAngle: Math.max(0, Math.min(90, g.v + (g.y - p.y) * 1.2)) })
                else {
                  const cur = runRef.current
                  const v = Math.max(0, Math.min(1, g.v + (g.y - p.y) / 50))
                  upd({ legsUp: v, legsAt: cur.legsAt ?? (v >= 0.8 && cur.backAngle < 15 ? clock : null) })
                }
              }}
              onUp={() => {
                const g = grip.current
                grip.current = null
                const cur = runRef.current
                if (g?.mode === 'back') feel(`The back of the trolley at ${Math.round(cur.backAngle)}°.`)
                if (g?.mode === 'legs' && cur.legsUp >= 0.8) {
                  if (cur.backAngle > 15) why('Lie her flat first, then the legs up.')
                  else feel('Flat on her back, legs lifted to 45° by the nurse.')
                }
              }}
            >
              <svg ref={svg} viewBox="0 0 200 110" className="block h-full w-full select-none" data-testid="valsalva-view">
                <rect width="200" height="110" fill="#e2e8ec" />
                <rect x="10" y="80" width="180" height="8" fill="#a8b4c0" />
                <g transform={`rotate(${-run.backAngle} 100 80)`}>
                  <rect x="28" y="70" width="72" height="12" rx="4" fill="#bcd4e8" stroke="#6a84a0" />
                  <circle cx="22" cy="72" r="10" fill="#e8b494" stroke="#8a5238" />
                </g>
                <g transform={`rotate(${legsAngle} 100 80)`}>
                  <rect x="100" y="70" width="80" height="11" rx="5" fill="#e8b494" stroke="#8a5238" />
                </g>
                <text x="4" y="104" fontFamily={FONT} fontSize="4.5" fill="#40404c">
                  BACK {Math.round(run.backAngle)}° · LEGS {Math.round(legsAngle)}° · DRAG THE BACK OR THE LEGS
                </text>
              </svg>
            </TouchPad>
            <div className="io-choices mt-2">
              {index === 0 && (
                <>
                  <button type="button" className="tap io-mini" data-on={run.explained || undefined} data-testid="valsalva-explain" onClick={() => (upd({ explained: true }), feel('"Blow into this syringe as hard as you can for 15 seconds; then we will lie you down and lift your legs."'))}>
                    EXPLAIN
                  </button>
                  <button type="button" className="tap io-mini" data-on={run.strip || undefined} data-testid="valsalva-strip-on" onClick={() => (upd({ strip: true }), feel('A continuous rhythm strip running.'))}>
                    RECORD A RHYTHM STRIP
                  </button>
                </>
              )}
              {index === 1 && (
                <HoldButton
                  testId="valsalva-blow"
                  className="w-full"
                  onStart={() => runRef.current.strainAngle === null && upd({ strainAngle: runRef.current.backAngle })}
                  onTick={(dt) => upd((r) => ({ strainS: r.strainS + dt }))}
                  onEnd={() => {
                    const cur = upd({ strainEndedAt: clock })
                    feel(cur.strainS >= 15 ? 'Fifteen seconds, red in the face, the plunger moving. Now!' : `${Math.round(cur.strainS)} seconds: too short.`)
                  }}
                >
                  HOLD: SHE BLOWS · {Math.round(run.strainS)} S
                </HoldButton>
              )}
              {index === 2 && (
                <HoldButton testId="valsalva-legs-hold" className="w-full" disabled={run.legsUp < 0.8} onTick={(dt) => upd((r) => ({ legsS: r.legsS + dt }))} onEnd={() => feel(`${Math.round(runRef.current.legsS)} seconds with her legs up.`)}>
                  HOLD HER LEGS UP · {Math.round(run.legsS)} S
                </HoldButton>
              )}
              {index === 3 && (
                <button
                  type="button"
                  className="tap io-mini"
                  data-testid="valsalva-check-rhythm"
                  onClick={() => {
                    upd({ checked: true })
                    if (reverts(runRef.current)) {
                      buzz(60)
                      feel('A pause on the strip, then sinus rhythm at 88. She feels it stop.')
                    } else if (converted(runRef.current)) feel('A brief slowing on the strip… then back to 190. Well done, but it has not worked: adenosine next.')
                    else physical('Still a narrow regular tachycardia at 190.')
                  }}
                >
                  LOOK AT THE STRIP
                </button>
              )}
            </div>
            <NextButton onClick={next} testId="valsalva-next">
              {titles[index + 1] ?? 'Finish'}
            </NextButton>
            <NoteLine note={api.note} />
          </>
        )}
      </div>
    </div>
  )
}
