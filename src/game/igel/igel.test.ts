import assert from 'node:assert/strict'
import { test } from 'node:test'
import { along, freshIgelRun, inward, IGEL_MARKS, judgeTape, nearest, pushTo, rightSize, scoreIgel, squeeze, withdraw, type IgelRun, type Pt } from './model'

/** Push the tip along the track, offset from it by `off` (positive toward the tongue). */
function glide(run: IgelRun, off = 0, to = 1) {
  let r = run
  const events: string[] = []
  for (let s = 0.01; s <= to + 0.001; s += 0.02) {
    const { p, t } = along(s)
    const n = inward(t)
    const q: Pt = { x: p.x + n.x * off, y: p.y + n.y * off }
    const { patch, event } = pushTo(r, q)
    r = { ...r, ...patch }
    events.push(event)
    if (r.seated || r.folded) break
  }
  return { r, events }
}

const ready = (): IgelRun => ({ ...freshIgelRun(), size: 4, pillow: true, ext: 20, open: 0.8, grip: 'block', lube: { front: 1, back: 1, bowl: 0 } })

test('i-gel sizing: 70 kg is a 4; the overlap bands allow either', () => {
  assert.deepEqual(rightSize(70), [4])
  assert.deepEqual(rightSize(55), [3, 4])
  assert.deepEqual(rightSize(95), [5])
})

test('i-gel track: the tongue is on the inside of the curve', () => {
  const { p, t } = along(0.3)
  const n = inward(t)
  assert.ok(nearest({ x: p.x + n.x * 10, y: p.y + n.y * 10 }).off > 8)
  assert.ok(n.x > 0, 'the tongue lies toward the feet of the palate in the supine frame')
  assert.ok(Math.abs(nearest(p).off) < 1)
})

test('i-gel insertion: along the palate it seats at definite resistance', () => {
  const { r, events } = glide(ready())
  assert.ok(r.seated, 'seated')
  assert.equal(r.attempts, 1)
  assert.equal(events.at(-1), 'seated')
})

test('i-gel insertion: upside down it folds; toward the tongue it catches, then folds; closed mouth stops it', () => {
  const flipped = glide({ ...ready(), orientation: 'palate' }).r
  assert.ok(flipped.folded && !flipped.seated)
  assert.match(flipped.failures[0], /upside down/)

  const catching = glide(ready(), 11)
  assert.ok(catching.events.includes('tongue') && !catching.r.folded)
  const folding = glide(ready(), 18).r
  assert.ok(folding.folded)
  assert.match(folding.failures[0], /tongue/)

  const shut = glide({ ...ready(), open: 0 })
  assert.ok(shut.events.includes('teeth') && !shut.r.seated)

  const again = glide({ ...folding, ...withdraw() }).r
  assert.ok(again.seated)
  assert.equal(again.attempts, 2)
})

test('i-gel ventilation: gentle breaths through a seated device; too long leaks', () => {
  const seated = { ...ready(), seated: true }
  assert.equal(squeeze(seated, 1), 'good')
  assert.equal(squeeze(seated, 2.2), 'hard')
  assert.equal(squeeze(ready(), 1), 'leak-unseated')
})

test('i-gel tape: maxilla to maxilla across the bite block', () => {
  const line = (y1: number, y2: number) => Array.from({ length: 21 }, (_, i) => ({ x: 10 + i * 4, y: y1 + ((y2 - y1) * i) / 20 }))
  assert.ok(judgeTape([...line(58, 64)]).ok)
  assert.ok(judgeTape(line(84, 84)).mandible)
  assert.ok(!judgeTape(line(40, 40)).ok)
})

test('i-gel scoring: a clean run earns every mark; mistakes are faults', () => {
  const clean: IgelRun = { ...glide(ready()).r, breaths: 3, saidConfirm: true, tubeFr: 12, tube: 1, taped: true, lowestSpo2: 90 }
  const s = scoreIgel(clean)
  assert.deepEqual(s.earned, [...IGEL_MARKS])
  assert.deepEqual(s.faults, [])

  const messy = scoreIgel({ ...clean, size: 3, inflateTried: true, attempts: 4, lube: { front: 1, back: 1, bowl: 0.5 } })
  assert.ok(!messy.earned.includes('size') && !messy.earned.includes('insert') && !messy.earned.includes('lube'))
  assert.ok(messy.faults.some((f) => f.critical && /three/.test(f.text)))
  assert.ok(messy.faults.some((f) => /nothing to inflate/.test(f.text)))
})
