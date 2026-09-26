import { useId, type ReactNode } from 'react'
import type { BackSite, FrontSite, Lead } from './model'
import { BACK_PAD, FRONT } from './model'

const TORSO = 'M40 0 L160 0 Q196 8 200 40 L200 240 L0 240 L0 40 Q4 8 40 0 Z'

function Skin({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`skin-${id}`} x1="0" x2="1">
        <stop offset="0" stopColor="#c08060" />
        <stop offset="0.2" stopColor="#e4ae8c" />
        <stop offset="0.5" stopColor="#f0c4a2" />
        <stop offset="0.8" stopColor="#e4ae8c" />
        <stop offset="1" stopColor="#c08060" />
      </linearGradient>
    </defs>
  )
}

export function Pad({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-17" y="-22" width="34" height="44" rx="6" fill="#e8ecf2" stroke="#181820" strokeWidth="1.2" />
      <rect x="-12" y="-16" width="24" height="32" rx="4" fill="#9aa6b8" />
      <path d="M0 -22 Q0 -34 14 -40" stroke="#d03838" strokeWidth="3" fill="none" />
    </g>
  )
}

function Electrode({ x, y, colour }: { x: number; y: number; colour: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="7" fill="#f8f8f8" stroke="#181820" />
      <circle cx={x} cy={y} r="2.5" fill={colour} />
    </g>
  )
}

export const LEAD_COLOUR: Record<Lead, string> = { ra: '#f8f8f8', la: '#181820', ll: '#d03838' }

/** Anterior chest, supine. The patient's left is on the viewer's right. */
export function ChestFront({
  sweaty,
  hairy,
  dried,
  clipped,
  leads,
  pads,
  twitch = false,
  children,
}: {
  sweaty: boolean
  hairy: boolean
  dried: boolean
  clipped: boolean
  leads: Partial<Record<Lead, { x: number; y: number }>>
  pads: { site: FrontSite; x: number; y: number }[]
  twitch?: boolean
  children?: ReactNode
}) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 200 240" className="block h-full w-full" data-testid="chest-front">
      <Skin id={id} />
      <rect width="200" height="240" fill="#dfe8f0" />
      <g transform={twitch ? 'translate(0 -1.5)' : undefined}>
        <path d={TORSO} fill={`url(#skin-${id})`} stroke="#8a5238" strokeWidth="1.2" />
        {/* neck, clavicles, sternum, pecs, costal margins, umbilicus */}
        <path d="M78 0 Q100 14 122 0" fill="#d89c7a" opacity="0.6" />
        <path d="M30 26 Q64 18 94 26 M106 26 Q136 18 170 26" stroke="#b87a5a" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M100 28 L100 150" stroke="#b87a5a" strokeWidth="1.5" opacity="0.6" />
        <path d="M34 110 Q64 124 92 104 M108 104 Q136 124 166 110" stroke="#b87a5a" strokeWidth="1.4" fill="none" opacity="0.55" />
        <circle cx="62" cy="104" r="3.5" fill="#b86a58" />
        <circle cx="138" cy="104" r="3.5" fill="#b86a58" />
        <path d="M100 150 Q70 164 44 196 M100 150 Q130 164 156 196" stroke="#b87a5a" strokeWidth="1.2" fill="none" opacity="0.5" />
        <ellipse cx="100" cy="226" rx="3" ry="4" fill="#9a5c40" />
        {hairy && !clipped && (
          <g stroke="#3a2820" strokeWidth="0.8" opacity="0.75">
            {Array.from({ length: 70 }, (_, i) => {
              const x = 60 + ((i * 37) % 80)
              const y = 50 + ((i * 23) % 110)
              return <path key={i} d={`M${x} ${y} l${(i % 3) - 1} 3`} />
            })}
          </g>
        )}
        {sweaty && !dried && (
          <g fill="#ffffff" opacity="0.75">
            {Array.from({ length: 26 }, (_, i) => (
              <ellipse key={i} cx={30 + ((i * 53) % 140)} cy={30 + ((i * 31) % 180)} rx="1.6" ry="2.4" />
            ))}
          </g>
        )}
        {(Object.keys(leads) as Lead[]).map((lead) => {
          const p = leads[lead]!
          return <Electrode key={lead} x={p.x} y={p.y} colour={LEAD_COLOUR[lead]} />
        })}
        {pads.map((p, i) => (
          <Pad key={i} x={p.x} y={p.y} rot={p.site === 'alApex' ? -20 : 0} />
        ))}
      </g>
      {children}
    </svg>
  )
}

/** The back, patient rolled onto the right side. The patient's left is on the viewer's left. */
export function ChestBack({ pad, children }: { pad: { site: BackSite; x: number; y: number } | null; children?: ReactNode }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 200 240" className="block h-full w-full" data-testid="chest-back">
      <Skin id={id} />
      <rect width="200" height="240" fill="#dfe8f0" />
      <path d={TORSO} fill={`url(#skin-${id})`} stroke="#8a5238" strokeWidth="1.2" />
      <path d="M100 6 L100 236" stroke="#b87a5a" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
      <path d="M50 40 L88 46 L80 108 L56 96 Z" fill="#d49a78" opacity="0.5" stroke="#b87a5a" />
      <path d="M150 40 L112 46 L120 108 L144 96 Z" fill="#d49a78" opacity="0.5" stroke="#b87a5a" />
      <text x="8" y="232" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#40404c">
        HIS LEFT
      </text>
      <text x="136" y="232" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#40404c">
        HIS RIGHT
      </text>
      {pad && <Pad x={pad.x} y={pad.y} />}
      {children}
    </svg>
  )
}

/** Faint target rings for practice mode, drawn on the chest. */
export function Targets({ view }: { view: 'front' | 'back' }) {
  const rings = view === 'back' ? [BACK_PAD] : [FRONT.apPad, FRONT.alSternal, FRONT.alApex]
  return (
    <g fill="none" stroke="#2f7a3e" strokeDasharray="3 3" strokeWidth="1">
      {rings.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} />
      ))}
    </g>
  )
}

const DRAWERS: { drug: 'atropine' | 'calcium' | 'fentanyl' | 'ketamine' | 'midazolam'; label: string; colour: string }[] = [
  { drug: 'atropine', label: 'ATROPINE', colour: '#58a868' },
  { drug: 'calcium', label: 'CALCIUM GLUC', colour: '#f8f8f8' },
  { drug: 'fentanyl', label: 'FENTANYL', colour: '#3a78d8' },
  { drug: 'ketamine', label: 'KETAMINE', colour: '#e8b030' },
  { drug: 'midazolam', label: 'MIDAZOLAM', colour: '#9058c8' },
]

/** The resus drug cart, drawers labelled. Tap a drawer to take that drug. */
export function DrugCartArt({ selected, onPick }: { selected: string | null; onPick: (d: (typeof DRAWERS)[number]['drug']) => void }) {
  return (
    <svg viewBox="0 0 150 100" className="block h-full w-full" data-testid="cart-art" shapeRendering="crispEdges">
      <rect width="150" height="100" fill="#dfe8f0" />
      <rect x="10" y="4" width="130" height="10" fill="#181820" />
      <rect x="12" y="6" width="126" height="6" fill="#d84848" />
      <rect x="10" y="14" width="130" height="78" fill="#181820" />
      <rect x="12" y="16" width="126" height="74" fill="#c83838" />
      {DRAWERS.map((d, i) => {
        const y = 18 + i * 14
        const on = selected === d.drug
        return (
          <g key={d.drug} onClick={() => onPick(d.drug)} style={{ cursor: 'pointer' }} data-testid={`drawer-${d.drug}`}>
            <rect x="16" y={y} width="118" height="12" fill={on ? '#fff0a0' : '#f0e0d8'} stroke="#181820" strokeWidth="1" />
            <rect x="20" y={y + 3} width="8" height="6" fill={d.colour} stroke="#181820" strokeWidth="0.6" />
            <text x="32" y={y + 8.5} fontFamily="Press Start 2P, monospace" fontSize="5" fill="#181820">
              {d.label}
            </text>
            <rect x="118" y={y + 4} width="10" height="3" fill="#606874" />
          </g>
        )
      })}
      <rect x="16" y="92" width="10" height="6" fill="#181820" />
      <rect x="124" y="92" width="10" height="6" fill="#181820" />
    </svg>
  )
}
