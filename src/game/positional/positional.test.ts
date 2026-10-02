import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EPLEY_MARKS, HALLPIKE_MARKS, epleyRows, freshPos, hallpikeRows } from './PositionalProcedure'

test('positional: a right Hallpike and an Epley done right earn every mark', () => {
  const h = { ...freshPos(false), explained: true, couchX: 1, rot: 45, lying: 1, dropS: 1.2, ext: 20, watchedS: 32, dx: 'right-posterior' as const }
  assert.equal(hallpikeRows(h).filter((x) => x.ok).length, HALLPIKE_MARKS.length)
  assert.ok(!hallpikeRows({ ...h, dropS: 4 }).find((x) => x.key === 'drop')!.ok)
  const e = { ...freshPos(true), holds: [30, 30, 30], turned: true, rolled: true, satUp: true, retested: true }
  assert.equal(epleyRows(e).filter((x) => x.ok).length, EPLEY_MARKS.length)
})
