import { useRef, useState, type ReactNode, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, RubTint, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { A, B1, B2, EDGE_SEGMENTS, FOREIGN, SUTURE_MARKS, TAG, checkSuture, edgeSegment, freshSuture, inFlap, judgeCorner, judgeStitch, toEdge, type CornerKind, type Stitch, type SutureRun } from './model'

const TITLES = ['Assess', 'Anaesthetise', 'Irrigate', 'Explore', 'Corner', 'Sutures', 'Finish']
const SKIN = '#e0a888'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<SutureRun> & { next: () => void; corner: Pt[]; setCorner: (p: Pt[]) => void; lines: [Pt, Pt][]; setLines: (l: [Pt, Pt][]) => void }

/**
 * A flap laceration repaired by hand: look at the flap and the foot, infiltrate through the edges, test, irrigate,
 * lift the flap and find what is under it, trim only what is dead, anchor the tip with a corner stitch, then place
 * each interrupted stitch across the wound. Every bite is judged.
 */
export function SutureProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshSuture, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [corner, setCorner] = useState<Pt[]>([])
  const [lines, setLines] = useState<[Pt, Pt][]>([])
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
    const { marks, faults } = benchMarks(checkSuture(r), SUTURE_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: `Flap repaired: a ${r.corner === 'half-buried' ? 'corner stitch' : 'stitch'} at the tip and ${r.stitches.length} interrupted sutures, ${r.stitches.filter((s) => s.ok).length} well placed.` })
  }
  const stage: Stage = { ...api, next, corner, setCorner, lines, setLines }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="suture-bench">
      <div className="hare-bar">
        <span>MR CHAN · L SHIN FLAP</span>
        <span />
        <span>{api.run.stitches.length} STITCHES</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkSuture(api.run)} onContinue={finish} testId="suture-check" />
        ) : (
          <>
            {index === 0 && <AssessStage {...stage} />}
            {index === 1 && <LocalStage {...stage} />}
            {index === 2 && <IrrigateStage {...stage} />}
            {index === 3 && <ExploreStage {...stage} />}
            {index === 4 && <CornerStage {...stage} />}
            {index === 5 && <StitchStage {...stage} />}
            {index === 6 && <FinishStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- the wound */

function Wound({ run, svgRef, corner, lines, children }: { run: SutureRun; svgRef?: Ref<SVGSVGElement>; corner?: Pt[]; lines?: [Pt, Pt][]; children?: ReactNode }) {
  const dirt = Math.max(0, 1 - run.irrigatedMl / 100)
  const open = run.stitches.length < 8 ? 3 : 1
  return (
    <svg ref={svgRef} viewBox="56 20 108 100" className="block h-full w-full select-none" data-testid="suture-wound">
      <rect x="0" y="0" width="200" height="140" fill={SKIN} />
      <text x="59" y="26" fontFamily={FONT} fontSize="3.5" fill="#6a3a20">
        L SHIN · KNEE ←
      </text>
      {/* wound bed showing between the edges */}
      <path d={`M${A.x} ${A.y} L${B1.x} ${B1.y} L${B1.x + open} ${B1.y + open * 2} L${A.x - open * 2} ${A.y} L${B2.x + open} ${B2.y - open * 2} L${B2.x} ${B2.y} Z`} fill="#a02828" />
      {/* the flap, lifted when you look under it */}
      {run.lifted ? (
        <g>
          <path d={`M${A.x - 8} ${A.y} L${B1.x + 6} ${B1.y + 8} L${B2.x + 6} ${B2.y - 8} Z`} fill="#8a2020" />
          {!run.foreignOut && <rect x={FOREIGN.x - 3} y={FOREIGN.y - 2} width="6" height="4" fill="#a8b0b8" stroke="#505860" transform={`rotate(25 ${FOREIGN.x} ${FOREIGN.y})`} />}
          <path d={`M${B1.x} ${B1.y} L${B2.x} ${B2.y} L${B2.x - 22} ${B2.y - 10} L${B1.x - 22} ${B1.y + 10} Z`} fill={SKIN} stroke={SKIN_EDGE} />
        </g>
      ) : (
        <path d={`M${A.x - (run.tipTrimmed ? 10 : 2)} ${A.y} L${B1.x + 2} ${B1.y + 3} L${B2.x + 2} ${B2.y - 3} Z`} fill={SKIN} stroke={SKIN_EDGE} />
      )}
      <line x1={B1.x} y1={B1.y} x2={B2.x} y2={B2.y} stroke={SKIN_EDGE} strokeDasharray="2 3" opacity="0.6" />
      {!run.tagTrimmed && <path d={`M${TAG.x - 6} ${TAG.y - 3} l3 4 l3 -3 l3 4 l3 -3`} stroke="#303030" strokeWidth="2" fill="none" />}
      {dirt > 0 &&
        [
          [118, 58],
          [126, 76],
          [108, 82],
          [100, 50],
          [132, 64],
        ].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" fill="#5a4020" opacity={dirt} />)}
      {/* infiltrated edges blanch */}
      {run.edges.map((i) => {
        const arm = i < 6 ? 0 : 1
        const [a, b] = arm === 0 ? [A, B1] : [A, B2]
        const t = ((i % 6) + 0.5) / 6
        return <circle key={i} cx={a.x + (b.x - a.x) * t} cy={a.y + (b.y - a.y) * t} r="5" fill="#f4dcd0" opacity="0.5" />
      })}
      {/* corner stitch and interrupted stitches in blue nylon */}
      {corner && corner.length > 1 && <polyline points={corner.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2040c0" strokeWidth="1.4" strokeDasharray={run.corner === 'half-buried' ? '4 2' : undefined} />}
      {lines?.map(([p, q], i) => (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#2040c0" strokeWidth="1.1" />
          <circle cx={p.x} cy={p.y} r="1" fill="#2040c0" />
          <path d={`M${p.x} ${p.y} l-3 -2 M${p.x} ${p.y} l-3 2`} stroke="#2040c0" />
        </g>
      ))}
      {children}
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function AssessStage({ run, upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const btn = (key: 'distal' | 'history', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`suture-${key}`} onClick={() => (upd({ [key]: true } as Partial<SutureRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Look at the flap. Press its tip and watch the colour come back. Then the foot.</p>
      <TouchPad
        svg={svg}
        aspect="108 / 100"
        testId="suture-assess"
        onDown={(p) => {
          if (inFlap(p)) {
            upd({ flapLooked: true })
            return feel('The flap is pink. Pressed at the tip it blanches and refills briskly: alive.')
          }
          feel('A V-shaped flap, base toward the knee. Grit in the wound.')
        }}
      >
        <Wound run={run} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        {btn('distal', 'FOOT PULSES AND SENSATION', 'Dorsalis pedis and posterior tibial pulses present; sensation normal.')}
        {btn('history', '“DIABETES? CIRCULATION? STEROIDS?”', '"None of those."')}
      </div>
      <NextButton onClick={next} testId="suture-next">
        Anaesthetise
      </NextButton>
    </>
  )
}

function LocalStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [mode, setMode] = useState<'clean' | 'needle'>('clean')
  const rub = useRub({ cx: 116, cy: 70, rx: 60, ry: 52 })
  const warned = useRef(false)
  return (
    <>
      <p className="io-lede">Clean around the wound. Then put the needle in through the cut edges and drag along them, infiltrating as you go.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={mode === 'clean' || undefined} data-testid="suture-mode-clean" onClick={() => setMode('clean')}>
          CHLORHEXIDINE
        </button>
        <button type="button" className="tap io-mini" data-on={mode === 'needle' || undefined} data-testid="suture-mode-needle" onClick={() => setMode('needle')}>
          1% LIDOCAINE, ORANGE NEEDLE
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="108 / 100"
        className="mt-2"
        testId="suture-local"
        onDown={(p) => {
          warned.current = false
          if (mode === 'clean') return void rub.rub(p)
          if (toEdge(p) > 6 && !warned.current) {
            warned.current = true
            upd((c) => ({ throughSkin: c.throughSkin + 1 }))
            physical('He flinches: through intact skin it stings far more.')
            why('Go in through the cut edge of the wound itself.')
          }
        }}
        onMove={(p) => {
          if (mode === 'clean') {
            rub.rub(p)
            return upd({ cleaned: rub.coverage })
          }
          const seg = edgeSegment(p)
          if (seg === null) return
          const cur = runRef.current
          if (!cur.edges.includes(seg)) upd({ edges: [...cur.edges, seg], lidoMl: cur.lidoMl + 0.4 })
        }}
        onUp={() => {
          const cur = runRef.current
          if (mode === 'needle' && cur.edges.length) feel(`${cur.edges.length}/${EDGE_SEGMENTS} of the edges infiltrated (${cur.lidoMl.toFixed(1)} mL); the skin blanches as it goes in.`)
        }}
      >
        <Wound run={run} svgRef={svg}>
          <RubTint rub={rub} />
        </Wound>
      </TouchPad>
      <NextButton onClick={next} testId="suture-next">
        Irrigate
      </NextButton>
    </>
  )
}

function IrrigateStage({ run, runRef, upd, feel, physical, next }: Stage) {
  return (
    <>
      <p className="io-lede">Test the anaesthesia, then irrigate under pressure: a 20 mL syringe and a cannula, again and again.</p>
      <div className="io-figure aspect-[108/100]">
        <Wound run={run} />
      </div>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="suture-test"
          onClick={() => {
            upd({ tested: true })
            if (run.edges.length >= EDGE_SEGMENTS - 1) feel('A needle touched along both edges: he feels pressure, no pain.')
            else physical('"Ow, I felt that." Part of the edge is not numb.')
          }}
        >
          TOUCH THE EDGES WITH A NEEDLE
        </button>
      </div>
      <HoldButton
        testId="suture-irrigate"
        className="mt-2 w-full"
        onTick={(dt) => upd((c) => ({ irrigatedMl: c.irrigatedMl + dt * 40 }))}
        onEnd={() => {
          const cur = runRef.current
          feel(cur.irrigatedMl >= 100 ? `${cur.irrigatedMl.toFixed(0)} mL of saline under pressure: the grit is washed out.` : `${cur.irrigatedMl.toFixed(0)} mL so far. Keep going.`)
        }}
      >
        HOLD TO IRRIGATE · {run.irrigatedMl.toFixed(0)} ML
      </HoldButton>
      <NextButton onClick={next} testId="suture-next">
        Explore
      </NextButton>
    </>
  )
}

function ExploreStage({ run, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  return (
    <>
      <p className="io-lede">Lift the flap and look under it. Remove anything that should not be there; trim only what is dead.</p>
      <TouchPad
        svg={svg}
        aspect="108 / 100"
        testId="suture-explore"
        onDown={(p) => {
          if (run.lifted && !run.foreignOut && Math.hypot(p.x - FOREIGN.x, p.y - FOREIGN.y) < 9) {
            upd({ foreignOut: true })
            sfx.select()
            return feel('Forceps: a sliver of metal from the edge that cut him. Out.')
          }
          if (!run.tagTrimmed && Math.hypot(p.x - TAG.x, p.y - TAG.y) < 9) {
            upd({ tagTrimmed: true })
            return feel('A grey, ragged tag of skin on the lower edge: trimmed back to bleeding tissue.')
          }
          if (Math.hypot(p.x - A.x, p.y - A.y) < 12 && !run.lifted) {
            upd({ tipTrimmed: true })
            buzz(40)
            physical('You cut the tip off the flap.')
            return why('The tip was pink and refilling: alive. Trim only what is dead.')
          }
          feel(run.lifted ? 'Red, bleeding tissue; look for anything grey, black or shiny.' : 'Lift the flap to see under it.')
        }}
      >
        <Wound run={run} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.lifted || undefined} data-testid="suture-lift" onClick={() => (upd({ lifted: !run.lifted }), feel(run.lifted ? 'The flap laid back down.' : 'Toothed forceps lift the flap gently by its edge.'))}>
          {run.lifted ? 'LAY THE FLAP BACK' : 'LIFT THE FLAP WITH FORCEPS'}
        </button>
      </div>
      <NextButton onClick={next} testId="suture-next">
        Corner stitch
      </NextButton>
    </>
  )
}

function CornerStage({ run, upd, feel, physical, why, next, corner, setCorner }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const path = useRef<Pt[]>([])
  const [kind, setKind] = useState<CornerKind | null>(run.corner)
  return (
    <>
      <p className="io-lede">Anchor the tip first. Choose the stitch, then draw its path: from the skin on one side, through the tip, out on the other side.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={kind === 'half-buried' || undefined} data-testid="suture-corner-half" onClick={() => setKind('half-buried')}>
          HALF-BURIED MATTRESS: THROUGH THE DERMIS OF THE TIP
        </button>
        <button type="button" className="tap io-mini" data-on={kind === 'transfixing' || undefined} data-testid="suture-corner-full" onClick={() => setKind('transfixing')}>
          SIMPLE STITCH: FULL THICKNESS THROUGH THE TIP
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="108 / 100"
        className="mt-2"
        testId="suture-corner"
        onDown={(p) => {
          if (!kind) return feel('Choose the stitch first.')
          path.current = [p]
          setCorner([p])
        }}
        onMove={(p) => {
          if (!kind || !path.current.length) return
          path.current = [...path.current, p]
          setCorner(path.current)
        }}
        onUp={() => {
          if (!kind || path.current.length < 2) return
          const ok = judgeCorner(path.current)
          upd({ corner: kind, cornerOk: ok })
          sfx.cursor()
          if (kind === 'transfixing') {
            physical('Tied tight, the tip goes white.')
            why('A full-thickness stitch through the tip strangles it. A half-buried mattress catches only its dermis.')
          } else if (ok) feel('In through the skin beside one edge, across through the dermis of the tip, out beside the other edge: tied, the tip sits snugly in its corner.')
          else why('In through the intact skin just beyond one edge, through the tip, out beyond the other edge.')
        }}
      >
        <Wound run={run} svgRef={svg} corner={corner} />
      </TouchPad>
      <NextButton onClick={next} testId="suture-next">
        Sutures
      </NextButton>
    </>
  )
}

function StitchStage({ run, upd, feel, why, physical, next, corner, lines, setLines }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const start = useRef<Pt | null>(null)
  return (
    <>
      <p className="io-lede">Load the needle, then drag each stitch across the wound: in on one side, out the same distance on the other, square to the edge.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.holder === 'instrument' || undefined} data-testid="suture-holder" onClick={() => (upd({ holder: 'instrument' }), feel('Needle loaded in the needle holder, two-thirds back from the tip; forceps in the other hand.'))}>
          LOAD WITH THE NEEDLE HOLDER
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-on={run.holder === 'fingers' || undefined}
          data-testid="suture-fingers"
          onClick={() => {
            upd({ holder: 'fingers' })
            physical('You pick the needle up with your fingers.')
            why('Never touch a suture needle with your fingers: instruments only.')
          }}
        >
          PICK IT UP WITH YOUR FINGERS
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="108 / 100"
        className="mt-2"
        testId="suture-stitch"
        onDown={(p) => (start.current = p)}
        onUp={(p) => {
          const s = start.current
          start.current = null
          if (!s || !p || Math.hypot(p.x - s.x, p.y - s.y) < 6) return
          const st: Stitch | null = judgeStitch(s, p)
          if (!st) return feel('That does not cross the wound.')
          upd((c) => ({ stitches: [...c.stitches, st] }))
          setLines([...lines, [s, p]])
          sfx.cursor()
          if (st.ok) feel('Needle in at 90°, out the same distance the other side; tied with the knot to one side, the edges just everted.')
          else why(st.why ?? '')
        }}
      >
        <Wound run={run} svgRef={svg} corner={corner} lines={lines} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="suture-undo"
          disabled={!run.stitches.length}
          onClick={() => {
            upd((c) => ({ stitches: c.stitches.slice(0, -1) }))
            setLines(lines.slice(0, -1))
            feel('You cut the last stitch out.')
          }}
        >
          CUT OUT THE LAST STITCH
        </button>
      </div>
      <NextButton onClick={next} testId="suture-next">
        Finish
      </NextButton>
    </>
  )
}

function FinishStage({ run, upd, feel, next }: Stage) {
  return (
    <>
      <p className="io-lede">Before anything else: the needle.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.sharps || undefined} data-testid="suture-sharps" onClick={() => (upd({ sharps: true }), feel('The needle goes straight into the sharps bin, by you.'))}>
          {run.sharps ? 'SHARPS BIN ✓' : 'NEEDLE INTO THE SHARPS BIN'}
        </button>
        <button type="button" className="tap io-mini" data-on={run.dressed || undefined} data-testid="suture-dress" onClick={() => (upd({ dressed: true }), feel('A non-adherent dressing and a light bandage.'))}>
          {run.dressed ? 'DRESSED ✓' : 'NON-ADHERENT DRESSING'}
        </button>
      </div>
      <NextButton onClick={next} testId="suture-next">
        Done
      </NextButton>
    </>
  )
}
