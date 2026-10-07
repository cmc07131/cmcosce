import { useRef, useState, type ReactNode, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, Syringe, TouchPad, benchMarks, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { BLEED, CLOTS, NOSE_MARKS, NOSTRIL, SIDE, checkNose, freshNose, ringSectors, tamponAt, type NoseRun, type Posture } from './model'

const TITLES = ['First aid', 'Look', 'Cautery', 'Pack', 'Check']
const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<NoseRun> & { next: () => void }

/**
 * Epistaxis by hand: sit him forward and pinch the soft nose, then light, suction, spray and speculum to find the
 * vessel in Little's area; ring it with silver nitrate; when it restarts, lubricate and slide a tampon along the
 * floor of the nose, expand it, look at the throat, tape the string.
 */
export function NoseProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshNose, coach)
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
    const { marks, faults } = benchMarks(checkNose(r), NOSE_MARKS, job.grantMarks)
    const packed = !!r.tampon && r.salineMl >= 8
    onDone({ marks, faults, summary: `Epistaxis: cautery ${ringSectors(r.dabs) >= 6 ? 'ringed the vessel' : 'incomplete'}; ${packed ? 'left anterior pack in and expanded' : 'not packed'}.`, scene: packed ? [job.scene || 'packed'] : ['still-bleeding'] })
  }
  const stage: Stage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="nose-bench">
      <div className="hare-bar">
        <span>MR LUI · L EPISTAXIS</span>
        <span />
        <span>APIXABAN</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkNose(api.run)} onContinue={finish} testId="nose-check" />
        ) : (
          <>
            {index === 0 && <FirstAidStage {...stage} />}
            {(index === 1 || index === 2) && <LookStage {...stage} cautery={index === 2} />}
            {index === 3 && <PackStage {...stage} />}
            {index === 4 && <CheckStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

const TILT: Record<Posture, number> = { forward: 22, upright: 0, back: -28 }

function Profile({ svgRef, tilt, pinch }: { svgRef?: Ref<SVGSVGElement>; tilt: number; pinch: 'soft' | 'bony' | null }) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 160" className="block h-full w-full select-none" data-testid="nose-profile">
      <rect width="200" height="160" fill="#eef2f4" />
      <path d="M40 160 L60 112 L120 112 L140 160 Z" fill="#7aa0c8" stroke="#40608a" />
      <g transform={`rotate(${tilt} 92 112)`}>
        <rect x="80" y="96" width="24" height="20" fill={SKIN} stroke={SKIN_EDGE} />
        <ellipse cx="92" cy="62" rx="38" ry="44" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
        <path d="M60 24 Q92 6 128 28 L124 40 Q92 28 62 42 Z" fill="#303030" />
        {/* the nose: bony bridge above, soft cartilage below */}
        <path d="M128 48 L146 76 Q148 82 140 82 L128 80" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
        <line x1="132" y1="54" x2="138" y2="64" stroke={SKIN_EDGE} strokeDasharray="1.5 1.5" />
        <circle cx="112" cy="56" r="2.5" fill="#303030" />
        <path d="M118 92 Q126 94 130 90" stroke="#a04040" strokeWidth="2" fill="none" />
        {/* blood */}
        <path d={tilt < -10 ? 'M132 82 Q120 84 112 92' : 'M138 82 L138 98'} stroke="#c02020" strokeWidth="2" />
        {pinch && (
          <g>
            <ellipse cx={pinch === 'soft' ? 142 : 134} cy={pinch === 'soft' ? 74 : 56} rx="7" ry="4" fill="#c89070" stroke="#6a3a20" />
          </g>
        )}
      </g>
      <text x="4" y="10" fontFamily={FONT} fontSize="5" fill="#40404c">
        MR LUI · PROFILE
      </text>
    </svg>
  )
}

function Nostril({ run, svgRef, children }: { run: NoseRun; svgRef?: Ref<SVGSVGElement>; children?: ReactNode }) {
  const lit = run.light
  const r = run.speculum ? NOSTRIL.r : NOSTRIL.r * 0.55
  return (
    <svg ref={svgRef} viewBox="0 0 160 160" className="block h-full w-full select-none" data-testid="nose-nostril">
      <rect width="160" height="160" fill="#20181a" />
      <clipPath id="nostril-clip">
        <ellipse cx={NOSTRIL.cx} cy={NOSTRIL.cy} rx={r * 0.8} ry={r} />
      </clipPath>
      <g clipPath="url(#nostril-clip)" opacity={lit ? 1 : 0.18}>
        <rect width="160" height="160" fill={run.spray ? '#e8a8a8' : '#d87878'} />
        {/* septum on your left, inferior turbinate on your right */}
        <rect x="18" y="0" width="30" height="160" fill={run.spray ? '#f0b8b8' : '#e08888'} />
        <ellipse cx="128" cy="100" rx="26" ry="34" fill={run.spray ? '#e0a0a0' : '#c86868'} />
        <circle cx={BLEED.x} cy={BLEED.y} r="3" fill="#b01010">
          <animate attributeName="r" values="2.5;4;2.5" dur="0.9s" repeatCount="indefinite" />
        </circle>
        <path d={`M${BLEED.x} ${BLEED.y} Q${BLEED.x + 4} ${BLEED.y + 16} ${BLEED.x + 2} 160`} stroke="#b01010" strokeWidth="2.5" fill="none" />
        {run.clots.map((i) => (
          <ellipse key={i} cx={CLOTS[i].x} cy={CLOTS[i].y} rx="13" ry="10" fill="#4a0a0a" />
        ))}
        {run.dabs.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="2.6" fill="#606060" opacity="0.85" />
        ))}
      </g>
      {run.speculum && (
        <g fill="#c0c8d0" stroke="#505860">
          <path d={`M${NOSTRIL.cx - 30} 4 L${NOSTRIL.cx - 8} 24 L${NOSTRIL.cx + 8} 24 L${NOSTRIL.cx + 30} 4 Z`} />
          <path d={`M${NOSTRIL.cx - 30} 156 L${NOSTRIL.cx - 8} 136 L${NOSTRIL.cx + 8} 136 L${NOSTRIL.cx + 30} 156 Z`} />
        </g>
      )}
      <g fontFamily={FONT} fontSize="5" fill="#c0c8d0">
        <text x="4" y="10">L NOSTRIL</text>
        <text x="4" y="154">SEPTUM</text>
        <text x="118" y="154">LATERAL</text>
      </g>
      {children}
    </svg>
  )
}

function SideView({ svgRef, tip, swollen }: { svgRef?: Ref<SVGSVGElement>; tip: Pt | null; swollen: number }) {
  return (
    <svg ref={svgRef} viewBox="0 0 220 140" className="block h-full w-full select-none" data-testid="nose-side">
      <rect width="220" height="140" fill="#eef2f4" />
      <path d="M8 60 L30 40 L40 96 L200 100 L200 130 L8 130 Z" fill={SKIN} stroke={SKIN_EDGE} />
      {/* skull base and orbit above, hard palate below the floor */}
      <path d="M40 30 L200 26" stroke="#9a9078" strokeWidth="4" />
      <ellipse cx="54" cy="34" rx="14" ry="10" fill="#f4f0e2" stroke="#9a9078" />
      <rect x="40" y="102" width="150" height="8" fill="#f4f0e2" stroke="#9a9078" />
      {[52, 70, 86].map((y, i) => (
        <path key={y} d={`M${70 + i * 6} ${y} Q130 ${y - 10} 190 ${y + 2}`} stroke={SKIN_EDGE} strokeWidth="5" fill="none" opacity="0.4" />
      ))}
      <line x1={SIDE.nostril.x} y1={SIDE.floorY} x2={SIDE.nostril.x + SIDE.depth} y2={SIDE.floorY} stroke="#3060c0" strokeDasharray="2 3" opacity="0.4" />
      {tip && <line x1={SIDE.nostril.x} y1={SIDE.nostril.y} x2={tip.x} y2={tip.y} stroke="#f8f8e8" strokeWidth={5 + swollen * 4} strokeLinecap="round" />}
      {tip && <line x1={SIDE.nostril.x} y1={SIDE.nostril.y} x2={SIDE.nostril.x - 14} y2={SIDE.nostril.y + 14} stroke="#202020" strokeWidth="1" />}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">SIDE VIEW · NOSE ON THE LEFT</text>
        <text x="120" y="20">SKULL BASE</text>
        <text x="100" y="122">HARD PALATE</text>
        <text x="40" y="52">EYE</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function FirstAidStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const grip = useRef<{ y: number; tilt: number } | null>(null)
  const [tilt, setTilt] = useState(0)
  const btn = (key: 'haemo' | 'anticoag' | 'ice', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`nose-${key}`} onClick={() => (upd({ [key]: true } as Partial<NoseRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Drag his head to position him. Tap where you pinch. Hold the pressure; meanwhile his circulation and his tablets.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 160"
        className="mx-auto max-w-[260px]"
        testId="nose-firstaid"
        onDown={(p) => {
          // On the nose: pinch. Elsewhere: take hold of his head.
          if (p.x > 124 && p.y > 40 && p.y < 90) {
            const where = p.y >= 66 ? 'soft' : 'bony'
            upd({ pinch: where })
            if (where === 'soft') feel('Thumb and finger squeeze the soft part of the nose firmly together.')
            else why('That is the bony bridge: pressing there does nothing. Pinch the soft part below it.')
            return
          }
          grip.current = { y: p.y, tilt }
        }}
        onMove={(p) => {
          const g = grip.current
          if (!g) return
          setTilt(Math.max(-30, Math.min(26, g.tilt + (p.y - g.y) * 0.9)))
        }}
        onUp={() => {
          if (!grip.current) return
          grip.current = null
          const posture: Posture = tilt > 12 ? 'forward' : tilt < -12 ? 'back' : 'upright'
          setTilt(TILT[posture])
          upd({ posture })
          if (posture === 'forward') feel('Sitting up, leaning forward: the blood drips out of the nose, not down the throat.')
          else if (posture === 'back') {
            physical('Head back, he coughs and swallows blood.')
            why('Leaning back sends blood down the throat: swallowed, vomited or inhaled. Sit him forward.')
          } else feel('Sitting upright.')
        }}
      >
        <Profile svgRef={svg} tilt={tilt} pinch={run.pinch} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="nose-press"
          onClick={() => {
            const cur = runRef.current
            if (!cur.pinch) return feel('Pinch first.')
            upd({ pressMin: cur.pressMin + 5 })
            feel(cur.pressMin + 5 >= 15 ? 'Fifteen minutes of firm pressure. Released: still oozing.' : `${cur.pressMin + 5} minutes, without letting go to peek.`)
          }}
        >
          HOLD 5 MINUTES ({run.pressMin} MIN)
        </button>
        {btn('ice', 'ICE TO SUCK', 'Ice in his mouth: it constricts the vessels.')}
        {btn('haemo', 'PULSE, BP, FBC, GROUP AND SAVE', 'HR 96, BP 168/94. Hb 128. Group and save sent.')}
        {btn('anticoag', '“WHEN DID YOU LAST TAKE APIXABAN?”', '"This morning, with breakfast."')}
      </div>
      <NextButton onClick={next} testId="nose-next">
        Look
      </NextButton>
    </>
  )
}

function LookStage({ run, runRef, upd, feel, physical, why, next, cautery }: Stage & { cautery: boolean }) {
  const svg = useRef<SVGSVGElement>(null)
  const toggle = (key: 'light' | 'speculum' | 'spray', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`nose-${key}`} onClick={() => (upd({ [key]: true } as Partial<NoseRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  function suck(p: Pt) {
    const cur = runRef.current
    if (!cur.light) return feel('It is dark in there. Headlight on.')
    const hit = cur.clots.filter((i) => Math.hypot(p.x - CLOTS[i].x, p.y - CLOTS[i].y) < 14)
    if (!hit.length) return
    const clots = cur.clots.filter((i) => !hit.includes(i))
    upd({ clots })
    if (!clots.length && cur.speculum) {
      upd({ sawBleed: true })
      feel("Clots cleared. A small vessel pumping on the front of the septum, low down: Little's area.")
    }
  }
  function dab(p: Pt) {
    const cur = runRef.current
    if (Math.hypot(p.x - BLEED.x, p.y - BLEED.y) < 4) {
      upd({ onBleed: cur.onBleed + 1 })
      return why('Straight onto the bleeding point, the nitrate washes away in the blood. Ring it first, then work in.')
    }
    upd({ dabs: [...cur.dabs, p] })
    sfx.cursor()
    const ring = ringSectors([...cur.dabs, p])
    if (ring >= 6 && ringSectors(cur.dabs) < 6) feel('A grey ring of silver nitrate around the vessel. It slows… then restarts, from further back.')
  }
  return (
    <>
      <p className="io-lede">{cautery ? 'Silver nitrate stick: tap around the bleeding point to ring it, ten seconds each touch. One side of the septum only.' : 'Headlight, co-phenylcaine, speculum. Then drag the suction over the clots.'}</p>
      {!cautery && (
        <div className="io-choices">
          {toggle('light', 'HEADLIGHT', 'Headlight on, beam along your line of sight.')}
          {toggle('spray', 'CO-PHENYLCAINE SPRAY', 'Two sprays into the left nostril. The lining blanches and goes numb.')}
          {toggle('speculum', 'THUDICHUM SPECULUM', 'Speculum in, opening the nostril up and down; septum on your left.')}
        </div>
      )}
      <TouchPad
        svg={svg}
        aspect="1 / 1"
        className="mx-auto mt-2 max-w-[260px]"
        testId={cautery ? 'nose-cautery' : 'nose-look'}
        onDown={(p) => (cautery ? dab(p) : suck(p))}
        onMove={(p) => !cautery && suck(p)}
      >
        <Nostril run={run} svgRef={svg} />
      </TouchPad>
      <NextButton onClick={next} testId="nose-next">
        {cautery ? 'Pack' : 'Cautery'}
      </NextButton>
    </>
  )
}

function PackStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<Pt | null>(null)
  const warned = useRef(false)
  const r = run
  return (
    <>
      <p className="io-lede">Tell him, lubricate the 8 cm tampon, then drag it in from the nostril. Expand it with saline.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={r.explained || undefined} data-testid="nose-explain" onClick={() => (upd({ explained: true }), feel('"This will be uncomfortable for a few seconds, and your eye may water. Breathe through your mouth."'))}>
          {r.explained ? 'EXPLAINED ✓' : 'EXPLAIN'}
        </button>
        <button type="button" className="tap io-mini" data-on={r.lubed || undefined} data-testid="nose-lube" onClick={() => (upd({ lubed: true }), feel('Water-based gel along the tampon.'))}>
          {r.lubed ? 'LUBRICATED ✓' : 'LUBRICATE THE TAMPON'}
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="220 / 140"
        className="mt-2"
        testId="nose-pack"
        onDown={(p) => {
          warned.current = false
          setTip(p)
        }}
        onMove={(p) => {
          const t = tamponAt(p)
          const clamped = t.depth > SIDE.depth ? { x: SIDE.nostril.x + Math.cos((t.angle * Math.PI) / 180) * SIDE.depth, y: SIDE.nostril.y - Math.sin((t.angle * Math.PI) / 180) * SIDE.depth } : p
          setTip(clamped)
          const ct = tamponAt(clamped)
          upd((c) => ({ tampon: ct, maxUp: Math.max(c.maxUp, ct.depth > 20 ? ct.angle : 0) }))
          if (ct.depth > 30 && ct.angle > 30 && !warned.current) {
            warned.current = true
            buzz([60, 40, 60])
            physical('It jams high in the nose and he cries out: you are heading up toward the eye and the skull base.')
            why('The nose runs straight back, along the floor, parallel to the hard palate.')
          }
        }}
        onUp={() => {
          const t = runRef.current.tampon
          if (!t || warned.current) return
          if (!runRef.current.lubed) physical('The dry tampon drags on the septum; fresh blood.')
          if (t.depth >= SIDE.depth * 0.85 && Math.abs(t.angle) <= 15) feel('It slides back along the floor of the nose, all the way in. His eyes water.')
          else if (t.depth < SIDE.depth * 0.85) feel('Only part of the way in. All of it goes in.')
        }}
      >
        <SideView svgRef={svg} tip={tip} swollen={Math.min(1, r.salineMl / 10)} />
      </TouchPad>
      <Syringe
        capacity={20}
        drug={20 - r.salineMl}
        drugLabel="saline"
        disabled={!r.tampon}
        testId="nose-saline"
        onPull={() => ({ kind: 'none' })}
        onInject={(ml) => {
          upd((c) => ({ salineMl: c.salineMl + ml }))
          return true
        }}
        onRelease={() => {
          const ml = runRef.current.salineMl
          if (ml >= 8) feel(`${ml.toFixed(0)} mL of saline: the tampon swells and fills the nostril.`)
        }}
      />
      <NextButton onClick={next} testId="nose-next">
        Check
      </NextButton>
    </>
  )
}

function CheckStage({ run, upd, feel, next }: Stage) {
  const btn = (key: 'throat' | 'taped' | 'documented', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`nose-${key}`} onClick={() => (upd({ [key]: true } as Partial<NoseRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Is it still bleeding behind the pack? Then secure it.</p>
      <div className="io-choices">
        {btn('throat', 'TONGUE DEPRESSOR AND LIGHT: THE BACK OF THE THROAT', 'No fresh blood running down the back of the throat.')}
        {btn('taped', 'TAPE THE STRING TO HIS CHEEK', 'The string taped to his cheek.')}
        {btn('documented', 'DOCUMENT', 'Left anterior pack, time inserted, 10 mL saline.')}
      </div>
      <NextButton onClick={next} testId="nose-next">
        Finish
      </NextButton>
    </>
  )
}
