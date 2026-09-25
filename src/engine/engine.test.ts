import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { classifyTibia, drillRelease, needleSeat } from '../game/ioRules'
import { buildSolids, keyToDir, planActivation, step, targetTilesFor, vectorToDir } from './grid'
import { applyConfirm, applyTalkOption, examinerClause, hintFor, judgeSequence, marksOnAction } from './judge'
import { packSchema, readoutText, type Action, type Pack } from './schema'

function load(name: string): Pack {
  const raw = JSON.parse(readFileSync(new URL(`../../content/packs/${name}/pack.json`, import.meta.url), 'utf8'))
  return packSchema.parse(raw)
}

test('A moves west and D moves east', () => {
  assert.equal(keyToDir('a'), 'w')
  assert.equal(keyToDir('A'), 'w')
  assert.equal(keyToDir('ArrowLeft'), 'w')
  assert.equal(keyToDir('d'), 'e')
  assert.equal(keyToDir('ArrowRight'), 'e')
  const solids = new Set<string>()
  const left = step({ x: 4, y: 4, facing: 's' }, keyToDir('a')!, solids, 10, 10)
  const right = step({ x: 4, y: 4, facing: 's' }, keyToDir('d')!, solids, 10, 10)
  assert.equal(left.x, 3)
  assert.equal(right.x, 5)
  assert.equal(vectorToDir(-0.8, 0.1), 'w')
  assert.equal(vectorToDir(0.8, 0.1), 'e')
  assert.equal(vectorToDir(0.1, 0.1), null)
})

test('every gym-1 hotspot has a place to stand', () => {
  const pack = load('gym-1')
  const solids = buildSolids(pack)
  const start = pack.room.playerStart
  assert.equal(solids.has(`${start.x},${start.y}`), false)
  const ids = [...pack.cast.map((npc) => npc.id), ...pack.room.interactables.map((item) => item.id)]
  for (const id of ids) {
    const plan = planActivation(start, targetTilesFor(pack, id), solids, pack.room.cols, pack.room.rows)
    assert.ok(plan, `no stand tile for ${id}`)
  }
})

test('every pack loads and every hotspot has a place to stand', () => {
  const names = readdirSync(new URL('../../content/packs/', import.meta.url))
  assert.ok(names.length > 0)
  for (const name of names) {
    const pack = load(name)
    const solids = buildSolids(pack)
    const start = pack.room.playerStart
    assert.equal(solids.has(`${start.x},${start.y}`), false, `${name}: player starts on a solid tile`)
    const ids = [...pack.cast.map((npc) => npc.id), ...pack.room.interactables.map((item) => item.id)]
    for (const id of ids) {
      const plan = planActivation(start, targetTilesFor(pack, id), solids, pack.room.cols, pack.room.rows)
      assert.ok(plan, `${name}: no stand tile for ${id}`)
    }
  }
})

test('hint names the first gold-path gap and then handover', () => {
  const pack = load('gym-1')
  assert.match(hintFor(pack, []), /Introduce/)
  const intro = pack.actions.find((action) => action.id === 'intro')!
  assert.equal(hintFor(pack, marksOnAction(intro)), pack.actions.find((action) => action.id === 'ppe-kit')!.hint)
  assert.equal(hintFor(pack, pack.marks.map((mark) => mark.id)), 'Handover / leave when you are ready.')
})

test('history before help is a caution, help before history passes, missing help does not fail sequence', () => {
  const pack = load('gym-1')
  const earlyHistory = judgeSequence(pack.sequenceRules, [
    { actionId: 'history', atMs: 1000, markIds: ['MS-18'] },
    { actionId: 'call-now', atMs: 4000, markIds: ['MS-05'] },
  ])
  assert.equal(earlyHistory.find((row) => row.id === 'help-before-history')?.status, 'caution')

  const proper = judgeSequence(pack.sequenceRules, [
    { actionId: 'call-now', atMs: 1000, markIds: ['MS-05'] },
    { actionId: 'elevate', atMs: 2000, markIds: ['MS-13'] },
    { actionId: 'history', atMs: 5000, markIds: ['MS-18'] },
  ])
  assert.equal(proper.find((row) => row.id === 'help-before-history')?.status, 'pass')
  assert.equal(proper.find((row) => row.id === 'elevate-before-secondary')?.status, 'pass')

  const missed = judgeSequence(pack.sequenceRules, [{ actionId: 'history', atMs: 1000, markIds: ['MS-18'] }])
  assert.equal(missed.find((row) => row.id === 'help-before-history')?.status, 'pass')
})

test('secondary survey before elevation still scores and flags sequence', () => {
  const pack = load('gym-1')
  const verdicts = judgeSequence(pack.sequenceRules, [
    { actionId: 'maternal-abc', atMs: 500, markIds: ['MS-19'] },
    { actionId: 'elevate', atMs: 3000, markIds: ['MS-13', 'MS-14'] },
  ])
  assert.equal(verdicts.find((row) => row.id === 'elevate-before-secondary')?.status, 'caution')
})

test('psychiatry trap does not score; named teams do; partial kit still grants what was picked', () => {
  const phone = load('gym-1').actions.find((action) => action.id === 'phone-menu')!
  const psych = phone.options!.find((option) => option.id === 'psych')!
  const trap = applyTalkOption(phone, psych, [], (id) => id)
  assert.deepEqual(trap.grantMarks, [])
  assert.equal(trap.spend, true)

  const partial = applyConfirm(phone, ['og', 'psych'])
  assert.deepEqual(partial.grantMarks, ['MS-06'])
  assert.equal(partial.trapLines.length, 1)
  assert.equal(partial.complete, false)

  const full = applyConfirm(phone, ['og', 'ot', 'anaes', 'paeds', 'cat1'])
  assert.ok(full.grantMarks.includes('MS-05'))
  assert.ok(full.grantMarks.includes('MS-10'))
  assert.equal(full.complete, true)
})

test('replace-the-cord is a trap and does not log as the elevate action', () => {
  const elevate = load('gym-1').actions.find((action) => action.id === 'elevate')!
  const trap = applyTalkOption(elevate, elevate.options!.find((option) => option.id === 'replace')!, ['gloves'], (id) => id)
  assert.equal(trap.log, false)
  assert.equal(trap.grantMarks.length, 0)
  const lift = applyTalkOption(elevate, elevate.options!.find((option) => option.id === 'lift')!, ['gloves'], (id) => id)
  assert.deepEqual(lift.grantMarks, ['MS-13', 'MS-14'])
  const locked = applyTalkOption(elevate, elevate.options!.find((option) => option.id === 'lift')!, [], (id) => id)
  assert.ok(locked.lockedReason)
})

test('a-before-b ignores a one-sided pair', () => {
  const rule = {
    id: 'pair',
    earlierAny: ['elevate'],
    laterAny: ['handover'],
    require: 'a-before-b' as const,
    okNote: 'ok',
    failNote: 'bad',
  }
  assert.equal(judgeSequence([rule], [{ actionId: 'handover', atMs: 10, markIds: [] }])[0].status, 'pass')
  assert.equal(
    judgeSequence(
      [rule],
      [
        { actionId: 'handover', atMs: 10, markIds: [] },
        { actionId: 'elevate', atMs: 20, markIds: [] },
      ],
    )[0].status,
    'caution',
  )
})

test('CICO monitor stays blank until a waveform is asked for', () => {
  const pack = load('aw-em-01')
  const monitor = pack.room.props.find((prop) => prop.id === 'monitor')
  const idle = readoutText(monitor?.readout, [])
  assert.match(idle ?? '', /ETCO2 —/)
  assert.equal(readoutText(monitor?.readout, ['bougie']), 'SpO2 68%  ETCO2 —  hold-up')
  assert.match(readoutText(monitor?.readout, ['bougie', 'etco2']) ?? '', /square ETCO2/)
  assert.equal(readoutText(monitor?.readout, ['etco2', 'no-etco2']), 'No ETCO2')
  const playable = JSON.stringify({ items: pack.items, actions: pack.actions })
  assert.equal(/etomidate|suxamethonium/i.test(playable), false)
  const solids = buildSolids(pack)
  for (const id of [...pack.cast.map((npc) => npc.id), ...pack.room.interactables.map((item) => item.id)]) {
    assert.ok(planActivation(pack.room.playerStart, targetTilesFor(pack, id), solids, pack.room.cols, pack.room.rows), id)
  }
})

test('pacing scores milliamps and 1 mg, not IA or 0.6 as the full dose', () => {
  const pack = load('cv-em-02')
  const solids = buildSolids(pack)
  for (const id of [...pack.cast.map((npc) => npc.id), ...pack.room.interactables.map((item) => item.id)]) {
    assert.ok(planActivation(pack.room.playerStart, targetTilesFor(pack, id), solids, pack.room.cols, pack.room.rows), id)
  }
  const monitor = pack.room.props.find((prop) => prop.id === 'monitor')
  assert.match(readoutText(monitor?.readout, []) ?? '', /CHB/)
  assert.match(readoutText(monitor?.readout, ['paced', 'pulse']) ?? '', /Pulse 70/)
  const traps = pack.actions.flatMap((action) => action.options ?? []).filter((option) => option.isTrap)
  assert.ok(traps.some((option) => /0\.6 mg/.test(option.label)))
  assert.ok(traps.some((option) => /IA/.test(option.label)))
  const scoring = pack.actions.flatMap((action) => action.options ?? []).filter((option) => !option.isTrap)
  assert.equal(scoring.some((option) => /0\.6 mg is the full/.test(option.label)), false)
})

test('IO insertion is a performed sequence on a clean tibia', () => {
  const pack = load('io-em-01')
  const solids = buildSolids(pack)
  for (const id of [...pack.cast.map((npc) => npc.id), ...pack.room.interactables.map((item) => item.id)]) {
    assert.ok(planActivation(pack.room.playerStart, targetTilesFor(pack, id), solids, pack.room.cols, pack.room.rows), id)
  }
  const insert = pack.actions.find((action) => action.id === 'insert')
  assert.equal(insert?.options?.[0]?.perform, 'io')
  assert.match(insert?.options?.[0]?.performHint ?? '', /counter-clockwise/)
  const screen = pack.actions.find((action) => action.id === 'screen')
  assert.match(screen?.options?.find((option) => option.id === 'clean')?.detail ?? '', /2 cm medial/)
  const traps = pack.actions.flatMap((action) => action.options ?? []).filter((option) => option.isTrap)
  assert.ok(traps.some((option) => /fractured/i.test(option.label)))
  assert.ok(traps.some((option) => /first-line for every adult arrest/i.test(option.label)))
  assert.equal(classifyTibia(130, 146), 'flat')
  assert.equal(classifyTibia(94, 108), 'bump')
  assert.equal(classifyTibia(100, 78), 'joint')
  assert.equal(classifyTibia(100, 180), 'shaft')
  assert.equal(classifyTibia(8, 8), 'off')
  assert.equal(needleSeat('pink'), 'short')
  assert.equal(needleSeat('blue'), 'adult')
  assert.equal(needleSeat('yellow'), 'long')
  assert.equal(drillRelease(30), 'early')
  assert.equal(drillRelease(70), 'seated')
  assert.equal(drillRelease(90), 'through')
})

test('elevate is a hand gesture, not only a menu line', () => {
  const elevate = load('gym-1').actions.find((action) => action.id === 'elevate')!
  assert.equal(elevate.options!.find((option) => option.id === 'lift')!.perform, 'lift')
})

test('examiner toast keeps the first clause', () => {
  const action = { id: 'x', kind: 'talk', targetIds: ['a'], hint: 'h', marksChecklistIds: ['MS-01'] } as Action
  assert.deepEqual(marksOnAction(action), ['MS-01'])
  const long = 'Recognise overt cord prolapse aloud. Then a second sentence that the toast should not show.'
  assert.equal(examinerClause(long), 'Recognise overt cord prolapse aloud')
  assert.ok(examinerClause('x'.repeat(90)).length <= 70)
})
