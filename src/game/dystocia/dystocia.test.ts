import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DYSTOCIA_MARKS, checkDystocia, freshDystocia, spSiteAt, type DystociaRun } from './model'

test('dystocia: suprapubic from the side of the back, never fundal', () => {
  assert.equal(spSiteAt({ x: 96, y: 98 }), 'correct')
  assert.equal(spSiteAt({ x: 60, y: 98 }), 'wrong-side')
  assert.equal(spSiteAt({ x: 80, y: 30 }), 'fundal')
})

test('dystocia: McRoberts, suprapubic, posterior arm and delivery earn every mark; fundal pressure is critical', () => {
  const r: DystociaRun = { ...freshDystocia(), flatBack: true, helpers: true, hipFlex: 1, sp: 'correct', continuousS: 3.2, rocks: 3, tractions: [{ angle: 10, force: 0.4 }], handIn: true, elbowFlexed: true, armSwept: true, internal: 'posterior-arm', delivered: true, headToBodyS: 180, timeNoted: true, resuscitaire: true }
  assert.deepEqual(checkDystocia(r).filter((x) => x.ok).map((x) => x.key), [...DYSTOCIA_MARKS])
  assert.ok(checkDystocia({ ...r, fundal: true }).some((x) => x.critical))
  assert.ok(!checkDystocia({ ...r, tractions: [{ angle: 45, force: 0.9 }] }).find((x) => x.key === 'suprapubic')!.ok)
})
