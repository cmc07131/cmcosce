import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaults, nudge, scoreVent, ventSpec, VENT_MARKS } from './model'

test('ventilator: TCA settings earn every mark; the switched-on defaults need changing', () => {
  const spec = ventSpec('tca')
  const right = { mode: 'VC-CMV' as const, fio2: 100, vt: 475, rr: 22, peep: 5, pmax: 35 }
  const good = scoreVent(right, spec)
  assert.deepEqual(good.earned, [...VENT_MARKS])
  assert.deepEqual(good.faults, [])
  assert.ok(good.etco2 < 4.5, 'hyperventilation brings the CO2 down')
  const off = scoreVent(defaults(), spec)
  // Only the 500 mL default happens to suit 70 kg: the mode, rate and oxygen all need setting.
  assert.deepEqual(off.earned, ['volume'])
  assert.ok(off.faults.some((f) => /paralysed/.test(f.text)))
})

test('ventilator: knobs stay in range and move in steps', () => {
  let s = defaults()
  for (let i = 0; i < 50; i++) s = nudge(s, 'fio2', 1)
  assert.equal(s.fio2, 100)
  s = nudge(s, 'rr', 1)
  assert.equal(s.rr, 13)
})
