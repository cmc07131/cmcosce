import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HARE_MARKS, freshHare, footCompromised, maxKg, pain, releaseManual, scoreHare, shortfall, slide, strapSpot, strapsOk, wind, type HareRun } from './model'

/** A clean application, step by step, the way the bench drives it. */
function clean(): HareRun {
  let r: HareRun = { ...freshHare(), exposed: true, shoeOff: true, regions: ['pelvis', 'hip', 'thigh', 'knee', 'shin', 'ankle'], before: ['dp', 'sens', 'move', 'crt'] }
  r = { ...r, measuredOn: 'right', lengthCm: 108, locked: true }
  r = { ...r, straps: [8, 32, 55, 68] }
  r = { ...r, hitchAt: 'ankle', hitchTension: 0.5 }
  r = { ...r, manual: true, manualHow: 'steady' }
  r = { ...r, ...slide(r, 0), ischialTension: 0.5 }
  r = { ...r, hooked: true }
  r = { ...r, ...wind(r, 6) }
  r = { ...r, ...releaseManual(r) }
  r = { ...r, fastened: [true, true, true, true], stand: true, after: ['pt', 'sens', 'move'] }
  return r
}

test('hare: a clean application earns every mark with no faults', () => {
  const r = clean()
  const s = scoreHare(r)
  assert.deepEqual(s.earned, [...HARE_MARKS])
  assert.deepEqual(s.faults, [])
  assert.ok(Math.abs(shortfall(r)) < 0.5, 'length restored at about 10% body weight')
  assert.ok(pain(r, true) <= 3)
})

test('hare: the leg is short until traction pulls it out; the nurse holds it meanwhile', () => {
  const r = freshHare()
  assert.equal(shortfall(r), 3)
  assert.ok(shortfall({ ...r, manual: true, manualHow: 'steady' }) < 3)
  assert.equal(shortfall({ ...r, manual: true, manualHow: 'lift' }), 3, 'lifting the foot is not traction')
  assert.ok(pain(r, false) > pain(r, true), 'analgesia first')
})

test('hare: sliding the splint under without manual traction hurts and is scored', () => {
  let r: HareRun = { ...clean(), manual: false, manualHow: null, manualBeforeSlide: false, slidUnsupported: false }
  r = { ...r, ...slide(r, 0) }
  assert.ok(r.slidUnsupported)
  assert.ok(!scoreHare(r).earned.includes('manual'))
})

test('hare: letting go before the ratchet has taken over springs the leg back', () => {
  let r: HareRun = { ...freshHare(), manual: true, manualHow: 'steady', hooked: true, kg: 2 }
  r = { ...r, ...releaseManual(r) }
  assert.ok(r.releasedEarly)
  assert.equal(shortfall(r), 2)
})

test('hare: over-traction compromises the foot and is critical; a short splint runs out of room', () => {
  const over = { ...clean(), lengthCm: 120 }
  const o = { ...over, ...wind(over, 10) }
  assert.ok(footCompromised(o))
  const s = scoreHare(o)
  assert.ok(s.faults.some((f) => f.critical && /Traction/.test(f.text)))
  assert.ok(!s.earned.includes('nvAfter'))

  const short = { ...clean(), lengthCm: 96 }
  assert.ok(maxKg(short) < 5)
  assert.ok((wind(short, 6).kg ?? 0) < 5)
})

test('hare: straps go two on the thigh and two on the calf, never on the fracture or knee', () => {
  assert.equal(strapSpot(20), 'fracture')
  assert.equal(strapSpot(43), 'knee')
  assert.equal(strapSpot(82), 'ankle')
  assert.ok(strapsOk([8, 32, 55, 68]))
  assert.ok(!strapsOk([20, 32, 55, 68]))
  assert.ok(!strapsOk([8, 32, 44, 68]))
})

test('hare: measuring on the injured leg, a ring in the groin and a hitch on the calf are faults', () => {
  const r: HareRun = { ...clean(), measuredOn: 'left', ringCm: -6, hitchAt: 'calf' }
  const s = scoreHare(r)
  for (const k of ['measure', 'ring', 'hitch'] as const) assert.ok(!s.earned.includes(k), k)
})

test('hare: a sharp pull or a traction peak past 8 kg costs the mark even if corrected later', () => {
  assert.ok(!scoreHare({ ...clean(), jerked: true }).earned.includes('manual'))
  assert.ok(!scoreHare({ ...clean(), peakKg: 9 }).earned.includes('traction'))
})
