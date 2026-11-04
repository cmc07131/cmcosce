import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BIRTH_MARKS,
  CLAMP_S,
  HEAD,
  SEPARATES_AFTER,
  THIRD_MARKS,
  cct,
  checkBirth,
  checkThird,
  contraction,
  crown,
  freshBirth,
  freshThird,
  onCord,
  separated,
  traction,
  type BirthRun,
  type ThirdRun,
} from './model'
import { BIRTH_TITLES, THIRD_TITLES, birthGoals, thirdGoals } from './steps'

const apply = <R,>(r: R, patch: Partial<R>) => Object.assign(r as object, patch) as R
const DT = 0.05

/** Run the contractions for up to `seconds`, `act` deciding each tick what the hands do. */
function crowning(r: BirthRun, holding: boolean, seconds = 60) {
  for (let t = 0; t < seconds && !r.headBorn; t += DT) apply(r, crown(r, DT, contraction(t), holding).patch)
}

function shoulders(r: BirthRun, force: (r: BirthRun) => number, seconds = 60) {
  for (let t = 0; t < seconds && !r.born; t += DT) apply(r, traction(r, DT, force(r), contraction(t)).patch)
}

function perfectBirth(): BirthRun {
  const r = freshBirth()
  apply(r, { guard: true, palm: true, pant: HEAD.start })
  crowning(r, true)
  apply(r, { felt: 1, loop: 1, restitution: 1, sides: true })
  shoulders(r, (x) => (x.anterior < 1 ? 0.35 : -0.35))
  apply(r, { onMum: true, timeCalled: true, dried: 0.9, dryTowel: true, assessed: true })
  return r
}

test('a controlled birth earns every mark, and every step passes its own goals', () => {
  const r = perfectBirth()
  assert.ok(r.headBorn && r.born)
  assert.equal(r.tear, 'first')
  for (const row of checkBirth(r)) assert.ok(row.ok, `${row.label}: ${row.value}`)
  assert.deepEqual(checkBirth(r).map((x) => x.key), [...BIRTH_MARKS])
  for (let i = 0; i < BIRTH_TITLES.length; i++) for (const g of birthGoals(i, r)) assert.equal(g.state, 'done', `${BIRTH_TITLES[i]}: ${g.label}`)
})

test('before crowning the head slips back between contractions; at crowning it stays', () => {
  const r = freshBirth()
  apply(r, { head: 0.45 })
  apply(r, crown(r, 1, 0, false).patch)
  assert.ok(r.head < 0.45)
  apply(r, { head: 0.6 })
  apply(r, crown(r, 1, 0, false).patch)
  assert.equal(r.head, 0.6)
})

test('pushing through crowning, or no palm on the head, brings it out fast and tears', () => {
  const pushing = freshBirth()
  apply(pushing, { guard: true, palm: true })
  crowning(pushing, true)
  assert.equal(checkBirth(pushing).find((x) => x.key === 'pant')?.ok, false)
  assert.equal(pushing.tear, 'second')
  const unheld = freshBirth()
  apply(unheld, { guard: true, palm: true, pant: HEAD.start })
  crowning(unheld, false)
  assert.equal(checkBirth(unheld).find((x) => x.key === 'control')?.ok, false)
  assert.equal(birthGoals(1, unheld).find((x) => x.label.startsWith('Head kept'))?.state, 'fail')
})

test('the shoulders come only with a contraction, anterior first; hard traction is critical', () => {
  const r = perfectBirth()
  const between = { ...r, anterior: 0, posterior: 0, born: false }
  assert.equal(traction(between, 1, 0.35, 0).event, 'between')
  assert.equal(traction(between, 1, -0.35, 1).event, 'posterior-first')
  assert.equal(traction({ ...between, restitution: 0.5 }, 1, 0.35, 1).event, 'early')
  const hard = { ...between }
  shoulders(hard, (x) => (x.anterior < 1 ? 0.9 : -0.9))
  const row = checkBirth(hard).find((x) => x.key === 'shoulders')
  assert.equal(row?.ok, false)
  assert.equal(row?.critical, true)
})

function perfectThird(): ThirdRun {
  const r = freshThird()
  apply(r, { palpated: 1 })
  apply(r, { oxyAt: r.since })
  r.since = 70
  apply(r, onCord(r, 'clamp', 3).patch)
  apply(r, onCord(r, 'forceps', 8).patch)
  apply(r, onCord(r, 'scissors', 5.5).patch)
  r.since = (r.oxyAt ?? 0) + SEPARATES_AFTER + 10
  apply(r, { saw: ['gush', 'lengthen', 'uterus'], guarded: true })
  for (let i = 0; i < 200 && r.descent < 1; i++) apply(r, cct(r, DT, 0.35).patch)
  apply(r, { turns: 2, out: true, outAt: r.since, seen: ['maternal', 'fetal', 'cord'], rubbed: 0.8, looked: true, jug: true, pads: true })
  return r
}

test('an active third stage done right earns every mark, and every step passes its goals', () => {
  const r = perfectThird()
  for (const row of checkThird(r)) assert.ok(row.ok, `${row.label}: ${row.value}`)
  assert.deepEqual(checkThird(r).map((x) => x.key), [...THIRD_MARKS])
  for (let i = 0; i < THIRD_TITLES.length; i++) for (const g of thirdGoals(i, r)) assert.equal(g.state, 'done', `${THIRD_TITLES[i]}: ${g.label}`)
})

test('oxytocin before palpating, and clamping inside a minute, are caught', () => {
  const r = perfectThird()
  assert.equal(checkThird({ ...r, oxyFirst: true }).find((x) => x.key === 'twin')?.ok, false)
  const early = { ...r, clampedAt: 40 }
  assert.equal(checkThird(early).find((x) => x.key === 'clamp')?.ok, false)
  assert.equal(thirdGoals(1, early)[0].state, 'fail')
  assert.ok(CLAMP_S.min === 60)
})

test('cutting outside the clamps bleeds', () => {
  const r = freshThird()
  apply(r, { oxyAt: 30, since: 80 })
  apply(r, onCord(r, 'clamp', 3).patch)
  apply(r, onCord(r, 'forceps', 8).patch)
  const { event, patch } = onCord(r, 'scissors', 12)
  assert.equal(event, 'bleed')
  apply(r, patch)
  assert.equal(checkThird(r).find((x) => x.key === 'clamp')?.ok, false)
})

test('separation takes minutes after the oxytocin; pulling before it, unguarded, inverts the uterus', () => {
  const r = freshThird()
  apply(r, { oxyAt: 40, cutAt: 5, clampAt: 3, forcepsAt: 8, clampedAt: 70, since: 100 })
  assert.ok(!separated(r))
  assert.equal(cct(r, DT, 0.35).event, 'invert')
  assert.equal(cct({ ...r, guarded: true }, DT, 0.35).event, 'early')
  const row = checkThird({ ...r, ...cct(r, DT, 0.35).patch }).find((x) => x.key === 'cct')
  assert.equal(row?.critical, true)
  r.since = 40 + SEPARATES_AFTER
  assert.ok(separated(r))
  assert.equal(cct({ ...r, guarded: true }, DT, 0.9).event, 'snap')
})
