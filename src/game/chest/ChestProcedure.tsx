import { useRef, useState, type ReactNode, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, RubTint, Syringe, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { DRAIN_MARKS, LINES, NEEDLE_MARKS, SECTION, drainRows, freshChest, judgeIncision, laneAt, needleRows, pleuraY, pushNeedle, ribY, siteAt, type Blood, type ChestRun, type Site } from './model'

const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<ChestRun> & { next: () => void; fluid: Blood; side: string }

/**
 * The chest by hand. `pose: "needle:left"`: decompress a tension pneumothorax with a needle, then put in a drain.
 * `pose: "drain:right"`: a large-bore drain for a massive haemothorax. The side is the patient's.
 */
export function ChestProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const [mode, sideRaw] = (job.pose ?? 'drain:right').split(':')
  const needle = mode === 'needle'
  const side = sideRaw === 'left' ? 'LEFT' : 'RIGHT'
  const fluid: Blood = needle ? 'air' : 'blood'
  const titles = needle ? ['Site', 'Decompress', 'Position', 'Mark', 'Prepare', 'Incise', 'Dissect', 'Tube', 'Seal'] : ['Position', 'Mark', 'Prepare', 'Incise', 'Dissect', 'Tube', 'Seal']
  const api = useBench(freshChest, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  const next = () => {
    sfx.select()
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  const rows = needle ? needleRows(api.run) : drainRows(api.run, fluid)
  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const { marks, faults } = benchMarks(rows, (needle ? NEEDLE_MARKS : DRAIN_MARKS) as readonly string[], job.grantMarks)
    const scenes: string[] = []
    if (needle && r.decompressed) scenes.push('decompressed')
    if (r.seal) scenes.push('drain')
    onDone({ marks, faults, summary: needle ? `${r.decompressed ? 'Decompressed' : 'Not decompressed'}; ${r.seal ? 'drain in and swinging' : 'no drain'}.` : r.seal ? 'Drain in: 1600 mL of blood.' : 'No drain.', scene: scenes.length ? scenes : ['no-drain'] })
  }
  const stage: Stage = { ...api, next, fluid, side }
  const step = titles[index]
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="chest-bench">
      <div className="hare-bar">
        <span>{side} CHEST</span>
        <span />
        <span>{needle ? (api.run.decompressed ? 'DECOMPRESSED' : 'TENSION') : 'HAEMOTHORAX'}</span>
      </div>
      <StepStrip titles={titles} index={checked ? titles.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={rows} onContinue={finish} testId="chest-check" />
        ) : (
          <>
            {step === 'Site' && <SiteStage {...stage} />}
            {step === 'Decompress' && <NeedleStage {...stage} />}
            {step === 'Position' && <PositionStage {...stage} />}
            {step === 'Mark' && <MarkStage {...stage} />}
            {step === 'Prepare' && <PrepareStage {...stage} />}
            {step === 'Incise' && <InciseStage {...stage} />}
            {step === 'Dissect' && <DissectStage {...stage} />}
            {step === 'Tube' && <TubeStage {...stage} />}
            {step === 'Seal' && <SealStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

function Front({ svgRef, side, mark, line, tube, needleAt, armUp = true, children }: { svgRef?: Ref<SVGSVGElement>; side: string; mark?: Pt | null; line?: [Pt, Pt] | null; tube?: [Pt, Pt] | null; needleAt?: Pt | null; armUp?: boolean; children?: ReactNode }) {
  return (
    <svg ref={svgRef} viewBox="0 0 180 170" className="block h-full w-full select-none" data-testid="chest-front">
      <rect width="180" height="170" fill="#eef2f4" />
      <path d={`M0 20 L150 20 Q${armUp ? 168 : 178} 30 176 60 L172 170 L0 170 Z`} fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      {armUp && <path d="M150 20 L176 0 L180 0 L180 40 L176 60 Z" fill={SKIN} stroke={SKIN_EDGE} />}
      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
        <line key={n} x1="6" y1={ribY(n)} x2="172" y2={ribY(n)} stroke="#d8a080" strokeWidth="5" opacity="0.55" />
      ))}
      {/* folds: pectoralis major (anterior axillary), latissimus dorsi (posterior); the nipple */}
      <path d="M96 40 Q112 80 120 112" stroke={SKIN_EDGE} strokeWidth="1.4" fill="none" />
      <path d="M170 56 Q164 96 162 140" stroke={SKIN_EDGE} strokeWidth="1.4" fill="none" />
      <circle cx={LINES.mcl} cy={ribY(4) + 8} r="3" fill="#b07060" />
      <line x1={LINES.mcl} y1="20" x2={LINES.mcl} y2="170" stroke="#9aa4b0" strokeDasharray="1 4" />
      <line x1={LINES.mal} y1="40" x2={LINES.mal} y2="170" stroke="#9aa4b0" strokeDasharray="1 4" />
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="12">{side} CHEST · ARM UP</text>
        <text x={LINES.mcl - 8} y="166">MCL</text>
        <text x={LINES.mal - 8} y="166">MAL</text>
        {[2, 4, 5].map((n) => (
          <text key={n} x="8" y={ribY(n) + 10}>
            {n}
          </text>
        ))}
      </g>
      {mark && (
        <g stroke="#3040c0" strokeWidth="1.6">
          <line x1={mark.x - 3} y1={mark.y - 3} x2={mark.x + 3} y2={mark.y + 3} />
          <line x1={mark.x + 3} y1={mark.y - 3} x2={mark.x - 3} y2={mark.y + 3} />
        </g>
      )}
      {needleAt && <circle cx={needleAt.x} cy={needleAt.y} r="3" fill="#f09040" stroke="#505868" />}
      {line && <line x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} stroke="#a01818" strokeWidth="2.2" />}
      {tube && <line x1={tube[0].x} y1={tube[0].y} x2={tube[1].x} y2={tube[1].y} stroke="#f0f4f8" strokeWidth="5" strokeLinecap="round" opacity="0.9" />}
      {children}
    </svg>
  )
}

function Section({ svgRef, site, tip, label, fluid, entered, children }: { svgRef?: Ref<SVGSVGElement>; site: Site; tip?: Pt | null; label: string; fluid: Blood; entered?: boolean; children?: ReactNode }) {
  const pleura = pleuraY(site)
  const ribCy = SECTION.skinY + (pleura - SECTION.skinY) * 0.6
  return (
    <svg ref={svgRef} viewBox="0 0 160 120" className="block h-full w-full select-none" data-testid="chest-section">
      <rect width="160" height="120" fill="#eef2f4" />
      <rect x="0" y={pleura} width="160" height={120 - pleura} fill={fluid === 'blood' && entered ? '#7a1818' : '#c8d8e8'} />
      <rect x="0" y={SECTION.skinY} width="160" height={pleura - SECTION.skinY} fill="#e8c0a8" />
      <rect x="0" y={SECTION.skinY} width="160" height="4" fill={SKIN_EDGE} />
      <circle cx="40" cy={ribCy} r={SECTION.ribR} fill="#f4f0e2" stroke="#9a9078" />
      <circle cx="120" cy={ribCy} r={SECTION.ribR} fill="#f4f0e2" stroke="#9a9078" />
      {/* the neurovascular bundle under the rib above */}
      <circle cx="48" cy={ribCy + SECTION.ribR + 2} r="2.4" fill="#3050c0" />
      <circle cx="54" cy={ribCy + SECTION.ribR + 1} r="2.4" fill="#c02020" />
      <circle cx="60" cy={ribCy + SECTION.ribR} r="2" fill="#f8e050" />
      <line x1="0" y1={pleura} x2="160" y2={pleura} stroke="#506070" strokeWidth="2" />
      {tip && (
        <g>
          <line x1={tip.x} y1="0" x2={tip.x} y2={tip.y} stroke="#8890a0" strokeWidth="2" />
          <circle cx={tip.x} cy={tip.y} r="2" fill="#505868" />
        </g>
      )}
      <g fontFamily={FONT} fontSize="4.5" fill="#303848">
        <text x="2" y="7">{label}</text>
        <text x="26" y={ribCy + 3}>RIB ABOVE</text>
        <text x="104" y={ribCy + 3}>RIB BELOW</text>
        <text x="2" y={pleura + 8}>PLEURA</text>
      </g>
      {children}
    </svg>
  )
}

/* ---------------------------------------------------------------- needle decompression */

function SiteStage({ run, upd, feel, why, next, side }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [at, setAt] = useState<Pt | null>(null)
  return (
    <>
      <p className="io-lede">Count the spaces and tap where the needle goes. A quick wipe of the skin.</p>
      <TouchPad
        svg={svg}
        aspect="180 / 170"
        className="mx-auto max-w-[280px]"
        testId="chest-site"
        onDown={(p) => {
          const { site, space } = siteAt(p)
          setAt(p)
          upd({ site, space })
          sfx.cursor()
          if (site === 'safe') feel(`The ${space}th intercostal space, just in front of the mid-axillary line.`)
          else if (site === 'second-mcl') why('The 2nd space, mid-clavicular line: the pectoral muscles here are often thicker than your cannula. ATLS now goes laterally.')
          else if (site === 'rib') why('That is on a rib. Find the space.')
          else why('Count down to the 4th or 5th space, just anterior to the mid-axillary line.')
        }}
      >
        <Front svgRef={svg} side={side} needleAt={at} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.cleaned >= 0.5 || undefined} data-testid="chest-wipe" onClick={() => (upd({ cleaned: 1 }), feel('A quick wipe of chlorhexidine.'))}>
          {run.cleaned >= 0.5 ? 'WIPED ✓' : 'QUICK CHLORHEXIDINE WIPE'}
        </button>
      </div>
      <NextButton onClick={next} testId="chest-next">
        Decompress
      </NextButton>
    </>
  )
}

function NeedleStage({ run, runRef, upd, feel, physical, why, next, fluid }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<Pt | null>(null)
  const site = run.site ?? 'other'
  return (
    <>
      <p className="io-lede">Choose the cannula. On the section, tap where in the space it goes in, then drag it down until you hear air.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.cannula === 'standard' || undefined} data-testid="chest-cannula-standard" onClick={() => upd({ cannula: 'standard' })}>
          14 G STANDARD (32 MM)
        </button>
        <button type="button" className="tap io-mini" data-on={run.cannula === 'long' || undefined} data-testid="chest-cannula-long" onClick={() => upd({ cannula: 'long' })}>
          14 G LONG (8 CM)
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="160 / 120"
        className="mt-2"
        testId="chest-needle"
        onDown={(p) => {
          if (!runRef.current.cannula) return feel('Pick a cannula first.')
          const lane = laneAt(p.x)
          upd({ lane })
          setTip({ x: p.x, y: SECTION.skinY })
          if (lane === 'bundle') why('Right under the rib above: that is where the intercostal vessels and nerve run. Go over the top of the rib below.')
        }}
        onMove={(p) => {
          const cur = runRef.current
          if (!cur.cannula || !cur.lane) return
          const cm = Math.max(0, (p.y - SECTION.skinY) / SECTION.perCm)
          const { patch, event } = pushNeedle(cur, cm)
          upd(patch)
          const depth = runRef.current.depthCm
          setTip((t) => (t ? { x: t.x, y: SECTION.skinY + depth * SECTION.perCm } : t))
          if (event === 'hiss') {
            buzz(60)
            feel(fluid === 'air' ? 'A hiss of air. His saturation starts to climb and the pressure comes up.' : 'Blood in the hub.')
          } else if (event === 'short') physical('The hub is at the skin and there is no hiss: the cannula is too short for this chest wall.')
          else if (event === 'bundle') physical('Bright blood wells around the needle: an intercostal vessel.')
        }}
      >
        <Section svgRef={svg} site={site} tip={tip} label={`${site === 'second-mcl' ? '2ND SPACE MCL' : `${run.space ?? '?'}TH SPACE`} · WALL ${site === 'second-mcl' ? '4.6' : '3.4'} CM`} fluid={fluid} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.leftIn || undefined} data-testid="chest-leave" onClick={() => (upd({ leftIn: true }), feel('Needle out, cannula left in and taped. Someone watches it until the drain is in.'))}>
          {run.leftIn ? 'TAPED ✓' : 'LEAVE THE CANNULA IN; TAPE IT'}
        </button>
      </div>
      <NextButton onClick={next} testId="chest-next">
        Chest drain
      </NextButton>
    </>
  )
}

/* ---------------------------------------------------------------- the drain */

function PositionStage({ run, upd, feel, next, fluid, side }: Stage) {
  const btn = (key: 'armUp' | 'confirmedSide', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`chest-${key}`} onClick={() => (upd({ [key]: true } as Partial<ChestRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Position him and make sure of the side.</p>
      <div className="io-choices">
        {btn('armUp', 'ARM UP BEHIND HIS HEAD', 'His arm up behind his head: the safe triangle opens out.')}
        {btn('confirmedSide', 'CONFIRM THE SIDE: PATIENT AND FILM', `${side.toLowerCase().replace(/^./, (c) => c.toUpperCase())}: ${fluid === 'blood' ? 'dull, silent, and white-out on the film' : 'the side you decompressed'}. Agreed out loud.`)}
      </div>
      <NextButton onClick={next} testId="chest-next">
        Mark
      </NextButton>
    </>
  )
}

function MarkStage({ run, upd, feel, why, next, side }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [mark, setMark] = useState<Pt | null>(null)
  return (
    <>
      <p className="io-lede">Find the safe triangle: behind pectoralis major, in front of latissimus dorsi, above the nipple line. Mark the space.</p>
      <TouchPad
        svg={svg}
        aspect="180 / 170"
        className="mx-auto max-w-[280px]"
        testId="chest-mark"
        onDown={(p) => {
          const { site, space } = siteAt(p)
          setMark(p)
          upd({ mark: site, markSpace: space })
          sfx.cursor()
          if (site === 'safe') feel(`Marked: the ${space}th space, just anterior to the mid-axillary line.`)
          else if (space >= 6) why('Below the nipple line: the diaphragm, liver or spleen can be right there.')
          else why('Not the safe triangle: between the anterior and posterior axillary folds, 4th–5th space.')
        }}
      >
        <Front svgRef={svg} side={side} mark={mark} armUp={run.armUp} />
      </TouchPad>
      <NextButton onClick={next} testId="chest-next">
        Prepare
      </NextButton>
    </>
  )
}

function markPoint(run: ChestRun): Pt {
  const space = run.markSpace ?? 5
  return { x: LINES.mal - 10, y: ribY(space) + 8 }
}

function PrepareStage({ run, runRef, upd, feel, why, next, fluid, side }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const m = markPoint(run)
  const rub = useRub({ cx: m.x, cy: m.y, rx: 34, ry: 30 })
  return (
    <>
      <p className="io-lede">Clean and drape wide. Then lidocaine: skin, down over the rib, to the pleura. Aspirate as you go.</p>
      <TouchPad svg={svg} aspect="180 / 170" className="mx-auto max-w-[280px]" testId="chest-clean" onDown={(p) => rub.rub(p)} onMove={(p) => (rub.rub(p), upd({ cleaned: rub.coverage }))}>
        <Front svgRef={svg} side={side} mark={m} armUp={run.armUp}>
          <RubTint rub={rub} />
        </Front>
      </TouchPad>
      <Syringe
        capacity={20}
        drug={Math.max(0, 20 - run.local)}
        drugLabel="1% lidocaine"
        testId="chest-local"
        onPull={() => {
          const cur = runRef.current
          if (cur.local >= 5) {
            if (!cur.aspiratedPleura) feel(fluid === 'blood' ? 'Dark blood draws back: you are in the pleura, over the haemothorax.' : 'Air bubbles back: you are in the pleura.')
            upd({ aspiratedPleura: true })
            return { kind: fluid === 'blood' ? 'blood' : 'air' }
          }
          return { kind: 'none' }
        }}
        onInject={(ml) => {
          upd((c) => ({ local: c.local + ml }))
          return true
        }}
        onRelease={() => {
          const cur = runRef.current
          if (cur.local > 0 && cur.local < 5) feel(`${cur.local.toFixed(0)} mL so far: skin and fat. Keep going down to the pleura.`)
          else if (cur.local >= 5 && !cur.aspiratedPleura) why('Aspirate as you advance: when it draws back, you have reached the pleura.')
        }}
      />
      <NextButton onClick={next} testId="chest-next">
        Incise
      </NextButton>
    </>
  )
}

function InciseStage({ run, upd, feel, physical, why, next, side }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const start = useRef<Pt | null>(null)
  const [line, setLine] = useState<[Pt, Pt] | null>(null)
  return (
    <>
      <p className="io-lede">Draw a 3 cm incision with the scalpel, in line with the ribs, along the upper border of the rib below your space.</p>
      <TouchPad
        svg={svg}
        aspect="180 / 170"
        className="mx-auto max-w-[280px]"
        testId="chest-incise"
        onDown={(p) => (start.current = p)}
        onMove={(p) => start.current && setLine([start.current, p])}
        onUp={(p) => {
          const s = start.current
          start.current = null
          if (!s || !p || Math.hypot(p.x - s.x, p.y - s.y) < 5) return
          const j = judgeIncision(s, p, run.markSpace ?? 5)
          upd({ incision: j })
          setLine([s, p])
          if (j.where === 'lower-border') {
            buzz(40)
            physical('Brisk bleeding from the wound edge.')
            return why('That is under the rib above, along the neurovascular bundle. Cut along the upper border of the rib below.')
          }
          if (j.flat > 25) return why('Cut in line with the ribs, not across them.')
          if (j.where !== 'upper-border') return why('Put it right on the upper border of the rib below the space.')
          feel(`A ${j.length.toFixed(1)} cm incision along the top of the rib below, through skin and fat.`)
        }}
      >
        <Front svgRef={svg} side={side} mark={markPoint(run)} line={line} armUp={run.armUp} />
      </TouchPad>
      <NextButton onClick={next} testId="chest-next">
        Dissect
      </NextButton>
    </>
  )
}

function DissectStage({ run, runRef, upd, feel, physical, why, next, fluid }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<Pt | null>(null)
  const area = { cx: 80, cy: 104, rx: 70, ry: 12 }
  const rub = useRub(area)
  const site: Site = 'safe'
  return (
    <>
      <p className="io-lede">Curved forceps: tap where to go in, then push down bluntly to the pleura. Once in, sweep a finger round inside.</p>
      <TouchPad
        svg={svg}
        aspect="160 / 120"
        testId="chest-dissect"
        onDown={(p) => {
          if (runRef.current.inPleura) return void rub.rub(p)
          const lane = laneAt(p.x)
          upd({ dissectLane: lane })
          setTip({ x: p.x, y: SECTION.skinY })
          if (lane === 'bundle') why('Under the rib above: the intercostal vessels. Go over the top of the rib below.')
        }}
        onMove={(p) => {
          const cur = runRef.current
          if (cur.inPleura) {
            rub.rub(p)
            upd({ sweep: rub.coverage })
            return
          }
          if (!tip) return
          const y = Math.max(SECTION.skinY, p.y)
          setTip({ x: tip.x, y })
          if (y >= pleuraY(site)) {
            upd({ inPleura: true })
            buzz(50)
            if (cur.dissectLane === 'bundle') physical('Bright bleeding from under the rib as you push through.')
            feel(fluid === 'blood' ? 'A pop through the pleura and a gush of dark blood. Open the forceps to widen it.' : 'A pop through the pleura and a rush of air.')
          }
        }}
        onUp={() => {
          if (runRef.current.inPleura && runRef.current.sweep >= 0.6) feel('Your finger sweeps round inside: the lung falls away, no adhesions.')
        }}
      >
        <Section svgRef={svg} site={site} tip={tip} label="5TH SPACE · SAFE TRIANGLE" fluid={fluid} entered={run.inPleura}>
          {run.inPleura && <RubTint rub={rub} colour="#f0d0b0" />}
        </Section>
      </TouchPad>
      <NextButton onClick={next} testId="chest-next">
        Tube
      </NextButton>
    </>
  )
}

function TubeStage({ run, upd, feel, physical, why, next, fluid, side }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [tube, setTube] = useState<[Pt, Pt] | null>(null)
  const from = markPoint(run)
  const sizes: (12 | 20 | 28)[] = [12, 20, 28]
  return (
    <>
      <p className="io-lede">Choose the size. Then drag the tube in on a clamp from the incision, in the direction you want it to lie.</p>
      <div className="io-choices">
        {sizes.map((f) => (
          <button key={f} type="button" className="tap io-mini" data-on={run.tubeFr === f || undefined} data-testid={`chest-fr-${f}`} onClick={() => upd({ tubeFr: f })}>
            {f} FR
          </button>
        ))}
        <button
          type="button"
          className="tap io-mini"
          data-testid="chest-trocar"
          onClick={() => {
            upd({ trocar: true })
            buzz([60, 40, 60])
            physical('You push the tube in on its sharp trocar.')
            why('Never use the trocar: it can go through lung, heart, liver or spleen. Blunt dissection and a clamp.')
          }}
        >
          PUSH IT IN ON THE TROCAR
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="180 / 170"
        className="mx-auto mt-2 max-w-[280px]"
        testId="chest-tube"
        onDown={() => setTube([from, from])}
        onMove={(p) => setTube([from, p])}
        onUp={(p) => {
          if (!p) return
          if (!run.tubeFr) return feel('Pick a size first.')
          const angle = (Math.atan2(from.y - p.y, Math.abs(p.x - from.x) + 1) * 180) / Math.PI
          upd({ tubeAngle: angle })
          setTube([from, p])
          sfx.select()
          if (fluid === 'blood' && run.tubeFr !== 28) why('A big clotting bleed needs a big tube: 28–32 Fr.')
          if (angle < -20) why('Down toward the diaphragm, the tube can kink or lie under the liver or spleen. Aim up and back.')
          else if (angle <= 20) feel('It sits across the chest, not where the fluid will collect best. Aim up and back.')
          else feel('The clamped tip guides it in through the track, aimed posteriorly and up.')
        }}
      >
        <Front svgRef={svg} side={side} mark={from} tube={tube} armUp={run.armUp} />
      </TouchPad>
      <NextButton onClick={next} testId="chest-next">
        Seal
      </NextButton>
    </>
  )
}

function SealStage({ run, upd, feel, next, fluid }: Stage) {
  const btn = (key: 'seal' | 'sutured' | 'xray', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`chest-${key}`} onClick={() => (upd({ [key]: true } as Partial<ChestRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Connect it, watch it, secure it.</p>
      <div className="io-figure mx-auto aspect-[120/90] max-w-[200px]">
        <svg viewBox="0 0 120 90" className="block h-full w-full">
          <rect width="120" height="90" fill="#eef2f4" />
          <rect x="34" y="16" width="52" height="68" rx="4" fill="#f8fbff" stroke="#505868" />
          <rect x="35" y={run.seal ? (fluid === 'blood' ? 30 : 62) : 62} width="50" height={run.seal ? (fluid === 'blood' ? 53 : 21) : 21} fill={run.seal && fluid === 'blood' ? '#8a1010' : '#cfe4ff'} />
          <line x1="60" y1="0" x2="60" y2="70" stroke="#606878" strokeWidth="3" />
          {run.seal && fluid === 'air' && [0, 1, 2].map((i) => <circle key={i} cx={58 + i * 3} cy={66 - i * 4} r="2" fill="#ffffff" className="hare-pulse" />)}
          <text x="4" y="10" fontFamily={FONT} fontSize="5" fill="#40404c">
            UNDERWATER SEAL {run.seal && fluid === 'blood' ? '· 1600 ML' : ''}
          </text>
        </svg>
      </div>
      <div className="io-choices mt-2">
        {btn('seal', 'CONNECT TO THE UNDERWATER SEAL', fluid === 'blood' ? 'Blood pours into the bottle: 1600 mL, and still coming. The level swings with breathing.' : 'Bubbling, and the water swings with each breath.')}
        {btn('sutured', 'SUTURE AND DRESS', 'A stay suture and a mesentery of tape; a clear dressing.')}
        {btn('xray', 'REPEAT CHEST X-RAY', 'The film: the tube in the pleural space, aimed up and back.')}
      </div>
      <NextButton onClick={next} testId="chest-next">
        Finish
      </NextButton>
    </>
  )
}
