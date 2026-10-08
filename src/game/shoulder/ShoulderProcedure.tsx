import { useEffect, useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, TouchPad, benchMarks, type Pt } from '../bench/kit'
import { usePlay, type BenchResult, type PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { ARM, ShoulderView, erFromX, handAt } from './art'
import { CHECK_MARKS, REDUCE_MARKS, abduct, checkRows, freshShoulder, reduceRows, rotate, type Check, type ShoulderRun } from './model'

type Stage = BenchApi<ShoulderRun> & { next: () => void; sedated: boolean }

/**
 * Anterior shoulder dislocation. `pose: "check"`: the neurovascular examination before sedation.
 * Otherwise: check the depth of sedation, keep the sedationist on the airway, then reduce by slow external rotation;
 * hurry and the muscles lock. Then the nerves again, sling, X-ray and recovery.
 */
export function ShoulderProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const checkOnly = job.pose === 'check'
  const titles = checkOnly ? ['Look and check'] : ['Sedation', 'Reduce', 'After']
  const api = useBench(freshShoulder, coach)
  const scene = usePlay((s) => s.scene)
  const sedated = (scene ?? []).includes('sedated')
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  const next = () => {
    sfx.select()
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  const rows = checkOnly ? checkRows(api.run) : reduceRows(api.run, sedated)
  function finish() {
    if (done.current) return
    done.current = true
    const { marks, faults } = benchMarks(rows, (checkOnly ? CHECK_MARKS : REDUCE_MARKS) as readonly string[], job.grantMarks)
    const r = api.runRef.current
    onDone({
      marks,
      faults,
      summary: checkOnly ? 'Neurovascular check before reduction.' : `Shoulder ${r.reduced ? 'reduced' : 'not reduced'} by ${r.levered ? 'leverage' : 'external rotation'}; ${r.locks} spasm lock${r.locks === 1 ? '' : 's'}.`,
      scene: checkOnly ? undefined : r.observed ? [job.scene || 'awake', ...(r.reduced ? ['reduced'] : [])] : ['still-sedated'],
    })
  }
  const stage: Stage = { ...api, next, sedated }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="shoulder-bench">
      <div className="hare-bar">
        <span>MR LUI · L SHOULDER</span>
        <span />
        <span>{checkOnly ? 'AWAKE' : sedated ? 'SEDATED' : 'NOT SEDATED'}</span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={rows} onContinue={finish} testId="shoulder-check" />
        ) : checkOnly ? (
          <NervePanel {...stage} mode="before" />
        ) : (
          <>
            {index === 0 && <SedationStage {...stage} />}
            {index === 1 && <ReduceStage {...stage} />}
            {index === 2 && <NervePanel {...stage} mode="after" />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ================================================================ nerves, before and after */

function NervePanel({ run, runRef, upd, feel, next, mode }: Stage & { mode: 'before' | 'after' }) {
  const svg = useRef<SVGSVGElement>(null)
  const field = mode
  const record = (c: Check, line: string) => {
    upd((r) => ({ [field]: r[field].includes(c) ? r[field] : [...r[field], c] }) as Partial<ShoulderRun>)
    feel(line)
  }
  const r = run
  function tap(p: Pt) {
    const hand = handAt(runRef.current.er)
    if (Math.hypot(p.x - ARM.badge.x, p.y - ARM.badge.y) <= ARM.badge.r) return record('badge', 'Over the regimental badge area: he feels it the same as the other side.')
    if (Math.hypot(p.x - hand.x, p.y - hand.y) <= 12) return record('pulse', 'Radial pulse strong; refill under 2 seconds.')
    if (p.x > 128 && p.y < 80) {
      upd({ sawShape: true })
      return feel(runRef.current.reduced ? 'The deltoid is round again, the hollow under the acromion gone.' : 'Squared off: a hollow under the acromion, and the humeral head bulging in front below the clavicle.')
    }
    feel('Touch the badge area on the outer upper arm, feel his radial pulse, look at the shoulder.')
  }
  return (
    <>
      <p className="io-lede">{mode === 'before' ? 'Look at the shoulder, then the nerves and the pulse, before anyone touches it.' : 'Compare with before: badge, the hand, the pulse. Then sling, film and recovery.'}</p>
      <TouchPad svg={svg} aspect="220 / 200" className="mx-auto max-w-[280px]" testId="shoulder-nerves" onDown={tap}>
        <ShoulderView svgRef={svg} er={r.er} reduced={r.reduced} />
      </TouchPad>
      <p className="io-small">
        {(['badge', 'wrist', 'fingers', 'pulse'] as Check[]).map((c) => `${c} ${r[field].includes(c) ? '✓' : '–'}`).join(' · ')}
      </p>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-testid="shoulder-wrist" onClick={() => record('wrist', 'He cocks his wrist back against your hand: radial nerve fine.')}>
          “BEND YOUR WRIST BACK”
        </button>
        <button type="button" className="tap io-mini" data-testid="shoulder-fingers" onClick={() => record('fingers', 'A firm fist, then he spreads his fingers against resistance: median and ulnar fine.')}>
          “MAKE A FIST, THEN SPREAD YOUR FINGERS”
        </button>
        {mode === 'after' && (
          <>
            <button type="button" className="tap io-mini" data-on={r.sling || undefined} data-testid="shoulder-sling" onClick={() => (upd({ sling: true }), feel('Arm across his chest in a broad arm sling.'))}>
              {r.sling ? 'SLING ✓' : 'SLING'}
            </button>
            <button type="button" className="tap io-mini" data-on={r.xray || undefined} data-testid="shoulder-xray" onClick={() => (upd({ xray: true }), feel(r.reduced ? 'Post-reduction film: the humeral head back in the glenoid; a small Hill–Sachs dent, no fracture.' : 'The film: still dislocated.'))}>
              {r.xray ? 'X-RAY ✓' : 'POST-REDUCTION X-RAY'}
            </button>
            <button type="button" className="tap io-mini" data-on={r.observed || undefined} data-testid="shoulder-observe" onClick={() => (upd({ observed: true }), feel('Monitored with capnography until he is awake, talking, and meets the discharge criteria.'))}>
              {r.observed ? 'OBSERVED ✓' : 'OBSERVE UNTIL AWAKE'}
            </button>
          </>
        )}
      </div>
      <NextButton onClick={next} testId="shoulder-next">
        Finish
      </NextButton>
    </>
  )
}

/* ================================================================ sedation */

function SedationStage({ run, upd, feel, physical, why, next, sedated }: Stage) {
  const ask = (a: 'name' | 'tap', line: string, awake: string) => (
    <button
      type="button"
      className="tap io-mini"
      data-testid={`shoulder-${a}`}
      onClick={() => {
        upd((r) => ({ depthChecked: r.depthChecked.includes(a) ? r.depthChecked : [...r.depthChecked, a] }))
        sedated ? feel(line) : physical(awake)
      }}
    >
      {a === 'name' ? '“MR LUI!” (CALL HIS NAME)' : 'FIRM TAP BETWEEN THE EYEBROWS'}
    </button>
  )
  return (
    <>
      <p className="io-lede">Before you pull: is he deep enough, and is someone watching his airway?</p>
      <div className="io-choices">
        {ask('name', 'His eyes open slowly at his name, then drift shut. Drowsy, rousable.', 'He is wide awake, holding his arm tight against his chest.')}
        {ask('tap', 'A sluggish blink to a firm tap: deep enough to relax.', 'He flinches and asks what you are doing.')}
      </div>
      <div className="sayit mt-2" data-testid="shoulder-sedationist">
        <p className="sayit-prompt">SAY IT · TO DR KWAN</p>
        {[
          { ok: true, text: 'Dr Kwan, eyes on his airway and the capnography the whole time. Tell me if anything changes.' },
        ].map((l) => (
          <button
            key={l.text}
            type="button"
            className="sayit-opt"
            data-chosen={run.sedationistOnAirway === l.ok || undefined}
            onClick={() => {
              upd({ sedationistOnAirway: l.ok })
              if (l.ok) feel('Dr Kwan stays at the head, hand on the jaw, watching the capnography.')
              else {
                buzz([60, 40, 60])
                physical('Dr Kwan leaves the head of the bed. Nobody is watching his breathing.')
                why('The sedationist never leaves the airway. Get another pair of hands or use a technique that needs only yours.')
              }
            }}
          >
            “{l.text}”
          </button>
        ))}
      </div>
      <NextButton onClick={next} testId="shoulder-next">
        Reduce
      </NextButton>
    </>
  )
}

/* ================================================================ reduce */

function ReduceStage({ run, runRef, upd, feel, physical, why, coach, next, sedated }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const last = useRef<number>(0)
  const said = useRef<Set<string>>(new Set())
  const once = (k: string, f: () => void) => {
    if (said.current.has(k)) return
    said.current.add(k)
    f()
  }
  // Spasm settles while you pause.
  useEffect(() => {
    const id = window.setInterval(() => {
      const cur = runRef.current
      if (cur.reduced || (cur.spasm <= 0 && cur.lockedFor <= 0)) return
      const { patch, event } = rotate(cur, cur.er, 0.2, sedated)
      upd(patch)
      if (event === 'clunk') {
        buzz(80)
        feel('As the spasm eases, a soft clunk under your hand. The shoulder is round again.')
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [sedated])
  function move(p: Pt) {
    const now = performance.now()
    const dt = last.current ? (now - last.current) / 1000 : 0.05
    last.current = now
    const cur = runRef.current
    if (cur.reduced) return
    const { patch, event } = rotate(cur, erFromX(p.x), dt, sedated)
    upd(patch)
    if (event === 'lock') {
      buzz([40, 30, 40])
      said.current.delete('relax')
      physical(sedated ? 'He groans and the arm locks: the muscles are in spasm. Pause and let them relax.' : 'He cries out and locks the arm against you.')
      if (coach) why('Slowly: a few degrees at a time, pausing whenever he tenses. It can take minutes.')
    } else if (event === 'clunk') {
      buzz(80)
      sfx.select()
      feel('A soft clunk under your hand. The shoulder is round again and the arm moves freely.')
    } else if (event === 'move' && cur.lockedFor <= 0 && runRef.current.spasm < 0.2 && cur.er > 20) once('relax', () => feel('The arm keeps rotating out as the muscles give.'))
  }
  const r = run
  return (
    <>
      <p className="io-lede">Elbow at his side, bent to 90°. Drag his hand slowly outward to rotate the arm externally. Pause when he tenses.</p>
      <TouchPad
        svg={svg}
        aspect="220 / 200"
        className="mx-auto max-w-[300px]"
        testId="shoulder-reduce"
        onDown={() => (last.current = performance.now())}
        onMove={move}
        onUp={() => (last.current = 0)}
      >
        <ShoulderView svgRef={svg} er={r.er} reduced={r.reduced} tension={r.spasm} locked={r.lockedFor > 0} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="shoulder-abduct"
          onClick={() => {
            const before = runRef.current
            const after = upd(abduct(before, sedated))
            if (after.reduced && !before.reduced) feel('Holding the rotation you bring the arm slowly up and out. Clunk: it is in.')
            else feel(before.er < 70 ? 'Rotate it fully out first, then abduct slowly.' : 'It will not go yet. Let the spasm settle.')
          }}
        >
          ABDUCT SLOWLY, HOLDING THE ROTATION
        </button>
      </div>
      <NextButton onClick={next} testId="shoulder-next">
        After
      </NextButton>
    </>
  )
}
