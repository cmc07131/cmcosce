import { useRef, useState, type ReactNode, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, RubTint, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { A, ARMS, B1, B2, BITE, EDGE_SEGMENTS, FOREIGN, SUTURE_MARKS, TAG, TIP_ZONE, checkSuture, edgeSegment, freshSuture, inFlap, judgeCorner, judgeStitch, toEdge, type CornerKind, type Stitch, type SutureRun } from './model'

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
          {!run.foreignOut && (
            <g transform={`rotate(25 ${FOREIGN.x} ${FOREIGN.y})`}>
              <rect x={FOREIGN.x - 4.5} y={FOREIGN.y - 2.5} width="9" height="5" fill="#b8c0c8" stroke="#404850" strokeWidth="0.6" />
              <path d={`M${FOREIGN.x - 3} ${FOREIGN.y - 1.5} l5 0`} stroke="#ffffff" strokeWidth="0.8" />
            </g>
          )}
          <path d={`M${B1.x} ${B1.y} L${B2.x} ${B2.y} L${B2.x - 22} ${B2.y - 10} L${B1.x - 22} ${B1.y + 10} Z`} fill={SKIN} stroke={SKIN_EDGE} />
        </g>
      ) : (
        <path d={`M${A.x - (run.tipTrimmed ? 10 : 2)} ${A.y} L${B1.x + 2} ${B1.y + 3} L${B2.x + 2} ${B2.y - 3} Z`} fill={SKIN} stroke={SKIN_EDGE} />
      )}
      <line x1={B1.x} y1={B1.y} x2={B2.x} y2={B2.y} stroke={SKIN_EDGE} strokeDasharray="2 3" opacity="0.6" />
      {!run.tagTrimmed && <path d={`M${TAG.x - 7} ${TAG.y - 2} l3.5 4.5 l3.5 -3.5 l3.5 4.5 l3.5 -3.5`} stroke="#4a4038" strokeWidth="3" strokeLinejoin="round" fill="none" />}
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
  const btn = (key: 'distal' | 'flapLooked', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`suture-${key}`} onClick={() => (upd({ [key]: true } as Partial<SutureRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Neurovascular status before you touch it: the flap tip (colour, capillary refill) and the foot below the wound.</p>
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
        {btn('flapLooked', 'PRESS THE FLAP TIP: COLOUR AND REFILL', 'The flap is pink. Pressed at the tip it blanches and refills in under 2 seconds: alive.')}
        {btn('distal', 'FOOT: PULSES, SENSATION, MOVEMENT', 'Dorsalis pedis and posterior tibial pulses present; sensation normal over the foot; moves the toes and ankle.')}
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
          {run.lidoSharps ? 'LIDOCAINE NEEDLE: IN THE BIN' : '1% LIDOCAINE, ORANGE NEEDLE'}
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
          if (runRef.current.lidoSharps) return void feel('That needle is already in the sharps bin.')
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
          if (runRef.current.lidoSharps) return
          const seg = edgeSegment(p)
          if (seg === null) return
          const cur = runRef.current
          if (!cur.edges.includes(seg)) upd({ edges: [...cur.edges, seg], lidoMl: cur.lidoMl + 0.4 })
        }}
        onUp={() => {
          const cur = runRef.current
          if (mode === 'needle' && cur.edges.length && !cur.lidoSharps) feel(`${cur.edges.length}/${EDGE_SEGMENTS} of the edges infiltrated (${cur.lidoMl.toFixed(1)} mL); the skin blanches as it goes in.`)
        }}
      >
        <Wound run={run} svgRef={svg}>
          <RubTint rub={rub} />
        </Wound>
      </TouchPad>
      {run.edges.length > 0 && (
        <SharpsTray
          items={run.lidoSharps ? [] : [{ id: 'lido', kind: 'needle' }]}
          onBin={() => (upd({ lidoSharps: true }), sfx.select(), feel(runRef.current.edges.length >= EDGE_SEGMENTS - 1 ? 'Infiltration done: the orange needle straight into the sharps bin, by you.' : 'The needle is in the bin, with part of the edge still not numb.'))}
        />
      )}
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
      <p className="io-lede">Lift the flap and look under it. Tap what should not be there to remove it, and what is dead to trim it. Keep what is alive.</p>
      <TouchPad
        svg={svg}
        aspect="108 / 100"
        testId="suture-explore"
        onDown={(p) => {
          if (run.lifted && !run.foreignOut && Math.hypot(p.x - FOREIGN.x, p.y - FOREIGN.y) < 12) {
            upd({ foreignOut: true })
            sfx.select()
            return feel('Forceps: a sliver of metal from the edge that cut him. Out.')
          }
          if (!run.tagTrimmed && Math.hypot(p.x - TAG.x, p.y - TAG.y) < 12) {
            upd({ tagTrimmed: true })
            return feel('A grey, ragged tag of skin on the lower edge: trimmed back to bleeding tissue.')
          }
          if (Math.hypot(p.x - A.x, p.y - A.y) < 12 && !run.lifted) {
            upd({ tipTrimmed: true })
            buzz(40)
            physical('You cut the tip off the flap.')
            return why('The tip was pink and refilling: alive. Trim only what is dead.')
          }
          feel(run.lifted ? 'The base: healthy, bleeding muscle and fascia; no bone or tendon showing. Look for anything grey, black or shiny.' : 'Lift the flap to see under it.')
        }}
      >
        <Wound run={run} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.lifted || undefined} data-testid="suture-lift" onClick={() => (upd({ lifted: !run.lifted }), feel(run.lifted ? 'The flap laid back down.' : 'Toothed forceps lift the flap by its edge. Something glints near its base: tap it to remove it. Tap anything dead to trim it.'))}>
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

function StitchStage({ run, upd, feel, why, physical, next, corner, lines, setLines, coach }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const start = useRef<Pt | null>(null)
  const [drag, setDrag] = useState<[Pt, Pt] | null>(null)
  const preview = drag ? judgeStitch(drag[0], drag[1]) : null
  const mm = (u: number) => (u / 2).toFixed(1)
  return (
    <>
      <p className="io-lede">Load the needle, then drag each stitch across the wound: in on one side, out the same distance on the other, square to the edge. Aim 3.5–6 mm each side, 4–7 mm apart.</p>
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
        onDown={(p) => {
          if (!run.holder) return void feel('Load the needle first: choose how you hold it.')
          start.current = p
          setDrag([p, p])
        }}
        onMove={(p) => start.current && setDrag([start.current, p])}
        onUp={(p) => {
          const s = start.current
          start.current = null
          setDrag(null)
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
        <Wound run={run} svgRef={svg} corner={corner} lines={lines}>
          {coach && <BiteBands />}
          {drag && <line x1={drag[0].x} y1={drag[0].y} x2={drag[1].x} y2={drag[1].y} stroke={preview?.ok ? '#1f8a3a' : '#c07a10'} strokeWidth="1.2" strokeDasharray="2 1.2" />}
        </Wound>
      </TouchPad>
      <p className={`m-0 mt-1.5 text-center font-[Press_Start_2P,monospace] text-[9px] leading-snug ${preview?.ok ? 'text-[#1f6a30]' : 'text-[#8a5a00]'}`} data-testid="suture-readout">
        {preview
          ? `BITES ${mm(preview.d1)} MM | ${mm(preview.d2)} MM · ${Math.round(90 - preview.angle)}° TO THE EDGE${preview.ok ? ' ✓' : ''}`
          : drag
            ? 'DRAG ACROSS THE WOUND'
            : `${run.stitches.filter((x) => x.ok).length}/${run.stitches.length} STITCHES WELL PLACED`}
      </p>
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
  const items = [...(run.lidoSharps ? [] : [{ id: 'lido', kind: 'needle' as const }]), ...(run.sharps ? [] : [{ id: 'suture', kind: 'suture' as const }])]
  return (
    <>
      <p className="io-lede">Before anything else: the sharps. Drag each needle from the tray into the bin.</p>
      <SharpsTray
        items={items}
        onBin={(id) => {
          sfx.select()
          if (id === 'lido') return (upd({ lidoSharps: true }), feel('The orange needle into the sharps bin.'))
          upd({ sharps: true })
          feel('The suture needle, still in the needle holder, straight into the sharps bin, by you.')
        }}
      />
      <div className="io-choices mt-2">
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

/** Practice mode: where a good bite lands, each side of each arm (beyond the tip, which is the corner stitch's). */
function BiteBands() {
  return (
    <g opacity="0.22" pointerEvents="none">
      {ARMS.flatMap(([a, b], arm) => {
        const L = Math.hypot(b.x - a.x, b.y - a.y)
        const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }
        const n = { x: -u.y, y: u.x }
        const at = (along: number, off: number) => `${a.x + u.x * along + n.x * off},${a.y + u.y * along + n.y * off}`
        return [1, -1].map((side) => (
          <polygon
            key={`${arm}${side}`}
            points={[at(TIP_ZONE, side * 7), at(L, side * 7), at(L, side * 12), at(TIP_ZONE, side * 12)].join(' ')}
            fill="#1f8a3a"
          />
        ))
      })}
      <circle cx={A.x} cy={A.y} r={TIP_ZONE} fill="#c03030" />
    </g>
  )
}

type Sharp = { id: string; kind: 'needle' | 'suture' }

/** A kidney tray and a yellow sharps bin: drag each used needle from the tray into the bin. */
function SharpsTray({ items, onBin }: { items: Sharp[]; onBin: (id: string) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ id: string; p: Pt } | null>(null)
  const BIN = { x: 70, y: 4, w: 26, h: 32 }
  const home = (i: number): Pt => ({ x: 14 + i * 22, y: 26 })
  const inBin = (p: Pt) => p.x > BIN.x - 4 && p.x < BIN.x + BIN.w + 4 && p.y > BIN.y - 6 && p.y < BIN.y + BIN.h
  const draw = (it: Sharp, p: Pt) =>
    it.kind === 'needle' ? (
      <g key={it.id} transform={`translate(${p.x} ${p.y}) rotate(-20)`}>
        <rect x="-9" y="-1.6" width="6" height="3.2" rx="0.8" fill="#f08a1c" />
        <line x1="-3" y1="0" x2="9" y2="0" stroke="#9aa4ae" strokeWidth="0.9" />
      </g>
    ) : (
      <g key={it.id} transform={`translate(${p.x} ${p.y})`}>
        <path d="M-10 4 L2 -1 M-10 6 L2 1" stroke="#7d8790" strokeWidth="1.4" />
        <path d="M2 0 a4 4 0 1 0 6 -3" stroke="#9aa4ae" strokeWidth="0.9" fill="none" />
        <path d="M8 -3 q6 -4 10 2" stroke="#2040c0" strokeWidth="0.6" fill="none" />
      </g>
    )
  return (
    <div className="mt-2" data-testid="suture-sharps-tray">
      <TouchPad
        svg={svg}
        aspect="100 / 40"
        testId="suture-sharps"
        onDown={(p) => {
          const i = items.findIndex((it, k) => Math.hypot(p.x - home(k).x, p.y - home(k).y) < 11)
          if (i >= 0) setDrag({ id: items[i].id, p })
        }}
        onMove={(p) => drag && setDrag({ ...drag, p })}
        onUp={(p) => {
          if (drag && p && inBin(p)) onBin(drag.id)
          setDrag(null)
        }}
      >
        <svg ref={svg} viewBox="0 0 100 40" className="block h-full w-full select-none">
          <rect x="0" y="0" width="100" height="40" fill="#eef1f4" />
          <path d="M4 18 q26 -10 54 0 q4 12 -4 16 q-23 6 -46 0 q-8 -4 -4 -16 Z" fill="#c9d0d6" stroke="#8e98a2" strokeWidth="0.6" />
          <rect x={BIN.x} y={BIN.y + 5} width={BIN.w} height={BIN.h - 5} rx="1.5" fill="#f2c200" stroke="#9a7a00" strokeWidth="0.6" />
          <rect x={BIN.x - 1} y={BIN.y} width={BIN.w + 2} height="6" rx="1" fill="#d23a2a" />
          <rect x={BIN.x + 9} y={BIN.y + 1.6} width="8" height="2" fill="#5a1a12" />
          <text x={BIN.x + BIN.w / 2} y={BIN.y + 20} fontFamily={FONT} fontSize="3.2" textAnchor="middle" fill="#5a4300">
            SHARPS
          </text>
          {items.map((it, i) => (drag?.id === it.id ? null : draw(it, home(i))))}
          {drag && draw(items.find((it) => it.id === drag.id) ?? { id: drag.id, kind: 'needle' }, drag.p)}
          {!items.length && (
            <text x="30" y="27" fontFamily={FONT} fontSize="3" textAnchor="middle" fill="#46505a">
              NOTHING SHARP LEFT
            </text>
          )}
        </svg>
      </TouchPad>
      <p className="sheet-meta mt-1 text-center">{items.length ? 'DRAG THE NEEDLE INTO THE SHARPS BIN' : 'ALL SHARPS IN THE BIN'}</p>
    </div>
  )
}
