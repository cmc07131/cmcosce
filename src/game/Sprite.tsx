import { useEffect, useRef, useState } from 'react'
import type { Dir } from '~/engine/schema'
import { actorSprite, TILE } from './pixel/art'

/** One character sprite as a crisp scaled canvas. `walk` animates the step frames. */
export function Sprite({ role, facing = 's', scale = 3, walk = false }: { role: string; facing?: Dir; scale?: number; walk?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!walk) return
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 4), 180)
    return () => window.clearInterval(id)
  }, [walk])

  useEffect(() => {
    const c = canvas.current?.getContext('2d')
    if (!c) return
    c.clearRect(0, 0, TILE, TILE)
    const step = walk ? [0, 1, 0, 2][frame] : 0
    c.drawImage(actorSprite(role, facing, facing === 'e' || facing === 'w' ? (step ? 1 : 0) : step), 0, 0)
  }, [role, facing, frame, walk])

  return <canvas ref={canvas} width={TILE} height={TILE} className="pixelated" style={{ width: TILE * scale, height: TILE * scale }} />
}
