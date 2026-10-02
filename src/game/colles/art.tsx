import type { ReactNode, Ref } from 'react'
import type { Slab } from './model'

const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

/* ---------------------------------------------------------------- the hand, palm up or palm down */

/** Mrs Wu's right hand and wrist, fingers up. Palm up the thumb is on your right; palm down, on your left. */
export const HAND_SITES = {
  palm: {
    pulse: { x: 126, y: 116, r: 11 },
    median: { x: 112, y: 14, r: 10 },
    thumb: { x: 150, y: 58, r: 12 },
  },
  back: {
    nail: { x: 88, y: 16, r: 12 },
    dorsum: { x: 100, y: 112, r: 34 },
  },
} as const

export function HandView({ side, svgRef, ulnar = 0, swollen = true, children, pulse }: { side: 'palm' | 'back'; svgRef?: Ref<SVGSVGElement>; ulnar?: number; swollen?: boolean; children?: ReactNode; pulse?: { x: number; y: number; key: number } | null }) {
  const flip = side === 'back' ? 'translate(200 0) scale(-1 1)' : undefined
  // Ulnar deviation tips the hand toward the little finger side about the wrist.
  const dev = side === 'palm' ? -ulnar * 14 : ulnar * 14
  return (
    <svg ref={svgRef} viewBox="0 0 200 170" className="block h-full w-full select-none" data-testid={`colles-hand-${side}`}>
      <rect width="200" height="170" fill="#eef2f4" />
      <g transform={flip}>
        {/* forearm */}
        <path d="M72 170 L76 112 L124 112 L130 170 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
        {swollen && <ellipse cx="100" cy="112" rx="32" ry="12" fill={SKIN} stroke={SKIN_EDGE} strokeDasharray="2 2" />}
        <g transform={`rotate(${dev} 100 108)`}>
          {/* palm */}
          <path d="M74 110 Q70 80 76 56 L128 56 Q134 80 126 110 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
          {/* fingers: little, ring, middle, index (index next to the thumb) */}
          {[
            [80, 58, 30],
            [93, 56, 40],
            [106, 56, 44],
            [119, 57, 40],
          ].map(([x, y, h]) => (
            <g key={x}>
              <rect x={x - 6} y={y - h} width="12" height={h + 4} rx="6" fill={SKIN} stroke={SKIN_EDGE} />
              {side === 'back' && <rect x={x - 4} y={y - h + 2} width="8" height="8" rx="2" fill="#f0c8c0" stroke={SKIN_EDGE} strokeWidth="0.6" />}
            </g>
          ))}
          {/* thumb */}
          <path d="M126 96 Q146 84 152 60 Q156 50 148 48 Q140 50 136 66 Q130 82 124 86 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
          {side === 'palm' && <path d="M84 96 Q100 84 120 92" stroke={SKIN_EDGE} strokeWidth="0.8" fill="none" opacity="0.5" />}
        </g>
      </g>
      <text x="4" y="10" fontFamily={FONT} fontSize="5" fill="#40404c">
        R HAND · {side === 'palm' ? 'PALM UP' : 'PALM DOWN'}
      </text>
      {pulse && <circle key={pulse.key} cx={pulse.x} cy={pulse.y} r="7" fill="none" stroke="#d03030" strokeWidth="2" className="hare-pulse" />}
      {children}
    </svg>
  )
}

/* ---------------------------------------------------------------- the wrist from the side */

/**
 * The forearm from the radial side: elbow on the left, fingers on the right, the dorsum on top. The distal radial
 * fragment and the hand hinge at the volar cortex of the fracture (x 200): dorsal tilt lifts them, shortening
 * pulls them back. `xray` shows the bones on a dark film.
 */
export const LAT = { fracture: 200, hingeY: 78, dorsalY: 54 }

export function LateralView({
  tilt,
  short,
  xray = false,
  needleX = null,
  counter = false,
  traction = 0,
  slab = null,
  moulded = 0,
  svgRef,
  children,
}: {
  tilt: number
  short: number
  xray?: boolean
  needleX?: number | null
  counter?: boolean
  traction?: number
  slab?: Slab | null
  moulded?: number
  svgRef?: Ref<SVGSVGElement>
  children?: ReactNode
}) {
  const skin = xray ? '#2a3038' : SKIN
  const edge = xray ? '#4a5260' : SKIN_EDGE
  const bone = xray ? '#e8eef4' : '#f4f0e2'
  const dx = -short * 2.4
  const distal = `translate(${dx} 0) rotate(${-tilt} ${LAT.fracture} ${LAT.hingeY})`
  return (
    <svg ref={svgRef} viewBox="0 0 300 130" className="block h-full w-full select-none" data-testid="colles-lateral">
      <rect width="300" height="130" fill={xray ? '#101418' : '#eef2f4'} />
      {/* forearm up to the fracture */}
      <path d={`M0 50 L${LAT.fracture} 52 L${LAT.fracture} 84 L0 88 Z`} fill={skin} stroke={edge} strokeWidth="1.5" />
      <rect x="0" y="62" width={LAT.fracture} height="14" fill={bone} opacity={xray ? 1 : 0.0} />
      {/* distal fragment, wrist and hand */}
      <g transform={distal}>
        <path d={`M${LAT.fracture - 2} 52 Q232 50 244 56 L296 62 Q300 70 296 76 L244 82 Q232 86 ${LAT.fracture - 2} 84 Z`} fill={skin} stroke={edge} strokeWidth="1.5" />
        <rect x={LAT.fracture} y="62" width="22" height="16" fill={bone} opacity={xray ? 1 : 0} />
        {xray && (
          <g fill={bone} opacity="0.85">
            <circle cx="232" cy="68" r="6" />
            <circle cx="244" cy="70" r="5" />
            <rect x="252" y="64" width="40" height="7" rx="3" />
          </g>
        )}
      </g>
      {/* the dorsal bump of the dinner fork, visible on the skin */}
      {!xray && tilt > 12 && <ellipse cx={LAT.fracture + 2} cy={52} rx="12" ry={3 + (tilt - 12) / 6} fill={SKIN} stroke={SKIN_EDGE} strokeDasharray="2 2" />}
      {/* tilt line on the film */}
      {xray && (
        <g stroke="#f8d030" strokeWidth="1" fill="none">
          <line x1="120" y1="70" x2={LAT.fracture} y2="70" strokeDasharray="3 2" />
          <path d={`M${LAT.fracture + dx} 70 l${36 * Math.cos((tilt * Math.PI) / 180)} ${-36 * Math.sin((tilt * Math.PI) / 180)}`} />
        </g>
      )}
      {/* slab */}
      {slab && (
        <g opacity="0.92">
          {slab === 'full-cast' ? (
            <rect x="30" y="46" width="232" height="44" rx="6" fill="#f8f8f4" stroke="#a0a0a0" />
          ) : slab === 'volar-be' ? (
            <rect x="30" y="82" width="232" height="8" fill="#f8f8f4" stroke="#a0a0a0" />
          ) : (
            <rect x={slab === 'above-elbow' ? 0 : 30} y="44" width={slab === 'above-elbow' ? 262 : 232} height="9" fill="#f8f8f4" stroke="#a0a0a0" />
          )}
          {moulded > 0 && <text x="120" y="42" fontFamily={FONT} fontSize="5" fill="#40404c">MOULD {Math.round(moulded * 100)}%</text>}
        </g>
      )}
      {/* needle */}
      {needleX !== null && (
        <g>
          <line x1={needleX} y1="18" x2={needleX + 4} y2="64" stroke="#8890a0" strokeWidth="1.6" />
          <rect x={needleX - 4} y="6" width="10" height="14" fill="#cfe4ff" stroke="#505868" />
        </g>
      )}
      {/* hands: the assistant at the elbow, yours at the hand */}
      {counter && (
        <g>
          <ellipse cx="18" cy="46" rx="12" ry="6" fill="#d8a080" stroke="#6a3a20" />
          <ellipse cx="18" cy="92" rx="12" ry="6" fill="#d8a080" stroke="#6a3a20" />
          <text x="4" y="122" fontFamily={FONT} fontSize="5" fill={xray ? '#c0c8d0' : '#6a3a20'}>
            ASSISTANT
          </text>
        </g>
      )}
      {traction > 0.05 && (
        <g transform={distal}>
          <ellipse cx="276" cy="58" rx="12" ry="6" fill="#c89070" stroke="#6a3a20" />
          <ellipse cx="276" cy="80" rx="12" ry="6" fill="#c89070" stroke="#6a3a20" />
        </g>
      )}
      <text x="4" y="10" fontFamily={FONT} fontSize="5" fill={xray ? '#c0c8d0' : '#40404c'}>
        {xray ? 'LATERAL FILM' : 'SIDE VIEW · DORSUM UP'}
      </text>
      {children}
    </svg>
  )
}

