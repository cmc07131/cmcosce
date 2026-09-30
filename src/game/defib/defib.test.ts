import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFIB_MARKS, SITES, defibSpec, freshDefib, scoreDefib, shock, type DefibRun } from './model'

const padsOn = (): DefibRun => ({ ...freshDefib(), pads: [{ x: SITES.sternal.x, y: SITES.sternal.y }, { x: SITES.apical.x, y: SITES.apical.y }] })

test('defib: AF needs SYNC, the right energy and "all clear"; done right it converts and earns every mark', () => {
  const spec = defibSpec('af')
  let run: DefibRun = { ...padsOn(), sync: true, energy: 200, charged: true, clearCalled: true }
  const r = shock(run, spec)
  assert.equal(r.event, 'fired')
  run = { ...run, ...r.patch }
  assert.ok(run.converted)
  const s = scoreDefib(run, spec)
  assert.deepEqual(s.earned, [...DEFIB_MARKS])
  assert.deepEqual(s.faults, [])
})

test('defib: an unsynchronised shock in AF is a critical fault; no "all clear" is unsafe', () => {
  const spec = defibSpec('af')
  let run: DefibRun = { ...padsOn(), sync: false, energy: 200, charged: true }
  run = { ...run, ...shock(run, spec).patch }
  const s = scoreDefib(run, spec)
  assert.ok(!run.converted)
  assert.ok(s.faults.some((f) => f.critical && /R wave/.test(f.text)))
  assert.ok(s.faults.some((f) => f.critical && /All clear|all clear/.test(f.text)))
})

test('defib: in VF a synchronised shock never fires; unsynchronised at 150 J or more works', () => {
  const spec = defibSpec('vf')
  let run: DefibRun = { ...padsOn(), sync: true, energy: 200, charged: true, clearCalled: true }
  assert.equal(shock(run, spec).event, 'waits')
  run = { ...run, sync: false }
  run = { ...run, ...shock(run, spec).patch }
  assert.ok(run.converted)
})

test('defib: pads on the wrong sites do not count', () => {
  const spec = defibSpec('af')
  const run: DefibRun = { ...freshDefib(), pads: [{ x: 100, y: 100 }, { x: 110, y: 110 }], sync: true, energy: 200, charged: true, clearCalled: true }
  const after = { ...run, ...shock(run, spec).patch }
  assert.ok(!after.converted)
  assert.ok(!scoreDefib(after, spec).earned.includes('pads'))
})
