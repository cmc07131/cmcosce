import { useSettings } from '../settings'

/**
 * Examination sounds, made in the browser (no recordings to license): percussion notes, bowel sounds, a heartbeat,
 * a Doppler signal, a tuning fork. Only with SOUND on.
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (!useSettings.getState().sound) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function noise(a: AudioContext, seconds: number) {
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * seconds)), a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  return src
}

function envelope(a: AudioContext, at: number, peak: number, decay: number) {
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  return g
}

/** A finger tapped on a finger: resonant over lung, dull over liver or fluid, drum-like over gas. */
export function percussNote(kind: 'resonant' | 'dull' | 'tympanic') {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const [freq, q, decay] = kind === 'dull' ? [320, 2.5, 0.06] : kind === 'tympanic' ? [230, 6, 0.32] : [130, 1.8, 0.22]
  const src = noise(a, decay + 0.05)
  const band = a.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = freq
  band.Q.value = q
  const g = envelope(a, t, kind === 'dull' ? 0.5 : 0.8, decay)
  src.connect(band).connect(g).connect(a.destination)
  src.start(t)
  if (kind === 'tympanic') {
    const tone = a.createOscillator()
    tone.frequency.value = freq
    const tg = envelope(a, t, 0.12, decay)
    tone.connect(tg).connect(a.destination)
    tone.start(t)
    tone.stop(t + decay + 0.05)
  }
}

/** Bowel sounds: a few gurgles over the next seconds (none when absent; high and tinkling when obstructed). */
export function bowel(kind: 'normal' | 'absent' | 'tinkling' = 'normal') {
  const a = audio()
  if (!a || kind === 'absent') return
  const t0 = a.currentTime
  for (let i = 0; i < 4; i++) {
    const t = t0 + 0.3 + i * (0.5 + Math.random() * 0.7)
    const o = a.createOscillator()
    o.type = 'sine'
    const base = kind === 'tinkling' ? 900 : 180 + Math.random() * 120
    o.frequency.setValueAtTime(base, t)
    o.frequency.exponentialRampToValueAtTime(base * (1.6 + Math.random()), t + 0.18)
    const g = envelope(a, t, kind === 'tinkling' ? 0.08 : 0.18, 0.22)
    o.connect(g).connect(a.destination)
    o.start(t)
    o.stop(t + 0.25)
  }
}

/** A few heartbeats; irregularly irregular in AF. */
export function heartbeat(rate = 72, irregular = false) {
  const a = audio()
  if (!a) return
  let t = a.currentTime + 0.1
  for (let i = 0; i < 5; i++) {
    for (const [dt, f] of [
      [0, 55],
      [0.12, 70],
    ] as const) {
      const o = a.createOscillator()
      o.frequency.value = f
      const g = envelope(a, t + dt, 0.5, 0.09)
      o.connect(g).connect(a.destination)
      o.start(t + dt)
      o.stop(t + dt + 0.12)
    }
    t += (60 / rate) * (irregular ? 0.6 + Math.random() * 0.8 : 1)
  }
}

/** The handheld Doppler: an arterial whoosh with each beat, a venous hum, or nothing. */
export function doppler(signal: 'arterial' | 'venous' | 'none') {
  const a = audio()
  if (!a || signal === 'none') return
  const t0 = a.currentTime
  const beats = signal === 'arterial' ? 4 : 1
  for (let i = 0; i < beats; i++) {
    const t = t0 + 0.1 + i * 0.8
    const len = signal === 'arterial' ? 0.3 : 2.4
    const src = noise(a, len)
    const band = a.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.setValueAtTime(signal === 'arterial' ? 900 : 300, t)
    if (signal === 'arterial') band.frequency.exponentialRampToValueAtTime(400, t + len)
    band.Q.value = 3
    const g = envelope(a, t, signal === 'arterial' ? 0.6 : 0.2, len)
    src.connect(band).connect(g).connect(a.destination)
    src.start(t)
  }
}

/** A 512 Hz tuning fork, struck. */
export function fork() {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const o = a.createOscillator()
  o.frequency.value = 512
  const g = envelope(a, t, 0.2, 2.5)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + 2.6)
}
