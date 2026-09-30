import { useEffect, useRef, useState } from 'react'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { DEFIB_MARKS, ENERGIES, SITES, checkDefib, defibSpec, freshDefib, padSites, scoreDefib, shock, type DefibRun, type Pt } from './model'

/**
 * A manual defibrillator, used by hand: tap the chest to place both pads, set SYNC and the energy, charge, call
 * "all clear, oxygen away", then shock. In SYNC it fires on the next R wave (markers show where); in VF with SYNC on
 * it never fires. After the shock, a check shows each setting against its acceptable range.
 */
export function Defib({ job, onDone }: { job: PerformJob; onDone: (r: BenchResult) => void }) {
  const spec = defibSpec(job.pose)
  const [run, setRun] = useState<DefibRun>(freshDefib)
  const runRef = useRef(run)
  const upd = (patch: Partial<DefibRun>) => {
    runRef.current = { ...runRef.current, ...patch }
    setRun(runRef.current)
  }
  const [t, setT] = useState(0)
  const [note, setNote] = useState<string>('Tap the chest to place both pads.')
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  const chest = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 0.05), 50)
    return () => window.clearInterval(id)
  }, [])

  const rhythm = run.converted ? 'sinus' : spec.rhythm
  const trace = strip(rhythm, t, run.sync && rhythm !== 'vf')

  function place(e: React.PointerEvent<SVGSVGElement>) {
    if (run.shocked) return
    const m = chest.current?.getScreenCTM()
    if (!m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const at: Pt = { x: p.x, y: p.y }
    const cur = runRef.current.pads
    // Tap a pad again to lift it off.
    const hit = cur.findIndex((q) => Math.hypot(q.x - at.x, q.y - at.y) < 16)
    if (hit >= 0) {
      upd({ pads: cur.filter((_, i) => i !== hit) })
      return
    }
    if (cur.length >= 2) return setNote('Both pads are on. Tap one to move it.')
    sfx.cursor()
    upd({ pads: [...cur, at] })
    setNote(cur.length === 0 ? 'One pad on. Now the second.' : 'Both pads on. Set SYNC and the energy, then charge.')
  }

  function fire() {
    const { patch, event } = shock(runRef.current, spec)
    upd(patch)
    if (event === 'no-charge') return setNote('Not charged. Press CHARGE first.')
    if (event === 'no-pads') return setNote('Both pads must be on the chest.')
    if (event === 'waits') {
      buzz(20)
      return setNote('Charged… the machine is waiting for an R wave to sync on. In VF there is none: it will not fire.')
    }
    buzz([60, 30, 60])
    sfx.bump()
    const r = runRef.current
    setNote(r.converted ? 'The body jerks. The rhythm changes: sinus rhythm with a pulse.' : spec.refractory ? 'The body jerks. Still VF. Resume CPR at once: no pulse check.' : 'The body jerks. The rhythm has not changed.')
    window.setTimeout(() => setChecked(true), 900)
  }

  function finish() {
    if (done.current) return
    done.current = true
    const r = runRef.current
    const s = scoreDefib(r, spec)
    const marks = s.earned.map((k) => job.grantMarks[DEFIB_MARKS.indexOf(k)]).filter((m): m is string => Boolean(m))
    onDone({
      marks,
      faults: s.faults,
      summary: `Defibrillator (${spec.label}): pads ${padSites(r.pads).ok ? 'antero-lateral' : 'misplaced'}, SYNC ${r.sync ? 'on' : 'off'}, ${r.energy} J. ${r.converted ? 'Converted.' : 'No change in rhythm.'}`,
      // Only a shock that works changes the patient.
      // A refractory rhythm (the first shock in VF) still counts as a shock given.
      scene: r.converted || (spec.refractory && r.shocked) ? [job.scene || 'shocked'] : ['shock-ineffective'],
    })
  }

  const rows = checkDefib(run, spec)
  const allOk = rows.every((r) => r.ok)
  const energyIndex = ENERGIES.indexOf(run.energy)

  return (
    <div className="defib" data-testid="defib">
      <div className="defib-body">
        <svg viewBox="0 0 220 70" className="defib-screen">
          <rect width="220" height="70" fill="#081008" />
          <polyline points={trace.points} fill="none" stroke="#58f878" strokeWidth="1.4" />
          {trace.marks.map((x) => (
            <path key={x} d={`M${x} 10 l-3 -5 h6 z`} fill="#f8f8f8" />
          ))}
          <text x="4" y="66" fontSize="6" fill="#58f878" fontFamily="Press Start 2P, monospace">
            {rhythm === 'sinus' ? 'SINUS 84' : rhythm === 'vf' ? 'VF' : rhythm === 'vt' ? 'VT 180' : 'AF 160'}
          </text>
          <text x="120" y="66" fontSize="6" fill={run.charged ? '#f8d030' : '#9ad8ff'} fontFamily="Press Start 2P, monospace">
            {run.charged ? `CHARGED ${run.energy} J` : `${run.energy} J`} {run.sync ? '· SYNC' : ''}
          </text>
        </svg>
        <div className="defib-row">
          <button type="button" className="defib-btn" data-testid="defib-energy-down" onClick={() => upd({ energy: ENERGIES[Math.max(0, energyIndex - 1)], charged: false })}>
            ◀
          </button>
          <span className="defib-energy" data-testid="defib-energy">
            {run.energy} J
          </span>
          <button type="button" className="defib-btn" data-testid="defib-energy-up" onClick={() => upd({ energy: ENERGIES[Math.min(ENERGIES.length - 1, energyIndex + 1)], charged: false })}>
            ▶
          </button>
          <button type="button" className="defib-btn" data-on={run.sync || undefined} data-testid="defib-sync" onClick={() => upd({ sync: !run.sync })}>
            SYNC
          </button>
        </div>
        <div className="defib-row">
          <button type="button" className="defib-btn defib-charge" data-testid="defib-charge" disabled={run.shocked} onClick={() => { sfx.select(); upd({ charged: true, clearCalled: false }); setNote(`Charging to ${run.energy} J… charged. Say it before you shock.`) }}>
            CHARGE
          </button>
          <button type="button" className="defib-btn" data-testid="defib-clear" disabled={!run.charged} onClick={() => { upd({ clearCalled: true }); setNote('"All clear, oxygen away!" Everyone steps back.') }}>
            ALL CLEAR
          </button>
          <button type="button" className="defib-btn defib-shock" data-testid="defib-shock" disabled={run.shocked} onClick={fire}>
            ⚡ SHOCK
          </button>
        </div>
      </div>
      <svg ref={chest} viewBox="0 0 200 200" className="defib-chest" data-testid="defib-chest" onPointerDown={place}>
        <rect width="200" height="200" fill="#f4e8e0" />
        <path d="M30 200 L30 60 Q40 30 70 26 L130 26 Q160 30 170 60 L170 200 Z" fill="#e8b494" stroke="#8a5238" />
        <path d="M48 44 Q75 50 98 44 M102 44 Q125 50 152 44" stroke="#c89078" strokeWidth="2" fill="none" />
        <path d="M100 44 L100 130" stroke="#c89078" strokeWidth="1.5" />
        <circle cx="72" cy="104" r="3" fill="#c07058" />
        <circle cx="128" cy="104" r="3" fill="#c07058" />
        <text x="4" y="196" fontSize="6" fill="#40404c" fontFamily="Press Start 2P, monospace">
          PATIENT'S RIGHT ◀ ▶ LEFT
        </text>
        {run.pads.map((p, i) => (
          <g key={i}>
            <rect x={p.x - 13} y={p.y - 17} width="26" height="34" rx="4" fill="#f8f8f4" stroke="#303848" strokeWidth="2" />
            <path d={`M${p.x - 6} ${p.y} h12 M${p.x} ${p.y - 6} v12`} stroke="#b83838" strokeWidth="2" />
          </g>
        ))}
      </svg>
      <p className="io-note" data-tone="feel" data-testid="defib-note">
        {note}
      </p>
      {checked && (
        <div className="vent-check" data-testid="defib-check">
          <p className="vent-check-head" data-ok={allOk || undefined}>
            {allOk ? '✓ Everything right.' : `✗ ${rows.filter((r) => !r.ok).length} to review.`}
          </p>
          <table>
            <thead>
              <tr>
                <th />
                <th>You</th>
                <th>Acceptable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} data-ok={r.ok || undefined}>
                  <td>
                    {r.ok ? '✓' : '✗'} {r.label}
                  </td>
                  <td>{r.value}</td>
                  <td>
                    {r.range}
                    <small>{r.why}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="vent-check-btns">
            <button type="button" className="tap io-next" data-testid="defib-done" onClick={finish}>
              Continue ▶
            </button>
          </div>
        </div>
      )}
      <p className="io-small mt-1">
        Sites: {SITES.sternal.name} and {SITES.apical.name}.
      </p>
    </div>
  )
}

/** The rhythm on the defibrillator screen, and where the SYNC markers sit (on each R wave). */
function strip(rhythm: 'af' | 'vt' | 'vf' | 'sinus', t: number, sync: boolean) {
  const pts: string[] = []
  const marks: number[] = []
  const beat = rhythm === 'vt' ? 0.33 : rhythm === 'af' ? 0.37 : 0.71
  for (let i = 0; i < 220; i++) {
    const time = t + i / 60
    let y = 34
    if (rhythm === 'vf') y = 34 + Math.sin(time * 23) * 9 + Math.sin(time * 37 + 1) * 6
    else {
      // AF: irregular intervals and a wavy baseline; VT: broad complexes; sinus: P, QRS, T.
      const jitter = rhythm === 'af' ? Math.sin(Math.floor(time / beat) * 12.9) * 0.12 : 0
      const len = beat * (1 + jitter)
      const ph = (time % len) / len
      const wide = rhythm === 'vt'
      if (rhythm === 'af') y += Math.sin(time * 40) * 1.2
      if (rhythm === 'sinus' && ph > 0.1 && ph < 0.18) y -= 3
      if (ph > 0.3 && ph < (wide ? 0.55 : 0.36)) y -= wide ? 20 * Math.sin(((ph - 0.3) / 0.25) * Math.PI) : 22
      if (!wide && ph >= 0.36 && ph < 0.4) y += 6
      if (ph > 0.55 && ph < 0.72) y -= wide ? -6 : 4
      if (sync && ph > 0.3 && ph < 0.3 + 1 / (60 * len)) marks.push(i)
    }
    pts.push(`${i},${y.toFixed(1)}`)
  }
  return { points: pts.join(' '), marks }
}
