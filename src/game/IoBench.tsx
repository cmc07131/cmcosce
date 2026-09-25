import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { BUMP, FLAT, SHIN, classifyTibia, drillRelease, needleSeat, type Landmark, type NeedleColour } from './ioRules'

const STEPS = ['brace', 'landmark', 'clean', 'needle', 'drill', 'stylet', 'secure', 'confirm'] as const
type Step = (typeof STEPS)[number]
const STEP_LABEL: Record<Step, string> = {
  brace: 'Brace the leg',
  landmark: 'Landmark',
  clean: 'Chlorhexidine',
  needle: 'Needle on bone',
  drill: 'Drill to the pop',
  stylet: 'Stylet out',
  secure: 'Dress the hub',
  confirm: 'Aspirate and flush',
}

type Pt = { x: number; y: number }

export function IoBench({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('brace')
  const index = STEPS.indexOf(step)
  function next() {
    const following = STEPS[index + 1]
    if (following) setStep(following)
    else onDone()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="io-bench">
      <p className="px-3 font-pixel text-[8px] text-[#8a6a20]">
        Step {index + 1} of {STEPS.length} — {STEP_LABEL[step]}
      </p>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {step === 'brace' && <BraceStep onOk={next} />}
        {step === 'landmark' && <LandmarkStep onOk={next} />}
        {step === 'clean' && <CleanStep onOk={next} />}
        {step === 'needle' && <NeedleStep onOk={next} />}
        {step === 'drill' && <DrillStep onOk={next} />}
        {step === 'stylet' && <StyletStep onOk={next} />}
        {step === 'secure' && <SecureStep onOk={next} />}
        {step === 'confirm' && <ConfirmStep onOk={next} />}
      </div>
    </div>
  )
}

function Note({ bad, children }: { bad?: boolean; children: ReactNode }) {
  return <p className={`mt-2 font-body text-[20px] leading-snug ${bad ? 'text-[#8a2030]' : 'text-[#28241c]'}`}>{children}</p>
}

function pointIn(rect: DOMRect, clientX: number, clientY: number): Pt {
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
  }
}

function useDropDrag(stage: RefObject<HTMLDivElement | null>, onDrop: (id: string, at: Pt) => void) {
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop
  const pieceRef = useRef<string | null>(null)
  const [piece, setPiece] = useState<string | null>(null)
  const [at, setAt] = useState<Pt>({ x: 50, y: 50 })

  function locate(clientX: number, clientY: number): Pt {
    const rect = stage.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return { x: 50, y: 50 }
    return pointIn(rect, clientX, clientY)
  }

  useEffect(() => {
    if (!piece) return
    const move = (event: PointerEvent) => setAt(locate(event.clientX, event.clientY))
    const up = (event: PointerEvent) => {
      const id = pieceRef.current
      pieceRef.current = null
      setPiece(null)
      if (id) onDropRef.current(id, locate(event.clientX, event.clientY))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [piece])

  function begin(id: string, event: ReactPointerEvent) {
    event.preventDefault()
    pieceRef.current = id
    setAt(locate(event.clientX, event.clientY))
    setPiece(id)
  }

  return { piece, at, begin }
}

function near(at: Pt, x: number, y: number, reach: number) {
  return Math.hypot(at.x - x, at.y - y) < reach
}

function BraceStep({ onOk }: { onOk: () => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const [gloves, setGloves] = useState(false)
  const [towel, setTowel] = useState(false)
  const [left, setLeft] = useState(false)
  const [right, setRight] = useState(false)
  const [warn, setWarn] = useState('')
  const ready = gloves && towel && left && right

  const { piece, at, begin } = useDropDrag(stage, (id, drop) => {
    if (id === 'glove') {
      if (drop.x > 8 && drop.x < 92 && drop.y > 8 && drop.y < 78) {
        setGloves(true)
        setWarn('')
      } else setWarn('Drag the gloves onto the leg before you hold it.')
      return
    }
    if (!gloves) {
      setWarn('Gloves on before your hands touch the limb.')
      return
    }
    if (id === 'hand' && near(drop, 50, 58, 13)) {
      setWarn('That hand is behind the tibia. A needle that goes through can come out into you.')
      return
    }
    if (id === 'towel' && near(drop, 50, 82, 12)) {
      setTowel(true)
      setWarn('')
      return
    }
    if (id === 'hand' && near(drop, 16, 42, 14)) {
      setLeft(true)
      setWarn('')
      return
    }
    if (id === 'hand' && near(drop, 84, 42, 14)) {
      setRight(true)
      setWarn('')
      return
    }
    setWarn('Towel under the calf. One hand on each side of the shin.')
  })

  return (
    <>
      <div ref={stage} className="relative mx-auto aspect-square w-full max-w-[280px] border-4 border-[#303848] bg-[#f3e6c8]" style={{ touchAction: 'none' }}>
        <CalfSection gloves={gloves} towel={towel} left={left} right={right} />
        {piece && <Ghost at={at}>{piece === 'towel' ? <Towel /> : piece === 'glove' ? <Glove /> : <HandBlob />}</Ghost>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" className="tap text-center" disabled={gloves} onPointerDown={(event) => begin('glove', event)}>
          {gloves ? 'Gloves on' : 'Drag gloves'}
        </button>
        <button type="button" className="tap text-center" disabled={!gloves || towel} onPointerDown={(event) => begin('towel', event)}>
          {towel ? 'Towel in' : 'Drag towel'}
        </button>
        <button type="button" className="tap text-center" disabled={!gloves || (left && right)} onPointerDown={(event) => begin('hand', event)}>
          {left && right ? 'Hands placed' : 'Drag a hand'}
        </button>
      </div>
      {warn && <Note bad>{warn}</Note>}
      {ready && <Note>Leg supported. Hands are off the exit path.</Note>}
      {ready && (
        <button type="button" className="tap mt-2 bg-[#e7f6d4]" onClick={onOk}>
          Find the landmark
        </button>
      )}
    </>
  )
}

function shinPoint(event: ReactPointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * SHIN.w,
    y: ((event.clientY - rect.top) / rect.height) * SHIN.h,
  }
}

const LANDMARK_NOTE: Record<Landmark, string> = {
  flat: 'Flat anteromedial tibia, about 2 cm medial to the tuberosity, about 3 cm below the patella. Aim 90 degrees, away from the joint.',
  bump: 'That bump is the tibial tuberosity itself. Come medial, onto the flat cortex.',
  joint: 'That is the joint line. You would drill into the knee.',
  shaft: 'That is tibia, but not the flat anteromedial point. About 2 cm medial to the tuberosity, and about 3 cm below the patella.',
  off: 'Stay on the shin.',
}

function LandmarkStep({ onOk }: { onOk: () => void }) {
  const [hit, setHit] = useState<Landmark | null>(null)
  const [finger, setFinger] = useState<Pt | null>(null)
  const [patella, setPatella] = useState(false)

  return (
    <>
      <div
        className="relative mx-auto border-4 border-[#303848] bg-[#f3e6c8]"
        style={{ width: 220, height: 286, touchAction: 'none' }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          const spot = shinPoint(event)
          setFinger({ x: (spot.x / SHIN.w) * 100, y: (spot.y / SHIN.h) * 100 })
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          const spot = shinPoint(event)
          setFinger({ x: (spot.x / SHIN.w) * 100, y: (spot.y / SHIN.h) * 100 })
        }}
        onPointerUp={(event) => {
          const spot = shinPoint(event)
          setFinger(null)
          if (Math.hypot(spot.x - 100, spot.y - 46) < 22) {
            setPatella(true)
            setHit(null)
            return
          }
          setPatella(false)
          setHit(classifyTibia(spot.x, spot.y))
        }}
      >
        <Shin dent={hit === 'flat'} />
        {finger && <Ghost at={finger}><Fingertip /></Ghost>}
      </div>
      <Note>Left knee, from the front. Press a fingertip dent on the insertion point.</Note>
      {patella && <Note bad>That is the patella. Come below the joint line, onto the tibia.</Note>}
      {hit && <Note bad={hit !== 'flat'}>{LANDMARK_NOTE[hit]}</Note>}
      {hit === 'flat' && (
        <button type="button" className="tap mt-2 bg-[#e7f6d4]" onClick={onOk}>
          Mark that point
        </button>
      )}
    </>
  )
}

function CleanStep({ onOk }: { onOk: () => void }) {
  const last = useRef<{ x: number; y: number } | null>(null)
  const [wiped, setWiped] = useState(0)
  const [dry, setDry] = useState(false)
  const [swab, setSwab] = useState<Pt | null>(null)

  useEffect(() => {
    if (wiped < 100 || dry) return
    const id = window.setTimeout(() => setDry(true), 900)
    return () => window.clearTimeout(id)
  }, [wiped, dry])

  return (
    <>
      <div
        className="relative mx-auto border-4 border-[#303848] bg-[#f3e6c8]"
        style={{ width: 220, height: 286, touchAction: 'none' }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          last.current = shinPoint(event)
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId) || dry) return
          const spot = shinPoint(event)
          setSwab({ x: (spot.x / SHIN.w) * 100, y: (spot.y / SHIN.h) * 100 })
          if (!last.current) {
            last.current = spot
            return
          }
          const travel = Math.hypot(spot.x - last.current.x, spot.y - last.current.y)
          last.current = spot
          if (Math.hypot(spot.x - FLAT.x, spot.y - FLAT.y) < 40 && travel > 1) {
            setWiped((value) => Math.min(100, value + travel * 0.4))
          }
        }}
        onPointerUp={() => {
          last.current = null
          setSwab(null)
        }}
      >
        <Shin dent />
        {swab && <Ghost at={swab}><Swab /></Ghost>}
        <div className="absolute right-2 bottom-2 left-2 h-2 bg-[#fffbec]">
          <div className="h-full bg-[#2a6f9a]" style={{ width: `${wiped}%` }} />
        </div>
      </div>
      <Note>{dry ? 'Site is dry. Do not touch it again.' : 'Scrub chlorhexidine over the dent, then let it dry.'}</Note>
      {dry && (
        <button type="button" className="tap mt-2 bg-[#e7f6d4]" onClick={onOk}>
          Site is dry
        </button>
      )}
    </>
  )
}

function NeedleStep({ onOk }: { onOk: () => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const [seated, setSeated] = useState<NeedleColour | null>(null)
  const [warn, setWarn] = useState('')
  const { piece, at, begin } = useDropDrag(stage, (id, drop) => {
    const colour = id as NeedleColour
    const where = classifyTibia((drop.x / 100) * SHIN.w, (drop.y / 100) * SHIN.h)
    if (where !== 'flat') {
      setWarn(where === 'off' ? 'Seat the tip on the dent, with the driver still off.' : LANDMARK_NOTE[where])
      return
    }
    setSeated(colour)
    setWarn('')
  })
  const verdict = seated ? needleSeat(seated) : null

  return (
    <>
      {!seated && (
        <div ref={stage} className="relative mx-auto border-4 border-[#303848] bg-[#f3e6c8]" style={{ width: 220, height: 286, touchAction: 'none' }}>
          <Shin dent />
          {piece && <Ghost at={at}><NeedleGlyph colour={piece as NeedleColour} /></Ghost>}
        </div>
      )}
      {seated && <MarkCheck colour={seated} />}
      {!seated && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(['pink', 'blue', 'yellow'] as const).map((colour) => (
            <button key={colour} type="button" className="tap text-center" onPointerDown={(event) => begin(colour, event)}>
              {colour === 'pink' ? 'Pink 15' : colour === 'blue' ? 'Blue 25' : 'Yellow 45'}
            </button>
          ))}
        </div>
      )}
      {warn && <Note bad>{warn}</Note>}
      {verdict === 'short' && <Note bad>The 5 mm mark is buried in soft tissue. This adult tibia needs a longer needle.</Note>}
      {verdict === 'long' && <Note bad>The 5 mm line is visible, but this is a normal adult tibia. Yellow is for extra tissue or the humerus. A long needle is how you drill through.</Note>}
      {verdict === 'adult' && <Note>Tip is on bone. Driver is still off. At least one black 5 mm line sits above the skin.</Note>}
      {seated && verdict !== 'adult' && (
        <button type="button" className="tap mt-2" onClick={() => setSeated(null)}>
          Take this needle off
        </button>
      )}
      {verdict === 'adult' && (
        <button type="button" className="tap mt-2 bg-[#e7f6d4]" onClick={onOk}>
          Length is enough. Drill.
        </button>
      )}
    </>
  )
}

function DrillStep({ onOk }: { onOk: () => void }) {
  const depth = useRef(30)
  const holding = useRef(false)
  const sent = useRef(false)
  const onOkRef = useRef(onOk)
  onOkRef.current = onOk
  const [snap, setSnap] = useState({ depth: 30, holding: false })
  const [early, setEarly] = useState(false)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(40, now - last)
      last = now
      if (holding.current && drillRelease(depth.current) !== 'through') {
        const speed = depth.current >= 56 ? 0.06 : 0.016
        depth.current = Math.min(100, depth.current + speed * dt)
        if (drillRelease(depth.current) === 'through') holding.current = false
      }
      setSnap((cur) => (cur.depth === depth.current && cur.holding === holding.current ? cur : { depth: depth.current, holding: holding.current }))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  function release() {
    holding.current = false
    if (sent.current) return
    const verdict = drillRelease(depth.current)
    if (verdict === 'seated') {
      sent.current = true
      onOkRef.current()
    } else if (verdict === 'early') setEarly(true)
  }

  function start(event: ReactPointerEvent) {
    event.preventDefault()
    if (drillRelease(depth.current) === 'through' || sent.current) return
    setEarly(false)
    holding.current = true
    const up = () => {
      window.removeEventListener('pointerup', up)
      release()
    }
    window.addEventListener('pointerup', up)
  }

  const verdict = drillRelease(snap.depth)
  const popped = snap.depth >= 56 && verdict !== 'through'

  return (
    <>
      <CrossSection depth={snap.depth} through={verdict === 'through'} popped={popped} />
      <button type="button" className="tap mt-2 text-center" disabled={verdict === 'through'} onPointerDown={start}>
        {snap.holding ? 'Drilling… release on the pop' : 'Hold to drill'}
      </button>
      {verdict === 'early' && !early && <Note>Tip is on cortex. Hold the trigger, and release when the resistance gives.</Note>}
      {early && verdict === 'early' && <Note>Still in cortex. Hold until the sudden give, then release the trigger.</Note>}
      {popped && <Note>Sudden give. Release the trigger before the tip meets the far cortex.</Note>}
      {verdict === 'through' && (
        <>
          <Note bad>You kept drilling after the pop. The tip is in the soft tissue behind the tibia. That is through-and-through.</Note>
          <button
            type="button"
            className="tap mt-2"
            onClick={() => {
              depth.current = 30
              setEarly(false)
              setSnap({ depth: 30, holding: false })
            }}
          >
            Withdraw and seat it on cortex again
          </button>
        </>
      )}
    </>
  )
}

function StyletStep({ onOk }: { onOk: () => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const [gripped, setGripped] = useState(false)
  const [driverOff, setDriverOff] = useState(false)
  const [inCup, setInCup] = useState(false)
  const [warn, setWarn] = useState('')
  const spin = useSpin('ccw')
  const { piece, at, begin } = useDropDrag(stage, (id, drop) => {
    if (id === 'driver') {
      if (!gripped) {
        setWarn('Hold the hub first. If you pull the driver alone, the catheter comes with it.')
        return
      }
      if (drop.y < 22) {
        setDriverOff(true)
        setWarn('')
      } else setWarn('Pull the driver straight up, off the hub.')
      return
    }
    if (!driverOff || spin.turns < 1) {
      setWarn('Unscrew the stylet counter-clockwise before it goes in the sharps cup.')
      return
    }
    if (near(drop, 50, 86, 16)) {
      setInCup(true)
      setWarn('')
    } else setWarn('Straight down into the NeedleVISE. Keep your other hand away from the cup.')
  })

  return (
    <>
      <div ref={stage} className="relative mx-auto h-[240px] w-full max-w-[280px] border-4 border-[#303848] bg-[#f7f1e4]" style={{ touchAction: 'none' }}>
        <div className="absolute top-[46%] right-8 left-8 h-3 bg-[#f4f6f8]" />
        <div className="absolute top-[52%] right-8 left-8 h-16 bg-[#e7b8a0]" />
        <div className="absolute top-[38%] left-1/2 h-8 w-8 -translate-x-1/2 border-4 border-[#303848] bg-[#8eb4e8]" />
        <p className="absolute top-[34%] left-2 font-body text-[16px]">Hub</p>
        {!driverOff && <div className="absolute top-[8%] left-1/2 h-14 w-16 -translate-x-1/2 border-4 border-[#303848] bg-[#d9dde6]" />}
        {driverOff && (
          <div
            className="absolute h-16 w-16 rounded-full border-4 border-[#303848] bg-[#f4f6f8]"
            style={{ left: '50%', top: '12%', marginLeft: -32, transform: `rotate(${-spin.turns * 360}deg)`, touchAction: 'none' }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              event.stopPropagation()
              spin.down()
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
              const rect = event.currentTarget.getBoundingClientRect()
              spin.move(rect.left + rect.width / 2, rect.top + rect.height / 2, event.clientX, event.clientY)
            }}
            onPointerUp={spin.up}
          />
        )}
        <div className="absolute right-6 bottom-3 h-10 w-16 border-4 border-[#303848] bg-[#f0d56a]" />
        <p className="absolute bottom-4 left-2 font-body text-[16px]">NeedleVISE</p>
        {piece && <Ghost at={at}>{piece === 'driver' ? <DriverBlock /> : <StyletBit />}</Ghost>}
      </div>
      <button type="button" className="tap mt-2" onClick={() => setGripped(true)}>
        {gripped ? 'Hub held' : 'Grip the hub'}
      </button>
      {!driverOff && (
        <button type="button" className="tap mt-2" onPointerDown={(event) => begin('driver', event)}>
          Pull the driver off
        </button>
      )}
      {driverOff && spin.turns < 1 && <Note>Twist the stylet counter-clockwise until it comes free. {Math.min(1, spin.turns).toFixed(1)} / 1 turn.</Note>}
      {spin.opposed && <Note bad>The stylet unscrews counter-clockwise.</Note>}
      {driverOff && spin.turns >= 1 && !inCup && (
        <button type="button" className="tap mt-2" onPointerDown={(event) => begin('stylet', event)}>
          Drop the stylet in the cup
        </button>
      )}
      {warn && <Note bad>{warn}</Note>}
      {inCup && <Note>Hub stands proud and does not wobble. Stylet is in the sharps cup.</Note>}
      {inCup && (
        <button type="button" className="tap mt-2 bg-[#e7f6d4]" onClick={onOk}>
          Dress the hub
        </button>
      )}
    </>
  )
}

function SecureStep({ onOk }: { onOk: () => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const [stabilizer, setStabilizer] = useState(false)
  const [primed, setPrimed] = useState(0)
  const [seated, setSeated] = useState(false)
  const [open, setOpen] = useState(false)
  const [warn, setWarn] = useState('')
  const primeTimer = useRef(0)
  const spin = useSpin('cw')
  useEffect(() => () => window.clearInterval(primeTimer.current), [])
  const locked = seated && spin.turns >= 0.5
  const { piece, at, begin } = useDropDrag(stage, (id, drop) => {
    const onHub = near(drop, 50, 42, 16)
    if (id === 'stabilizer') {
      if (!onHub) {
        setWarn('The dressing sits on the hub.')
        return
      }
      setStabilizer(true)
      setWarn('')
      return
    }
    if (!stabilizer) {
      setWarn('The extension will not sit until the stabilizer is on the hub.')
      return
    }
    if (primed < 100) {
      setWarn('Prime the extension with saline before you connect it.')
      return
    }
    if (!onHub) {
      setWarn('Press the connector onto the hub, then twist it clockwise.')
      return
    }
    setSeated(true)
    setWarn('')
  })

  return (
    <>
      <div ref={stage} className="relative mx-auto h-[220px] w-full max-w-[280px] border-4 border-[#303848] bg-[#f7f1e4]" style={{ touchAction: 'none' }}>
        <div className="absolute top-[58%] right-8 left-8 h-14 bg-[#e7b8a0]" />
        <div className="absolute top-[36%] left-1/2 h-8 w-8 -translate-x-1/2 border-4 border-[#303848] bg-[#8eb4e8]" />
        {stabilizer && <div className="absolute top-[30%] left-1/2 h-14 w-20 -translate-x-1/2 border-4 border-[#1d6b32] bg-[#d9f0d0]/80" />}
        {seated && <div className="absolute top-[18%] left-1/2 h-8 w-24 -translate-x-1/2 border-4 border-[#303848]" style={{ background: '#c5d4e8' }} />}
        <p className="absolute bottom-2 left-2 font-body text-[16px]">{open ? 'Clamp open' : locked ? 'Twist locked' : 'Hub'}</p>
        {piece && <Ghost at={at}>{piece === 'stabilizer' ? <Dressing /> : <ExtensionBit primed={primed >= 100} />}</Ghost>}
      </div>
      {!stabilizer && (
        <button type="button" className="tap mt-2" onPointerDown={(event) => begin('stabilizer', event)}>
          Drag the EZ-Stabilizer onto the hub
        </button>
      )}
      {primed < 100 && (
        <button
          type="button"
          className="tap mt-2"
          onPointerDown={() => {
            window.clearInterval(primeTimer.current)
            primeTimer.current = window.setInterval(() => setPrimed((value) => Math.min(100, value + 8)), 70)
            const up = () => {
              window.clearInterval(primeTimer.current)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointerup', up)
          }}
        >
          Hold — prime the extension with saline ({primed}%)
        </button>
      )}
      {stabilizer && primed >= 100 && !seated && (
        <button type="button" className="tap mt-2" onPointerDown={(event) => begin('extension', event)}>
          Drag the primed extension onto the hub
        </button>
      )}
      {seated && !locked && (
        <div
          className="mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#303848] bg-[#fffbec] font-body text-[16px]"
          style={{ touchAction: 'none' }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            spin.down()
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const rect = event.currentTarget.getBoundingClientRect()
            spin.move(rect.left + rect.width / 2, rect.top + rect.height / 2, event.clientX, event.clientY)
          }}
          onPointerUp={spin.up}
        >
          Twist
        </div>
      )}
      {seated && !locked && <Note>Twist the connector clockwise until it locks.</Note>}
      {spin.opposed && <Note bad>Clockwise locks the extension.</Note>}
      {locked && !open && (
        <button type="button" className="tap mt-2" onClick={() => setOpen(true)}>
          Open the clamp
        </button>
      )}
      {warn && <Note bad>{warn}</Note>}
      {open && (
        <button type="button" className="tap mt-2 bg-[#e7f6d4]" onClick={onOk}>
          Line is on the hub
        </button>
      )}
    </>
  )
}

function ConfirmStep({ onOk }: { onOk: () => void }) {
  const [pull, setPull] = useState(0)
  const [marrow, setMarrow] = useState(false)
  const [lido, setLido] = useState(0)
  const [dwell, setDwell] = useState(false)
  const [flushed, setFlushed] = useState(false)
  const [topup, setTopup] = useState(0)
  const [warn, setWarn] = useState('')
  const origin = useRef(0)
  const timer = useRef(0)

  useEffect(() => () => window.clearInterval(timer.current), [])
  useEffect(() => {
    if (lido < 100 || dwell) return
    const id = window.setTimeout(() => setDwell(true), 1200)
    return () => window.clearTimeout(id)
  }, [lido, dwell])

  function hold(kind: 'lido' | 'top') {
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      if (kind === 'lido') setLido((value) => Math.min(100, value + 4))
      else setTopup((value) => Math.min(100, value + 8))
    }, 80)
    const up = () => {
      window.clearInterval(timer.current)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointerup', up)
  }

  return (
    <>
      <div className="mx-auto flex h-28 items-end justify-center gap-6">
        <div
          className="relative h-28 w-14"
          style={{ touchAction: 'none' }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            origin.current = event.clientY - pull
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const next = Math.max(0, Math.min(72, origin.current - event.clientY))
            setPull(next)
            if (next > 40) setMarrow(true)
          }}
        >
          <div className="absolute right-2 bottom-0 left-2 h-16 border-4 border-[#303848] bg-[#f4f6f8]">
            {marrow && <div className="absolute right-1 bottom-1 left-1 h-4 bg-[#e07080]" />}
          </div>
          <div className="absolute right-1 left-1 h-4 border-2 border-[#303848] bg-[#d9dde6]" style={{ bottom: 52 + pull }} />
        </div>
        <CalfWatch soft />
      </div>
      <Note>{marrow ? 'Marrow is back. No marrow would still be acceptable if the needle is firm.' : 'Pull the plunger up to aspirate.'}</Note>
      <button type="button" className="tap trap mt-2" onClick={() => setWarn('He withdraws to pain. The flush hurts more than the drill. Give plain lidocaine before a pressure bag.')}>
        Skip lidocaine and pressure-bag the litre
      </button>
      {marrow && lido < 100 && (
        <button type="button" className="tap mt-2" onPointerDown={() => hold('lido')}>
          Hold — 40 mg plain 2% lidocaine, slowly ({lido}%)
        </button>
      )}
      {lido >= 100 && !dwell && <Note>Dwell. In the exam this is one minute. The flush waits.</Note>}
      {dwell && !flushed && (
        <button
          type="button"
          className="tap mt-2"
          onPointerDown={(event) => {
            const started = { y: event.clientY, t: performance.now() }
            const up = (pointer: PointerEvent) => {
              window.removeEventListener('pointerup', up)
              const pushed = pointer.clientY - started.y
              const dt = performance.now() - started.t
              if (pushed < 28) return
              if (dt < 320) {
                setFlushed(true)
                setWarn('')
              } else setWarn('That was a trickle. Flush 10 mL hard, or the marrow will not flow.')
            }
            window.addEventListener('pointerup', up)
          }}
        >
          Flick the 10 mL saline flush downward
        </button>
      )}
      {flushed && <Note>Flush is easy. The calf is soft. No extra-osseous swelling.</Note>}
      {flushed && topup < 100 && (
        <button type="button" className="tap mt-2" onPointerDown={() => hold('top')}>
          Hold — second dose, 20 mg over a minute ({topup}%)
        </button>
      )}
      {warn && <Note bad>{warn}</Note>}
      {topup >= 100 && (
        <button type="button" className="tap mt-2 bg-[#e7f6d4]" onClick={onOk}>
          The IO is in
        </button>
      )}
    </>
  )
}

function useSpin(direction: 'cw' | 'ccw') {
  const prev = useRef<number | null>(null)
  const acc = useRef(0)
  const [turns, setTurns] = useState(0)
  const [opposed, setOpposed] = useState(false)

  function down() {
    prev.current = null
  }
  function move(cx: number, cy: number, x: number, y: number) {
    const ang = Math.atan2(y - cy, x - cx)
    if (prev.current == null) {
      prev.current = ang
      return
    }
    let delta = ang - prev.current
    if (delta > Math.PI) delta -= Math.PI * 2
    if (delta < -Math.PI) delta += Math.PI * 2
    prev.current = ang
    const signed = direction === 'cw' ? delta : -delta
    if (signed > 0) {
      acc.current += signed
      setTurns(acc.current / (Math.PI * 2))
      setOpposed(false)
    } else if (signed < -0.08) setOpposed(true)
  }
  function up() {
    prev.current = null
  }
  return { turns, opposed, down, move, up }
}

function Ghost({ at, children }: { at: Pt; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-10" style={{ left: `${at.x}%`, top: `${at.y}%`, transform: 'translate(-50%, -50%)' }}>
      {children}
    </div>
  )
}

function CalfSection({ gloves, towel, left, right }: { gloves: boolean; towel: boolean; left: boolean; right: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <ellipse cx="100" cy="78" rx="70" ry="58" fill="#f0d2b4" stroke="#303848" strokeWidth="3" />
      <ellipse cx="100" cy="48" rx="24" ry="16" fill="#f7f4ee" stroke="#303848" strokeWidth="3" />
      <text x="112" y="44" fontFamily="VT323, monospace" fontSize="13" fill="#28241c">Tibia</text>
      <ellipse cx="62" cy="70" rx="9" ry="7" fill="#f7f4ee" stroke="#303848" strokeWidth="2" />
      <text x="28" y="66" fontFamily="VT323, monospace" fontSize="12" fill="#28241c">Fibula</text>
      <text x="78" y="24" fontFamily="VT323, monospace" fontSize="12" fill="#28241c">Anterior</text>
      {towel && <rect x="40" y="156" width="120" height="18" fill="#efe6cf" stroke="#303848" strokeWidth="2" />}
      {!towel && <rect x="40" y="156" width="120" height="18" fill="none" stroke="#303848" strokeDasharray="4 3" />}
      <text x="78" y="190" fontFamily="VT323, monospace" fontSize="12" fill="#28241c">Towel</text>
      {left && <ellipse cx="32" cy="84" rx="12" ry="18" fill="#f4d7b8" stroke="#303848" />}
      {right && <ellipse cx="168" cy="84" rx="12" ry="18" fill="#f4d7b8" stroke="#303848" />}
      {!left && <ellipse cx="32" cy="84" rx="12" ry="18" fill="none" stroke="#303848" strokeDasharray="3 2" />}
      {!right && <ellipse cx="168" cy="84" rx="12" ry="18" fill="none" stroke="#303848" strokeDasharray="3 2" />}
      {gloves && <text x="8" y="16" fontFamily="VT323, monospace" fontSize="13" fill="#1d6b32">Gloves</text>}
    </svg>
  )
}

function Shin({ dent }: { dent?: boolean }) {
  return (
    <svg viewBox={`0 0 ${SHIN.w} ${SHIN.h}`} className="h-full w-full">
      <path d="M58 0 H142 L148 36 H52 Z" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
      <ellipse cx="100" cy="48" rx="30" ry="18" fill="#f0d2b4" stroke="#303848" strokeWidth="2" />
      <ellipse cx="100" cy="46" rx="16" ry="10" fill="#f7e6d4" stroke="#303848" strokeWidth="2" />
      <text x="128" y="40" fontFamily="VT323, monospace" fontSize="13" fill="#28241c">Patella</text>
      <path d="M66 78 Q100 92 134 78" fill="none" stroke="#a33a32" strokeWidth="2" />
      <text x="140" y="84" fontFamily="VT323, monospace" fontSize="12" fill="#8a2030">Joint</text>
      <path d="M70 86 Q64 150 72 248 H128 Q136 150 130 86 Q112 100 100 96 Q84 100 70 86" fill="#f0d2b4" stroke="#303848" strokeWidth="2" />
      <ellipse cx={BUMP.x} cy={BUMP.y} rx="14" ry="10" fill="#f8e6d2" stroke="#303848" strokeWidth="2" />
      <text x="8" y="112" fontFamily="VT323, monospace" fontSize="12" fill="#28241c">Tuberosity</text>
      <text x="8" y="168" fontFamily="VT323, monospace" fontSize="12" fill="#28241c">Lateral</text>
      <text x="150" y="196" fontFamily="VT323, monospace" fontSize="12" fill="#28241c">Medial</text>
      {dent && <circle cx={FLAT.x} cy={FLAT.y} r="7" fill="#a33a32" stroke="#303848" />}
    </svg>
  )
}

function MarkCheck({ colour }: { colour: NeedleColour }) {
  const tall = colour === 'yellow' ? 120 : colour === 'blue' ? 78 : 40
  const mark = colour === 'pink' ? 48 : colour === 'blue' ? 74 : 108
  return (
    <div className="relative mx-auto h-[170px] w-[150px] border-4 border-[#303848] bg-[#f7f1e4]">
      <div className="absolute right-4 bottom-0 left-4 h-8 bg-[#f4f6f8]" />
      <div className="absolute right-0 bottom-8 left-0 h-8 bg-[#e7c4a8]" />
      <div className="absolute left-1/2 w-3 -translate-x-1/2 bg-[#d0d6e0]" style={{ bottom: 32, height: tall }} />
      <div className="absolute left-1/2 h-1 w-8 -translate-x-1/2 bg-[#181818]" style={{ bottom: mark }} />
      <div className="absolute right-0 bottom-16 left-0 h-0.5 bg-[#303848]" />
      <p className="absolute top-1 left-1 font-body text-[16px]">{colour === 'pink' ? 'Mark hidden' : '5 mm mark'}</p>
      <p className="absolute right-1 bottom-16 font-body text-[14px]">Skin</p>
      <p className="absolute bottom-1 left-1 font-body text-[14px]">Bone</p>
    </div>
  )
}

function CrossSection({ depth, through, popped }: { depth: number; through: boolean; popped: boolean }) {
  return (
    <div className="relative mx-auto h-[220px] w-[180px] border-4 border-[#303848] bg-[#f7f1e4]">
      <div className="absolute top-0 right-0 left-0 h-5 bg-[#e7b8a8]" />
      <div className="absolute top-5 right-0 left-0 h-6 bg-[#f0d2b4]" />
      <div className="absolute top-[44px] right-6 left-6 h-8 bg-[#f4f6f8]" />
      <div className="absolute top-[76px] right-6 left-6 h-14 bg-[#e07080]" />
      <div className="absolute top-[132px] right-6 left-6 h-4 bg-[#f4f6f8]" />
      <div className="absolute top-[148px] right-4 bottom-0 left-4 bg-[#f0d2b4]" />
      <div className="absolute left-1/2 w-2 -translate-x-1/2 bg-[#c5ccd6]" style={{ top: 0, height: `${Math.min(depth, 96)}%` }} />
      <p className="absolute top-1 left-1 font-body text-[14px]">Skin</p>
      <p className="absolute top-[48px] left-1 font-body text-[14px]">Cortex</p>
      <p className="absolute top-[96px] left-1 font-body text-[14px] text-[#fffbec]">Marrow</p>
      {popped && <p className="absolute top-[78px] right-1 font-body text-[14px]">Give</p>}
      {through && <p className="absolute right-1 bottom-1 left-1 font-body text-[16px] text-[#8a2030]">Far cortex breached</p>}
    </div>
  )
}

function CalfWatch({ soft }: { soft: boolean }) {
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20">
      <ellipse cx="40" cy="40" rx="28" ry="22" fill={soft ? '#f0d2b4' : '#e07080'} stroke="#303848" strokeWidth="2" />
      <text x="18" y="44" fontFamily="VT323, monospace" fontSize="12" fill="#28241c">Calf</text>
    </svg>
  )
}

function HandBlob() {
  return <div className="h-8 w-6 rounded-full border-2 border-[#303848] bg-[#f4d7b8]" />
}
function Glove() {
  return <div className="h-7 w-7 border-2 border-[#303848] bg-[#d9f0d0]" />
}
function Towel() {
  return <div className="h-4 w-12 border-2 border-[#303848] bg-[#efe6cf]" />
}
function Fingertip() {
  return <div className="h-5 w-5 rounded-full border-2 border-[#303848] bg-[#f4d7b8]" />
}
function Swab() {
  return <div className="h-4 w-8 border-2 border-[#303848] bg-[#d7ecf5]" />
}
function NeedleGlyph({ colour }: { colour: NeedleColour }) {
  const fill = colour === 'pink' ? '#f3b4c4' : colour === 'blue' ? '#8eb4e8' : '#f0d56a'
  const h = colour === 'yellow' ? 46 : colour === 'blue' ? 32 : 20
  return (
    <div className="flex flex-col items-center">
      <div className="h-4 w-6 border-2 border-[#303848]" style={{ background: fill }} />
      <div className="w-1 bg-[#d0d6e0]" style={{ height: h }} />
    </div>
  )
}
function DriverBlock() {
  return <div className="h-10 w-12 border-2 border-[#303848] bg-[#d9dde6]" />
}
function StyletBit() {
  return <div className="h-10 w-1 bg-[#303848]" />
}
function Dressing() {
  return <div className="h-8 w-12 border-2 border-[#1d6b32] bg-[#d9f0d0]" />
}
function ExtensionBit({ primed }: { primed: boolean }) {
  return <div className="h-3 w-16 border-2 border-[#303848]" style={{ background: primed ? '#8eb4e8' : '#f4f6f8' }} />
}
