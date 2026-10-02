import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { capture } from './controls'

/**
 * Shared hands-on pieces for procedure benches: a picture you touch in its own coordinates, a strap you
 * tighten, a syringe you aspirate and inject with, antiseptic you rub on, and the closing check card.
 */

export type Pt = { x: number; y: number }

/** Map a pointer into an SVG element's own user space. */
export function toLocal(el: SVGGraphicsElement | null, event: { clientX: number; clientY: number }): Pt | null {
  const m = el?.getScreenCTM()
  if (!m) return null
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse())
  return { x: p.x, y: p.y }
}

/* ---------------------------------------------------------------- a picture you touch */

/**
 * Wraps an SVG picture. Pointer positions arrive in the SVG's own coordinates. A ripple shows where you touched.
 * `svg` must be passed to the SVG as its ref.
 */
export function TouchPad({
  svg,
  aspect,
  onDown,
  onMove,
  onUp,
  dropId,
  testId,
  className = '',
  children,
}: {
  svg: RefObject<SVGSVGElement | null>
  aspect: string
  onDown?: (p: Pt) => void
  onMove?: (p: Pt) => void
  onUp?: (p: Pt | null) => void
  dropId?: string
  testId?: string
  className?: string
  children: ReactNode
}) {
  const pressed = useRef(false)
  const at = (e: ReactPointerEvent) => toLocal(svg.current, e)
  return (
    <div
      className={`io-figure ${className}`}
      style={{ touchAction: 'none', aspectRatio: aspect }}
      data-drop={dropId}
      data-testid={testId}
      onPointerDown={(e) => {
        const p = at(e)
        if (!p) return
        pressed.current = true
        capture(e)
        onDown?.(p)
      }}
      onPointerMove={(e) => {
        if (!pressed.current) return
        const p = at(e)
        if (p) onMove?.(p)
      }}
      onPointerUp={(e) => {
        if (!pressed.current) return
        pressed.current = false
        onUp?.(at(e))
      }}
      onPointerCancel={() => {
        pressed.current = false
        onUp?.(null)
      }}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- a strap you tighten */

/** Drag the tail of a strap to tighten it. You feel how tight it is, as you would. */
export function PullStrap({ label, value, disabled, onChange, onRelease, testId }: { label: string; value: number; disabled?: boolean; onChange: (v: number) => void; onRelease: (v: number) => void; testId: string }) {
  const track = useRef<HTMLDivElement>(null)
  const down = useRef(false)
  const last = useRef(value)
  const frac = (e: ReactPointerEvent) => {
    const rect = track.current?.getBoundingClientRect()
    if (!rect) return value
    return Math.max(0, Math.min(1, (e.clientX - rect.left - rect.width * 0.18) / (rect.width * 0.78)))
  }
  return (
    <div className="hare-strap mt-2" data-disabled={disabled || undefined} data-testid={testId}>
      <span className="hare-strap-label">{label}</span>
      <div
        ref={track}
        className="hare-strap-track"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          if (disabled) return
          down.current = true
          capture(e)
          last.current = frac(e)
          onChange(last.current)
        }}
        onPointerMove={(e) => {
          if (!down.current) return
          last.current = frac(e)
          onChange(last.current)
        }}
        onPointerUp={() => {
          if (!down.current) return
          down.current = false
          onRelease(last.current)
        }}
        onPointerCancel={() => (down.current = false)}
      >
        <span className="hare-buckle" />
        <span className="hare-band" style={{ width: `${18 + value * 78}%` }} />
        <span className="hare-tail" style={{ left: `${18 + value * 78}%` }} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- a syringe */

/** What comes back when you pull the plunger, from wherever the needle tip is. */
export type Draw = { kind: 'blood' | 'fluid' | 'none' | 'air'; colour?: string; note?: string }

/**
 * A syringe on its side, needle to the left. Drag the plunger: pull back (right) to aspirate, push (left) to
 * inject. A flash of what you drew shows in the hub. Volumes in mL.
 *
 * - `drug`: mL of drug in the barrel (an injecting syringe). Pushing injects it through `onInject`.
 * - `drawn`: mL already drawn back into the barrel (an aspirating syringe), shown in `drawnColour`.
 * - `onPull(ml)`: asked how much comes back; return what came. `none` means a vacuum: the plunger springs back.
 * - `onInject(ml)`: return false to resist (bone, nerve, a closed tap): the plunger will not move.
 */
export function Syringe({
  capacity,
  drug,
  drugLabel,
  drawn = 0,
  drawnColour = '#e8d070',
  flash,
  disabled,
  onPull,
  onInject,
  onRelease,
  testId = 'syringe',
}: {
  capacity: number
  drug: number
  drugLabel?: string
  drawn?: number
  drawnColour?: string
  flash?: string | null
  disabled?: boolean
  onPull: (ml: number) => Draw
  onInject: (ml: number) => boolean
  onRelease?: () => void
  testId?: string
}) {
  const svg = useRef<SVGSVGElement>(null)
  const grab = useRef<{ x: number } | null>(null)
  const [pull, setPull] = useState(0)
  const pullRef = useRef(0)
  const W = 220
  const barrel = { x0: 36, x1: 176 }
  const mlToX = (ml: number) => barrel.x0 + ((barrel.x1 - barrel.x0) * ml) / capacity
  const contents = drug + drawn
  const plungerX = mlToX(contents + pull)

  function move(p: Pt) {
    const g = grab.current
    if (!g || disabled) return
    const dx = p.x - g.x
    g.x = p.x
    const dml = (dx / (barrel.x1 - barrel.x0)) * capacity
    if (dml > 0) {
      // Pull: first a little negative pressure, then whatever the tip finds.
      if (contents + pullRef.current + dml > capacity) return
      const got = onPull(dml)
      if (got.kind === 'none') {
        pullRef.current = Math.min(1.2, pullRef.current + dml)
        setPull(pullRef.current)
      }
    } else if (dml < 0) {
      if (pullRef.current > 0) {
        pullRef.current = Math.max(0, pullRef.current + dml)
        setPull(pullRef.current)
        return
      }
      if (drug <= 0) return
      onInject(Math.min(drug, -dml))
    }
  }

  return (
    <div className="syringe" data-testid={testId} data-disabled={disabled || undefined}>
      <TouchPad
        svg={svg}
        aspect={`${W} / 56`}
        onDown={(p) => {
          grab.current = { x: p.x }
        }}
        onMove={move}
        onUp={() => {
          grab.current = null
          if (pullRef.current > 0) {
            pullRef.current = 0
            setPull(0)
          }
          onRelease?.()
        }}
      >
        <svg ref={svg} viewBox={`0 0 ${W} 56`} className="block h-full w-full select-none">
          <rect width={W} height="56" fill="#eef3f8" />
          {/* needle and hub */}
          <line x1="2" y1="28" x2="28" y2="28" stroke="#8890a0" strokeWidth="1.6" />
          <rect x="26" y="22" width="10" height="12" fill={flash ?? '#d8e0e8'} stroke="#505868" />
          {/* barrel, contents */}
          <rect x={barrel.x0} y="16" width={barrel.x1 - barrel.x0} height="24" fill="#f8fbff" stroke="#505868" strokeWidth="1.5" />
          {drug > 0 && <rect x={barrel.x0 + 1} y="17" width={mlToX(drug) - barrel.x0 - 1} height="22" fill="#cfe4ff" />}
          {drawn > 0 && <rect x={mlToX(drug)} y="17" width={mlToX(drug + drawn) - mlToX(drug)} height="22" fill={drawnColour} />}
          {Array.from({ length: capacity + 1 }, (_, i) => (
            <line key={i} x1={mlToX(i)} y1="16" x2={mlToX(i)} y2={i % 5 === 0 ? 24 : 20} stroke="#505868" strokeWidth="0.6" />
          ))}
          {/* plunger */}
          <rect x={plungerX - 2} y="17" width="4" height="22" fill="#303848" />
          <rect x={plungerX} y="26" width={W - 14 - plungerX} height="4" fill="#606878" />
          <rect x={W - 16} y="12" width="8" height="32" rx="2" fill="#303848" />
          <text x={barrel.x0} y="52" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#40404c">
            {drug > 0 ? `${drug.toFixed(1)} mL ${drugLabel ?? ''}` : drawn > 0 ? `${drawn.toFixed(0)} mL drawn` : 'empty'}
          </text>
          <text x={W - 70} y="10" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#606878">
            ◀ PUSH · PULL ▶
          </text>
        </svg>
      </TouchPad>
    </div>
  )
}

/* ---------------------------------------------------------------- antiseptic */

/**
 * Rub antiseptic over an ellipse on a picture: coverage is the share of a grid of cells you have rubbed over.
 * Feed it points in the picture's coordinates.
 */
export function useRub(area: { cx: number; cy: number; rx: number; ry: number }, cells = 8) {
  const [hit, setHit] = useState<Set<number>>(() => new Set())
  const hitRef = useRef(hit)
  const inside = (p: Pt) => ((p.x - area.cx) / area.rx) ** 2 + ((p.y - area.cy) / area.ry) ** 2 <= 1
  const total = (() => {
    let n = 0
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) {
        const p = { x: area.cx - area.rx + ((i + 0.5) * 2 * area.rx) / cells, y: area.cy - area.ry + ((j + 0.5) * 2 * area.ry) / cells }
        if (inside(p)) n++
      }
    return n
  })()
  function rub(p: Pt) {
    if (!inside(p)) return false
    const i = Math.floor(((p.x - (area.cx - area.rx)) / (2 * area.rx)) * cells)
    const j = Math.floor(((p.y - (area.cy - area.ry)) / (2 * area.ry)) * cells)
    const k = i * cells + j
    if (hitRef.current.has(k)) return true
    const next = new Set(hitRef.current)
    next.add(k)
    hitRef.current = next
    setHit(next)
    return true
  }
  const cellsHit = [...hit].map((k) => ({
    x: area.cx - area.rx + ((Math.floor(k / cells) + 0.5) * 2 * area.rx) / cells,
    y: area.cy - area.ry + (((k % cells) + 0.5) * 2 * area.ry) / cells,
  }))
  return { rub, coverage: Math.min(1, hit.size / Math.max(1, total)), cellsHit, cellW: (2 * area.rx) / cells, cellH: (2 * area.ry) / cells }
}

/** The rubbed cells drawn as a faint antiseptic tint. */
export function RubTint({ rub, colour = '#c890d8' }: { rub: ReturnType<typeof useRub>; colour?: string }) {
  return (
    <g opacity="0.35" pointerEvents="none">
      {rub.cellsHit.map((c, i) => (
        <rect key={i} x={c.x - rub.cellW / 2} y={c.y - rub.cellH / 2} width={rub.cellW} height={rub.cellH} fill={colour} />
      ))}
    </g>
  )
}

/* ---------------------------------------------------------------- the closing check */

export type CheckRow = { key: string; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

/** Each step against what is acceptable, as stacked cards that fit a phone. */
export function CheckCard({ rows, onContinue, footer, testId = 'bench-check' }: { rows: CheckRow[]; onContinue: () => void; footer?: ReactNode; testId?: string }) {
  const allOk = rows.every((r) => r.ok)
  return (
    <div className="vent-check" data-testid={testId}>
      <p className="vent-check-head" data-ok={allOk || undefined}>
        {allOk ? '✓ Everything right.' : `✗ ${rows.filter((r) => !r.ok).length} to review.`}
      </p>
      <ul className="hare-rows">
        {rows.map((r) => (
          <li key={r.key} data-ok={r.ok || undefined}>
            <b>
              {r.ok ? '✓' : '✗'} {r.label}
            </b>
            <span>You: {r.value}</span>
            {!r.ok && (
              <>
                <span>Acceptable: {r.range}</span>
                <small>{r.why}</small>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="vent-check-btns">
        <button type="button" className="tap io-next" data-testid={`${testId}-done`} onClick={onContinue}>
          Continue ▶
        </button>
      </div>
      {footer && <p className="io-small mt-1">{footer}</p>}
    </div>
  )
}

/** Score rows into the station's marks (in the order they are written on the option) and faults. */
export function benchMarks<K extends string>(rows: CheckRow[], order: readonly K[], grant: string[]) {
  const marks = rows.filter((r) => r.ok).map((r) => grant[order.indexOf(r.key as K)]).filter((m): m is string => Boolean(m))
  const faults = rows.filter((r) => !r.ok).map((r) => ({ text: `${r.label}: ${r.value}. ${r.why}`, critical: Boolean(r.critical) }))
  return { marks, faults }
}
