import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ARTERY, BLOCK_MARKS, NERVE, checkBlock, fasciaIliacaY, featureAt, freshBlock, inject, moveTip, regionAt, toxicity, type BlockRun } from './model'

const target = { x: 170, y: fasciaIliacaY(170) + 6 }

function walk(run: BlockRun, to: { x: number; y: number }) {
  let r = run
  const from = { x: 236, y: 4 }
  for (let i = 1; i <= 20; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / 20, y: from.y + ((to.y - from.y) * i) / 20 }
    r = { ...r, ...moveTip(r, p).patch }
  }
  return r
}

function clean(): BlockRun {
  let r: BlockRun = { ...freshBlock(), cleaned: 0.9, cover: true, probe: 'good', named: ['artery', 'nerve', 'fascia'], plane: 'in' }
  r = walk(r, target)
  for (let i = 0; i < 8; i++) {
    r = { ...r, aspirations: r.aspirations + 1, sinceAspirate: 0 }
    r = { ...r, ...inject(r, 5).patch }
  }
  return { ...r, labelled: true, observed: true, documented: true }
}

test('usblock: anatomy: artery on top of the fascia, nerve under it, target lateral and under', () => {
  assert.ok(ARTERY.y + ARTERY.r < fasciaIliacaY(ARTERY.x))
  assert.ok(NERVE.y > fasciaIliacaY(NERVE.x))
  assert.equal(regionAt(target), 'target')
  assert.equal(regionAt({ x: 170, y: fasciaIliacaY(170) - 8 }), 'above')
  assert.equal(featureAt({ x: 150, y: fasciaIliacaY(150) }), 'fascia')
})

test('usblock: a clean block earns every mark, with two pops on the way', () => {
  const r = clean()
  assert.equal(r.pops, 2)
  const rows = checkBlock(r)
  assert.deepEqual(rows.filter((x) => x.ok).map((x) => x.key), [...BLOCK_MARKS])
})

test('usblock: a nerve will not take an injection; a vessel gives toxicity', () => {
  let r = walk({ ...freshBlock(), plane: 'in' }, NERVE)
  assert.ok(r.nerveTouch)
  assert.equal(inject(r, 5).ok, false)
  r = walk({ ...freshBlock(), plane: 'in' }, ARTERY)
  assert.ok(r.vesselPunctured)
  r = { ...r, ...inject(r, 10).patch }
  assert.ok(toxicity(r))
  assert.ok(checkBlock(r).some((x) => x.critical))
})

test('usblock: out of plane is advancing blind; big boluses without aspirating cost the mark', () => {
  const blind = walk({ ...freshBlock(), plane: 'out' }, target)
  assert.ok(blind.blindAdvance)
  let r = walk({ ...freshBlock(), plane: 'in' }, target)
  r = { ...r, ...inject(r, 20).patch }
  assert.ok(!checkBlock(r).find((x) => x.key === 'incremental')!.ok)
})
