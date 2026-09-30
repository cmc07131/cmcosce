import { useRef, useState } from 'react'
import type { BenchResult, PerformJob } from '../store'
import { sfx } from '../sfx'
import { NIV_MARKS, NIV_RANGES, checkNiv, nivDefaults, nudgeNiv, type Mask, type NivKey, type NivSettings } from './nivModel'

const MASKS: { id: Mask; label: string }[] = [
  { id: 'full-face', label: 'Full face mask' },
  { id: 'nasal', label: 'Nasal mask' },
  { id: 'non-rebreather', label: 'Non-rebreather' },
]

/** Set up NIV yourself: pick the mask, set IPAP, EPAP, backup rate and oxygen, START, then the check. */
export function Niv({ job, onDone }: { job: PerformJob; onDone: (r: BenchResult) => void }) {
  const [s, setS] = useState<NivSettings>(nivDefaults)
  const [sel, setSel] = useState<NivKey>('ipap')
  const [checked, setChecked] = useState(false)
  const first = useRef<NivSettings | null>(null)
  const done = useRef(false)
  const rows = checkNiv(s)
  const allOk = rows.every((r) => r.ok)

  function start() {
    sfx.select()
    if (!first.current) first.current = s
    setChecked(true)
  }

  function finish() {
    if (done.current || !first.current) return
    done.current = true
    const scored = checkNiv(first.current)
    const marks = scored.filter((r) => r.ok).map((r) => job.grantMarks[NIV_MARKS.indexOf(r.key)]).filter((m): m is string => Boolean(m))
    const f = first.current
    onDone({
      marks,
      faults: scored.filter((r) => !r.ok).map((r) => ({ text: `${r.label}: ${r.value}. ${r.why} Aim for ${r.range}.` })),
      summary: `NIV: ${f.mask ?? 'no mask'}, IPAP ${f.ipap}, EPAP ${f.epap}, backup ${f.rate}, O2 ${f.fio2}%.${JSON.stringify(f) !== JSON.stringify(s) ? ` Corrected after the check to IPAP ${s.ipap}, EPAP ${s.epap}, backup ${s.rate}, O2 ${s.fio2}%.` : ''}`,
      scene: ['niv'],
    })
  }

  const key = (k: NivKey) => (
    <button key={k} type="button" className="vent-soft" data-on={sel === k || undefined} data-testid={`niv-${k}`} onClick={() => setSel(k)}>
      <b>{NIV_RANGES[k].label}</b>
      <span>{s[k]}</span>
    </button>
  )

  return (
    <div className="vent" data-testid="niv">
      <p className="io-lede">Mask:</p>
      <div className="vent-modes" style={{ flexDirection: 'row', marginBottom: 6 }}>
        {MASKS.map((m) => (
          <button key={m.id} type="button" className="vent-mode" data-on={s.mask === m.id || undefined} data-testid={`niv-mask-${m.id}`} onClick={() => setS({ ...s, mask: m.id })}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="vent-body">
        <div className="vent-knobs" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {(['ipap', 'epap', 'rate', 'fio2'] as NivKey[]).map(key)}
        </div>
        <div className="vent-turn">
          <button type="button" className="tap io-mini" data-testid="niv-down" onClick={() => setS(nudgeNiv(s, sel, -1))}>
            ◀ −
          </button>
          <span className="vent-readout">
            {NIV_RANGES[sel].label} {s[sel]} {NIV_RANGES[sel].unit}
          </span>
          <button type="button" className="tap io-mini" data-testid="niv-up" onClick={() => setS(nudgeNiv(s, sel, 1))}>
            + ▶
          </button>
        </div>
      </div>
      {!checked ? (
        <button type="button" className="tap io-next mt-2" data-testid="niv-start" onClick={start}>
          START ▶
        </button>
      ) : (
        <div className="vent-check" data-testid="niv-check">
          <p className="vent-check-head" data-ok={allOk || undefined}>
            {allOk ? '✓ All settings in range.' : `✗ ${rows.filter((r) => !r.ok).length} setting${rows.filter((r) => !r.ok).length === 1 ? '' : 's'} out of range.`}
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
            {!allOk && (
              <button type="button" className="tap io-mini" data-testid="niv-adjust" onClick={() => setChecked(false)}>
                ◀ Adjust
              </button>
            )}
            <button type="button" className="tap io-next" data-testid="niv-done" onClick={finish}>
              Continue ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
