import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ALIQUOT, DEPTH, END, HEIGHT, LAVAGE_MARKS, MEASURE, advance, checkLavage, flow, freshLavage, swallow, withdraw, type LavageRun } from './model'
import { LAVAGE_TITLES, lavageGoals } from './steps'

const apply = (r: LavageRun, patch: Partial<LavageRun>) => Object.assign(r, patch)
const DT = 0.05

/** Advance in small steps, swallowing whenever she gags. */
function pass(r: LavageRun, to: number) {
  for (let i = 0; i < 400 && r.depth < to - 0.5; i++) {
    const { patch, event } = advance(r, Math.min(1, to - r.depth))
    apply(r, patch)
    if (event === 'gag') apply(r, swallow())
  }
}

/** The funnel held at `h` for `s` seconds. */
function hold(r: LavageRun, h: number, s: number) {
  for (let t = 0; t < s; t += DT) apply(r, flow(r, DT, h).patch)
}

function aliquot(r: LavageRun, ml = ALIQUOT.ml) {
  r.funnel += ml
  r.poured += ml
  hold(r, 0.9, 3)
  hold(r, 0.1, 3)
}

function perfect(): LavageRun {
  const r = freshLavage()
  apply(r, { lateral: true, foot: 20, suction: true, laid: MEASURE.true, mark: MEASURE.true, sprayed: true, gagIn: true, lubed: 1 })
  pass(r, MEASURE.true)
  apply(r, { aspirated: true, whoosh: true })
  hold(r, 0.1, 3)
  r.sample = 'neat'
  for (let i = 0; i < 40 && !(r.inTotal >= END.enough && r.residue <= END.clear); i++) aliquot(r)
  apply(r, { charcoal: true, pinched: true })
  for (let i = 0; i < 200 && r.out < r.depth; i++) apply(r, withdraw(r, 1).patch)
  r.gagOut = true
  return r
}

test('the Hong Kong protocol done right earns every mark, and every step passes its goals', () => {
  const r = perfect()
  const rows = checkLavage(r)
  assert.deepEqual(rows.map((x) => x.key), [...LAVAGE_MARKS])
  for (const row of rows) assert.ok(row.ok, `${row.label}: ${row.value}`)
  for (let i = 0; i < LAVAGE_TITLES.length; i++) for (const g of lavageGoals(i, r)) assert.equal(g.state, 'done', `${LAVAGE_TITLES[i]}: ${g.label}`)
  assert.equal(r.inTotal, END.total, '15 aliquots of 200 mL')
})

test('the return clears before 3 L, and lavage goes on to 3 L', () => {
  const r = freshLavage()
  apply(r, { gagIn: true, mark: 50, aspirated: true })
  pass(r, 50)
  hold(r, 0.1, 3)
  let clearAt = 0
  for (let i = 0; i < 20; i++) {
    aliquot(r)
    if (!clearAt && r.residue <= END.clear) clearAt = r.inTotal
  }
  assert.ok(clearAt > 1000 && clearAt < END.total, `clear at ${clearAt}`)
})

test('she gags at the pharynx; pushing on makes her retch, swallowing lets it pass', () => {
  const r = freshLavage()
  apply(r, { gagIn: true })
  let ev = ''
  for (let i = 0; i < 30 && ev !== 'gag'; i++) {
    const m = advance(r, 1)
    apply(r, m.patch)
    ev = m.event
  }
  assert.equal(r.depth, DEPTH.gag)
  assert.equal(advance(r, 1).event, 'forced')
  apply(r, swallow())
  apply(r, advance(r, 1).patch)
  assert.ok(r.depth > DEPTH.gag)
})

test('fluid run into a tube short of the stomach, or unconfirmed, is caught', () => {
  const short = freshLavage()
  apply(short, { gagIn: true, mark: 36 })
  pass(short, 36)
  short.funnel = 200
  assert.equal(flow(short, DT, 0.9).event, 'not-in')
  const blind = freshLavage()
  apply(blind, { gagIn: true, mark: 50 })
  pass(blind, 50)
  hold(blind, 0.1, 3)
  blind.funnel = 200
  apply(blind, flow(blind, DT, 0.9).patch)
  assert.equal(checkLavage(blind).find((x) => x.key === 'confirm')?.ok, false)
})

test('an aliquot over 300 mL fails; one that fills her past 550 mL makes her vomit', () => {
  const r = freshLavage()
  apply(r, { gagIn: true, mark: 50, aspirated: true })
  pass(r, 50)
  hold(r, 0.1, 3)
  r.funnel = 400
  hold(r, 0.9, 4)
  assert.equal(checkLavage(r).find((x) => x.key === 'lavage')?.ok, false)
  r.funnel = 300
  hold(r, HEIGHT.up + 0.1, 4)
  assert.ok(r.vomited)
  assert.equal(checkLavage(r).find((x) => x.key === 'lavage')?.critical, true)
})

test('a full stomach is siphoned first; a sample after lavage is diluted', () => {
  const r = freshLavage()
  apply(r, { gagIn: true, mark: 50, aspirated: true })
  pass(r, 50)
  r.funnel = 200
  apply(r, flow(r, DT, 0.9).patch)
  assert.ok(r.unsiphoned)
  assert.equal(checkLavage({ ...perfect(), sample: 'diluted' }).find((x) => x.key === 'siphon')?.ok, false)
})

test('withdrawn unpinched, it dribbles into her pharynx', () => {
  const r = perfect()
  r.out = 0
  r.pinched = false
  for (let i = 0; i < 100 && r.out < r.depth; i++) apply(r, withdraw(r, 1).patch)
  assert.ok(r.dribbled)
  assert.equal(checkLavage(r).find((x) => x.key === 'finish')?.ok, false)
})
