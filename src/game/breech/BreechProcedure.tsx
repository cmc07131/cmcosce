import { useEffect, useRef, useState, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, TouchPad, benchMarks, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { BREECH_MARKS, checkBreech, freshBreech, rotate, stageOf, type BreechRun } from './model'

const TITLES = ['Hands off', 'Back', 'Arms', 'Hang', 'Head']
const BABY = '#e8b0a0'
const BABY_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

type Stage = BenchApi<BreechRun> & { next: () => void }

/**
 * A breech delivery by hand, hands off until you are needed: she pushes; you flex out the leg that stays up
 * (Pinard), keep the back anterior and wrap it, hold the bony pelvis and turn the body each way for the arms
 * (Løvset), let it hang until the hairline shows, then deliver the head slowly (Mauriceau–Smellie–Veit).
 */
export function BreechProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshBreech, coach)
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
    const { marks, faults } = benchMarks(checkBreech(r), BREECH_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: r.headOut ? 'Breech delivered.' : 'The head is not delivered.', scene: r.headOut ? [job.scene || 'delivered'] : ['undelivered'] })
  }
  const stage: Stage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="breech-bench">
      <div className="hare-bar">
        <span>EXTENDED BREECH</span>
        <span />
        <span>{['AT THE INTROITUS', 'BUTTOCKS', 'ONE LEG', 'TO THE UMBILICUS', 'TO THE SCAPULAE'][stageOf(api.run)]}</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkBreech(api.run)} onContinue={finish} testId="breech-check" />
        ) : (
          <>
            {index === 0 && <HandsOffStage {...stage} />}
            {index === 1 && <BackStage {...stage} />}
            {index === 2 && <ArmsStage {...stage} />}
            {index === 3 && <HangStage {...stage} />}
            {index === 4 && <HeadStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- art */

/** From the foot of the bed: the introitus at the top, the baby hanging below it, back toward you when anterior. */
function Baby({ run, svgRef, spin = 0, lift = 0 }: { run: BreechRun; svgRef?: Ref<SVGSVGElement>; spin?: number; lift?: number }) {
  const s = stageOf(run)
  const len = [6, 30, 44, 70, 96][s]
  const back = Math.cos(((run.backAngle + spin) * Math.PI) / 180) > 0
  return (
    <svg ref={svgRef} viewBox="0 0 160 180" className="block h-full w-full select-none" data-testid="breech-view">
      <rect width="160" height="180" fill="#e2e8ec" />
      <path d="M0 0 L160 0 L160 26 Q80 40 0 26 Z" fill="#e8b494" stroke="#8a5238" />
      <ellipse cx="80" cy="30" rx="22" ry="6" fill="#7a3030" />
      <g transform={`translate(0 ${-lift * 40}) rotate(${-lift * 30} 80 30)`}>
        {/* the body hanging from the introitus, buttocks lowest */}
        <rect x="62" y="30" width="36" height={len} rx="14" fill={run.towel && s >= 3 ? '#f4f4f0' : BABY} stroke={BABY_EDGE} />
        {back && <line x1="80" y1="34" x2="80" y2={26 + len} stroke={BABY_EDGE} strokeWidth="1.5" strokeDasharray="2 2" />}
        {/* legs: the left out, the right up along the body until Pinard */}
        {s >= 2 && <rect x="56" y={20 + len} width="10" height="40" rx="5" fill={BABY} stroke={BABY_EDGE} />}
        {s >= 2 && (run.pinard ? <rect x="94" y={20 + len} width="10" height="40" rx="5" fill={BABY} stroke={BABY_EDGE} /> : <rect x="94" y="30" width="9" height={len - 4} rx="4" fill={BABY} stroke={BABY_EDGE} opacity="0.8" />)}
        {/* arms once out */}
        {run.armsOut >= 1 && <rect x="48" y="34" width="9" height="30" rx="4" fill={BABY} stroke={BABY_EDGE} />}
        {run.armsOut >= 2 && <rect x="103" y="34" width="9" height="30" rx="4" fill={BABY} stroke={BABY_EDGE} />}
        {run.headOut && <circle cx="80" cy="20" r="18" fill={BABY} stroke={BABY_EDGE} />}
      </g>
      {run.grip === 'pelvis' && (
        <g>
          <ellipse cx="58" cy={18 + len} rx="8" ry="5" fill="#c89070" stroke="#6a3a20" />
          <ellipse cx="102" cy={18 + len} rx="8" ry="5" fill="#c89070" stroke="#6a3a20" />
        </g>
      )}
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="176">{back ? 'BACK TOWARD YOU (ANTERIOR)' : 'BACK TURNED AWAY (POSTERIOR)'}</text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- stages */

function HandsOffStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const s = stageOf(run)
  return (
    <>
      <p className="io-lede">Encourage her to push with each contraction. Keep your hands off unless something is stuck.</p>
      <TouchPad
        svg={svg}
        aspect="160 / 180"
        className="mx-auto max-w-[240px]"
        testId="breech-touch"
        onDown={(p) => {
          const cur = runRef.current
          // The right leg, extended up along the body: press behind the knee to flex it out.
          if (stageOf(cur) === 2 && !cur.pinard && p.x > 90 && p.x < 108) {
            upd({ pinard: true, pinardAt: cur.pushes })
            sfx.select()
            return feel('Pressure in the popliteal fossa: the knee flexes and you sweep the leg out (Pinard).')
          }
          upd({ touchedEarly: cur.touchedEarly + 1 })
          why('Hands off the breech unless something needs you: touching it makes it startle and extend its arms.')
        }}
      >
        <Baby run={run} svgRef={svg} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="breech-push"
          onClick={() => {
            const cur = upd((r) => ({ pushes: r.pushes + 1 }))
            const st = stageOf(cur)
            if (st === 2 && !cur.pinard) feel(cur.pushes > 2 ? 'She pushes, but the right leg is held up along the body: it has stopped.' : 'With the contraction the buttocks deliver, then the left leg falls out.')
            else feel(['', 'The buttocks deliver with the contraction.', 'The left leg falls out.', 'To the umbilicus.', 'The body to the scapulae; the arms are still up.'][st])
          }}
        >
          “PUSH WITH THIS CONTRACTION”
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="breech-pull"
          onClick={() => {
            upd({ pulledLegs: true })
            buzz([60, 40, 60])
            physical('You pull on the legs. The arms fly up beside the head.')
            why('Never pull a breech: traction extends the arms and the head. Let her push it out.')
          }}
        >
          PULL ON THE LEGS
        </button>
      </div>
      <p className="io-small">{s >= 4 ? 'Delivered to the scapulae.' : 'Watch, and wait.'}</p>
      <NextButton onClick={next} testId="breech-next">
        Back
      </NextButton>
    </>
  )
}

function BackStage({ run, upd, feel, why, next }: Stage) {
  useEffect(() => {
    if (stageOf(run) >= 3 && run.backAngle === 0 && !run.backCorrected) upd({ backAngle: 120 })
  }, [])
  return (
    <>
      <p className="io-lede">As the body descends, check which way the back is facing. Keep it anterior. Wrap the body in a warm towel.</p>
      <div className="io-figure mx-auto aspect-[160/180] max-w-[240px]">
        <Baby run={run} />
      </div>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="breech-turn-back"
          onClick={() => {
            if (Math.abs(run.backAngle) <= 45) return feel('The back is already facing you.')
            upd({ backAngle: 0, backCorrected: true })
            feel('Holding the bony pelvis, you turn the body so the back is anterior again.')
          }}
        >
          TURN THE BACK ANTERIOR (HOLDING THE PELVIS)
        </button>
        <button type="button" className="tap io-mini" data-on={run.towel || undefined} data-testid="breech-towel" onClick={() => (upd({ towel: true }), feel('Wrapped in a warm towel: warmer, and easier to hold.'))}>
          WRAP IN A WARM TOWEL
        </button>
      </div>
      {Math.abs(run.backAngle) > 45 && <p className="io-small">The back has turned away from you.</p>}
      <NextButton onClick={() => (Math.abs(run.backAngle) > 45 ? (why('Back posterior, the chin will catch on the pubic bone.'), next()) : next())} testId="breech-next">
        Arms
      </NextButton>
    </>
  )
}

function ArmsStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const last = useRef<number | null>(null)
  const [spin, setSpin] = useState(0)
  return (
    <>
      <p className="io-lede">The scapulae are visible; the arms are not out. Take hold, then drag round to turn the body 180° one way, then back.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.grip === 'pelvis' || undefined} data-testid="breech-grip-pelvis" onClick={() => (upd({ grip: 'pelvis' }), feel('Thumbs on the sacrum, fingers over the iliac crests: the bony pelvis.'))}>
          HOLD THE BONY PELVIS
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-on={run.grip === 'abdomen' || undefined}
          data-testid="breech-grip-abdomen"
          onClick={() => {
            upd({ grip: 'abdomen' })
            physical('Your hands squeeze round the soft abdomen.')
            why('The liver and spleen are under your thumbs. Hold the bony pelvis.')
          }}
        >
          HOLD ROUND THE ABDOMEN
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="160 / 180"
        className="mx-auto mt-2 max-w-[240px]"
        testId="breech-rotate"
        onDown={(p) => (last.current = Math.atan2(p.y - 90, p.x - 80))}
        onMove={(p) => {
          const a = Math.atan2(p.y - 90, p.x - 80)
          if (last.current === null) return
          let d = ((a - last.current) * 180) / Math.PI
          if (d > 180) d -= 360
          if (d < -180) d += 360
          last.current = a
          const before = runRef.current.armsOut
          const cur = upd(rotate(runRef.current, d))
          setSpin((s) => s + d)
          if (cur.armsOut > before) {
            sfx.select()
            feel(cur.armsOut === 1 ? 'Turned 180°: the posterior arm comes round under the pubic arch and you sweep it out.' : 'Turned back the other way: the second arm delivers.')
          }
          if (!cur.grip) why('Hold it first.')
        }}
        onUp={() => (last.current = null)}
      >
        <Baby run={run} svgRef={svg} spin={spin} />
      </TouchPad>
      <NextButton onClick={next} testId="breech-next">
        Hang
      </NextButton>
    </>
  )
}

function HangStage({ run, upd, feel, physical, why, next }: Stage) {
  return (
    <>
      <p className="io-lede">Let the body hang by its own weight. Watch for the nape of the neck and the hairline.</p>
      <div className="io-figure mx-auto aspect-[160/180] max-w-[240px]">
        <Baby run={run} />
      </div>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-testid="breech-wait" onClick={() => (upd((r) => ({ hungS: r.hungS + 1 })), feel(run.hungS + 1 >= 3 ? 'The nape of the neck and the hairline appear under the pubis.' : 'The body hangs; the head flexes into the pelvis.'))}>
          WAIT A FEW SECONDS ({run.hungS})
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="breech-lift"
          onClick={() => {
            upd({ heldUp: true })
            physical('You lift the body straight up over her abdomen. The head extends.')
            why('Lifting too early hyperextends the neck. Let it hang until the hairline shows.')
          }}
        >
          LIFT THE BODY UP NOW
        </button>
      </div>
      <NextButton onClick={next} testId="breech-next">
        Head
      </NextButton>
    </>
  )
}

function HeadStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const start = useRef<{ y: number; t: number } | null>(null)
  const [lift, setLift] = useState(0)
  return (
    <>
      <p className="io-lede">Body along your forearm. Two fingers on the cheekbones, the other hand on the occiput. Then flex the head and lift the body in an arc, slowly.</p>
      <div className="io-choices">
        <button type="button" className="tap io-mini" data-on={run.malar || undefined} data-testid="breech-malar" onClick={() => (upd({ malar: true }), feel('Body along your forearm, index and middle fingers on the malar bones.'))}>
          FINGERS ON THE CHEEKBONES
        </button>
        <button type="button" className="tap io-mini" data-on={run.occiput || undefined} data-testid="breech-occiput" onClick={() => (upd({ occiput: true }), feel('The other hand over the back, a finger pressing the occiput to flex the head.'))}>
          OTHER HAND ON THE OCCIPUT
        </button>
      </div>
      <TouchPad
        svg={svg}
        aspect="160 / 180"
        className="mx-auto mt-2 max-w-[240px]"
        testId="breech-head"
        onDown={(p) => (start.current = { y: p.y, t: performance.now() })}
        onMove={(p) => start.current && setLift(Math.max(0, Math.min(1, (start.current.y - p.y) / 80)))}
        onUp={() => {
          const s = start.current
          start.current = null
          if (!s || lift < 0.8) return
          const cur = runRef.current
          if (!cur.malar || !cur.occiput) return why('Get the grip first: the cheekbones, and the occiput.')
          const seconds = (performance.now() - s.t) / 1000
          const speed = Math.max(0, Math.min(1, 1.2 - seconds / 2))
          upd({ headOut: true, headSpeed: speed })
          buzz(60)
          if (speed > 0.6) physical('The head pops out quickly.')
          else feel('The face, then the forehead, then the occiput: the head delivers slowly. She cries.')
        }}
      >
        <Baby run={run} svgRef={svg} lift={lift} />
      </TouchPad>
      <NextButton onClick={next} testId="breech-next">
        Finish
      </NextButton>
    </>
  )
}
