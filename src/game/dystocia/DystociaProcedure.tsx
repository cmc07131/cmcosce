import { useEffect, useRef, useState, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, TouchPad, benchMarks, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { DYSTOCIA_MARKS, checkDystocia, excessive, freshDystocia, spSiteAt, type DystociaRun } from './model'

const TITLES = ['McRoberts', 'Suprapubic', 'Internal', 'Deliver']
const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<DystociaRun> & { next: () => void }

/**
 * Shoulder dystocia by hand, against the clock from the head: lie her flat and get the helpers to hyperflex her
 * hips, press suprapubically over the anterior shoulder from the side of the back (continuous, then rocking) with
 * gentle axial traction; when it is still stuck, go in posteriorly for the posterior arm, or rotate.
 */
export function DystociaProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshDystocia, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!api.runRef.current.delivered) api.upd((r) => ({ headToBodyS: r.headToBodyS + 1 }))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  const next = () => {
    sfx.select()
    if (index < TITLES.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const { marks, faults } = benchMarks(checkDystocia(r), DYSTOCIA_MARKS, job.grantMarks)
    if (r.episiotomy) faults.push({ text: 'A routine large episiotomy: it does not free a bony impaction. Use it only to make room for internal manoeuvres.', critical: false })
    if (r.headToBodyS > 300) faults.push({ text: `Head-to-body interval ${Math.round(r.headToBodyS)} s: the risk of hypoxic injury climbs after about five minutes.`, critical: false })
    onDone({ marks, faults, summary: r.delivered ? `Shoulders delivered after ${Math.round(r.headToBodyS)} s.` : 'The shoulders are still stuck.', scene: r.delivered ? [job.scene || 'delivered'] : ['stuck'] })
  }
  const stage: Stage = { ...api, next }
  const t = api.run.headToBodyS
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="dystocia-bench">
      <div className="hare-bar">
        <span>HEAD DELIVERED</span>
        <span className="hare-pain">
          <i style={{ width: `${Math.min(100, (t / 300) * 100)}%` }} />
        </span>
        <span>
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')}
        </span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkDystocia(api.run)} onContinue={finish} testId="dystocia-check" />
        ) : (
          <>
            {index === 0 && <McRobertsStage {...stage} />}
            {index === 1 && <SuprapubicStage {...stage} />}
            {index === 2 && <InternalStage {...stage} />}
            {index === 3 && <DeliverStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

function Side({ svgRef, flex }: { svgRef?: Ref<SVGSVGElement>; flex: number }) {
  // Lying flat, from her left side: the thigh swings up from flat (0) to onto her abdomen (1).
  const angle = -20 - flex * 95
  return (
    <svg ref={svgRef} viewBox="0 0 200 130" className="block h-full w-full select-none" data-testid="dystocia-side">
      <rect width="200" height="130" fill="#e2e8ec" />
      <rect x="0" y="96" width="200" height="8" fill="#a8b4c0" />
      <circle cx="22" cy="80" r="14" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M34 72 L110 66 Q130 54 132 74 L130 96 L34 96 Z" fill="#bcd4e8" stroke="#6a84a0" />
      <g transform={`rotate(${angle} 128 88)`}>
        <rect x="128" y="80" width="58" height="16" rx="7" fill={SKIN} stroke={SKIN_EDGE} />
        <g transform="rotate(100 184 88)">
          <rect x="184" y="80" width="46" height="13" rx="6" fill={SKIN} stroke={SKIN_EDGE} />
        </g>
      </g>
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="10">HER LEFT SIDE · FLAT ON THE BED</text>
        <text x="4" y="124">HIPS {Math.round(flex * 100)}% FLEXED</text>
      </g>
    </svg>
  )
}

function Abdomen({ svgRef, mark }: { svgRef?: Ref<SVGSVGElement>; mark?: Pt | null }) {
  return (
    <svg ref={svgRef} viewBox="0 0 160 140" className="block h-full w-full select-none" data-testid="dystocia-abdo">
      <rect width="160" height="140" fill="#e2e8ec" />
      <ellipse cx="80" cy="66" rx="60" ry="56" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      <path d="M40 116 Q80 104 120 116" stroke={SKIN_EDGE} strokeWidth="2" fill="none" />
      {/* the anterior shoulder caught behind the pubis, and the baby's back to her left */}
      <ellipse cx="96" cy="100" rx="14" ry="6" fill="#d89878" opacity="0.6" />
      <path d="M100 98 Q130 70 118 40" stroke="#c08060" strokeWidth="3" fill="none" opacity="0.5" strokeDasharray="3 3" />
      {mark && <circle cx={mark.x} cy={mark.y} r="8" fill="none" stroke="#3050c0" strokeWidth="2" />}
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="10">ABDOMEN · HER LEFT →</text>
        <text x="60" y="20">FUNDUS</text>
        <text x="68" y="132">PUBIS</text>
        <text x="112" y="62">BACK</text>
      </g>
    </svg>
  )
}

function Internal({ svgRef, hand, elbow, swept }: { svgRef?: Ref<SVGSVGElement>; hand: Pt | null; elbow: boolean; swept: boolean }) {
  return (
    <svg ref={svgRef} viewBox="0 0 180 140" className="block h-full w-full select-none" data-testid="dystocia-internal">
      <rect width="180" height="140" fill="#7a3030" />
      <circle cx="90" cy="34" r="22" fill="#e8b494" stroke="#8a5238" />
      <ellipse cx="90" cy="74" rx="44" ry="22" fill="#e0a888" stroke="#8a5238" />
      <rect x="40" y="10" width="100" height="10" fill="#f4f0e2" stroke="#9a9078" />
      {/* the posterior arm, along the baby's side; once flexed and swept it lies across the chest and out */}
      {!swept ? (
        <path d={elbow ? 'M120 80 L134 100 L110 96' : 'M120 80 L130 104 L132 128'} stroke="#e0a888" strokeWidth="9" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M120 80 L104 90 L80 60 L70 30" stroke="#e0a888" strokeWidth="9" fill="none" strokeLinecap="round" />
      )}
      {hand && <ellipse cx={hand.x} cy={hand.y} rx="10" ry="6" fill="#c89070" stroke="#6a3a20" />}
      <g fontFamily={FONT} fontSize="4.5" fill="#f0d8d8">
        <text x="4" y="8">INSIDE · PUBIS ABOVE, SACRUM BELOW</text>
        <text x="4" y="136">POSTERIOR · ROOM HERE</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function Traction({ upd, feel, physical, why }: Pick<Stage, 'upd' | 'feel' | 'physical' | 'why'>) {
  const angle = 'axial' as 'axial' | 'down'
  return (
    <div className="io-choices mt-2">
      <button
        type="button"
        className="tap io-mini"
        data-testid="dystocia-traction"
        onClick={() => {
          const t = angle === 'axial' ? { angle: 10, force: 0.4 } : { angle: 45, force: 0.9 }
          const cur = upd((r) => ({ tractions: [...r.tractions, t] }))
          if (excessive(t)) {
            buzz([60, 40, 60])
            physical('You pull down on the head. It does not budge; the neck stretches.')
            return why('Only gentle traction in line with the spine. Downward pulling tears the brachial plexus.')
          }
          if (cur.internal) return feel('Gentle axial traction: the shoulders slide out.')
          feel('Gentle axial traction with the next contraction: it does not come.')
        }}
      >
        TRY GENTLE TRACTION
      </button>
    </div>
  )
}

function McRobertsStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const grip = useRef<number | null>(null)
  return (
    <>
      <p className="io-lede">Lie her flat, bring in the two helpers, then drag her thigh up onto her abdomen.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.flatBack || undefined} data-testid="dystocia-flat" onClick={() => (upd({ flatBack: true }), feel('Pillows out, the bed flat, her bottom at the edge.'))}>
          LIE HER FLAT
        </button>
        <button type="button" className="tap io-mini" data-on={run.helpers || undefined} data-testid="dystocia-helpers" onClick={() => (upd({ helpers: true }), feel('The midwife and the nurse each take a leg.'))}>
          ONE HELPER ON EACH LEG
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="200 / 130"
        className="mt-2"
        testId="dystocia-thigh"
        onDown={(p) => (grip.current = p.y)}
        onMove={(p) => {
          if (grip.current === null) return
          upd({ hipFlex: Math.max(0, Math.min(1, (grip.current - p.y) / 70)) })
        }}
        onUp={() => {
          grip.current = null
          const r = runRef.current
          if (r.hipFlex >= 0.8) feel(r.helpers ? 'McRoberts: her knees up beside her chest, the pelvis tilted.' : 'Hips flexed, but you need both legs held by helpers.')
          else feel('More: thighs right up onto her abdomen.')
        }}
      >
        <Side svgRef={svg} flex={run.hipFlex} />
      </TouchPad>
      <Traction upd={upd} feel={feel} physical={physical} why={why} />
      <NextButton onClick={next} testId="dystocia-next">
        Suprapubic
      </NextButton>
    </>
  )
}

function SuprapubicStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [mark, setMark] = useState<Pt | null>(null)
  return (
    <>
      <p className="io-lede">Tap where the nurse puts the heel of her hand. Then hold continuous pressure, then rock.</p>
      <TouchPad
        svg={svg}
        aspect="160 / 140"
        className="mx-auto max-w-[260px]"
        testId="dystocia-sp"
        onDown={(p) => {
          const s = spSiteAt(p)
          setMark(p)
          upd({ sp: s, fundal: runRef.current.fundal || s === 'fundal' })
          if (s === 'correct') feel('Heel of the hand just above the pubis, on the side of the baby’s back, pushing the shoulder toward his chest.')
          else if (s === 'fundal') {
            buzz([60, 40, 60])
            physical('Pressure on the fundus drives the shoulder harder into the pubis.')
            why('Never fundal pressure in shoulder dystocia. Suprapubic, over the anterior shoulder.')
          } else if (s === 'wrong-side') why('From the side of the baby’s back: that pushes the shoulder forward, toward his chest.')
          else why('Just above the pubic bone, over the anterior shoulder.')
        }}
      >
        <Abdomen svgRef={svg} mark={mark} />
      </TouchPad>
      <HoldButton testId="dystocia-continuous" className="mt-2 w-full" disabled={run.sp !== 'correct'} onTick={(dt) => upd((r) => ({ continuousS: r.continuousS + dt }))} onEnd={() => feel(runRef.current.continuousS >= 3 ? 'Thirty seconds of steady pressure. Not yet.' : 'Keep it on longer.')}>
        HOLD CONTINUOUS PRESSURE · {Math.min(30, Math.round(run.continuousS * 10))} S
      </HoldButton>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-testid="dystocia-rock" disabled={run.sp !== 'correct'} onClick={() => (upd((r) => ({ rocks: r.rocks + 1 })), feel(run.rocks + 1 >= 3 ? 'Rocking pressure, back and forth. Still stuck.' : 'Rock.'))}>
          ROCKING ({run.rocks})
        </button>
      </div>
      <Traction upd={upd} feel={feel} physical={physical} why={why} />
      <NextButton onClick={next} testId="dystocia-next">
        Internal
      </NextButton>
    </>
  )
}

function InternalStage({ run, runRef, upd, feel, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [hand, setHand] = useState<Pt | null>(null)
  return (
    <>
      <p className="io-lede">Still stuck. Slide your hand in posteriorly (from below), find the posterior elbow, flex it, and sweep the forearm across the chest and out. Or rotate.</p>
      <TouchPad
        svg={svg}
        aspect="180 / 140"
        className="mx-auto max-w-[300px]"
        testId="dystocia-in"
        onDown={(p) => {
          setHand(p)
          if (p.y < 60 && !runRef.current.handIn) why('Anteriorly there is no room: the pubis is right there. Go in from below, along the sacrum.')
        }}
        onMove={(p) => {
          setHand(p)
          const cur = runRef.current
          if (!cur.handIn && p.y > 110) {
            upd({ handIn: true })
            feel('Your whole hand slides in along the sacrum: there is room here.')
          }
          if (cur.handIn && !cur.elbowFlexed && Math.hypot(p.x - 130, p.y - 104) < 14) {
            upd({ elbowFlexed: true })
            feel('You find the posterior elbow and press in the antecubital fossa: it flexes.')
          }
          if (cur.elbowFlexed && !cur.armSwept && p.x < 90 && p.y < 70) {
            upd({ armSwept: true, internal: 'posterior-arm' })
            buzz(60)
            feel('You catch the hand and sweep the forearm across the chest and out over the face: the posterior arm is delivered.')
          }
        }}
      >
        <Internal svgRef={svg} hand={hand} elbow={run.elbowFlexed} swept={run.armSwept} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.rubin || undefined} data-testid="dystocia-rubin" onClick={() => (upd({ rubin: true }), feel('Two fingers behind the anterior shoulder, pushing it toward the chest (Rubin II).'))}>
          BEHIND THE ANTERIOR SHOULDER (RUBIN II)
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-on={run.woods || undefined}
          data-testid="dystocia-woods"
          onClick={() => {
            const cur = upd({ woods: true })
            if (cur.rubin) {
              upd({ internal: cur.internal ?? 'rotation' })
              feel("Together with Woods' screw on the posterior shoulder, the shoulders turn into the oblique: free.")
            } else feel("In front of the posterior shoulder, turning it (Woods' screw).")
          }}
        >
          IN FRONT OF THE POSTERIOR SHOULDER (WOODS)
        </button>
      </div>
      <NextButton onClick={next} testId="dystocia-next">
        Deliver
      </NextButton>
    </>
  )
}

function DeliverStage({ run, upd, feel, physical, next }: Stage) {
  return (
    <>
      <p className="io-lede">{run.internal ? 'The shoulder is free.' : 'The shoulder is still impacted.'}</p>
      <div className="io-choices">
        <button
          type="button"
          className="tap io-mini"
          data-on={run.delivered || undefined}
          data-testid="dystocia-deliver"
          onClick={() => {
            if (!run.internal) return physical('It will not come. Go back in.')
            upd({ delivered: true })
            buzz(80)
            feel('With gentle traction the body follows. A floppy, pale baby.')
          }}
        >
          {run.delivered ? 'DELIVERED ✓' : 'DELIVER THE BODY'}
        </button>
        <button type="button" className="tap io-mini" data-on={run.resuscitaire || undefined} data-testid="dystocia-resus" onClick={() => (run.delivered ? (upd({ resuscitaire: true }), feel('Straight to the neonatal team on the resuscitaire.')) : feel('Deliver first.'))}>
          TO THE RESUSCITAIRE
        </button>
        <button type="button" className="tap io-mini" data-on={run.timeNoted || undefined} data-testid="dystocia-time" onClick={() => (upd({ timeNoted: true }), feel(`Head at 14:02, body ${Math.round(run.headToBodyS)} s later. Written down.`))}>
          NOTE THE TIME
        </button>
      </div>
      <NextButton onClick={next} testId="dystocia-next">
        Finish
      </NextButton>
    </>
  )
}
