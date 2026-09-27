import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  NOSE,
  examSpec,
  fingertip,
  freshEyes,
  freshFingerNose,
  gazeOf,
  nystagmus,
  reachOf,
  scoreEyes,
  scoreFingerNose,
  zoneOf,
} from './model'

test('exam spec: test and lesion side from the pose', () => {
  assert.deepEqual(examSpec('eyes:right'), { test: 'eyes', side: 'right' })
  assert.deepEqual(examSpec('finger-nose'), { test: 'finger-nose', side: 'none' })
  assert.equal(examSpec('reflexes:right'), null)
})

test('gaze: the pen on your left is the patient looking to his right', () => {
  assert.ok(gazeOf(20, 50).h > 0)
  assert.ok(gazeOf(80, 50).h < 0)
  assert.equal(zoneOf(gazeOf(20, 50).h, 0), 'right')
  assert.equal(zoneOf(0, gazeOf(50, 20).v), 'up')
  assert.equal(zoneOf(0.1, 0.1), null)
})

test('nystagmus: toward the lesion on sustained gaze, none looking ahead, fine beats at the extreme', () => {
  const beats = (h: number, side: 'right' | 'left' | 'none') => Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(nystagmus(i / 50, h, side))))
  assert.equal(beats(0, 'right'), 0)
  assert.ok(beats(0.8, 'right') > beats(-0.8, 'right'), 'worse looking toward the lesion')
  assert.equal(beats(0.8, 'none'), 0, 'a normal patient has none at 30°')
  assert.ok(beats(1.2, 'none') > 0, 'end-point nystagmus at the extreme')
  // The drift is back toward the middle (negative for rightward gaze).
  assert.ok(nystagmus(0.2, 0.8, 'right') < 0)
})

test('eye movement scoring: head still, both sides held, up and down, not to the extreme', () => {
  const good = { ...freshEyes(), toldHeadStill: true, held: { right: 1.5, left: 1.2, up: 0.6, down: 0.5 } }
  assert.equal(scoreEyes(good, 'right').ok, true)
  assert.deepEqual(scoreEyes(good, 'right').faults, [])
  const noHold = { ...good, held: { ...good.held, right: 0.3 } }
  assert.equal(scoreEyes(noHold, 'right').ok, false)
  assert.match(scoreEyes(noHold, 'right').technique, /missed/)
  assert.equal(scoreEyes({ ...good, toldHeadStill: false }, 'right').ok, false)
  const extreme = scoreEyes({ ...good, extreme: true }, 'right')
  assert.equal(extreme.ok, true, 'going to the extreme is a fault, not a lost mark')
  assert.equal(extreme.faults.length, 1)
})

test('finger–nose: reach bands, ataxic path overshoots and wobbles, normal path is straight', () => {
  assert.equal(reachOf(30), 'close')
  assert.equal(reachOf(65), 'good')
  assert.equal(reachOf(90), 'far')
  const target = { x: 60, y: 150 }
  const off = (p: { x: number; y: number }) => {
    // Distance from the straight nose-to-target line.
    const dx = target.x - NOSE.x
    const dy = target.y - NOSE.y
    return Math.abs(dy * (p.x - NOSE.x) - dx * (p.y - NOSE.y)) / Math.hypot(dx, dy)
  }
  const times = Array.from({ length: 100 }, (_, i) => i / 100)
  assert.ok(Math.max(...times.map((t) => off(fingertip(t, target, false)))) < 0.001)
  assert.ok(Math.max(...times.map((t) => off(fingertip(t, target, true)))) > 3)
  const reachTip = fingertip(0.99, target, true)
  assert.ok(Math.hypot(reachTip.x - NOSE.x, reachTip.y - NOSE.y) > Math.hypot(target.x - NOSE.x, target.y - NOSE.y), 'past-points')
})

test('finger–nose scoring: both arms at full reach with the target moved', () => {
  const good = (arm: 'right' | 'left', x: number) => ({ arm, target: { x, y: 150 }, cm: 65, reach: 'good' as const })
  const run = { ...freshFingerNose(), instructed: true, attempts: [good('right', 60), good('right', 90), good('left', 150)] }
  assert.equal(scoreFingerNose(run, 'right').ok, true)
  assert.deepEqual(scoreFingerNose(run, 'right').faults, [])
  const oneArm = { ...run, attempts: run.attempts.filter((a) => a.arm === 'left') }
  assert.equal(scoreFingerNose(oneArm, 'right').ok, false)
  assert.match(scoreFingerNose(oneArm, 'right').technique, /right arm/)
  const close = { ...run, attempts: [...run.attempts, { arm: 'left' as const, target: { x: 130, y: 100 }, cm: 30, reach: 'close' as const }] }
  assert.ok(scoreFingerNose(close, 'right').faults.some((f) => /too close/.test(f.text)))
})
