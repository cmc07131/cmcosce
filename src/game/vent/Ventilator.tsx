import { useEffect, useRef, useState } from 'react'
import type { BenchResult, PerformJob } from '../store'
import { sfx } from '../sfx'
import { MODES, RANGES, VENT_MARKS, checkVent, defaults, nudge, scoreVent, ventSpec, type Setting, type VentSettings } from './model'

/**
 * Set the ventilator yourself, on a transport ventilator laid out like an Oxylog 3000: a screen with the pressure
 * curve and measured values, mode keys, soft keys for PEEP and Pmax, and three rotary knobs (O2, VT, RR). Tap a
 * setting, turn it with − / +, then START.
 */
export function Ventilator({ job, onDone }: { job: PerformJob; onDone: (r: BenchResult) => void }) {
  const spec = ventSpec(job.pose)
  const [s, setS] = useState<VentSettings>(defaults)
  const [sel, setSel] = useState<Setting>('fio2')
  const [running, setRunning] = useState(false)
  const [t, setT] = useState(0)
  const done = useRef(false)

  // The pressure curve moves once it is running. Timers, not animation frames.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setT((v) => v + 0.1), 100)
    return () => window.clearInterval(id)
  }, [running])

  const score = scoreVent(s, spec)
  const turn = (dir: 1 | -1) => {
    sfx.cursor()
    setS((cur) => nudge(cur, sel, dir))
  }

  // The first START is the one that is scored; after the check you may adjust and START again to learn.
  const first = useRef<{ settings: VentSettings; score: ReturnType<typeof scoreVent> } | null>(null)
  const [checked, setChecked] = useState(false)
  const rows = checkVent(s, spec)
  const allOk = rows.every((r) => r.ok)

  function start() {
    if (done.current) return
    sfx.select()
    setRunning(true)
    if (!first.current) first.current = { settings: s, score }
    setChecked(true)
  }

  function finish() {
    if (done.current || !first.current) return
    done.current = true
    sfx.select()
    const f = first.current
    const marks = f.score.earned.map((k) => job.grantMarks[VENT_MARKS.indexOf(k)]).filter((m): m is string => Boolean(m))
    const changed = JSON.stringify(f.settings) !== JSON.stringify(s)
    const line = (v: VentSettings) => `${v.mode}, VT ${v.vt} mL, RR ${v.rr}, FiO2 ${v.fio2}%, PEEP ${v.peep}, Pmax ${v.pmax}`
    onDone({
      marks,
      faults: f.score.faults,
      summary: `Ventilator: ${line(f.settings)}.${changed ? ` Corrected after the check to ${line(s)}.` : ''} ETCO2 ${score.etco2.toFixed(1)} kPa.`,
      scene: ['ventilated'],
    })
  }

  // A square-ish pressure waveform: inspiration at the rate set, peak by volume, baseline at PEEP.
  const period = 60 / Math.max(1, s.rr)
  const peak = Math.min(s.pmax, s.peep + s.vt / 30)
  const points = Array.from({ length: 80 }, (_, i) => {
    const time = t + (i / 80) * 6
    const phase = (time % period) / period
    const p = running ? (phase < 0.33 ? s.peep + (peak - s.peep) * Math.min(1, phase * 9) : s.peep) : 0
    return `${10 + i * 2.2},${70 - p * 1.4}`
  }).join(' ')

  const key = (k: Setting) => (
    <button key={k} type="button" className="vent-soft" data-on={sel === k || undefined} data-testid={`vent-${k}`} onClick={() => setSel(k)}>
      <b>{RANGES[k].label}</b>
      <span>{s[k]}</span>
    </button>
  )

  return (
    <div className="vent" data-testid="ventilator">
      <div className="vent-body">
        <div className="vent-top">
          <svg viewBox="0 0 200 90" className="vent-screen">
            <rect width="200" height="90" fill="#0a1420" />
            <text x="6" y="12" fontSize="7" fill="#9ad8ff" fontFamily="Press Start 2P, monospace">
              {s.mode}
            </text>
            <text x="120" y="12" fontSize="6" fill="#f0e060" fontFamily="Press Start 2P, monospace">
              {running ? 'RUNNING' : 'STANDBY'}
            </text>
            <polyline points={points} fill="none" stroke="#f0e060" strokeWidth="1.5" />
            <text x="6" y="84" fontSize="6" fill="#9ad8ff" fontFamily="Press Start 2P, monospace">
              MV {running ? score.mv.toFixed(1) : '--'} L  Ppk {running ? Math.round(peak) : '--'}  EtCO2 {running ? score.etco2.toFixed(1) : '--'}
            </text>
          </svg>
          <div className="vent-modes">
            {MODES.map((m) => (
              <button key={m} type="button" className="vent-mode" data-on={s.mode === m || undefined} data-testid={`vent-mode-${m}`} onClick={() => setS({ ...s, mode: m })}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="vent-softs">{(['peep', 'pmax'] as Setting[]).map(key)}</div>
        <div className="vent-knobs">{(['fio2', 'vt', 'rr'] as Setting[]).map(key)}</div>
        <div className="vent-turn">
          <button type="button" className="tap io-mini" data-testid="vent-down" onClick={() => turn(-1)}>
            ◀ −
          </button>
          <span className="vent-readout">
            {RANGES[sel].label} {s[sel]} {RANGES[sel].unit}
          </span>
          <button type="button" className="tap io-mini" data-testid="vent-up" onClick={() => turn(1)}>
            + ▶
          </button>
        </div>
      </div>
      {!checked ? (
        <button type="button" className="tap io-next mt-2" data-testid="vent-start" onClick={start}>
          START ▶
        </button>
      ) : (
        <div className="vent-check" data-testid="vent-check">
          <p className="vent-check-head" data-ok={allOk || undefined}>
            {allOk ? '✓ All settings in range. Ventilating.' : `✗ ${rows.filter((r) => !r.ok).length} setting${rows.filter((r) => !r.ok).length === 1 ? '' : 's'} out of range.`}
          </p>
          <table>
            <thead>
              <tr>
                <th />
                <th>Set</th>
                <th>Acceptable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} data-ok={r.ok || undefined} data-testid={`vent-check-${r.key}`}>
                  <td>{r.ok ? '✓' : '✗'} {r.label}</td>
                  <td>{r.value}</td>
                  <td>
                    {r.range}
                    <small>{r.why}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="vent-check-note">
            ETCO2 {score.etco2.toFixed(1)} kPa · {spec.co2}.
            {first.current && JSON.stringify(first.current.settings) !== JSON.stringify(s) ? ' Scored on your first START.' : ''}
          </p>
          <div className="vent-check-btns">
            {!allOk && (
              <button type="button" className="tap io-mini" data-testid="vent-adjust" onClick={() => setChecked(false)}>
                ◀ Adjust
              </button>
            )}
            <button type="button" className="tap io-next" data-testid="vent-done" onClick={finish}>
              Continue ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
