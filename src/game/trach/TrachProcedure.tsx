import { useEffect, useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench } from '../bench/core'
import { CheckCard, TouchPad, benchMarks, type CheckRow, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'

/**
 * A blocked tracheostomy (NTSP emergency algorithm), by hand: the speaking valve off, the inner cannula out (crusted
 * shut), a suction catheter down to prove the tube is clear, a clean inner cannula back, humidified oxygen. His
 * saturation falls while the tube stays blocked; the capnograph shows breath only once it is patent.
 */

const FONT = 'Press Start 2P, monospace'
export const TRACH_MARKS = ['valve', 'inner', 'suction', 'replace'] as const

export type TrachRun = {
  valveOff: boolean
  innerOut: boolean
  /** The blocked inner cannula was taken out at some point. */
  innerRemoved: boolean
  passed: number
  catheterStuck: boolean
  replaced: boolean
  humidified: boolean
  pulledTube: boolean
  baggedHard: number
  spo2: number
  lowest: number
}

export const fresh = (): TrachRun => ({ valveOff: false, innerOut: false, innerRemoved: false, passed: 0, catheterStuck: false, replaced: false, humidified: false, pulledTube: false, baggedHard: 0, spo2: 84, lowest: 84 })
const patent = (r: TrachRun) => r.valveOff && (r.innerOut || r.replaced) && !r.pulledTube

export function trachRows(r: TrachRun): CheckRow[] {
  return [
    { key: 'valve', label: 'Speaking valve', value: r.valveOff ? 'Removed' : 'Left on', range: 'Off first: it stops him breathing out through the tube', ok: r.valveOff, why: 'A valve or cap on a blocked or cuffed tube means no way out for the air.' },
    { key: 'inner', label: 'Inner cannula', value: r.pulledTube ? 'Pulled the whole tube out instead' : r.innerRemoved ? 'Removed: crusted with secretions' : 'Left in', range: 'Remove the inner cannula: the commonest block is inside it', ok: r.innerRemoved && !r.pulledTube, why: 'A 3-week-old track can close; the inner cannula comes out in a second.', critical: r.pulledTube },
    { key: 'suction', label: 'Suction catheter', value: r.passed >= 1 ? 'Passes freely to the carina' : r.catheterStuck ? 'Stopped: still blocked' : 'Not passed', range: 'A suction catheter passes easily: the tube is clear', ok: r.passed >= 1, why: 'If it will not pass, the tube is blocked or misplaced: deflate the cuff, then remove it.' },
    { key: 'replace', label: 'Replace and humidify', value: [r.replaced && 'clean inner cannula in', r.humidified && 'humidified oxygen'].filter(Boolean).join(', ') || 'Neither', range: 'A clean inner cannula back in; humidify the oxygen', ok: r.replaced && r.humidified, why: 'Dry oxygen through a tracheostomy is why the secretions crusted in the first place.' },
  ]
}

export function TrachProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const titles = ['Valve', 'Inner cannula', 'Suction', 'Replace']
  const api = useBench(fresh, coach)
  const { run, runRef, upd, feel, physical, why } = api
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [catheter, setCatheter] = useState(0)
  const [co2, setCo2] = useState<number[]>(() => Array(80).fill(0))
  const done = useRef(false)
  const svg = useRef<SVGSVGElement>(null)
  const grip = useRef<number | null>(null)

  // His saturation and the capnograph run on a timer.
  useEffect(() => {
    let t = 0
    const id = window.setInterval(() => {
      t += 0.2
      const r = runRef.current
      const open = patent(r)
      const spo2 = Math.max(62, Math.min(97, r.spo2 + (open ? 1.2 : -0.25)))
      upd({ spo2, lowest: Math.min(r.lowest, spo2) })
      const phase = (t % 3) / 3
      setCo2((a) => [...a.slice(1), open && phase > 0.15 && phase < 0.6 ? 1 : 0])
    }, 200)
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
    const { marks, faults } = benchMarks(trachRows(r), TRACH_MARKS, job.grantMarks)
    if (r.baggedHard > 1) faults.push({ text: 'Bagged hard through a blocked tube: surgical emphysema and no ventilation. Clear it first.', critical: false })
    onDone({ marks, faults, summary: `Tracheostomy ${patent(r) ? 'patent' : 'still blocked'}; lowest SpO2 ${Math.round(r.lowest)}%.`, scene: patent(r) ? [job.scene || 'patent'] : ['blocked'] })
  }

  function tapNeck(p: Pt) {
    const cur = runRef.current
    if (index === 0 && Math.hypot(p.x - 100, p.y - 30) < 16) {
      upd({ valveOff: true })
      return feel('The speaking valve twisted off. Still no breath through the tube.')
    }
    if (index === 1 && Math.hypot(p.x - 100, p.y - 50) < 20) {
      if (!cur.valveOff) return feel('The speaking valve is on top of it. Off first.')
      upd({ innerOut: true, innerRemoved: true })
      buzz(40)
      return feel('The inner cannula slides out, plugged solid with dry crusted secretions. A rush of air: he breathes through the tube.')
    }
  }

  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="trach-bench">
      <div className="hare-bar">
        <span>SPO2 {Math.round(run.spo2)}%</span>
        <span className="hare-pain">
          <i style={{ width: `${run.spo2}%` }} />
        </span>
        <span>{patent(run) ? 'PATENT' : 'BLOCKED'}</span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={trachRows(run)} onContinue={finish} testId="trach-check" />
        ) : (
          <>
            <p className="io-lede">
              {index === 0 && 'Look at the tube. Tap the speaking valve to take it off.'}
              {index === 1 && 'Tap the inner cannula to remove it.'}
              {index === 2 && 'Drag a suction catheter down the tube. It should pass easily.'}
              {index === 3 && 'Clean inner cannula back in; humidify the oxygen.'}
            </p>
            <TouchPad
              svg={svg}
              aspect="200 / 160"
              className="mx-auto max-w-[280px]"
              testId="trach-neck"
              onDown={(p) => {
                if (index === 2) grip.current = p.y
                else tapNeck(p)
              }}
              onMove={(p) => {
                if (index !== 2 || grip.current === null) return
                const cur = runRef.current
                const blocked = !cur.innerOut && !cur.replaced
                const depth = Math.max(0, Math.min(blocked ? 0.25 : 1, (p.y - grip.current) / 80))
                setCatheter(depth)
                if (blocked && depth >= 0.25 && !cur.catheterStuck) {
                  upd({ catheterStuck: true })
                  physical('The catheter stops a few centimetres in: the tube is blocked.')
                }
                if (!blocked && depth >= 0.95 && cur.passed === 0) {
                  upd({ passed: 1 })
                  feel('The catheter passes freely to the carina; he coughs. The tube is clear.')
                }
              }}
              onUp={() => {
                grip.current = null
                window.setTimeout(() => setCatheter(0), 400)
              }}
            >
              <svg ref={svg} viewBox="0 0 200 160" className="block h-full w-full select-none" data-testid="trach-view">
                <rect width="200" height="160" fill="#eef2f4" />
                <path d="M40 160 L52 60 Q100 40 148 60 L160 160 Z" fill="#e8b494" stroke="#8a5238" />
                <path d="M86 72 L114 72 L110 150 L90 150 Z" fill="#c8a080" opacity="0.5" />
                {/* flange, outer tube, inner cannula, valve */}
                <rect x="60" y="64" width="80" height="12" rx="4" fill="#d8e8f8" stroke="#506070" />
                <rect x="88" y="40" width="24" height="30" rx="3" fill="#e8f0f8" stroke="#506070" />
                {!run.innerOut && <rect x="92" y="36" width="16" height="30" rx="3" fill={run.replaced ? '#ffffff' : '#c8b878'} stroke="#706040" />}
                {!run.valveOff && <rect x="88" y="22" width="24" height="14" rx="4" fill="#9060c0" stroke="#503080" />}
                {catheter > 0 && <line x1="100" y1="10" x2="100" y2={40 + catheter * 100} stroke="#e0f0e0" strokeWidth="4" strokeLinecap="round" />}
                {/* capnography */}
                <rect x="4" y="124" width="60" height="32" fill="#081008" />
                <polyline points={co2.map((v, i) => `${4 + i * 0.75},${152 - v * 22}`).join(' ')} fill="none" stroke="#f8d030" strokeWidth="1.2" />
                <text x="6" y="132" fontFamily={FONT} fontSize="4" fill="#f8d030">
                  ETCO2
                </text>
                <text x="4" y="10" fontFamily={FONT} fontSize="5" fill="#40404c">
                  TRACHEOSTOMY · CUFFED, INNER CANNULA
                </text>
              </svg>
            </TouchPad>
            <div className="io-choices mt-2">
              {index === 3 && (
                <>
                  <button type="button" className="tap io-mini" data-on={run.replaced || undefined} data-testid="trach-replace" onClick={() => (upd({ replaced: true, innerOut: false }), feel('A clean inner cannula clicked in.'))}>
                    {run.replaced ? 'REPLACED ✓' : 'CLEAN INNER CANNULA IN'}
                  </button>
                  <button type="button" className="tap io-mini" data-on={run.humidified || undefined} data-testid="trach-humid" onClick={() => (upd({ humidified: true }), feel('Humidified high-flow oxygen on the tracheostomy mask, and to his face.'))}>
                    {run.humidified ? 'HUMIDIFIED ✓' : 'HUMIDIFY THE OXYGEN'}
                  </button>
                </>
              )}
            </div>
            <NextButton onClick={next} testId="trach-next">
              {titles[index + 1] ?? 'Finish'}
            </NextButton>
            <NoteLine note={api.note} />
          </>
        )}
      </div>
    </div>
  )
}
