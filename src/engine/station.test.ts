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
import { faultsFor } from '../game/store'
import { worldSchema } from '../world/model'
import { packSchema } from './schema'
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
    // Every scene flag an effect waits for is set by some option.
    const flags = new Set(st.steps.flatMap((s) => [...(s.opts ?? []), ...Object.values(s.groups ?? {}).flat(), ...(s.turns ?? []).flatMap((t) => t.opts)].map((o) => o.scene)))
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
