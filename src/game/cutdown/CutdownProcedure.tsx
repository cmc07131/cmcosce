import { useRef, useState, type ReactNode, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, RubTint, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { CUTDOWN_MARKS, FIELD, LANDMARK, MALLEOLUS, VEIN_LINE, checkCutdown, freshCutdown, judgeIncision, structureAt, type CutdownRun, type Ligature } from './model'

const TITLES = ['Landmark', 'Prepare', 'Incise', 'Dissect', 'Ligatures', 'Cannulate', 'Close']
const SKIN = '#d8b0a0'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<CutdownRun> & { next: () => void; fat: Set<number>; setFat: (s: Set<number>) => void }

/**
 * A great saphenous vein cut-down by hand: find the landmark, prepare, cut transversely through the skin, spread the
 * fat in the line of the vein, lift the vein (not the nerve), pass two ligatures and tie the distal one, nick the
 * vein, slide the cannula toward the heart, tie it in, run the fluids, close.
 */
export function CutdownProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshCutdown, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [fat, setFat] = useState<Set<number>>(() => new Set())
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
    const { marks, faults } = benchMarks(checkCutdown(r), CUTDOWN_MARKS, job.grantMarks)
    const running = r.cannula === 'proximal' && r.fluids && r.released && !r.transected
    onDone({ marks, faults, summary: `Saphenous cut-down: ${running ? 'cannula in, fluids running' : 'no working access'}.`, scene: running ? [job.scene || 'access'] : ['no-access'] })
  }
  const stage: Stage = { ...api, next, fat, setFat }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="cutdown-bench">
      <div className="hare-bar">
        <span>SHOCKED · NO IV ACCESS</span>
        <span />
        <span>R ANKLE</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkCutdown(api.run)} onContinue={finish} testId="cutdown-check" />
        ) : (
          <>
            {index === 0 && <LandmarkStage {...stage} />}
            {index === 1 && <PrepareStage {...stage} />}
            {index === 2 && <InciseStage {...stage} />}
            {index >= 3 && <FieldStage {...stage} stage={index} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

function Ankle({ run, svgRef, cut, children }: { run: CutdownRun; svgRef?: Ref<SVGSVGElement>; cut?: { from: Pt; to: Pt } | null; children?: ReactNode }) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 150" className="block h-full w-full select-none" data-testid="cutdown-ankle">
      <rect width="200" height="150" fill="#eef2f4" />
      <path d="M0 50 L140 56 Q170 52 196 70 L196 120 L150 128 Q120 136 100 126 L0 122 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      <ellipse cx={MALLEOLUS.x} cy={MALLEOLUS.y} rx="12" ry="10" fill={SKIN} stroke={SKIN_EDGE} />
      {/* the vein, faint under the skin of a shocked man */}
      <line x1={VEIN_LINE.a.x} y1={VEIN_LINE.a.y} x2={VEIN_LINE.b.x} y2={VEIN_LINE.b.y} stroke="#6070b0" strokeWidth="3" opacity={run.tourniquet ? 0.35 : 0.12} />
      {run.tourniquet && <rect x="20" y="48" width="8" height="76" fill="#3a70c0" opacity="0.9" />}
      {run.mark && (
        <g stroke="#3040c0" strokeWidth="1.6">
          <line x1={run.mark.x - 4} y1={run.mark.y - 4} x2={run.mark.x + 4} y2={run.mark.y + 4} />
          <line x1={run.mark.x + 4} y1={run.mark.y - 4} x2={run.mark.x - 4} y2={run.mark.y + 4} />
        </g>
      )}
      {cut && <line x1={cut.from.x} y1={cut.from.y} x2={cut.to.x} y2={cut.to.y} stroke="#a01818" strokeWidth={run.deep ? 4 : 2.4} />}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">R ANKLE · MEDIAL SIDE</text>
        <text x="4" y="146">← KNEE</text>
        <text x="168" y="146">FOOT →</text>
        <text x="118" y="122">MED. MALL.</text>
      </g>
      {children}
    </svg>
  )
}

/** Inside the incision: fat cells over the vein and the nerve until you spread them. */
const FAT_COLS = 10
const FAT_ROWS = 5

function Field({ run, fat, svgRef, nick, cannulaDir }: { run: CutdownRun; fat: Set<number>; svgRef?: Ref<SVGSVGElement>; nick?: number | null; cannulaDir?: 'proximal' | 'distal' | null }) {
  const lifted = run.lifted === 'vein'
  const vy = lifted ? FIELD.veinY - 10 : FIELD.veinY
  return (
    <svg ref={svgRef} viewBox="0 0 200 120" className="block h-full w-full select-none" data-testid="cutdown-field">
      <rect width="200" height="120" fill="#a83030" />
      <rect x="0" y="0" width="200" height="12" fill={SKIN} />
      <rect x="0" y="108" width="200" height="12" fill={SKIN} />
      {/* vein (fills; blue), nerve (white strand) */}
      <rect x="0" y={vy - FIELD.veinR} width="200" height={FIELD.veinR * 2} rx={FIELD.veinR} fill={run.tourniquet && !run.released ? '#4050a0' : '#6070b8'} stroke="#2a3070" />
      <line x1="0" y1={FIELD.nerveY} x2="200" y2={FIELD.nerveY + 2} stroke="#f4f0e0" strokeWidth={FIELD.nerveR * 2} />
      {lifted && <path d={`M70 ${vy + FIELD.veinR} Q100 ${vy + 22} 130 ${vy + FIELD.veinR}`} stroke="#303030" strokeWidth="2" fill="none" />}
      {/* ligatures: distal toward the foot (right), proximal toward the knee (left) */}
      {run.ligatures.map((l) => {
        const x = l === 'distal' ? 140 : 60
        const tied = run.tied.includes(l)
        return (
          <g key={l}>
            <line x1={x} y1={vy - FIELD.veinR - 4} x2={x} y2={vy + FIELD.veinR + 4} stroke="#202020" strokeWidth="1.6" />
            {tied && <path d={`M${x - 4} ${vy - FIELD.veinR - 4} l4 -4 l4 4`} stroke="#202020" fill="none" strokeWidth="1.5" />}
            {l === 'distal' && tied && <line x1={x} y1={vy - FIELD.veinR - 6} x2={x + 30} y2="4" stroke="#202020" strokeWidth="1" />}
          </g>
        )
      })}
      {nick != null && <line x1="100" y1={vy - FIELD.veinR} x2="100" y2={vy - FIELD.veinR + nick * FIELD.veinR * 2} stroke="#100810" strokeWidth="2.4" />}
      {cannulaDir && (
        <g>
          <line x1="100" y1={vy} x2={cannulaDir === 'proximal' ? 40 : 160} y2={vy} stroke="#f0f4f8" strokeWidth="3" />
          <line x1="100" y1={vy} x2={cannulaDir === 'proximal' ? 150 : 50} y2={vy - 20} stroke="#58b060" strokeWidth="4" />
        </g>
      )}
      {/* fat */}
      {Array.from({ length: FAT_COLS * FAT_ROWS }, (_, i) => {
        if (fat.has(i)) return null
        const c = i % FAT_COLS
        const row = Math.floor(i / FAT_COLS)
        return <ellipse key={i} cx={10 + c * 20} cy={24 + row * 18} rx="12" ry="11" fill="#f0d878" stroke="#c8a840" />
      })}
      <g fontFamily={FONT} fontSize="5" fill="#f8f8f8">
        <text x="4" y="9">← KNEE</text>
        <text x="166" y="9">FOOT →</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function LandmarkStage({ run, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  return (
    <>
      <p className="io-lede">Feel the medial malleolus. Mark where the great saphenous vein will be.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 150"
        testId="cutdown-landmark"
        onDown={(p) => {
          upd({ mark: p })
          sfx.cursor()
          const d = Math.hypot(p.x - LANDMARK.x, p.y - LANDMARK.y) / 10
          if (d <= 0.8) feel('Marked a finger-breadth in front of and above the medial malleolus.')
          else if (Math.hypot(p.x - MALLEOLUS.x, p.y - MALLEOLUS.y) < 12) why('That is on the malleolus itself. The vein runs in front of and above it.')
          else why(`About ${d.toFixed(1)} cm away from where the vein runs: 1–2 cm in front of and above the malleolus.`)
        }}
      >
        <Ankle run={run} svgRef={svg} />
      </TouchPad>
      <NextButton onClick={next} testId="cutdown-next">
        Prepare
      </NextButton>
    </>
  )
}

function PrepareStage({ run, upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const c = run.mark ?? LANDMARK
  const rub = useRub({ cx: c.x, cy: c.y, rx: 34, ry: 26 })
  const btn = (key: 'local' | 'tourniquet', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`cutdown-${key}`} onClick={() => (upd({ [key]: true } as Partial<CutdownRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Clean around the mark. He groans to pain: local anaesthetic. A venous tourniquet above the ankle.</p>
      <TouchPad svg={svg} aspect="200 / 150" testId="cutdown-clean" onDown={(p) => rub.rub(p)} onMove={(p) => (rub.rub(p), upd({ cleaned: rub.coverage }))}>
        <Ankle run={run} svgRef={svg}>
          <RubTint rub={rub} />
        </Ankle>
      </TouchPad>
      <div className="io-choices mt-2">
        {btn('local', '1% LIDOCAINE ACROSS THE LINE', 'A wheal of lidocaine along the line of the incision.')}
        {btn('tourniquet', 'VENOUS TOURNIQUET ABOVE', 'Tourniquet on above the ankle: the vein fills a little under the skin.')}
      </div>
      <NextButton onClick={next} testId="cutdown-next">
        Incise
      </NextButton>
    </>
  )
}

function InciseStage({ run, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const start = useRef<Pt | null>(null)
  const [line, setLine] = useState<{ from: Pt; to: Pt } | null>(run.incision)
  const [deep, setDeep] = useState(false)
  return (
    <>
      <p className="io-lede">Choose your depth, then draw the incision with the scalpel across the mark.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={!deep || undefined} data-testid="cutdown-skin" onClick={() => setDeep(false)}>
          THROUGH THE SKIN ONLY
        </button>
        <button type="button" className="tap io-mini" data-on={deep || undefined} data-testid="cutdown-deep" onClick={() => setDeep(true)}>
          ONE DEEP CUT DOWN TO BONE
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="200 / 150"
        className="mt-2"
        testId="cutdown-incise"
        onDown={(p) => (start.current = p)}
        onMove={(p) => start.current && setLine({ from: start.current, to: p })}
        onUp={(p) => {
          const s = start.current
          start.current = null
          if (!s || !p || Math.hypot(p.x - s.x, p.y - s.y) < 5) return
          const t = judgeIncision(s, p)
          const transected = deep && t.crosses
          upd({ incision: { from: s, to: p }, deep, transected })
          setLine({ from: s, to: p })
          if (transected) {
            buzz([60, 40, 60])
            physical('Dark blood wells up: the deep cut went straight through the vein.')
            return why('Skin only, then blunt dissection. A deep cut transects the vein and the nerve.')
          }
          if (t.angle < 45) why('That runs along the vein: a transverse incision across it exposes more of it and spares the nerve.')
          else if (!t.crosses) why('The incision has to cross the line of the vein.')
          else if (t.length < 1.8) why('Too short to work in: about 2.5 cm.')
          else feel(`A ${t.length.toFixed(1)} cm transverse incision through the full thickness of the skin; yellow fat bulges up.`)
        }}
      >
        <Ankle run={{ ...run, deep }} svgRef={svg} cut={line} />
      </TouchPad>
      <NextButton onClick={next} testId="cutdown-next">
        Dissect
      </NextButton>
    </>
  )
}

function FieldStage({ run, runRef, upd, feel, physical, why, next, fat, setFat, stage }: Stage & { stage: number }) {
  const svg = useRef<SVGSVGElement>(null)
  const last = useRef<Pt | null>(null)
  const start = useRef<Pt | null>(null)
  const announced = useRef(run.spread >= 0.6)
  const [nick, setNick] = useState<number | null>(run.venotomy)
  const [cannulaDir, setCannulaDir] = useState<'proximal' | 'distal' | null>(run.cannula)
  const titles: Record<number, string> = {
    3: 'Spread the fat with the curved haemostat: drag in the line of the vein. Then tap the vein to lift it.',
    4: 'Tap under the vein toward the foot and toward the knee to pass two ligatures. Tap one to tie it.',
    5: 'Drag a small nick across the vein. Then drag the cannula into it, toward the heart. Tie it in.',
    6: 'Close the skin around it and dress it.',
  }

  function spread(p: Pt) {
    const prev = last.current
    last.current = p
    if (!prev) return
    const dx = Math.abs(p.x - prev.x)
    const dy = Math.abs(p.y - prev.y)
    const c = Math.max(0, Math.min(FAT_COLS - 1, Math.round((p.x - 10) / 20)))
    const row = Math.max(0, Math.min(FAT_ROWS - 1, Math.round((p.y - 24) / 18)))
    const k = row * FAT_COLS + c
    if (!fat.has(k)) {
      const nf = new Set(fat)
      nf.add(k)
      setFat(nf)
      upd((r) => ({ spread: Math.min(1, nf.size / (FAT_COLS * FAT_ROWS * 0.8)), spreadAcross: r.spreadAcross + (dy > dx ? 1 : 0) }))
    }
  }

  function tap(p: Pt) {
    const cur = runRef.current
    if (stage === 3) {
      const s = structureAt(p, cur.spread)
      if (s === 'fat') return feel(cur.spread < 0.6 ? 'Still fat. Keep spreading.' : 'Fat. The vein is the blue tube.')
      if (s === 'nerve') {
        upd({ liftedNerve: true })
        physical('You hook up a thin white strand: it is solid and does not fill. The saphenous nerve. Let it go.')
        return
      }
      upd({ lifted: 'vein' })
      sfx.select()
      return feel('The haemostat slides under the blue, filling vein and lifts it into the wound.')
    }
    if (stage === 4) {
      if (cur.lifted !== 'vein') return feel('Lift the vein first.')
      const which: Ligature = p.x > 100 ? 'distal' : 'proximal'
      if (!cur.ligatures.includes(which)) {
        upd({ ligatures: [...cur.ligatures, which] })
        return feel(`A ligature passed under the vein, ${which === 'distal' ? 'toward the foot' : 'toward the knee'}.`)
      }
      if (cur.tied.includes(which)) return
      if (which === 'proximal' && cur.cannula === null) {
        upd({ tied: [...cur.tied, 'proximal'], tiedProximalEarly: true })
        physical('Tied: the vein above is now closed off.')
        return why('Tie the proximal ligature around the cannula, after it is in. Now nothing can pass.')
      }
      upd({ tied: [...cur.tied, which] })
      return feel(which === 'distal' ? 'Distal ligature tied and left long: gentle traction on it steadies the vein.' : 'Tied.')
    }
  }

  return (
    <>
      <p className="io-lede">{titles[stage]}</p>
      <TouchPad
        svg={svg}
        aspect="200 / 120"
        testId="cutdown-work"
        onDown={(p) => {
          last.current = p
          start.current = p
          if (stage === 3 && runRef.current.spread >= 0.6) tap(p)
          else if (stage === 4) tap(p)
        }}
        onMove={(p) => {
          if (stage === 3 && runRef.current.spread < 0.6) spread(p)
          if (stage === 5 && start.current) {
            const s = start.current
            if (runRef.current.venotomy === null || runRef.current.transected) {
              const across = Math.max(0, Math.min(1.2, Math.abs(p.y - s.y) / (FIELD.veinR * 2)))
              setNick(across)
            }
          }
        }}
        onUp={(p) => {
          const s = start.current
          start.current = null
          last.current = null
          if (stage === 3 && runRef.current.spread >= 0.6 && !announced.current) {
            announced.current = true
            feel('The fat is spread: a blue vein, and a thin white strand beside it.')
          }
          if (stage !== 5 || !s || !p) return
          const cur = runRef.current
          if (cur.venotomy === null) {
            if (cur.lifted !== 'vein') return feel('Lift the vein first.')
            const v = Math.min(1.2, Math.abs(p.y - s.y) / (FIELD.veinR * 2))
            if (v < 0.1) return
            upd({ venotomy: v, transected: cur.transected || v >= 1 })
            if (v >= 1) {
              buzz([60, 40, 60])
              physical('The vein falls apart in two and the ends retract.')
              return why('A small transverse nick, a third of the way across: not through it.')
            }
            if (v > 0.55) return why('That is a big hole: the vein may tear as the cannula goes in.')
            return feel('A small transverse venotomy; dark blood wells from it.')
          }
          if (!cur.cannula) {
            const dir = p.x < s.x ? 'proximal' : 'distal'
            setCannulaDir(dir)
            upd({ cannula: dir })
            sfx.select()
            if (dir === 'distal') return why('Toward the foot the fluid goes nowhere. Toward the knee, toward the heart.')
            return feel('The cannula slides into the vein toward the knee; blood flashes back.')
          }
        }}
      >
        <Field run={run} fat={fat} svgRef={svg} nick={nick} cannulaDir={cannulaDir} />
      </TouchPad>
      {stage === 5 && (
        <div className="io-choices mt-2">
          <button type="button" className="tap io-mini" data-on={run.secured || undefined} data-testid="cutdown-secure" onClick={() => (run.cannula ? (upd({ secured: true, tied: run.tied.includes('proximal') ? run.tied : [...run.tied, 'proximal'] }), feel('The proximal ligature tied snugly over the vein and the cannula.')) : feel('Cannula first.'))}>
            {run.secured ? 'TIED IN ✓' : 'TIE THE PROXIMAL LIGATURE OVER IT'}
          </button>
          <button type="button" className="tap io-mini" data-on={run.fluids || undefined} data-testid="cutdown-fluids" onClick={() => (upd({ fluids: true }), feel(run.released ? 'Fluids connected: running freely.' : 'Fluids connected… not running. Something above is squeezing the vein.'))}>
            {run.fluids ? 'FLUIDS ✓' : 'CONNECT WARMED FLUIDS'}
          </button>
          <button type="button" className="tap io-mini" data-on={run.released || undefined} data-testid="cutdown-release" onClick={() => (upd({ released: true }), feel(run.fluids ? 'Tourniquet off: the drip runs freely.' : 'Tourniquet off.'))}>
            {run.released ? 'TOURNIQUET OFF ✓' : 'RELEASE THE TOURNIQUET'}
          </button>
        </div>
      )}
      {stage === 6 && (
        <div className="io-choices mt-2">
          <button type="button" className="tap io-mini" data-on={run.closed || undefined} data-testid="cutdown-close" onClick={() => (upd({ closed: true }), feel('Interrupted sutures close the skin around the cannula.'))}>
            {run.closed ? 'CLOSED ✓' : 'CLOSE THE SKIN'}
          </button>
          <button type="button" className="tap io-mini" data-on={run.dressed || undefined} data-testid="cutdown-dress" onClick={() => (upd({ dressed: true }), feel('Dressed, the line looped and taped.'))}>
            {run.dressed ? 'DRESSED ✓' : 'DRESS AND SECURE THE LINE'}
          </button>
        </div>
      )}
      <NextButton onClick={next} testId="cutdown-next">
        {stage === 6 ? 'Finish' : TITLES[stage + 1]}
      </NextButton>
    </>
  )
}
