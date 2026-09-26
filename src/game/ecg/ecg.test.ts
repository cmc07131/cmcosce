import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LEADS,
  beats,
  brugada,
  extremes,
  hyperkalaemia,
  lbbb,
  pericarditis,
  rbbb,
  rhythms,
  rrIntervals,
  sample,
  sinus,
  stLevel,
  stemi,
  wpw,
} from './model'

const MM = 0.1 // 1 small square = 0.1 mV

test('normal sinus: no ST shift, upright T in II, inverted complex in aVR, R-wave progression', () => {
  const s = sinus()
  for (const l of LEADS) assert.ok(Math.abs(stLevel(s, l)) < 0.08, `${l} ST ${stLevel(s, l).toFixed(2)}`)
  assert.ok(extremes(s, 'aVR').min < -0.5)
  assert.ok(extremes(s, 'V1').min < -0.7 && extremes(s, 'V1').max < 0.35, 'V1 is rS')
  assert.ok(extremes(s, 'V5').max > 1.2, 'V5 tall R')
  const rr = rrIntervals(s)
  assert.ok(Math.max(...rr) - Math.min(...rr) < 0.01, 'regular')
})

test('inferior STEMI: ≥1 mm elevation in II, III, aVF with reciprocal depression in aVL', () => {
  const s = stemi('inferior')
  for (const l of ['II', 'III', 'aVF'] as const) assert.ok(stLevel(s, l) >= MM, `${l} ${stLevel(s, l).toFixed(2)}`)
  assert.ok(stLevel(s, 'III') > stLevel(s, 'II'), 'III > II points to the RCA')
  assert.ok(stLevel(s, 'aVL') <= -MM, 'reciprocal aVL')
  assert.ok(Math.abs(stLevel(s, 'V2')) < MM)
})

test('anterior STEMI: ≥2 mm elevation in V2–V3', () => {
  const s = stemi('anterior')
  for (const l of ['V2', 'V3'] as const) assert.ok(stLevel(s, l) >= 2 * MM, `${l} ${stLevel(s, l).toFixed(2)}`)
})

test('lateral STEMI: elevation in I, aVL, V5, V6; reciprocal in III', () => {
  const s = stemi('lateral')
  for (const l of ['I', 'aVL', 'V5', 'V6'] as const) assert.ok(stLevel(s, l) >= MM, l)
  assert.ok(stLevel(s, 'III') <= -MM)
})

test('posterior MI: ST depression with a dominant R in V1–V3', () => {
  const s = stemi('posterior')
  assert.ok(stLevel(s, 'V2') <= -MM)
  const v2 = extremes(s, 'V2')
  assert.ok(v2.max > Math.abs(v2.min), 'R > S in V2')
})

test('hyperkalaemia: peaked T mild; flat P and wide QRS moderate; no P severe', () => {
  const mild = hyperkalaemia('mild')
  assert.ok(extremes(mild, 'V3').max > 1.0, 'tall T')
  const mod = hyperkalaemia('moderate')
  assert.ok(mod.conduction.qrs >= 0.12)
  const ev = beats(mod, 3)
  const b = ev.find((e) => e.p !== undefined)!
  assert.ok(sample(mod, 'II', b.p! + 0.045, ev) < 0.06, 'P flattened')
  const severe = hyperkalaemia('severe')
  assert.equal(beats(severe, 3).filter((e) => e.p !== undefined).length, 0, 'no P waves')
  assert.ok(severe.conduction.qrs >= 0.18)
})

test('bundle branch blocks: QRS ≥ 120 ms; LBBB negative V1 and no q in V6; RBBB has an R′ in V1', () => {
  const l = lbbb()
  assert.ok(l.conduction.qrs >= 0.12)
  assert.ok(extremes(l, 'V1').min < -1.2)
  assert.equal(l.morph.V6.q, 0)
  const r = rbbb()
  assert.ok(r.conduction.qrs >= 0.12)
  assert.ok((r.morph.V1.r2 ?? 0) > r.morph.V1.r, 'R′ taller than r')
})

test('pericarditis: diffuse ST elevation, ST depression in aVR, PR depression', () => {
  const s = pericarditis()
  for (const l of ['I', 'II', 'V5', 'V6'] as const) assert.ok(stLevel(s, l) >= MM, l)
  assert.ok(stLevel(s, 'aVR') < 0)
  assert.ok((s.morph.II.pr ?? 0) < 0 && (s.morph.aVR.pr ?? 0) > 0)
})

test('rhythms: AF irregular without P; CHB dissociated; Mobitz II drops beats at a fixed PR', () => {
  const af = rhythms.af()
  const rr = rrIntervals(af, 20)
  const mean = rr.reduce((a, b) => a + b, 0) / rr.length
  const sd = Math.sqrt(rr.reduce((a, b) => a + (b - mean) ** 2, 0) / rr.length)
  assert.ok(sd / mean > 0.15, 'irregularly irregular')
  assert.equal(beats(af, 10).filter((b) => b.p !== undefined).length, 0)
  const chb = rhythms.chb()
  const ev = beats(chb, 20)
  assert.ok(ev.filter((b) => b.p !== undefined).length > 2 * ev.filter((b) => b.qrs !== undefined).length, 'more P than QRS')
  const m2 = beats(rhythms.mobitz2(), 12)
  const conducted = m2.filter((b) => b.p !== undefined && b.qrs !== undefined)
  assert.ok(conducted.every((b) => Math.abs(b.qrs! - b.p! - conducted[0].qrs! + conducted[0].p!) < 1e-9), 'constant PR')
  assert.ok(m2.some((b) => b.p !== undefined && b.qrs === undefined), 'a dropped beat')
  const m1 = beats(rhythms.mobitz1(), 12).filter((b) => b.p !== undefined && b.qrs !== undefined)
  assert.ok(m1[1].qrs! - m1[1].p! > m1[0].qrs! - m1[0].p!, 'PR lengthens')
})

test('WPW short PR; Brugada coved V1 ≥ 2 mm with an inverted T', () => {
  const w = wpw()
  assert.ok(w.conduction.pr < 0.12 && (w.conduction.delta ?? 0) > 0)
  const b = brugada()
  assert.ok(stLevel(b, 'V1') >= 2 * MM)
  assert.ok(b.morph.V1.t < 0)
})

test('VT is wide and regular; VF has no organised complexes', () => {
  const vt = rhythms.vt()
  assert.ok(beats(vt, 5).filter((b) => b.qrs !== undefined).every((b) => b.kind === 'wide'))
  const rr = rrIntervals(vt)
  assert.ok(Math.max(...rr) - Math.min(...rr) < 0.01)
  assert.equal(beats(rhythms.vf(), 5).length, 0)
})
