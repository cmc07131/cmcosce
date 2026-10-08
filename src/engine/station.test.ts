import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ecgById } from '../game/ecg/atlas'
import { chest, tracheaX } from '../game/imaging/chest'
import { edhArc, head, onInner, SUTURES } from '../game/imaging/head'
import { imageEntry } from '../game/imaging/library'
import { burnPercent } from '../game/imaging/photos'
import { airwayWidth, anteriorHumeralOffset, kleinCutsEpiphysis, neck, pelvis, symphysisWidth } from '../game/imaging/skeleton'
import { fastRuq } from '../game/imaging/ultrasound'
import { faultsFor, usePlay } from '../game/store'
import { currentPhase, dueEvents, nextHint, nextWaitedEvent, untreatedEvents } from './judge'
import { worldSchema } from '../world/model'
import { REVIEWED } from '../world/reviewed'
import { BENCH_SCENES, packSchema } from './schema'
import { compileStation, stationCards, stationSchema, type Station } from './station'
import { hasOutput, vitalsAt } from './vitals'

const tiny: Station = {
  id: 'test-01',
  gym: 'atls',
  title: 'Test',
  type: 'resus',
  stem: 'A test patient.',
  notes: 'Test notes.',
  cast: [
    { id: 'patient', name: 'Mr Test', role: 'patient' },
    { id: 'nurse', name: 'Nurse Ho', role: 'nurse' },
  ],
  vitals: { hr: 120, sbp: 80, dbp: 50, spo2: 90, rr: 28, drift: { sbp: -4 }, stop: ['fluids'], effects: [{ scene: 'fluids', add: { sbp: 20 }, overS: 20 }] },
  steps: [
    {
      id: 'help',
      kind: 'say',
      to: 'nurse',
      label: 'Talk to the nurse',
      opts: [
        { t: 'Call the trauma team', mark: 'Calls for help' },
        { t: 'Wait and see', r: 'Delay.', trap: 'critical' },
      ],
    },
    {
      id: 'hx',
      kind: 'history',
      to: 'patient',
      label: 'Ask',
      groups: { Pain: [{ t: 'Where is the pain?', r: 'In my chest.', mark: 'Site of pain' }], Past: [{ t: 'Any illness?', r: 'None.' }] },
    },
    {
      id: 'drain',
      kind: 'steps',
      to: 'patient',
      label: 'Chest drain',
      opts: [
        { t: 'Position', n: 1, mark: 'Positions' },
        { t: 'Landmark', n: 2, mark: 'Landmarks' },
        { t: 'Blunt dissect', n: 3, mark: 'Dissects' },
        { t: 'Trocar', trap: 'critical', r: 'Never use the trocar.' },
      ],
    },
    {
      id: 'calm',
      kind: 'dialogue',
      to: 'nurse',
      label: 'Talk',
      mood: 6,
      turns: [{ line: 'Why so long?', opts: [{ t: 'I am sorry', mood: -2, mark: 'Acknowledges' }, { t: 'Calm down', mood: 2 }] }],
    },
    {
      id: 'viva',
      kind: 'viva',
      to: 'examiner',
      label: 'Examiner',
      qs: [{ q: 'Safe triangle?', a: '5th ICS mid-axillary', wrong: ['2nd ICS', '8th ICS'] }],
    },
  ],
  rules: [{ id: 'help-first', first: ['help'], then: ['drain'], fail: 'Drain before help.' }],
  badge: { name: 'Test', flavor: 'Test' },
  cards: [{ q: 'Q?', options: ['A', 'B', 'C', 'D'], why: 'Because.', source: 'Here' }],
}

test('station compiler: marks numbered once, targets resolved, viva has one right answer', () => {
  const pack = compileStation(tiny)
  assert.ok(packSchema.safeParse(pack).success)
  assert.deepEqual(
    pack.marks.map((m) => m.id),
    ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07'],
  )
  const help = pack.actions.find((a) => a.id === 'help')!
  assert.equal(help.options![1].critical, true)
  assert.equal(help.options![1].marksChecklistIds, undefined)
  const hx = pack.actions.find((a) => a.id === 'hx')!
  assert.deepEqual(hx.targetIds, ['patient', 'bed-ix'])
  assert.match(hx.options![0].detail!, /^Mr Test: /)
  const viva = pack.actions.find((a) => a.id === 'viva')!
  assert.equal(viva.options!.filter((o) => !o.isTrap).length, 1)
  assert.ok(pack.cast.some((c) => c.id === 'examiner'))
  assert.ok(pack.actions.some((a) => a.kind === 'monitor'))
  assert.equal(stationCards(tiny)[0].answer, 0)
  assert.throws(() => compileStation({ ...tiny, rules: [], steps: [{ ...tiny.steps[0], to: 'nobody' }] }), /unknown nobody/)
  assert.throws(() => compileStation({ ...tiny, rules: [{ id: 'x', first: ['nope'], then: ['help'], fail: 'x' }] }), /unknown step nope/)
})

test('vitals: drift runs until the stop flag; added effects ease in', () => {
  const v = tiny.vitals!
  assert.equal(vitalsAt(v, {}, 0).sbp, 80)
  assert.equal(vitalsAt(v, {}, 120).sbp, 72)
  const withFluids = { fluids: 60 }
  assert.equal(vitalsAt(v, withFluids, 60).sbp, 76)
  assert.equal(vitalsAt(v, withFluids, 70).sbp, 86)
  assert.equal(vitalsAt(v, withFluids, 200).sbp, 96)
  const arrest = { ...v, effects: [{ scene: 'arrest', set: { sbp: 0, dbp: 0 }, rhythm: 'vf' }] }
  assert.equal(hasOutput(vitalsAt(arrest, { arrest: 10 }, 20)), false)
})

test('debrief notes: critical traps, out-of-order steps, wrong viva answers', () => {
  const pack = compileStation(tiny)
  const help = pack.actions.find((a) => a.id === 'help')!
  assert.equal(faultsFor(help, help.options![1], [])[0].critical, true)
  const drain = pack.actions.find((a) => a.id === 'drain')!
  const [position, landmark, dissect] = drain.options!
  assert.equal(faultsFor(drain, position, []).length, 0)
  assert.match(faultsFor(drain, dissect, [position.id])[0].text, /Landmark/)
  assert.equal(faultsFor(drain, landmark, [position.id]).length, 0)
  const viva = pack.actions.find((a) => a.id === 'viva')!
  const wrong = viva.options!.find((o) => o.isTrap)!
  assert.match(faultsFor(viva, wrong, [])[0].text, /Safe triangle/)
})

test('chest X-ray: tension pushes the trachea away; fluid is white at the base; free gas under the diaphragm', () => {
  const normal = chest({})
  assert.ok(Math.abs(tracheaX(normal, 24) - 64) <= 2)
  assert.ok(tracheaX(chest({ ptx: { side: 'L', size: 'large', tension: true } }), 24) <= 58, 'left tension: trachea to the image left (patient right)')
  assert.ok(tracheaX(chest({ ptx: { side: 'R', size: 'large', tension: true } }), 24) >= 70)
  const ptx = chest({ ptx: { side: 'R', size: 'large' } })
  assert.ok(ptx.mean(20, 50, 26, 60) < normal.mean(20, 50, 26, 60) - 0.03, 'no lung markings at the periphery')
  const fluid = chest({ fluid: { side: 'L', level: 0.85 } })
  assert.ok(fluid.mean(96, 70, 106, 84) > 0.5)
  assert.ok(normal.mean(96, 70, 106, 84) < 0.4)
  assert.ok(chest({ freeAir: true }).mean(34, 90, 44, 93) < 0.2)
})

test('CT head: an extradural stops at the sutures, a subdural crosses them, both shift the midline', () => {
  const edh = head({ edh: { side: 'R' } })
  const [lo, hi] = edhArc('R')
  const [mx, my] = onInner((lo + hi) / 2, 4)
  assert.ok(edh.at(mx, my) > 0.65, 'blood at the lateral convexity')
  const [cx, cy] = onInner(SUTURES.coronal.R - 0.12, 2)
  assert.ok(edh.at(cx, cy) < 0.6, 'no blood past the coronal suture')
  const sdh = head({ sdh: { side: 'R' } })
  const [sx, sy] = onInner(SUTURES.coronal.R + Math.PI * 2 - 0.2, 1.5)
  assert.ok(sdh.at(sx, sy) > 0.65, 'subdural runs past the suture line')
  const normal = head({})
  const falx = (f: ReturnType<typeof head>) => {
    let best = 0
    let x0 = 64
    for (let x = 50; x < 80; x++) if (f.at(x, 40) > best) [best, x0] = [f.at(x, 40), x]
    return x0
  }
  assert.ok(falx(edh) > falx(normal), 'falx pushed away from a right-sided bleed')
})

test('plain films and ultrasound show the named sign', () => {
  assert.ok(symphysisWidth(pelvis('open-book')) > symphysisWidth(pelvis('normal')) + 4)
  assert.ok(anteriorHumeralOffset('normal') > 0.2 && anteriorHumeralOffset('normal') < 0.8, 'line through the middle third')
  assert.ok(anteriorHumeralOffset('supracondylar') > 1, 'capitellum behind the line')
  assert.equal(kleinCutsEpiphysis('normal'), true, "Klein's line cuts a normal epiphysis")
  assert.equal(kleinCutsEpiphysis('slipped'), false, 'and misses a slipped one')
  assert.ok(airwayWidth(neck('ap-croup'), 70) < airwayWidth(neck('ap-normal'), 70) - 4, 'croup narrows the subglottic airway (steeple)')
  assert.ok(fastRuq(true).mean(68, 64, 76, 67) < fastRuq(false).mean(68, 64, 76, 67) - 0.2)
  assert.equal(burnPercent([{ region: 'chest', depth: 'partial' }, { region: 'r-arm', depth: 'full' }, { region: 'abdomen', depth: 'superficial' }]), 18)
})

/* ---------------------------------------------------------------- every station script */

const root = join(process.cwd(), 'content', 'stations')
const files = (() => {
  try {
    return readdirSync(root).flatMap((gym) => readdirSync(join(root, gym)).filter((f) => f.endsWith('.json')).map((f) => join(root, gym, f)))
  } catch {
    return []
  }
})()
const world = worldSchema.parse(JSON.parse(readFileSync(join(process.cwd(), 'content', 'world', 'world.json'), 'utf8')))

test('station scripts: each compiles, validates, and holds its own weight', () => {
  const ids = new Set<string>()
  for (const file of files) {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const parsed = stationSchema.safeParse(raw)
    assert.ok(parsed.success, `${file}: ${parsed.success ? '' : parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`)
    const st = parsed.data
    assert.ok(!ids.has(st.id), `duplicate id ${st.id}`)
    ids.add(st.id)
    assert.ok(file.includes(join(st.gym, `${st.id}.json`)), `${st.id} lives in the ${st.gym} folder and is named after its id`)
    assert.ok(world.gyms.some((g) => g.id === st.gym), `${st.id}: gym ${st.gym}`)
    const pack = compileStation(st)
    const valid = packSchema.safeParse(pack)
    assert.ok(valid.success, `${st.id}: ${valid.success ? '' : valid.error.issues.map((i) => i.path.join('.')).join('; ')}`)
    assert.ok(pack.marks.length >= 8, `${st.id}: only ${pack.marks.length} marks`)
    assert.ok(st.notes.length >= 120, `${st.id}: guideline notes too thin`)
    assert.ok(st.steps.some((s) => s.kind === 'viva'), `${st.id}: no examiner questions`)
    assert.ok((st.cards ?? []).length >= 6, `${st.id}: needs at least 6 flashcards`)
    for (const card of st.cards ?? []) {
      assert.equal(new Set(card.options).size, 4, `${st.id}: repeated option in "${card.q}"`)
      assert.ok(card.why.trim().length > 0, `${st.id}: card "${card.q}" has no explanation`)
    }
    const refs = [
      ...st.steps.flatMap((s) => [s.img, ...(s.opts ?? []).map((o) => o.img), ...Object.values(s.groups ?? {}).flat().map((o) => o.img), ...(s.qs ?? []).map((q) => q.img), ...(s.turns ?? []).flatMap((t) => t.opts.map((o) => o.img))]),
    ].filter((r): r is string => Boolean(r))
    for (const ref of refs) {
      const ok = ref.startsWith('ecg:') ? Boolean(ecgById(ref.slice(4))) : Boolean(imageEntry(ref))
      assert.ok(ok, `${st.id}: no image ${ref}`)
    }
    if (st.vitals?.rhythm) assert.ok(ecgById(st.vitals.rhythm), `${st.id}: rhythm ${st.vitals.rhythm}`)
    for (const e of st.vitals?.effects ?? []) if (e.rhythm) assert.ok(ecgById(e.rhythm), `${st.id}: rhythm ${e.rhythm}`)
    // Steps: the correct sequence is 1..n with no gaps.
    for (const s of st.steps.filter((row) => row.kind === 'steps')) {
      const ns = (s.opts ?? []).filter((o) => !o.trap).map((o) => o.n)
      assert.ok(ns.every((n) => n !== undefined), `${st.id}/${s.id}: every real step needs n`)
      assert.deepEqual([...ns].sort((a, b) => a! - b!), ns.map((_, i) => i + 1), `${st.id}/${s.id}: steps numbered 1..n`)
    }
    // Every scene flag an effect waits for is set by some option or event.
    const flags = new Set([
      ...st.steps.flatMap((s) => [...(s.opts ?? []), ...Object.values(s.groups ?? {}).flat(), ...(s.turns ?? []).flatMap((t) => t.opts)].flatMap((o) => [o.scene, ...((o.perform && BENCH_SCENES[o.perform]) || [])])),
      ...(st.events ?? []).map((e) => e.scene),
    ])
    for (const e of st.vitals?.effects ?? []) assert.ok(flags.has(e.scene), `${st.id}: nothing sets scene ${e.scene}`)
    for (const s of st.vitals?.stop ?? []) assert.ok(flags.has(s), `${st.id}: nothing sets stop flag ${s}`)
  }
})

/*
 * Multiple choice (flashcards and the examiner's viva) must not be answerable by length or by throwaway
 * options: the right answer should be the longest about as often as chance would have it.
 */
const THROWAWAY = new Set(['never', 'none', 'nothing', 'ignore', 'always', 'no limit', 'not needed', 'no target', 'tradition', 'billing', 'yes', 'no', 'reassure', 'discharge', 'only topical steroids'])

function lengthRank(answer: string, options: string[]) {
  return 1 + options.filter((o) => o.length > answer.length).length
}

test('multiple choice: no length cue and no throwaway distractors', () => {
  const byGym = new Map<string, number[]>()
  const throwaways: string[] = []
  const add = (gym: string, id: string, answer: string, wrong: string[]) => {
    const list = byGym.get(gym) ?? []
    list.push(lengthRank(answer, [answer, ...wrong]))
    byGym.set(gym, list)
    for (const w of wrong) if (THROWAWAY.has(w.trim().toLowerCase().replace(/\.$/, ''))) throwaways.push(`${id}: "${w}"`)
  }
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    for (const card of st.cards ?? []) add(st.gym, `${st.id} card "${card.q}"`, card.options[0], card.options.slice(1))
    for (const s of st.steps) for (const q of s.qs ?? []) add(st.gym, `${st.id} viva "${q.q}"`, q.a, q.wrong)
  }
  const deckDir = join(process.cwd(), 'content', 'cards')
  for (const f of readdirSync(deckDir).filter((name) => name.endsWith('.json'))) {
    const deck = JSON.parse(readFileSync(join(deckDir, f), 'utf8')) as { deck: string; cards: { id: string; options: string[]; answer: number }[] }
    for (const card of deck.cards) add('decks', card.id, card.options[card.answer], card.options.filter((_, i) => i !== card.answer))
  }
  assert.deepEqual(throwaways, [])
  for (const [gym, ranks] of byGym) {
    const share = (r: number) => ranks.filter((x) => x === r).length / ranks.length
    assert.ok(share(1) <= 0.35, `${gym}: the answer is the longest option in ${Math.round(share(1) * 100)}% of questions`)
    for (const r of [1, 2, 3, 4]) assert.ok(share(r) <= 0.55, `${gym}: the answer is length-rank ${r} in ${Math.round(share(r) * 100)}% of questions`)
  }
})

/*
 * The end of every station belongs to the examiner: steps they prompt (`ask`) then the viva, last, asked by
 * the examiner. The play screen holds these back until the rest is done and then walks the examiner over.
 */
test('station endings: the examiner prompts the last steps and asks the viva last', () => {
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    const vivas = st.steps.filter((s) => s.kind === 'viva')
    assert.equal(vivas.length, 1, `${st.id}: exactly one viva`)
    assert.equal(st.steps[st.steps.length - 1].kind, 'viva', `${st.id}: the viva is the last step`)
    assert.equal(vivas[0].to, 'examiner', `${st.id}: the examiner asks the viva`)
    const asked = st.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.ask)
    for (const { s, i } of asked) {
      assert.equal(s.to, 'examiner', `${st.id}/${s.id}: only the examiner prompts`)
      // Prompted steps sit together just before the viva, so the examiner can run them in one visit.
      assert.ok(st.steps.slice(i, -1).every((later) => later.ask), `${st.id}/${s.id}: prompted steps come last, before the viva`)
    }
  }
})

test('patient language: every line spoken with a patient or relative has its Cantonese', () => {
  const staff = new Set(['nurse', 'doctor', 'junior', 'paramedic', 'examiner', 'police', 'security', 'obstetrician'])
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    const role = new Map(st.cast.map((c) => [c.id, c.role]))
    for (const s of st.steps) {
      const who = role.get(s.to)
      if (!['say', 'history', 'dialogue'].includes(s.kind) || !who || staff.has(who) || s.lang === 'en') continue
      const opts = [...(s.opts ?? []), ...Object.values(s.groups ?? {}).flat(), ...(s.turns ?? []).flatMap((t) => t.opts)]
      for (const o of opts) assert.ok(o.tz, `${st.id}/${s.id}: "${o.t}" needs tz`)
      for (const t of s.turns ?? []) assert.ok(t.lz, `${st.id}/${s.id}: "${t.line}" needs lz`)
    }
  }
})

test('review lists: every station says what, if anything, to re-check against the notes', () => {
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    assert.ok(st.review, `${st.id}: needs a review list (empty if nothing to review)`)
    for (const r of st.review) assert.ok(r.text.length > 20, `${st.id}: review items say what to check`)
  }
})

test('phases: the objective follows the perfect script and moves on as each phase is done', () => {
  const pack = compileStation(stationSchema.parse(JSON.parse(readFileSync(files.find((f) => f.endsWith('acls-tca.json'))!, 'utf8'))))
  const spent: Record<string, string[]> = {}
  const done = (stepId: string) => {
    const action = pack.actions.find((a) => a.id === stepId)!
    const first = (action.options ?? []).find((o) => !o.isTrap) ?? (action.findings ?? [])[0]
    spent[stepId] = [first!.id]
  }
  const [arrival] = pack.phases ?? []
  assert.equal(currentPhase(pack, spent)?.title, 'Arrival')
  for (const id of arrival.steps.slice(0, -1)) done(id)
  assert.equal(currentPhase(pack, spent)?.title, 'Arrival', 'a phase is done only when all its steps are')
  done(arrival.steps.at(-1)!)
  assert.equal(currentPhase(pack, spent)?.title, 'ABC')
  // Out of order is allowed: the objective waits for the earliest unfinished phase.
  done('intubate')
  assert.equal(currentPhase(pack, spent)?.title, 'ABC')
  for (const phase of pack.phases ?? []) for (const id of phase.steps) done(id)
  assert.equal(currentPhase(pack, spent), null)
})

test('guided mode points at the next scripted action, and waits for the patient when that is next', () => {
  const pack = compileStation(stationSchema.parse(JSON.parse(readFileSync(files.find((f) => f.endsWith('acls-tca.json'))!, 'utf8'))))
  const first = nextHint(pack, {}, [])
  assert.equal(first?.kind === 'do' && first.actionId, 'arrive')
  // Everything done except what waits on the seizure: the guide says to watch, not to give lorazepam early.
  const spent: Record<string, string[]> = {}
  for (const a of pack.actions) spent[a.id] = (a.options ?? []).filter((o) => !o.isTrap && !(o.when ?? []).length).map((o) => o.id)
  assert.equal(nextHint(pack, spent, ['ecg-read'])?.kind, 'wait')
  const seizing = nextHint(pack, spent, ['ecg-read', 'seizure'])
  assert.equal(seizing?.kind === 'do' && seizing.actionId, 'seizure-tx')
})

test('a drug asked for before it is indicated is not given, not spent, and scores a fault', () => {
  const pack = compileStation(stationSchema.parse(JSON.parse(readFileSync(files.find((f) => f.endsWith('acls-tca.json'))!, 'utf8'))))
  const s = () => usePlay.getState()
  s().rerun(pack)
  s().enterRoom()
  const charcoal = pack.actions.find((a) => a.id === 'charcoal')!.options!.find((o) => o.marksChecklistIds?.length)!
  s().confirmOptions(pack, 'charcoal', [charcoal.id])
  assert.equal((s().spent['charcoal'] ?? []).length, 0, 'not spent')
  assert.equal(s().errands.length, 0, 'the nurse fetches nothing')
  assert.ok(s().faults.some((f) => /Too early/.test(f.text)))
  // Once she is intubated, the same request goes ahead.
  usePlay.setState({ scene: [...s().scene, 'bicarb', 'intubated'] })
  s().confirmOptions(pack, 'charcoal', [charcoal.id])
  assert.deepEqual(s().spent['charcoal'], [charcoal.id])
})

test('a seizure comes only if the bicarbonate is slow, or on hard; a prompt bolus prevents it', () => {
  const pack = compileStation(stationSchema.parse(JSON.parse(readFileSync(files.find((f) => f.endsWith('acls-tca.json'))!, 'utf8'))))
  const ids = (scene: string[], at: Record<string, number>, t: number, level: 'normal' | 'hard') => dueEvents(pack, scene, at, t, level).map((e) => e.id)
  assert.deepEqual(ids([], {}, 5, 'normal'), [], 'normal: no seizure on arrival')
  assert.deepEqual(ids([], {}, 5, 'hard'), ['seizure-arrival'], 'hard: fitting on arrival')
  assert.deepEqual(ids(['ecg-read'], { 'ecg-read': 10 }, 40, 'normal'), [], 'not yet')
  assert.deepEqual(ids(['ecg-read'], { 'ecg-read': 10 }, 75, 'normal'), ['seizure-late'], 'a minute without bicarbonate')
  assert.deepEqual(ids(['ecg-read', 'bicarb'], { 'ecg-read': 10, bicarb: 30 }, 75, 'normal'), [], 'prompt bicarbonate prevents it')
  assert.equal(untreatedEvents(pack, ['seizure']).length, 1)
  assert.equal(untreatedEvents(pack, ['seizure', 'seizure-stopped']).length, 0)
})

test('a phase does not wait for treatment of something that never happened', () => {
  const pack = compileStation(stationSchema.parse(JSON.parse(readFileSync(files.find((f) => f.endsWith('acls-tca.json'))!, 'utf8'))))
  const spent: Record<string, string[]> = {}
  const upTo = pack.phases!.slice(0, 3).flatMap((p) => p.steps)
  for (const id of upTo) {
    const a = pack.actions.find((x) => x.id === id)!
    // Everything that is due on this run (the repeat ECG once the bicarbonate is in), not the seizure treatment.
    const first = (a.options ?? []).find((o) => !o.isTrap && (o.when ?? []).every((f) => ['ecg-read', 'bicarb'].includes(f)))
    if (first) spent[id] = [first.id]
  }
  // No seizure on this run: the ECG phase is done without the seizure step, and RSI is next.
  assert.equal(currentPhase(pack, spent, ['ecg-read', 'bicarb'])?.title, 'RSI')
  // She is fitting: the ECG phase waits for the treatment.
  assert.equal(currentPhase(pack, spent, ['ecg-read', 'bicarb', 'seizure'])?.title, 'ECG')
})

test('every station has phases, and every step outside the examiner’s end belongs to one', () => {
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    assert.ok(st.phases?.length, `${st.id}: needs phases`)
    const phased = new Set(st.phases!.flatMap((p) => p.steps))
    for (const s of st.steps) {
      if (s.kind === 'viva' || s.ask || s.to === 'examiner') continue
      assert.ok(phased.has(s.id), `${st.id}: step ${s.id} is in no phase`)
    }
  }
})

test('reviewed: every station marked as reviewed exists', () => {
  const ids = new Set([
    ...files.map((f) => JSON.parse(readFileSync(f, 'utf8')).id as string),
    ...readdirSync(join(process.cwd(), 'content', 'packs')),
  ])
  for (const id of REVIEWED) assert.ok(ids.has(id), `reviewed: no station "${id}"`)
})

test('a report you take to the examiner comes before the examiner comes over for the viva', () => {
  const st = stationSchema.parse(JSON.parse(readFileSync(join(process.cwd(), 'content', 'stations', 'paedi', 'pd-supracondylar.json'), 'utf8')))
  const pack = compileStation(st)
  // Everything done except the findings report (and the examiner's own end).
  const spent: Record<string, string[]> = {}
  for (const a of pack.actions) {
    if (a.id === 'findings' || a.kind === 'viva') continue
    spent[a.id] = [...(a.options ?? []).map((o) => o.id), ...(a.findings ?? []).map((f) => f.id)]
  }
  const hint = nextHint(pack, spent, [])
  assert.equal(hint?.kind === 'do' ? hint.actionId : hint?.kind, 'findings')
})

test('suture: "I will start now" is a fault before consent, and fine after it', () => {
  const pack = compileStation(stationSchema.parse(JSON.parse(readFileSync(files.find((f) => f.endsWith('sx-suture.json'))!, 'utf8'))))
  const s = () => usePlay.getState()
  s().rerun(pack)
  s().enterRoom()
  const opts = pack.actions.find((a) => a.id === 'history')!.options!
  const consent = opts.find((o) => /consent/i.test(o.label))!
  const start = opts.find((o) => /start the repair/i.test(o.label))!
  s().pickOption(pack, 'history', start.id)
  assert.ok(s().faults.some((f) => /Too early/.test(f.text)), 'before consent: a fault')
  assert.ok(!(s().spent['history'] ?? []).includes(start.id))
  s().pickOption(pack, 'history', consent.id)
  const before = s().faults.length
  s().pickOption(pack, 'history', start.id)
  assert.equal(s().faults.length, before, 'after consent: no fault')
  assert.ok(s().spent['history'].includes(start.id))
})

test('perfect scripts: every key word is said somewhere in the script', () => {
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    if (!st.script) continue
    const said = st.script.map((b) => `${b.say ?? ''} ${b.do ?? ''}`).join(' ').toLowerCase()
    for (const k of st.keywords ?? []) assert.ok(said.includes(k.toLowerCase()), `${st.id}: key word "${k}" is never said in the script`)
  }
})

test('haemorrhagic shock: the guide bridges with fluid before the blood arrives', () => {
  const pack = compileStation(stationSchema.parse(JSON.parse(readFileSync(files.find((f) => f.endsWith('atls-shock.json'))!, 'utf8'))))
  const spent: Record<string, string[]> = {}
  for (const id of ['brief', 'handover', 'monitoring', 'survey', 'resus', 'drugs', 'dcr']) {
    const a = pack.actions.find((x) => x.id === id)!
    spent[id] = [...(a.options ?? []).map((o) => o.id)]
  }
  const hint = nextHint(pack, spent, ['monitored', 'mhp'])
  assert.equal(hint?.kind === 'do' ? hint.actionId : hint?.kind, 'bridge-fluid')
})

test('close-ups read their findings: side, reaction, refill, tenderness, the meter value', async () => {
  const { readFinding } = await import('../game/CutIn')
  assert.equal(readFinding('Trachea deviated to the right; absent breath sounds on the left, hyper-resonant.').quietSide, 'left')
  assert.equal(readFinding('Equal air entry, vesicular.').quietSide, null)
  assert.equal(readFinding('Right pupil 6 mm, fixed; left 3 mm, reactive.').fixedSide, 'right')
  assert.equal(readFinding('Pupils equal and reactive.').fixedSide, null)
  assert.ok(readFinding('HR 128, BP 88/50, cool, CRT 4 s.').slowRefill)
  assert.ok(!readFinding('Radial pulse present; CRT under 2 s.').slowRefill)
  assert.equal(readFinding('Seatbelt sign. Tender and guarding in the left upper quadrant.').tender, 'luq')
  assert.equal(readFinding('GCS 15, pupils equal and reactive, glucose 6.5.').glucose, '6.5')
  // Every glucose close-up in the stations shows a number.
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    for (const s of st.steps) for (const o of [...(s.opts ?? []), ...Object.values(s.groups ?? {}).flat()]) {
      if (o.anim === 'glucose' && /glucose|mmol/i.test(o.r ?? '')) assert.ok(readFinding(o.r).glucose, `${st.id}: "${o.r}" shows no glucose value`)
    }
  }
})

/*
 * Following the guide like a player: fetched items take effect a couple of steps later (the nurse walks), events
 * follow their trigger a few steps later. Going back to an earlier phase is fine when something happened to the
 * patient (a seizure, still shocked after a bolus); going back only because the nurse was still walking means a later
 * step was offered before its moment (a ventilator before ROSC).
 */
test('the guide never sends you back to an earlier phase', () => {
  const backs: string[] = []
  // Found by this test; fixed as each is rebuilt around its perfect script (then removed from here).
  const KNOWN = new Set<string>([])
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    if (!st.phases?.length || KNOWN.has(st.id)) continue
    const pack = compileStation(st)
    const phaseOf = (id: string) => st.phases!.findIndex((p) => p.steps.includes(id))
    const spent: Record<string, string[]> = {}
    const scene: string[] = []
    const pending: { flags: string[]; at: number }[] = []
    const fromEvent = new Set((pack.events ?? []).map((e) => e.scene))
    let furthest = -1
    let finished = false
    for (let i = 0; i < 300; i++) {
      for (const p of pending.filter((x) => x.at <= i)) for (const f of p.flags) if (!scene.includes(f)) scene.push(f)
      for (const e of pack.events ?? []) {
        if (e.level === 'hard' || scene.includes(e.scene)) continue
        if (e.after && !scene.includes(e.after)) continue
        if (e.unless && scene.includes(e.unless)) continue
        if (!pending.some((x) => x.flags.includes(e.scene))) pending.push({ flags: [e.scene], at: i + 3 })
      }
      const h = nextHint(pack, spent, scene)
      if (!h) {
        finished = true
        break
      }
      if (h.kind === 'wait') continue
      const ph = phaseOf(h.actionId)
      const waitedOn = (pack.actions.find((x) => x.id === h.actionId)?.options ?? []).find((x) => x.label === h.option)?.when ?? []
      if (ph >= 0 && ph < furthest && !waitedOn.some((f) => fromEvent.has(f))) {
        backs.push(`${st.id}: back to "${st.phases![ph].title}" (${h.actionId}) after "${st.phases![furthest].title}"`)
        break
      }
      furthest = Math.max(furthest, ph)
      const a = pack.actions.find((x) => x.id === h.actionId)!
      const o = (a.options ?? []).find((x) => x.label === h.option) ?? (a.findings ?? []).find((x) => x.label === h.option)
      if (!o) break
      spent[a.id] = [...(spent[a.id] ?? []), o.id]
      const flags = [...('scenesSet' in o && Array.isArray(o.scenesSet) ? o.scenesSet : []), ...('sceneFlag' in o && o.sceneFlag ? [o.sceneFlag] : [])] as string[]
      const step = st.steps.find((s) => s.id === a.id)
      const rows = [...(step?.opts ?? []), ...Object.values(step?.groups ?? {}).flat(), ...(step?.turns ?? []).flatMap((t) => t.opts ?? [])]
      const raw = rows.find((x) => x.t === h.option) ?? rows.find((x) => x.drug && x.dose && h.option === `${x.drug} ${x.dose}`) ?? rows.find((x) => x.drug && h.option.startsWith(x.drug))
      const set = [...flags, ...(raw?.scene ? [raw.scene] : [])]
      if (set.length) pending.push({ flags: set, at: raw?.fetch ? i + 2 : i })
    }
    // Following the guide to its end earns every mark outside the examiner's own end.
    const earned = new Set(pack.actions.flatMap((a) => [...(a.options ?? []), ...(a.findings ?? [])].filter((o) => (spent[a.id] ?? []).includes(o.id)).flatMap((o) => o.marksChecklistIds ?? [])))
    const reachable = pack.actions
      .filter((a) => a.kind !== 'viva' && a.kind !== 'monitor' && !(a.ask && a.targetIds.includes('examiner')))
      .flatMap((a) => [...(a.options ?? []).filter((o) => !o.isTrap), ...(a.findings ?? [])].flatMap((o) => o.marksChecklistIds ?? []))
    const missed = [...new Set(reachable)].filter((m) => !earned.has(m))
    if (!finished && !backs.some((b) => b.startsWith(st.id + ':'))) backs.push(`${st.id}: the guide never finishes (it keeps waiting)`)
    if (missed.length && !backs.some((b) => b.startsWith(st.id + ':'))) backs.push(`${st.id}: the guide never reaches ${missed.map((m) => pack.marks.find((k) => k.id === m)?.label ?? m).join('; ')}`)
  }
  assert.deepEqual(backs, [])
})

/**
 * Time drives an arrest. Following the guide on the clinical clock: shock, the jobs done during CPR, then the
 * clock runs ahead to the 2-minute rhythm check (never more than one cycle), the next shock, the drugs in order,
 * and ROSC at a check. Nothing is moved on by talking to the nurse.
 */
test('VF arrest runs on the clinical clock: each shock comes due at its 2-minute rhythm check', () => {
  const st = stationSchema.parse(JSON.parse(readFileSync(join('content', 'stations', 'acls', 'acls-vf-stemi.json'), 'utf8')))
  const pack = compileStation(st)
  assert.equal(pack.clock, 'ARREST')
  const spent: Record<string, string[]> = {}
  const scene: string[] = []
  const sceneAt: Record<string, number> = {}
  let clock = 0
  const order: string[] = []
  const set = (flags: string[]) => flags.forEach((f) => scene.includes(f) || (scene.push(f), (sceneAt[f] = clock)))
  for (let i = 0; i < 200; i++) {
    for (const ev of dueEvents(pack, scene, sceneAt, clock, 'normal')) set([ev.scene])
    const h = nextHint(pack, spent, scene)
    if (!h) break
    if (h.kind === 'wait') {
      const next = nextWaitedEvent(pack, spent, scene, sceneAt, 'normal')
      assert.ok(next, `the guide waits at ${clock}s with nothing timed to wait for`)
      assert.ok(next.dueAt - clock <= 120, 'the clock never jumps more than one 2-minute cycle')
      clock = next.dueAt
      continue
    }
    clock += 10
    const a = pack.actions.find((x) => x.id === h.actionId)!
    const o = (a.options ?? []).find((x) => x.label === h.option)!
    spent[a.id] = [...(spent[a.id] ?? []), o.id]
    const raw = [...(st.steps.find((s) => s.id === a.id)?.opts ?? []), ...Object.values(st.steps.find((s) => s.id === a.id)?.groups ?? {}).flat()].find((x) => x.t === h.option || (x.drug && h.option === `${x.drug} ${x.dose}`))
    if (raw?.scene) set([raw.scene].flat())
    if (raw?.scene || /shock|Adrenaline|Amiodarone|ROSC/i.test(h.option)) order.push(raw?.scene ? [raw.scene].flat()[0] : h.option)
  }
  assert.deepEqual(order.filter((x) => ['shock1', 'shock2', 'adrenaline', 'shock3', 'amiodarone', 'rosc'].includes(x)), ['shock1', 'shock2', 'adrenaline', 'shock3', 'amiodarone', 'rosc'])
  // Shocks 2 and 3 land on their checks: 2 minutes after the shock before.
  assert.equal(sceneAt.check2 - sceneAt.shock1, 120)
  assert.equal(sceneAt.check3 - sceneAt.shock2, 120)
  assert.ok(sceneAt.rosc >= sceneAt.check4)
})

test('clocked stations play to the end on the clinical clock: every wait has a timed moment to run ahead to', () => {
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    if (!st.clock) continue
    const pack = compileStation(st)
    const spent: Record<string, string[]> = {}
    const scene: string[] = []
    const sceneAt: Record<string, number> = {}
    let clock = 0
    let finished = false
    const set = (flags: string[]) => flags.forEach((f) => scene.includes(f) || (scene.push(f), (sceneAt[f] = clock)))
    for (let i = 0; i < 300; i++) {
      for (const ev of dueEvents(pack, scene, sceneAt, clock, 'normal')) set([ev.scene])
      const h = nextHint(pack, spent, scene)
      if (!h) {
        finished = true
        break
      }
      if (h.kind === 'wait') {
        const next = nextWaitedEvent(pack, spent, scene, sceneAt, 'normal')
        assert.ok(next && next.dueAt > clock, `${st.id}: the guide waits at ${clock}s with nothing timed ahead`)
        clock = next.dueAt
        continue
      }
      clock += 10
      // Waiting for the next check must not pull post-ROSC care forward: nothing after the ROSC phase before ROSC.
      const phaseOf = (id: string) => (st.phases ?? []).findIndex((ph) => ph.steps.includes(id))
      const roscStep = st.steps.find((s) => [...(s.opts ?? []), ...Object.values(s.groups ?? {}).flat()].some((x) => [x.scene].flat().includes('rosc')))
      if (roscStep && !scene.includes('rosc')) assert.ok(phaseOf(h.actionId) <= phaseOf(roscStep.id), `${st.id}: ${h.actionId} is offered before ROSC`)
      const a = pack.actions.find((x) => x.id === h.actionId)!
      const o = (a.options ?? []).find((x) => x.label === h.option) ?? (a.findings ?? []).find((x) => x.label === h.option)!
      spent[a.id] = [...(spent[a.id] ?? []), o.id]
      const step = st.steps.find((s) => s.id === a.id)
      const rows = [...(step?.opts ?? []), ...Object.values(step?.groups ?? {}).flat(), ...(step?.turns ?? []).flatMap((t) => t.opts ?? [])]
      const raw = rows.find((x) => x.t === h.option) ?? rows.find((x) => x.drug && h.option === `${x.drug} ${x.dose}`)
      if (raw?.scene) set([raw.scene].flat())
    }
    assert.ok(finished, `${st.id}: the guide never finishes on the clock`)
  }
})

/**
 * Bedside checks are done at the patient, with their close-ups: you assess the patient, you do not tell the nurse
 * what you found. A line to the nurse, the monitor or a trolley that checks the response, breathing, a pulse, an
 * ABCDE or a reassessment is the wrong place for it (plans, handovers and reports are fine).
 */
test('bedside checks are done at the patient, not said to the nurse', () => {
  const bedside = /can you hear me|look,? listen|feel (for|the) .*pulse|(carotid|femoral|radial) pulse (present|absent)|no (carotid|femoral) pulse|^ABCDE:|^reassess (him|her|after)|^rhythm and pulse check|^repeat ABCDE/i
  const wrong: string[] = []
  for (const file of files) {
    const st = stationSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    for (const s of st.steps) {
      if (!['say', 'pick'].includes(s.kind) || !['nurse', 'monitor', 'trolley', 'team'].includes(s.to ?? '')) continue
      for (const o of s.opts ?? []) if (!o.perform && bedside.test(o.t)) wrong.push(`${st.id}/${s.id}: "${o.t.slice(0, 60)}"`)
    }
  }
  assert.deepEqual(wrong, [])
})

test('the guide does not ask for an alternative once its mark is earned', () => {
  const pack = packSchema.parse(JSON.parse(readFileSync(join('content', 'packs', 'cv-em-02', 'pack.json'), 'utf8')))
  const intro = pack.actions.find((a) => a.id === 'intro')!
  const english = intro.options!.find((o) => o.id === 'hello')!
  const first = nextHint(pack, {}, [])
  assert.equal(first?.kind === 'do' && first.actionId, 'intro')
  const after = nextHint(pack, { intro: [english.id] }, [])
  assert.ok(!(after?.kind === 'do' && after.actionId === 'intro'), 'the Cantonese line is an alternative, not a second task')
})
