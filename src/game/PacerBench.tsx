import { useEffect, useRef, useState } from 'react'

type Spec = { rate: number; thr: number; margin: number }

function specFrom(pose?: string): Spec {
  const read = (key: string, fallback: number) => {
    const found = new RegExp(`${key}=(\\d+)`).exec(pose ?? '')
    return found ? Number(found[1]) : fallback
  }
  return { rate: read('rate', 70), thr: read('thr', 60), margin: read('margin', 10) }
}

export function PacerBench({ pose, onDone }: { pose?: string; onDone: () => void }) {
  if (pose === 'pads') return <PadPlacement onDone={onDone} />
  if (pose === 'pulse') return <FemoralPulse onDone={onDone} />
  return <PacerConsole spec={specFrom(pose)} onDone={onDone} />
}

function PadPlacement({ onDone }: { onDone: () => void }) {
  const torso = useRef<HTMLDivElement>(null)
  const [back, setBack] = useState(false)
  const [drag, setDrag] = useState<'anterior' | 'posterior' | null>(null)
  const [at, setAt] = useState({ x: 50, y: 80 })
  const [placed, setPlaced] = useState({ anterior: false, posterior: false, chest: false, apex: false })
  const done = useRef(false)

  function pointFrom(clientX: number, clientY: number) {
    const rect = torso.current?.getBoundingClientRect()
    if (!rect) return at
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  useEffect(() => {
    if (!drag) return
    const move = (event: PointerEvent) => setAt(pointFrom(event.clientX, event.clientY))
    const up = (event: PointerEvent) => {
      drop(drag, pointFrom(event.clientX, event.clientY))
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [drag])

  function finish(next: typeof placed) {
    const ap = next.anterior && next.posterior
    const al = next.chest && next.apex
    if ((ap || al) && !done.current) {
      done.current = true
      onDone()
    }
  }

  function drop(which: 'anterior' | 'posterior', point: { x: number; y: number }) {
    const near = (x: number, y: number) => Math.hypot(point.x - x, point.y - y) < 14
    setPlaced((cur) => {
      const next = { ...cur }
      if (!back && which === 'anterior' && near(58, 48)) next.anterior = true
      if (!back && which === 'anterior' && near(36, 30)) next.chest = true
      if (!back && which === 'posterior' && near(70, 64)) next.apex = true
      if (back && which === 'posterior' && near(42, 42)) next.posterior = true
      finish(next)
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button type="button" className="tap mx-3 mt-2" onClick={() => setBack((v) => !v)}>
        {back ? 'Show the front of the chest' : 'Roll him — show the back'}
      </button>
      <div
        ref={torso}
        className="relative mx-3 mt-2 min-h-[240px] flex-1 border-4 border-[#303848] bg-[#e7d7c4]"
      >
        {back ? <BackChest /> : <FrontChest />}
        {!back && <Zone x={58} y={48} label="AP anterior" on={placed.anterior} />}
        {!back && <Zone x={36} y={30} label="AL chest" on={placed.chest} />}
        {!back && <Zone x={70} y={64} label="AL apex" on={placed.apex} />}
        {back && <Zone x={42} y={42} label="AP posterior" on={placed.posterior} />}
        {drag && (
          <div className="pointer-events-none absolute h-8 w-14 -translate-x-1/2 -translate-y-1/2 border-2 border-[#303848] bg-[#f4f6f8]" style={{ left: `${at.x}%`, top: `${at.y}%` }} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 py-2">
        <button type="button" className="tap" disabled={placed.anterior || placed.chest} onPointerDown={() => setDrag('anterior')}>
          {placed.anterior || placed.chest ? 'First pad on' : 'Drag anterior pad'}
        </button>
        <button type="button" className="tap" disabled={placed.posterior || placed.apex} onPointerDown={() => setDrag('posterior')}>
          {placed.posterior || placed.apex ? 'Second pad on' : 'Drag the other pad'}
        </button>
      </div>
      <p className="px-3 pb-2 font-body text-[18px] text-[#3a3428]">
        {placed.anterior && placed.posterior
          ? 'Anterior–posterior. That is the better vector.'
          : placed.chest && placed.apex
            ? 'Anterior–lateral. Acceptable if you cannot roll him.'
            : 'Anterior pad: left lower sternal edge. Posterior: left of the spine, under the scapula.'}
      </p>
    </div>
  )
}

function Zone({ x, y, label, on }: { x: number; y: number; label: string; on: boolean }) {
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border-2 border-dashed px-1 text-center font-body text-[14px] leading-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        borderColor: on ? '#1d6b32' : '#303848',
        background: on ? '#d9f0d0' : '#fffbeccc',
      }}
    >
      {on ? 'On' : label}
    </div>
  )
}

function FrontChest() {
  return (
    <svg viewBox="0 0 200 260" className="pointer-events-none absolute inset-0 h-full w-full">
      <ellipse cx="100" cy="28" rx="22" ry="18" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
      <path d="M40 70 Q20 120 36 200 H164 Q180 120 160 70 Q130 90 100 78 Q70 90 40 70" fill="#f0d2b4" stroke="#303848" strokeWidth="2" />
      <path d="M100 78 V168" stroke="#303848" strokeWidth="2" />
      <path d="M78 110 H122 M74 130 H126 M78 150 H122" stroke="#c49a78" strokeWidth="2" />
      <text x="108" y="120" fontFamily="VT323, monospace" fontSize="13" fill="#28241c">
        Sternum
      </text>
      <circle cx="78" cy="128" r="4" fill="#c4897a" />
      <circle cx="122" cy="128" r="4" fill="#c4897a" />
    </svg>
  )
}

function BackChest() {
  return (
    <svg viewBox="0 0 200 260" className="pointer-events-none absolute inset-0 h-full w-full">
      <path d="M46 64 Q100 40 154 64 L168 200 H32 Z" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
      <path d="M100 70 V200" stroke="#303848" strokeWidth="3" />
      <path d="M62 90 Q80 140 70 190" fill="none" stroke="#c49a78" strokeWidth="8" />
      <path d="M138 90 Q120 140 130 190" fill="none" stroke="#c49a78" strokeWidth="8" />
      <text x="112" y="150" fontFamily="VT323, monospace" fontSize="13" fill="#28241c">
        Spine
      </text>
      <text x="8" y="120" fontFamily="VT323, monospace" fontSize="13" fill="#28241c">
        Scapula
      </text>
    </svg>
  )
}

function PacerConsole({ spec, onDone }: { spec: Spec; onDone: () => void }) {
  const [mode, setMode] = useState<'monitor' | 'defib' | 'pacer'>('defib')
  const [sensing, setSensing] = useState<'unset' | 'demand' | 'fixed'>('unset')
  const [rate, setRate] = useState(40)
  const [output, setOutput] = useState(0)
  const [shocked, setShocked] = useState(false)
  const done = useRef(false)
  const rateOk = rate >= spec.rate - 10 && rate <= spec.rate + 10
  const electrical = mode === 'pacer' && sensing === 'demand' && rateOk && output >= spec.thr
  const marginOk = output >= spec.thr + 5 && output <= spec.thr + spec.margin

  useEffect(() => {
    if (electrical && marginOk && !done.current) {
      done.current = true
      onDone()
    }
  }, [electrical, marginOk, onDone])

  return (
    <div className="mx-3 mt-2 flex min-h-0 flex-1 flex-col gap-2 pb-3">
      <div className="border-4 border-[#1c2430] bg-[#121820] p-2">
        <div className="flex justify-between font-pixel text-[8px] text-[#9dff7a]">
          <span>{mode === 'pacer' ? 'PACER' : mode === 'defib' ? 'DEFIB' : 'MONITOR'}</span>
          <span>{sensing === 'unset' ? 'SENSING —' : sensing.toUpperCase()}</span>
        </div>
        <Rhythm electrical={electrical} rate={rate} />
        <div className="mt-1 flex justify-between font-body text-[20px] text-[#d7ffe4]">
          <span>Rate {rate}</span>
          <span>{output} mA</span>
        </div>
        {electrical && !marginOk && (
          <p className="font-body text-[18px] text-[#ffd27a]">Spike and a wide QRS at {spec.thr} mA. Add 5–10 mA.</p>
        )}
        {shocked && <p className="font-body text-[18px] text-[#ff8d8d]">He is conscious. That was a shock, not pacing.</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(['monitor', 'defib', 'pacer'] as const).map((item) => (
          <button key={item} type="button" className="tap text-center" onClick={() => setMode(item)}>
            {item === 'pacer' ? 'PACER' : item === 'defib' ? 'DEFIB' : 'MONITOR'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="tap text-center" onClick={() => setSensing('demand')}>
          DEMAND
        </button>
        <button type="button" className="tap text-center" onClick={() => setSensing('fixed')}>
          FIXED
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stepper label="Rate" value={rate} onChange={setRate} step={10} min={30} max={100} />
        <Stepper label="Output mA" value={output} onChange={setOutput} step={10} min={0} max={140} />
      </div>
      <button
        type="button"
        className="tap border-[#a33a32] bg-[#f8d0d0] text-center"
        onClick={() => {
          if (mode === 'defib') setShocked(true)
        }}
      >
        SHOCK
      </button>
    </div>
  )
}

function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step: number
  min: number
  max: number
}) {
  return (
    <div className="flex items-center justify-between border-2 border-[#303848] bg-[#fffbec] px-2">
      <button type="button" className="font-body text-[28px]" onClick={() => onChange(Math.max(min, value - step))} aria-label={`${label} down`}>
        −
      </button>
      <span className="font-body text-[18px]">{label}</span>
      <button type="button" className="font-body text-[28px]" onClick={() => onChange(Math.min(max, value + step))} aria-label={`${label} up`}>
        +
      </button>
    </div>
  )
}

function Rhythm({ electrical, rate }: { electrical: boolean; rate: number }) {
  const beats = electrical ? 6 : 3
  return (
    <svg viewBox="0 0 280 70" className="mt-1 h-16 w-full bg-[#07140c]">
      {Array.from({ length: beats }, (_, i) => {
        const x = 16 + i * (electrical ? 44 : 90)
        return (
          <g key={i}>
            {electrical && <line x1={x} y1="34" x2={x} y2="8" stroke="#9dff7a" strokeWidth="2" />}
            <path d={`M${x + 4} 36 L${x + 10} 36 L${x + 16} 14 L${x + 24} 52 L${x + 30} 36 H${x + 40}`} fill="none" stroke="#9dff7a" strokeWidth="2" />
          </g>
        )
      })}
      {!electrical && (
        <text x="8" y="64" fill="#ffd27a" fontFamily="VT323, monospace" fontSize="14">
          Wide CHB · no spike · rate dial {rate}
        </text>
      )}
    </svg>
  )
}

function FemoralPulse({ onDone }: { onDone: () => void }) {
  const [held, setHeld] = useState(0)
  const done = useRef(false)
  const timer = useRef(0)

  function down() {
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      setHeld((value) => {
        const next = Math.min(1, value + 0.08)
        if (next >= 1 && !done.current) {
          done.current = true
          window.clearInterval(timer.current)
          onDone()
        }
        return next
      })
    }, 50)
  }

  return (
    <div className="relative mx-3 mt-2 min-h-[240px] flex-1 border-4 border-[#303848] bg-[#e7d7c4]">
      <svg viewBox="0 0 200 260" className="h-full w-full">
        <path d="M70 20 H130 V120 Q100 150 70 120 Z" fill="#f0d2b4" stroke="#303848" strokeWidth="2" />
        <path d="M78 120 Q60 200 70 250" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
        <path d="M122 120 Q140 200 130 250" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
        <circle cx="96" cy="168" r="10" fill={held > 0.4 ? '#e07080' : '#c4897a'} stroke="#303848" />
        <text x="112" y="172" fontFamily="VT323, monospace" fontSize="16" fill="#28241c">
          Femoral
        </text>
      </svg>
      <button
        type="button"
        className="tap absolute bottom-3 left-3 right-3 text-center"
        onPointerDown={down}
        onPointerUp={() => window.clearInterval(timer.current)}
        onPointerLeave={() => window.clearInterval(timer.current)}
      >
        {held >= 1 ? 'Pulse matches the paced rate' : 'Hold on the femoral artery'}
      </button>
      <div className="absolute top-3 right-3 left-3 h-2 bg-[#fffbec]">
        <div className="h-full bg-[#1d6b32]" style={{ width: `${held * 100}%` }} />
      </div>
    </div>
  )
}
