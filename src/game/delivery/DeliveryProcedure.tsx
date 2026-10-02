import { useEffect, useRef, useState, type Ref } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { CheckCard, RubTint, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { BIRTH_MARKS, THIRD_MARKS, checkBirth, checkThird, freshBirth, freshThird, separated, type BirthRun, type ThirdRun } from './model'

const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const BABY = '#e0a8a0'
const FONT = 'Press Start 2P, monospace'

/** `pose: "third"`: the third stage. Otherwise the birth itself. */
export function DeliveryProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  return job.pose === 'third' ? <Third job={job} coach={coach} onDone={onDone} /> : <Birth job={job} coach={coach} onDone={onDone} />
}

/* ================================================================ the birth */

type BStage = BenchApi<BirthRun> & { next: () => void }
const BIRTH_TITLES = ['Crowning', 'Cord', 'Restitution', 'Shoulders', 'Baby']

function Birth({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshBirth, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  const born = api.run.posterior
  useEffect(() => {
    if (!born) return
    const id = window.setInterval(() => api.upd((r) => ({ secondsSinceBirth: r.secondsSinceBirth + 1 })), 1000)
    return () => window.clearInterval(id)
  }, [born])
  const next = () => {
    sfx.select()
    if (index < BIRTH_TITLES.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const { marks, faults } = benchMarks(checkBirth(r), BIRTH_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: born ? 'A girl, crying, skin to skin.' : 'Not delivered.', scene: born ? [job.scene || 'born'] : ['undelivered'] })
  }
  const stage: BStage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="birth-bench">
      <div className="hare-bar">
        <span>{born ? `BORN · ${api.run.secondsSinceBirth} S` : 'CROWNING'}</span>
        <span />
        <span>{api.run.clampedAt !== null ? 'CORD CLAMPED' : 'CORD INTACT'}</span>
      </div>
      <StepStrip titles={BIRTH_TITLES} index={checked ? BIRTH_TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkBirth(api.run)} onContinue={finish} testId="birth-check" />
        ) : (
          <>
            {index <= 3 && <HeadStage {...stage} stage={index} />}
            {index === 4 && <BabyStage {...stage} />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

function Perineum({ run, svgRef, shoulder }: { run: BirthRun; svgRef?: Ref<SVGSVGElement>; shoulder: number }) {
  const out = run.crowned !== null
  const turn = run.restituted ? 1 : 0
  return (
    <svg ref={svgRef} viewBox="0 0 180 160" className="block h-full w-full select-none" data-testid="birth-view">
      <rect width="180" height="160" fill="#e2e8ec" />
      <path d="M0 0 L180 0 L180 60 Q90 80 0 60 Z" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M40 150 Q90 120 140 150 L140 160 L40 160 Z" fill={SKIN} stroke={SKIN_EDGE} />
      {/* the head: crowning, then out, then turned; the shoulders follow */}
      <g transform={`translate(0 ${shoulder * 10})`}>
        <circle cx="90" cy={out ? 96 : 78} r={out ? 26 : 20} fill={BABY} stroke={SKIN_EDGE} strokeWidth="1.5" />
        {out && <path d={turn ? 'M106 98 l8 -2' : 'M90 112 l0 6'} stroke={SKIN_EDGE} strokeWidth="2" />}
        {out && run.cord !== 'slipped' && run.cord !== 'cut' && <path d="M64 108 Q90 124 116 108" stroke="#c8d8f0" strokeWidth="4" fill="none" />}
        {shoulder > 0 && <ellipse cx="90" cy="128" rx="34" ry="10" fill={BABY} stroke={SKIN_EDGE} />}
      </g>
      {run.palm && <ellipse cx="90" cy={out ? 70 : 62} rx="16" ry="7" fill="#c89070" stroke="#6a3a20" />}
      {run.guard && <ellipse cx="90" cy="146" rx="22" ry="6" fill="#c89070" stroke="#6a3a20" opacity="0.85" />}
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="10" fill="#6a3a20">FROM THE FOOT · PUBIS ABOVE</text>
        <text x="4" y="156">PERINEUM</text>
      </g>
    </svg>
  )
}

function HeadStage({ run, runRef, upd, feel, physical, why, next, stage }: BStage & { stage: number }) {
  const svg = useRef<SVGSVGElement>(null)
  const [shoulder, setShoulder] = useState(0)
  const grip = useRef<number | null>(null)
  const lede = [
    'Tap the head to keep it flexed with your palm, and the perineum to guard it. Then the contraction.',
    'Feel round the neck for the cord.',
    'Wait for the head to turn.',
    'With the next contraction: drag the head gently down for the anterior shoulder, then up for the posterior.',
  ][stage]
  return (
    <>
      <p className="io-lede">{lede}</p>
      <TouchPad
        svg={svg}
        aspect="180 / 160"
        className="mx-auto max-w-[280px]"
        testId="birth-work"
        onDown={(p) => {
          const cur = runRef.current
          if (stage === 0) {
            if (p.y < 90 && Math.abs(p.x - 90) < 26) {
              upd({ palm: true })
              return feel('Your palm over the occiput, keeping the head flexed.')
            }
            if (p.y > 130) {
              upd({ guard: true })
              return feel('A pad over the perineum, your other hand supporting it.')
            }
          }
          if (stage === 1 && cur.crowned && Math.abs(p.y - 112) < 14) {
            upd({ cordFelt: true })
            return feel('A finger round the neck: a loop of cord, loose.')
          }
          if (stage === 3) grip.current = p.y
        }}
        onMove={(p) => {
          if (stage !== 3 || grip.current === null) return
          const cur = runRef.current
          const dy = p.y - grip.current
          if (!cur.restituted && !cur.shouldersEarly) {
            upd({ shouldersEarly: true })
            why('Wait for restitution first: the head turns to face a thigh as the shoulders rotate.')
          }
          if (dy > 12 && !cur.anterior) {
            const hard = dy > 40
            upd({ anterior: hard ? 'hard' : 'gentle' })
            setShoulder(0.5)
            if (hard) {
              buzz([60, 40, 60])
              physical('You pull down hard. The neck stretches.')
            } else feel('Gentle downward traction: the anterior shoulder slips out under the pubis.')
          }
          if (dy < -12 && !cur.posterior) {
            if (!cur.anterior) upd({ wrongOrder: true })
            upd({ posterior: true })
            setShoulder(1)
            buzz(60)
            feel('Upward now: the posterior shoulder, and the body slides out. She cries.')
          }
        }}
        onUp={() => (grip.current = null)}
      >
        <Perineum run={run} svgRef={svg} shoulder={shoulder} />
      </TouchPad>
      <div className="io-choices mt-2">
        {stage === 0 && (
          <>
            <button type="button" className="tap io-mini" data-on={run.pant || undefined} data-testid="birth-pant" onClick={() => (upd({ pant: true }), feel('"Pant, pant, little breaths: don\'t push now."'))}>
              “PANT, DON’T PUSH”
            </button>
            <button
              type="button"
              className="tap io-mini"
              data-testid="birth-contraction"
              disabled={run.crowned !== null}
              onClick={() => {
                const cur = runRef.current
                const controlled = cur.pant && cur.palm
                upd({ crowned: controlled ? 'controlled' : 'rapid', tear: !controlled || !cur.guard })
                if (controlled) feel('With the contraction the head crowns slowly under your palm and is born, face down.')
                else {
                  buzz(40)
                  physical('She pushes hard and the head shoots out, tearing the perineum.')
                  why('As the head crowns, tell her to pant, and keep it flexed and controlled.')
                }
              }}
            >
              THE CONTRACTION COMES
            </button>
          </>
        )}
        {stage === 1 && run.cordFelt && (
          <>
            <button type="button" className="tap io-mini" data-on={run.cord === 'slipped' || undefined} data-testid="birth-slip" onClick={() => (upd({ cord: 'slipped' }), feel('The loose loop eased over the head.'))}>
              SLIP IT OVER THE HEAD
            </button>
            <button
              type="button"
              className="tap io-mini"
              data-on={run.cord === 'cut' || undefined}
              data-testid="birth-cut"
              onClick={() => {
                upd({ cord: 'cut' })
                physical('Clamped and cut: the baby is now on her own supply before she is out.')
                why('A loose cord slips over the head. Cutting before delivery is a last resort for a tight cord.')
              }}
            >
              CLAMP AND CUT IT NOW
            </button>
          </>
        )}
        {stage === 2 && (
          <button type="button" className="tap io-mini" data-on={run.restituted || undefined} data-testid="birth-wait" onClick={() => (upd({ restituted: true }), feel('The head turns on its own to face her right thigh.'))}>
            WAIT AND WATCH
          </button>
        )}
      </div>
      <NextButton onClick={next} testId="birth-next">
        {BIRTH_TITLES[stage + 1]}
      </NextButton>
    </>
  )
}

function BabyStage({ run, runRef, upd, feel, physical, why, next }: BStage) {
  const svg = useRef<SVGSVGElement>(null)
  const rub = useRub({ cx: 90, cy: 80, rx: 40, ry: 50 })
  return (
    <>
      <p className="io-lede">Rub her dry with a warm towel, skin to skin on mum. Leave the cord for at least a minute.</p>
      <TouchPad svg={svg} aspect="180 / 160" className="mx-auto max-w-[260px]" testId="birth-dry" onDown={(p) => rub.rub(p)} onMove={(p) => (rub.rub(p), upd({ dried: rub.coverage }))} onUp={() => runRef.current.dried >= 0.7 && feel('Dried vigorously: she cries and goes pink.')}>
        <svg ref={svg} viewBox="0 0 180 160" className="block h-full w-full select-none" data-testid="birth-baby">
          <rect width="180" height="160" fill="#e2e8ec" />
          <ellipse cx="90" cy="100" rx="40" ry="44" fill={BABY} stroke={SKIN_EDGE} />
          <circle cx="90" cy="44" r="22" fill={BABY} stroke={SKIN_EDGE} />
          <RubTint rub={rub} colour="#ffffff" />
          <text x="4" y="10" fontFamily={FONT} fontSize="5" fill="#40404c">
            BABY · {run.secondsSinceBirth} S OLD
          </text>
        </svg>
      </TouchPad>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-on={run.skin || undefined} data-testid="birth-skin" onClick={() => (upd({ skin: true }), feel('Skin to skin on mum’s chest, a dry towel and a hat over her.'))}>
          SKIN TO SKIN
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="birth-suction"
          onClick={() => {
            upd({ suctioned: true })
            physical('You suction her mouth and nose. Her heart rate dips.')
            why('No routine suction for a baby who is crying: it can cause bradycardia.')
          }}
        >
          SUCTION MOUTH AND NOSE
        </button>
        <button type="button" className="tap io-mini" data-testid="birth-wait30" disabled={run.clampedAt !== null} onClick={() => (upd((r) => ({ secondsSinceBirth: r.secondsSinceBirth + 30 })), feel('Thirty seconds: she is pink and crying on mum, the cord still pulsing.'))}>
          LET 30 SECONDS PASS
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-on={run.clampedAt !== null || undefined}
          data-testid="birth-clamp"
          onClick={() => {
            const s = runRef.current.secondsSinceBirth
            upd({ clampedAt: s })
            if (s < 60) why(`Only ${s} s: wait at least a minute before clamping a well baby.`)
            else feel(`Clamped and cut at ${s} s.`)
          }}
        >
          CLAMP AND CUT THE CORD
        </button>
      </div>
      <NextButton onClick={next} testId="birth-next">
        Finish
      </NextButton>
    </>
  )
}

/* ================================================================ the third stage */

type TStage = BenchApi<ThirdRun> & { next: () => void }
const THIRD_TITLES = ['Twin', 'Separation', 'Traction', 'Placenta', 'Tone and tears']

function Third({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshThird, coach)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const done = useRef(false)
  const next = () => {
    sfx.select()
    if (index < THIRD_TITLES.length - 1) setIndex(index + 1)
    else setChecked(true)
  }
  function finish() {
    if (done.current) return
    done.current = true
    const r = api.runRef.current
    const { marks, faults } = benchMarks(checkThird(r), THIRD_MARKS, job.grantMarks)
    onDone({ marks, faults, summary: r.placentaOut ? 'Placenta delivered complete; uterus contracted.' : 'Placenta not delivered.', scene: r.placentaOut ? [job.scene || 'placenta'] : ['retained'] })
  }
  const stage: TStage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="third-bench">
      <div className="hare-bar">
        <span>THIRD STAGE · {api.run.minutes} MIN</span>
        <span />
        <span>{api.run.oxytocin ? 'OXYTOCIN GIVEN' : 'NO OXYTOCIN'}</span>
      </div>
      <StepStrip titles={THIRD_TITLES} index={checked ? THIRD_TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? <CheckCard rows={checkThird(api.run)} onContinue={finish} testId="third-check" /> : <ThirdStage {...stage} stage={index} />}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

function ThirdView({ run, svgRef, cordLen, rub }: { run: ThirdRun; svgRef?: Ref<SVGSVGElement>; cordLen: number; rub?: ReturnType<typeof useRub> }) {
  const up = separated(run) && run.saw.includes('uterus')
  return (
    <svg ref={svgRef} viewBox="0 0 180 170" className="block h-full w-full select-none" data-testid="third-view">
      <rect width="180" height="170" fill="#e2e8ec" />
      <ellipse cx="90" cy="60" rx="70" ry="56" fill={SKIN} stroke={SKIN_EDGE} />
      {/* the uterus: soft and broad, then firm, round and higher once it separates */}
      <ellipse cx="90" cy={up ? 52 : 64} rx={up ? 24 : 32} ry={up ? 24 : 30} fill={up || run.rubbed >= 0.6 ? '#d89080' : '#e8b0a0'} stroke="#a05040" strokeDasharray={up ? undefined : '3 2'} />
      {rub && <RubTint rub={rub} colour="#a05040" />}
      <path d="M40 116 Q90 106 140 116" stroke={SKIN_EDGE} strokeWidth="2" fill="none" />
      {run.guarded && <ellipse cx="90" cy="104" rx="18" ry="6" fill="#c89070" stroke="#6a3a20" />}
      {/* the cord from the introitus, with its clamp */}
      {!run.placentaOut ? (
        <g>
          <line x1="90" y1="130" x2="90" y2={130 + cordLen} stroke="#c8d8f0" strokeWidth="4" />
          <rect x="84" y={126 + cordLen} width="12" height="6" fill="#606878" />
          {run.saw.includes('gush') && <path d="M84 132 Q78 144 82 152" stroke="#b01010" strokeWidth="3" fill="none" />}
        </g>
      ) : (
        <ellipse cx="90" cy="150" rx="26" ry="12" fill="#8a2030" stroke="#501018" />
      )}
      <g fontFamily={FONT} fontSize="4.5" fill="#40404c">
        <text x="4" y="10">ABDOMEN AND INTROITUS</text>
        <text x="64" y="126">PUBIS</text>
      </g>
    </svg>
  )
}

function ThirdStage({ run, runRef, upd, feel, physical, why, next, stage }: TStage & { stage: number }) {
  const svg = useRef<SVGSVGElement>(null)
  const grip = useRef<number | null>(null)
  const rubbing = useRef(false)
  const [cordLen, setCordLen] = useState(12)
  const rub = useRub({ cx: 90, cy: 56, rx: 30, ry: 28 })
  const lede = [
    'Feel her abdomen for a second baby. Then the oxytocin.',
    'Wait, and watch for the signs that it has separated.',
    'Guard the uterus above the pubis with one hand. Then draw the cord gently down with the other.',
    'Check what came out.',
    'Rub up the fundus. Look for tears. How much has she lost?',
  ][stage]
  return (
    <>
      <p className="io-lede">{lede}</p>
      <TouchPad
        svg={svg}
        aspect="180 / 170"
        className="mx-auto max-w-[280px]"
        testId="third-work"
        onDown={(p) => {
          const cur = runRef.current
          if (stage === 0 && p.y < 110) {
            upd({ palpated: true })
            return feel('One uterus, at the umbilicus, no fetal parts: no second twin.')
          }
          if (stage === 1 && p.y < 110) {
            if (separated(cur)) upd({ saw: cur.saw.includes('uterus') ? cur.saw : [...cur.saw, 'uterus'] })
            return feel(separated(cur) ? 'The uterus has firmed up into a ball and risen.' : 'Still broad and soft.')
          }
          if (stage === 2) {
            if (p.y > 92 && p.y < 116) {
              upd({ guarded: true })
              return feel('The edge of your hand above the pubis, pushing the uterus up and back.')
            }
            grip.current = p.y
          }
          if (stage === 4) {
            rubbing.current = p.y < 110
            if (p.y < 110) rub.rub(p)
            else {
              upd({ inspected: true })
              feel('Speculum and light: a small first-degree tear, not bleeding.')
            }
          }
        }}
        onMove={(p) => {
          if (stage === 4 && p.y < 110) {
            rub.rub(p)
            upd({ rubbed: rub.coverage })
            return
          }
          if (stage !== 2 || grip.current === null) return
          const cur = runRef.current
          const dy = p.y - grip.current
          if (dy < 8 || cur.placentaOut) return
          if (!separated(cur)) {
            upd({ pulledEarly: true, inversion: !cur.guarded || cur.inversion })
            grip.current = null
            buzz([60, 40, 60])
            physical(cur.guarded ? 'The cord tightens but nothing comes: it has not separated.' : 'The fundus dimples down as you pull: it is starting to invert.')
            return why('Wait for the signs of separation, and always guard the uterus.')
          }
          if (dy > 70) {
            upd({ snapped: true })
            grip.current = null
            return physical('You pull too hard and the cord snaps.')
          }
          setCordLen(12 + dy * 0.5)
          if (dy > 40) {
            upd({ placentaOut: true })
            grip.current = null
            buzz(60)
            feel(cur.guarded ? 'Steady traction, the uterus guarded: the placenta slides out, membranes twisted behind it.' : 'It comes, but you did not guard the uterus.')
          }
        }}
        onUp={() => {
          grip.current = null
          if (stage === 4 && rubbing.current && runRef.current.rubbed >= 0.6) feel('The fundus is firm, below the umbilicus.')
          rubbing.current = false
        }}
      >
        <ThirdView run={run} svgRef={svg} cordLen={cordLen} rub={stage === 4 ? rub : undefined} />
      </TouchPad>
      <div className="io-choices mt-2">
        {stage === 0 && (
          <button type="button" className="tap io-mini" data-on={run.oxytocin || undefined} data-testid="third-oxytocin" onClick={() => {
              const first = !runRef.current.palpated
              upd({ oxytocin: true, oxytocinFirst: first })
              if (first) why('Feel for a second twin before the oxytocin: it would clamp down on a baby still inside.')
              else feel('Oxytocin 10 IU IM into her thigh.')
            }}>
            OXYTOCIN 10 IU IM
          </button>
        )}
        {stage === 1 && (
          <>
            <button type="button" className="tap io-mini" data-testid="third-wait" onClick={() => (upd((r) => ({ minutes: r.minutes + 1 })), feel('A minute passes.'))}>
              WAIT A MINUTE
            </button>
            <button
              type="button"
              className="tap io-mini"
              data-testid="third-look"
              onClick={() => {
                const cur = runRef.current
                if (!separated(cur)) return feel('Nothing yet: no gush, the clamp has not moved.')
                upd({ saw: [...new Set([...cur.saw, 'gush', 'cord'] as ('gush' | 'cord')[])] })
                setCordLen(26)
                feel('A small gush of blood, and the clamp has moved down: the cord is lengthening.')
              }}
            >
              LOOK AT THE CORD AND THE PERINEUM
            </button>
          </>
        )}
        {stage === 3 && (
          <>
            {(['cotyledons', 'membranes', 'vessels'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className="tap io-mini"
                data-on={run.checked.includes(c) || undefined}
                data-testid={`third-${c}`}
                onClick={() => {
                  if (!run.placentaOut) return feel('It is not out yet.')
                  upd({ checked: run.checked.includes(c) ? run.checked : [...run.checked, c] })
                  feel({ cotyledons: 'Maternal surface: all the cotyledons there, fitting together.', membranes: 'Held up by the cord: the membranes complete, one hole.', vessels: 'The cut cord: two arteries and a vein.' }[c])
                }}
              >
                {c === 'cotyledons' ? 'MATERNAL SURFACE' : c === 'membranes' ? 'MEMBRANES' : 'CORD VESSELS'}
              </button>
            ))}
          </>
        )}
        {stage === 4 &&
          [300, 800].map((ml) => (
            <button key={ml} type="button" className="tap io-mini" data-on={run.ebl === ml || undefined} data-testid={`third-ebl-${ml}`} onClick={() => (upd({ ebl: ml }), feel(`Estimated blood loss ${ml} mL.`))}>
              EBL {ml} ML
            </button>
          ))}
      </div>
      <NextButton onClick={next} testId="third-next">
        {THIRD_TITLES[stage + 1] ?? 'Finish'}
      </NextButton>
    </>
  )
}
