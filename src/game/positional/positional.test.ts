import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EPLEY_MARKS, HALLPIKE_MARKS, epleyRows, freshPos, hallpikeRows, nystagmus, provoking, type PosRun } from './model'

test('positional: the nystagmus has a latency, builds, beats, and fades', () => {
  assert.equal(nystagmus(2).strength, 0)
  assert.ok(nystagmus(10).strength === 1)
  assert.ok(nystagmus(30).strength === 0)
  const beats = Array.from({ length: 40 }, (_, i) => nystagmus(10 + i * 0.02).torsion)
  assert.ok(Math.max(...beats) > 5 && Math.min(...beats) < 2, 'a sawtooth of slow drift and quick beats')
})

test('positional: only head-right, lying, head-down provokes it', () => {
  const r: PosRun = { ...freshPos(false), hipX: 0.55, yaw: 45, lie: 1, ext: 20 }
  assert.ok(provoking(r))
  assert.ok(!provoking({ ...r, yaw: -45 }))
  assert.ok(!provoking({ ...r, lie: 0.5 }))
})

test('positional: a right Hallpike and an Epley done right earn every mark', () => {
  const h: PosRun = { ...freshPos(false), explained: true, eyesOpenAsked: true, hipX: 0.55, yaw: 45, lie: 1, dropS: 1.1, yawAtDrop: 45, ext: 20, extAtDrop: 20, watchedS: 32, sawNystagmus: true, dx: 'right-posterior' }
  assert.equal(hallpikeRows(h).filter((x) => x.ok).length, HALLPIKE_MARKS.length)
  assert.ok(!hallpikeRows({ ...h, dropS: 4 }).find((x) => x.key === 'drop')!.ok)
  assert.ok(!hallpikeRows({ ...h, hipX: 0.85 }).find((x) => x.key === 'start')!.ok)
  const e: PosRun = { ...freshPos(true), holds: [30, 30, 30], turned: true, rolled: true, satUp: true, retested: true }
  assert.equal(epleyRows(e).filter((x) => x.ok).length, EPLEY_MARKS.length)
})
