import { useId, type ReactNode } from 'react'
import { ANATOMY, LEG_LATERAL, LEG_MEDIAL, NEEDLE_MM, type IoCase, type LegFinding, type NeedleColour, type Side } from './case'

/* ================================================================ leg, front view */

function smooth(points: [number, number][]) {
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return d
}

const LEG_PATH = (() => {
  const medial = smooth(LEG_MEDIAL)
  const lateral = smooth([...LEG_LATERAL].reverse()).replace(/^M/, 'L')
  return `${medial} ${lateral} Z`
})()

export const NEEDLE_HEX: Record<NeedleColour, string> = { pink: '#e878a8', blue: '#3a78d8', yellow: '#f0c830' }

/**
 * Anterior view of the knee and upper shin. Drawn as a LEFT leg; a right leg is mirrored.
 * `children` render inside the mirrored group, in left-leg coordinates.
 */
export function LegFront({
  side,
  finding = 'clean',
  xray = false,
  blanket = false,
  dent = null,
  prep = 0,
  wet = false,
  swelling = false,
  children,
}: {
  side: Side
  finding?: LegFinding
  xray?: boolean
  blanket?: boolean
  dent?: { x: number; y: number } | null
  prep?: number
  wet?: boolean
  swelling?: boolean
  children?: ReactNode
}) {
  const id = useId().replace(/:/g, '')
  const g = (name: string) => `${name}-${id}`
  return (
    <svg viewBox="0 0 200 300" className="block h-full w-full" data-testid={`leg-${side}`}>
      <defs>
        <linearGradient id={g('skin')} x1="0" x2="1">
          <stop offset="0" stopColor="#c07e60" />
          <stop offset="0.18" stopColor="#e4ae8c" />
          <stop offset="0.42" stopColor="#f3caa8" />
          <stop offset="0.7" stopColor="#e6b390" />
          <stop offset="1" stopColor="#b8765a" />
        </linearGradient>
        <radialGradient id={g('hi')}>
          <stop offset="0" stopColor="#fbe0c8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fbe0c8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('red')}>
          <stop offset="0" stopColor="#d83838" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#e05050" stopOpacity="0.3" />
          <stop offset="1" stopColor="#e05050" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('swell')}>
          <stop offset="0" stopColor="#fff0e8" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#f0a898" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f0a898" stopOpacity="0" />
        </radialGradient>
        <clipPath id={g('clip')}>
          <path d={LEG_PATH} />
        </clipPath>
      </defs>
      <rect width="200" height="300" fill="#dfe8f0" />
      <path d="M0 40 H200 M0 120 H200 M0 200 H200 M0 280 H200" stroke="#cfdae6" strokeWidth="1" />
      <g transform={side === 'right' ? 'translate(200 0) scale(-1 1)' : undefined}>
        <path d={LEG_PATH} fill={`url(#${g('skin')})`} stroke="#8a5238" strokeWidth="1.2" />
        <g clipPath={`url(#${g('clip')})`}>
          {/* quadriceps tendon and the soft hollows either side of the patella */}
          <path d="M70 60 Q78 88 82 104 M130 60 Q124 88 120 104" stroke="#c98c6c" strokeWidth="1" fill="none" opacity="0.5" />
          <ellipse cx="72" cy="118" rx="12" ry="9" fill="#c98a68" opacity="0.28" />
          <ellipse cx="130" cy="118" rx="12" ry="9" fill="#c98a68" opacity="0.28" />
          {/* patella */}
          <ellipse cx={ANATOMY.patella.x} cy={ANATOMY.patella.y + 3} rx={ANATOMY.patella.rx + 1} ry={ANATOMY.patella.ry} fill="#b87a5a" opacity="0.35" />
          <ellipse cx={ANATOMY.patella.x} cy={ANATOMY.patella.y} rx={ANATOMY.patella.rx} ry={ANATOMY.patella.ry} fill={`url(#${g('hi')})`} />
          {/* patellar tendon */}
          <path d="M92 122 L97 154 M109 122 L110 154" stroke="#c48a6a" strokeWidth="1.1" opacity="0.55" />
          <path d="M100 124 L103 152" stroke="#f6d4b8" strokeWidth="3" opacity="0.55" />
          {/* joint line creases */}
          <path d="M52 129 Q62 132 72 130 M134 130 Q146 132 157 129" stroke="#9a5c40" strokeWidth="1" fill="none" opacity="0.6" />
          {/* tibial tuberosity */}
          <ellipse cx={ANATOMY.tuberosity.x} cy={ANATOMY.tuberosity.y + 2} rx="10" ry="8" fill="#b87a5a" opacity="0.3" />
          <ellipse cx={ANATOMY.tuberosity.x} cy={ANATOMY.tuberosity.y} rx="9" ry="8" fill={`url(#${g('hi')})`} />
          {/* tibial crest, and the broad flat bone medial to it */}
          <path d="M103 168 Q101 230 97 300" stroke="#f8dcc4" strokeWidth="2.2" fill="none" opacity="0.8" />
          <path d="M106 168 Q104 230 100 300" stroke="#b67656" strokeWidth="1" fill="none" opacity="0.45" />
          <path d="M66 170 Q80 162 98 170 L94 300 L70 300 Z" fill="#fbe2cc" opacity="0.18" />
          {/* fibular head */}
          <ellipse cx={ANATOMY.fibulaHead.x} cy={ANATOMY.fibulaHead.y} rx="7" ry="6" fill={`url(#${g('hi')})`} opacity="0.7" />
          {finding === 'cellulitis' && <ellipse cx="92" cy="185" rx="46" ry="52" fill={`url(#${g('red')})`} />}
          {finding === 'fracture' && (
            <>
              <ellipse cx="100" cy="245" rx="52" ry="34" fill="#8a4a6a" opacity="0.22" />
              <path d="M58 225 Q48 245 62 268" stroke="#8a5238" strokeWidth="1.2" fill="none" />
              <path d="M84 238 L112 250" stroke="#7a3a5a" strokeWidth="1" opacity="0.4" />
            </>
          )}
          {prep > 0 && dent && (
            <circle cx={dent.x} cy={dent.y} r={26} fill={wet ? '#e88ab0' : '#d8a0a8'} opacity={(wet ? 0.35 : 0.18) * prep} />
          )}
          {wet && dent && <ellipse cx={dent.x - 6} cy={dent.y - 8} rx="7" ry="3" fill="#ffffff" opacity="0.6" />}
          {swelling && <ellipse cx="88" cy="185" rx="40" ry="46" fill={`url(#${g('swell')})`} />}
          {xray && <Bones />}
        </g>
        {finding === 'old-io' && (
          <g>
            <rect x={ANATOMY.target.x - 8} y={ANATOMY.target.y - 8} width="16" height="16" rx="2" fill="#f8f8f4" stroke="#9aa0a8" />
            <circle cx={ANATOMY.target.x} cy={ANATOMY.target.y} r="2" fill="#b83838" opacity="0.7" />
          </g>
        )}
        {dent && (
          <g>
            <circle cx={dent.x} cy={dent.y} r="3.2" fill="#9a5a40" opacity="0.55" />
            <circle cx={dent.x - 0.8} cy={dent.y - 0.8} r="1.6" fill="#f8d8c0" opacity="0.7" />
          </g>
        )}
        {blanket && (
          <g>
            <path d="M0 150 Q100 132 200 150 L200 300 L0 300 Z" fill="#6a8fc8" />
            <path d="M0 150 Q100 132 200 150" stroke="#46689a" strokeWidth="3" fill="none" />
            <path d="M40 180 Q60 240 50 300 M150 170 Q140 240 160 300" stroke="#587cb4" strokeWidth="2" fill="none" />
          </g>
        )}
        {children}
      </g>
    </svg>
  )
}

/** X-ray view: femur, patella, tibia, fibula. Cortex outlined, marrow shaded. */
function Bones() {
  const bone = '#dce6fa'
  const line = '#4a5f8a'
  const marrow = '#b4c3e6'
  return (
    <g opacity="0.85">
      {/* femur: shaft flaring to medial and lateral condyles, notch between */}
      <path
        d="M84 0 L116 0 L120 58 Q146 76 148 106 Q147 125 128 127 Q112 128 105 119 Q100 113 95 119 Q88 128 72 127 Q53 125 55 106 Q57 76 80 58 Z"
        fill={bone}
        stroke={line}
        strokeWidth="1.2"
      />
      <path d="M88 0 L112 0 L113 56 Q100 62 87 56 Z" fill={marrow} opacity="0.8" />
      {/* tibia: plateau, metaphysis tapering into the shaft */}
      <path
        d="M55 134 Q78 130 100 133 Q124 130 151 134 L149 146 Q141 158 124 167 Q118 176 117 196 L116 300 L84 300 L83 196 Q82 176 76 167 Q60 158 56 147 Z"
        fill={bone}
        stroke={line}
        strokeWidth="1.2"
      />
      <path d="M68 142 Q100 138 138 142 Q134 156 118 164 Q110 176 109 196 L108 300 L92 300 L91 196 Q90 176 82 164 Q70 154 68 142 Z" fill={marrow} opacity="0.85" />
      {/* tibial tuberosity projects forward over the metaphysis */}
      <ellipse cx={ANATOMY.tuberosity.x} cy={ANATOMY.tuberosity.y} rx="8" ry="7" fill="#eef3ff" stroke={line} strokeWidth="1" />
      {/* fibula: head below the lateral plateau, then the shaft */}
      <path d="M143 156 L154 156 L141 300 L134 300 Z" fill={bone} stroke={line} strokeWidth="1" />
      <ellipse cx={ANATOMY.fibulaHead.x} cy={ANATOMY.fibulaHead.y} rx="8" ry="7" fill={bone} stroke={line} strokeWidth="1.2" />
      {/* patella over the femur */}
      <ellipse cx={ANATOMY.patella.x} cy={ANATOMY.patella.y} rx={ANATOMY.patella.rx - 2} ry={ANATOMY.patella.ry - 2} fill="#eef3ff" stroke={line} strokeWidth="1.2" />
    </g>
  )
}

/* ================================================================ cross-section */

const MM = 2
const SKIN_Y = 130

/**
 * Side view through the insertion point. The needle pivots on the skin entry point.
 * `depth` is the tip below the skin in mm (negative above the skin).
 */
export function CrossSection({
  c,
  colour,
  depth,
  angle,
  capOn,
  onDriver,
  styletIn,
  popped,
  coach,
}: {
  c: IoCase
  colour: NeedleColour | null
  depth: number
  angle: number
  capOn: boolean
  onDriver: boolean
  styletIn: boolean
  popped: boolean
  coach: boolean
}) {
  const fat = c.tissueMm * MM
  const cortex = c.cortexMm * MM
  const marrow = c.marrowMm * MM
  const boneTop = SKIN_Y + fat
  const len = colour ? NEEDLE_MM[colour] * MM : 0
  const tipY = SKIN_Y + depth * MM
  const hubY = tipY - len
  return (
    <svg viewBox="0 0 200 260" className="block h-full w-full" data-testid="io-section">
      <rect width="200" height={SKIN_Y} fill="#eef3f8" />
      <rect y={SKIN_Y} width="200" height={fat} fill="#f4dca8" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={10 + ((i * 37) % 180)} cy={SKIN_Y + 4 + ((i * 13) % Math.max(4, fat - 6))} r="3" fill="#ecd096" />
      ))}
      <rect y={SKIN_Y - 2} width="200" height="3" fill="#d89a7a" />
      <rect y={boneTop} width="200" height={cortex} fill="#f4f0e2" stroke="#9a9078" strokeWidth="0.8" />
      <rect y={boneTop + cortex} width="200" height={marrow} fill="#c8625a" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={6 + ((i * 29) % 190)} cy={boneTop + cortex + 4 + ((i * 17) % Math.max(4, marrow - 8))} r="2.2" fill="#e0908a" />
      ))}
      <rect y={boneTop + cortex + marrow} width="200" height={cortex} fill="#f4f0e2" stroke="#9a9078" strokeWidth="0.8" />
      <rect y={boneTop + cortex * 2 + marrow} width="200" height="200" fill="#a84840" />
      {coach && (
        <g fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">
          <text x="4" y={SKIN_Y - 4}>SKIN</text>
          <text x="4" y={SKIN_Y + fat / 2 + 2}>FAT</text>
          <text x="4" y={boneTop + cortex - 1}>CORTEX</text>
          <text x="4" y={boneTop + cortex + 12} fill="#f8e8e0">MARROW</text>
          <line x1="100" y1={SKIN_Y - 70} x2="100" y2={SKIN_Y + 40} stroke="#2f7a3e" strokeDasharray="3 3" strokeWidth="0.8" />
          <text x="104" y={SKIN_Y - 60} fill="#2f7a3e">90°</text>
        </g>
      )}
      {colour && (
        <g transform={`rotate(${angle} 100 ${SKIN_Y})`}>
          {onDriver && (
            <g>
              <rect x="86" y={hubY - 46} width="28" height="40" rx="4" fill="#c83838" stroke="#181820" strokeWidth="1.2" />
              <rect x="94" y={hubY - 8} width="12" height="8" fill="#606874" stroke="#181820" strokeWidth="1" />
              <rect x="112" y={hubY - 30} width="10" height="8" rx="2" fill="#303040" />
            </g>
          )}
          <rect x="95" y={hubY} width="10" height="9" rx="1.5" fill={NEEDLE_HEX[colour]} stroke="#181820" strokeWidth="1" />
          <rect x="98.6" y={hubY + 9} width="2.8" height={len - 9} fill="#c8d0d8" stroke="#606870" strokeWidth="0.5" />
          <rect x="97.6" y={hubY + 5 * MM + 9} width="4.8" height="1.6" fill="#181820" />
          {styletIn && <path d={`M100 ${hubY + 9} L100 ${tipY}`} stroke="#8890a0" strokeWidth="0.8" />}
          <path d={`M98.6 ${tipY - 3} L100 ${tipY + 1} L101.4 ${tipY - 3}`} fill="#c8d0d8" />
          {capOn && <rect x="96.5" y={hubY + 10} width="7" height={len - 8} rx="2" fill="#f0f4ff" opacity="0.75" stroke="#9aa6c0" strokeWidth="0.6" />}
          {popped && depth > c.tissueMm + c.cortexMm && <circle cx="100" cy={tipY} r="4" fill="none" stroke="#f8f0a0" strokeWidth="1.2" />}
        </g>
      )}
    </svg>
  )
}

/** Close-up of the hub at the skin with the tip resting on bone: is a black 5 mm line above the skin? */
export function HubZoom({ colour, tissueMm }: { colour: NeedleColour; tissueMm: number }) {
  const exposed = NEEDLE_MM[colour] - tissueMm
  const scale = 4
  const skinY = 70
  const hubBottom = skinY - Math.max(0, exposed) * scale
  const lineY = hubBottom + 5 * scale
  return (
    <svg viewBox="0 0 120 100" className="block h-full w-full" data-testid="hub-zoom">
      <rect width="120" height="100" fill="#eef3f8" />
      <rect x="54" y={Math.max(4, hubBottom)} width="12" height={skinY - Math.max(4, hubBottom)} fill="#c8d0d8" stroke="#606870" strokeWidth="0.6" />
      {lineY < skinY && <rect x="52" y={lineY} width="16" height="3" fill="#181820" />}
      <rect x="46" y={Math.max(0, hubBottom - 14)} width="28" height="14" rx="2" fill={NEEDLE_HEX[colour]} stroke="#181820" />
      <rect y={skinY} width="120" height="30" fill="#e8b494" />
      <rect y={skinY} width="120" height="3" fill="#c07e60" />
    </svg>
  )
}

/* ================================================================ calf cross-section (positioning) */

/** Transverse slice through the upper calf. The tibia is at the top, just under the skin. */
export function CalfSlice({ towel, gloves, medial, lateral, behind }: { towel: boolean; gloves: boolean; medial: boolean; lateral: boolean; behind: boolean }) {
  const hand = gloves ? '#88c8f0' : '#f0c8a0'
  return (
    <svg viewBox="0 0 200 160" className="block h-full w-full" data-testid="calf-slice">
      <rect width="200" height="160" fill="#dfe8f0" />
      <rect y="136" width="200" height="24" fill="#c8d4e0" />
      {towel && <rect x="46" y="118" width="108" height="22" rx="11" fill="#58a868" stroke="#2f6a3e" />}
      <ellipse cx="100" cy="80" rx="52" ry="42" fill="#e6b08e" stroke="#8a5238" strokeWidth="1.2" />
      <ellipse cx="100" cy="88" rx="44" ry="30" fill="#b85a50" opacity="0.55" />
      <path d="M84 46 L116 46 L110 72 L90 72 Z" fill="#f4f0e2" stroke="#8a8068" />
      <circle cx="136" cy="80" r="7" fill="#f4f0e2" stroke="#8a8068" />
      <text x="72" y="36" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">FRONT</text>
      <text x="4" y="84" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">MED</text>
      <text x="172" y="84" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">LAT</text>
      {medial && <rect x="30" y="56" width="20" height="40" rx="8" fill={hand} stroke="#181820" />}
      {lateral && <rect x="150" y="56" width="20" height="40" rx="8" fill={hand} stroke="#181820" />}
      {behind && <rect x="80" y="118" width="40" height="18" rx="8" fill={hand} stroke="#b83838" strokeWidth="2" />}
    </svg>
  )
}

/* ================================================================ kit, pixel art */

type PixProps = { size?: number }

function Pix({ w, h, size = 40, children }: { w: number; h: number; size?: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" className="block">
      {children}
    </svg>
  )
}

export function DriverArt({ size, needle }: PixProps & { needle?: NeedleColour | null }) {
  return (
    <Pix w={24} h={20} size={size}>
      <rect x="2" y="3" width="14" height="8" fill="#181820" />
      <rect x="3" y="4" width="12" height="6" fill="#d84040" />
      <rect x="4" y="4" width="10" height="2" fill="#f07070" />
      <rect x="7" y="10" width="6" height="9" fill="#181820" />
      <rect x="8" y="10" width="4" height="8" fill="#404850" />
      <rect x="13" y="11" width="2" height="3" fill="#f0c830" />
      <rect x="16" y="5" width="3" height="4" fill="#808890" />
      {needle && (
        <>
          <rect x="19" y="5" width="2" height="4" fill={NEEDLE_HEX[needle]} />
          <rect x="21" y="6" width="3" height="2" fill="#c8d0d8" />
        </>
      )}
    </Pix>
  )
}

export function NeedleCaseArt({ size, colour }: PixProps & { colour: NeedleColour }) {
  return (
    <Pix w={12} h={20} size={size}>
      <rect x="2" y="1" width="8" height="18" fill="#181820" />
      <rect x="3" y="2" width="6" height="16" fill="#e8f0f8" />
      <rect x="4" y="3" width="4" height="4" fill={NEEDLE_HEX[colour]} />
      <rect x="5" y="7" width="2" height={colour === 'pink' ? 5 : colour === 'blue' ? 7 : 10} fill="#9098a8" />
    </Pix>
  )
}

export function SyringeArt({ size, fill = 'empty', label }: PixProps & { fill?: 'empty' | 'saline' | 'lido' | 'marrow'; label?: string }) {
  const liquid = fill === 'saline' ? '#b8dcf8' : fill === 'lido' ? '#d8f0c8' : fill === 'marrow' ? '#c84848' : null
  return (
    <Pix w={24} h={10} size={size}>
      <rect x="0" y="4" width="3" height="2" fill="#9098a8" />
      <rect x="3" y="2" width="14" height="6" fill="#181820" />
      <rect x="4" y="3" width="12" height="4" fill="#f4f8fc" />
      {liquid && <rect x="4" y="3" width="8" height="4" fill={liquid} />}
      <rect x="17" y="4" width="4" height="2" fill="#606874" />
      <rect x="21" y="2" width="2" height="6" fill="#181820" />
      {label && <title>{label}</title>}
    </Pix>
  )
}

export function VialArt({ size, kind }: PixProps & { kind: 'plain2' | 'adr1' }) {
  return (
    <Pix w={10} h={16} size={size}>
      <rect x="3" y="0" width="4" height="3" fill={kind === 'plain2' ? '#3a78d8' : '#d84040'} />
      <rect x="2" y="3" width="6" height="12" fill="#181820" />
      <rect x="3" y="4" width="4" height="10" fill="#eef6fa" />
      <rect x="3" y="7" width="4" height="4" fill={kind === 'plain2' ? '#7ab0f0' : '#f09090'} />
    </Pix>
  )
}

export function ExtensionArt({ size, primed }: PixProps & { primed?: boolean }) {
  const tube = primed ? '#a8d4f8' : '#f0f4f8'
  return (
    <Pix w={24} h={14} size={size}>
      <rect x="0" y="5" width="4" height="4" fill="#606874" />
      <path d="M4 7 h4 v-4 h6 v8 h6 v-4 h2" stroke="#181820" strokeWidth="3" fill="none" />
      <path d="M4 7 h4 v-4 h6 v8 h6 v-4 h2" stroke={tube} strokeWidth="1.4" fill="none" />
      <rect x="12" y="1" width="4" height="3" fill="#e8b030" />
      <rect x="21" y="5" width="3" height="4" fill="#606874" />
    </Pix>
  )
}

export function StabilizerArt({ size }: PixProps) {
  return (
    <Pix w={16} h={16} size={size}>
      <rect x="1" y="3" width="14" height="10" fill="#181820" />
      <rect x="2" y="4" width="12" height="8" fill="#e8f4ec" />
      <rect x="6" y="6" width="4" height="4" fill="#78b890" />
      <rect x="7" y="7" width="2" height="2" fill="#181820" />
    </Pix>
  )
}

export function ViseArt({ size }: PixProps) {
  return (
    <Pix w={16} h={12} size={size}>
      <rect x="1" y="2" width="14" height="9" fill="#181820" />
      <rect x="2" y="3" width="12" height="7" fill="#f0c830" />
      <rect x="6" y="3" width="4" height="3" fill="#181820" />
    </Pix>
  )
}

export function SwabArt({ size }: PixProps) {
  return (
    <Pix w={20} h={10} size={size}>
      <rect x="0" y="3" width="12" height="4" fill="#181820" />
      <rect x="1" y="4" width="10" height="2" fill="#f0f0f0" />
      <rect x="12" y="1" width="7" height="8" fill="#181820" />
      <rect x="13" y="2" width="5" height="6" fill="#f08840" />
    </Pix>
  )
}

export function TowelArt({ size }: PixProps) {
  return (
    <Pix w={20} h={10} size={size}>
      <rect x="1" y="2" width="18" height="7" fill="#2f6a3e" />
      <rect x="2" y="3" width="16" height="5" fill="#58a868" />
      <rect x="4" y="3" width="1" height="5" fill="#78c888" />
      <rect x="9" y="3" width="1" height="5" fill="#78c888" />
      <rect x="14" y="3" width="1" height="5" fill="#78c888" />
    </Pix>
  )
}

export function GloveArt({ size }: PixProps) {
  return (
    <Pix w={14} h={16} size={size}>
      <rect x="2" y="3" width="10" height="12" fill="#181820" />
      <rect x="3" y="6" width="8" height="8" fill="#88c8f0" />
      <rect x="3" y="3" width="2" height="4" fill="#88c8f0" />
      <rect x="6" y="1" width="2" height="6" fill="#181820" />
      <rect x="6" y="2" width="2" height="4" fill="#88c8f0" />
      <rect x="9" y="3" width="2" height="4" fill="#88c8f0" />
    </Pix>
  )
}

export function HandArt({ size, gloved }: PixProps & { gloved?: boolean }) {
  const c = gloved ? '#88c8f0' : '#f0c8a0'
  return (
    <Pix w={14} h={16} size={size}>
      <rect x="2" y="5" width="10" height="10" fill="#181820" />
      <rect x="3" y="6" width="8" height="8" fill={c} />
      {[3, 5, 7, 9].map((x) => (
        <g key={x}>
          <rect x={x} y="1" width="2" height="6" fill="#181820" />
          <rect x={x} y="2" width="1" height="5" fill={c} />
        </g>
      ))}
    </Pix>
  )
}

export function WristbandArt({ size }: PixProps) {
  return (
    <Pix w={20} h={8} size={size}>
      <rect x="0" y="2" width="20" height="5" fill="#181820" />
      <rect x="1" y="3" width="18" height="3" fill="#f090b8" />
      <rect x="7" y="3" width="6" height="3" fill="#f8f8f8" />
    </Pix>
  )
}

export function PressureBagArt({ size }: PixProps) {
  return (
    <Pix w={16} h={20} size={size}>
      <rect x="2" y="1" width="12" height="15" fill="#181820" />
      <rect x="3" y="2" width="10" height="13" fill="#3a78d8" />
      <rect x="5" y="4" width="6" height="8" fill="#e8f4fc" />
      <rect x="7" y="16" width="2" height="3" fill="#181820" />
      <rect x="11" y="16" width="4" height="4" fill="#606874" />
    </Pix>
  )
}
