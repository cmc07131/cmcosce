import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BIRTH_MARKS, THIRD_MARKS, checkBirth, checkThird, freshBirth, freshThird, separated, type BirthRun, type ThirdRun } from './model'

test('delivery: a controlled birth earns every mark; hard traction is critical', () => {
  const r: BirthRun = { ...freshBirth(), palm: true, guard: true, pant: true, crowned: 'controlled', cordFelt: true, cord: 'slipped', restituted: true, anterior: 'gentle', posterior: true, dried: 0.9, skin: true, secondsSinceBirth: 90, clampedAt: 75 }
  assert.deepEqual(checkBirth(r).filter((x) => x.ok).map((x) => x.key), [...BIRTH_MARKS])
  assert.ok(checkBirth({ ...r, anterior: 'hard' }).some((x) => x.critical))
  assert.ok(!checkBirth({ ...r, clampedAt: 20 }).find((x) => x.key === 'baby')!.ok)
})

test('third stage: separation takes time; a guarded delivery earns every mark', () => {
  assert.ok(!separated({ ...freshThird(), oxytocin: true, minutes: 2 }))
  assert.ok(separated({ ...freshThird(), oxytocin: true, minutes: 4 }))
  const r: ThirdRun = { ...freshThird(), palpated: true, oxytocin: true, minutes: 5, saw: ['gush', 'cord', 'uterus'], guarded: true, placentaOut: true, checked: ['cotyledons', 'membranes', 'vessels'], rubbed: 0.8, inspected: true, ebl: 300 }
  assert.deepEqual(checkThird(r).filter((x) => x.ok).map((x) => x.key), [...THIRD_MARKS])
  assert.ok(checkThird({ ...r, inversion: true }).some((x) => x.critical))
})
