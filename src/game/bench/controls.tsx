import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { sfx } from '../sfx'

/* ---------------------------------------------------------------- drag a tool onto a target */

/**
 * Drag a tool chip and drop it on any element marked `data-drop="<id>"`.
 * The drop target is found under the finger, so targets can be anywhere on screen.
 */
export function useToolDrag(onDrop: (tool: string, target: string | null, at: { x: number; y: number }) => void) {
  const drop = useRef(onDrop)
  drop.current = onDrop
  const [drag, setDrag] = useState<{ tool: string; x: number; y: number } | null>(null)
  const cleanup = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanup.current?.(), [])

  function begin(tool: string, event: ReactPointerEvent) {
    event.preventDefault()
    cleanup.current?.()
    sfx.cursor()
    setDrag({ tool, x: event.clientX, y: event.clientY })
    // Listen straight away: a quick flick can end before any effect would run.
    const move = (e: PointerEvent) => setDrag((cur) => (cur ? { ...cur, x: e.clientX, y: e.clientY } : cur))
    const up = (e: PointerEvent) => {
      cleanup.current?.()
      setDrag(null)
      const hit = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => (el as HTMLElement).closest?.('[data-drop]') as HTMLElement | null)
        .find(Boolean)
      drop.current(tool, hit?.dataset.drop ?? null, { x: e.clientX, y: e.clientY })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    cleanup.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      cleanup.current = null
    }
  }

  return { drag, begin }
}

export function DragGhost({ at, children }: { at: { x: number; y: number } | null; children: ReactNode }) {
  if (!at) return null
  return (
    <div className="pointer-events-none fixed z-[80]" style={{ left: at.x, top: at.y, transform: 'translate(-50%, -60%) scale(1.15)' }}>
      {children}
    </div>
  )
}

/** A kit item you can pick up. */
export function Tool({
  id,
  caption,
  children,
  onBegin,
  disabled,
  state,
  dropId,
}: {
  id: string
  caption: string
  children: ReactNode
  onBegin?: (tool: string, event: ReactPointerEvent) => void
  disabled?: boolean
  state?: string
  dropId?: string
}) {
  return (
    <div
      className="tool"
      data-tool={id}
      data-drop={dropId}
      data-disabled={disabled || undefined}
      style={{ touchAction: onBegin && !disabled ? 'none' : undefined }}
      onPointerDown={(event) => {
        if (!onBegin || disabled) return
        onBegin(id, event)
      }}
    >
      <div className="tool-art">{children}</div>
      <span className="tool-caption">{caption}</span>
      {state && <span className="tool-state">{state}</span>}
    </div>
  )
}

/** Pointer capture keeps a drag alive outside the element. It is a nicety: never let it throw. */
export function capture(event: ReactPointerEvent<HTMLElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    // synthetic or already-released pointer
  }
}

/** Track one finger on an element without depending on pointer capture. */
export function usePress(handlers: { down?: (e: ReactPointerEvent<HTMLDivElement>) => void; move: (e: ReactPointerEvent<HTMLDivElement>) => void; up?: () => void }) {
  const pressed = useRef(false)
  const h = useRef(handlers)
  h.current = handlers
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      pressed.current = true
      capture(event)
      h.current.down?.(event)
      h.current.move(event)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pressed.current) h.current.move(event)
    },
    onPointerUp: () => {
      pressed.current = false
      h.current.up?.()
    },
    onPointerCancel: () => {
      pressed.current = false
      h.current.up?.()
    },
  }
}

/* ---------------------------------------------------------------- hold to act */

/** Dev builds only: `window.__osceSpeed = 10` speeds up hold actions for testing. */
function devSpeed() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 1
  const v = (window as unknown as { __osceSpeed?: number }).__osceSpeed
  return typeof v === 'number' && v > 0 ? v : 1
}

/** Calls `onTick(seconds)` every frame while pressed. */
export function HoldButton({
  children,
  onTick,
  onStart,
  onEnd,
  disabled,
  testId,
  className = '',
}: {
  children: ReactNode
  onTick: (dt: number) => void
  onStart?: () => void
  onEnd?: () => void
  disabled?: boolean
  testId?: string
  className?: string
}) {
  const raf = useRef(0)
  const last = useRef(0)
  const tick = useRef(onTick)
  tick.current = onTick
  const end = useRef(onEnd)
  end.current = onEnd
  const [held, setHeld] = useState(false)

  function stop() {
    if (!raf.current) return
    window.clearInterval(raf.current)
    raf.current = 0
    setHeld(false)
    end.current?.()
  }

  useEffect(() => () => stop(), [])

  return (
    <button
      type="button"
      className={`tap hold ${className}`}
      data-held={held || undefined}
      data-testid={testId}
      disabled={disabled}
      style={{ touchAction: 'none' }}
      onPointerDown={(event) => {
        if (disabled) return
        event.preventDefault()
        capture(event)
        setHeld(true)
        onStart?.()
        last.current = performance.now()
        // A timer, not animation frames: frames pause when the window is hidden or the phone throttles it.
        raf.current = window.setInterval(() => {
          const now = performance.now()
          tick.current(Math.min(0.1, (now - last.current) / 1000) * devSpeed())
          last.current = now
        }, 33)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- twist */

/** Circle a finger round the dial. `turns` grows only in the named direction. */
export function useSpin(direction: 'cw' | 'ccw') {
  const prev = useRef<number | null>(null)
  const down = useRef(false)
  const acc = useRef(0)
  const [turns, setTurns] = useState(0)
  const [opposed, setOpposed] = useState(false)
  return {
    turns,
    opposed,
    handlers: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        capture(event)
        down.current = true
        prev.current = null
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (!down.current) return
        const rect = event.currentTarget.getBoundingClientRect()
        const ang = Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2))
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
      },
      onPointerUp: () => {
        down.current = false
        prev.current = null
      },
    },
  }
}

export function Dial({ label, spin }: { label: string; spin: ReturnType<typeof useSpin> }) {
  return (
    <div className="dial" style={{ touchAction: 'none' }} {...spin.handlers}>
      <span className="dial-mark" style={{ transform: `rotate(${spin.turns * 360}deg)` }} />
      <span className="dial-label">{label}</span>
    </div>
  )
}

/* ---------------------------------------------------------------- say it out loud */

export type SayOption = { text: string; ok: boolean }

/** The line to say aloud: only the right one is offered (nobody learns by picking a wrong line). */
export function SayIt({ prompt, options, picked, onPick }: { prompt: string; options: SayOption[]; picked: boolean | null; onPick: (ok: boolean) => void }) {
  const order = useMemo(() => options.filter((option) => option.ok), [options])
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <div className="sayit" data-testid="sayit">
      <p className="sayit-prompt">SAY IT · {prompt}</p>
      {order.map((option) => (
        <button
          key={option.text}
          type="button"
          className="sayit-opt"
          data-chosen={chosen === option.text || undefined}
          disabled={picked !== null}
          onClick={() => {
            setChosen(option.text)
            sfx.select()
            onPick(option.ok)
          }}
        >
          “{option.text}”
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- strips */

const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * A strip to drag along: right pushes toward the patient, left draws back. `cmPerWidth`: how far one full sweep
 * moves it. More reliable on a phone than dragging along a thin wire in the picture.
 */
export function SlidePad({ label, cmPerWidth, onDelta, onEnd, disabled, testId }: { label: string; cmPerWidth: number; onDelta: (cm: number) => void; onEnd?: () => void; disabled?: boolean; testId: string }) {
  const last = useRef<number | null>(null)
  const [x, setX] = useState(0.5)
  return (
    <div
      className="io-figure mt-2 aspect-[200/30]"
      style={{ touchAction: 'none', opacity: disabled ? 0.45 : 1 }}
      data-testid={testId}
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = e.clientX
      }}
      onPointerMove={(e) => {
        if (last.current === null) return
        const rect = e.currentTarget.getBoundingClientRect()
        const dx = e.clientX - last.current
        last.current = e.clientX
        setX(clampTo((e.clientX - rect.left) / rect.width, 0.05, 0.95))
        onDelta((dx / rect.width) * cmPerWidth)
      }}
      onPointerUp={() => {
        last.current = null
        setX(0.5)
        onEnd?.()
      }}
      onPointerCancel={() => (last.current = null)}
    >
      <svg viewBox="0 0 200 30" className="block h-full w-full select-none">
        <rect width="200" height="30" fill="#e8f0f6" />
        <rect x="8" y="17" width="184" height="6" rx="3" fill="#b8c8d8" />
        <g transform={`translate(${8 + x * 184} 20)`}>
          <rect x="-12" y="-7" width="24" height="14" rx="4" fill="#3a6f92" stroke="#203848" />
          <path d="M-5 0 L-1 -3 L-1 3 Z M5 0 L1 -3 L1 3 Z" fill="#f8f8f8" />
        </g>
        <text x="8" y="11" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#203040">
          {label}
        </text>
      </svg>
    </div>
  )
}


/**
 * Traction you hold: drag the knob away from the middle and keep it there. How far is how hard: in the green band it
 * is gentle, past it is too hard. `up` allows traction both ways (down and up); otherwise down only. Calls
 * `onTick(dt, force)` about 30 times a second while held, force −1 (up) … 1 (down); the knob springs back on release.
 */
export function TractionStrip({ onTick, onEnd, up = false, gentle = 0.6, light = 0.15, disabled, testId, labelDown = 'DOWN', labelUp = 'UP' }: { onTick: (dt: number, force: number) => void; onEnd?: () => void; up?: boolean; gentle?: number; light?: number; disabled?: boolean; testId: string; labelDown?: string; labelUp?: string }) {
  const [force, setForce] = useState(0)
  const forceRef = useRef(0)
  const timer = useRef(0)
  const last = useRef(0)
  const tick = useRef(onTick)
  tick.current = onTick
  const end = useRef(onEnd)
  end.current = onEnd
  const H = 150
  const mid = up ? H / 2 : 22
  const span = up ? H / 2 - 12 : H - 34
  const at = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = ((e.clientY - rect.top) / rect.height) * H
    const f = clampTo((y - mid) / span, up ? -1 : 0, 1)
    forceRef.current = f
    setForce(f)
  }
  const stop = () => {
    if (!timer.current) return
    window.clearInterval(timer.current)
    timer.current = 0
    forceRef.current = 0
    setForce(0)
    end.current?.()
  }
  useEffect(() => () => stop(), [])
  const band = (from: number, to: number, fill: string, key: string) => <rect key={key} x="6" width="28" y={mid + Math.min(from, to) * span} height={Math.abs(to - from) * span} fill={fill} />
  const f = Math.abs(force)
  return (
    <div
      className="io-figure"
      style={{ touchAction: 'none', width: 56, aspectRatio: `40 / ${H}`, opacity: disabled ? 0.45 : 1 }}
      data-testid={testId}
      data-force={force.toFixed(2)}
      onPointerDown={(e) => {
        if (disabled) return
        capture(e)
        at(e)
        last.current = performance.now()
        timer.current = window.setInterval(() => {
          const now = performance.now()
          tick.current(Math.min(0.1, (now - last.current) / 1000) * devSpeed(), forceRef.current)
          last.current = now
        }, 33)
      }}
      onPointerMove={(e) => timer.current && at(e)}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <svg viewBox={`0 0 40 ${H}`} className="block h-full w-full select-none">
        <rect width="40" height={H} fill="#e8f0f6" />
        {band(light, gentle, '#b8e0b0', 'gd')}
        {band(gentle, 1, '#f0b8b0', 'rd')}
        {up && band(-light, -gentle, '#b8e0b0', 'gu')}
        {up && band(-gentle, -1, '#f0b8b0', 'ru')}
        <line x1="4" x2="36" y1={mid} y2={mid} stroke="#506070" strokeWidth="1" />
        <g transform={`translate(20 ${mid + force * span})`}>
          <rect x="-15" y="-7" width="30" height="14" rx="4" fill={f > gentle ? '#b83838' : f > light ? '#3a8a4a' : '#3a6f92'} stroke="#203848" />
          <path d="M-4 -2 L0 -5 L4 -2 M-4 2 L0 5 L4 2" stroke="#f8f8f8" strokeWidth="1.2" fill="none" />
        </g>
        <text x="20" y={H - 4} textAnchor="middle" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#203040">
          {labelDown}
        </text>
        {up && (
          <text x="20" y="9" textAnchor="middle" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#203040">
            {labelUp}
          </text>
        )}
        <text x="20" y={up ? H / 2 - 4 : 12} textAnchor="middle" fontFamily="Press Start 2P, monospace" fontSize="3.6" fill="#506070">
          {f > gentle ? 'HARD' : f > light ? 'GENTLE' : 'HOLD'}
        </text>
      </svg>
    </div>
  )
}
