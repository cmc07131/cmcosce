#!/usr/bin/env node
/**
 * The bench harness: one hands-on procedure bench on its own page, served for Playwright to drive.
 *
 *   node scripts/verify/bench.mjs doctor          is this checkout worth driving?
 *   node scripts/verify/bench.mjs build           bundle every bench into .verify/bench/
 *   node scripts/verify/bench.mjs serve [port]    build, then serve it (default 8765); prints READY <url>
 *
 * Open <url>/?kind=cvc to get the central line bench, or <url>/?exam=ot/ot-hip for a station's 3D examination. The page puts the bench's result in window.__result and
 * every uncaught error in window.__errors. It uses the game's own components (src/game/procedures.ts) and its own
 * stylesheet; only Tailwind's utilities are stood in for (scripts/verify/utilities.mjs).
 */
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { utilitiesFor } from './utilities.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = path.join(root, '.verify/bench')
const require = createRequire(path.join(root, 'package.json'))

const ENTRY = `import { createRoot } from 'react-dom/client'
import { Suspense, lazy } from 'react'
import { PROCEDURES } from '../src/game/procedures'
import { compileStation, stationSchema } from '../src/engine/station'
const Exam3D = lazy(() => import('../src/game/exam3d/Exam3D'))
const w = window as any
w.__errors = []
w.addEventListener('error', (e: ErrorEvent) => w.__errors.push(String(e.message)))
w.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => w.__errors.push(String(e.reason)))
const params = new URLSearchParams(location.search)
const kind = params.get('kind') ?? 'cvc'
const exam = params.get('exam')
const Bench = (PROCEDURES as any)[kind]
const job = { actionId: 'verify', spendId: 'verify', kind, hint: '', label: kind, reply: '', grantMarks: Array.from({ length: 12 }, (_, i) => 'm' + (i + 1)), grantItems: [], scene: 'done', endStation: false }
w.__result = null
w.__kinds = Object.keys(PROCEDURES)
w.__picked = []
const root = createRoot(document.getElementById('root')!)
if (exam) {
  // A station's 3D examination (?exam=ot/ot-hip): the station compiled as the game does, its exam step opened.
  fetch('/content/stations/' + exam + '.json')
    .then((r) => r.json())
    .then((json) => {
      const pack = compileStation(stationSchema.parse(json)) as any
      const action = pack.actions.find((a: any) => a.kind === 'exam')
      w.__options = (action?.options ?? []).map((o: any) => ({ id: o.id, label: o.label }))
      root.render(
        <div data-testid="verify-frame" style={{ position: 'relative', width: 400, height: 860 }}>
          <Suspense fallback={<p>loading</p>}>
            <Exam3D pack={pack} action={action} title={json.title} spent={[]} onClose={() => undefined} onOption={(id: string) => w.__picked.push(id)} />
          </Suspense>
        </div>,
      )
    })
    .catch((e) => w.__errors.push(String(e)))
} else root.render(
  Bench ? (
    <div className="battle" data-testid="verify-frame" style={{ position: 'relative', width: 400, minHeight: 900, display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<p>loading</p>}>
        <Bench job={job} coach onDone={(r: unknown) => (w.__result = r)} />
      </Suspense>
    </div>
  ) : (
    <p data-testid="verify-missing">No bench called {kind}. Benches: {Object.keys(PROCEDURES).join(', ')}</p>
  ),
)
`

/** The game's stylesheet without Tailwind's own directives, the fonts copied beside it, Tailwind's utilities stood in. */
function css() {
  let s = readFileSync(path.join(root, 'src/styles/app.css'), 'utf8')
  s = s.replace(/^@import ['"]tailwindcss['"];?\s*$/m, '').replace(/^@import ['"]@fontsource[^\n]*$/gm, '')
  s = s.replace(/@theme\s*\{[\s\S]*?\n\}/, (block) => `:root {${block.replace(/@theme\s*\{/, '').replace(/\}$/, '')}}`)
  mkdirSync(path.join(out, 'fonts'), { recursive: true })
  const fonts = [
    ['Press Start 2P', '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2', 'ps.woff2'],
    ['VT323', '@fontsource/vt323/files/vt323-latin-400-normal.woff2', 'vt.woff2'],
  ]
  let faces = ''
  for (const [family, mod, file] of fonts) {
    try {
      copyFileSync(require.resolve(mod), path.join(out, 'fonts', file))
      faces += `@font-face{font-family:'${family}';src:url(fonts/${file}) format('woff2')}\n`
    } catch {
      // A missing font only changes how text looks.
    }
  }
  return `${faces}${s}\n/* utilities stood in for Tailwind */\n${utilitiesFor(path.join(root, 'src'))}\nbody{margin:0;background:#202020}\n`
}

function build() {
  mkdirSync(out, { recursive: true })
  const entry = path.join(root, '.verify/entry.tsx')
  writeFileSync(entry, ENTRY)
  const esbuild = path.join(root, 'node_modules/.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild')
  const r = spawnSync(esbuild, [entry, '--bundle', `--outfile=${path.join(out, 'bundle.js')}`, '--jsx=automatic', '--loader:.woff2=file', '--loader:.woff=file', (process.env.VERIFY_DEV ? '--define:import.meta.env.DEV=true' : '--define:import.meta.env.DEV=false'), '--define:process.env.NODE_ENV="production"', `--alias:~=${path.join(root, 'src')}`, '--log-level=warning'], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) {
    console.error('BUILD FAILED')
    process.exit(1)
  }
  writeFileSync(path.join(out, 'app.css'), css())
  writeFileSync(path.join(out, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>')
  console.log(`BUILT ${out}`)
}

function serve(port) {
  build()
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary', '.vrm': 'model/gltf-binary', '.webp': 'image/webp', '.fbx': 'application/octet-stream' }
  createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)
    // The harness's own files first, then the app's public folder (3D models, images), as the app serves them; the
    // station scripts under /content/.
    const p = [path.join(out, rel), path.join(root, 'public', rel), rel.startsWith('/content/') ? path.join(root, rel) : ''].find(
      (f) => f && (f.startsWith(out) || f.startsWith(path.join(root, 'public')) || f.startsWith(path.join(root, 'content'))) && existsSync(f) && statSync(f).isFile(),
    )
    if (!p) {
      res.writeHead(404)
      return res.end()
    }
    res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' })
    res.end(readFileSync(p))
  }).listen(port, '127.0.0.1', () => console.log(`READY http://127.0.0.1:${port}/`))
}

function doctor() {
  const checks = [
    ['node_modules installed', existsSync(path.join(root, 'node_modules/react'))],
    ['esbuild runs on this platform', spawnSync(path.join(root, 'node_modules/.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild'), ['--version'], { shell: process.platform === 'win32' }).status === 0],
    ['playwright resolvable', (() => { try { require.resolve('playwright'); return true } catch { try { createRequire(import.meta.url).resolve('playwright'); return true } catch { return false } } })()],
  ]
  for (const [name, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (checks.some(([, ok]) => !ok)) {
    console.log('Fix: npm install; for Playwright: npm i -D playwright && npx playwright install chromium')
    process.exit(1)
  }
}

const [cmd = 'doctor', arg] = process.argv.slice(2)
if (cmd === 'build') build()
else if (cmd === 'serve') serve(Number(arg ?? 8765))
else doctor()
