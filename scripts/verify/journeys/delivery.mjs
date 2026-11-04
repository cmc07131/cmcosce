#!/usr/bin/env node
/**
 * The normal delivery bench (perform: delivery), both poses, done right the way a player does it: every action
 * through a control or a picture the player can see. Every step must pass its own goals when Next is pressed, and
 * each pose must score all its marks. node scripts/verify/journeys/delivery.mjs
 */
import { finish, launch, openBench } from '../lib.mjs'

const h = await launch()
let ok = true

/** Next, and the step must have passed its goals: a review opening is a failure of the journey. */
function stepper(ctx, prefix, stops) {
  return async () => {
    const at = await ctx.step()
    await ctx.page.getByTestId(`${prefix}-next`).click()
    await ctx.page.waitForTimeout(150)
    if (await ctx.page.locator('[data-review]').count()) {
      stops.push({ at, goals: (await ctx.page.getByTestId(`${prefix}-goals`).innerText()).replace(/\n+/g, ' | ') })
      await ctx.page.getByTestId(`${prefix}-review-anyway`).click()
      await ctx.page.waitForTimeout(150)
    }
  }
}

/** Press and hold a strip at `force` (its share of the way from the middle to the end) until `until()` or `ms`. */
async function pull(ctx, id, up, force, until, ms = 30000) {
  const b = await ctx.box(id)
  const H = 150
  const mid = up ? H / 2 : 22
  const span = up ? H / 2 - 12 : H - 34
  const y = b.y + ((mid + force * span) / H) * b.height
  await ctx.page.mouse.move(b.x + b.width / 2, y)
  await ctx.page.mouse.down()
  const t0 = Date.now()
  while (Date.now() - t0 < ms && !(await until())) await ctx.page.waitForTimeout(150)
  await ctx.page.mouse.up()
}

/** Hold a button until `until()` or `ms`. */
async function holdUntil(ctx, id, until, ms = 40000) {
  const b = await ctx.box(id)
  await ctx.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await ctx.page.mouse.down()
  const t0 = Date.now()
  while (Date.now() - t0 < ms && !(await until())) await ctx.page.waitForTimeout(150)
  await ctx.page.mouse.up()
}

const zigzag = (cx, cy, rx, ry, rows = 9) => {
  const pts = []
  for (let i = 0; i <= rows; i++) {
    const y = cy - ry + (2 * ry * i) / rows
    const w = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2))
    pts.push(i % 2 ? [cx + w, y] : [cx - w, y], i % 2 ? [cx - w, y] : [cx + w, y])
  }
  return pts
}

/* ---------------------------------------------------------------- the birth */
{
  const ctx = await openBench(h.url, 'delivery&pose=birth', 'delivery-birth')
  const { page, tap, drag, hold, swipe, note, shot } = ctx
  const stops = []
  const next = stepper(ctx, 'birth', stops)
  const bar = () => page.locator('.hare-bar').innerText()
  let facts = {}
  try {
    await shot('01-head-visible')
    await tap('birth-work', 200, 180, 100, 142)
    await tap('birth-work', 200, 180, 100, 96)
    await shot('02-hands-on')
    await next()
    // Crowning: tell her to pant, then hold the head flexed through the contractions until it is born.
    await page.getByTestId('birth-pant').click()
    let mid = false
    await holdUntil(ctx, 'birth-flex', async () => {
      const b = await bar()
      if (!mid && b.includes('CROWNING')) {
        mid = true
        await shot('03-crowning')
      }
      return b.includes('HEAD BORN')
    })
    await page.waitForTimeout(300)
    await shot('04-head-born')
    await next()
    // Cord: feel round the neck, ease the loop over the head.
    const t0 = Date.now()
    let feltShot = false
    await holdUntil(ctx, 'birth-feel', async () => {
      if (!feltShot && Date.now() - t0 > 700) {
        feltShot = true
        await shot('05a-feeling')
      }
      return Date.now() - t0 > 2200
    })
    await shot('05-cord-felt')
    await swipe('birth-loop', 0.7, 2)
    await shot('06-cord-free')
    await next()
    // Restitution: hands off and watch.
    await page.waitForTimeout(2000)
    await shot('07-restituting')
    await page.waitForTimeout(2800)
    await shot('08-restituted')
    await next()
    // Shoulders: hands either side, then gentle down with a contraction, then gentle up.
    await tap('birth-work', 200, 180, 100, 104)
    let a = false
    await pull(ctx, 'birth-traction', true, 0.35, async () => {
      const n = await note()
      if (!a && n.includes('slides out under')) {
        a = true
        await page.waitForTimeout(1200)
        await shot('09a-anterior-coming')
      }
      return n.includes('anterior shoulder is out')
    })
    await shot('09-anterior')
    let p = false
    await pull(ctx, 'birth-traction', true, -0.35, async () => {
      if (!p && (await note()).includes('sweeps over')) {
        p = true
        await page.waitForTimeout(900)
        await shot('09b-posterior-coming')
      }
      return (await bar()).includes('BORN ·')
    })
    await shot('10-born')
    await next()
    // Baby: onto mum, the time, dry her, dry towel and hat, check her.
    await page.getByTestId('birth-onmum').click()
    await page.getByTestId('birth-time').click()
    await shot('11-on-mum-wet')
    await drag('birth-dry', 200, 170, zigzag(100, 92, 46, 54, 12), 4)
    await shot('12-dried')
    await page.getByTestId('birth-towel').click()
    await page.getByTestId('birth-assess').click()
    await shot('13-towel-hat')
    await next()
    await shot('14-check')
    await page.getByTestId('birth-check-done').click()
    await page.waitForTimeout(200)
    const result = await page.evaluate(() => window.__result)
    facts = { stops, marks: result?.marks?.length ?? 0, faults: result?.faults ?? [] }
    ok = (await finish(ctx, stops.length === 0 && facts.marks === 6, facts)) && ok
  } catch (e) {
    await shot('error').catch(() => undefined)
    ok = (await finish(ctx, false, { ...facts, stops, error: String(e) })) && false
  }
}

/* ---------------------------------------------------------------- the third stage */
{
  const ctx = await openBench(h.url, 'delivery&pose=third', 'delivery-third')
  const { page, tap, drag, hold, note, shot, twist } = ctx
  const stops = []
  const next = stepper(ctx, 'third', stops)
  let facts = {}
  try {
    // Twin, then oxytocin.
    const tp = Date.now()
    let ps = false
    await holdUntil(ctx, 'third-palpate', async () => {
      if (!ps && Date.now() - tp > 900) {
        ps = true
        await shot('00-palpating')
      }
      return Date.now() - tp > 2400
    })
    await shot('01-palpated')
    await tap('third-work', 200, 170, 44, 150)
    await page.waitForTimeout(500)
    await shot('02-oxytocin')
    await next()
    // The cord: wait past a minute, cord clamp, forceps, cut between.
    for (let i = 0; i < 4; i++) {
      const c = await page.getByTestId('third-clock').innerText()
      const [m, s] = c.split(':').map(Number)
      if (m * 60 + s >= 62) break
      await page.getByTestId('third-wait30').click()
    }
    await shot('03-cord-pulsing')
    const x = (cm) => 30 + (cm / 50) * 156
    await tap('third-cordpad', 200, 100, x(3), 62)
    await tap('third-cordpad', 200, 100, x(9), 62)
    await tap('third-cordpad', 200, 100, x(6), 62)
    await shot('04-cord-cut')
    await next()
    // Separation: wait, then tap each sign.
    for (let i = 0; i < 8 && !(await note()).includes('changed'); i++) await page.getByTestId('third-wait').click()
    await tap('third-work', 200, 170, 90, 120)
    await tap('third-work', 200, 170, 100, 140)
    await tap('third-work', 200, 170, 160, 40)
    await shot('05-separated')
    await next()
    // Traction: guard above the pubis, steady gentle pull, then twist the membranes out.
    await tap('third-work', 200, 170, 100, 30)
    let half = false
    await pull(ctx, 'third-traction', false, 0.35, async () => {
      if (!half && (await note()).includes('comes down')) {
        half = true
        await page.waitForTimeout(1200)
        await shot('06-traction')
      }
      return (await note()).includes('introitus')
    })
    await shot('07-at-introitus')
    await twist(900)
    await page.waitForTimeout(200)
    await shot('08-delivered')
    await next()
    // Placenta: all three views.
    for (const v of ['maternal', 'fetal', 'cord']) {
      await page.getByTestId(`third-view-${v}`).click()
      await shot(`09-${v}`)
    }
    await next()
    // Tone, tears, loss.
    await drag('third-fundus', 200, 170, zigzag(100, 60, 28, 28, 10), 4)
    await page.getByTestId('third-look').click()
    await page.getByTestId('third-jug').click()
    await page.getByTestId('third-pads').click()
    await shot('10-tone-tears-loss')
    await next()
    await shot('11-check')
    await page.getByTestId('third-check-done').click()
    await page.waitForTimeout(200)
    const result = await page.evaluate(() => window.__result)
    facts = { stops, marks: result?.marks?.length ?? 0, faults: result?.faults ?? [] }
    ok = (await finish(ctx, stops.length === 0 && facts.marks === 6, facts)) && ok
  } catch (e) {
    await shot('error').catch(() => undefined)
    ok = (await finish(ctx, false, { ...facts, stops, error: String(e) })) && false
  }
}

h.stop()
process.exit(ok ? 0 : 1)
