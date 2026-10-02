import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ARM, CHEST, ESCHAR_MARKS, checkEschar, freshEschar, judgeArmLine, judgeChestLine, released, vent, type EscharRun } from './model'

const vline = (x: number) => Array.from({ length: 12 }, (_, i) => ({ x, y: CHEST.clavicleY + 4 + i * 11 }))
const hline = (y: number) => Array.from({ length: 12 }, (_, i) => ({ x: 30 + i * 11, y }))

test('eschar: lines are recognised by where they run', () => {
  assert.equal(judgeChestLine(vline(CHEST.aal[0])), 'aal-r')
  assert.equal(judgeChestLine(vline(CHEST.aal[1])), 'aal-l')
  assert.equal(judgeChestLine(vline(CHEST.mid)), 'midline')
  assert.equal(judgeChestLine(hline(CHEST.costalY)), 'costal')
  assert.equal(judgeArmLine(Array.from({ length: 10 }, (_, i) => ({ x: 20 + i * 17, y: ARM.volarY }))), 'volar')
})

test('eschar: releasing all three lines drops the airway pressure; a full run earns every mark', () => {
  const r: EscharRun = { ...freshEschar(), cleaned: true, kitReady: true, marks: ['aal-r', 'aal-l', 'costal'], depth: 'fat', cut: ['aal-r', 'aal-l', 'costal'], bleeders: 6, diathermied: 6, dressed: true, rechecked: true, armLines: ['lateral', 'medial'] }
  assert.ok(released(r))
  assert.ok(vent(r).peak < vent(freshEschar()).peak)
  assert.deepEqual(checkEschar(r).filter((x) => x.ok).map((x) => x.key), [...ESCHAR_MARKS])
  assert.ok(checkEschar({ ...r, depth: 'muscle' }).some((x) => x.critical))
})
