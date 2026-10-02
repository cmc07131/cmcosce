import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ER_START, freshShoulder, reduceRows, rotate, type ShoulderRun } from './model'

/** Rotate to `to` at `degPerS`, in 0.1 s ticks. */
function turn(run: ShoulderRun, to: number, degPerS: number, sedated = true) {
  let r = run
  const events: string[] = []
  for (let i = 0; i < 400 && r.er < to - 0.01; i++) {
    const { patch, event } = rotate(r, r.lockedFor > 0 ? r.er : Math.min(to, r.er + degPerS * 0.1), 0.1, sedated)
    r = { ...r, ...patch }
    events.push(event)
  }
  return { r, events }
}

test('shoulder: slow external rotation reduces it without a lock', () => {
  const { r, events } = turn(freshShoulder(), 90, 15)
  assert.ok(r.reduced)
  assert.equal(r.locks, 0)
  assert.ok(events.includes('clunk'))
})

test('shoulder: going fast builds spasm and locks the arm', () => {
  const { r } = turn(freshShoulder(), 90, 120)
  assert.ok(r.locks >= 1)
  assert.ok(r.er > ER_START)
})

test('shoulder: the sedationist leaving the airway is critical', () => {
  const r: ShoulderRun = { ...freshShoulder(), depthChecked: ['name'], sedationistOnAirway: false }
  assert.ok(reduceRows(r, true).some((x) => x.key === 'depth' && x.critical))
})
