/**
 * What every journey shares: start the bench harness, open a bench, act on it the way a finger does, and keep the
 * evidence (a screenshot per step, the bench's result, every page error) in .verify/runs/<journey>-<time>/.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function playwright() {
  for (const from of [path.join(root, 'package.json'), import.meta.url]) {
    try {
      return createRequire(from)('playwright')
    } catch {
      // try the next place
    }
  }
  throw new Error('Playwright not found: npm i -D playwright && npx playwright install chromium')
}

/** Start the harness (or use VERIFY_URL if one is already running). Returns its URL and a stop(). */
export async function launch(port = Number(process.env.VERIFY_PORT ?? 8765)) {
  if (process.env.VERIFY_URL) return { url: process.env.VERIFY_URL, stop: () => undefined }
  const child = spawn(process.execPath, [path.join(root, 'scripts/verify/bench.mjs'), 'serve', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] })
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('harness did not print READY within 120 s')), 120000)
    child.stdout.on('data', (d) => {
      const m = String(d).match(/READY (\S+)/)
      if (m) {
        clearTimeout(timer)
        resolve(m[1])
      }
    })
    child.on('exit', (code) => reject(new Error(`harness exited with ${code}`)))
  })
  return { url, stop: () => child.kill() }
}

export async function openBench(url, kind, journey) {
  const { chromium } = playwright()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 2 })
  const dir = path.join(root, '.verify/runs', `${journey}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(dir, { recursive: true })
  const log = []
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && log.push(`console: ${m.text()}`))
  await page.goto(`${url}?kind=${kind}`)
  await page.waitForTimeout(400)
  return { browser, page, dir, log, ...helpers(page, dir) }
}

function helpers(page, dir) {
  const box = async (id) => {
    const el = page.getByTestId(id).first()
    await el.scrollIntoViewIfNeeded()
    const b = await el.boundingBox()
    if (!b) throw new Error(`no box for ${id}`)
    return b
  }
  /** A point given in a picture's own units (its viewBox), on screen. */
  const pt = async (id, vw, vh, x, y) => {
    const b = await box(id)
    return { x: b.x + (x / vw) * b.width, y: b.y + (y / vh) * b.height }
  }
  const h = {
    box,
    tap: async (id, vw, vh, x, y) => {
      const a = await pt(id, vw, vh, x, y)
      await page.mouse.click(a.x, a.y)
    },
    drag: async (id, vw, vh, pts, steps = 6) => {
      const a = await pt(id, vw, vh, pts[0][0], pts[0][1])
      await page.mouse.move(a.x, a.y)
      await page.mouse.down()
      for (const [x, y] of pts.slice(1)) {
        const q = await pt(id, vw, vh, x, y)
        await page.mouse.move(q.x, q.y, { steps })
      }
      await page.mouse.up()
    },
    /** Press and hold a control for `ms`. */
    hold: async (id, ms) => {
      const b = await box(id)
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(ms)
      await page.mouse.up()
    },
    /** A short drag across a strip, as a thumb does, finger lifted after: `dx` is a share of its width. */
    swipe: async (id, dx, times = 1) => {
      for (let i = 0; i < times; i++) {
        if (!(await page.getByTestId(id).count())) return
        const b = await box(id)
        const y = b.y + b.height * 0.6
        const x0 = dx > 0 ? b.x + b.width * 0.15 : b.x + b.width * 0.85
        await page.mouse.move(x0, y)
        await page.mouse.down()
        await page.mouse.move(x0 + dx * b.width, y, { steps: 8 })
        await page.mouse.up()
      }
    },
    /** Circle a finger round the first dial on the page. Positive degrees clockwise. */
    twist: async (degrees) => {
      const d = await page.locator('.dial').first().boundingBox()
      const cx = d.x + d.width / 2
      const cy = d.y + d.height / 2
      const r = d.width / 2.6
      await page.mouse.move(cx + r, cy)
      await page.mouse.down()
      const sign = Math.sign(degrees)
      for (let a = 0; a <= Math.abs(degrees); a += 15) {
        const t = (sign * a * Math.PI) / 180
        await page.mouse.move(cx + r * Math.cos(t), cy + r * Math.sin(t))
      }
      await page.mouse.up()
    },
    note: async () => ((await page.getByTestId('io-note').count()) ? page.getByTestId('io-note').innerText() : ''),
    small: async () => page.locator('.io-small').first().innerText().catch(() => ''),
    step: async () => page.locator('.io-steps b').innerText().catch(() => ''),
    shot: async (name) => {
      await page.waitForTimeout(150)
      const y = await page.evaluate(() => window.scrollY)
      await page.screenshot({ path: path.join(dir, `${name}.png`), clip: { x: 0, y, width: 400, height: 900 } })
    },
  }
  return h
}

/** Write what happened and exit 0 only if `ok`. */
export async function finish(ctx, ok, facts) {
  const errors = [...ctx.log, ...((await ctx.page.evaluate(() => window.__errors ?? []).catch(() => [])) ?? [])]
  const verdict = ok && errors.length === 0
  writeFileSync(path.join(ctx.dir, 'result.json'), JSON.stringify({ verdict: verdict ? 'pass' : 'fail', ...facts, errors }, null, 2))
  await ctx.browser.close()
  console.log(`${verdict ? 'PASS' : 'FAIL'} · evidence in ${path.relative(root, ctx.dir)}`)
  if (!verdict) console.log(JSON.stringify({ ...facts, errors }, null, 2))
  return verdict
}
