import { useEffect, useMemo, useRef, useState } from 'react'
import { beats, sample, type EcgSpec, type Lead } from './model'

/**
 * A 12-lead ECG on paper: 25 mm/s, 10 mm/mV. Standard layout: four 2.5 s columns
 * (I aVR V1 V4 / II aVL V2 V5 / III aVF V3 V6) and a 10 s lead II rhythm strip, with a 1 mV calibration pulse.
 * Tap a lead to see it large.
 */

const LAYOUT: Lead[][] = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
]
const ROW_MM = 30
const PAPER_W_MM = 256
const PAPER_H_MM = ROW_MM * 4 + 6

function paper(c: CanvasRenderingContext2D, w: number, h: number, pxPerMm: number) {
  c.fillStyle = '#fdf0f2'
  c.fillRect(0, 0, w, h)
  for (let mm = 0; mm * pxPerMm <= w; mm++) {
    const x = Math.round(mm * pxPerMm) + 0.5
    c.strokeStyle = mm % 5 === 0 ? '#e89aa8' : '#f6d0d6'
    c.lineWidth = mm % 5 === 0 ? 1 : 0.6
    c.beginPath()
    c.moveTo(x, 0)
    c.lineTo(x, h)
    c.stroke()
  }
  for (let mm = 0; mm * pxPerMm <= h; mm++) {
    const y = Math.round(mm * pxPerMm) + 0.5
    c.strokeStyle = mm % 5 === 0 ? '#e89aa8' : '#f6d0d6'
    c.lineWidth = mm % 5 === 0 ? 1 : 0.6
    c.beginPath()
    c.moveTo(0, y)
    c.lineTo(w, y)
    c.stroke()
  }
}

function trace(
  c: CanvasRenderingContext2D,
  spec: EcgSpec,
  lead: Lead,
  events: ReturnType<typeof beats>,
  seed: number,
  x0: number,
  baseY: number,
  t0: number,
  seconds: number,
  pxPerMm: number,
) {
  const pxPerS = 25 * pxPerMm
  const pxPerMv = 10 * pxPerMm
  c.strokeStyle = '#181820'
  c.lineWidth = Math.max(1.2, pxPerMm * 0.35)
  c.lineJoin = 'round'
  c.beginPath()
  const steps = Math.ceil(seconds * pxPerS)
  for (let i = 0; i <= steps; i++) {
    const t = t0 + i / pxPerS
    const y = Math.round(baseY - sample(spec, lead, t, events, seed) * pxPerMv)
    if (i === 0) c.moveTo(x0 + i, y)
    else c.lineTo(x0 + i, y)
  }
  c.stroke()
}

function calibration(c: CanvasRenderingContext2D, x: number, baseY: number, pxPerMm: number) {
  c.strokeStyle = '#181820'
  c.lineWidth = Math.max(1.2, pxPerMm * 0.35)
  c.beginPath()
  c.moveTo(x, baseY)
  c.lineTo(x + pxPerMm, baseY)
  c.lineTo(x + pxPerMm, baseY - 10 * pxPerMm)
  c.lineTo(x + 6 * pxPerMm, baseY - 10 * pxPerMm)
  c.lineTo(x + 6 * pxPerMm, baseY)
  c.lineTo(x + 7 * pxPerMm, baseY)
  c.stroke()
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, pxPerMm: number) {
  c.fillStyle = '#181820'
  c.font = `${Math.max(8, Math.round(pxPerMm * 3))}px "Press Start 2P", monospace`
  c.fillText(text, x, y)
}

export function Ecg12({ spec, seed = 1, caption }: { spec: EcgSpec; seed?: number; caption?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(320)
  const [zoom, setZoom] = useState<Lead | null>(null)
  const events = useMemo(() => beats(spec, 14, seed), [spec, seed])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const cv = canvas.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    const ratio = window.devicePixelRatio || 1
    const pxPerMm = width / PAPER_W_MM
    const h = PAPER_H_MM * pxPerMm
    cv.width = Math.round(width * ratio)
    cv.height = Math.round(h * ratio)
    cv.style.height = `${h}px`
    c.setTransform(ratio, 0, 0, ratio, 0, 0)
    paper(c, width, h, pxPerMm)
    const colW = 62.5 * pxPerMm
    const x0 = 6 * pxPerMm
    LAYOUT.forEach((row, r) => {
      const baseY = (r * ROW_MM + 18) * pxPerMm
      calibration(c, 0, baseY, pxPerMm)
      row.forEach((lead, col) => {
        trace(c, spec, lead, events, seed, x0 + col * colW, baseY, 0.4 + col * 2.5, 2.5, pxPerMm)
        label(c, lead, x0 + col * colW + 2, baseY - 12 * pxPerMm, pxPerMm)
        if (col > 0) {
          c.fillStyle = '#181820'
          c.fillRect(Math.round(x0 + col * colW), baseY - 3 * pxPerMm, 1, 3 * pxPerMm)
        }
      })
    })
    const stripY = (3 * ROW_MM + 20) * pxPerMm
    calibration(c, 0, stripY, pxPerMm)
    trace(c, spec, 'II', events, seed, x0, stripY, 0.4, 10, pxPerMm)
    label(c, 'II', x0 + 2, stripY - 12 * pxPerMm, pxPerMm)
  }, [spec, events, seed, width])

  return (
    <div className="ecg" data-testid="ecg12">
      {caption && <p className="ecg-caption">{caption}</p>}
      <div
        ref={box}
        className="ecg-paper"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const pxPerMm = rect.width / PAPER_W_MM
          const col = Math.floor(((event.clientX - rect.left) / pxPerMm - 6) / 62.5)
          const row = Math.floor((event.clientY - rect.top) / pxPerMm / ROW_MM)
          if (row >= 0 && row < 3 && col >= 0 && col < 4) setZoom(LAYOUT[row][col])
          else if (row === 3) setZoom('II')
        }}
      >
        <canvas ref={canvas} className="block w-full" />
      </div>
      <p className="ecg-scale">25 mm/s · 10 mm/mV · tap a lead to enlarge</p>
      {zoom && <LeadZoom spec={spec} lead={zoom} events={events} seed={seed} onClose={() => setZoom(null)} />}
    </div>
  )
}

/** One lead, large: 5 s at 3× the paper scale. */
function LeadZoom({ spec, lead, events, seed, onClose }: { spec: EcgSpec; lead: Lead; events: ReturnType<typeof beats>; seed: number; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = canvas.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    const ratio = window.devicePixelRatio || 1
    const wMm = 130
    const hMm = 40
    const pxPerMm = 5
    cv.width = wMm * pxPerMm * ratio
    cv.height = hMm * pxPerMm * ratio
    cv.style.width = `${wMm * pxPerMm}px`
    cv.style.height = `${hMm * pxPerMm}px`
    c.setTransform(ratio, 0, 0, ratio, 0, 0)
    paper(c, wMm * pxPerMm, hMm * pxPerMm, pxPerMm)
    calibration(c, 2, 24 * pxPerMm, pxPerMm)
    trace(c, spec, lead, events, seed, 10 * pxPerMm, 24 * pxPerMm, 0.4, 4.8, pxPerMm)
    label(c, lead, 12 * pxPerMm, 6 * pxPerMm, pxPerMm * 0.8)
  }, [spec, lead, events, seed])
  return (
    <div className="io-modal" onClick={onClose} data-testid="ecg-zoom">
      <div className="win ecg-zoom" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <b className="win-title">LEAD {lead}</b>
          <button type="button" className="win-close" onClick={onClose}>
            B✕
          </button>
        </div>
        <div className="overflow-x-auto">
          <canvas ref={canvas} className="block" />
        </div>
        <p className="ecg-scale">Scroll sideways · 1 small square = 0.04 s, 0.1 mV</p>
      </div>
    </div>
  )
}
