import { useSettings } from './settings'

/** Tiny square-wave sound effects, synthesised in the browser. No audio files, no music. */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!useSettings.getState().sound) return null
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

type Note = { f: number; d: number; at?: number; type?: OscillatorType; v?: number; slide?: number }

function play(notes: Note[]) {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  for (const n of notes) {
    const start = now + (n.at ?? 0)
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = n.type ?? 'square'
    osc.frequency.setValueAtTime(n.f, start)
    if (n.slide) osc.frequency.linearRampToValueAtTime(n.slide, start + n.d)
    const v = n.v ?? 0.06
    gain.gain.setValueAtTime(v, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + n.d + 0.02)
  }
}

let lastBump = 0
let lastBlip = 0

export const sfx = {
  cursor: () => play([{ f: 1320, d: 0.03, v: 0.04 }]),
  select: () => play([{ f: 988, d: 0.04 }, { f: 1319, d: 0.06, at: 0.04 }]),
  back: () => play([{ f: 660, d: 0.05 }, { f: 440, d: 0.06, at: 0.04 }]),
  blip: () => {
    const now = performance.now()
    if (now - lastBlip < 55) return
    lastBlip = now
    play([{ f: 1760, d: 0.018, v: 0.025 }])
  },
  bump: () => {
    const now = performance.now()
    if (now - lastBump < 260) return
    lastBump = now
    play([{ f: 140, d: 0.08, type: 'triangle', v: 0.12, slide: 70 }])
  },
  mark: () =>
    play([
      { f: 784, d: 0.07 },
      { f: 988, d: 0.07, at: 0.07 },
      { f: 1319, d: 0.16, at: 0.14 },
    ]),
  trap: () => play([{ f: 220, d: 0.12, type: 'sawtooth', v: 0.05 }, { f: 175, d: 0.18, at: 0.1, type: 'sawtooth', v: 0.05 }]),
  door: () => play([{ f: 330, d: 0.18, type: 'triangle', v: 0.1, slide: 660 }]),
  battle: () =>
    play([
      { f: 523, d: 0.06 },
      { f: 659, d: 0.06, at: 0.06 },
      { f: 784, d: 0.06, at: 0.12 },
      { f: 1047, d: 0.14, at: 0.18 },
    ]),
  fanfare: () =>
    play([
      { f: 523, d: 0.12 },
      { f: 523, d: 0.08, at: 0.14 },
      { f: 523, d: 0.08, at: 0.24 },
      { f: 698, d: 0.3, at: 0.34 },
      { f: 880, d: 0.12, at: 0.66 },
      { f: 784, d: 0.12, at: 0.8 },
      { f: 1047, d: 0.5, at: 0.94 },
    ]),
}

/** Continuous drill whine. Pitch drops when the tip gives into marrow. */
let drillOsc: OscillatorNode | null = null
let drillGain: GainNode | null = null

export const drill = {
  start: () => {
    const ac = audio()
    if (!ac || drillOsc) return
    drillOsc = ac.createOscillator()
    drillGain = ac.createGain()
    drillOsc.type = 'sawtooth'
    drillOsc.frequency.setValueAtTime(220, ac.currentTime)
    drillGain.gain.setValueAtTime(0.035, ac.currentTime)
    drillOsc.connect(drillGain).connect(ac.destination)
    drillOsc.start()
  },
  pitch: (hz: number) => {
    if (drillOsc && ctx) drillOsc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.03)
  },
  stop: () => {
    try {
      drillOsc?.stop()
    } catch {
      // already stopped
    }
    drillOsc = null
    drillGain = null
  },
}

/** Short phone vibration, where supported. Silent no-op elsewhere. */
export function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // no vibration API
  }
}
