import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FREE_ML, KNEE_MARKS, checkKnee, draw, freshKnee, milk, siteAt, tipRegion, type KneeRun } from './model'

test('knee: the lateral sites are safe; the cellulitis, patella and tendon are not', () => {
  assert.equal(siteAt({ x: 72, y: 74 }), 'superolateral')
  assert.equal(siteAt({ x: 72, y: 100 }), 'lateral')
  assert.equal(siteAt({ x: 132, y: 120 }), 'cellulitis')
  assert.equal(siteAt({ x: 100, y: 100 }), 'patella')
  assert.equal(siteAt({ x: 100, y: 140 }), 'tendon')
})

test('knee: fluid comes from under the patella; the flow stops until you milk the pouch', () => {
  let r: KneeRun = { ...freshKnee(), region: tipRegion({ x: 110, y: 60 }, 60) }
  assert.equal(r.region, 'fluid')
  assert.equal(tipRegion({ x: 120, y: 32 }, 60), 'bone')
  for (let i = 0; i < 40; i++) r = { ...r, ...draw(r, 1).patch }
  assert.equal(r.drawn, FREE_ML)
  r = { ...r, ...milk(r) }
  r = { ...r, ...draw(r, 2).patch }
  assert.ok(r.drawn > FREE_ML)
})

test('knee: a clean run earns every mark; steroid or cellulitis are critical', () => {
  const r: KneeRun = { ...freshKnee(), consent: true, askedProsthesis: true, sawSkin: true, tapped: true, extended: true, site: 'superolateral', cleaned: 0.9, wheal: 2, drawn: 20, pots: ['gram', 'count', 'crystals', 'bc'], dressed: true, sent: true }
  assert.deepEqual(checkKnee(r).filter((x) => x.ok).map((x) => x.key), [...KNEE_MARKS])
  assert.ok(checkKnee({ ...r, steroid: true }).some((x) => x.critical))
  assert.ok(checkKnee({ ...r, site: 'cellulitis' }).some((x) => x.critical))
})
