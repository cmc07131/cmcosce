import assert from 'node:assert/strict'
import { test } from 'node:test'
import { A, ARMS, SUTURE_MARKS, checkSuture, freshSuture, gaps, inFlap, judgeCorner, judgeStitch, type Pt, type Stitch, type SutureRun } from './model'

/** A stitch square across arm `arm` at `along` units from the tip, `bite` each side. */
function across(arm: 0 | 1, along: number, bite = 9): [Pt, Pt] {
  const [a, b] = ARMS[arm]
  const L = Math.hypot(b.x - a.x, b.y - a.y)
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }
  const n = { x: -u.y, y: u.x }
  const c = { x: a.x + u.x * along, y: a.y + u.y * along }
  return [
    { x: c.x + n.x * bite, y: c.y + n.y * bite },
    { x: c.x - n.x * bite, y: c.y - n.y * bite },
  ]
}

test('suture: a square, even stitch is good; near the tip, too shallow or slanted are not', () => {
  assert.ok(judgeStitch(...across(0, 20))!.ok)
  assert.match(judgeStitch(...across(0, 4))!.why!, /tip/)
  assert.match(judgeStitch(...across(1, 20, 4))!.why!, /close/)
  const [p, q] = across(1, 30)
  assert.ok(!judgeStitch(p, { x: q.x + 14, y: q.y })!.ok)
})

test('suture: the corner stitch goes skin, flap tip, skin', () => {
  assert.ok(inFlap({ x: 130, y: 70 }))
  assert.ok(judgeCorner([{ x: 146, y: 54 }, { x: 132, y: 70 }, { x: 146, y: 86 }]))
  assert.ok(!judgeCorner([{ x: 132, y: 70 }, { x: 150, y: 70 }]))
})

test('suture: a full repair earns every mark', () => {
  const stitches: Stitch[] = []
  for (const arm of [0, 1] as const) for (const at of [14, 26, 38, 50]) stitches.push(judgeStitch(...across(arm, at))!)
  assert.ok(gaps(stitches).every((g) => g.count === 4))
  const r: SutureRun = { ...freshSuture(), flapLooked: true, distal: true, history: true, edges: Array.from({ length: 12 }, (_, i) => i), lidoMl: 5, tested: true, irrigatedMl: 150, lifted: true, foreignOut: true, tagTrimmed: true, corner: 'half-buried', cornerOk: true, holder: 'instrument', stitches, sharps: true, dressed: true }
  assert.deepEqual(checkSuture(r).filter((x) => x.ok).map((x) => x.key), [...SUTURE_MARKS])
  assert.ok(A.x > 0)
})
