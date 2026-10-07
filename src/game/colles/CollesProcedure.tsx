import { useRef, useState } from 'react'
import { NextButton, NoteLine, StepStrip, useBench, type BenchApi } from '../bench/core'
import { HoldButton } from '../bench/controls'
import { CheckCard, RubTint, Syringe, TouchPad, benchMarks, useRub, type Pt } from '../bench/kit'
import type { BenchResult, PerformJob } from '../store'
import { buzz, sfx } from '../sfx'
import { HAND_SITES, HandView, LateralView } from './art'
import {
  BLOCK_MIN,
  COLLES_MARKS,
  MAX_LIDO_MG,
  OK_SHORT,
  OK_TILT,
  START,
  WEIGHT_KG,
  checkColles,
  freshColles,
  injectedMg,
  letGo,
  manipPain,
  mould,
  setTilt,
  setTraction,
  setUlnar,
  siteAt,
  slabName,
  type CollesRun,
  type HandCheck,
  type Slab,
} from './model'

const TITLES = ['Check', 'Draw up', 'Clean', 'Block', 'Wait', 'Reduce', 'Backslab', 'After']

type Stage = BenchApi<CollesRun> & { next: () => void }

/**
 * A Colles fracture by hand: check the hand, draw up the lidocaine, clean, find the haematoma and inject, wait,
 * reduce with counter-traction, disimpaction and volar-ulnar pressure, apply and mould the backslab while the
 * reduction is held, then check the nerve and the film. Mrs Wu feels everything the block has not reached.
 */
export function CollesProcedure({ job, coach, onDone }: { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }) {
  const api = useBench(freshColles, coach)
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
    const rows = checkColles(r)
    const { marks, faults } = benchMarks(rows, COLLES_MARKS, job.grantMarks)
    onDone({
      marks,
      faults,
      summary: `Colles: ${r.injectedMl.toFixed(0)} mL of ${r.ampoule ?? '?'}% lidocaine ${r.site === 'fracture' ? 'into the haematoma' : 'off target'}; film shows ${Math.abs(Math.round(r.tilt))}° ${r.tilt >= 0 ? 'dorsal' : 'volar'} tilt and ${r.short.toFixed(0)} mm shortening.`,
    })
  }
  const stage: Stage = { ...api, next }
  return (
    <div className="io-bench flex min-h-0 flex-1 flex-col" data-testid="colles-bench">
      <div className="hare-bar">
        <span>MRS WU · {WEIGHT_KG} KG</span>
        <span />
        <span>LIDOCAINE {injectedMg(api.run).toFixed(0)}/{MAX_LIDO_MG} MG</span>
      </div>
      <StepStrip titles={TITLES} index={checked ? TITLES.length - 1 : index} />
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ scrollbarGutter: 'stable' }}>
        {checked ? (
          <CheckCard rows={checkColles(api.run)} onContinue={finish} testId="colles-check" footer={`Acceptable: dorsal tilt ${OK_TILT}° or less, shortening ${OK_SHORT} mm or less. Before: ${START.tilt}° and ${START.short} mm.`} />
        ) : (
          <>
            {index === 0 && <HandStage {...stage} mode="before" />}
            {index === 1 && <DrawStage {...stage} />}
            {index === 2 && <CleanStage {...stage} />}
            {index === 3 && <BlockStage {...stage} />}
            {index === 4 && <WaitStage {...stage} />}
            {index === 5 && <ReduceStage {...stage} />}
            {index === 6 && <SlabStage {...stage} />}
            {index === 7 && <HandStage {...stage} mode="after" />}
          </>
        )}
        {!checked && <NoteLine note={api.note} />}
      </div>
    </div>
  )
}

/* ================================================================ 1 and 8. the hand */

const FINDING: Record<HandCheck, string> = {
  pulse: 'Radial pulse: strong.',
  median: 'She feels you touch the tip of her index finger, the same as the other hand.',
  abduct: 'She lifts her thumb up toward the ceiling against your finger: strong.',
  epl: 'With her palm flat, she lifts her thumb off the table.',
  crt: 'Capillary refill under 2 seconds.',
  skin: 'Swollen and bruised over the dorsum, but the skin is intact all round: closed.',
  allergy: '"No allergies that I know of."',
}

function HandStage({ run, runRef, upd, feel, physical, next, mode }: Stage & { mode: 'before' | 'after' }) {
  const svg = useRef<SVGSVGElement>(null)
  const [side, setSide] = useState<'palm' | 'back'>('palm')
  const [pulse, setPulse] = useState<{ x: number; y: number; key: number } | null>(null)
  const field = mode
  const record = (c: HandCheck) => {
    upd((r) => ({ [field]: r[field].includes(c) ? r[field] : [...r[field], c] }) as Partial<CollesRun>)
    feel(mode === 'after' && c === 'median' && runRef.current.slab === 'full-cast' ? 'She says the fingers feel tight and tingly.' : FINDING[c])
  }
  function tap(p: Pt) {
    const near = (s: { x: number; y: number; r: number }) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r
    if (side === 'palm') {
      if (near(HAND_SITES.palm.pulse)) {
        setPulse({ ...HAND_SITES.palm.pulse, key: Date.now() })
        return record('pulse')
      }
      if (near(HAND_SITES.palm.median)) return record('median')
      if (near(HAND_SITES.palm.thumb)) return feel('Her thumb. Ask her to move it.')
      if (p.y > 100 && p.y < 130) return physical('She winces: that is the fracture.')
      return feel('Feel for the radial pulse at the wrist; touch the tip of the index finger for the median nerve.')
    }
    // Palm down, mirrored: the nail of the index finger and the dorsum of the wrist.
    if (p.y < 40) return record('crt')
    if (Math.hypot(p.x - HAND_SITES.back.dorsum.x, p.y - HAND_SITES.back.dorsum.y) <= HAND_SITES.back.dorsum.r) return record('skin')
    feel('Press a nail bed for refill; look at the skin over the wrist.')
  }
  const r = run
  const did = (c: HandCheck) => r[field].includes(c)
  return (
    <>
      <p className="io-lede">{mode === 'before' ? 'Before you touch the fracture: the median nerve, EPL, the circulation and the skin.' : 'Plaster on. Check the median nerve and the circulation again, then get the film.'}</p>
      <TouchPad svg={svg} aspect="200 / 170" className="mx-auto max-w-[260px]" onDown={tap} testId="colles-hand">
        <HandView side={side} svgRef={svg} pulse={pulse} />
      </TouchPad>
      <p className="io-small" data-testid="colles-hand-done">
        {(['pulse', 'median', 'abduct', 'epl', 'crt', 'skin'] as HandCheck[]).map((c) => `${c} ${did(c) ? '✓' : '–'}`).join(' · ')}
      </p>
      <div className="io-choices mt-2">
        <button type="button" className="tap io-mini" data-testid="colles-turn" onClick={() => setSide(side === 'palm' ? 'back' : 'palm')}>
          {side === 'palm' ? 'TURN THE HAND OVER' : 'PALM UP'}
        </button>
        {mode === 'before' && (
          <>
            <button type="button" className="tap io-mini" data-testid="colles-abduct" onClick={() => record('abduct')}>
              “THUMB UP TO THE CEILING”
            </button>
            <button type="button" className="tap io-mini" data-testid="colles-epl" onClick={() => (side === 'back' ? record('epl') : feel('Turn her palm down first: lift the thumb off the table.'))}>
              “LIFT YOUR THUMB OFF THE TABLE”
            </button>
            <button type="button" className="tap io-mini" data-testid="colles-allergy" onClick={() => record('allergy')}>
              “ANY ALLERGY TO LOCAL ANAESTHETIC?”
            </button>
          </>
        )}
        {mode === 'after' && (
          <button
            type="button"
            className="tap io-mini"
            data-testid="colles-xray"
            onClick={() => {
              upd({ xray: true })
              sfx.select()
              feel('The check film is up below.')
            }}
          >
            SEND FOR A CHECK X-RAY
          </button>
        )}
      </div>
      {mode === 'after' && r.xray && (
        <div className="io-figure mt-2 aspect-[300/130]" data-testid="colles-film">
          <LateralView tilt={r.tilt} short={r.short} xray slab={r.slab} />
        </div>
      )}
      {mode === 'after' && r.xray && (
        <p className="io-small">
          Film: {r.tilt >= 0 ? `dorsal tilt ${Math.round(r.tilt)}°` : `volar tilt ${Math.abs(Math.round(r.tilt))}°`}, shortening {r.short.toFixed(0)} mm, radial inclination {r.incl}°.
        </p>
      )}
      <NextButton onClick={next} testId="colles-next">
        {mode === 'before' ? 'Draw up' : 'Finish'}
      </NextButton>
    </>
  )
}

/* ================================================================ 2. draw up */

function DrawStage({ run, runRef, upd, feel, why, next }: Stage) {
  const r = run
  const amp = (n: 1 | 2) => (
    <button
      type="button"
      className="tap io-mini"
      data-on={r.ampoule === n || undefined}
      data-testid={`colles-amp-${n}`}
      onClick={() => {
        if (r.drawnMl > 0 && r.ampoule !== n) return feel('Squirt the syringe empty first, or you are mixing strengths.')
        upd({ ampoule: n })
        feel(`Lidocaine ${n}% (${n * 10} mg/mL), plain. Needle in the ampoule.`)
      }}
    >
      LIDOCAINE {n}% · {n * 10} MG/ML
    </button>
  )
  return (
    <>
      <p className="io-lede">
        Mrs Wu is {WEIGHT_KG} kg. Choose the ampoule, then pull the plunger to draw up what you will inject.
      </p>
      <div className="io-choices">
        {amp(1)}
        {amp(2)}
      </div>
      <Syringe
        capacity={20}
        drug={r.drawnMl}
        drugLabel={r.ampoule ? `${r.ampoule}% = ${(r.drawnMl * r.ampoule * 10).toFixed(0)} mg` : ''}
        testId="colles-draw"
        onPull={(ml) => {
          if (!r.ampoule) return { kind: 'none' }
          upd((cur) => ({ drawnMl: Math.min(20, cur.drawnMl + ml) }))
          return { kind: 'fluid' }
        }}
        onInject={(ml) => {
          upd((cur) => ({ drawnMl: Math.max(0, cur.drawnMl - ml) }))
          return true
        }}
        onRelease={() => {
          const cur = upd((c) => ({ drawnMl: Math.round(c.drawnMl * 2) / 2 }))
          if (!cur.ampoule) return feel('The needle is in the air: pick an ampoule first.')
          const mg = cur.drawnMl * cur.ampoule * 10
          if (mg > MAX_LIDO_MG) why(`${mg.toFixed(0)} mg is over the plain lidocaine maximum (3 mg/kg = ${MAX_LIDO_MG} mg).`)
          else feel(`${cur.drawnMl.toFixed(0)} mL of ${cur.ampoule}% in the syringe: ${mg.toFixed(0)} mg.`)
        }}
      />
      <NextButton onClick={next} testId="colles-next">
        Clean
      </NextButton>
    </>
  )
}

/* ================================================================ 3. clean */

function CleanStage({ upd, feel, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const rub = useRub({ cx: 100, cy: 108, rx: 42, ry: 26 })
  const said = useRef(false)
  return (
    <>
      <p className="io-lede">Palm down. Rub chlorhexidine over the whole dorsum of the wrist.</p>
      <TouchPad
        svg={svg}
        aspect="200 / 170"
        className="mx-auto max-w-[260px]"
        testId="colles-clean"
        onDown={(p) => rub.rub(p)}
        onMove={(p) => {
          rub.rub(p)
          upd({ cleaned: rub.coverage })
          if (rub.coverage >= 0.7 && !said.current) {
            said.current = true
            feel('The dorsum of the wrist is clean, the fracture in the middle of it.')
          }
        }}
        onUp={() => upd({ cleaned: rub.coverage })}
      >
        <HandView side="back" svgRef={svg}>
          <RubTint rub={rub} />
        </HandView>
      </TouchPad>
      <p className="io-small">{Math.round(rub.coverage * 100)}% cleaned</p>
      <NextButton onClick={next} testId="colles-next">
        Block
      </NextButton>
    </>
  )
}

/* ================================================================ 4. the haematoma block */

function BlockStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const [needleX, setNeedleX] = useState<number | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const r = run
  const left = r.drawnMl - r.injectedMl
  return (
    <>
      <p className="io-lede">Feel for the step in the dorsal cortex and tap the skin there to put the needle in. Aspirate, then inject.</p>
      <TouchPad
        svg={svg}
        aspect="300 / 130"
        testId="colles-block"
        onDown={(p) => {
          if (p.y > 70) return feel('Come in from the dorsum, the top surface.')
          const site = siteAt(p.x)
          setNeedleX(p.x)
          setFlash(null)
          upd({ site, aspirated: false, aspiratedBlood: false })
          sfx.cursor()
          feel(site === 'fracture' ? 'The needle slips through a gap in the cortex into something soft.' : site === 'carpus' ? 'The tip meets bone beyond the step.' : 'The tip meets solid bone: the shaft is intact here.')
        }}
      >
        <LateralView tilt={r.tilt} short={r.short} needleX={needleX} svgRef={svg} />
      </TouchPad>
      <Syringe
        capacity={20}
        drug={Math.max(0, left)}
        drugLabel={`${r.ampoule ?? '?'}% lidocaine`}
        flash={flash}
        disabled={needleX === null}
        testId="colles-syringe"
        onPull={() => {
          const cur = runRef.current
          if (cur.site === 'fracture') {
            setFlash('#5a1010')
            if (!cur.aspiratedBlood) feel('Dark old blood swirls into the hub: you are in the haematoma.')
            upd({ aspirated: true, aspiratedBlood: true })
            return { kind: 'blood' }
          }
          if (!cur.aspirated) feel('Nothing comes back.')
          upd({ aspirated: true })
          return { kind: 'none' }
        }}
        onInject={(ml) => {
          const cur = runRef.current
          if (!cur.site) return false
          if (cur.site !== 'fracture') {
            upd({ boneInjection: true })
            physical('It will not go: the tip is against bone.')
            return false
          }
          const first = cur.injectedMl === 0
          upd((c) => ({ injectedMl: c.injectedMl + ml, blockAt: c.blockAt ?? c.minutes, injectedBeforeAspirate: c.injectedBeforeAspirate || !c.aspirated }))
          if (first && !cur.aspirated) why('Aspirate before you inject: dark blood tells you the tip is in the haematoma.')
          if (injectedMg(runRef.current) > MAX_LIDO_MG) {
            buzz(40)
            why(`Past ${MAX_LIDO_MG} mg: the plain lidocaine maximum for ${WEIGHT_KG} kg.`)
          }
          return true
        }}
        onRelease={() => {
          const cur = upd((c) => ({ injectedMl: Math.min(c.drawnMl, Math.round(c.injectedMl * 2) / 2) }))
          if (cur.injectedMl > 0) feel(`${cur.injectedMl.toFixed(0)} mL injected slowly into the haematoma. She says it stings, then aches.`)
        }}
      />
      <NextButton onClick={next} testId="colles-next">
        Wait
      </NextButton>
    </>
  )
}

/* ================================================================ 5. wait and test */

function WaitStage({ run, upd, feel, physical, next }: Stage) {
  const r = run
  const since = r.blockAt === null ? null : r.minutes - r.blockAt
  return (
    <>
      <p className="io-lede">Talk to the student while the block works. Test it before you manipulate.</p>
      <div className="hare-bar" data-testid="colles-clock">
        <span>⏱ {since === null ? 'NO BLOCK GIVEN' : `${since} MIN SINCE THE BLOCK`}</span>
        <span />
        <span>{BLOCK_MIN}–10 MIN</span>
      </div>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="colles-wait"
          onClick={() => {
            upd((c) => ({ minutes: c.minutes + 1 }))
            feel('A minute passes. You explain the reduction to the student.')
          }}
        >
          WAIT A MINUTE
        </button>
        <button
          type="button"
          className="tap io-mini"
          data-testid="colles-test"
          onClick={() => {
            upd({ testedBlock: true })
            const p = manipPain(run)
            if (p <= 2) feel('You press gently over the fracture. "I can feel you pressing, but it doesn\'t hurt."')
            else physical(p >= 9 ? '"Ow! That really hurts!"' : '"It still hurts a bit…"')
          }}
        >
          PRESS GENTLY OVER THE FRACTURE
        </button>
      </div>
      <NextButton onClick={next} testId="colles-next">
        Reduce
      </NextButton>
    </>
  )
}

/* ================================================================ 6. reduce */

function ReduceStage({ run, runRef, upd, feel, physical, why, coach, next }: Stage) {
  const svg = useRef<SVGSVGElement>(null)
  const ap = useRef<SVGSVGElement>(null)
  const grip = useRef<{ x: number; y: number; t: number; tilt: number } | null>(null)
  const apGrip = useRef<{ x: number; u: number } | null>(null)
  const [ulnar, setUlnarState] = useState(0)
  const warned = useRef<Set<string>>(new Set())
  const once = (k: string, f: () => void) => {
    if (warned.current.has(k)) return
    warned.current.add(k)
    f()
  }
  const r = run
  function begin() {
    const cur = runRef.current
    if (manipPain(cur) >= 6) {
      upd({ reducedEarly: true, painful: cur.painful + 1 })
      once('pain', () => {
        buzz([40, 30, 40])
        physical(cur.blockAt === null ? 'She screams and snatches her arm away: there is no block.' : '"Ow! It still hurts!" She tenses every muscle: the block has not worked yet.')
      })
    }
  }
  return (
    <>
      <p className="io-lede">Get counter-traction. Drag the hand away from the elbow for traction; drag up to exaggerate, down to push the fragment volar. Then deviate it ulnarly below.</p>
      <div className="sayit" data-testid="colles-counter">
        <p className="sayit-prompt">SAY IT</p>
        {[
          { ok: true, text: 'Hold her upper arm with the elbow at 90° and pull back against me.' },
        ].map((l) => (
          <button
            key={l.text}
            type="button"
            className="sayit-opt"
            data-chosen={(l.ok && r.counter) || undefined}
            onClick={() => {
              upd({ counter: l.ok })
              if (l.ok) feel('The assistant grips her upper arm, elbow bent, and leans back.')
              else why('That is where you need to pull. The assistant holds the arm above the elbow for counter-traction.')
            }}
          >
            “{l.text}”
          </button>
        ))}
      </div>
      <TouchPad
        svg={svg}
        aspect="300 / 130"
        className="mt-2"
        testId="colles-reduce"
        onDown={(p) => {
          begin()
          const cur = runRef.current
          grip.current = { x: p.x, y: p.y, t: cur.traction, tilt: cur.tilt }
        }}
        onMove={(p) => {
          const g = grip.current
          if (!g) return
          let cur = runRef.current
          const t = g.t + (p.x - g.x) / 50
          cur = upd(setTraction(cur, t))
          if (!cur.counter && t > 0.35) once('slide', () => physical('The whole arm slides toward you: nobody is holding against you.'))
          const wasFree = cur.disimpacted
          cur = upd(setTilt(cur, g.tilt - (p.y - g.y) * 0.9))
          if (!wasFree && cur.disimpacted) once('free', () => feel('A grating give under your thumbs: the fragment is free.'))
          if (!cur.disimpacted && p.y - g.y > 10) once('stuck', () => (coach ? why('It will not move: impacted. Traction first, then briefly exaggerate the deformity.') : physical('It will not budge.')))
          if (cur.disimpacted && cur.tilt <= OK_TILT) once('flat', () => feel('Your thumb pushes the distal fragment volar: the dorsal bump flattens.'))
        }}
        onUp={() => (grip.current = null)}
      >
        <LateralView tilt={r.tilt} short={r.short} counter={r.counter} traction={r.traction} svgRef={svg} />
      </TouchPad>
      <p className="io-small">{r.held ? 'Holding traction.' : r.traction > 0.05 ? 'Light traction.' : 'Not pulling.'} The wrist {r.tilt > OK_TILT ? 'still has a dorsal bump' : 'looks straight from the side'}.</p>
      <TouchPad
        svg={ap}
        aspect="200 / 170"
        className="mx-auto mt-2 max-w-[200px]"
        testId="colles-ulnar"
        onDown={(p) => {
          begin()
          apGrip.current = { x: p.x, u: ulnar }
        }}
        onMove={(p) => {
          const g = apGrip.current
          if (!g) return
          // Palm down, the little finger is on your right: drag toward it.
          const u = Math.max(0, Math.min(1, g.u + (p.x - g.x) / 50))
          setUlnarState(u)
          upd(setUlnar(runRef.current, u))
        }}
        onUp={() => {
          apGrip.current = null
          if (runRef.current.disimpacted && ulnar > 0.7) feel('The hand tips toward the ulna; the radial side lengthens out.')
        }}
      >
        <HandView side="back" svgRef={ap} ulnar={ulnar} swollen={r.tilt > OK_TILT} />
      </TouchPad>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="colles-letgo"
          onClick={() => {
            const before = runRef.current
            upd(letGo(before))
            if (before.disimpacted && before.moulded < 1) physical('You let go: the fragment slips back up dorsally.')
          }}
        >
          LET GO
        </button>
      </div>
      <NextButton onClick={next} testId="colles-next">
        Backslab
      </NextButton>
    </>
  )
}

/* ================================================================ 7. backslab and mould */

function SlabStage({ run, runRef, upd, feel, physical, why, next }: Stage) {
  const r = run
  const slabs: Slab[] = ['dorsal-be', 'volar-be', 'above-elbow', 'full-cast']
  return (
    <>
      <p className="io-lede">{r.held ? 'Your hands hold the reduction.' : 'Nobody is holding the reduction.'} Choose and lay the plaster, then mould it until it sets.</p>
      <div className="io-figure aspect-[300/130]">
        <LateralView tilt={r.tilt} short={r.short} counter={r.counter} traction={r.traction} slab={r.slab} moulded={r.moulded} />
      </div>
      <div className="io-choices mt-2" data-testid="colles-slabs">
        {slabs.map((s) => (
          <button
            key={s}
            type="button"
            className="tap io-mini"
            data-on={r.slab === s || undefined}
            data-testid={`colles-slab-${s}`}
            onClick={() => {
              if (r.slab) return feel('The plaster is already on.')
              const cur = runRef.current
              upd({ slab: s, slabWhileHeld: cur.held })
              sfx.select()
              if (s === 'full-cast') why('A full cast on a fresh fracture cannot expand as it swells: compartment syndrome. A backslab.')
              else if (s === 'volar-be') why('The fragment wants to go dorsal: the slab goes on the dorsal and radial side to hold it.')
              else if (s === 'above-elbow') why('Not for a Colles in the ED: a below-elbow backslab, from below the elbow to the knuckles.')
              else feel('Padding, then the wet dorsal slab from just below the elbow to the knuckles, bandaged on.')
              if (!cur.held) physical('As you lay it on, the wrist sags back into the deformity: nobody was holding it.')
            }}
          >
            {slabName(s).toUpperCase()}
          </button>
        ))}
      </div>
      <HoldButton
        testId="colles-mould"
        disabled={!r.slab || r.moulded >= 1}
        onTick={(dt) => {
          const cur = runRef.current
          const nextR = upd(mould(cur, dt))
          if (nextR.moulded >= 1 && cur.moulded < 1) feel('Three-point mould: heel of the hand over the distal fragment, the forearm and the hand. It sets warm and hard.')
        }}
        onEnd={() => {
          const cur = runRef.current
          if (cur.moulded > 0 && cur.moulded < 1) why('Keep moulding until the plaster sets, about the time it gets warm.')
        }}
        className="mt-2 w-full"
      >
        {r.moulded >= 1 ? 'SET ✓' : 'HOLD TO MOULD (THREE-POINT)'}
      </HoldButton>
      <div className="io-choices mt-2">
        <button
          type="button"
          className="tap io-mini"
          data-testid="colles-release"
          disabled={r.traction <= 0.05}
          onClick={() => {
            const before = runRef.current
            upd(letGo(before))
            if (before.moulded < 1 && before.disimpacted) physical('You let go before it set: the fragment drifts back inside the slab.')
            else feel('You let go. The set slab holds it.')
          }}
        >
          LET GO
        </button>
      </div>
      <NextButton onClick={next} testId="colles-next">
        After
      </NextButton>
    </>
  )
}
