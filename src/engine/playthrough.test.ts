import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { usePlay } from '../game/store'
import { judgeSequence, menuIsMulti, stepsDone } from './judge'
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
}

/** The best line in each turn: the one that scores, else the first that is not a trap. */
function bestPerTurn(action: Action) {
  const byGroup = new Map<string, NonNullable<Action['options']>>()
  for (const o of action.options ?? []) byGroup.set(o.group ?? '', [...(byGroup.get(o.group ?? '') ?? []), o])
  return [...byGroup.values()].map((rows) => rows.find((o) => !o.isTrap && o.marksChecklistIds?.length) ?? rows.find((o) => !o.isTrap) ?? rows[0])
}

/** A perfect candidate: every step in script order, every good option, no traps. */
function play(pack: Pack, problems: string[]) {
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
    if (action.kind === 'kit' || (action.kind === 'menu' && menuIsMulti(action))) {
      s().confirmOptions(pack, id, good.map((o) => o.id))
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
    const progress = stepsDone(pack, end.spent)
    if (progress.done !== progress.total) problems.push(`${pack.packId}: a perfect run leaves steps not done: ${progress.left.join(', ')}`)
    if (end.faults.length) problems.push(`${pack.packId}: faults on a perfect run: ${end.faults.map((f) => f.text).join('; ')}`)
    for (const v of judgeSequence(pack.sequenceRules, end.log)) if (v.status !== 'pass') problems.push(`${pack.packId}: rule ${v.id} fails on the script order`)
    // Effects a good option sets must fire; effects only a trap sets (a worse patient) must not.
    const fired = new Set(end.scene)
    const byGood = new Set(pack.actions.flatMap((a) => (a.options ?? []).filter((o) => !o.isTrap).flatMap((o) => (Array.isArray(o.scene) ? o.scene : o.scene ? [o.scene] : []))))
    for (const e of pack.vitals?.effects ?? []) {
      if (byGood.has(e.scene) && !fired.has(e.scene)) problems.push(`${pack.packId}: vitals effect ${e.scene} never fires on a perfect run`)
      if (!byGood.has(e.scene) && fired.has(e.scene)) problems.push(`${pack.packId}: trap-only effect ${e.scene} fired on a perfect run`)
    }
  }
  assert.deepEqual(problems, [])
})
