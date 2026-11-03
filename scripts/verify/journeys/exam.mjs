#!/usr/bin/env node
/**
 * Focused 3D examinations: every manoeuvre pressed in order, the way a player does it, each watched to the end and
 * photographed twice on the way. Every exam item must be found.
 *   node scripts/verify/journeys/exam.mjs                 the stations below
 *   node scripts/verify/journeys/exam.mjs ot/ot-ankle     one station (gym/id)
 */
import { finish, launch, openExam } from '../lib.mjs'

const STATIONS = ['ot/ot-hip', 'ot/ot-ankle']
const h = await launch()
let all = true
for (const station of process.argv.slice(2).length ? process.argv.slice(2) : STATIONS) all = (await run(station)) && all
h.stop()
process.exit(all ? 0 : 1)

async function run(station) {
const ctx = await openExam(h.url, station, `exam-${station.split('/')[1]}`)
const { page, shot } = ctx
let facts = { station }
try {
  await page.waitForSelector('[data-testid^="exam3d-m-"]', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await shot('00-start')
  const keys = await page.$$eval('[data-testid^="exam3d-m-"]', (els) => els.map((e) => e.getAttribute('data-testid').slice('exam3d-m-'.length)))
  const notes = {}
  for (const [i, key] of keys.entries()) {
    const btn = page.getByTestId(`exam3d-m-${key}`)
    await btn.scrollIntoViewIfNeeded()
    await btn.click()
    // Half-way through the animation, then wait for it to finish (the buttons enable again).
    const name = `${String(i + 1).padStart(2, '0')}-${key.replace(/[@]/g, '_')}`
    await page.waitForTimeout(900)
    await shot(`${name}-a`)
    await page.waitForTimeout(1100)
    await shot(`${name}-b`)
    await page.waitForFunction((k) => !document.querySelector(`[data-testid="exam3d-m-${k}"]`)?.hasAttribute('disabled'), key, { timeout: 30000 })
    await page.waitForTimeout(300)
    notes[key] = await page.locator('[data-testid="exam3d-note"], .exam3d-note').first().innerText().catch(() => '')
  }
  const picked = await page.evaluate(() => window.__picked)
  const options = await page.evaluate(() => window.__options)
  const missing = options.filter((o) => !picked.includes(o.id)).map((o) => o.label)
  facts = { station, manoeuvres: keys.length, found: picked.length, of: options.length, missing, notes }
} catch (e) {
  facts = { station, crashed: String(e) }
  await shot('crash').catch(() => undefined)
}
return finish(ctx, !facts.crashed && facts.missing?.length === 0, facts)
}
