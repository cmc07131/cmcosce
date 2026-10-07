import { useRef, useState, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, TouchPad, benchMarks, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { C, ENTRY, HOOK_MARKS, R, SURFACE_Y, advance, angleOf, backOut, checkHook, freshHook, onArc, type HookRun } from './model'

const TITLES = ['Assess', 'Prepare', 'Advance', 'Cut', 'Back out', 'Aftercare']
const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<HookRun> & { next: () => void }

/**
 * Advance-and-cut on the model thumb, teaching as you go: look at the hook, ask about the water, tetanus and
 * allergies, block the thumb, glasses on; grip the shank and push the point round its own curve until it tents the
 * skin and pops out; cut the barb; back the hook out the way it went in; check it is whole and dress the wound.
 */
export function HookProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshHook, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  const next = () => {
    sfx.select()
    if (index < TITLES.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const { marks, faults } = benchMarks(checkHook(r), HOOK_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: r.removed ? (r.tore ? 'The hook came out barbed, tearing the pulp.' : 'Hook advanced, barb cut, backed out cleanly.') : 'The hook is still in.' })
  }
  const stage: Stage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="hook-bench">
      <div className="hare-bar">
        <span>MODEL THUMB · STUDENT WATCHING</span>
        <span />
        <span>{api.run.removed ? 'OUT' : 'IN'}</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkHook(api.run)} onContinue={finish} testId="hook-check" />
        ) : (
          <>
            {index === 0 && <AssessStage {...stage} />}
            {index === 1 && <PrepareStage {...stage} />}
            {index >= 2 && index <= 4 && <WorkStage {...stage} stage={index} />}
            {index === 5 && <AfterStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

function Thumb({ run, svgRef }: { run: HookRun; svgRef?: Ref<SVGSVGElement> }) {
  // The hook: a straight shank from the eye to the entry wound, then the bend round to the point.
  const shankOut = { x: ENTRY.x - 24, y: SURFACE_Y + 30 }
  const backed = run.removed
  const arc: string[] = []
  const outside: string[] = []
  for (let d = 180; d >= run.point - 0.01; d -= 2.5) {
    const p = onArc(Math.max(d, run.point))
    arc.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    if (d <= 0) outside.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
  const tip = onArc(run.point)
  const tent = !run.popped && run.point < 18 ? (18 - run.point) / 3 : 0
  const exit = onArc(0)
  return (
    <svg ref={svgRef} viewBox="0 0 220 140" className="block h-full w-full select-none" data-testid="hook-thumb">
      <rect width="220" height="140" fill="#eef2f4" />
      {/* the thumb from the side, pulp down */}
      <path d={`M0 30 L170 30 Q214 34 212 70 Q206 ${SURFACE_Y} 170 ${SURFACE_Y} L${exit.x + 8} ${SURFACE_Y} Q${exit.x} ${SURFACE_Y + tent} ${exit.x - 8} ${SURFACE_Y} L0 ${SURFACE_Y} Z`} fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      <rect x="150" y="26" width="46" height="10" rx="3" fill="#f0c8c0" stroke={SKIN_EDGE} />
      {run.popped && <circle cx={exit.x} cy={SURFACE_Y} r="2.5" fill="#a02020" />}
      <circle cx={ENTRY.x} cy={SURFACE_Y} r="2.5" fill="#a02020" />
      {!backed && (
        <g fill="none" stroke="#9aa4b0" strokeWidth="2.6" strokeLinecap="round">
          <line x1={shankOut.x} y1={shankOut.y} x2={ENTRY.x} y2={ENTRY.y} />
          <polyline points={arc.join(' ')} opacity="0.45" strokeDasharray="3 2" />
          {outside.length > 1 && <polyline points={[`${onArc(0).x},${onArc(0).y}`, ...outside].join(' ')} />}
          {!run.barbCut && <path d={`M${tip.x} ${tip.y} l-6 -3`} />}
          <circle cx={shankOut.x - 3} cy={shankOut.y + 3} r="3" />
        </g>
      )}
      {run.gripped && !backed && <rect x={shankOut.x + 4} y={shankOut.y - 16} width="10" height="22" rx="2" fill="#606878" transform={`rotate(-40 ${shankOut.x + 9} ${shankOut.y - 5})`} />}
      {/* the buried part, faint, so you can see the curve under the skin */}
      {!backed && <circle cx={C.x} cy={C.y} r={R} fill="none" stroke="#9aa4b0" strokeDasharray="2 4" opacity="0.35" />}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">L THUMB · SIDE · PULP DOWN</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function AssessStage({ run, upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const btn = (key: 'water' | 'tetanus' | 'allergy', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`hook-${key}`} onClick={() => (upd({ [key]: true } as Partial<HookRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Look at the hook with the student. Then ask what you need to know.</p>
      <TouchPad svg={svg} aspect="220 / 140" testId="hook-assess" onDown={() => (upd({ looked: true }), feel('One barb, about 5 mm deep in the pulp, its point just under the skin. Well away from the joint and the tendon sheath.'))}>
        <Thumb run={run} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        {btn('water', '“SALT OR FRESH WATER?”', '"Sea fishing off the pier."')}
        {btn('tetanus', '“TETANUS JAB?”', '"Five years ago."')}
        {btn('allergy', '“ANY ALLERGIES?”', '"None."')}
      </div>
      <NextButton onClick={next} testId="hook-next">
        Prepare
      </NextButton>
    </>
  )
}

function PrepareStage({ run, upd, feel, physical, why, next }: Stage) {
  return (
    <>
      <p className="io-lede">Get ready before you touch it.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.blocked || undefined} data-testid="hook-block" onClick={() => (upd({ blocked: true }), feel('Cleaned, and a digital block at the base of the thumb. Five minutes later the pulp is numb.'))}>
          {run.blocked ? 'BLOCKED ✓' : 'CLEAN AND DIGITAL BLOCK'}
        </button>
        <button type="button" className="tap io-mini" data-on={run.eyes || undefined} data-testid="hook-eyes" onClick={() => (upd({ eyes: true }), feel('Glasses on: you, the student, and the patient.'))}>
          {run.eyes ? 'EYE PROTECTION ✓' : 'EYE PROTECTION FOR EVERYONE'}
        </button>
      </div>
      <NextButton onClick={next} testId="hook-next">
        Advance
      </NextButton>
    </>
  )
}

function WorkStage({ run, runRef, upd, feel, physical, why, next, stage }: Stage & { stage: number }) {
  const svg = useRef<SVGSVGElement>(null)
  const backing = useRef<number | null>(null)
  const lede: Record<number, string> = {
    2: 'Grip the shank with the needle holder. Drag the point on round the curve of the hook until it comes through the skin.',
    3: 'Tap the barb, now outside the skin, to cut it off with the wire cutters.',
    4: 'Drag the hook back out the way it went in.',
  }
  function down(p: Pt) {
    const cur = runRef.current
    if (cur.removed) return
    if (stage === 2 && !cur.gripped) {
      if (Math.hypot(p.x - (ENTRY.x - 14), p.y - (SURFACE_Y + 18)) < 22) {
        upd({ gripped: true })
        return feel('Needle holder clamped on the shank.')
      }
      return feel('Grip the shank, where it comes out of the skin.')
    }
    if (stage === 3) {
      const tip = onArc(cur.point)
      if (!cur.popped) return feel('The barb is still under the skin. Advance it first.')
      if (Math.hypot(p.x - tip.x, p.y - tip.y) < 10) {
        if (!cur.eyes) physical('The cut barb flies off past the student\'s eye.')
        upd({ barbCut: true })
        sfx.select()
        return feel('Snip: the barb is off. What is left is a smooth curve.')
      }
      upd({ cutWrong: true })
      return why('Cut the barb itself, where it sits outside the skin.')
    }
    if (stage === 4) backing.current = p.x
  }
  function move(p: Pt) {
    const cur = runRef.current
    if (stage === 2) {
      const a = angleOf(p)
      const { patch, event } = advance(cur, a.deg, a.off)
      if (!Object.keys(patch).length) return
      upd(patch)
      if (event === 'off') physical('You are pushing off the curve: the point drags sideways through the tissue.')
      else if (event === 'pop') {
        buzz(40)
        feel('The skin tents… and the point pops out, barb and all.')
      } else if (runRef.current.point < 18 && !runRef.current.popped) feel('The point tents the skin from inside.')
    }
  }
  function up(p: Pt | null) {
    if (stage !== 4 || backing.current === null || !p) return
    const moved = backing.current - p.x
    backing.current = null
    if (moved < 10) return
    const cur = runRef.current
    if (cur.removed) return
    upd(backOut(cur))
    if (cur.barbCut) feel('It backs out smoothly along its own track.')
    else {
      buzz([60, 40, 60])
      physical('The barb catches on the way back and tears the pulp.')
      why('Cut the barb before you back it out.')
    }
  }
  return (
    <>
      <p className="io-lede">{lede[stage]}</p>
      <TouchPad svg={svg} aspect="220 / 140" testId="hook-work" onDown={down} onMove={move} onUp={up}>
        <Thumb run={run} svgRef={svg} />
      </TouchPad>
      <NextButton onClick={next} testId="hook-next">
        {TITLES[stage + 1]}
      </NextButton>
    </>
  )
}

function AfterStage({ run, upd, feel, next }: Stage) {
  return (
    <>
      <p className="io-lede">Show the student the hook, then the wound.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.inspected || undefined} data-testid="hook-inspect" onClick={() => (upd({ inspected: true }), feel(run.removed ? 'The hook and the cut barb on the tray: all of it.' : 'The hook is still in the thumb.'))}>
          {run.inspected ? 'COMPLETE ✓' : 'CHECK THE HOOK IS COMPLETE'}
        </button>
        <button type="button" className="tap io-mini" data-on={run.dressed || undefined} data-testid="hook-dress" onClick={() => (upd({ dressed: true }), feel('Both wounds irrigated with saline and dressed. Tetanus up to date; no routine antibiotics for a clean wound.'))}>
          {run.dressed ? 'DRESSED ✓' : 'IRRIGATE AND DRESS'}
        </button>
      </div>
      <NextButton onClick={next} testId="hook-next">
        Finish
      </NextButton>
    </>
  )
}
