#!/usr/bin/env node
/** Open every hands-on bench and prove it renders with no page error. node scripts/verify/journeys/smoke.mjs */
import { finish, launch, openBench } from '../lib.mjs'

const h = await launch()
let ok = true
const facts = { benches: {} }
try {
  const first = await openBench(h.url, 'cvc', 'smoke')
  const kinds = await first.page.evaluate(() => window.__kinds)
  await first.browser.close()
  for (const kind of kinds) {
    const ctx = await openBench(h.url, kind, `smoke-${kind}`)
    await ctx.page.waitForTimeout(kind === 'positional' ? 4000 : 600)
    const rendered = (await ctx.page.getByTestId('verify-missing').count()) === 0 && (await ctx.page.locator('#root *').count()) > 5
    await ctx.shot('open')
    const pass = await finish(ctx, rendered, { kind, rendered })
    facts.benches[kind] = pass
    ok &&= pass
  }
} finally {
  h.stop()
}
console.log(Object.entries(facts.benches).map(([k, v]) => `${v ? 'ok  ' : 'FAIL'} ${k}`).join('\n'))
process.exit(ok ? 0 : 1)
