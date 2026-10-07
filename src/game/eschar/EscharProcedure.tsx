import { useRef, useState, type ReactNode, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, TouchPad, benchMarks, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { ARM, CHEST, ESCHAR_MARKS, checkEschar, freshEschar, judgeArmLine, judgeChestLine, released, vent, type ChestLine, type EscharRun } from './model'

const TITLES = ['Prepare', 'Mark', 'Cut', 'Bleeding', 'Recheck', 'Arm']
const ESCHAR = '#4a3a30'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<EscharRun> & { next: () => void; strokes: { line: ChestLine; path: Pt[] }[]; setStrokes: (s: { line: ChestLine; path: Pt[] }[]) => void }

/**
 * Chest and arm escharotomy by hand: prepare, mark both anterior axillary lines and the costal margin, cut through
 * the eschar into fat along each line until the edges spring apart (the airway pressure falls as you go), diathermy
 * the bleeders, recheck the ventilation, then the arm: mid-lateral and mid-medial.
 */
export function EscharProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshEschar, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [strokes, setStrokes] = useState<{ line: ChestLine; path: Pt[] }[]>([])
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
    const { marks, faults } = benchMarks(checkEschar(r), ESCHAR_MARKS, job.grantMarks)
    const scenes: string[] = []
    if (released(r)) scenes.push(job.scene || 'eschar')
    if (r.armLines.includes('lateral') && r.armLines.includes('medial')) scenes.push('arm')
    onDone({ marks, faults, summary: `Escharotomy: chest ${released(r) ? 'released' : 'not released'}; arm ${scenes.includes('arm') ? 'released' : 'not released'}.`, scene: scenes.length ? scenes : ['eschar-tight'] })
  }
  const v = vent(api.run)
  const stage: Stage = { ...api, next, strokes, setStrokes }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="eschar-bench">
      <div className="hare-bar">
        <span>PPEAK {v.peak} · SPO2 {v.spo2}%</span>
        <span />
        <span>ETCO2 {v.etco2.toFixed(1)}</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkEschar(api.run)} onContinue={finish} testId="eschar-check" />
        ) : (
          <>
            {index === 0 && <PrepareStage {...stage} />}
            {(index === 1 || index === 2 || index === 3) && <ChestStage {...stage} stage={index} />}
            {index === 4 && <RecheckStage {...stage} />}
            {index === 5 && <ArmStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

/** Two bleeding points on each cut line, a third and two thirds of the way along. */
function bleederPoints(run: EscharRun, strokes: { line: ChestLine; path: Pt[] }[]) {
  return strokes
    .filter((s) => run.cut.includes(s.line) && s.line !== 'midline')
    .flatMap((s) => [s.path[Math.floor(s.path.length / 3)], s.path[Math.floor((2 * s.path.length) / 3)]])
    .filter(Boolean)
}

function Chest({ run, svgRef, strokes, live, children }: { run: EscharRun; svgRef?: Ref<SVGSVGElement>; strokes: { line: ChestLine; path: Pt[] }[]; live?: Pt[] | null; children?: ReactNode }) {
  const open = released(run) ? 5 : 2
  return (
    <svg ref={svgRef} viewBox="0 0 180 200" className="block h-full w-full select-none" data-testid="eschar-chest">
      <rect width="180" height="200" fill="#e2e8ec" />
      <path d="M10 20 L170 20 L176 190 L4 190 Z" fill={ESCHAR} stroke="#20180f" strokeWidth="1.5" />
      <path d={`M24 ${CHEST.clavicleY} Q90 ${CHEST.clavicleY - 10} 156 ${CHEST.clavicleY}`} stroke="#6a5848" strokeWidth="2" fill="none" />
      <path d={`M20 ${CHEST.costalY} Q90 ${CHEST.costalY - 24} 160 ${CHEST.costalY}`} stroke="#6a5848" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
      {/* the endotracheal tube at the top */}
      <rect x="84" y="0" width="12" height="20" fill="#e8f0f8" stroke="#506070" />
      {strokes.map((s, i) => {
        const isCut = run.cut.includes(s.line)
        return (
          <polyline
            key={i}
            points={s.path.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={isCut ? '#f0d878' : '#5aa0ff'}
            strokeWidth={isCut ? open * 2 : 1.6}
            strokeDasharray={isCut ? undefined : '3 2'}
            strokeLinecap="round"
          />
        )
      })}
      {bleederPoints(run, strokes).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={run.dry.includes(i) ? '#303030' : '#d02020'} data-bleeder={i} />
      ))}
      {live && live.length > 1 && <polyline points={live.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#5aa0ff" strokeWidth="1.6" />}
      <g fontFamily={FONT} fontSize="4.5" fill="#d8c8b8">
        <text x="16" y="16" fill="#40404c">
          CHEST · FULL THICKNESS
        </text>
        <text x={CHEST.aal[0] - 10} y="198" fill="#40404c">
          AAL
        </text>
        <text x={CHEST.aal[1] - 10} y="198" fill="#40404c">
          AAL
        </text>
      </g>
      {children}
    </svg>
  )
}

function Arm({ svgRef, lines, live }: { svgRef?: Ref<SVGSVGElement>; lines: { y: number }[]; live?: Pt[] | null }) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 110" className="block h-full w-full select-none" data-testid="eschar-arm">
      <rect width="200" height="110" fill="#e2e8ec" />
      <path d={`M${ARM.x0} ${ARM.lateralY - 6} L${ARM.x1} ${ARM.lateralY + 2} L${ARM.x1} ${ARM.medialY - 2} L${ARM.x0} ${ARM.medialY + 6} Z`} fill={ESCHAR} stroke="#20180f" />
      <ellipse cx="194" cy="65" rx="8" ry="16" fill="#e8b494" stroke="#8a5238" />
      {lines.map((l, i) => (
        <line key={i} x1={ARM.x0 + 4} y1={l.y} x2={ARM.x1 - 4} y2={l.y} stroke="#f0d878" strokeWidth="5" />
      ))}
      {live && live.length > 1 && <polyline points={live.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#5aa0ff" strokeWidth="1.6" />}
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="10">R ARM · FRONT · THUMB SIDE UP</text>
        <text x="4" y="104">SHOULDER ←  → HAND</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function PrepareStage({ run, upd, feel, next }: Stage) {
  const btn = (key: 'cleaned' | 'kitReady', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`eschar-${key}`} onClick={() => (upd({ [key]: true } as Partial<EscharRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">He is sedated and ventilated, the fentanyl is in. The eschar is hard, grey-brown and leathery all round.</p>
      <div className="io-choices">
        {btn('cleaned', 'CLEAN AND DRAPE', 'Cleaned and draped.')}
        {btn('kitReady', 'DIATHERMY AND A SCALPEL READY', 'Diathermy plugged in, scalpel on the tray.')}
      </div>
      <NextButton onClick={next} testId="eschar-next">
        Mark
      </NextButton>
    </>
  )
}

function ChestStage({ run, runRef, upd, feel, physical, why, next, strokes, setStrokes, stage }: Stage & { stage: number }) {
  const svg = useRef<SVGSVGElement>(null)
  const [live, setLive] = useState<Pt[] | null>(null)
  const pathRef = useRef<Pt[]>([])
  const lede: Record<number, string> = {
    1: 'Draw the lines with the marker: both anterior axillary lines from the clavicle to the costal margin, and the costal margin joining them.',
    2: 'Choose the depth, then cut along each line you marked.',
    3: 'Tap each bleeding point with the diathermy. Then dress the wounds.',
  }
  const [depth, setDepth] = useState<'fat' | 'muscle'>(run.depth ?? 'fat')
  function endStroke() {
    const path = pathRef.current
    pathRef.current = []
    setLive(null)
    if (path.length < 3) return
    const line = judgeChestLine(path)
    if (stage === 1) {
      if (line === 'other') return why('Not one of the lines: the anterior axillary lines run from the clavicle to the costal margin; the transverse one along the costal margin.')
      if (runRef.current.marks.includes(line)) return
      upd((r) => ({ marks: [...r.marks, line] }))
      setStrokes([...strokes, { line, path }])
      if (line === 'midline') why('One midline cut down the sternum does not let the sides of the chest move. Both anterior axillary lines.')
      else feel(line === 'costal' ? 'The transverse line along the costal margin, joining the two.' : 'Marked along the anterior axillary line, clavicle to costal margin.')
      return
    }
    if (stage === 2) {
      const hit = strokes.find((s) => s.line === line)
      if (!hit) return feel('Cut along the lines you marked.')
      if (runRef.current.cut.includes(line)) return
      const before = released(runRef.current)
      const nr = upd((r) => ({ cut: [...r.cut, line], depth, bleeders: r.bleeders + (line === 'midline' ? 0 : 2) }))
      sfx.cursor()
      if (depth === 'muscle') {
        buzz([60, 40, 60])
        physical('Through the fascia into the muscle: brisk bleeding, and no more release than before.')
        return why('Through the eschar into the fat is enough; the edges spring apart.')
      }
      if (!before && released(nr)) feel('As the last cut opens, the edges spring apart. The ventilator alarms stop: the pressure falls and the saturation climbs.')
      else feel('Through the leathery eschar into yellow fat: the edges gape apart.')
    }
  }
  return (
    <>
      <p className="io-lede">{lede[stage]}</p>
      {stage === 2 && (
        <div className="io-choices">
          <button type="button" className="tap io-mini" data-on={depth === 'fat' || undefined} data-testid="eschar-depth-fat" onClick={() => setDepth('fat')}>
            THROUGH THE ESCHAR INTO FAT
          </button>
        </div>
      )}
      <TouchPad
        svg={svg}
        aspect="180 / 200"
        className="mx-auto mt-2 max-w-[280px]"
        testId="eschar-work"
        onDown={(p) => {
          if (stage === 3) {
            const cur = runRef.current
            const i = bleederPoints(cur, strokes).findIndex((b) => Math.hypot(b.x - p.x, b.y - p.y) <= 8)
            if (i < 0) return feel('Find the bleeding points along the cuts.')
            if (cur.dry.includes(i)) return
            upd({ dry: [...cur.dry, i], diathermied: cur.diathermied + 1 })
            sfx.cursor()
            return feel('A buzz of diathermy: that bleeder is dry.')
          }
          pathRef.current = [p]
          setLive([p])
        }}
        onMove={(p) => {
          if (stage === 3) return
          pathRef.current = [...pathRef.current, p]
          setLive(pathRef.current)
        }}
        onUp={() => stage !== 3 && endStroke()}
      >
        <Chest run={run} svgRef={svg} strokes={strokes} live={live} />
      </TouchPad>
      {stage === 3 && (
        <div className="io-choices mt-2">
          <button type="button" className="tap io-mini" data-on={run.dressed || undefined} data-testid="eschar-dress" onClick={() => (upd({ dressed: true }), feel('Alginate packed into the wounds and dressed.'))}>
            {run.dressed ? 'DRESSED ✓' : 'ALGINATE DRESSING'}
          </button>
        </div>
      )}
      <NextButton onClick={next} testId="eschar-next">
        {TITLES[stage + 1]}
      </NextButton>
    </>
  )
}

function RecheckStage({ run, upd, feel, physical, next }: Stage) {
  return (
    <>
      <p className="io-lede">Is it better?</p>
      <div className="io-choices">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.rechecked || undefined}
          data-testid="eschar-recheck"
          onClick={() => {
            upd({ rechecked: true })
            const v = vent(run)
            if (released(run)) feel(`Peak pressure ${v.peak} cmH2O, SpO2 ${v.spo2}%, the chest moving. Better.`)
            else physical(`Peak pressure still ${v.peak} cmH2O, SpO2 ${v.spo2}%. Not released.`)
          }}
        >
          CHECK VENTILATION AND SATURATION
        </button>
      </div>
      <NextButton onClick={next} testId="eschar-next">
        Arm
      </NextButton>
    </>
  )
}

function ArmStage({ run, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [live, setLive] = useState<Pt[] | null>(null)
  const pathRef = useRef<Pt[]>([])
  const ys = { lateral: ARM.lateralY, medial: ARM.medialY, volar: ARM.volarY, other: 0 }
  return (
    <>
      <p className="io-lede">His right hand is cold with no Doppler signal. Draw each incision along the whole length of the eschar.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 110"
        testId="eschar-arm-work"
        onDown={(p) => {
          pathRef.current = [p]
          setLive([p])
        }}
        onMove={(p) => {
          pathRef.current = [...pathRef.current, p]
          setLive(pathRef.current)
        }}
        onUp={() => {
          const line = judgeArmLine(pathRef.current)
          pathRef.current = []
          setLive(null)
          if (line === 'other') return feel('Along the whole length of the eschar, on the mid-lateral or mid-medial line.')
          if (run.armLines.includes(line)) return
          upd((r) => ({ armLines: [...r.armLines, line] }))
          if (line === 'volar') {
            buzz(40)
            physical('Down the front of the forearm: the tendons and the median nerve are right under the cut.')
            why('Mid-lateral and mid-medial lines keep clear of the tendons and nerves.')
          } else feel(line === 'lateral' ? 'Along the mid-lateral (thumb) side, the length of the eschar.' : 'Along the mid-medial (little finger) side; the ulnar nerve at the elbow kept clear.')
        }}
      >
        <Arm svgRef={svg} lines={run.armLines.filter((l) => l !== 'other').map((l) => ({ y: ys[l] }))} live={live} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.armDoppler || undefined} data-testid="eschar-doppler" onClick={() => (upd({ armDoppler: true }), feel(run.armLines.includes('lateral') && run.armLines.includes('medial') ? 'The Doppler signal at the radial artery is back; the hand pinks up.' : 'Still no Doppler signal at the wrist.'))}>
          DOPPLER AT THE WRIST
        </button>
      </div>
      <NextButton onClick={next} testId="eschar-next">
        Finish
      </NextButton>
    </>
  )
}
