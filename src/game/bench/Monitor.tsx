import { useEffect, useRef } from 'react'

/**
 * Bedside monitor with live traces. Rhythms are generated, not recorded:
 * complete heart block, pacing spikes with and without capture, hyperkalaemic peaked T waves.
 */

export type Rhythm = 'sinus' | 'chb' | 'paced' | 'spikes' | 'hyperk' | 'hyperk-spikes' | 'agonal' | 'asystole'

export type Vitals = {
  rhythm: Rhythm
  /** Ventricular rate for native rhythms. */
  hr: number
  /** Pacing rate when spikes are shown. */
  paceRate?: number
  spo2: number | null
  bp: [number, number] | null
  etco2: 'off' | 'flat' | 'square'
  etco2Kpa?: number
}

/** Seconds of trace across the screen. Short enough that a wide QRS still looks wide on a phone. */
const WINDOW_S = 3

function bump(x: number, centre: number, width: number, height: number) {
  const d = (x - centre) / width
  return Math.abs(d) > 1 ? 0 : height * (1 - d * d) * (1 - d * d)
}

/** One beat, phase 0–1 measured in seconds from the beat start. */
function narrowBeat(s: number) {
  return bump(s, 0.08, 0.04, 0.12) - bump(s, 0.17, 0.015, 0.12) + bump(s, 0.19, 0.02, 0.9) - bump(s, 0.215, 0.015, 0.25) + bump(s, 0.42, 0.08, 0.22)
}

function wideBeat(s: number, peakedT = false) {
  return bump(s, 0.06, 0.06, 0.75) - bump(s, 0.15, 0.05, 0.45) + (peakedT ? bump(s, 0.36, 0.05, 0.95) : -bump(s, 0.38, 0.1, 0.3))
}

/**
 * A captured paced beat, measured from the spike: a broad, tall QRS (about 0.18 s)
 * and a T wave pointing the opposite way, as the ventricles depolarise cell to cell from the pad.
 */
export function pacedBeat(s: number) {
  // About 40 ms after the spike the QRS starts, so the spike stands on its own.
  return bump(s, 0.13, 0.09, 1.0) - bump(s, 0.27, 0.06, 0.38) - bump(s, 0.52, 0.13, 0.5)
}

function pWave(s: number) {
  return bump(s, 0.05, 0.04, 0.14)
}

/** ECG value at time t (s), and whether a pacing spike falls in [t, t+dt). */
export function ecgAt(v: Vitals, t: number, dt: number): { y: number; spike: boolean } {
  const beat = 60 / Math.max(1, v.hr)
  const pace = 60 / Math.max(1, v.paceRate ?? 70)
  const within = (period: number) => ((t % period) + period) % period
  const spikeIn = (period: number) => within(period) < dt
  switch (v.rhythm) {
    case 'sinus':
      return { y: narrowBeat(within(beat)), spike: false }
    case 'chb':
      return { y: wideBeat(within(beat)) + pWave(within(60 / 82)), spike: false }
    case 'paced':
      return { y: pacedBeat(within(pace)), spike: spikeIn(pace) }
    case 'spikes':
      return { y: wideBeat(within(beat)) + pWave(within(60 / 82)), spike: spikeIn(pace) }
    case 'hyperk':
      return { y: wideBeat(within(beat), true), spike: false }
    case 'hyperk-spikes':
      return { y: wideBeat(within(beat), true), spike: spikeIn(pace) }
    case 'agonal':
      return { y: 0.6 * wideBeat(within(60 / 18)), spike: false }
    default:
      return { y: 0.02 * Math.sin(t * 7), spike: false }
  }
}

function perfusedBeatPeriod(v: Vitals) {
  if (v.rhythm === 'paced') return 60 / Math.max(1, v.paceRate ?? 70)
  if (v.rhythm === 'asystole') return null
  if (v.rhythm === 'agonal') return 60 / 18
  return 60 / Math.max(1, v.hr)
}

export function Monitor({ vitals }: { vitals: Vitals }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef(vitals)
  live.current = vitals

  useEffect(() => {
    let raf = 0
    const draw = (now: number) => {
      const cv = canvas.current
      const c = cv?.getContext('2d')
      if (cv && c) {
        const ratio = window.devicePixelRatio || 1
        const w = cv.clientWidth
        const h = cv.clientHeight
        if (cv.width !== Math.round(w * ratio)) {
          cv.width = Math.round(w * ratio)
          cv.height = Math.round(h * ratio)
        }
        c.setTransform(ratio, 0, 0, ratio, 0, 0)
        c.fillStyle = '#061008'
        c.fillRect(0, 0, w, h)
        const v = live.current
        const t0 = now / 1000 - WINDOW_S
        const dt = WINDOW_S / w
        const ecgMid = h * 0.3
        const ecgAmp = h * 0.2
        c.lineWidth = 1.4
        c.strokeStyle = '#58f080'
        c.beginPath()
        const spikes: number[] = []
        for (let x = 0; x < w; x++) {
          const t = t0 + x * dt
          const { y, spike } = ecgAt(v, t, dt)
          const py = ecgMid - y * ecgAmp
          if (x === 0) c.moveTo(x, py)
          else c.lineTo(x, py)
          if (spike) spikes.push(x)
        }
        c.stroke()
        // Pacing spikes: thin and white, like the pacer marker on a real monitor.
        c.lineWidth = 1
        c.strokeStyle = '#f0fff4'
        c.beginPath()
        for (const x of spikes) {
          c.moveTo(x + 0.5, ecgMid + ecgAmp * 0.15)
          c.lineTo(x + 0.5, ecgMid - ecgAmp * 1.1)
        }
        c.stroke()

        // SpO2 pleth follows perfused beats.
        const period = perfusedBeatPeriod(v)
        if (v.spo2 !== null && period) {
          const mid = h * 0.66
          c.strokeStyle = '#58d8f8'
          c.beginPath()
          for (let x = 0; x < w; x++) {
            const t = t0 + x * dt
            const s = ((t % period) + period) % period
            const y = bump(s, 0.28, 0.16, 1) + bump(s, 0.5, 0.08, 0.25)
            const py = mid - y * h * 0.1
            if (x === 0) c.moveTo(x, py)
            else c.lineTo(x, py)
          }
          c.stroke()
        }

        // Capnography: square breaths every 6 s, or a flat line.
        if (v.etco2 !== 'off') {
          const base = h * 0.93
          c.strokeStyle = '#f8d858'
          c.beginPath()
          for (let x = 0; x < w; x++) {
            const t = t0 + x * dt
            const s = ((t % 6) + 6) % 6
            const up = v.etco2 === 'square' && s > 1.5 && s < 4.2
            const py = base - (up ? h * 0.12 : 0)
            if (x === 0) c.moveTo(x, py)
            else c.lineTo(x, py)
          }
          c.stroke()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const low = vitals.spo2 !== null && vitals.spo2 < 85
  const shownHr = vitals.rhythm === 'paced' ? vitals.paceRate : vitals.rhythm === 'asystole' ? 0 : vitals.hr
  return (
    <div className="monitor" data-testid="monitor">
      <canvas ref={canvas} className="monitor-trace" />
      <div className="monitor-nums">
        <span className="m-hr">
          <i>HR</i>
          {Math.round(shownHr ?? 0)}
        </span>
        <span className="m-spo2" data-alarm={low || undefined}>
          <i>SpO₂</i>
          {vitals.spo2 === null ? '--' : Math.round(vitals.spo2)}
        </span>
        <span className="m-bp">
          <i>NIBP</i>
          {vitals.bp ? `${Math.round(vitals.bp[0])}/${Math.round(vitals.bp[1])}` : '--/--'}
        </span>
        {vitals.etco2 !== 'off' && (
          <span className="m-co2">
            <i>CO₂</i>
            {vitals.etco2 === 'square' ? (vitals.etco2Kpa ?? 5.5).toFixed(1) : '0.0'}
          </span>
        )}
      </div>
    </div>
  )
}
