import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DRAIN_MARKS, LINES, NEEDLE_MARKS, drainRows, freshChest, judgeIncision, needleRows, pushNeedle, ribY, siteAt, spaceY, type ChestRun } from './model'

test('chest: the safe site is the 4th/5th space just anterior to the mid-axillary line', () => {
  assert.equal(siteAt({ x: LINES.mal - 8, y: spaceY(5) }).site, 'safe')
  assert.equal(siteAt({ x: LINES.mcl, y: spaceY(2) }).site, 'second-mcl')
  assert.equal(siteAt({ x: LINES.mal - 8, y: ribY(5) }).site, 'rib')
})

test('chest: a standard 32 mm cannula never reaches the pleura; an 8 cm one does', () => {
  const base: ChestRun = { ...freshChest(), site: 'safe', space: 5, lane: 'top-of-rib' }
  assert.equal(pushNeedle({ ...base, cannula: 'standard' }, 8).event, 'short')
  assert.equal(pushNeedle({ ...base, cannula: 'long' }, 4).event, 'hiss')
})

test('chest: the incision goes on the upper border of the rib below', () => {
  const y = ribY(6) - 3
  assert.equal(judgeIncision({ x: 125, y }, { x: 155, y }, 5).where, 'upper-border')
  assert.equal(judgeIncision({ x: 125, y: ribY(5) + 3 }, { x: 155, y: ribY(5) + 3 }, 5).where, 'lower-border')
})

test('chest: full drain and full decompression earn every mark', () => {
  const drain: ChestRun = { ...freshChest(), armUp: true, confirmedSide: true, mark: 'safe', markSpace: 5, cleaned: 0.9, local: 10, aspiratedPleura: true, incision: { where: 'upper-border', length: 3, flat: 0 }, dissectLane: 'top-of-rib', inPleura: true, sweep: 0.8, tubeAngle: 40, tubeFr: 28, seal: true, sutured: true, xray: true }
  assert.deepEqual(drainRows(drain, 'blood').filter((x) => x.ok).map((x) => x.key), [...DRAIN_MARKS])
  const needle: ChestRun = { ...drain, site: 'safe', space: 5, cannula: 'long', lane: 'top-of-rib', decompressed: true, leftIn: true }
  assert.deepEqual(needleRows(needle).filter((x) => x.ok).map((x) => x.key), [...NEEDLE_MARKS])
})
