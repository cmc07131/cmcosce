import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advance, freshProgress, parseDo, toolsOf, type ExamEvent, type ExamState } from './model'

const lying: ExamState = { posture: 'supine', joints: {}, flags: [] }
const ev = (tool: string, site: string, state: ExamState = lying): ExamEvent => ({ tool, site, state })
const run = (line: string, events: ExamEvent[]) => {
  const plan = parseDo(line)
  let progress = freshProgress(plan)
  let done = false
  for (const e of events) ({ progress, done } = advance(plan, progress, e))
  return done
}

test('exam3d: a tool on a site, a site on either side, a group', () => {
  assert.ok(run('look hand', [ev('look', 'hand-L')]))
  assert.ok(!run('look hand', [ev('feel', 'hand-L')]))
  assert.ok(run('feel abdomen', [ev('feel', 'iliac-R')]))
  // Pressing firmly counts as feeling, not the other way round.
  assert.ok(run('feel knee-R', [ev('press', 'knee-R')]))
  assert.ok(!run('press sternum', [ev('feel', 'sternum')]))
})

test('exam3d: each of several sites, in any order', () => {
  const pulses = 'feel femoral-R+popliteal-R+dp-R'.replace('femoral-R', 'groin-R')
  assert.ok(!run(pulses, [ev('feel', 'dp-R'), ev('feel', 'groin-R')]))
  assert.ok(run(pulses, [ev('feel', 'dp-R'), ev('feel', 'groin-R'), ev('feel', 'popliteal-R')]))
})

test('exam3d: shifting dullness is percuss, roll, percuss again, in that order', () => {
  const line = 'percuss flank-R,flank-L > say roll-L > percuss flank-R,flank-L'
  const say: ExamEvent = { tool: 'say', say: 'roll-L', state: lying }
  assert.ok(run(line, [ev('percuss', 'flank-L'), say, ev('percuss', 'flank-L')]))
  assert.ok(!run(line, [say, ev('percuss', 'flank-L')]))
})

test('exam3d: conditions on posture, joint angle, and not yet touched', () => {
  const bent = (deg: number): ExamState => ({ posture: 'supine', joints: { 'knee-R': deg }, flags: [] })
  assert.ok(run('feel shin-R @knee-R=20..30', [ev('feel', 'shin-R', bent(25))]))
  assert.ok(!run('feel shin-R @knee-R=20..30', [ev('feel', 'shin-R', bent(90))]))
  const untouched: ExamState = { posture: 'supine', joints: {}, flags: ['untouched'] }
  assert.ok(run('look patient @untouched', [ev('look', 'head', untouched)]))
  assert.ok(!run('look patient @untouched', [ev('look', 'head')]))
})

test('exam3d: either way does it; joint movements; the tools a station needs', () => {
  assert.ok(run('look hands | say hands-out', [{ tool: 'say', say: 'hands-out', state: lying }]))
  assert.ok(run('move knee-R', [{ tool: 'move', move: 'knee-R:flex', state: lying }]))
  assert.ok(!run('move knee-R:flex', [{ tool: 'move', move: 'hip-R:flex', state: lying }]))
  assert.deepEqual(toolsOf([parseDo('look hands | say hands-out'), parseDo('percuss flanks > feel liver')]).sort(), ['feel', 'look', 'percuss', 'say'])
})
