import { useEffect, useRef } from 'react'

/**
 * CTG-style strip: fetal heart rate over the last 90 seconds with the 110–160 band shaded,
 * a contraction (toco) trace beneath, and the category-1 decision clock.
 */
export type FetalSample = { fhr: number; toco: number }

const SPAN = 90

export function FetalMonitor({ history, fhr, clockS, doppler }: { history: FetalSample[]; fhr: number; clockS: number; doppler: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvas.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    const ratio = window.devicePixelRatio || 1
    const w = cv.clientWidth
    const h = cv.clientHeight
    cv.width = Math.round(w * ratio)
    cv.height = Math.round(h * ratio)
    c.setTransform(ratio, 0, 0, ratio, 0, 0)
    c.fillStyle = '#fbf6ec'
    c.fillRect(0, 0, w, h)
    const fhrH = h * 0.7
    const y = (bpm: number) => fhrH - ((bpm - 50) / 160) * fhrH
    c.fillStyle = 'rgba(88, 200, 120, 0.18)'
    c.fillRect(0, y(160), w, y(110) - y(160))
    c.strokeStyle = 'rgba(200, 120, 120, 0.25)'
    c.lineWidth = 1
    for (let bpm = 60; bpm <= 200; bpm += 20) {
      c.beginPath()
      c.moveTo(0, y(bpm))
      c.lineTo(w, y(bpm))
      c.stroke()
    }
    c.strokeStyle = '#c84848'
    c.beginPath()
    c.moveTo(0, fhrH)
    c.lineTo(w, fhrH)
    c.stroke()
    const step = w / (SPAN * 2)
    const start = Math.max(0, history.length - SPAN * 2)
    c.strokeStyle = '#181820'
    c.lineWidth = 1.6
    c.beginPath()
    history.slice(start).forEach((s, i) => {
      const x = i * step
      if (i === 0) c.moveTo(x, y(s.fhr))
      else c.lineTo(x, y(s.fhr))
    })
    c.stroke()
    c.strokeStyle = '#3a78d8'
    c.beginPath()
    history.slice(start).forEach((s, i) => {
      const x = i * step
      const py = h - 4 - s.toco * (h - fhrH - 10)
      if (i === 0) c.moveTo(x, py)
      else c.lineTo(x, py)
    })
    c.stroke()
  }, [history])

  const mm = String(Math.floor(clockS / 60)).padStart(2, '0')
  const ss = String(Math.floor(clockS % 60)).padStart(2, '0')
  const low = doppler && fhr < 110
  return (
    <div className="monitor fetal" data-testid="fetal-monitor">
      <canvas ref={canvas} className="monitor-trace" />
      <div className="monitor-nums">
        <span className="m-fhr" data-alarm={low || undefined}>
          <i>FHR{doppler ? '' : ' ?'}</i>
          {doppler ? Math.round(fhr) : '--'}
        </span>
        <span className="m-clock">
          <i>CAT 1 CLOCK</i>
          {mm}:{ss}
        </span>
      </div>
    </div>
  )
}
