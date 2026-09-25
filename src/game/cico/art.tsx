import { useId, type ReactNode } from 'react'
import { BOUGIE, MID_X, NECK, TUBE, type Habitus, type StabSite, type Stroke } from './case'

/* ================================================================ front of the neck */

/**
 * Anterior neck, chin at the top, sternal notch at the bottom.
 * `xray` shows the cartilages; the incision and the wound draw on the skin.
 */
export function NeckFront({
  habitus,
  xray = false,
  hand = false,
  incision = null,
  opened = false,
  children,
}: {
  habitus: Habitus
  xray?: boolean
  hand?: boolean
  incision?: Stroke | null
  opened?: boolean
  children?: ReactNode
}) {
  const id = useId().replace(/:/g, '')
  const g = (n: string) => `${n}-${id}`
  const obese = habitus === 'obese'
  const w = obese ? 16 : 0
  const outline = `M${34 - w} 0 L${166 + w} 0 Q${160 + w} 60 ${154 + w} 120 Q${150 + w} 200 ${160 + w} 250 Q${178 + w} 280 200 300 L0 300 Q${22 - w} 280 ${40 - w} 250 Q${50 - w} 200 ${46 - w} 120 Q${40 - w} 60 ${34 - w} 0 Z`
  const path = incision && incision.length > 1 ? `M${incision.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}` : null
  return (
    <svg viewBox="0 0 200 300" className="block h-full w-full" data-testid="neck-front">
      <defs>
        <linearGradient id={g('skin')} x1="0" x2="1">
          <stop offset="0" stopColor="#b87658" />
          <stop offset="0.25" stopColor="#e2ac8a" />
          <stop offset="0.5" stopColor="#f2c8a6" />
          <stop offset="0.75" stopColor="#e2ac8a" />
          <stop offset="1" stopColor="#b87658" />
        </linearGradient>
        <radialGradient id={g('hi')}>
          <stop offset="0" stopColor="#fbe2cc" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fbe2cc" stopOpacity="0" />
        </radialGradient>
        <clipPath id={g('clip')}>
          <path d={outline} />
        </clipPath>
      </defs>
      <rect width="200" height="300" fill="#dfe8f0" />
      <path d={outline} fill={`url(#${g('skin')})`} stroke="#8a5238" strokeWidth="1.2" />
      <g clipPath={`url(#${g('clip')})`}>
        {/* jaw and chin shadow */}
        <path d={`M20 0 Q100 ${obese ? 70 : 52} 180 0 Z`} fill="#9a5c40" opacity="0.35" />
        {obese && <path d="M40 66 Q100 96 160 66" stroke="#b07050" strokeWidth="2" fill="none" opacity="0.5" />}
        {/* sternocleidomastoids run down and in to the sternal notch */}
        <path d={`M44 30 Q70 170 92 ${NECK.notchY}`} stroke="#c68a68" strokeWidth="9" fill="none" opacity="0.35" />
        <path d={`M156 30 Q130 170 108 ${NECK.notchY}`} stroke="#c68a68" strokeWidth="9" fill="none" opacity="0.35" />
        {!obese && (
          <>
            {/* laryngeal prominence and the thyroid laminae */}
            <ellipse cx={MID_X} cy={NECK.thyroidTop + 8} rx="10" ry="12" fill={`url(#${g('hi')})`} />
            <path d={`M76 ${NECK.thyroidTop + 2} L${MID_X} ${NECK.thyroidBottom} L124 ${NECK.thyroidTop + 2}`} stroke="#c48a6a" strokeWidth="1" fill="none" opacity="0.6" />
            {/* the dip of the membrane, then the cricoid ring */}
            <ellipse cx={MID_X} cy={(NECK.membraneTop + NECK.membraneBottom) / 2} rx="9" ry="5" fill="#b87a5a" opacity="0.35" />
            <ellipse cx={MID_X} cy={(NECK.membraneBottom + NECK.cricoidBottom) / 2} rx="14" ry="5" fill={`url(#${g('hi')})`} opacity="0.8" />
          </>
        )}
        {obese && <ellipse cx={MID_X} cy={NECK.thyroidTop + 8} rx="14" ry="10" fill={`url(#${g('hi')})`} opacity="0.4" />}
        {/* sternal notch */}
        <ellipse cx={MID_X} cy={NECK.notchY} rx="14" ry="7" fill="#9a5c40" opacity="0.45" />
        {xray && <Cartilages />}
        {path && opened && <path d={path} stroke="#6a1818" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.9" />}
        {path && opened && <path d={path} stroke="#c84848" strokeWidth="4" strokeLinecap="round" fill="none" />}
        {path && !opened && <path d={path} stroke="#c02828" strokeWidth="2" strokeLinecap="round" fill="none" />}
      </g>
      {hand && (
        <g opacity="0.85">
          <rect x="56" y={NECK.thyroidTop + 4} width="14" height="38" rx="7" fill="#88c8f0" stroke="#181820" />
          <rect x="130" y={NECK.thyroidTop + 4} width="14" height="38" rx="7" fill="#88c8f0" stroke="#181820" />
          <rect x="40" y={NECK.thyroidTop + 30} width="26" height="16" rx="8" fill="#88c8f0" stroke="#181820" />
        </g>
      )}
      {children}
    </svg>
  )
}

/** X-ray layer: hyoid, thyroid cartilage, membrane, cricoid, tracheal rings, thyroid gland. */
function Cartilages() {
  const line = '#4a5f8a'
  const fill = '#dce6fa'
  const rings = []
  for (let y = NECK.cricoidBottom + 4; y < NECK.ringsBottom; y += 11) rings.push(y)
  return (
    <g opacity="0.88">
      <path d={`M70 ${NECK.hyoidY} Q${MID_X} ${NECK.hyoidY - 8} 130 ${NECK.hyoidY}`} stroke={line} strokeWidth="5" fill="none" />
      <path d={`M70 ${NECK.hyoidY} Q${MID_X} ${NECK.hyoidY - 8} 130 ${NECK.hyoidY}`} stroke={fill} strokeWidth="3" fill="none" />
      <path d={`M70 ${NECK.thyroidTop} L${MID_X - 5} ${NECK.thyroidTop + 2} L${MID_X} ${NECK.thyroidTop + 10} L${MID_X + 5} ${NECK.thyroidTop + 2} L130 ${NECK.thyroidTop} L116 ${NECK.thyroidBottom} L84 ${NECK.thyroidBottom} Z`} fill={fill} stroke={line} strokeWidth="1.2" />
      <rect x={MID_X - 12} y={NECK.membraneTop} width="24" height={NECK.membraneBottom - NECK.membraneTop} fill="#f0b8c8" stroke="#b86880" strokeDasharray="2 2" />
      <rect x={MID_X - 17} y={NECK.membraneBottom} width="34" height={NECK.cricoidBottom - NECK.membraneBottom} rx="4" fill={fill} stroke={line} strokeWidth="1.2" />
      {rings.map((y) => (
        <rect key={y} x={MID_X - 14} y={y} width="28" height="6" rx="3" fill={fill} stroke={line} strokeWidth="0.8" />
      ))}
      <path d={`M72 ${NECK.cricoidBottom + 8} Q${MID_X} ${NECK.cricoidBottom + 30} 128 ${NECK.cricoidBottom + 8} L132 ${NECK.cricoidBottom + 60} Q${MID_X} ${NECK.cricoidBottom + 44} 68 ${NECK.cricoidBottom + 60} Z`} fill="#d87878" opacity="0.4" />
    </g>
  )
}

/* ================================================================ side view: extension */

/** Supine patient in profile, head on the left. `extend` 0–1 tips the head back and brings the larynx forward. */
export function NeckProfile({ extend, side }: { extend: number; side: 'left' | 'right' | null }) {
  const deg = -extend * 16
  const lift = extend * 6
  const roll = extend > 0.5
  return (
    <svg viewBox="0 0 200 140" className="block h-full w-full" data-testid="neck-profile">
      <rect width="200" height="140" fill="#dfe8f0" />
      <rect x="0" y="108" width="200" height="10" rx="4" fill="#f4f6f8" stroke="#9aa6b8" />
      <rect y="118" width="200" height="22" fill="#c8d4e0" />
      {roll && <ellipse cx="124" cy="104" rx="16" ry="6" fill="#58a868" stroke="#2f6a3e" />}
      {/* torso in a gown */}
      <path d={`M112 ${roll ? 80 : 84} Q116 ${roll ? 72 : 76} 132 ${roll ? 74 : 78} L200 78 L200 108 L112 108 Z`} fill="#f0b8c8" stroke="#8a5238" />
      <g transform={`translate(0 ${-lift}) rotate(${deg} 112 96)`}>
        {/* neck, with the larynx on its front */}
        <path d="M114 82 L84 80 Q80 94 84 108 L114 108 Z" fill="#e8b494" stroke="#8a5238" />
        <circle cx="98" cy="80" r="3.5" fill="#f6d4b8" stroke="#b87a5a" strokeWidth="0.6" />
        {/* head, face up: occiput on the pillow side, nose and chin on top */}
        <ellipse cx="58" cy="92" rx="28" ry="20" fill="#e8b494" stroke="#8a5238" />
        <path d="M32 96 Q34 114 58 113 Q76 112 82 104" fill="#583830" />
        <path d="M44 72 L40 64 L50 70" fill="#e8b494" stroke="#8a5238" />
        <path d="M76 74 Q84 74 84 82" fill="none" stroke="#8a5238" />
        <circle cx="36" cy="84" r="2" fill="#181820" />
        {/* i-gel in the mouth, circuit going up */}
        <rect x="62" y="68" width="10" height="7" rx="2" fill="#6ab0e0" stroke="#181820" />
        <path d="M67 68 L67 44 L82 36" stroke="#9aa6c0" strokeWidth="4" fill="none" />
      </g>
      <text x="6" y="12" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#40404c">
        HEAD
      </text>
      <text x="150" y="12" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#40404c">
        FEET
      </text>
      {side && (
        <text x="6" y="134" fontFamily="Press Start 2P, monospace" fontSize="6" fill="#2f7a3e">
          YOU: ON HIS {side.toUpperCase()}
        </text>
      )}
    </svg>
  )
}

/* ================================================================ sagittal section */

const U = 5.5 // units per mm, depth
const SURF = 72 // membrane surface y
const LUMEN_TOP = 84
const LUMEN_BOTTOM = 148

function siteX(site: StabSite | null) {
  if (site === 'thyroid') return 56
  if (site === 'cricoid') return 126
  if (site === 'rings') return 162
  if (site === 'off') return 100
  return 100
}

/**
 * Midline sagittal slice. Head on the left, feet on the right, skin at the top.
 * Shows the blade, the bougie path (trachea, or a false passage in front of it), and the tube with its cuff.
 */
export function LarynxSection({
  habitus,
  site,
  stabDepth,
  bladeIn,
  rotated,
  bougieCm,
  falsePassage,
  tubeCm,
  cuff,
  coach,
}: {
  habitus: Habitus
  site: StabSite | null
  stabDepth: number
  bladeIn: boolean
  rotated: boolean
  bougieCm: number
  falsePassage: boolean
  tubeCm: number
  cuff: number
  coach: boolean
}) {
  const fat = habitus === 'obese' ? 30 : 16
  const bx = siteX(site)
  const tip = SURF + stabDepth * U
  const trackY = falsePassage ? SURF - 8 : (LUMEN_TOP + LUMEN_BOTTOM) / 2
  const along = (cm: number) => {
    const len = cm * 10
    const down = Math.min(len, falsePassage ? 4 : trackY - SURF)
    const across = Math.max(0, len - down)
    return { x: 100 + across, y: SURF + (falsePassage ? down : down) }
  }
  const bEnd = along(bougieCm)
  const tEnd = along(tubeCm)
  const cuffAt = along(Math.max(0, tubeCm - 1))
  return (
    <svg viewBox="0 0 200 200" className="block h-full w-full" data-testid="larynx-section">
      <rect width="200" height="200" fill="#eef3f8" />
      <rect y={SURF - fat} width="200" height={fat} fill="#f4dca8" />
      <rect y={SURF - fat - 2} width="200" height="3" fill="#d89a7a" />
      {/* wound through the skin and fat */}
      <rect x="92" y={SURF - fat - 2} width="16" height={fat + 2} fill="#8a2020" opacity="0.8" />
      {/* thyroid cartilage, membrane, cricoid, rings */}
      <rect x="0" y={SURF - 8} width="88" height="16" fill="#f4f0e2" stroke="#9a9078" />
      <rect x="88" y={SURF - 1} width="24" height="3" fill="#f0b8c8" />
      <rect x="112" y={SURF - 10} width="30" height="22" rx="4" fill="#f4f0e2" stroke="#9a9078" />
      {[148, 162, 176, 190].map((x) => (
        <rect key={x} x={x} y={SURF - 2} width="9" height="10" rx="3" fill="#f4f0e2" stroke="#9a9078" />
      ))}
      {/* airway lumen, vocal cords above, posterior wall and oesophagus behind */}
      <rect y={LUMEN_TOP} width="200" height={LUMEN_BOTTOM - LUMEN_TOP} fill="#243448" />
      <path d={`M36 ${LUMEN_TOP} L56 ${LUMEN_TOP + 22} L60 ${LUMEN_TOP} Z M36 ${LUMEN_BOTTOM} L56 ${LUMEN_BOTTOM - 22} L60 ${LUMEN_BOTTOM} Z`} fill="#e8a0a8" />
      <rect y={LUMEN_BOTTOM} width="200" height="10" fill="#d88890" />
      <rect y={LUMEN_BOTTOM + 10} width="200" height="42" fill="#a84840" />
      {coach && (
        <g fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">
          <text x="4" y={SURF - 12}>THYROID</text>
          <text x="114" y={SURF - 14}>CRICOID</text>
          <text x="40" y={LUMEN_TOP + 34} fill="#f8e0e0">CORDS</text>
          <text x="120" y={LUMEN_TOP + 34} fill="#c8d8f0">TRACHEA</text>
          <text x="4" y={LUMEN_BOTTOM + 30} fill="#f8e0e0">OESOPHAGUS</text>
          <text x="4" y="10">HEAD ◀</text>
          <text x="160" y="10">▶ FEET</text>
        </g>
      )}
      {/* tube and cuff */}
      {tubeCm > 0 && (
        <g>
          <path d={`M100 ${SURF - fat - 30} L100 ${Math.min(tEnd.y, trackY)} L${tEnd.x} ${tEnd.y}`} stroke="#e8eef8" strokeWidth="9" fill="none" opacity="0.85" />
          <path d={`M100 ${SURF - fat - 30} L100 ${Math.min(tEnd.y, trackY)} L${tEnd.x} ${tEnd.y}`} stroke="#9aa6c0" strokeWidth="1" fill="none" />
          {tubeCm > 1 && <ellipse cx={cuffAt.x} cy={cuffAt.y} rx={4 + cuff * 5} ry={5 + cuff * 6} fill="#c8e0f8" opacity="0.8" stroke="#6a88b8" />}
        </g>
      )}
      {/* bougie */}
      {bougieCm > 0 && (
        <path d={`M100 ${SURF - fat - 40} L100 ${Math.min(bEnd.y, trackY)} L${bEnd.x} ${bEnd.y}`} stroke="#e8b030" strokeWidth="2.4" fill="none" />
      )}
      {/* blade */}
      {bladeIn && (
        <g>
          <rect x={bx - 3} y={SURF - fat - 44} width="6" height="26" rx="2" fill="#607080" stroke="#181820" />
          <path d={`M${bx - 3} ${SURF - fat - 18} L${bx + 3} ${SURF - fat - 18} L${bx + (rotated ? 3 : 1)} ${tip} L${bx - 3} ${tip - 6} Z`} fill="#d8dee8" stroke="#606870" />
        </g>
      )}
    </svg>
  )
}

/** Top view: the line is the plane of the blade, the arrow is where the cutting edge faces. */
export function BladeCompass({ plane, edge }: { plane: 'across' | 'along' | null; edge: 'you' | 'away' | 'head' | 'feet' | null }) {
  const arrow: Record<string, [number, number]> = { you: [-18, 0], away: [18, 0], head: [0, -18], feet: [0, 18] }
  const [ax, ay] = edge ? arrow[edge] : [0, 0]
  return (
    <svg viewBox="0 0 60 60" className="block h-full w-full" data-testid="blade-compass">
      <rect width="60" height="60" fill="#f8f8f4" />
      <text x="21" y="7" fontFamily="Press Start 2P, monospace" fontSize="4" fill="#40404c">HEAD</text>
      <text x="21" y="58" fontFamily="Press Start 2P, monospace" fontSize="4" fill="#40404c">FEET</text>
      <text x="1" y="24" fontFamily="Press Start 2P, monospace" fontSize="4" fill="#40404c">YOU</text>
      {plane && (plane === 'across' ? <rect x="14" y="28" width="32" height="4" fill="#9aa6b8" stroke="#181820" strokeWidth="0.6" /> : <rect x="28" y="14" width="4" height="32" fill="#9aa6b8" stroke="#181820" strokeWidth="0.6" />)}
      {edge && (
        <g stroke="#d03848" strokeWidth="2" fill="#d03848">
          <line x1="30" y1="30" x2={30 + ax} y2={30 + ay} />
          <circle cx={30 + ax} cy={30 + ay} r="2.4" />
        </g>
      )}
    </svg>
  )
}

export { BOUGIE, TUBE }
