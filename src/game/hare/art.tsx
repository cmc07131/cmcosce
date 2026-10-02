import type { Ref } from 'react'
import { ANKLE_CM, FRACTURE_CM, HEEL_CM, KNEE_CM, pull, shortfall, type HareRun } from './model'

/**
 * The bench, seen from above: the patient supine, pelvis on the left, feet on the right. His left (injured) leg is
 * the upper one, his right the lower one. Distances along the leg are cm from the ischial tuberosity.
 */

export const VIEW = { w: 360, h: 172 }
export const X0 = 62
export const S = 2.3
export const ROW = { left: 62, right: 118 } as const
/** Where the splint lies while you measure or prepare it: alongside a leg, outside it. */
export const BESIDE = { left: 24, right: 152 } as const

export const xOf = (cm: number) => X0 + cm * S
export const cmOf = (x: number) => (x - X0) / S

const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const PALE = '#f0dcd2'
const JEANS = '#4a6aa8'
const JEANS_EDGE = '#2a3a68'
const RAIL = '#9aa4b0'
const RAIL_EDGE = '#4a5260'
const STRAP = '#3a4a7a'
const FONT = 'Press Start 2P, monospace'

export type Splint = {
  /** Centre line of the splint; it lies alongside a leg, or under the left leg. */
  y: number
  ringCm: number
  lengthCm: number
  straps?: number[]
  fastened?: boolean[]
  stand?: boolean
  ischial?: number
}

export type LegSceneProps = {
  run: HareRun
  splint: Splint | null
  /** A ghost of the hitch following your finger, cm along the leg. */
  hitchGhost?: number | null
  /** The traction strap's hook while you drag it. */
  hookGhost?: { x: number; y: number } | null
  /** Flash where you just touched. */
  touch?: { x: number; y: number; key: number } | null
  showZones?: boolean
  svgRef?: Ref<SVGSVGElement>
}

/** One leg as thick strokes: thigh, knee, calf, ankle, and the foot pointing at the ceiling. */
function Leg({ y, heel, cut, bend = 0, rotated = false, pale = false, clothed, shoe }: { y: number; heel: number; cut?: number; bend?: number; rotated?: boolean; pale?: boolean; clothed: boolean; shoe: boolean }) {
  const skin = pale ? PALE : SKIN
  // Distal to the fracture everything shifts by the shortening and bows outward.
  const shift = cut === undefined ? 0 : heel - HEEL_CM
  const d = (cm: number) => xOf(cm + (cut !== undefined && cm > cut ? shift : 0))
  const by = (cm: number) => y + (cut !== undefined && cm > cut ? bend : 0)
  const pts = (a: number, b: number) => `M${d(a)} ${by(a)} L${d(b)} ${by(b)}`
  const thighCol = clothed ? JEANS : skin
  const thighEdge = clothed ? JEANS_EDGE : SKIN_EDGE
  const footX = d(HEEL_CM)
  return (
    <g>
      {/* outline then fill */}
      <path d={`${pts(-4, cut ?? KNEE_CM)}`} stroke={thighEdge} strokeWidth="26" strokeLinecap="round" />
      {cut !== undefined && <path d={`M${d(cut)} ${y} L${d(cut + 0.1)} ${by(cut + 0.1)} L${d(KNEE_CM)} ${by(KNEE_CM)}`} stroke={thighEdge} strokeWidth="25" strokeLinecap="round" />}
      <path d={pts(KNEE_CM, ANKLE_CM)} stroke={clothed ? JEANS_EDGE : SKIN_EDGE} strokeWidth="19" strokeLinecap="round" />
      <path d={pts(ANKLE_CM, HEEL_CM)} stroke={SKIN_EDGE} strokeWidth="13" strokeLinecap="round" />
      <path d={`${pts(-4, cut ?? KNEE_CM)}`} stroke={thighCol} strokeWidth="23" strokeLinecap="round" />
      {cut !== undefined && <path d={`M${d(cut)} ${y} L${d(cut + 0.1)} ${by(cut + 0.1)} L${d(KNEE_CM)} ${by(KNEE_CM)}`} stroke={thighCol} strokeWidth="22" strokeLinecap="round" />}
      <path d={pts(KNEE_CM, ANKLE_CM)} stroke={clothed ? JEANS : skin} strokeWidth="16" strokeLinecap="round" />
      <path d={pts(ANKLE_CM, HEEL_CM)} stroke={skin} strokeWidth="10" strokeLinecap="round" />
      {!clothed && <ellipse cx={d(KNEE_CM)} cy={by(KNEE_CM)} rx="5" ry="6" fill="none" stroke={SKIN_EDGE} strokeWidth="1" opacity="0.6" />}
      {/* foot, toes up; an injured leg lies externally rotated, the foot falling outward */}
      <g transform={`translate(${footX + 4} ${by(HEEL_CM) + (rotated ? -5 : 0)}) rotate(${rotated ? -55 : 0})`}>
        {shoe ? (
          <g>
            <ellipse cx="1" cy="0" rx="11" ry="8.5" fill="#f4f4f4" stroke="#40404c" strokeWidth="1.4" />
            <path d="M-3 -5 L-3 5 M1 -6 L1 6 M5 -5 L5 5" stroke="#c03838" strokeWidth="1.4" />
          </g>
        ) : (
          <>
            <ellipse cx="0" cy="0" rx="9" ry="7" fill={skin} stroke={SKIN_EDGE} />
            {[-5, -2, 1, 4].map((t) => (
              <circle key={t} cx="8" cy={t} r="1.6" fill={skin} stroke={SKIN_EDGE} strokeWidth="0.6" />
            ))}
          </>
        )}
      </g>
    </g>
  )
}

export function LegScene({ run, splint, hitchGhost, hookGhost, touch, showZones, svgRef }: LegSceneProps) {
  const short = shortfall(run)
  const heelL = HEEL_CM - short
  const p = pull(run)
  const pale = run.hitchAt !== null && (p > 8 || run.hitchTension > 0.85)
  const under = splint && splint.y === ROW.left
  const hitchCm = run.hitchAt === 'ankle' ? heelL - 3 : run.hitchAt === 'calf' ? heelL - 22 : run.hitchAt === 'foot' ? heelL + 4 : null
  const dRing = { x: xOf(heelL) + 16, y: ROW.left }
  const end = splint ? xOf(splint.ringCm + splint.lengthCm) : 0
  return (
    <svg ref={svgRef} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block h-full w-full select-none" data-testid="hare-scene">
      <rect width={VIEW.w} height={VIEW.h} fill="#dfe6ec" />
      {/* trolley mattress */}
      <rect x="0" y="6" width={VIEW.w} height={VIEW.h - 12} fill="#eef2f4" stroke="#b8c2cc" />
      {/* pelvis and lower trunk, a gown over it */}
      <path d={`M0 30 L${X0 - 8} 34 Q${X0 + 8} 40 ${X0 + 6} ${ROW.left - 2} L${X0 + 6} ${ROW.right + 2} Q${X0 + 8} 138 ${X0 - 8} 142 L0 146 Z`} fill="#bcd4e8" stroke="#6a84a0" />
      <text x="6" y="92" fontFamily={FONT} fontSize="6" fill="#4a6280">
        PELVIS
      </text>
      {showZones && (
        <g opacity="0.25">
          <rect x={xOf(FRACTURE_CM - 5)} y={ROW.left - 16} width={10 * S} height="32" fill="#d04040" />
          <rect x={xOf(KNEE_CM - 5)} y={ROW.left - 16} width={10 * S} height="32" fill="#d0a040" />
        </g>
      )}
      {/* splint beside a leg is drawn under it; under the left leg, it goes beneath it too */}
      {splint && <SplintArt s={splint} />}
      <Leg y={ROW.right} heel={HEEL_CM} clothed shoe />
      <g>
        <Leg y={ROW.left} heel={heelL} cut={FRACTURE_CM} bend={p >= 3 ? 0 : -4} rotated={p < 3 && run.hitchAt === null} pale={pale} clothed={!run.exposed} shoe={!run.shoeOff} />
        {/* swelling over the fracture */}
        {run.exposed && <ellipse cx={xOf(FRACTURE_CM)} cy={ROW.left - 1} rx="14" ry="14" fill={SKIN} stroke={SKIN_EDGE} strokeDasharray="2 2" opacity="0.9" />}
      </g>
      {/* ischial strap over the groin */}
      {under && splint.ischial !== undefined && splint.ischial > 0.05 && (
        <path d={`M${xOf(splint.ringCm) - 2} ${ROW.left - 18} Q${xOf(splint.ringCm) + 10} ${ROW.left} ${xOf(splint.ringCm) - 2} ${ROW.left + 18}`} stroke="#c03838" strokeWidth={2 + splint.ischial * 3} fill="none" />
      )}
      {/* straps over the leg once fastened */}
      {under &&
        (splint.straps ?? []).map((cm, i) =>
          splint.fastened?.[i] ? <rect key={i} x={xOf(splint.ringCm + cm) - 4} y={ROW.left - 16} width="8" height="32" fill={STRAP} stroke="#1a2440" opacity="0.92" /> : null,
        )}
      {/* ankle hitch */}
      {hitchCm !== null && (
        <g>
          <rect x={xOf(hitchCm) - 5} y={ROW.left - 9} width="10" height="18" rx="2" fill="#e88838" stroke="#7a4010" />
          <path d={`M${xOf(hitchCm) + 5} ${ROW.left - 6} L${dRing.x} ${ROW.left} L${xOf(hitchCm) + 5} ${ROW.left + 6}`} stroke="#7a4010" strokeWidth="1.5" fill="none" />
          <circle cx={dRing.x} cy={dRing.y} r="3" fill="none" stroke="#303848" strokeWidth="1.6" />
        </g>
      )}
      {/* traction strap from the windlass to the D-ring */}
      {under && run.hooked && <path d={`M${end - 4} ${ROW.left} L${dRing.x + 2} ${ROW.left}`} stroke="#303848" strokeWidth="2.4" />}
      {hookGhost && <path d={`M${end - 4} ${ROW.left} L${hookGhost.x} ${hookGhost.y}`} stroke="#303848" strokeWidth="2" strokeDasharray="3 2" />}
      {/* the nurse's hands on the hitch */}
      {run.manual && (
        <g>
          <ellipse cx={xOf(heelL) + 20} cy={ROW.left - 9} rx="6" ry="4" fill="#d8a080" stroke="#6a3a20" />
          <ellipse cx={xOf(heelL) + 20} cy={ROW.left + 9} rx="6" ry="4" fill="#d8a080" stroke="#6a3a20" />
          <text x={xOf(heelL) + 10} y={ROW.left - 18} fontFamily={FONT} fontSize="5" fill="#6a3a20">
            NURSE
          </text>
        </g>
      )}
      {hitchGhost != null && <rect x={xOf(hitchGhost) - 5} y={ROW.left - 9} width="10" height="18" rx="2" fill="#e88838" opacity="0.6" stroke="#7a4010" />}
      {/* where the right heel is: compare lengths by eye */}
      <line x1={xOf(HEEL_CM)} y1="10" x2={xOf(HEEL_CM)} y2={VIEW.h - 10} stroke="#6a7480" strokeDasharray="2 3" opacity="0.6" />
      <g fontFamily={FONT} fontSize="7" fill="#40404c">
        <text x="6" y="22">L</text>
        <text x="6" y={VIEW.h - 14}>
          R
        </text>
      </g>
      {touch && <circle key={touch.key} cx={touch.x} cy={touch.y} r="6" fill="none" stroke="#f8d030" strokeWidth="2" className="hare-touch" />}
    </svg>
  )
}

function SplintArt({ s }: { s: Splint }) {
  const a = xOf(s.ringCm)
  const b = xOf(s.ringCm + s.lengthCm)
  const half = 15
  return (
    <g data-testid="hare-splint">
      <path d={`M${a} ${s.y - half} L${b} ${s.y - half} M${a} ${s.y + half} L${b} ${s.y + half}`} stroke={RAIL_EDGE} strokeWidth="4" />
      <path d={`M${a} ${s.y - half} L${b} ${s.y - half} M${a} ${s.y + half} L${b} ${s.y + half}`} stroke={RAIL} strokeWidth="2.4" />
      {/* the padded half-ring at the top */}
      <path d={`M${a} ${s.y - half - 3} Q${a - 12} ${s.y} ${a} ${s.y + half + 3}`} stroke="#202028" strokeWidth="5" fill="none" />
      {/* length-lock collars halfway */}
      <rect x={xOf(s.ringCm + 58) - 3} y={s.y - half - 3} width="6" height="6" fill="#606878" />
      <rect x={xOf(s.ringCm + 58) - 3} y={s.y + half - 3} width="6" height="6" fill="#606878" />
      {/* windlass at the foot end */}
      <path d={`M${b} ${s.y - half} L${b + 8} ${s.y} L${b} ${s.y + half}`} stroke={RAIL_EDGE} strokeWidth="3" fill="none" />
      <circle cx={b + 8} cy={s.y} r="5" fill="#505868" stroke="#202028" />
      {s.stand && <rect x={b - 16} y={s.y - half - 2} width="5" height={half * 2 + 4} fill="#202028" opacity="0.5" />}
      {/* open leg straps lying across the rails */}
      {(s.straps ?? []).map((cm, i) =>
        s.fastened?.[i] ? null : <rect key={i} x={xOf(s.ringCm + cm) - 3.5} y={s.y - half - 4} width="7" height={half * 2 + 8} fill="none" stroke={STRAP} strokeWidth="2" strokeDasharray="3 2" data-strap={i} />,
      )}
    </g>
  )
}

/* ---------------------------------------------------------------- the foot, close up */

export const FOOT_SITES = {
  dp: { x: 104, y: 58, r: 12 },
  pt: { x: 150, y: 102, r: 12 },
  nail: { x: 132, y: 16, r: 9 },
  toes: { x: 88, y: 20, r: 26 },
} as const

/** The left foot from the front: toes at the top, the big toe on the right (medial). */
export function FootView({ run, svgRef, showSites, pulse }: { run: HareRun; svgRef?: Ref<SVGSVGElement>; showSites?: boolean; pulse?: { site: 'dp' | 'pt'; key: number } | null }) {
  const bad = run.hitchAt !== null && (pull(run) > 8 || run.hitchTension > 0.85)
  const skin = bad ? PALE : SKIN
  return (
    <svg ref={svgRef} viewBox="0 0 200 124" className="block h-full w-full select-none" data-testid="hare-foot">
      <rect width="200" height="124" fill="#eef2f4" />
      <text x="4" y="10" fontFamily={FONT} fontSize="5" fill="#40404c">
        LEFT FOOT
      </text>
      {run.shoeOff ? (
        <g>
          <path d="M70 124 L72 92 Q58 70 60 40 Q62 14 80 10 L140 8 Q154 12 150 40 Q148 70 136 92 L138 124 Z" fill={skin} stroke={SKIN_EDGE} strokeWidth="1.5" />
          {/* malleoli */}
          <ellipse cx="66" cy="102" rx="6" ry="7" fill={skin} stroke={SKIN_EDGE} />
          <ellipse cx="142" cy="96" rx="6" ry="7" fill={skin} stroke={SKIN_EDGE} />
          {/* toes, big toe medial (right) */}
          {[
            [68, 18, 6],
            [82, 12, 6.5],
            [97, 9, 7],
            [112, 8, 7.5],
            [132, 10, 10],
          ].map(([x, y, r]) => (
            <g key={x}>
              <circle cx={x} cy={y} r={r} fill={skin} stroke={SKIN_EDGE} />
              <rect x={x - r / 2.5} y={y - r / 1.4} width={r / 1.25} height={r / 1.6} rx="1" fill={bad ? '#f4f4f4' : '#f0c8c0'} stroke={SKIN_EDGE} strokeWidth="0.5" />
            </g>
          ))}
          {/* tendon of extensor hallucis longus, the landmark for the dorsalis pedis */}
          <path d="M126 22 Q118 60 112 92" stroke={SKIN_EDGE} strokeWidth="0.8" opacity="0.5" fill="none" />
        </g>
      ) : (
        <g>
          <path d="M66 124 L68 88 Q52 64 56 36 Q60 8 82 6 L142 6 Q160 10 154 38 Q150 66 140 88 L142 124 Z" fill="#f4f4f4" stroke="#40404c" strokeWidth="2" />
          <path d="M76 30 L136 30 M74 44 L138 44 M76 58 L134 58" stroke="#c03838" strokeWidth="3" />
          <rect x="60" y="100" width="88" height="12" fill={JEANS} stroke={JEANS_EDGE} />
        </g>
      )}
      {run.hitchAt === 'ankle' && (
        <g>
          <rect x="60" y="96" width="92" height="16" rx="3" fill="#e88838" stroke="#7a4010" opacity="0.92" />
          <path d="M70 96 L120 70 M140 96 L90 70" stroke="#7a4010" strokeWidth="3" />
        </g>
      )}
      {showSites && run.shoeOff && (
        <g fill="none" stroke="#3060c0" strokeDasharray="2 2" opacity="0.7">
          <circle cx={FOOT_SITES.dp.x} cy={FOOT_SITES.dp.y} r={FOOT_SITES.dp.r} />
          <circle cx={FOOT_SITES.pt.x} cy={FOOT_SITES.pt.y} r={FOOT_SITES.pt.r} />
        </g>
      )}
      {pulse && (
        <circle key={pulse.key} cx={FOOT_SITES[pulse.site].x} cy={FOOT_SITES[pulse.site].y} r="7" fill="none" stroke={bad ? '#a0a0a0' : '#d03030'} strokeWidth="2" className="hare-pulse" />
      )}
    </svg>
  )
}
