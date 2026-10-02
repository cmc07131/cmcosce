import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ELBOW_MARKS, elbowRows, freshElbow, turnTo } from './ElbowProcedure'
import { VALSALVA_MARKS, converted, freshValsalva, valsalvaRows } from '../valsalva/ValsalvaProcedure'

test('pulled elbow: hyperpronation clicks with the thumb on the radial head', () => {
  const r = { ...freshElbow(), thumbOnHead: true }
  assert.ok(!{ ...r, ...turnTo(r, 50) }.clicked)
  const done = { ...r, ...turnTo(r, 85), explained: true, lap: true, watchedMin: 15, reached: true }
  assert.ok(done.clicked)
  assert.equal(elbowRows(done).filter((x) => x.ok).length, ELBOW_MARKS.length)
})

test('valsalva: it reverts only with the strain, then flat with legs up at once', () => {
  const r = { ...freshValsalva(), explained: true, strip: true, backAngle: 0, strainAngle: 45, strainS: 16, strainEndedAt: 20, legsAt: 23, legsUp: 1, legsS: 15, checked: true }
  assert.ok(converted(r))
  assert.equal(valsalvaRows(r).filter((x) => x.ok).length, VALSALVA_MARKS.length)
  assert.ok(!converted({ ...r, legsAt: 40 }))
  assert.ok(!converted({ ...r, strainS: 8 }))
})
