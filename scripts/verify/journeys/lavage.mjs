#!/usr/bin/env node
/**
 * The gastric lavage bench (perform: lavage), done right the way a player does it, every action through a control
 * the player can see: the Hong Kong protocol from rolling her over to the tube out. Every step must pass its own
 * goals when Next is pressed, and the bench must score all 7 marks. node scripts/verify/journeys/lavage.mjs
 */
import { finish, launch, openBench } from '../lib.mjs'

const h = await launch()
const ctx = await openBench(h.url, 'lavage', 'lavage')
const { page, hold, swipe, note, shot } = ctx
const stops = []
let facts = {}
let ok = false

async function next() {
  const at = await ctx.step()
  await page.getByTestId('lavage-next').click()
  await page.waitForTimeout(150)
  if (await page.locator('[data-review]').count()) {
    stops.push({ at, goals: (await page.getByTestId('lavage-goals').innerText()).replace(/\n+/g, ' | ') })
    await page.getByTestId('lavage-review-anyway').click()
    await page.waitForTimeout(150)
  }
}

/** Where the tube is, read from the bar. */
async function depth() {
  const m = (await page.locator('.hare-bar').innerText()).match(/TUBE (\d+) CM/)
  return m ? Number(m[1]) : 0
}

/** Hold the funnel at a height (0 floor … 1 two feet up) by pressing the strip there. */
async function funnel(hgt) {
  const b = await ctx.box('lavage-funnel')
  await page.mouse.click(b.x + b.width / 2, b.y + (1 - hgt) * b.height)
}

const tally = async () => page.getByTestId('lavage-tally').innerText()

try {
  // Position: left lateral, foot up 20 cm, suction on.
  await shot('01-supine')
  await page.getByTestId('lavage-roll').click()
  await page.getByTestId('lavage-suction').click()
  await swipe('lavage-foot', 20 / 60)
  await shot('02-positioned')
  await next()
  // Measure mouth to epigastrium and tape it.
  await swipe('lavage-lay', 50 / 70)
  await page.getByTestId('lavage-tape').click()
  await shot('03-measured')
  await next()
  // Pass: spray, gag, lubricate, then advance with her swallows to the tape.
  await hold('lavage-spray', 600)
  await page.getByTestId('lavage-gag').click()
  await hold('lavage-lube', 1300)
  let gagShot = false
  for (let i = 0; i < 40; i++) {
    const d = await depth()
    const left = 50 - d
    if (Math.abs(left) <= 1) break
    await swipe('lavage-advance', Math.max(-0.3, Math.min(0.1, left / 30)))
    if ((await note()).includes('She gags')) {
      if (!gagShot) {
        gagShot = true
        await shot('04-gags')
      }
      await page.getByTestId('lavage-swallow').click()
    }
  }
  await shot('05-passed')
  await next()
  // Confirm: aspirate, and air in while listening.
  await hold('lavage-aspirate', 700)
  await hold('lavage-air', 700)
  await shot('06-confirmed')
  await next()
  // Siphon the stomach into the bucket, a specimen of the first return.
  await funnel(0.08)
  await page.waitForTimeout(400)
  await page.getByTestId('lavage-sample').click()
  await page.waitForTimeout(1600)
  await shot('07-siphoned')
  await next()
  // Lavage: 200 mL aliquots, up to run in, down to drain, until 3 L and clear.
  for (let i = 0; i < 20; i++) {
    const t = await tally()
    if (t.includes('in 3.0 L') && t.includes('return clear')) break
    await funnel(0.5)
    await hold('lavage-pour', 1000)
    await funnel(0.92)
    await page.waitForTimeout(1500)
    if (i === 0) await shot('08-running-in')
    await funnel(0.08)
    await page.waitForTimeout(1600)
    if (i === 0) await shot('09-draining-cloudy')
  }
  await shot('10-clear')
  await next()
  // Finish: charcoal, pinch, withdraw, gag out.
  await page.getByTestId('lavage-charcoal').click()
  await page.getByTestId('lavage-pinch').click()
  await swipe('lavage-withdraw', -0.85)
  await page.getByTestId('lavage-gagout').click()
  await shot('11-tube-out')
  await next()
  await shot('12-check')
  await page.getByTestId('lavage-check-done').click()
  await page.waitForTimeout(200)
  const result = await page.evaluate(() => window.__result)
  facts = { stops, marks: result?.marks?.length ?? 0, faults: result?.faults ?? [], tally: await page.locator('body').innerText().then((t) => t.slice(0, 0)) }
  ok = stops.length === 0 && facts.marks === 7
} catch (e) {
  await shot('error').catch(() => undefined)
  facts = { ...facts, stops, error: String(e) }
}
ok = await finish(ctx, ok, facts)
h.stop()
process.exit(ok ? 0 : 1)
