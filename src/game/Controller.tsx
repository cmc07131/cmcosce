import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { vectorToDir } from '~/engine/grid'
import type { Dir } from '~/engine/schema'
import { holdDir, press, type Btn } from './input'

const DIR_BTN: Record<Dir, Btn> = { n: 'up', s: 'down', w: 'left', e: 'right' }

/** Game Boy Color–style controls: D-pad, A, B, SELECT, START. */
export function Controller() {
  return (
    <div className="controller" data-testid="controller">
      <DPad />
      <div className="ab">
        <PadButton btn="b" className="btn-b" label="B" testId="btn-b" />
        <PadButton btn="a" className="btn-a" label="A" testId="use" />
      </div>
      <div className="pills">
        <PadButton btn="select" className="pill" label="SELECT" testId="btn-select" />
        <PadButton btn="start" className="pill" label="START" testId="btn-start" />
      </div>
    </div>
  )
}

function PadButton({ btn, className, label, testId }: { btn: Btn; className: string; label: string; testId: string }) {
  return (
    <button
      type="button"
      className={className}
      data-testid={testId}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        press(btn)
      }}
      onKeyDown={(event) => event.preventDefault()}
    >
      <span>{label}</span>
    </button>
  )
}

function DPad() {
  const base = useRef<HTMLDivElement>(null)
  const [dir, setDir] = useState<Dir | null>(null)
  const current = useRef<Dir | null>(null)
  const repeat = useRef<number | null>(null)

  function stopRepeat() {
    if (repeat.current !== null) window.clearTimeout(repeat.current)
    repeat.current = null
  }

  function set(next: Dir | null) {
    if (next === current.current) return
    current.current = next
    setDir(next)
    holdDir('pad', next)
    stopRepeat()
    if (!next) return
    press(DIR_BTN[next])
    const again = (delay: number) => {
      repeat.current = window.setTimeout(() => {
        if (current.current !== next) return
        press(DIR_BTN[next])
        again(110)
      }, delay)
    }
    again(380)
  }

  function place(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = base.current?.getBoundingClientRect()
    if (!rect) return
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    set(vectorToDir(dx, dy, 0.18))
  }

  useEffect(() => () => {
    stopRepeat()
    holdDir('pad', null)
  }, [])

  return (
    <div
      ref={base}
      className="dpad"
      data-testid="joystick"
      data-dir={dir ?? ''}
      style={{ touchAction: 'none' }}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        place(event)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        place(event)
      }}
      onPointerUp={() => set(null)}
      onPointerCancel={() => set(null)}
    >
      <span className="dpad-arm dpad-n" />
      <span className="dpad-arm dpad-s" />
      <span className="dpad-arm dpad-w" />
      <span className="dpad-arm dpad-e" />
      <span className="dpad-hub" />
    </div>
  )
}
