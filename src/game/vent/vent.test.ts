import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkVent, defaults, nudge, scoreVent, ventSpec, VENT_MARKS } from './model'

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

test('ventilator check: every row agrees with the scoring, and shows its range', () => {
  const spec = ventSpec('tca')
  const cases = [
    { mode: 'VC-CMV' as const, fio2: 100, vt: 475, rr: 22, peep: 5, pmax: 35 },
    defaults(),
    { mode: 'CPAP' as const, fio2: 60, vt: 800, rr: 30, peep: 12, pmax: 60 },
  ]
  for (const s of cases) {
    const rows = checkVent(s, spec)
    const score = scoreVent(s, spec)
    const ok = (k: string) => rows.find((r) => r.key === k)!.ok
    assert.equal(score.earned.includes('mode'), ok('mode'))
    assert.equal(score.earned.includes('volume'), ok('vt'))
    assert.equal(score.earned.includes('rate'), ok('rr'))
    assert.equal(score.earned.includes('oxygen'), ok('fio2') && ok('peep') && ok('pmax'))
    assert.ok(rows.every((r) => r.range.length > 0))
  }
  assert.equal(checkVent(cases[0], spec).find((r) => r.key === 'vt')!.range, '420–560 mL')
})

test('ventilator: drowned lungs need PEEP 8–10; a head injury wants a normal rate', () => {
  const drowning = ventSpec('drowning')
  const s = { mode: 'VC-CMV' as const, fio2: 100, vt: 420, rr: 14, peep: 5, pmax: 35 }
  assert.ok(!scoreVent(s, drowning).earned.includes('oxygen'))
  assert.equal(checkVent(s, drowning).find((r) => r.key === 'peep')!.range, '8–10 cmH2O')
  assert.ok(scoreVent({ ...s, peep: 9 }, drowning).earned.includes('oxygen'))
  assert.ok(scoreVent({ ...s, vt: 525 }, ventSpec('head-injury')).earned.includes('rate'))
})

test('NIV: a full face mask, IPAP 15 / EPAP 4, a backup rate and controlled oxygen pass; high oxygen does not', async () => {
  const { checkNiv } = await import('./nivModel')
  const ok = checkNiv({ mask: 'full-face', ipap: 15, epap: 4, rate: 16, fio2: 28 })
  assert.ok(ok.every((r) => r.ok))
  const bad = checkNiv({ mask: 'nasal', ipap: 30, epap: 4, rate: 0, fio2: 100 })
  assert.equal(bad.filter((r) => r.ok).length, 0)
})
