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

test('exam3d: hints say the next act in words, and what must come first', async () => {
  const { actWords, nextAct, unmet } = await import('./hints')
  const plan = parseDo('feel wrist-L & press pulp-L,nails-L')
  let progress = freshProgress(plan)
  assert.equal(actWords(nextAct(plan, progress)!), 'Feel: the left radial pulse')
  ;({ progress } = advance(plan, progress, ev('feel', 'wrist-L')))
  assert.equal(actWords(nextAct(plan, progress)!), 'Press: the left index fingertip or the left nails')
  assert.equal(actWords(parseDo("say ok-sign")[0][0][0]), "Ask: “Make an 'OK' sign”")
  const lachman = parseDo('feel shin-R @knee-R=15..35')[0][0][0]
  assert.equal(actWords(lachman), 'Feel: the right shin (with the right knee bent 15–35°)')
  assert.deepEqual(unmet(lachman, lying), ['knee-R=15..35'])
  assert.equal(actWords(parseDo('look hands')[0][0][0]), 'Look: the hands')
})

test('exam3d: a focused manoeuvre is the act its item needs: the side from its place, the joint it moves', async () => {
  const { eventOf, offerLabel, offerOf } = await import('./manoeuvres')
  const of = (entry: string) => offerOf(entry)!
  assert.deepEqual(eventOf(of('bend-knee@knee-R')), { tool: 'say', say: 'bend-knee-R' })
  assert.deepEqual(eventOf(of('ok-sign')), { tool: 'say', say: 'ok-sign' })
  assert.deepEqual(eventOf(of('move-knee@knee-R')), { tool: 'move', move: 'knee-R:flex', site: 'knee-R' })
  assert.deepEqual(eventOf(of('hip-roll@thigh-L')), { tool: 'move', move: 'hip-L:rot', site: 'thigh-L' })
  assert.deepEqual(eventOf(of('bend-elbow@antecubital-L')), { tool: 'move', move: 'elbow-L:flex', site: 'antecubital-L' })
  assert.deepEqual(eventOf(of('lachman@knee-R')), { tool: 'lachman', site: 'knee-R' })
  assert.ok(run('say bend-knee-R & move knee-R:flex & lachman knee-R', [eventOf(of('bend-knee@knee-R')), eventOf(of('move-knee@knee-R')), eventOf(of('lachman@knee-R'))].map((e) => ({ ...e, state: lying }))))
  assert.equal(offerLabel(of('pulse@dp-R')), 'Feel the dorsalis pedis pulse')
  assert.equal(offerLabel(of('pulse@wrist-L')), 'Feel the radial pulse')
  assert.equal(offerLabel(of('joint-line@lateraljoint-R')), 'Knee bent: press along the lateral joint line')
})
