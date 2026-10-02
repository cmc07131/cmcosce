import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DIGITAL_MARKS, NERVES, checkDigital, freshDigital, injectHere, spotAt, tipFeels, type DigitalRun, type Side } from './model'

function blockSide(r: DigitalRun, side: Side): DigitalRun {
  let x: DigitalRun = { ...r, side, entries: [...r.entries, { side, site: 'web' }] }
  for (const [spot, ml] of [['dorsal', 0.5], ['palmar', 1.5]] as const) {
    x = { ...x, tip: NERVES[side][spot], spot, aspiratedHere: true }
    x = { ...x, ...injectHere(x, ml).patch }
  }
  return x
}

test('digital: the section places dorsal nerves high, palmar low, arteries beside the palmar', () => {
  assert.equal(spotAt(NERVES.radial.dorsal, 'radial'), 'dorsal')
  assert.equal(spotAt(NERVES.ulnar.palmar, 'ulnar'), 'palmar')
  assert.equal(spotAt(NERVES.radial.artery, 'radial'), 'artery')
  assert.equal(spotAt({ x: 80, y: 80 }, 'radial'), 'bone')
})

test('digital: both sides, aspirated, under 5 mL, tested at 5 minutes: every mark', () => {
  let r: DigitalRun = { ...freshDigital(), consent: true, vascularAsked: true, twoPoint: true, crt: true, ampoule: 'plain1', drawn: 5, cleaned: 0.9 }
  r = blockSide(r, 'radial')
  r = blockSide(r, 'ulnar')
  assert.equal(tipFeels(r), 'sharp', 'not yet')
  r = { ...r, minutes: 6, tested: true }
  assert.equal(tipFeels(r), 'numb')
  assert.deepEqual(checkDigital(r).filter((x) => x.ok).map((x) => x.key), [...DIGITAL_MARKS])
})

test('digital: one side numbs half; 10 mL is critical; no aspiration is counted', () => {
  let r = blockSide({ ...freshDigital() }, 'radial')
  r = { ...r, minutes: 6 }
  assert.equal(tipFeels(r), 'half')
  const big = { ...r, ml: { radial: { dorsal: 3, palmar: 4, other: 3 }, ulnar: { dorsal: 0, palmar: 0, other: 0 } } }
  assert.ok(checkDigital(big).some((x) => x.key === 'volume' && x.critical))
  const blind = { ...freshDigital(), side: 'radial' as const, spot: 'palmar' as const, tip: NERVES.radial.palmar }
  assert.equal({ ...blind, ...injectHere(blind, 1).patch }.unaspirated, 1)
})
