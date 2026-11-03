#!/usr/bin/env node
/**
 * The central line bench (perform: cvc), done right from start to finish the way a player does it: every action
 * through a control or a picture the player can see. Every step must pass its own check when Next is pressed, and
 * the end must score all seven marks. node scripts/verify/journeys/central-line.mjs
 */
import { finish, launch, openBench } from '../lib.mjs'

const h = await launch()
const ctx = await openBench(h.url, 'cvc', 'central-line')
const { page, tap, drag, hold, swipe, twist, note, small, step, shot } = ctx
const stops = []

/** Next, and the step must have passed its check: a review panel opening is a failure of the journey. */
async function next() {
  const at = await step()
  await page.getByTestId('cvc-next').click()
  await page.waitForTimeout(150)
  if (await page.locator('[data-review]').count()) {
    stops.push({ at, goals: (await page.getByTestId('cvc-goals').innerText()).replace(/\n+/g, ' | ') })
    await page.getByTestId('cvc-review-anyway').click()
    await page.waitForTimeout(150)
  }
}

let facts = {}
try {
  // 1 position
  await drag('cvc-tilt', 200, 110, [[40, 60], [40, 70], [40, 76]])
  await drag('cvc-rotate', 100, 100, [[50, 40], [58, 40], [63, 40]])
  await shot('01-position')
  await next()
  // 2 pre-scan: probe to the cricoid, press, name both vessels
  await drag('cvc-scan', 200, 150, [[60, 110], [80, 90], [88, 74]])
  await hold('cvc-press', 1000)
  await page.waitForTimeout(600)
  await tap('cvc-us-scan', 240, 160, 120, 78)
  await tap('cvc-us-scan', 240, 160, 183, 96)
  await shot('02-prescan')
  await next()
  // 3 scrub
  for (const g of ['cap', 'mask', 'scrub', 'gown', 'gloves']) {
    await page.getByTestId(`cvc-garb-${g}`).click()
    await page.waitForTimeout(1750)
  }
  await shot('03-scrub')
  await next()
  // 4 prep: back and forth over the field, wait for it to dry, drape to the feet
  const zig = []
  for (let y = 26; y <= 124; y += 7) zig.push([30, y], [165, y + 3])
  await drag('cvc-prep', 200, 150, zig, 4)
  await page.waitForTimeout(5600)
  await drag('cvc-drape', 100, 170, [[50, 8], [50, 60], [50, 120], [50, 168]])
  await shot('04-prep')
  await next()
  // 5 kit
  for (const k of [0, 1, 2]) {
    await tap('cvc-kit', 200, 110, 146, 26 + k * 30)
    await drag('cvc-flush', 220, 56, [[176, 28], [150, 28], [120, 28]])
  }
  await tap('cvc-kit', 200, 110, 116, 56)
  await tap('cvc-kit', 200, 110, 116, 80)
  await tap('cvc-sheath', 200, 60, 150, 30)
  await drag('cvc-sheath', 200, 60, [[40, 30], [120, 30], [175, 30]])
  await shot('05-kit')
  await next()
  // 6 needle: lidocaine, aspirate, then real tip tracking until the dark flash
  await drag('cvc-lidocaine', 220, 56, [[176, 28], [140, 28], [100, 28]])
  await page.getByTestId('cvc-aspirate').click()
  let probeY = 74
  for (let i = 0; i < 100 && !(await note()).includes('non-pulsatile'); i++) {
    const s = await small()
    if (s.includes('you see the tip') || s.includes('shaft')) {
      await drag('cvc-needle', 200, 150, [[88, probeY], [88, probeY - 2]], 2)
      probeY -= 2
    } else await drag('cvc-needle', 200, 150, [[88, 128], [88, 126]], 2)
  }
  await shot('06-flash')
  await next()
  // 7 wire: steady, twist off, thumb, advancer, feed to ~17 cm, hold at the skin, needle off
  await tap('cvc-wire-field', 200, 150, 100, 82)
  await twist(-400)
  await tap('cvc-wire-field', 200, 150, 85, 65)
  await page.getByTestId('cvc-advancer').click()
  await swipe('cvc-feed', 0.85, 2)
  await page.getByTestId('cvc-grip-skin').click()
  await swipe('cvc-needle-out', -0.65, 4)
  await shot('07-wire')
  await next()
  // 8 confirm, both axes
  await tap('cvc-confirm', 240, 160, 124, 96)
  await page.getByTestId('cvc-long').click()
  await page.waitForTimeout(850)
  await tap('cvc-confirm', 240, 160, 120, 80)
  await shot('08-confirm')
  await next()
  // 9 nick and dilate
  await drag('cvc-nick', 200, 100, [[101, 46], [101, 34], [101, 14]])
  await page.getByTestId('cvc-thread-dilator').click()
  await swipe('cvc-dilator-pad', 0.35, 6)
  await page.getByTestId('cvc-grip-tail').click()
  await swipe('cvc-dilator-pad', 0.3, 3)
  await twist(1080)
  await shot('09-dilated')
  await swipe('cvc-dilator-pad', -0.3, 2)
  await page.getByTestId('cvc-grip-skin').click()
  await swipe('cvc-dilator-pad', -0.4, 8)
  await hold('cvc-gauze', 2200)
  await next()
  // 10 catheter: wire held at the brown hub, in to 15–16 cm, wire out and shown
  await page.getByTestId('cvc-thread-catheter').click()
  await swipe('cvc-cath-pad', 0.3, 6)
  await page.getByTestId('cvc-grip-tail').click()
  for (let i = 0; i < 14 && !/Catheter 1[5-6] cm/.test(await small()); i++) await swipe('cvc-cath-pad', 0.2, 1)
  await swipe('cvc-wire-pad', -0.5, 3)
  await tap('cvc-wire-tray', 200, 70, 168, 30)
  await shot('10-catheter')
  await next()
  // 11 aspirate, flush, cap each lumen; stitch; dress
  for (const k of [0, 1, 2]) {
    await tap('cvc-after-tray', 200, 110, 146, 26 + k * 30)
    await drag('cvc-after-syringe', 220, 56, [[106, 28], [120, 28], [140, 28]])
    await drag('cvc-after-syringe', 220, 56, [[140, 28], [100, 28], [60, 28], [40, 28]])
    await drag('cvc-after-syringe', 220, 56, [[110, 28], [80, 28], [50, 28], [40, 28]])
    await tap('cvc-after-tray', 200, 110, 146, 26 + k * 30)
  }
  await tap('cvc-secure-field', 200, 150, 76, 76)
  await page.waitForTimeout(1100)
  await tap('cvc-secure-field', 200, 150, 124, 76)
  await page.waitForTimeout(1100)
  await drag('cvc-secure-field', 200, 150, [[100, 40], [100, 70], [100, 100], [100, 110]])
  await shot('11-secure')
  await next()
  // 12 X-ray
  await tap('cvc-xray', 200, 200, 92, 40 + 10.5 * 6.4)
  await tap('cvc-xray', 200, 200, 50, 110)
  await tap('cvc-xray', 200, 200, 150, 110)
  await page.getByTestId('cvc-document').click()
  await shot('12-xray')
  await next()
  await shot('13-check')
  const rows = await page.locator('.hare-rows li').allInnerTexts()
  await page.getByTestId('cvc-check-done').click()
  const result = await page.evaluate(() => window.__result)
  facts = { marks: result?.marks?.length ?? 0, faults: result?.faults ?? [], stops, rows: rows.map((r) => r.split('\n')[0]) }
} catch (e) {
  facts = { crashed: String(e), at: await step(), stops }
  await shot('crash').catch(() => undefined)
}
const ok = await finish(ctx, facts.marks === 7 && stops.length === 0, facts)
h.stop()
process.exit(ok ? 0 : 1)
