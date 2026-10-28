import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATH_LEN,
  CVC_MARKS,
  checkCvc,
  feedWire,
  freshCvc,
  insideAfterNeedle,
  moveNeedle,
  needleInBeam,
  overlap,
  slide,
  tailAt,
  tailFree,
  tipOf,
  veinShape,
  type CvcRun,
} from './model'
import { stepGoals, stepOk } from './steps'

const apply = (r: CvcRun, patch: Partial<CvcRun>) => Object.assign(r, patch)

/** Tip tracking: slide the beam on, advance until the dot comes back, again and again. */
function trackInto(r: CvcRun) {
  r.aspirating = true
  for (let guard = 0; guard < 200 && r.where !== 'vein'; guard++) {
    const tip = tipOf(r.depth)
    if (tip.y >= r.beam - 0.5) r.beam += 1
    else apply(r, moveNeedle(r, r.depth + 0.5, 0).patch)
  }
}

function perfect(): CvcRun {
  const r = freshCvc()
  apply(r, { tilt: 15, rotation: 30, scanLevel: 'apex', scanOffset: 0.5, pressedFlat: true, named: ['vein', 'artery'] })
  apply(r, { garb: ['cap', 'mask', 'scrub', 'gown', 'gloves'], prepCoverage: 0.9, strokes: 14, drySec: 30, draped: 1 })
  apply(r, { flushed: ['distal', 'medial', 'proximal'], clamped: ['medial', 'proximal'], probeCover: true, lidocaine: 3 })
  trackInto(r)
  apply(r, { steadied: true, syringeOff: true, thumb: true })
  apply(r, feedWire(r, 17).patch)
  apply(r, { grip: 'skin', needleOut: true, inside: insideAfterNeedle(r), seenShort: true, seenLong: true, nick: { len: 4, crossed: false } })
  // Dilator: thread, take the tail, twist in, back out, hold at the skin, off.
  apply(r, { sleeve: { kind: 'dilator', front: tailAt(r.inside) } })
  apply(r, slide(r, 10).patch)
  apply(r, { grip: 'tail' })
  apply(r, slide(r, -2.4).patch)
  apply(r, slide(r, 1).patch)
  apply(r, { grip: 'skin' })
  apply(r, slide(r, tailAt(r.inside) + 1).patch)
  // Catheter: thread, wire out of the brown hub, hold it there, in to 15 cm.
  apply(r, { sleeve: { kind: 'catheter', front: tailAt(r.inside) } })
  apply(r, slide(r, 8).patch)
  assert.ok(tailFree(r.inside, r.sleeve))
  apply(r, { grip: 'tail', hubGrip: true })
  apply(r, slide(r, -15).patch)
  apply(r, { wireOut: true, wireCounted: true, aspirated: ['distal', 'medial', 'proximal'], flushedAfter: ['distal', 'medial', 'proximal'], capped: ['distal', 'medial', 'proximal'], sutures: 2, dressing: true })
  apply(r, { tipSeen: true, lungsChecked: ['left', 'right'], documented: true })
  return r
}

test('a perfect line scores every row', () => {
  const r = perfect()
  const rows = checkCvc(r)
  assert.equal(rows.length, CVC_MARKS.length)
  for (const row of rows) assert.ok(row.ok, `${row.label}: ${row.value}`)
  assert.equal(r.where, 'vein')
  assert.equal(r.flash, 'dark')
  assert.equal(r.catheterCm, 15)
})

test('head-down distends the vein; far rotation brings it over the carotid', () => {
  assert.ok(veinShape(15).rz > veinShape(0).rz + 2)
  assert.ok(veinShape(15, 1).rz < 1, 'the probe squashes it flat')
  assert.ok(overlap(15, 80) > overlap(15, 30))
})

test('the dot is the tip only within the beam; past it you see the shaft', () => {
  assert.equal(needleInBeam(5, 10), null)
  assert.equal(needleInBeam(14.1, 10)?.isTip, true)
  const shaft = needleInBeam(25, 10)
  assert.equal(shaft?.isTip, false)
  assert.equal(shaft?.z, 10)
})

test('advancing without tracking the tip goes through the back wall, and it counts', () => {
  const r = freshCvc()
  apply(r, { tilt: 15, aspirating: true })
  for (let d = 0; d <= 34; d += 1) apply(r, moveNeedle(r, d, 0).patch)
  assert.equal(r.where, 'through')
  assert.ok(r.backWall)
  assert.ok(r.blindMm > 10)
  assert.equal(checkCvc(r).find((x) => x.key === 'puncture')?.ok, false)
})

test('the front wall tents before it pops', () => {
  const r = freshCvc()
  apply(r, { tilt: 15, beam: 40 })
  const events: string[] = []
  for (let d = 0; d <= 16; d += 0.5) {
    const m = moveNeedle(r, d, 0)
    apply(r, m.patch)
    events.push(m.event)
  }
  assert.ok(events.includes('tent'))
  assert.ok(events.indexOf('tent') < events.indexOf('pop'))
  assert.equal(r.flash, 'none', 'no flash without aspirating')
})

test('a needle aimed medially finds the carotid: bright red, critical', () => {
  const r = freshCvc()
  apply(r, { tilt: 15, beam: 40 })
  for (let d = 0; d <= 26; d += 1) apply(r, moveNeedle(r, d, -10).patch)
  assert.equal(r.where, 'artery')
  assert.equal(r.flash, 'bright')
  const row = checkCvc(r).find((x) => x.key === 'puncture')
  assert.equal(row?.critical, true)
})

test('the wire stops at the needle tip outside a lumen, and ectopics come past 21 cm', () => {
  const r = freshCvc()
  apply(r, { where: 'tissue' })
  assert.equal(feedWire(r, 15).event, 'resist')
  const v = freshCvc()
  apply(v, { where: 'vein' })
  assert.equal(feedWire(v, 25).event, 'ectopy')
})

test('your fingers at the skin stop the dilator; off the end only with the wire held at the skin', () => {
  const r = freshCvc()
  apply(r, { inside: 15, grip: 'skin', sleeve: { kind: 'dilator', front: tailAt(15) } })
  assert.equal(slide(r, 1).event, 'blocked-hand')
  apply(r, { grip: 'tail', sleeve: { kind: 'dilator', front: 2 } })
  assert.equal(slide(r, tailAt(15) + 2).event, 'blocked-tail')
  apply(r, { grip: 'skin' })
  assert.equal(slide(r, tailAt(15) + 2).event, 'off')
})

test('a catheter goes no deeper than its own length', () => {
  const r = freshCvc()
  apply(r, { inside: 18, grip: 'tail', sleeve: { kind: 'catheter', front: 0 } })
  apply(r, slide(r, -40).patch)
  assert.equal(r.catheterCm, CATH_LEN - 1)
})

test('the catheter depth is judged as read at the skin, in whole centimetres', () => {
  const r = perfect()
  r.catheterCm = 16.4
  assert.equal(checkCvc(r).find((x) => x.key === 'dilate')?.ok, true)
  r.catheterCm = 16.6
  assert.equal(checkCvc(r).find((x) => x.key === 'dilate')?.ok, false)
})


test('each step has goals, ticked from the run, with the guidance and what you did', () => {
  const r = freshCvc()
  for (let i = 0; i < 12; i++) assert.ok(stepGoals(i, r).length > 0, `step ${i}`)
  r.tilt = 25
  const bed = stepGoals(0, r)[0]
  assert.equal(bed.state, 'fail')
  assert.equal(bed.now, '25° head-down')
  r.tilt = 15
  r.rotation = 30
  assert.ok(stepOk(0, r))
})

test('a safe garb order passes; gloves before the gown fails', () => {
  const r = freshCvc()
  r.garb = ['cap', 'mask', 'scrub', 'gown', 'gloves']
  assert.ok(stepOk(2, r))
  r.garb = ['cap', 'mask', 'scrub', 'gloves', 'gown']
  assert.equal(stepGoals(2, r)[1].state, 'fail')
})

test('a carotid puncture is a failed goal, not just a missing one', () => {
  const r = freshCvc()
  r.arterial = true
  assert.equal(stepGoals(5, r).find((x) => x.label.includes('carotid'))?.state, 'fail')
})
