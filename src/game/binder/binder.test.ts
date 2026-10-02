import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BINDER_MARKS, CRESTS_Y, TROCHANTERS_Y, checkBinder, freshBinder, opened, placement, type BinderRun } from './model'

test('binder: over the trochanters it closes the ring; over the crests it does not', () => {
  assert.equal(placement(TROCHANTERS_Y + 3), 'trochanters')
  assert.equal(placement(CRESTS_Y), 'crests')
  const on: BinderRun = { ...freshBinder(), binderY: TROCHANTERS_Y, locked: true, tied: true }
  assert.ok(opened(on) < opened({ ...on, binderY: CRESTS_Y }))
})

test('binder: a clean application earns every mark; a log roll is critical', () => {
  const r: BinderRun = { ...freshBinder(), explained: true, pockets: true, binderY: TROCHANTERS_Y, slidFromKnees: true, feetGap: 0, tied: true, tension: 0.7, locked: true, timed: true, rechecked: true }
  assert.deepEqual(checkBinder(r).filter((x) => x.ok).map((x) => x.key), [...BINDER_MARKS])
  assert.ok(checkBinder({ ...r, logRolled: true }).some((x) => x.critical))
})
