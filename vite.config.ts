import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  server: { host: '0.0.0.0', port: 8080, strictPort: true },
  preview: { host: '0.0.0.0', port: 8080, strictPort: true },
  resolve: {
    alias: { '~': path.join(root, 'src') },
  },
  plugins: [tanstackStart(), nitro(), viteReact(), tailwindcss()],
})
