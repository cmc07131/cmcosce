import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TRACH_MARKS, fresh, trachRows } from './TrachProcedure'

test('trach: valve off, inner cannula out, catheter passes, clean one back: every mark', () => {
  const r = { ...fresh(), valveOff: true, innerOut: false, innerRemoved: true, replaced: true, passed: 1, humidified: true }
  assert.deepEqual(trachRows({ ...r, innerOut: true }).filter((x) => x.ok).length, 4)
  assert.equal(trachRows({ ...r, innerOut: true, pulledTube: true }).find((x) => x.key === 'inner')!.critical, true)
  assert.equal(TRACH_MARKS.length, 4)
})
