import type { ReactNode, Ref } from 'react'
import { AXIAL, CELLULITIS, EFFUSION_ML, PATELLA, type Pt } from './model'

const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

/** The right knee from the front, straight: lateral on your left. A swollen suprapatellar pouch; cellulitis medially. */
export function KneeFront({ svgRef, mark, extended, children }: { svgRef?: Ref<SVGSVGElement>; mark?: Pt | null; extended: boolean; children?: ReactNode }) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 200" className="block h-full w-full select-none" data-testid="knee-front">
      <rect width="200" height="200" fill="#eef2f4" />
      {/* thigh, knee, shin */}
      <path d="M58 0 L142 0 L146 90 Q150 120 138 150 L130 200 L74 200 L64 150 Q52 120 56 90 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      {/* effusion: the suprapatellar pouch bulging, the hollows beside the patella filled out */}
      <ellipse cx="100" cy="66" rx="40" ry="20" fill={SKIN} stroke={SKIN_EDGE} strokeDasharray="2 2" />
      <ellipse cx={CELLULITIS.cx} cy={CELLULITIS.cy} rx={CELLULITIS.rx} ry={CELLULITIS.ry} fill="#e05a4a" opacity="0.45" />
      <ellipse cx={PATELLA.cx} cy={PATELLA.cy} rx={PATELLA.rx} ry={PATELLA.ry} fill="#f0c4a0" stroke={SKIN_EDGE} strokeWidth="1.5" />
      <path d="M92 124 L94 150 M108 124 L106 150" stroke={SKIN_EDGE} strokeWidth="1" opacity="0.6" />
      {!extended && <text x="4" y="196" fontFamily={FONT} fontSize="5" fill="#a04030">KNEE BENT · TENSE</text>}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">R KNEE</text>
        <text x="4" y="104">LAT</text>
        <text x="174" y="104">MED</text>
      </g>
      {mark && (
        <g stroke="#3040c0" strokeWidth="2">
          <line x1={mark.x - 4} y1={mark.y - 4} x2={mark.x + 4} y2={mark.y + 4} />
          <line x1={mark.x + 4} y1={mark.y - 4} x2={mark.x - 4} y2={mark.y + 4} />
        </g>
      )}
      {children}
    </svg>
  )
}

/** A cross-section through the patella: lateral on your left, the effusion lens under the patella. */
export function KneeAxial({ svgRef, tip, remaining, children }: { svgRef?: Ref<SVGSVGElement>; tip: Pt | null; remaining: number; children?: ReactNode }) {
  const depth = 10 + 40 * (remaining / EFFUSION_ML)
  const { skin, patella, femur } = AXIAL
  return (
    <svg ref={svgRef} viewBox="0 0 240 140" className="block h-full w-full select-none" data-testid="knee-axial">
      <rect width="240" height="140" fill="#eef2f4" />
      <ellipse cx={skin.cx} cy={skin.cy} rx={skin.rx} ry={skin.ry} fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      {/* the effusion: turbid fluid under the patella */}
      <path d={`M52 44 Q120 ${44 + depth * 1.6} 188 44 Z`} fill="#e8d070" opacity="0.85" />
      <ellipse cx={femur.cx} cy={femur.cy} rx={femur.rx} ry={femur.ry} fill="#f4f0e2" stroke="#9a9078" />
      <ellipse cx={patella.cx} cy={patella.cy} rx={patella.rx} ry={patella.ry} fill="#f4f0e2" stroke="#9a9078" />
      {tip && (
        <g>
          <line x1="2" y1={tip.y - 6} x2={tip.x} y2={tip.y} stroke="#8890a0" strokeWidth="1.8" />
          <circle cx={tip.x} cy={tip.y} r="1.6" fill="#505868" />
        </g>
      )}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">CROSS-SECTION</text>
        <text x="4" y="134">LAT</text>
        <text x="214" y="134">MED</text>
        <text x="102" y="20">PATELLA</text>
      </g>
      {children}
    </svg>
  )
}
