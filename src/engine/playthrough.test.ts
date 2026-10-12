import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { usePlay } from '../game/store'
import { dueEvents, judgeSequence, menuIsMulti, stepsDone } from './judge'
import type { Action, Pack } from './schema'
import { compileStation, stationSchema } from './station'

const root = join(import.meta.dirname, '../../content/stations')

function stationPacks(): Pack[] {
  return readdirSync(root).flatMap((gym) =>
    readdirSync(join(root, gym)).map((file) => compileStation(stationSchema.parse(JSON.parse(readFileSync(join(root, gym, file), 'utf8'))))),
  )
}

function drain(pack: Pack) {
  for (let guard = 0; usePlay.getState().performing && guard < 50; guard++) usePlay.getState().finishPerform(pack)
  // The nurse delivers every job: effects start at the bedside.
  for (const job of usePlay.getState().errands) {
    usePlay.getState().deliverErrand(pack, job.token)
    usePlay.getState().takeErrand(job.token)
  }
  // The case moves on without waiting for the clock: each event whose trigger has happened fires now.
  const st = usePlay.getState()
  for (const ev of dueEvents(pack, st.scene, st.sceneAt ?? {}, Number.POSITIVE_INFINITY, 'normal')) usePlay.getState().fireEvent(pack, ev.id)
}

/** The best line in each turn: the one that scores, else the first that is not a trap. */
function bestPerTurn(action: Action) {
  const byGroup = new Map<string, NonNullable<Action['options']>>()
  for (const o of action.options ?? []) byGroup.set(o.group ?? '', [...(byGroup.get(o.group ?? '') ?? []), o])
  return [...byGroup.values()].map((rows) => rows.find((o) => !o.isTrap && o.marksChecklistIds?.length) ?? rows.find((o) => !o.isTrap) ?? rows[0])
}

/** A perfect candidate: every step in script order, every good option, no traps (`before`: a look before each step). */
function play(pack: Pack, problems: string[], before?: (id: string) => void) {
  const s = () => usePlay.getState()
  s().rerun(pack)
  s().enterRoom()
  for (const id of pack.goldPath) {
    const action = pack.actions.find((a) => a.id === id)
    assert.ok(action, `${pack.packId}: gold path names unknown step ${id}`)
    if (s().ended) {
      problems.push(`${pack.packId}: the station ended before step ${id}`)
      break
    }
    const good = (action.options ?? []).filter((o) => !o.isTrap)
    before?.(id)
    if (action.kind === 'kit' || (action.kind === 'menu' && menuIsMulti(action))) {
      // One at a time, as a candidate would: each is delivered (and the case moves on) before the next.
      for (const o of good) {
        s().confirmOptions(pack, id, [o.id])
        drain(pack)
      }
    } else if (action.kind === 'dialogue' || action.kind === 'viva') {
      for (const o of bestPerTurn(action)) {
        s().pickOption(pack, id, o.id)
        drain(pack)
      }
    } else {
      const ordered = action.kind === 'steps' ? [...good].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) : good
      for (const o of ordered) {
        s().pickOption(pack, id, o.id)
        drain(pack)
      }
    }
    for (const f of action.findings ?? []) s().pickFinding(pack, id, f.id)
    for (const r of action.regions ?? []) s().pickRegion(pack, id, r.id)
    drain(pack)
  }
  return s()
}

// Each action lands a millisecond after the last, as a real candidate's would.
let clock = 1_000_000
Date.now = () => (clock += 1000)

test('every station can be finished with full marks, no faults, and every rule met', () => {
  const problems: string[] = []
  for (const pack of stationPacks()) {
    const end = play(pack, problems)
    const earned = new Set(end.earnedMarks)
    const missing = pack.marks.filter((m) => !earned.has(m.id))
    if (missing.length) problems.push(`${pack.packId}: unreachable marks: ${missing.map((m) => m.label).join('; ')}`)
    const progress = stepsDone(pack, end.spent, end.scene)
    if (progress.done !== progress.total) problems.push(`${pack.packId}: a perfect run leaves steps not done: ${progress.left.join(', ')}`)
    if (end.faults.length) problems.push(`${pack.packId}: faults on a perfect run: ${end.faults.map((f) => f.text).join('; ')}`)
    for (const v of judgeSequence(pack.sequenceRules, end.log)) if (v.status !== 'pass') problems.push(`${pack.packId}: rule ${v.id} fails on the script order`)
    // Effects a good option sets must fire; effects only a trap sets (a worse patient) must not.
    const fired = new Set(end.scene)
    const byGood = new Set([
      ...pack.actions.flatMap((a) => (a.options ?? []).filter((o) => !o.isTrap).flatMap((o) => (Array.isArray(o.scene) ? o.scene : o.scene ? [o.scene] : []))),
      // The case deteriorating by itself (a seizure, VT) is part of the script.
      ...(pack.events ?? []).map((e) => e.scene),
    ])
    for (const e of pack.vitals?.effects ?? []) {
      if (byGood.has(e.scene) && !fired.has(e.scene)) problems.push(`${pack.packId}: vitals effect ${e.scene} never fires on a perfect run`)
      if (!byGood.has(e.scene) && fired.has(e.scene)) problems.push(`${pack.packId}: trap-only effect ${e.scene} fired on a perfect run`)
    }
  }
  assert.deepEqual(problems, [])
})

test('steps at one place are named apart, unless they are one examination at different moments (shown as one)', () => {
  const clashes: string[] = []
  for (const pack of stationPacks()) {
    const seen = new Map<string, Action>()
    for (const a of pack.actions.filter((x) => x.kind !== 'kit'))
      for (const t of a.targetIds) {
        const key = `${t}|${a.prompt || a.hint}`
        const other = seen.get(key)
        if (other && !(other.kind === 'exam' && a.kind === 'exam')) clashes.push(`${pack.packId}: "${a.prompt || a.hint}" twice at ${t} (${other.id}, ${a.id})`)
        seen.set(key, a)
      }
  }
  assert.deepEqual(clashes, [])
})

test('one entry for the same examination at each moment: a tap always does the step the script is at', async () => {
  const { familyState } = await import('../game/store')
  const problems: string[] = []
  for (const pack of stationPacks()) {
    const families = new Map<string, Action[]>()
    for (const a of pack.actions.filter((x) => x.kind === 'exam'))
      for (const t of a.targetIds) families.set(`${t}|${a.prompt || a.hint}`, [...(families.get(`${t}|${a.prompt || a.hint}`) ?? []), a])
    const merged = [...families.values()].filter((f) => f.length > 1)
    if (!merged.length) continue
    play(pack, problems, (id) => {
      for (const family of merged) {
        if (!family.some((a) => a.id === id)) continue
        const st = usePlay.getState()
        const open = familyState(family, st.spent, st.scene ?? []).open
        if (!open.some((o) => o.action.id === id)) problems.push(`${pack.packId}: at ${id}, the one "${family[0].prompt}" would do ${open[0]?.action.id ?? 'nothing'}`)
      }
    })
  }
  assert.deepEqual(problems, [])
})

test('a chooser shows each step done, open, or not yet due (and why): septic shock after the first bolus', async () => {
  const { familyState } = await import('../game/store')
  const pack = stationPacks().find((p) => p.packId === 'pals-sepsis')!
  const s = () => usePlay.getState()
  s().rerun(pack)
  s().enterRoom()
  for (const id of pack.goldPath) {
    if (id === 'reassess') break
    const action = pack.actions.find((a) => a.id === id)!
    for (const o of action.options ?? []) (action.kind === 'kit' ? s().confirmOptions(pack, id, [o.id]) : s().pickOption(pack, id, o.id))
    drain(pack)
  }
  const step = (id: string) => pack.actions.find((a) => a.id === id)!
  const reassess = () => familyState([step('reassess'), step('reassess2')], s().spent, s().scene ?? [])
  assert.equal(familyState([step('assess')], s().spent, s().scene ?? []).done, true)
  // One "Reassess him": after the first bolus, it finds him still shocked.
  assert.equal(reassess().open[0]?.action.id, 'reassess')
  s().pickOption(pack, 'reassess', reassess().open[0].option.id)
  assert.ok(s().scene?.includes('still-shocked'))
  // Nothing more to reassess until the further boluses are in; then the same entry finds him fluid-refractory.
  assert.deepEqual([reassess().open.length, reassess().waiting], [0, 'After the further boluses.'])
  assert.equal(familyState([step('bolus2')], s().spent, s().scene ?? []).open.length, 1)
  s().confirmOptions(pack, 'bolus2', [step('bolus2').options![0].id])
  drain(pack)
  assert.equal(reassess().open[0]?.action.id, 'reassess2')
  s().pickOption(pack, 'reassess2', reassess().open[0].option.id)
  assert.ok(s().scene?.includes('refractory'))
  assert.equal(s().faults.length, 0)
})
