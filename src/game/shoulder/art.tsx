import type { ReactNode, Ref } from 'react'

const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const FONT = 'Press Start 2P, monospace'

/** Seen from above, Mr Lui supine: his left shoulder on your right, the elbow at his side. */
export const ARM = { shoulder: { x: 146, y: 56 }, elbow: { x: 156, y: 132 }, forearm: 46, badge: { x: 162, y: 92, r: 12 } }

/** Where the hand is for an external rotation `er` (degrees): the forearm swings out from his belly. */
export function handAt(er: number) {
  const a = (er * Math.PI) / 180
  return { x: ARM.elbow.x + ARM.forearm * Math.sin(a), y: ARM.elbow.y + 4, near: Math.cos(a) }
}

export function erFromX(x: number) {
  return Math.max(-60, Math.min(110, ((x - ARM.elbow.x) / ARM.forearm) * 90))
}

export function ShoulderView({ er, reduced, svgRef, children, tension = 0, locked = false }: { er: number; reduced: boolean; svgRef?: Ref<SVGSVGElement>; children?: ReactNode; tension?: number; locked?: boolean }) {
  const hand = handAt(er)
  const r = 6 + 4 * Math.max(0, hand.near)
  return (
    <svg ref={svgRef} viewBox="0 0 220 200" className="block h-full w-full select-none" data-testid="shoulder-view">
      <rect width="220" height="200" fill="#eef2f4" />
      {/* trolley, gown, head */}
      <rect x="20" y="0" width="180" height="200" fill="#e2e8ec" />
      <circle cx="90" cy="14" r="20" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M40 40 L140 40 Q150 44 150 60 L150 200 L30 200 L30 60 Q30 44 40 40 Z" fill="#bcd4e8" stroke="#6a84a0" />
      <line x1="62" y1="44" x2="132" y2="46" stroke="#6a84a0" />
      {/* the left shoulder: squared off when out, round when in */}
      {reduced ? (
        <path d="M134 40 Q168 42 166 72 L150 76 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
      ) : (
        <g>
          <path d="M134 40 L158 42 L158 72 L150 76 Z" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.5" />
          <ellipse cx="140" cy="64" rx="8" ry="7" fill={SKIN} stroke={SKIN_EDGE} strokeDasharray="2 2" />
        </g>
      )}
      {/* upper arm along his side */}
      <path d={`M${ARM.shoulder.x} ${ARM.shoulder.y} L${ARM.elbow.x} ${ARM.elbow.y}`} stroke={SKIN_EDGE} strokeWidth="22" strokeLinecap="round" />
      <path d={`M${ARM.shoulder.x} ${ARM.shoulder.y} L${ARM.elbow.x} ${ARM.elbow.y}`} stroke={SKIN} strokeWidth="19" strokeLinecap="round" />
      {/* forearm and hand, foreshortened when it points at the ceiling */}
      <path d={`M${ARM.elbow.x} ${ARM.elbow.y} L${hand.x} ${hand.y}`} stroke={SKIN_EDGE} strokeWidth="16" strokeLinecap="round" />
      <path d={`M${ARM.elbow.x} ${ARM.elbow.y} L${hand.x} ${hand.y}`} stroke={SKIN} strokeWidth="13" strokeLinecap="round" />
      <circle cx={hand.x} cy={hand.y} r={r} fill={SKIN} stroke={SKIN_EDGE} />
      {/* your hand on his wrist, the other at his elbow */}
      <ellipse cx={hand.x} cy={hand.y + r + 4} rx="9" ry="5" fill="#c89070" stroke="#6a3a20" opacity="0.9" />
      <ellipse cx={ARM.elbow.x + 12} cy={ARM.elbow.y + 6} rx="8" ry="5" fill="#c89070" stroke="#6a3a20" opacity="0.9" />
      {/* guide arc */}
      <path d={`M${ARM.elbow.x - ARM.forearm * 0.7} ${ARM.elbow.y + 20} Q${ARM.elbow.x} ${ARM.elbow.y + 34} ${ARM.elbow.x + ARM.forearm} ${ARM.elbow.y + 20}`} stroke="#9aa4b0" strokeDasharray="2 3" fill="none" />
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="24" y="196">R</text>
        <text x="190" y="196">L</text>
        <text x="150" y="190">ER {Math.round(er)}°</text>
      </g>
      {tension > 0.05 && (
        <g>
          <rect x="24" y="182" width="60" height="6" fill="#d8dee4" stroke="#40404c" strokeWidth="0.6" />
          <rect x="24" y="182" width={60 * Math.min(1, tension)} height="6" fill={locked ? '#d04040' : tension > 0.6 ? '#e0a030' : '#58c878'} />
          <text x="24" y="179" fontFamily={FONT} fontSize="4" fill="#40404c">
            {locked ? 'SPASM' : 'MUSCLE TENSION'}
          </text>
        </g>
      )}
      {children}
    </svg>
  )
}
