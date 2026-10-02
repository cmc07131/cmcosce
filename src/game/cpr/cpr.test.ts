import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DROWNING_MARKS, LIGHTNING_MARKS, compressionStats, cprRows, freshCpr, type CprRun, type Press } from './CprProcedure'
import { NEWBORN_MARKS, chestMoves, freshNewborn, newbornRows, ventRate, type NewbornRun } from '../newborn/NewbornProcedure'

const presses = (n: number, perMin: number, cm: number): Press[] => Array.from({ length: n }, (_, i) => ({ t: (i * 60) / perMin, cm, site: 'lower-sternum' }))

test('cpr: compressions are measured for rate and depth', () => {
  const s = compressionStats(presses(30, 110, 5.5))!
  assert.ok(Math.abs(s.rate - 110) < 1 && s.depth === 5.5)
})

test('cpr: drowning and lightning runs earn every mark; abdominal thrusts are critical', () => {
  const d: CprRun = { ...freshCpr(), suction: 0.9, rescue: [1, 2, 3, 4, 5], presses: presses(60, 110, 5.5), breaths: [1, 2, 3, 4], rhythm: 'asystole' }
  assert.equal(cprRows(d, 'drowning').filter((x) => x.ok).length, DROWNING_MARKS.length)
  assert.ok(cprRows({ ...d, thrusts: true }, 'drowning').some((x) => x.critical))
  const l: CprRun = { ...freshCpr(), nurseOn: true, presses: presses(60, 110, 5.5), pads: [{ x: 50, y: 50 }, { x: 110, y: 100 }], analysed: true, shockedAt: 10, resumedAt: 11, opa: true, breaths: [1, 2, 3, 4], pulseFelt: true, postBreaths: 4 }
  assert.equal(cprRows(l, 'lightning').filter((x) => x.ok).length, LIGHTNING_MARKS.length)
})

test('newborn: the chest moves only with a neutral head and a two-person jaw thrust; a full run earns every mark', () => {
  assert.ok(!chestMoves({ ...freshNewborn(), headAngle: 0 }))
  assert.ok(chestMoves({ ...freshNewborn(), headAngle: 0, jaw2: true }))
  const inf = (jaw: boolean) => Array.from({ length: 5 }, () => ({ s: 2.5, jaw }))
  const r: NewbornRun = { ...freshNewborn(), dried: 0.9, wrapped: true, stimulated: true, tone: true, breathing: true, hr: true, headAngle: 0, chin: true, inflations: [...inf(false), ...inf(true)], jaw2: true, moved: true, ventTimes: Array.from({ length: 15 }, (_, i) => i * 2), reassessed: true }
  assert.ok(Math.abs(ventRate(r.ventTimes)! - 30) < 1)
  assert.equal(newbornRows(r).filter((x) => x.ok).length, NEWBORN_MARKS.length)
})
