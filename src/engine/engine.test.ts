import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { keyToBtn } from '../game/input'
import { ecgAt, pacedBeat } from '../game/bench/Monitor'
import { cicoCaseFor, judgeIncision, neckFeelAt, NECK, type CicoCase } from '../game/cico/case'
import { falseTract, freshCicoRun, scoreCico, type CicoRun } from '../game/cico/score'
import { contracting, cordCaseFor, fhrTarget, freshCordRun, scoreCord, type CordCase, type CordRun } from '../game/cord/model'
import { captureThreshold, freshPaceRun, scorePacing, type PaceCase, type PaceRun } from '../game/pacing/model'
import { ANATOMY, caseFor, drillOutcome, judgeLandmark, mgIn, popDepth, rightNeedle, type IoCase } from '../game/io/case'
import { freshRun, scoreRun, type Run } from '../game/io/score'
import { spokenLine } from '../game/store'
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
    for (const item of pack.room.interactables) {
      assert.ok(pack.actions.some((action) => action.targetIds.includes(item.id)), `${name}: ${item.id} leads nowhere`)
    }
  }
})

test('hint names the first gold-path gap and then handover', () => {
  const pack = load('gym-1')
  assert.match(hintFor(pack, []), /Introduce/)
  const intro = pack.actions.find((action) => action.id === 'intro')!
  assert.equal(hintFor(pack, marksOnAction(intro)), pack.actions.find((action) => action.id === 'call-now')!.hint)
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
    { actionId: 'cord', atMs: 2000, markIds: ['MS-13'] },
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
    { actionId: 'cord', atMs: 3000, markIds: ['MS-13', 'MS-14'] },
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

test('replace-the-cord is a trap and the cord is managed at the bench', () => {
  const cord = load('gym-1').actions.find((action) => action.id === 'cord')!
  const trap = applyTalkOption(cord, cord.options!.find((option) => option.id === 'replace')!, [], (id) => id)
  assert.equal(trap.log, false)
  assert.equal(trap.grantMarks.length, 0)
  const bench = cord.options!.find((option) => option.id === 'do-it')!
  assert.equal(bench.perform, 'cord')
  for (const id of ['MS-11', 'MS-13', 'MS-14', 'MS-16']) assert.ok(bench.marksChecklistIds!.includes(id), id)
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

test('IO station hands the procedure to the bench and keeps its traps', () => {
  const pack = load('io-em-01')
  const insert = pack.actions.find((action) => action.id === 'insert')
  assert.equal(insert?.options?.[0]?.perform, 'io')
  assert.doesNotMatch(insert?.options?.[0]?.performHint ?? '', /blue|counter-clockwise|5 mm/i, 'the bench hint must not give the steps away')
  const screen = pack.actions.find((action) => action.id === 'screen')
  assert.match(screen?.options?.find((option) => option.id === 'clean')?.detail ?? '', /2 cm medial/)
  const traps = pack.actions.flatMap((action) => action.options ?? []).filter((option) => option.isTrap)
  assert.ok(traps.some((option) => /fractured/i.test(option.label)))
  assert.ok(traps.some((option) => /first-line for every adult arrest/i.test(option.label)))
})

test('IO landmark: flat bone 2 cm medial to the tuberosity, and named errors elsewhere', () => {
  assert.equal(judgeLandmark(ANATOMY.target.x, ANATOMY.target.y).ok, true)
  assert.equal(judgeLandmark(ANATOMY.tuberosity.x, ANATOMY.tuberosity.y).feel, 'tuberosity')
  assert.equal(judgeLandmark(ANATOMY.patella.x, ANATOMY.patella.y).feel, 'patella')
  assert.equal(judgeLandmark(ANATOMY.fibulaHead.x, ANATOMY.fibulaHead.y).feel, 'fibula')
  assert.equal(judgeLandmark(125, 180).feel, 'lateral')
  assert.equal(judgeLandmark(ANATOMY.target.x, 260).ok, false)
})

test('IO needle: the 5 mm line decides the length', () => {
  assert.equal(rightNeedle('blue', 12).ok, true)
  assert.equal(rightNeedle('pink', 12).ok, false)
  assert.equal(rightNeedle('yellow', 12).ok, false)
  assert.equal(rightNeedle('blue', 24).ok, false)
  assert.equal(rightNeedle('yellow', 24).ok, true)
  assert.equal(mgIn(2, 2), 40)
  assert.equal(mgIn(1, 2), 20)
})

const NORMAL: IoCase = { legs: { left: 'clean', right: 'old-io' }, tissueMm: 12, cortexMm: 3, marrowMm: 25, marrowOnAspirate: true, extravasates: false }

test('IO drill: stop at the pop; long needles can go through', () => {
  const pop = popDepth(NORMAL)
  assert.equal(drillOutcome(pop - 1, 'blue', NORMAL), 'in-cortex')
  assert.equal(drillOutcome(pop + 2, 'blue', NORMAL), 'seated')
  assert.equal(drillOutcome(pop + 7, 'blue', NORMAL), 'too-deep')
  assert.equal(drillOutcome(25, 'blue', NORMAL), 'hub-on-skin')
  assert.equal(drillOutcome(41, 'yellow', NORMAL), 'through')
  assert.deepEqual(caseFor(42), caseFor(42))
})

function perfectRun(): Run {
  return {
    ...freshRun(),
    exposed: { left: true, right: true },
    side: 'left',
    needle: 'blue',
    primed: true,
    lidoVial: 'plain2',
    lidoMl: 3,
    gloves: true,
    towel: true,
    hands: { medial: true, lateral: true },
    dent: { ...ANATOMY.target },
    saidLandmark: true,
    scrub: 1,
    dry: true,
    contact: true,
    contactAngle: 0,
    lineChecked: true,
    saidLine: true,
    depth: popDepth(NORMAL) + 2,
    drilled: true,
    hubHeld: true,
    driverOff: true,
    styletOut: true,
    styletSafe: true,
    stabilizer: true,
    extension: true,
    locked: true,
    aspirated: true,
    lidoFirstMl: 2,
    dwell: true,
    flush: 'fast',
    lidoSecondMl: 1,
    calf: 'soft-ok',
    wristband: true,
    pressureBag: true,
    saidClose: true,
  }
}

test('IO bench: a clean run earns every bench mark and no faults', () => {
  const scored = scoreRun(perfectRun(), NORMAL)
  assert.deepEqual(scored.faults, [])
  assert.deepEqual(scored.marks, ['MS-04', 'MS-06', 'MS-07', 'MS-05', 'MS-08', 'MS-09', 'MS-10'])
})

test('IO bench: mistakes cost their own mark and name the reason', () => {
  const scored = scoreRun({ ...perfectRun(), side: 'right', handBehind: true, extBeforeStabilizer: true, flush: 'slow' }, NORMAL)
  for (const id of ['MS-04', 'MS-07', 'MS-09', 'MS-10']) assert.ok(!scored.marks.includes(id), id)
  assert.ok(scored.marks.includes('MS-08'))
  assert.ok(scored.faults.some((row) => row.critical && /behind the tibia/.test(row.text)))
  assert.ok(scored.faults.some((row) => row.critical && /Drilled a leg that is out/.test(row.text)))
  assert.ok(scored.faults.some((row) => /trickle/.test(row.text)))
})

test('examiner toast keeps the first clause', () => {
  const action = { id: 'x', kind: 'talk', targetIds: ['a'], hint: 'h', marksChecklistIds: ['MS-01'] } as Action
  assert.deepEqual(marksOnAction(action), ['MS-01'])
  const long = 'Recognise overt cord prolapse aloud. Then a second sentence that the toast should not show.'
  assert.equal(examinerClause(long), 'Recognise overt cord prolapse aloud')
  assert.ok(examinerClause('x'.repeat(90)).length <= 70)
})

test('pack lines name their speaker; no prefix is narration', () => {
  const pack = load('gym-1')
  const nurse = pack.cast.find((npc) => npc.role === 'nurse')!
  const you = spokenLine(pack, 'You: I am Dr Chan.')
  assert.equal(you.speakerId, 'player')
  assert.equal(you.text, 'I am Dr Chan.')
  const said = spokenLine(pack, `${nurse.displayName}: Calling now.`)
  assert.equal(said.speakerId, nurse.id)
  assert.equal(said.text, 'Calling now.')
  const told = spokenLine(pack, 'Doppler: fetal heart 80.')
  assert.equal(told.speakerId, null)
  assert.equal(told.text, 'Doppler: fetal heart 80.')
})

test('keyboard maps to Game Boy buttons without stealing WASD', () => {
  assert.equal(keyToBtn('ArrowUp'), 'up')
  assert.equal(keyToBtn('a'), 'left')
  assert.equal(keyToBtn('z'), 'a')
  assert.equal(keyToBtn('Enter'), 'a')
  assert.equal(keyToBtn('Escape'), 'b')
  assert.equal(keyToBtn('m'), 'start')
  assert.equal(keyToBtn('q'), null)
})

test('CICO neck: landmarks are felt in a slim neck and hidden in an obese one', () => {
  const y = (NECK.membraneTop + NECK.membraneBottom) / 2
  assert.equal(neckFeelAt(100, y, 'slim'), 'membrane')
  assert.equal(neckFeelAt(100, y, 'obese'), 'deep')
  assert.equal(neckFeelAt(100, 100, 'slim'), 'thyroid')
  assert.equal(neckFeelAt(160, y, 'slim'), 'lateral')
  assert.deepEqual(cicoCaseFor(7), cicoCaseFor(7))
})

test('CICO incision: DAS 2025 vertical midline, bottom to top, across the membrane', () => {
  const up = [{ x: 100, y: 200 }, { x: 101, y: 150 }, { x: 100, y: 100 }]
  assert.equal(judgeIncision(up).ok, true)
  assert.equal(judgeIncision([...up].reverse()).upward, false)
  assert.equal(judgeIncision([{ x: 70, y: 144 }, { x: 130, y: 144 }]).vertical, false)
  assert.equal(judgeIncision([{ x: 125, y: 200 }, { x: 125, y: 100 }]).midline, false)
})

const SLIM: CicoCase = { habitus: 'slim', falseTractBase: false }

function goodCico(): CicoRun {
  return {
    ...freshCicoRun(),
    extended: true,
    side: 'left',
    handshake: true,
    palpatedMembrane: true,
    saidLandmarks: true,
    incision: [{ x: 100, y: 200 }, { x: 100, y: 100 }],
    dissected: true,
    stabSite: 'membrane',
    bladeTransverse: true,
    edgeTowardYou: true,
    stabDepth: 4,
    stabbed: true,
    rotated: true,
    edgeCaudal: true,
    opened: 'lateral',
    bougieDepth: 12,
    bougieDone: true,
    tubeDepth: 4.5,
    tubeHeldForBougie: true,
    bougieOut: true,
    cuff: 1,
    circuit: true,
    askedEtco2: true,
    etco2Read: 'right',
    holdUntilTied: true,
    saidClose: true,
    minSpo2: 60,
  }
}

test('CICO bench: a clean run earns its marks with no faults', () => {
  const scored = scoreCico(goodCico(), SLIM)
  assert.deepEqual(scored.faults, [])
  for (const id of ['MS-10', 'MS-11', 'MS-12', 'MS-13', 'MS-14', 'MS-15', 'MS-16', 'MS-17', 'MS-18', 'MS-19', 'MS-20', 'MS-22']) assert.ok(scored.marks.includes(id), id)
})

test('CICO bench: a poor hole makes a false passage, and forcing it is critical', () => {
  assert.equal(falseTract({ ...goodCico(), stabSite: 'cricoid' }, SLIM), true)
  assert.equal(falseTract({ ...goodCico(), stabSite: 'cricoid', secondPass: true }, SLIM), false)
  const scored = scoreCico({ ...goodCico(), forcedHoldUp: true, arrested: true, minSpo2: 40 }, SLIM)
  assert.ok(!scored.marks.includes('MS-18'))
  assert.ok(scored.faults.some((f) => f.critical && /false passage/.test(f.text)))
  assert.ok(scored.faults.some((f) => f.critical && /arrested/.test(f.text)))
})

const PACE: PaceCase = { threshold: 60, sweaty: true, hairy: false, hyperK: false }

function goodPace(): PaceRun {
  return {
    ...freshPaceRun(),
    dried: true,
    leads: { ra: true, la: true, ll: true },
    padsFront: ['apPad'],
    padBack: 'leftScapula',
    mode: 'pacer',
    pacing: true,
    output: 70,
    biggestStep: 10,
    captureCalled: true,
    thresholdSeen: 60,
    femoral: true,
    femoralWithCapture: true,
    analgesia: 'fentanyl',
    saidClose: true,
  }
}

test('pacing: contact, pad vector, and potassium set the capture threshold', () => {
  assert.equal(captureThreshold(goodPace(), PACE), 60)
  assert.equal(captureThreshold({ ...goodPace(), dried: false }, PACE), 100)
  assert.equal(captureThreshold({ ...goodPace(), padsFront: ['alSternal', 'alApex'], padBack: null }, PACE), 70)
  assert.equal(captureThreshold({ ...goodPace(), padBack: 'rightScapula' }, PACE), Infinity)
  assert.equal(captureThreshold(goodPace(), { ...PACE, hyperK: true }), Infinity)
  assert.equal(captureThreshold({ ...goodPace(), calcium: true }, { ...PACE, hyperK: true }), 60)
})

test('pacing bench: a clean run scores, a shock and a carotid-only check do not', () => {
  const clean = scorePacing(goodPace(), PACE)
  assert.deepEqual(clean.faults, [])
  for (const id of ['MS-07', 'MS-08', 'MS-09', 'MS-10', 'MS-11', 'MS-12']) assert.ok(clean.marks.includes(id), id)
  const bad = scorePacing({ ...goodPace(), shocked: true, femoral: false, femoralWithCapture: false, carotid: true, output: 100 }, PACE)
  assert.ok(bad.faults.some((f) => f.critical && /shock/.test(f.text)))
  assert.ok(bad.faults.some((f) => /carotid/.test(f.text)))
  assert.ok(!bad.marks.includes('MS-10'))
  assert.ok(!bad.marks.includes('MS-11'))
})

const CORD: CordCase = { visible: true, contractions: false, delayed: false, compressedFhr: 80 }

test('cord: the heart recovers when the head is lifted or the bladder filled, and dips when the cord is handled', () => {
  const run = freshCordRun()
  assert.equal(fhrTarget(CORD, run, 10, -1), 80)
  assert.equal(fhrTarget(CORD, { ...run, elevated: true }, 10, -1), 140)
  assert.equal(fhrTarget(CORD, { ...run, elevated: true, handOut: true }, 10, -1), 80)
  assert.equal(fhrTarget(CORD, { ...run, bladderMl: 600, bladderClamped: true }, 10, -1), 140)
  assert.ok(fhrTarget(CORD, { ...run, elevated: true }, 10, 20) <= 65)
  const labouring = { ...CORD, contractions: true }
  assert.equal(contracting(labouring, run, 45), true)
  assert.equal(contracting(labouring, { ...run, terbutaline: true }, 45), false)
  assert.deepEqual(cordCaseFor(9), cordCaseFor(9))
})

function goodCord(): CordRun {
  return {
    ...freshCordRun(),
    gloves: true,
    apron: true,
    exposed: true,
    saidRecognised: true,
    lift: 1,
    elevated: true,
    elevatedAtS: 30,
    gauze: true,
    bayPose: 'knee-chest',
    doppler: true,
    saidFhr: true,
    transferPose: 'lateral',
  }
}

test('cord bench: a clean run earns every bench mark', () => {
  const scored = scoreCord(goodCord(), CORD)
  assert.deepEqual(scored.faults, [])
  assert.deepEqual(scored.marks.sort(), ['MS-03', 'MS-04', 'MS-11', 'MS-12', 'MS-13', 'MS-14', 'MS-15', 'MS-16', 'MS-17'])
})

test('cord bench: a delayed theatre needs a filled, clamped bladder; replacing the cord is critical', () => {
  const delayed = { ...CORD, delayed: true, contractions: true }
  const noFill = scoreCord(goodCord(), delayed)
  assert.ok(noFill.faults.some((f) => /bladder was not filled/.test(f.text)))
  assert.ok(noFill.faults.some((f) => /terbutaline/.test(f.text)))
  const filled = scoreCord({ ...goodCord(), bladderMl: 600, bladderClamped: true, saidEmptyBladder: true, terbutaline: true }, delayed)
  assert.deepEqual(filled.faults, [])
  const replaced = scoreCord({ ...goodCord(), replacedCord: true }, CORD)
  assert.ok(replaced.faults.some((f) => f.critical && /Do not replace/.test(f.text)))
  assert.ok(!replaced.marks.includes('MS-11'))
  const unneeded = scoreCord({ ...goodCord(), terbutaline: true }, CORD)
  assert.ok(unneeded.faults.some((f) => /Terbutaline is for a delayed birth/.test(f.text)))
})

test('monitor: a captured paced beat is spike, gap, broad QRS, then an opposite T wave', () => {
  assert.ok(Math.abs(pacedBeat(0)) < 0.05, 'the spike stands alone before the QRS')
  assert.ok(pacedBeat(0.13) > 0.9, 'tall QRS')
  assert.ok(pacedBeat(0.2) > 0.2, 'still inside the QRS at 200 ms: it is wide')
  assert.ok(pacedBeat(0.52) < -0.4, 'T wave points the other way')
  const paced = { rhythm: 'paced' as const, hr: 32, paceRate: 70, spo2: 94, bp: null, etco2: 'off' as const }
  assert.equal(ecgAt(paced, 0, 0.01).spike, true)
  assert.equal(ecgAt(paced, 0.3, 0.01).spike, false)
})
