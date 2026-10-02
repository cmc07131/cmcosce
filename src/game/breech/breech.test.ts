import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BREECH_MARKS, checkBreech, freshBreech, rotate, stageOf, type BreechRun } from './model'

test('breech: it stops at the extended leg until Pinard; Løvset needs the pelvic grip', () => {
  assert.equal(stageOf({ ...freshBreech(), pushes: 4 }), 2)
  assert.equal(stageOf({ ...freshBreech(), pushes: 4, pinard: true, pinardAt: 2 }), 4)
  assert.equal(stageOf({ ...freshBreech(), pushes: 4, pinard: true, pinardAt: 3 }), 3)
  let r: BreechRun = { ...freshBreech(), grip: 'pelvis' }
  r = { ...r, ...rotate(r, 190) }
  assert.equal(r.armsOut, 1)
  r = { ...r, ...rotate(r, -380) }
  assert.equal(r.armsOut, 2)
  assert.equal({ ...freshBreech(), grip: 'abdomen' as const, ...rotate({ ...freshBreech(), grip: 'abdomen' }, 400) }.armsOut, 0)
})

test('breech: a clean delivery earns every mark; pulling on the legs is critical', () => {
  const r: BreechRun = { ...freshBreech(), pushes: 4, pinard: true, towel: true, grip: 'pelvis', armsOut: 2, hungS: 4, malar: true, occiput: true, headOut: true, headSpeed: 0.3 }
  assert.deepEqual(checkBreech(r).filter((x) => x.ok).map((x) => x.key), [...BREECH_MARKS])
  assert.ok(checkBreech({ ...r, pulledLegs: true }).some((x) => x.critical))
})
