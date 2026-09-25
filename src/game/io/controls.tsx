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
  const toolRef = useRef<string | null>(null)

  useEffect(() => {
    if (!drag) return
    const move = (event: PointerEvent) => setDrag((cur) => (cur ? { ...cur, x: event.clientX, y: event.clientY } : cur))
    const up = (event: PointerEvent) => {
      const tool = toolRef.current
      toolRef.current = null
      setDrag(null)
      if (!tool) return
      const hit = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((el) => (el as HTMLElement).closest?.('[data-drop]') as HTMLElement | null)
        .find(Boolean)
      drop.current(tool, hit?.dataset.drop ?? null, { x: event.clientX, y: event.clientY })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag !== null])

  function begin(tool: string, event: ReactPointerEvent) {
    event.preventDefault()
    toolRef.current = tool
    sfx.cursor()
    setDrag({ tool, x: event.clientX, y: event.clientY })
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
    cancelAnimationFrame(raf.current)
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
        const loop = (now: number) => {
          tick.current(Math.min(0.1, (now - last.current) / 1000))
          last.current = now
          raf.current = requestAnimationFrame(loop)
        }
        raf.current = requestAnimationFrame(loop)
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

/** Three plausible lines; the examiner scores what you say. Order is fixed per mount. */
export function SayIt({ prompt, options, picked, onPick }: { prompt: string; options: SayOption[]; picked: boolean | null; onPick: (ok: boolean) => void }) {
  const order = useMemo(() => [...options].sort(() => Math.random() - 0.5), [options])
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
