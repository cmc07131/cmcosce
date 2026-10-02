import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CLAM_MARKS, PHRENIC_X, SPACE, checkClam, freshClam, judgePericardium, judgeSide, type ClamRun } from './model'

const along = (x0: number, x1: number) => Array.from({ length: 16 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / 15; return { x, y: SPACE(x) } })

test('clamshell: each side follows the space from the mid-axillary line to the sternum', () => {
  assert.ok(judgeSide(along(166, 92), 'left').ok)
  assert.ok(judgeSide(along(14, 88), 'right').ok)
  assert.ok(!judgeSide(along(140, 92), 'left').ok, 'not lateral enough')
})

test('clamshell: the pericardium opens longitudinally in front of the phrenic nerve', () => {
  const ok = judgePericardium({ x: 96, y: 40 }, { x: 98, y: 120 })
  assert.ok(ok.longitudinal && !ok.crossesPhrenic && !ok.besideNerve)
  assert.ok(judgePericardium({ x: 60, y: 80 }, { x: PHRENIC_X + 10, y: 84 }).crossesPhrenic)
  const r: ClamRun = { ...freshClam(), left: true, right: true, sternum: 'saw', open: 0.9, lifted: true, pericardium: 'longitudinal', clot: 0.8, plugged: true, beating: true, closed: 'suture' }
  assert.deepEqual(checkClam(r).filter((x) => x.ok).map((x) => x.key), [...CLAM_MARKS])
})
