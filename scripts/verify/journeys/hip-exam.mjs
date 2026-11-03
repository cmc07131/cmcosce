#!/usr/bin/env node
/**
 * The hip examination (station ot-hip), a focused 3D examination: every manoeuvre pressed in order, the way a player
 * does it, each watched to the end and photographed twice on the way. Every exam item must be found.
 * node scripts/verify/journeys/hip-exam.mjs
 */
import { finish, launch } from '../lib.mjs'
import { openExam } from '../lib.mjs'

const h = await launch()
const ctx = await openExam(h.url, 'ot/ot-hip', 'hip-exam')
const { page, shot } = ctx
let facts = {}
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
  facts = { manoeuvres: keys.length, found: picked.length, of: options.length, missing, notes }
} catch (e) {
  facts = { crashed: String(e) }
  await shot('crash').catch(() => undefined)
}
const ok = await finish(ctx, !facts.crashed && facts.missing?.length === 0, facts)
h.stop()
process.exit(ok ? 0 : 1)
