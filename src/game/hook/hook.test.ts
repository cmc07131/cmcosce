import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HOOK_MARKS, POINT_START, SURFACE_Y, advance, angleOf, backOut, checkHook, freshHook, onArc, type HookRun } from './model'

test('hook: the point starts under the skin and pops out past 0°', () => {
  assert.ok(onArc(POINT_START).y < SURFACE_Y)
  let r: HookRun = { ...freshHook(), gripped: true }
  for (let d = POINT_START; d >= -15; d -= 5) {
    const p = onArc(d)
    const a = angleOf(p)
    r = { ...r, ...advance(r, a.deg, a.off).patch }
  }
  assert.ok(r.popped && r.offCurve === 0)
})

test('hook: backing out with the barb on tears; a full run earns every mark', () => {
  assert.ok(backOut(freshHook()).tore)
  const r: HookRun = { ...freshHook(), looked: true, water: true, tetanus: true, allergy: true, blocked: true, eyes: true, gripped: true, popped: true, barbCut: true, removed: true, inspected: true, dressed: true }
  assert.deepEqual(checkHook(r).filter((x) => x.ok).map((x) => x.key), [...HOOK_MARKS])
})
