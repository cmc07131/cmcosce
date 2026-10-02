import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COLLES_MARKS, MAX_LIDO_MG, blockWorks, checkColles, freshColles, letGo, manipPain, mould, scoreColles, setTilt, setTraction, setUlnar, siteAt, type CollesRun } from './model'

/** A clean run, driven the way the bench does it. */
function clean(): CollesRun {
  let r: CollesRun = { ...freshColles(), before: ['median', 'abduct', 'epl', 'pulse', 'crt', 'skin', 'allergy'] }
  r = { ...r, ampoule: 1, drawnMl: 10, cleaned: 0.9, site: siteAt(200), aspirated: true, aspiratedBlood: true, injectedMl: 10, blockAt: 0 }
  r = { ...r, minutes: 6, counter: true }
  r = { ...r, ...setTraction(r, 1) }
  r = { ...r, ...setTilt(r, 40) }
  r = { ...r, ...setTilt(r, 0) }
  r = { ...r, ...setUlnar(r, 1) }
  r = { ...r, slab: 'dorsal-be', slabWhileHeld: true }
  r = { ...r, ...mould(r, 3.1) }
  r = { ...r, ...letGo(r), after: ['median', 'crt'], xray: true }
  return r
}

test('colles: a clean run earns every mark', () => {
  const r = clean()
  const s = scoreColles(r)
  assert.deepEqual(s.earned, [...COLLES_MARKS])
  assert.ok(r.tilt <= 10 && r.short <= 3)
})

test('colles: the needle site decides what you aspirate; the block needs time', () => {
  assert.equal(siteAt(200), 'fracture')
  assert.equal(siteAt(230), 'carpus')
  assert.equal(siteAt(150), 'shaft')
  const r = clean()
  assert.ok(blockWorks(r))
  assert.ok(!blockWorks({ ...r, minutes: 2 }))
  assert.ok(manipPain({ ...r, minutes: 2 }) > manipPain(r))
})

test('colles: an impacted fragment will not go volar until disimpacted under traction', () => {
  let r: CollesRun = { ...freshColles(), counter: true }
  r = { ...r, ...setTraction(r, 1) }
  r = { ...r, ...setTilt(r, 0) }
  assert.ok(r.tilt > 10, 'impacted: barely moves')
  r = { ...r, ...setTilt(r, 40) }
  assert.ok(r.disimpacted)
  r = { ...r, ...setTilt(r, 0) }
  assert.ok(r.tilt <= 10)
})

test('colles: no counter-traction limits traction; letting go before the mould loses the reduction', () => {
  const noCounter = { ...freshColles(), ...setTraction(freshColles(), 1) }
  assert.ok(noCounter.traction <= 0.3)
  let r: CollesRun = { ...freshColles(), counter: true }
  r = { ...r, ...setTraction(r, 1) }
  r = { ...r, ...setTilt(r, 40) }
  r = { ...r, ...setTilt(r, 0) }
  r = { ...r, ...letGo(r) }
  assert.ok(r.lostReduction && r.tilt > 10)
})

test('colles: 2% lidocaine 10 mL is over the maximum and critical; a full cast is critical', () => {
  const r = { ...clean(), ampoule: 2 as const }
  assert.ok(20 * 10 > MAX_LIDO_MG)
  assert.ok(checkColles(r).some((row) => row.key === 'dose' && !row.ok && row.critical))
  assert.ok(checkColles({ ...clean(), slab: 'full-cast' }).some((row) => row.key === 'slab' && row.critical))
})
