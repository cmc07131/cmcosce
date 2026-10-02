import { useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, RubTint, TouchPad, benchMarks, useRub, type CheckRow } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'

/**
 * Newborn life support (RCUK NLS 2021), by hand: dry and wrap her, stimulate; listen for the heart and look at tone
 * and breathing; put the head neutral; five inflation breaths of 2–3 seconds; the chest does not move until you fix
 * the airway (two-person jaw thrust) and repeat them; then ventilation breaths at about 30 a minute; reassess.
 */

const FONT = 'Press Start 2P, monospace'
export const NEWBORN_MARKS = ['dry', 'assess', 'airway', 'inflate', 'correct', 'ventilate', 'reassess'] as const

export type NewbornRun = {
  dried: number
  wrapped: boolean
  stimulated: boolean
  tone: boolean
  breathing: boolean
  hr: boolean
  headAngle: number
  chin: boolean
  inflations: { s: number; jaw: boolean }[]
  jaw2: boolean
  moved: boolean
  ventTimes: number[]
  reassessed: boolean
  compressedEarly: boolean
  upsideDown: boolean
}
export const freshNewborn = (): NewbornRun => ({ dried: 0, wrapped: false, stimulated: false, tone: false, breathing: false, hr: false, headAngle: 30, chin: false, inflations: [], jaw2: false, moved: false, ventTimes: [], reassessed: false, compressedEarly: false, upsideDown: false })

const neutral = (r: NewbornRun) => Math.abs(r.headAngle) <= 10
const goodInflations = (r: NewbornRun, jaw: boolean) => r.inflations.filter((i) => i.jaw === jaw && i.s >= 2 && i.s <= 3.5).length

/** The chest moves only with the head neutral and a two-person jaw thrust. */
export const chestMoves = (r: NewbornRun) => neutral(r) && r.jaw2

export function ventRate(times: number[]) {
  if (times.length < 4) return null
  const gaps = times.slice(1).map((t, i) => t - times[i])
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return 60 / mean
}

export function newbornRows(r: NewbornRun): CheckRow[] {
  const rate = ventRate(r.ventTimes)
  return [
    { key: 'dry', label: 'Dry, wrap, stimulate', value: [r.dried >= 0.7 && 'dried', r.wrapped && 'wrapped, hat on', r.stimulated && 'stimulated'].filter(Boolean).join(', ') || 'Nothing', range: 'Dry her, take the wet towel away, wrap, hat; stimulate', ok: r.dried >= 0.7 && r.wrapped && r.stimulated, why: 'A wet baby loses heat fast; drying is also the first stimulation.' },
    { key: 'assess', label: 'Assess', value: [r.tone && 'floppy', r.breathing && 'not breathing', r.hr && 'HR about 55'].filter(Boolean).join(', ') || 'Not assessed', range: 'Tone, breathing, heart rate with a stethoscope', ok: r.tone && r.breathing && r.hr, why: 'The heart rate is your guide to whether ventilation is working.' },
    { key: 'airway', label: 'Airway', value: `Head ${Math.abs(r.headAngle) <= 10 ? 'neutral' : r.headAngle > 0 ? 'flexed' : 'over-extended'}${r.chin ? ', chin supported' : ''}`, range: 'Head neutral; chin support or jaw thrust', ok: neutral(r) && r.chin, why: 'A newborn’s big occiput flexes the neck; over-extension kinks the soft trachea.' },
    { key: 'inflate', label: 'Inflation breaths', value: `${goodInflations(r, false)} of 2–3 s`, range: 'Five inflation breaths, 2–3 seconds each, 30 cmH2O', ok: goodInflations(r, false) >= 5, why: 'Long inflations open fluid-filled lungs.' },
    { key: 'correct', label: 'No chest rise', value: r.jaw2 ? `Two-person jaw thrust, ${goodInflations(r, true)} more inflations, chest moving` : 'Not corrected', range: 'Check the head and mask; two-person jaw thrust; repeat the inflations', ok: r.jaw2 && goodInflations(r, true) >= 5 && r.moved, why: 'Without chest movement nothing else works: compressions on an unventilated baby are useless.' },
    { key: 'ventilate', label: 'Ventilation breaths', value: rate === null ? 'Not given' : `${r.ventTimes.length} breaths at about ${Math.round(rate)}/min`, range: 'About 30 a minute for 30 seconds once the chest moves', ok: rate !== null && rate >= 22 && rate <= 40 && r.ventTimes.length >= 12, why: 'Too fast and the lungs do not empty; too slow and she stays hypoxic.' },
    { key: 'reassess', label: 'Reassess', value: r.compressedEarly ? 'Compressions started at a HR of 55, before ventilating' : r.upsideDown ? 'Hung upside down' : r.reassessed ? 'HR over 100, gasping' : 'Not reassessed', range: 'Heart rate and breathing after 30 seconds of ventilation', ok: r.reassessed && !r.compressedEarly && !r.upsideDown, why: 'Compressions only if the heart rate stays under 60 after 30 seconds of effective ventilation.', critical: r.compressedEarly || r.upsideDown },
  ]
}

export function NewbornProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const titles = ['Dry', 'Assess', 'Airway', 'Inflate', 'Ventilate']
  const api = useBench(freshNewborn, coach)
  const { run, runRef, upd, feel, physical, why } = api
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [chest, setChest] = useState(0)
  const svg = useRef<SVGSVGElement>(null)
  const side = useRef<SVGSVGElement>(null)
  const grip = useRef<{ y: number; a: number } | null>(null)
  const inflateStart = useRef<number | null>(null)
  const rub = useRub({ cx: 80, cy: 78, rx: 40, ry: 52 })
  const done = useRef(false)
  const next = () => {
    sfx.select()
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const r = runRef.current
    const { marks, faults } = benchMarks(newbornRows(r), NEWBORN_MARKS, job.grantMarks)
    const ok = r.moved && r.reassessed
    onDone({ marks, faults, summary: ok ? 'Chest moving with ventilation; HR over 100; she is starting to breathe.' : 'Not effectively ventilated.', scene: ok ? [job.scene || 'breathing', 'effective'] : r.moved ? ['effective'] : ['apnoeic'] })
  }
  const hrNow = run.reassessed && run.moved ? 120 : 55
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="newborn-bench">
      <div className="hare-bar">
        <span>NEWBORN · {run.moved ? 'CHEST MOVING' : 'APNOEIC'}</span>
        <span />
        <span>{run.hr ? `HR ${hrNow}` : 'HR ?'}</span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={newbornRows(run)} onContinue={finish} testId="newborn-check" />
        ) : (
          <>
            <p className="io-lede">
              {index === 0 && 'Rub her dry with a warm towel. Wrap her in a dry one, hat on. Stimulate her.'}
              {index === 1 && 'Lift a limb for tone, look for breathing, and listen to the heart: tap the chest.'}
              {index === 2 && 'Drag the head to neutral. Support the chin.'}
              {index === 3 && 'Five inflation breaths: hold each 2–3 seconds. Watch the chest.'}
              {index === 4 && 'Ventilation breaths: tap about once every 2 seconds for 30 seconds. Then listen again.'}
            </p>
            {index <= 1 && (
              <TouchPad
                svg={svg}
                aspect="160 / 160"
                className="mx-auto max-w-[240px]"
                testId="newborn-body"
                onDown={(p) => {
                  if (index === 0) return void rub.rub(p)
                  if (p.y > 120) {
                    upd({ tone: true })
                    return feel('You lift her leg and let go: it flops straight back down.')
                  }
                  if (p.y < 40) {
                    upd({ breathing: true })
                    return feel('No breathing movement; no gasping.')
                  }
                  upd({ hr: true })
                  feel('Stethoscope on the chest: slow beats, about 55 a minute.')
                }}
                onMove={(p) => index === 0 && (rub.rub(p), upd({ dried: rub.coverage }))}
                onUp={() => index === 0 && runRef.current.dried >= 0.7 && feel('Dried all over; the wet towel thrown away.')}
              >
                <svg ref={svg} viewBox="0 0 160 160" className="block h-full w-full select-none" data-testid="newborn-view">
                  <rect width="160" height="160" fill="#e8e0d0" />
                  <circle cx="80" cy="30" r="20" fill="#c8a0a8" stroke="#8a5238" />
                  {run.wrapped && <path d="M60 18 Q80 4 100 18" stroke="#3a70c0" strokeWidth="6" fill="none" />}
                  <ellipse cx="80" cy="84" rx="30" ry="40" fill={run.wrapped ? '#f0f0f0' : '#c8a0a8'} stroke="#8a5238" />
                  <rect x="60" y="118" width="10" height="34" rx="5" fill="#c8a0a8" stroke="#8a5238" />
                  <rect x="90" y="118" width="10" height="34" rx="5" fill="#c8a0a8" stroke="#8a5238" />
                  {index === 0 && <RubTint rub={rub} colour="#ffffff" />}
                  <text x="4" y="156" fontFamily={FONT} fontSize="4.5" fill="#40404c">
                    PALE, FLOPPY · ON THE RESUSCITAIRE
                  </text>
                </svg>
              </TouchPad>
            )}
            {index >= 2 && (
              <TouchPad
                svg={side}
                aspect="200 / 110"
                testId="newborn-head"
                onDown={(p) => (grip.current = { y: p.y, a: runRef.current.headAngle })}
                onMove={(p) => {
                  const g = grip.current
                  if (!g || index !== 2) return
                  upd({ headAngle: Math.max(-40, Math.min(40, g.a + (p.y - g.y) * 0.8)) })
                }}
                onUp={() => {
                  grip.current = null
                  const a = runRef.current.headAngle
                  if (index === 2) feel(Math.abs(a) <= 10 ? 'Head neutral: the face looking straight up, a small roll under the shoulders.' : a > 0 ? 'Flexed: the big occiput tips the chin onto the chest.' : 'Over-extended: the soft trachea kinks.')
                }}
              >
                <svg ref={side} viewBox="0 0 200 110" className="block h-full w-full select-none" data-testid="newborn-side">
                  <rect width="200" height="110" fill="#e8e0d0" />
                  <rect x="70" y="60" width="120" height="30" rx="12" fill="#c8a0a8" stroke="#8a5238" />
                  <ellipse cx="130" cy="58" rx="40" ry={8 + chest * 6} fill="#c8a0a8" stroke="#8a5238" opacity="0.6" />
                  <g transform={`rotate(${run.headAngle} 70 74)`}>
                    <circle cx="48" cy="66" r="24" fill="#c8a0a8" stroke="#8a5238" />
                    {index >= 3 && <path d="M58 46 L76 52 L74 64 L56 60 Z" fill="#a8c8e8" stroke="#305070" opacity="0.9" />}
                  </g>
                  {(run.chin || run.jaw2) && <ellipse cx="62" cy="84" rx="8" ry="5" fill="#c89070" stroke="#6a3a20" />}
                  {run.jaw2 && <ellipse cx="34" cy="84" rx="8" ry="5" fill="#c89070" stroke="#6a3a20" />}
                  <text x="4" y="10" fontFamily={FONT} fontSize="4.5" fill="#40404c">
                    SIDE VIEW · HEAD {Math.abs(run.headAngle) <= 10 ? 'NEUTRAL' : run.headAngle > 0 ? 'FLEXED' : 'EXTENDED'}
                  </text>
                </svg>
              </TouchPad>
            )}
            <div className="io-choices mt-2">
              {index === 0 && (
                <>
                  <button type="button" className="tap io-mini" data-on={run.wrapped || undefined} data-testid="newborn-wrap" onClick={() => (upd({ wrapped: true }), feel('Wrapped in a dry warm towel, hat on.'))}>
                    WRAP AND HAT
                  </button>
                  <button type="button" className="tap io-mini" data-on={run.stimulated || undefined} data-testid="newborn-stim" onClick={() => (upd({ stimulated: true }), feel('You rub her back and flick her soles. Nothing.'))}>
                    STIMULATE
                  </button>
                  <button type="button" className="tap io-mini" data-testid="newborn-hang" onClick={() => (upd({ upsideDown: true }), buzz(40), physical('You hold her upside down by the ankles.'), why('Never hang a baby upside down: it drains nothing and risks injury.'))}>
                    HANG HER UPSIDE DOWN TO DRAIN
                  </button>
                </>
              )}
              {index === 1 && (
                <button
                  type="button"
                  className="tap io-mini"
                  data-testid="newborn-compress"
                  onClick={() => {
                    upd({ compressedEarly: true })
                    buzz([60, 40, 60])
                    physical('You start chest compressions on an unventilated baby.')
                    why('A heart rate of 55 in a newborn is hypoxic: ventilate first. Compressions only after 30 seconds of effective ventilation.')
                  }}
                >
                  START CHEST COMPRESSIONS
                </button>
              )}
              {index === 2 && (
                <button type="button" className="tap io-mini" data-on={run.chin || undefined} data-testid="newborn-chin" onClick={() => (upd({ chin: true }), feel('A finger under the bony chin, lifting it.'))}>
                  CHIN SUPPORT
                </button>
              )}
              {index === 3 && (
                <>
                  <HoldButton
                    testId="newborn-inflate"
                    className="w-full"
                    onTick={(dt) => setChest((c) => (chestMoves(runRef.current) ? Math.min(1, c + dt) : c))}
                    onStart={() => {
                      inflateStart.current = performance.now()
                      setChest(0)
                    }}
                    onEnd={() => {
                      const s = (performance.now() - (inflateStart.current ?? performance.now())) / 1000
                      inflateStart.current = null
                      const cur = upd((r) => ({ inflations: [...r.inflations, { s, jaw: r.jaw2 }], moved: r.moved || chestMoves(r) }))
                      setTimeout(() => setChest(0), 300)
                      const n = cur.inflations.filter((i) => i.jaw === cur.jaw2).length
                      if (s < 2) return why('Hold each inflation for 2–3 seconds.')
                      if (chestMoves(cur)) feel(`Inflation ${n}: the chest rises.`)
                      else feel(`Inflation ${n}: ${s.toFixed(1)} s at 30 cmH2O. The chest is not moving.`)
                    }}
                  >
                    HOLD AN INFLATION BREATH
                  </HoldButton>
                  <button type="button" className="tap io-mini" data-on={run.jaw2 || undefined} data-testid="newborn-jaw" onClick={() => (upd({ jaw2: true }), feel('The junior holds the mask with both hands and thrusts the jaw forward; you squeeze the bag.'))}>
                    TWO-PERSON JAW THRUST
                  </button>
                </>
              )}
              {index === 4 && (
                <>
                  <button
                    type="button"
                    className="tap io-mini"
                    data-testid="newborn-breath"
                    onClick={() => {
                      const t = performance.now() / 1000
                      upd((r) => ({ ventTimes: [...r.ventTimes, t] }))
                      setChest(1)
                      setTimeout(() => setChest(0), 400)
                    }}
                  >
                    VENTILATION BREATH ({run.ventTimes.length})
                  </button>
                  <button
                    type="button"
                    className="tap io-mini"
                    data-testid="newborn-listen"
                    onClick={() => {
                      const ok = runRef.current.moved && runRef.current.ventTimes.length >= 12
                      upd({ reassessed: ok })
                      if (ok) feel('Heart rate 120 and rising; she gasps, then cries. Pinking up.')
                      else physical('Still about 55: she is not being ventilated yet.')
                    }}
                  >
                    LISTEN TO THE HEART
                  </button>
                </>
              )}
            </div>
            <NextButton onClick={next} testId="newborn-next">
              {titles[index + 1] ?? 'Finish'}
            </NextButton>
            <NoteLine note={api.note} />
          </>
        )}
      </div>
    </div>
  )
}
