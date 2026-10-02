import { useRef, useState, type ReactNode, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, RubTint, Syringe, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { BONE, DIGITAL_MARKS, MAX_ML, NERVES, SECTION, SHEATH, checkDigital, freshDigital, injectHere, spotAt, tipFeels, totalMl, type Ampoule, type DigitalRun, type Side, type Spot } from './model'

const TITLES = ['Check', 'Draw up', 'Clean', 'Inject', 'Wait']
const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<DigitalRun> & { next: () => void }

/**
 * A digital block of the right middle finger by hand: baseline sensation and refill, draw up, clean, then on each
 * side go in dorsally at the web space, inject by the dorsal nerve, advance palmar, aspirate and inject by the
 * palmar nerve. Wait, and prick the tip.
 */
export function DigitalProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshDigital, coach)
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
    const { marks, faults } = benchMarks(checkDigital(r), DIGITAL_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: `Digital block: ${totalMl(r).toFixed(1)} mL; the tip is ${tipFeels(r) === 'numb' ? 'numb' : tipFeels(r) === 'half' ? 'numb on one side only' : 'still sharp'}.` })
  }
  const stage: Stage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="digital-bench">
      <div className="hare-bar">
        <span>MR WU · R MIDDLE FINGER</span>
        <span />
        <span>
          {totalMl(api.run).toFixed(1)}/{MAX_ML - 1} ML
        </span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkDigital(api.run)} onContinue={finish} testId="digital-check" />
        ) : (
          <>
            {index === 0 && <CheckStage {...stage} />}
            {index === 1 && <DrawStage {...stage} />}
            {index === 2 && <CleanStage {...stage} />}
            {index === 3 && <InjectStage {...stage} />}
            {index === 4 && <WaitStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

/** Index, middle and ring fingers from the back, the hand palm down: radial (index) on your left. */
const WEB: Record<Side, Pt> = { radial: { x: 79, y: 104 }, ulnar: { x: 121, y: 104 } }

function Fingers({ svgRef, needle, children }: { svgRef?: Ref<SVGSVGElement>; needle?: Pt | null; children?: ReactNode }) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 170" className="block h-full w-full select-none" data-testid="digital-fingers">
      <rect width="200" height="170" fill="#eef2f4" />
      <rect x="30" y="110" width="140" height="60" rx="10" fill={SKIN} stroke={SKIN_EDGE} />
      {[58, 100, 142].map((x) => (
        <g key={x}>
          <rect x={x - 17} y={x === 100 ? 6 : 20} width="34" height={x === 100 ? 112 : 98} rx="16" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
          <rect x={x - 10} y={x === 100 ? 12 : 26} width="20" height="20" rx="4" fill={x === 100 ? '#3a1a2a' : '#f0c8c0'} stroke={SKIN_EDGE} strokeWidth="0.8" />
          <path d={`M${x - 10} ${(x === 100 ? 6 : 20) + 62} Q${x} ${(x === 100 ? 6 : 20) + 66} ${x + 10} ${(x === 100 ? 6 : 20) + 62}`} stroke={SKIN_EDGE} fill="none" opacity="0.5" />
        </g>
      ))}
      {/* the crushed tip: purple nail, a cut at the nail fold */}
      <path d="M90 34 L110 30" stroke="#a02020" strokeWidth="1.5" />
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">R HAND · BACK</text>
        <text x="40" y="166">INDEX</text>
        <text x="132" y="166">RING</text>
      </g>
      {needle && (
        <g>
          <line x1={needle.x} y1={needle.y} x2={needle.x + (needle.x < 100 ? -16 : 16)} y2={needle.y - 22} stroke="#8890a0" strokeWidth="1.6" />
          <rect x={needle.x + (needle.x < 100 ? -22 : 12)} y={needle.y - 32} width="10" height="12" fill="#f09040" stroke="#505868" />
        </g>
      )}
      {children}
    </svg>
  )
}

function Section({ svgRef, side, tip, pools }: { svgRef?: Ref<SVGSVGElement>; side: Side | null; tip: Pt | null; pools: DigitalRun['ml'] }) {
  const entryX = side === 'ulnar' ? 160 : 0
  return (
    <svg ref={svgRef} viewBox="0 0 160 160" className="block h-full w-full select-none" data-testid="digital-section">
      <rect width="160" height="160" fill="#eef2f4" />
      <circle cx={SECTION.cx} cy={SECTION.cy} r={SECTION.r} fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      <ellipse cx="80" cy="26" rx="12" ry="4" fill="#f4f4f0" stroke="#9a9078" />
      <circle cx={BONE.x} cy={BONE.y} r={BONE.r} fill="#f4f0e2" stroke="#9a9078" />
      <circle cx={SHEATH.x} cy={SHEATH.y} r={SHEATH.r} fill="#f0ece0" stroke="#9a9078" />
      {(['radial', 'ulnar'] as Side[]).map((s) => (
        <g key={s}>
          {/* local anaesthetic spreading around each nerve */}
          <circle cx={NERVES[s].dorsal.x} cy={NERVES[s].dorsal.y} r={4 + pools[s].dorsal * 7} fill="#cfe4ff" opacity="0.7" />
          <circle cx={NERVES[s].palmar.x} cy={NERVES[s].palmar.y} r={4 + pools[s].palmar * 5} fill="#cfe4ff" opacity="0.7" />
          <circle cx={NERVES[s].dorsal.x} cy={NERVES[s].dorsal.y} r="3" fill="#f8e050" stroke="#8a7020" />
          <circle cx={NERVES[s].palmar.x} cy={NERVES[s].palmar.y} r="4" fill="#f8e050" stroke="#8a7020" />
          <circle cx={NERVES[s].artery.x} cy={NERVES[s].artery.y} r="3.5" fill="#d03030" />
        </g>
      ))}
      {tip && side && (
        <g>
          <line x1={entryX} y1="44" x2={tip.x} y2={tip.y} stroke="#8890a0" strokeWidth="1.8" />
          <circle cx={tip.x} cy={tip.y} r="1.8" fill="#505868" />
        </g>
      )}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">FINGER BASE · SECTION</text>
        <text x="4" y="156">RADIAL</text>
        <text x="122" y="156">ULNAR</text>
        <text x="70" y="10">DORSUM</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function CheckStage({ run, upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const btn = (key: 'consent' | 'vascularAsked', text: string, line: string) => (
    <button type="button" className="tap io-mini" data-on={run[key] || undefined} data-testid={`digital-${key}`} onClick={() => (upd({ [key]: true } as Partial<DigitalRun>), feel(line))}>
      {run[key] ? `${text} ✓` : text}
    </button>
  )
  return (
    <>
      <p className="io-lede">Consent and allergies. Then test the fingertip before it goes numb: two-point discrimination on the pulp, refill at the nail.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 170"
        className="mx-auto max-w-[260px]"
        testId="digital-check-tip"
        onDown={(p) => {
          if (Math.abs(p.x - 100) > 18 || p.y > 80) return feel('Test the injured middle finger, at its tip.')
          if (p.y < 34) {
            upd({ crt: true })
            return feel('The nail is purple with blood under it. Refill at the skin beside it: under 2 seconds.')
          }
          upd({ twoPoint: true })
          feel('Two points 4 mm apart, felt as two on both sides of the pulp.')
        }}
      >
        <Fingers svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        {btn('consent', 'EXPLAIN, CONSENT, ALLERGIES', '"Yes, go ahead. No allergies."')}
        {btn('vascularAsked', '“ANY RAYNAUD’S OR CIRCULATION PROBLEMS?”', '"No, nothing like that."')}
      </div>
      <NextButton onClick={next} testId="digital-next">
        Draw up
      </NextButton>
    </>
  )
}

function DrawStage({ run, runRef, upd, feel, why, next }: Stage) {
  const amps: { id: Ampoule; label: string }[] = [
    { id: 'plain1', label: 'LIDOCAINE 1% PLAIN' },
    { id: 'adr1', label: 'LIDOCAINE 1% WITH ADRENALINE' },
    { id: 'plain2', label: 'LIDOCAINE 2% PLAIN' },
  ]
  return (
    <>
      <p className="io-lede">A 25 G needle on a 5 mL syringe. Choose the ampoule and draw up what you need.</p>
      <div className="io-choices">
        {amps.map((a) => (
          <button
            key={a.id}
            type="button"
            className="tap io-mini"
            data-on={run.ampoule === a.id || undefined}
            data-testid={`digital-amp-${a.id}`}
            onClick={() => {
              upd({ ampoule: a.id })
              feel(a.id === 'adr1' ? 'Lidocaine 1% with adrenaline: safe in a healthy finger, and it keeps the field dry.' : a.id === 'plain2' ? 'Lidocaine 2% plain.' : 'Lidocaine 1% plain.')
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <Syringe
        capacity={10}
        drug={run.drawn}
        drugLabel="lidocaine"
        testId="digital-draw"
        onPull={(ml) => {
          if (!runRef.current.ampoule) return { kind: 'none' }
          upd((c) => ({ drawn: Math.min(10, c.drawn + ml) }))
          return { kind: 'fluid' }
        }}
        onInject={(ml) => {
          upd((c) => ({ drawn: Math.max(0, c.drawn - ml) }))
          return true
        }}
        onRelease={() => {
          const c = upd((x) => ({ drawn: Math.round(x.drawn * 2) / 2 }))
          if (!c.ampoule) return feel('Pick an ampoule first.')
          if (c.drawn > MAX_ML - 1) why(`You will not need ${c.drawn} mL: about 4–5 mL for the whole finger.`)
          else feel(`${c.drawn} mL drawn up.`)
        }}
      />
      <NextButton onClick={next} testId="digital-next">
        Clean
      </NextButton>
    </>
  )
}

function CleanStage({ upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const rub = useRub({ cx: 100, cy: 108, rx: 44, ry: 22 })
  const said = useRef(false)
  return (
    <>
      <p className="io-lede">Rub chlorhexidine over the base of the finger and both web spaces.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 170"
        className="mx-auto max-w-[260px]"
        testId="digital-clean"
        onDown={(p) => rub.rub(p)}
        onMove={(p) => {
          rub.rub(p)
          upd({ cleaned: rub.coverage })
          if (rub.coverage >= 0.7 && !said.current) {
            said.current = true
            feel('Base of the finger and both web spaces clean.')
          }
        }}
      >
        <Fingers svgRef={svg}>
          <RubTint rub={rub} />
        </Fingers>
      </TouchPad>
      <NextButton onClick={next} testId="digital-next">
        Inject
      </NextButton>
    </>
  )
}

const SPOT_FEEL: Partial<Record<Spot, string>> = {
  dorsal: 'The tip lies beside the dorsal digital nerve.',
  palmar: 'Advanced toward the palm: the tip lies beside the palmar digital nerve.',
  tissue: 'The tip is in the soft tissue beside the bone.',
}

function InjectStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const hand = useRef<SVGSVGElement>(null)
  const sec = useRef<SVGSVGElement>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [needle, setNeedle] = useState<Pt | null>(null)
  const pushed = useRef(false)
  const r = run
  const left = Math.max(0, r.drawn - totalMl(r))
  function steer(p: Pt) {
    const cur = runRef.current
    if (!cur.side) return feel('Put the needle in at a web space first, on the hand above.')
    const spot = spotAt(p, cur.side)
    if (spot === 'outside') return
    const changed = spot !== cur.spot
    upd({ tip: p, spot, aspiratedHere: changed ? false : cur.aspiratedHere, arteryHit: cur.arteryHit || spot === 'artery' })
    if (!changed) return
    setFlash(null)
    if (spot === 'bone') physical('The tip is on the phalanx. Withdraw a little.')
    else if (spot === 'sheath') physical('Into the flexor sheath: not where you want this.')
    else if (spot === 'artery') physical('A flash of bright blood in the hub: the digital artery.')
    else if (SPOT_FEEL[spot]) feel(SPOT_FEEL[spot]!)
  }
  return (
    <>
      <p className="io-lede">Tap a web space on the hand to go in dorsally. Then drag the tip on the section: by the dorsal nerve first, then advance toward the palm. Aspirate, inject. Then the other side.</p>
      <TouchPad
        svg={hand}
        aspect="200 / 170"
        className="mx-auto max-w-[220px]"
        testId="digital-entry"
        onDown={(p) => {
          const side: Side = p.x < 100 ? 'radial' : 'ulnar'
          const nearWeb = Math.hypot(p.x - WEB[side].x, p.y - WEB[side].y) <= 14
          const site = nearWeb ? 'web' : p.y > 118 ? 'knuckle' : 'finger'
          setNeedle(p)
          setFlash(null)
          upd((c) => ({ side, entries: [...c.entries, { side, site }], tip: null, spot: null, aspiratedHere: false }))
          sfx.cursor()
          if (site === 'web') feel(`Needle in dorsally at the ${side} web space, beside the base of the finger.`)
          else if (site === 'knuckle') why('That is over the knuckle. The web space beside the base of the finger is softer and closer to the nerves.')
          else why('That is into the finger itself. Go in at the web space, at the base.')
        }}
      >
        <Fingers svgRef={hand} needle={needle} />
      </TouchPad>
      <TouchPad svg={sec} aspect="1 / 1" className="mx-auto mt-2 max-w-[240px]" testId="digital-steer" onDown={steer} onMove={steer}>
        <Section svgRef={sec} side={r.side} tip={r.tip} pools={r.ml} />
      </TouchPad>
      <Syringe
        capacity={10}
        drug={left}
        drugLabel="lidocaine"
        flash={flash}
        disabled={!r.tip}
        testId="digital-syringe"
        onPull={() => {
          const cur = runRef.current
          upd({ aspiratedHere: true })
          if (cur.spot === 'artery') {
            setFlash('#e02020')
            physical('Bright red blood: you are in the digital artery. Withdraw.')
            return { kind: 'blood' }
          }
          feel('Negative aspiration.')
          return { kind: 'none' }
        }}
        onInject={(ml) => {
          const cur = runRef.current
          if (cur.spot === 'bone' || cur.spot === 'sheath') {
            physical('It will not go: high resistance. Withdraw a little.')
            return false
          }
          const res = injectHere(cur, ml)
          if (!res.ok) return false
          pushed.current = true
          if (!cur.aspiratedHere && cur.unaspirated === 0) why('Aspirate before you inject: the digital artery is right beside the palmar nerve.')
          upd(res.patch)
          if (totalMl(runRef.current) > MAX_ML) {
            buzz(40)
            physical('The finger is tense and pale with fluid.')
          }
          return true
        }}
        onRelease={() => {
          if (!pushed.current) return
          pushed.current = false
          const cur = upd((x) => ({ ml: { radial: round(x.ml.radial), ulnar: round(x.ml.ulnar) } }))
          if (cur.side && cur.spot === 'dorsal') feel(`A small bleb over the dorsal nerve (${cur.ml[cur.side].dorsal.toFixed(1)} mL).`)
          if (cur.side && cur.spot === 'palmar') feel(`The palmar side of the finger base swells slightly (${cur.ml[cur.side].palmar.toFixed(1)} mL).`)
        }}
      />
      <NextButton onClick={next} testId="digital-next">
        Wait
      </NextButton>
    </>
  )
}

const round = (s: DigitalRun['ml']['radial']) => ({ dorsal: Math.round(s.dorsal * 10) / 10, palmar: Math.round(s.palmar * 10) / 10, other: Math.round(s.other * 10) / 10 })

function WaitStage({ run, upd, feel, physical, next }: Stage) {
  const since = run.blockAt === null ? null : run.minutes - run.blockAt
  return (
    <>
      <p className="io-lede">Wait, then prick the tip before you start on the nail bed.</p>
      <div className="hare-bar">
        <span>⏱ {since === null ? 'NO BLOCK' : `${since} MIN SINCE THE BLOCK`}</span>
        <span />
        <span>5–10 MIN</span>
      </div>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-testid="digital-wait" onClick={() => (upd((c) => ({ minutes: c.minutes + 1 })), feel('A minute passes.'))}>
          WAIT A MINUTE
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="digital-test"
          onClick={() => {
            upd({ tested: true })
            const t = tipFeels(run)
            if (t === 'numb') feel('A pin at the tip, both sides: "I can\'t feel that at all."')
            else if (t === 'half') physical('"I can feel it on one side." One side is not blocked.')
            else physical('"Ow, that\'s sharp!"')
          }}
        >
          PRICK THE FINGERTIP
        </button>
      </div>
      <NextButton onClick={next} testId="digital-next">
        Finish
      </NextButton>
    </>
  )
}
