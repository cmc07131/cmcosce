import { useRef } from 'react'
import { vectorToDir } from '~/engine/grid'
import type { Dir } from '~/engine/schema'

export function Joystick({ onDir }: { onDir: (dir: Dir | null) => void }) {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)

  function place(clientX: number, clientY: number) {
    const el = base.current
    const dot = knob.current
    if (!el || !dot) return
    const rect = el.getBoundingClientRect()
    const dx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    const dir = vectorToDir(dx, dy)
    onDir(dir)
    const clamp = (n: number) => Math.max(-1, Math.min(1, n))
    const px = clamp(dx) * (rect.width / 2 - 22)
    const py = clamp(dy) * (rect.height / 2 - 22)
    dot.style.transform = `translate(${px}px, ${py}px)`
  }

  function end() {
    onDir(null)
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
  }

  return (
    <div
      ref={base}
      data-testid="joystick"
      className="absolute bottom-2 left-2 h-[108px] w-[108px] rounded-full border-4 border-[#303848] bg-[#f8f8e0]"
      style={{ touchAction: 'none' }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        place(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        place(event.clientX, event.clientY)
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        ref={knob}
        className="absolute top-1/2 left-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#303848] bg-[#f4f4f4]"
      />
    </div>
  )
}
