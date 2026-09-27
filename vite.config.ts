import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Read at build time so no screen has to load every station script:
 * `virtual:station-index` — id, gym, title, type and time of every station and legacy pack (lists);
 * `virtual:station-cards` — each station's flashcards (the tall grass, loaded with the world map).
 * The full scripts stay in their own lazy chunks.
 */
function stationIndex(): Plugin {
  const ids = ['virtual:station-index', 'virtual:station-cards']
  const dir = path.join(root, 'content/stations')
  return {
    name: 'station-index',
    resolveId: (source) => (ids.includes(source) ? `\0${source}` : undefined),
    configureServer(server) {
      // A station added or removed changes the index; edits are caught by the per-file watch below.
      const refresh = (file: string) => {
        if (!path.resolve(file).startsWith(dir)) return
        for (const id of ids) {
          const mod = server.moduleGraph.getModuleById(`\0${id}`)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
    },
    load(resolved) {
      if (!ids.some((id) => resolved === `\0${id}`)) return undefined
      const rows = readdirSync(dir).flatMap((gym) =>
        readdirSync(path.join(dir, gym))
          .filter((f) => f.endsWith('.json'))
          .map((file) => {
            const full = path.join(dir, gym, file)
            this.addWatchFile(full)
            const s = JSON.parse(readFileSync(full, 'utf8'))
            return { id: file.replace(/\.json$/, ''), gym, title: s.title, type: s.type, time: s.time, cards: s.cards ?? [] }
          }),
      )
      const packDir = path.join(root, 'content/packs')
      const packs = readdirSync(packDir).flatMap((folder) => {
        const full = path.join(packDir, folder, 'pack.json')
        this.addWatchFile(full)
        try {
          const p = JSON.parse(readFileSync(full, 'utf8'))
          return [{ id: folder, gym: p.meta?.gym, title: p.title, type: p.meta?.stationType, time: p.meta?.timeLimitSec }]
        } catch {
          return []
        }
      })
      if (resolved === '\0virtual:station-cards') {
        return `export default ${JSON.stringify(rows.map(({ id, gym, cards }) => ({ id, gym, cards })))}`
      }
      return `export default ${JSON.stringify({ stations: rows.map(({ cards: _, ...row }) => row), packs })}`
    },
  }
}

export default defineConfig({
  server: { host: '0.0.0.0', port: 8080, strictPort: true },
  preview: { host: '0.0.0.0', port: 8080, strictPort: true },
  resolve: {
    alias: { '~': path.join(root, 'src') },
  },
  plugins: [stationIndex(), tanstackStart(), nitro(), viteReact(), tailwindcss()],
})
