import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CUTDOWN_MARKS, FIELD, LANDMARK, checkCutdown, freshCutdown, judgeIncision, structureAt, type CutdownRun } from './model'

test('cutdown: a transverse incision across the vein at the landmark', () => {
  const t = judgeIncision({ x: LANDMARK.x - 2, y: LANDMARK.y - 12 }, { x: LANDMARK.x + 2, y: LANDMARK.y + 12 })
  assert.ok(t.angle > 60 && t.crosses && t.nearLandmark)
  assert.ok(t.length > 2 && t.length < 3)
  const along = judgeIncision({ x: LANDMARK.x - 15, y: LANDMARK.y - 1 }, { x: LANDMARK.x + 15, y: LANDMARK.y + 1 })
  assert.ok(along.angle < 30)
})

test('cutdown: the nerve and vein only show once the fat is spread', () => {
  assert.equal(structureAt({ x: 100, y: FIELD.veinY }, 0.2), 'fat')
  assert.equal(structureAt({ x: 100, y: FIELD.veinY }, 0.8), 'vein')
  assert.equal(structureAt({ x: 100, y: FIELD.nerveY }, 0.8), 'nerve')
})

test('cutdown: a clean cut-down earns every mark; a cannula pointing to the foot is critical', () => {
  const r: CutdownRun = { ...freshCutdown(), mark: LANDMARK, cleaned: 0.9, local: true, tourniquet: true, incision: { from: { x: LANDMARK.x - 2, y: LANDMARK.y - 12 }, to: { x: LANDMARK.x + 2, y: LANDMARK.y + 12 } }, spread: 0.8, lifted: 'vein', ligatures: ['distal', 'proximal'], tied: ['distal', 'proximal'], venotomy: 0.35, cannula: 'proximal', secured: true, fluids: true, released: true, closed: true, dressed: true }
  assert.deepEqual(checkCutdown(r).filter((x) => x.ok).map((x) => x.key), [...CUTDOWN_MARKS])
  assert.ok(checkCutdown({ ...r, cannula: 'distal' }).some((x) => x.critical))
})
