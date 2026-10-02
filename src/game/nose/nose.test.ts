import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BLEED, NOSE_MARKS, SIDE, checkNose, freshNose, ringSectors, tamponAt, type NoseRun } from './model'

test('nose: a ring of dabs around the vessel counts; dabs on it do not', () => {
  const ring = Array.from({ length: 8 }, (_, i) => ({ x: BLEED.x + 9 * Math.cos(((i + 0.5) / 8) * Math.PI * 2), y: BLEED.y + 9 * Math.sin(((i + 0.5) / 8) * Math.PI * 2) }))
  assert.equal(ringSectors(ring), 8)
  assert.equal(ringSectors([BLEED]), 0)
})

test('nose: the tampon along the floor is level; toward the eye it climbs', () => {
  assert.ok(Math.abs(tamponAt({ x: SIDE.nostril.x + 140, y: SIDE.floorY }).angle) < 2)
  assert.ok(tamponAt({ x: SIDE.nostril.x + 60, y: SIDE.floorY - 70 }).angle > 45)
})

test('nose: a full run earns every mark; both sides of the septum is critical', () => {
  const ring = Array.from({ length: 8 }, (_, i) => ({ x: BLEED.x + 9 * Math.cos(((i + 0.5) / 8) * Math.PI * 2), y: BLEED.y + 9 * Math.sin(((i + 0.5) / 8) * Math.PI * 2) }))
  const r: NoseRun = { ...freshNose(), posture: 'forward', pinch: 'soft', pressMin: 15, ice: true, haemo: true, anticoag: true, light: true, speculum: true, spray: true, clots: [], sawBleed: true, dabs: ring, explained: true, lubed: true, tampon: { angle: 2, depth: SIDE.depth }, salineMl: 10, throat: true, taped: true, documented: true }
  assert.deepEqual(checkNose(r).filter((x) => x.ok).map((x) => x.key), [...NOSE_MARKS])
  assert.ok(checkNose({ ...r, bothSides: true }).some((x) => x.critical))
})
