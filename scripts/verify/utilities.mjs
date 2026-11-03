/**
 * A small stand-in for Tailwind, for the bench harness only: it reads the class names the game uses and writes the
 * CSS for the shapes it knows (spacing, flex and grid, sizes, arbitrary values, colours, borders). The real app is
 * built by Tailwind; this exists so a bench can be driven where Tailwind's native binary will not load.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SPACE = (v) => (v === 'px' ? '1px' : /^\d+(\.\d+)?$/.test(v) ? `${Number(v) * 0.25}rem` : v === 'full' ? '100%' : v === 'auto' ? 'auto' : /^\d+\/\d+$/.test(v) ? `${(eval(v) * 100).toFixed(4)}%` : null)
const ARB = (v) => (v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1).replace(/_/g, ' ') : null)
const VAL = (v) => ARB(v) ?? SPACE(v)

const SIDES = { m: ['margin'], mx: ['margin-left', 'margin-right'], my: ['margin-top', 'margin-bottom'], mt: ['margin-top'], mb: ['margin-bottom'], ml: ['margin-left'], mr: ['margin-right'], p: ['padding'], px: ['padding-left', 'padding-right'], py: ['padding-top', 'padding-bottom'], pt: ['padding-top'], pb: ['padding-bottom'], pl: ['padding-left'], pr: ['padding-right'], top: ['top'], left: ['left'], right: ['right'], bottom: ['bottom'], inset: ['inset'], gap: ['gap'], w: ['width'], h: ['height'], 'min-h': ['min-height'], 'max-w': ['max-width'], 'min-w': ['min-width'], 'max-h': ['max-height'] }

const FIXED = {
  block: 'display:block', hidden: 'display:none', flex: 'display:flex', grid: 'display:grid', contents: 'display:contents', 'inline-block': 'display:inline-block',
  'flex-1': 'flex:1 1 0%', 'flex-col': 'flex-direction:column', 'flex-wrap': 'flex-wrap:wrap', 'items-center': 'align-items:center', 'items-start': 'align-items:flex-start',
  'justify-between': 'justify-content:space-between', 'justify-center': 'justify-content:center', 'self-center': 'align-self:center', 'place-items-center': 'place-items:center',
  absolute: 'position:absolute', relative: 'position:relative', fixed: 'position:fixed', 'overflow-auto': 'overflow:auto', 'overflow-hidden': 'overflow:hidden',
  'select-none': 'user-select:none;-webkit-user-select:none', 'pointer-events-none': 'pointer-events:none', 'text-center': 'text-align:center',
  'leading-none': 'line-height:1', 'leading-tight': 'line-height:1.25', 'leading-snug': 'line-height:1.375', 'aspect-square': 'aspect-ratio:1/1',
  rounded: 'border-radius:0.25rem', 'rounded-md': 'border-radius:0.375rem', 'rounded-full': 'border-radius:9999px', border: 'border-width:1px;border-style:solid',
  'bg-white': 'background-color:#fff', 'max-w-full': 'max-width:100%', 'h-auto': 'height:auto', 'w-full': 'width:100%', 'h-full': 'height:100%',
  'min-h-0': 'min-height:0', 'm-0': 'margin:0', 'mx-auto': 'margin-left:auto;margin-right:auto', '-translate-x-1/2': 'transform:translateX(-50%)',
}

function rule(cls) {
  if (FIXED[cls]) return FIXED[cls]
  let m
  if ((m = cls.match(/^(-?)(m|mx|my|mt|mb|ml|mr|p|px|py|pt|pb|pl|pr|top|left|right|bottom|inset|gap|w|h|min-h|max-w|min-w|max-h)-(.+)$/))) {
    const v = VAL(m[3])
    if (!v) return null
    return SIDES[m[2]].map((prop) => `${prop}:${m[1] ? `calc(${v} * -1)` : v}`).join(';')
  }
  if ((m = cls.match(/^grid-cols-(\d+)$/))) return `grid-template-columns:repeat(${m[1]},minmax(0,1fr))`
  if ((m = cls.match(/^grid-cols-\[(.+)\]$/))) return `grid-template-columns:${m[1].replace(/_/g, ' ')}`
  if ((m = cls.match(/^aspect-\[(.+)\]$/))) return `aspect-ratio:${m[1]}`
  if ((m = cls.match(/^text-\[(#[0-9a-fA-F]+)\]$/))) return `color:${m[1]}`
  if ((m = cls.match(/^text-\[(.+)\]$/))) return `font-size:${m[1]}`
  if ((m = cls.match(/^bg-\[(.+)\]$/))) return `background-color:${m[1]}`
  if ((m = cls.match(/^border-\[(#.+)\]$/))) return `border-color:${m[1]}`
  if ((m = cls.match(/^border-\[(.+)\]$/))) return `border-width:${m[1]};border-style:solid`
  if ((m = cls.match(/^border-(\d+)$/))) return `border-width:${m[1]}px;border-style:solid`
  if ((m = cls.match(/^opacity-(\d+)$/))) return `opacity:${Number(m[1]) / 100}`
  if ((m = cls.match(/^z-(\d+)$/))) return `z-index:${m[1]}`
  if ((m = cls.match(/^font-\[(.+)\]$/))) return `font-family:${m[1].replace(/_/g, ' ')}`
  return null
}

const esc = (cls) => cls.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)

function files(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.(tsx|ts)$/.test(f)) out.push(p)
  }
  return out
}

/** CSS for every utility class the source under `srcDir` uses that this file knows. */
export function utilitiesFor(srcDir) {
  const seen = new Set()
  for (const f of files(srcDir)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      for (const c of (m[1] ?? m[2] ?? '').split(/\s+/)) if (c && !c.includes('$')) seen.add(c)
    }
  }
  const out = []
  for (const c of [...seen].sort()) {
    const r = rule(c)
    if (r) out.push(`.${esc(c)}{${r}}`)
  }
  return out.join('\n')
}
