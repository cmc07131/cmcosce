import { useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, RubTint, TouchPad, benchMarks, useRub, type CheckRow, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'

/**
 * CPR by hand (RCUK/ERC 2021). Compressions: press down on the lower half of the sternum and release, at a rate and
 * depth that are measured. Breaths: squeeze the bag for about a second.
 * `pose: "drowning"`: clear the vomit, five rescue breaths first, then 30:2; the rhythm is asystole.
 * `pose: "lightning"`: keep the nurse compressing, AED pads on, shock and resume at once, ventilate (it is the
 * apnoea that kills), find the pulse at the rhythm check, and keep ventilating.
 */

const FONT = 'Press Start 2P, monospace'
export const DROWNING_MARKS = ['airway', 'rescue', 'compressions', 'rhythm'] as const
export const LIGHTNING_MARKS = ['continue', 'aed', 'shock', 'ventilate', 'rosc', 'keepvent'] as const

export type Press = { t: number; cm: number; site: 'lower-sternum' | 'other' }
export type CprRun = {
  suction: number
  rescue: number[]
  presses: Press[]
  breaths: number[]
  hardBreaths: number
  rhythm: 'asystole' | 'vf' | null
  thrusts: boolean
  collar: boolean
  nurseOn: boolean
  pads: Pt[]
  analysed: boolean
  shockedAt: number | null
  resumedAt: number | null
  opa: boolean
  pulseFelt: boolean
  postBreaths: number
}
export const freshCpr = (): CprRun => ({ suction: 0, rescue: [], presses: [], breaths: [], hardBreaths: 0, rhythm: null, thrusts: false, collar: false, nurseOn: false, pads: [], analysed: false, shockedAt: null, resumedAt: null, opa: false, pulseFelt: false, postBreaths: 0 })

export function compressionStats(presses: Press[]) {
  if (presses.length < 6) return null
  const ts = presses.map((p) => p.t)
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).filter((g) => g < 1.5)
  const rate = gaps.length ? 60 / (gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0
  const depth = presses.reduce((a, p) => a + p.cm, 0) / presses.length
  const onSite = presses.filter((p) => p.site === 'lower-sternum').length / presses.length
  return { rate, depth, onSite, n: presses.length }
}

const goodCompressions = (r: CprRun) => {
  const s = compressionStats(r.presses)
  return !!s && s.rate >= 95 && s.rate <= 125 && s.depth >= 4.8 && s.depth <= 6.5 && s.onSite >= 0.8 && s.n >= 30
}
const padsOk = (pads: Pt[]) => pads.length === 2 && pads.some((p) => p.x < 70 && p.y < 60) && pads.some((p) => p.x > 100 && p.y > 80)

export function cprRows(r: CprRun, pose: 'drowning' | 'lightning'): CheckRow[] {
  const s = compressionStats(r.presses)
  const comp = s ? `${s.n} at ${Math.round(s.rate)}/min, ${s.depth.toFixed(1)} cm, ${Math.round(s.onSite * 100)}% on the lower sternum` : 'Too few'
  if (pose === 'drowning')
    return [
      { key: 'airway', label: 'Airway', value: r.suction >= 0.7 ? 'Vomit suctioned' : 'Not cleared', range: 'Open the airway and suction the vomit', ok: r.suction >= 0.7, why: 'Breaths into a mouth full of vomit go to the stomach or the lungs.' },
      { key: 'rescue', label: 'Rescue breaths', value: `${r.rescue.length} before compressions${r.thrusts ? '; abdominal thrusts' : ''}${r.collar ? '; collar first' : ''}`, range: 'Five rescue breaths with bag-mask and oxygen, before compressions', ok: r.rescue.length >= 5 && !r.thrusts && !r.collar, why: 'Drowning is a hypoxic arrest: oxygen first. Abdominal thrusts only bring up more water and vomit.', critical: r.thrusts },
      { key: 'compressions', label: 'Compressions', value: comp, range: '100–120/min, 5–6 cm, lower half of the sternum, 30:2', ok: goodCompressions(r) && r.breaths.length >= 2, why: 'Rate and depth are what move blood.' },
      { key: 'rhythm', label: 'Rhythm', value: r.rhythm ? (r.rhythm === 'asystole' ? 'Asystole: non-shockable' : 'Called it shockable') : 'Not checked', range: 'Asystole: non-shockable; continue CPR, adrenaline', ok: r.rhythm === 'asystole', why: 'Shocking asystole does nothing and interrupts compressions.' },
    ]
  const pause = r.shockedAt !== null && r.resumedAt !== null ? r.resumedAt - r.shockedAt : null
  return [
    { key: 'continue', label: 'CPR continues', value: r.nurseOn ? 'The nurse keeps compressing' : 'Compressions stopped', range: 'Keep high-quality CPR going while you set up', ok: r.nurseOn && goodCompressions(r), why: 'Every pause drops coronary perfusion to zero.' },
    { key: 'aed', label: 'AED', value: padsOk(r.pads) ? 'Pads right infraclavicular and apical' : r.pads.length ? 'Pads misplaced' : 'No pads', range: 'Pads on early: right below the clavicle, left at the apex', ok: padsOk(r.pads) && r.analysed, why: 'Lightning causes VF; the earlier the shock, the better.' },
    { key: 'shock', label: 'Shock', value: r.shockedAt === null ? 'No shock' : `Shocked; compressions back ${pause === null ? 'never' : `${pause.toFixed(1)} s later`}`, range: 'Shock, then straight back to compressions', ok: r.shockedAt !== null && pause !== null && pause <= 3, why: 'Do not wait to check the rhythm after a shock: 2 minutes of CPR first.' },
    { key: 'ventilate', label: 'Ventilation', value: `${r.opa ? 'OPA, ' : ''}${r.breaths.length} bag-mask breaths${r.hardBreaths ? `, ${r.hardBreaths} too forceful` : ''}`, range: 'Head tilt, chin lift, OPA, bag-mask with oxygen, gentle breaths', ok: r.opa && r.breaths.length >= 4 && r.hardBreaths <= 1, why: 'Lightning paralyses the respiratory centre: the heart restarts but the breathing does not.' },
    { key: 'rosc', label: 'ROSC', value: r.pulseFelt ? 'Organised rhythm; carotid pulse felt' : 'Not recognised', range: 'Rhythm check at 2 minutes: organised rhythm, check the pulse', ok: r.pulseFelt, why: 'An organised rhythm needs a pulse check to call it ROSC.' },
    { key: 'keepvent', label: 'Keep ventilating', value: `${r.postBreaths} breaths after ROSC`, range: 'Still apnoeic: keep ventilating, about 10 a minute', ok: r.postBreaths >= 3, why: 'He will arrest again from hypoxia if you stop.' },
  ]
}

export function CprProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const pose = job.pose === 'lightning' ? 'lightning' : 'drowning'
  const titles = pose === 'drowning' ? ['Airway', 'Rescue breaths', 'CPR', 'Rhythm'] : ['CPR', 'AED', 'Shock', 'Ventilate', 'Rhythm check']
  const api = useBench(freshCpr, coach)
  const { run, runRef, upd, feel, physical, why } = api
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [chest, setChest] = useState(0)
  const svg = useRef<SVGSVGElement>(null)
  const press = useRef<{ y: number; site: Press['site'] } | null>(null)
  const breathStart = useRef<number | null>(null)
  const rub = useRub({ cx: 80, cy: 30, rx: 22, ry: 14 })
  const done = useRef(false)
  const step = titles[index]
  const next = () => {
    sfx.select()
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  const rows = cprRows(run, pose)
  function finish() {
    if (done.current) return
    done.current = true
    const r = runRef.current
    const { marks, faults } = benchMarks(rows, (pose === 'drowning' ? DROWNING_MARKS : LIGHTNING_MARKS) as readonly string[], job.grantMarks)
    const scene = pose === 'drowning' ? (r.rhythm === 'asystole' ? 'asystole' : 'cpr') : r.pulseFelt ? 'rosc' : 'cpr'
    onDone({ marks, faults, summary: `CPR: ${compressionStats(r.presses) ? `${Math.round(compressionStats(r.presses)!.rate)}/min, ${compressionStats(r.presses)!.depth.toFixed(1)} cm` : 'few compressions'}.`, scene: [scene] })
  }

  const breathButton = (label: string, onGood: (cur: CprRun) => void) => (
    <HoldButton
      testId="cpr-breath"
      className="w-full"
      onStart={() => (breathStart.current = performance.now())}
      onTick={() => setChest((c) => Math.min(1, c + 0.05))}
      onEnd={() => {
        const s = (performance.now() - (breathStart.current ?? performance.now())) / 1000
        breathStart.current = null
        setTimeout(() => setChest(0), 300)
        if (s < 0.5) return feel('Too short to move the chest.')
        if (s > 1.8) {
          upd((r) => ({ hardBreaths: r.hardBreaths + 1 }))
          return physical('A long, forceful squeeze: the stomach bulges.')
        }
        onGood(runRef.current)
      }}
    >
      {label}
    </HoldButton>
  )

  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="cpr-bench">
      <div className="hare-bar">
        <span>{pose === 'drowning' ? 'DROWNING · 35.0 °C' : 'LIGHTNING · CASUALTY A'}</span>
        <span />
        <span>{run.pulseFelt ? 'ROSC' : 'NO PULSE'}</span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={rows} onContinue={finish} testId="cpr-check" />
        ) : (
          <>
            <p className="io-lede">
              {step === 'Airway' && 'Tilt the head and suction the vomit out of his mouth: drag the sucker over it.'}
              {step === 'Rescue breaths' && 'Five rescue breaths with the bag-mask and oxygen: squeeze about a second each.'}
              {step === 'CPR' && 'Press down on the lower half of the sternum and release: drag down and let go, 100–120 a minute. 30 compressions, then 2 breaths.'}
              {step === 'Rhythm' && 'Pause for the rhythm check.'}
              {step === 'AED' && 'Tap where each pad goes while the nurse keeps compressing. Then analyse.'}
              {step === 'Shock' && '"Shock advised." Everyone clear: shock, then straight back on the chest.'}
              {step === 'Ventilate' && 'Head tilt, chin lift, an OPA, and bag-mask breaths with oxygen.'}
              {step === 'Rhythm check' && 'Two minutes: an organised rhythm on the AED. Feel the carotid pulse. Then keep ventilating.'}
            </p>
            <TouchPad
              svg={svg}
              aspect="160 / 160"
              className="mx-auto max-w-[260px]"
              testId="cpr-chest"
              onDown={(p) => {
                if (step === 'Airway') return void rub.rub(p)
                if (step === 'AED') {
                  const pads = [...runRef.current.pads, p].slice(-2)
                  upd({ pads })
                  return feel(pads.length === 2 ? (padsOk(pads) ? 'Both pads on: right infraclavicular and the apex.' : 'Both pads on, but not across the heart.') : 'One pad on.')
                }
                if (step === 'Rhythm check') {
                  if (p.y < 40 && Math.abs(p.x - 80) > 6) {
                    upd({ pulseFelt: true })
                    return feel('A carotid pulse under your fingers: ROSC. He is still not breathing.')
                  }
                  return feel('Feel at the side of the neck.')
                }
                if (step === 'CPR' || step === 'Shock' || step === 'Ventilate') {
                  const site: Press['site'] = p.y > 70 && p.y < 110 && Math.abs(p.x - 80) < 12 ? 'lower-sternum' : 'other'
                  press.current = { y: p.y, site }
                }
              }}
              onMove={(p) => {
                if (step === 'Airway') {
                  rub.rub(p)
                  upd({ suction: rub.coverage })
                  return
                }
                if (press.current) setChest(Math.min(1, Math.max(0, (p.y - press.current.y) / 36)))
              }}
              onUp={(p) => {
                if (step === 'Airway') return runRef.current.suction >= 0.7 && feel('The vomit is out; the airway is clear.')
                const pr = press.current
                press.current = null
                setChest(0)
                if (!pr || !p) return
                const cm = Math.max(0, Math.min(8, (p.y - pr.y) / 6))
                if (cm < 1) return
                const t = performance.now() / 1000
                const cur = upd((r) => ({ presses: [...r.presses, { t, cm, site: pr.site }], resumedAt: r.shockedAt !== null && r.resumedAt === null ? t : r.resumedAt }))
                const n = cur.presses.length
                if (pr.site === 'other' && cur.presses.filter((x) => x.site === 'other').length === 1) why('Hands on the lower half of the sternum, in the centre of the chest.')
                if (n % 10 === 0) {
                  const s = compressionStats(cur.presses.slice(-10))
                  if (s) feel(`${n} compressions: ${Math.round(s.rate)} a minute, about ${s.depth.toFixed(1)} cm deep.`)
                }
              }}
            >
              <svg ref={svg} viewBox="0 0 160 160" className="block h-full w-full select-none" data-testid="cpr-view">
                <rect width="160" height="160" fill="#d8dee4" />
                <circle cx="80" cy="22" r="18" fill="#e0b8a0" stroke="#8a5238" />
                {pose === 'drowning' && run.suction < 0.7 && <ellipse cx="80" cy="30" rx="10" ry="5" fill="#c8b860" opacity={1 - run.suction} />}
                {step === 'Airway' && <RubTint rub={rub} colour="#e0b8a0" />}
                <path d={`M40 40 L120 40 L126 150 L34 150 Z`} fill="#e0b8a0" stroke="#8a5238" />
                <rect x="76" y="48" width="8" height={64 - chest * 6} fill="#c89878" opacity="0.7" />
                <rect x="66" y="76" width="28" height="30" rx="4" fill="none" stroke="#3060c0" strokeDasharray="2 3" opacity="0.4" />
                {run.pads.map((p, i) => (
                  <rect key={i} x={p.x - 9} y={p.y - 12} width="18" height="24" rx="3" fill="#f8f8f4" stroke="#303848" />
                ))}
                <ellipse cx="80" cy="96" rx="40" ry={4 + chest * 2} fill="none" stroke="#8a5238" opacity="0.4" />
                <text x="4" y="156" fontFamily={FONT} fontSize="4.5" fill="#40404c">
                  {run.presses.length} COMPRESSIONS · {run.breaths.length} BREATHS
                </text>
              </svg>
            </TouchPad>
            <div className="io-choices mt-2">
              {pose === 'drowning' && step === 'Rescue breaths' &&
                breathButton(`SQUEEZE: RESCUE BREATH (${run.rescue.length})`, () => {
                  upd((r) => ({ rescue: [...r.rescue, performance.now()] }))
                  feel(`Rescue breath ${runRef.current.rescue.length}: the chest rises.`)
                })}
              {(step === 'CPR' || step === 'Ventilate') &&
                breathButton(`SQUEEZE THE BAG (${run.breaths.length})`, () => {
                  upd((r) => ({ breaths: [...r.breaths, performance.now()] }))
                  feel('A gentle breath over a second: the chest rises.')
                })}
              {pose === 'drowning' && step === 'Rhythm' && (
                <>
                  <button type="button" className="tap io-mini" data-testid="cpr-asystole" onClick={() => (upd({ rhythm: 'asystole' }), feel('A flat line in two leads, gain up: asystole. Non-shockable. Back on the chest; adrenaline.'))}>
                    ASYSTOLE: NON-SHOCKABLE
                  </button>
                </>
              )}
              {pose === 'lightning' && step === 'CPR' && (
                <button type="button" className="tap io-mini" data-on={run.nurseOn || undefined} data-testid="cpr-nurse" onClick={() => (upd({ nurseOn: true }), feel('"Keep going, 30:2, I’ll get the AED on."'))}>
                  “NURSE, KEEP COMPRESSING”
                </button>
              )}
              {pose === 'lightning' && step === 'AED' && (
                <button type="button" className="tap io-mini" data-on={run.analysed || undefined} data-testid="cpr-analyse" onClick={() => (upd({ analysed: true }), feel('"Analysing… shock advised."'))}>
                  ANALYSE
                </button>
              )}
              {pose === 'lightning' && step === 'Shock' && (
                <button
                  type="button"
                  className="tap io-mini"
                  data-testid="cpr-shock"
                  onClick={() => {
                    if (!run.analysed) return feel('Analyse first.')
                    upd({ shockedAt: performance.now() / 1000, resumedAt: null })
                    buzz([60, 30, 60])
                    feel('"Stand clear!" Shock delivered. Straight back on the chest.')
                  }}
                >
                  ⚡ SHOCK
                </button>
              )}
              {pose === 'lightning' && step === 'Ventilate' && (
                <button type="button" className="tap io-mini" data-on={run.opa || undefined} data-testid="cpr-opa" onClick={() => (upd({ opa: true }), feel('Head tilt, chin lift; an OPA sized from incisors to the angle of the jaw slips in.'))}>
                  HEAD TILT, CHIN LIFT, OPA
                </button>
              )}
              {pose === 'lightning' && step === 'Rhythm check' &&
                breathButton(`KEEP VENTILATING (${run.postBreaths})`, () => {
                  upd((r) => ({ postBreaths: r.postBreaths + 1 }))
                  feel('A breath every six seconds: his saturation climbs.')
                })}
            </div>
            <NextButton onClick={next} testId="cpr-next">
              {titles[index + 1] ?? 'Finish'}
            </NextButton>
            <NoteLine note={api.note} />
          </>
        )}
      </div>
    </div>
  )
}
