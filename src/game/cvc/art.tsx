import { useMemo, type ReactNode, type Ref } from 'react'
import {
  BEAM_HALF,
  CATH_LEN,
  DIL_LEN,
  LUMENS,
  NECK,
  NEEDLE_LEN,
  SKIN_GRIP_CM,
  arteryAt,
  arteryXOnNeck,
  needleInBeam,
  tailAt,
  tipOf,
  veinShape,
  veinXOnNeck,
  type Grip,
  type Lumen,
  type Sleeve,
} from './model'

const FONT = 'Press Start 2P, monospace'
const PLASTIC = '#e8cdb2'
const PLASTIC_EDGE = '#9a7258'
const DRAPE = '#4f8fb8'
const DRAPE_DARK = '#3a6f92'
const GLOVE = '#f1e6c8'
const GLOVE_EDGE = '#a89868'
const STEEL = '#c8d0d8'

/* ================================================================ hands */

/** A sterile-gloved hand seen from above: palm, four fingers together, thumb. Points along `angle` (degrees, 0 = up). */
export function Glove({ x, y, angle = 0, scale = 1, pinch = false, flip = false }: { x: number; y: number; angle?: number; scale?: number; pinch?: boolean; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${flip ? -scale : scale} ${scale})`} pointerEvents="none">
      <path d="M-9 26 Q-11 8 -8 -2 L-7 -14 Q-6 -19 -3 -18 L-2 -6 L-1 -18 Q1 -22 3 -18 L4 -6 L5 -16 Q7 -19 9 -15 L9 -2 Q11 10 8 26 Z" fill={GLOVE} stroke={GLOVE_EDGE} strokeWidth="1" />
      <path d={pinch ? 'M-8 4 Q-16 -2 -10 -12 Q-7 -14 -5 -10 L-6 0' : 'M-8 6 Q-18 2 -17 -6 Q-15 -9 -12 -6 L-7 -1'} fill={GLOVE} stroke={GLOVE_EDGE} strokeWidth="1" />
      <path d="M-2 -6 L-2 2 M4 -6 L4 2" stroke={GLOVE_EDGE} strokeWidth="0.6" opacity="0.6" />
    </g>
  )
}

/* ================================================================ position: the bed from the side, the head from above */

export function BedSide({ tilt, svgRef }: { tilt: number; svgRef?: Ref<SVGSVGElement> }) {
  // The bed top pivots at its middle; head-down lowers the left end.
  return (
    <svg ref={svgRef} viewBox="0 0 200 110" className="block h-full w-full select-none" data-testid="cvc-bed">
      <rect width="200" height="110" fill="#e8eef2" />
      <rect x="0" y="96" width="200" height="14" fill="#c8d0d6" />
      {/* base and column */}
      <rect x="60" y="86" width="80" height="6" rx="2" fill="#606a78" />
      <circle cx="66" cy="94" r="3" fill="#30343c" />
      <circle cx="134" cy="94" r="3" fill="#30343c" />
      <rect x="94" y="62" width="12" height="25" fill="#808a98" />
      <g transform={`rotate(${-tilt} 100 60)`} style={{ transition: 'transform 60ms linear' }}>
        <rect x="18" y="54" width="164" height="8" rx="2" fill="#a0aab8" stroke="#606a78" />
        <rect x="20" y="46" width="160" height="9" rx="4" fill="#f4f4f0" stroke="#b0b0a8" />
        {/* the manikin: head, neck, torso */}
        <ellipse cx="34" cy="38" rx="11" ry="9" fill={PLASTIC} stroke={PLASTIC_EDGE} />
        <path d="M30 30 Q28 26 32 25" stroke={PLASTIC_EDGE} fill="none" />
        <rect x="43" y="38" width="12" height="8" fill={PLASTIC} stroke={PLASTIC_EDGE} />
        <path d="M54 34 Q60 30 92 32 L140 34 Q150 36 150 46 L54 46 Z" fill={PLASTIC} stroke={PLASTIC_EDGE} />
        <path d="M150 40 L176 42 L176 46 L150 46 Z" fill="#9ab0c4" stroke="#607088" />
      </g>
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">SIDE VIEW</text>
        <text x="4" y="106">HEAD</text>
        <text x="174" y="106">FEET</text>
        <text x="132" y="10" fill={tilt >= 10 && tilt <= 20 ? '#287038' : '#a03030'}>
          {tilt >= 0 ? `${tilt.toFixed(0)}° HEAD-DOWN` : `${(-tilt).toFixed(0)}° HEAD-UP`}
        </text>
      </g>
    </svg>
  )
}

/** The head from the head end of the bed: face up; turning it to her left moves the nose to your right. */
export function HeadTop({ rotation, svgRef }: { rotation: number; svgRef?: Ref<SVGSVGElement> }) {
  const a = (rotation * Math.PI) / 180
  const nx = 50 + Math.sin(a) * 26
  const earR = 50 - Math.cos(a) * 34
  const earL = 50 + Math.cos(a) * 34
  return (
    <svg ref={svgRef} viewBox="0 0 100 100" className="block h-full w-full select-none" data-testid="cvc-head">
      <rect width="100" height="100" fill="#e8eef2" />
      <ellipse cx="50" cy="58" rx="40" ry="18" fill="#f4f4f0" stroke="#b0b0a8" />
      <ellipse cx="50" cy="52" rx="34" ry="30" fill={PLASTIC} stroke={PLASTIC_EDGE} strokeWidth="1.4" />
      {rotation < 80 && <ellipse cx={earL} cy="54" rx={3 * Math.cos(a) + 1} ry="7" fill={PLASTIC} stroke={PLASTIC_EDGE} />}
      <ellipse cx={earR} cy="54" rx={3 + Math.sin(a) * 4} ry="7" fill={PLASTIC} stroke={PLASTIC_EDGE} />
      <path d={`M${nx - 4} 46 L${nx} 34 L${nx + 4} 46 Z`} fill="#dcb898" stroke={PLASTIC_EDGE} />
      <circle cx={nx - 10 + Math.sin(a) * 2} cy="42" r="2.4" fill="#5a4a40" />
      <circle cx={nx + 10 + Math.sin(a) * 2} cy="42" r="2.4" fill="#5a4a40" opacity={rotation > 60 ? 0.4 : 1} />
      <path d={`M${nx - 6} 60 Q${nx} 64 ${nx + 6} 60`} stroke="#8a5a48" fill="none" />
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="9">FROM THE HEAD END</text>
        <text x="4" y="96">HER R</text>
        <text x="74" y="96">HER L</text>
        <text x="58" y="18" fill={rotation <= 45 ? '#287038' : '#a03030'}>
          {rotation.toFixed(0)}° L
        </text>
      </g>
    </svg>
  )
}

/* ================================================================ the neck, from the head of the bed */

export type NeckProps = {
  svgRef?: Ref<SVGSVGElement>
  probe?: { x: number; y: number } | null
  /** The probe in its sterile sheath. */
  sheathed?: boolean
  /** Fraction of the drape pulled over, and whether the fenestration sits on the neck. */
  draped?: boolean
  prepTint?: ReactNode
  /** Wet chlorhexidine shine (0–1). */
  wet?: number
  /** The needle: where it entered (in neck units) and how far in (mm). */
  needle?: { at: { x: number; y: number }; depth: number; flash: 'none' | 'dark' | 'bright'; aspirating: boolean } | null
  /** A lidocaine wheal at this point. */
  wheal?: { x: number; y: number; size: number } | null
  pulse?: boolean
  hands?: boolean
  children?: ReactNode
}

export function NeckView({ svgRef, probe, sheathed, draped, prepTint, wet = 0, needle, wheal, pulse, hands = true, children }: NeckProps) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 150" className="block h-full w-full select-none" data-testid="cvc-neck">
      <rect width="200" height="150" fill="#d8dee4" />
      {/* the neck: clavicle and chest away from you, the jaw near you, the midline on your right */}
      <path d="M0 0 L200 0 L200 150 L0 150 Z" fill={PLASTIC} />
      <path d="M0 20 Q60 26 120 18 Q150 14 168 20" fill="none" stroke={PLASTIC_EDGE} strokeWidth="2.4" />
      <path d="M0 136 Q50 128 96 140 Q130 150 140 150" fill="none" stroke={PLASTIC_EDGE} strokeWidth="2" />
      <text x="4" y="148" fontFamily={FONT} fontSize="4.5" fill={PLASTIC_EDGE}>
        JAW
      </text>
      {/* sternocleidomastoid: the two heads part at the apex of the triangle */}
      <path d={`M36 150 Q64 108 ${veinXOnNeck(NECK.apexY) + 2} ${NECK.apexY}`} stroke={PLASTIC_EDGE} strokeWidth="1" fill="none" opacity="0.6" />
      <path d={`M${veinXOnNeck(NECK.apexY) + 2} ${NECK.apexY} Q120 44 132 20`} stroke={PLASTIC_EDGE} strokeWidth="1" fill="none" opacity="0.6" />
      <path d={`M${veinXOnNeck(NECK.apexY) + 2} ${NECK.apexY} Q72 46 58 22`} stroke={PLASTIC_EDGE} strokeWidth="1" fill="none" opacity="0.6" />
      {/* the trachea and larynx in the midline */}
      <path d="M168 0 L168 150 M196 0 L196 150" stroke={PLASTIC_EDGE} strokeWidth="0.8" opacity="0.5" />
      {[30, 40, 50, 60].map((y) => (
        <path key={y} d={`M170 ${y} Q182 ${y + 3} 194 ${y}`} stroke={PLASTIC_EDGE} strokeWidth="0.7" fill="none" opacity="0.5" />
      ))}
      <ellipse cx="182" cy="78" rx="12" ry="5" fill="none" stroke={PLASTIC_EDGE} strokeWidth="1" opacity="0.7" />
      <path d="M168 104 L182 94 L196 104 L182 118 Z" fill="none" stroke={PLASTIC_EDGE} strokeWidth="1" opacity="0.7" />
      <g fontFamily={FONT} fontSize="4.5" fill={PLASTIC_EDGE}>
        <text x="4" y="14">CLAVICLE · CHEST</text>
        <text x="150" y="88">CRICOID</text>
      </g>
      {pulse && <circle cx={arteryXOnNeck(NECK.apexY)} cy={NECK.apexY} r="4" fill="#d03030" opacity="0.6" className="hare-pulse" />}
      {prepTint}
      {wet > 0 && <ellipse cx="96" cy="74" rx="78" ry="58" fill="#f0a040" opacity={0.08 + wet * 0.22} pointerEvents="none" />}
      {draped && (
        <path
          d="M0 0 L200 0 L200 150 L0 150 Z M40 74 A58 46 0 1 0 156 74 A58 46 0 1 0 40 74 Z"
          fill={DRAPE}
          fillRule="evenodd"
          stroke={DRAPE_DARK}
          strokeWidth="2"
          pointerEvents="none"
        />
      )}
      {wheal && <ellipse cx={wheal.x} cy={wheal.y} rx={2 + wheal.size * 4} ry={1.6 + wheal.size * 3} fill="#f4dcc8" stroke="#c8a088" strokeWidth="0.8" />}
      {needle && <NeedleTop needle={needle} hands={hands} />}
      {probe && <ProbeTop at={probe} sheathed={sheathed} hands={hands} />}
      {children}
    </svg>
  )
}

/** The linear probe seen from above, transverse, its marker on your left; the left hand on it. */
function ProbeTop({ at, sheathed, hands }: { at: { x: number; y: number }; sheathed?: boolean; hands: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
      <rect x="-38" y="-9" width="76" height="18" rx="6" fill={sheathed ? '#c8dce8' : '#3a4250'} stroke={sheathed ? '#90a8b8' : '#181c24'} opacity={sheathed ? 0.95 : 1} />
      <rect x="-30" y="-5" width="60" height="10" rx="4" fill="#2a303a" opacity={sheathed ? 0.55 : 1} />
      <circle cx="-34" cy="0" r="2.2" fill="#f0c040" />
      {sheathed && <path d="M-38 -9 Q-46 -16 -40 -26 M38 -9 Q46 -16 40 -26" stroke="#90a8b8" fill="none" opacity="0.8" />}
      {hands && <Glove x={-14} y={2} angle={-90} scale={0.9} />}
    </g>
  )
}

/** The introducer needle and its syringe from above, coming in from your side under the probe. */
function NeedleTop({ needle, hands }: { needle: NonNullable<NeckProps['needle']>; hands: boolean }) {
  const outside = Math.max(0, NEEDLE_LEN - needle.depth) * Math.SQRT1_2 * NECK.scale * 0.3
  const hubY = needle.at.y + outside
  const blood = needle.flash === 'bright' ? '#e02424' : needle.flash === 'dark' ? '#5a0c14' : null
  return (
    <g pointerEvents="none">
      <line x1={needle.at.x} y1={needle.at.y} x2={needle.at.x} y2={hubY} stroke={STEEL} strokeWidth="1.6" />
      <circle cx={needle.at.x} cy={needle.at.y} r="1.2" fill="#a05040" opacity={needle.depth > 0 ? 0.8 : 0} />
      <rect x={needle.at.x - 3} y={hubY} width="6" height="6" fill="#e8e0b0" stroke="#908050" />
      {/* the 5 mL syringe, its plunger pulled back when you aspirate */}
      <rect x={needle.at.x - 5} y={hubY + 6} width="10" height="26" fill="#f4f8fc" stroke="#7888a0" />
      {blood && <rect x={needle.at.x - 4} y={hubY + 7} width="8" height={needle.flash === 'bright' ? 16 : 10} fill={blood} />}
      <rect x={needle.at.x - 4} y={hubY + 6 + (needle.aspirating ? 16 : 6)} width="8" height="2.5" fill="#30343c" />
      <rect x={needle.at.x - 1.2} y={hubY + 8 + (needle.aspirating ? 14 : 6)} width="2.4" height={needle.aspirating ? 16 : 22} fill="#606878" />
      {hands && <Glove x={needle.at.x + 8} y={hubY + 24} angle={-20} scale={0.6} flip />}
    </g>
  )
}

/* ================================================================ ultrasound */

const PX = 6
export const US = { w: 240, h: 160, mm: PX }

function useSpeckle(n: number, seed: number) {
  return useMemo(() => {
    let s = seed
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: n }, () => ({ x: rnd() * US.w, y: rnd() * US.h, a: 0.12 + rnd() * 0.4, w: 1 + rnd() * 2.5 }))
  }, [n, seed])
}

export type UsProps = {
  svgRef?: Ref<SVGSVGElement>
  /** No probe on the skin: no image. */
  on: boolean
  level?: 'apex' | 'low' | 'high' | null
  /** Probe centre, mm lateral to the vein. */
  probeX: number
  tilt: number
  rotation: number
  press?: number
  /** Long axis: the probe turned along the vein. */
  long?: boolean
  needle?: { entryX: number; depth: number; beam: number; tent: number } | null
  wire?: 'vein' | 'artery' | null
  labels?: { x: number; y: number; text: string }[]
  doppler?: boolean
}

/** Short axis: lateral on the left of the screen (the probe marker is on your left), depth down. 40 × 27 mm. */
export function UsScreen({ svgRef, on, level = 'apex', probeX, tilt, rotation, press = 0, long, needle, wire, labels, doppler }: UsProps) {
  const speck = useSpeckle(460, 11)
  const sx = (mm: number) => US.w / 2 - (mm - probeX) * PX
  const sy = (mm: number) => mm * PX
  // The dent shows on the screen only where the beam is: at the tip.
  const tentSeen = needle && Math.abs(tipOf(needle.depth).y - needle.beam) <= BEAM_HALF + 1.5 ? needle.tent : 0
  const v = veinShape(level === 'high' ? tilt * 0.6 : tilt, press, tentSeen)
  const a = arteryAt(rotation)
  const dot = needle ? needleInBeam(needle.depth, needle.beam) : null
  return (
    <svg ref={svgRef} viewBox={`0 0 ${US.w} ${US.h}`} className="block h-full w-full select-none" data-testid="cvc-us">
      <rect width={US.w} height={US.h} fill="#04060a" />
      {!on ? (
        <text x="74" y="84" fontFamily={FONT} fontSize="7" fill="#606870">
          NO IMAGE
        </text>
      ) : long ? (
        <LongAxis v={v} wire={wire} speck={speck} />
      ) : (
        <g>
          {speck.map((p, i) => (
            <rect key={i} x={p.x} y={p.y} width={p.w} height="1" fill="#c8c8c8" opacity={p.y < 7 ? p.a * 1.4 : p.a} />
          ))}
          <rect x="0" y="0" width={US.w} height="6" fill="#e0e0e0" opacity="0.7" />
          {/* sternocleidomastoid: a dark striated lens over the vessels */}
          <ellipse cx={sx(8)} cy={sy(5.6)} rx={30 * PX * 0.7} ry={2.8 * PX} fill="#1a1c20" opacity="0.75" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={sx(24 - i * 4)} y1={sy(4 + (i % 3))} x2={sx(20 - i * 4)} y2={sy(5 + (i % 3))} stroke="#8a8a8a" opacity="0.35" />
          ))}
          <path d={`M${sx(30)} ${sy(2.8)} Q${sx(8)} ${sy(1.6)} ${sx(-16)} ${sy(3)}`} stroke="#d8d8d8" strokeWidth="1.2" fill="none" opacity="0.7" />
          <path d={`M${sx(30)} ${sy(8.6)} Q${sx(8)} ${sy(9.6)} ${sx(-16)} ${sy(8)}`} stroke="#d8d8d8" strokeWidth="1.2" fill="none" opacity="0.7" />
          {/* thyroid, medially */}
          <path d={`M${sx(-17)} ${sy(4)} Q${sx(-15)} ${sy(12)} ${sx(-19)} ${sy(20)} L${sx(-40)} ${sy(20)} L${sx(-40)} ${sy(4)} Z`} fill="#9a9a9a" opacity="0.35" />
          {/* deep: prevertebral muscle and a transverse process with its shadow */}
          <path d={`M${sx(30)} ${sy(23)} Q${sx(0)} ${sy(22)} ${sx(-30)} ${sy(24)}`} stroke="#c8c8c8" strokeWidth="1.5" fill="none" opacity="0.55" />
          <path d={`M${sx(10)} ${sy(25.2)} Q${sx(5)} ${sy(23.6)} ${sx(0)} ${sy(25.2)}`} stroke="#f0f0f0" strokeWidth="2" fill="none" />
          <rect x={sx(10)} y={sy(25.4)} width={10 * PX * 0.5} height="12" fill="#04060a" opacity="0.8" />
          {/* the carotid: round, thick-walled, pulsing */}
          <circle cx={sx(a.x)} cy={sy(a.z)} r={a.r * PX} fill={doppler ? '#c82424' : '#020304'} stroke="#e0e0e0" strokeWidth="1.8">
            <animate attributeName="r" values={`${a.r * PX};${a.r * PX + 1.8};${a.r * PX}`} dur="0.9s" repeatCount="indefinite" />
          </circle>
          {/* the vein: larger, lateral, thin-walled, squashes */}
          <ellipse cx={sx(v.x)} cy={sy(v.z)} rx={v.rx * PX} ry={v.rz * PX} fill={doppler ? '#2850c0' : '#020304'} stroke="#b0b0b0" strokeWidth="1" />
          {needle && needle.tent > 0.2 && Math.abs(tipOf(needle.depth).y - needle.beam) <= BEAM_HALF + 1.5 && (
            <path d={`M${sx(needle.entryX) - 10} ${sy(v.z - v.rz) - 1} L${sx(needle.entryX)} ${sy(v.z - v.rz) + needle.tent * 2} L${sx(needle.entryX) + 10} ${sy(v.z - v.rz) - 1}`} stroke="#d8d8d8" strokeWidth="1.2" fill="none" />
          )}
          {/* the needle where it crosses the beam: a bright dot with a ring-down tail */}
          {dot && needle && (
            <g data-testid="cvc-dot">
              <circle cx={sx(needle.entryX)} cy={sy(dot.z)} r="2.6" fill="#ffffff" />
              {[4, 8, 12, 16].map((d) => (
                <line key={d} x1={sx(needle.entryX) - 3} y1={sy(dot.z) + d} x2={sx(needle.entryX) + 3} y2={sy(dot.z) + d} stroke="#ffffff" opacity={0.55 - d * 0.03} />
              ))}
            </g>
          )}
          {wire && (
            <g data-testid="cvc-wire-dot">
              <circle cx={wire === 'vein' ? sx(v.x) + 4 : sx(a.x) + 2} cy={wire === 'vein' ? sy(v.z + v.rz * 0.4) : sy(a.z + 1)} r="2.4" fill="#ffffff" />
              <rect x={(wire === 'vein' ? sx(v.x) + 4 : sx(a.x) + 2) - 2} y={(wire === 'vein' ? sy(v.z + v.rz * 0.4) : sy(a.z + 1)) + 3} width="4" height="40" fill="#04060a" opacity="0.7" />
            </g>
          )}
          {level === 'low' && (
            <g>
              <path d={`M0 ${sy(22)} Q${US.w / 2} ${sy(19)} ${US.w} ${sy(22)}`} stroke="#ffffff" strokeWidth="2" fill="none" />
              <text x="6" y={sy(21)} fontFamily={FONT} fontSize="4.5" fill="#a0a8b0">
                PLEURA
              </text>
            </g>
          )}
          {labels?.map((l) => (
            <text key={l.text} x={l.x + 6} y={l.y - 6} fontFamily={FONT} fontSize="5" fill="#f8d030">
              {l.text}
            </text>
          ))}
        </g>
      )}
      <g fontFamily={FONT} fontSize="4.5" fill="#a0a8b0">
        <circle cx="7" cy="7" r="2.4" fill="#f0c040" />
        <text x="12" y="9">{long ? 'HEAD' : 'LAT'}</text>
        <text x={US.w - 24} y="9">
          {long ? 'CHEST' : 'MED'}
        </text>
        {[5, 10, 15, 20, 25].map((mm) => (
          <g key={mm}>
            <line x1={US.w - 4} y1={sy(mm)} x2={US.w} y2={sy(mm)} stroke="#a0a8b0" />
            {mm % 10 === 0 && <text x={US.w - 26} y={sy(mm) + 2}>{mm / 10} CM</text>}
          </g>
        ))}
      </g>
    </svg>
  )
}

function LongAxis({ v, wire, speck }: { v: ReturnType<typeof veinShape>; wire?: 'vein' | 'artery' | null; speck: { x: number; y: number; a: number; w: number }[] }) {
  const top = (v.z - v.rz) * PX
  const bot = (v.z + v.rz) * PX
  return (
    <g>
      {speck.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height="1" fill="#c8c8c8" opacity={p.a} />
      ))}
      <rect x="0" y="0" width={US.w} height="6" fill="#e0e0e0" opacity="0.7" />
      <rect x="0" y={2.6 * PX} width={US.w} height={6 * PX} fill="#1a1c20" opacity="0.6" />
      {wire === 'artery' ? (
        <g>
          <rect x="0" y={top} width={US.w} height={bot - top} fill="#020304" stroke="#b0b0b0" />
          <text x="40" y={bot + 20} fontFamily={FONT} fontSize="5" fill="#a0a8b0">
            NO WIRE IN THE VEIN
          </text>
        </g>
      ) : (
        <g>
          <path d={`M0 ${top} Q${US.w / 2} ${top - 4} ${US.w} ${top + 3} L${US.w} ${bot + 2} Q${US.w / 2} ${bot + 4} 0 ${bot} Z`} fill="#020304" stroke="#b0b0b0" />
          {wire === 'vein' && (
            <path data-testid="cvc-wire-line" d={`M0 ${top - 18} Q30 ${top} 70 ${(top + bot) / 2 + 4} L${US.w} ${(top + bot) / 2 + 8}`} stroke="#ffffff" strokeWidth="2.4" fill="none" />
          )}
        </g>
      )}
    </g>
  )
}

/* ================================================================ the wire, side view */

/**
 * The puncture site from the side, the skin cut away: your side (the head) on the left, the chest on the right.
 * 200 × 150, 3 units to the millimetre near the skin. The needle track runs down to the vein at 45°; outside, the
 * wire runs back up along the track, its far end (the tail) top left.
 */
export const SIDE = { entry: { x: 100, y: 80 }, skinY: 80, mm: 3 }

/** A point on the wire: `s` cm from the skin, outside (s > 0) up along the track, compressed after 15 cm. */
export function wirePoint(s: number) {
  const u = s <= 15 ? s * 4 : 60 + (s - 15) * 0.9
  return { x: SIDE.entry.x - u * Math.SQRT1_2, y: SIDE.entry.y - u * Math.SQRT1_2 }
}

/** Inside: down the track to the vein (about 18 mm), then along the vein toward the chest, compressed. */
export function insidePoint(mm: number) {
  const track = 18
  if (mm <= track) return { x: SIDE.entry.x + mm * SIDE.mm * Math.SQRT1_2, y: SIDE.entry.y + mm * SIDE.mm * Math.SQRT1_2 }
  const start = { x: SIDE.entry.x + track * SIDE.mm * Math.SQRT1_2, y: SIDE.entry.y + track * SIDE.mm * Math.SQRT1_2 }
  const along = mm - track
  const x = start.x + Math.min(along, 20) * 1.6 + Math.max(0, along - 20) * 0.35
  return { x: Math.min(198, x), y: start.y + Math.min(4, along * 0.2) }
}

const pathOf = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

export type SideProps = {
  svgRef?: Ref<SVGSVGElement>
  /** Needle depth along its shaft, mm, or null once it is out. */
  needle?: number | null
  syringe?: 'on' | 'turning' | 'off'
  turn?: number
  flash?: 'none' | 'dark' | 'bright'
  thumb?: boolean
  steadied?: boolean
  advancer?: boolean
  /** Wire at the hub (cm) while the needle is in; or inside length once the needle is out. */
  wireCm?: number
  inside?: number
  wireIn?: 'vein' | 'artery' | null
  grip?: Grip
  sleeve?: Sleeve
  /** Dilator twist, in turns: its stripes roll. */
  twist?: number
  nick?: { x1: number; y1: number; x2: number; y2: number } | null
  scalpel?: { x: number; y: number } | null
  ooze?: number
  gauze?: boolean
  children?: ReactNode
}

export function SideView({ svgRef, needle, syringe = 'on', turn = 0, flash = 'none', thumb, steadied, advancer, wireCm = 0, inside = 0, grip, sleeve, twist = 0, nick, scalpel, ooze = 0, gauze, children }: SideProps) {
  const e = SIDE.entry
  const vein = { top: e.y + 5.5 * SIDE.mm, bot: e.y + 20.5 * SIDE.mm }
  const needleIn = needle != null
  const tipMm = needle ?? 0
  const tip = { x: e.x + tipMm * SIDE.mm * Math.SQRT1_2, y: e.y + tipMm * SIDE.mm * Math.SQRT1_2 }
  // Outside the skin the needle runs back up the track: 64 mm minus what is in, at a smaller scale.
  const hubS = needleIn ? Math.max(0.2, (NEEDLE_LEN - tipMm) / 10) : 0
  const hub = wirePoint(Math.min(hubS, 6.5))
  // While the needle is in, the rest of the wire is still in its sheath; once it is out the wire lies free.
  const wireInside = needleIn ? Math.max(0, wireCm * 10 - (NEEDLE_LEN - tipMm)) : inside * 10
  const insidePts = Array.from({ length: 30 }, (_, i) => insidePoint((wireInside * i) / 29))
  const tail = tailAt(inside)
  const outsidePts = needleIn ? [] : Array.from({ length: 30 }, (_, i) => wirePoint((tail * i) / 29))
  const showWire = needleIn ? wireInside > 0 : inside > 0
  const sleeveDraw = sleeve ? sleevePath(sleeve) : null
  const blood = flash === 'bright' ? '#e02424' : '#5a0c14'
  return (
    <svg ref={svgRef} viewBox="0 0 200 150" className="block h-full w-full select-none" data-testid="cvc-side">
      <rect width="200" height="150" fill={DRAPE} />
      <rect x="0" y="0" width="200" height={e.y} fill="#d8e4ec" />
      {/* the skin, cut away to show the track, the vein running toward the chest */}
      <rect x="0" y={e.y} width="200" height={150 - e.y} fill="#e8c8b0" opacity="0.92" />
      <rect x="0" y={e.y} width="200" height="3" fill={PLASTIC_EDGE} />
      <path d={`M0 ${vein.top} Q100 ${vein.top - 3} 200 ${vein.top + 2} L200 ${vein.bot + 2} Q100 ${vein.bot + 3} 0 ${vein.bot} Z`} fill="#4a5ca8" opacity="0.75" stroke="#2a3878" />
      <g fontFamily={FONT} fontSize="4.5" fill="#f0f0f8">
        <text x="150" y={vein.bot - 4}>IJV → SVC</text>
      </g>
      <g fontFamily={FONT} fontSize="4.5" fill="#506070">
        <text x="4" y="8">SIDE VIEW · SKIN CUT AWAY</text>
        <text x="4" y={e.y - 3}>HEAD</text>
        <text x="174" y={e.y - 3}>CHEST</text>
      </g>
      {nick && <line x1={nick.x1} y1={nick.y1} x2={nick.x2} y2={nick.y2} stroke="#a01818" strokeWidth="2.4" />}
      {ooze > 0 && <ellipse cx={e.x + 4} cy={e.y - 1} rx={3 + ooze * 6} ry={1.4 + ooze * 1.6} fill="#7a1018" opacity="0.85" />}
      {/* wire, inside then outside */}
      {showWire && (
        <g data-testid="cvc-wire">
          <path d={pathOf(insidePts)} stroke="#f4f4f4" strokeWidth="1.4" fill="none" />
          {outsidePts.length > 0 && <path d={pathOf(outsidePts)} stroke="#f4f4f4" strokeWidth="1.4" fill="none" />}
          {outsidePts.length > 0 && <path d={pathOf(outsidePts)} stroke="#808890" strokeWidth="0.5" fill="none" />}
          {/* the mark bands at 10, 20, 30 cm from the tip end */}
          {!needleIn &&
            [10, 20, 30].map((m) => {
              const s = m - inside
              if (s <= 0 || s >= tail) return null
              const p = wirePoint(s)
              return Array.from({ length: m / 10 }, (_, i) => <circle key={`${m}-${i}`} cx={p.x + i * 2} cy={p.y + i * 2} r="1.2" fill="#202020" />)
            })}
        </g>
      )}
      {/* the needle */}
      {needleIn && (
        <g>
          <line x1={hub.x} y1={hub.y} x2={tip.x} y2={tip.y} stroke={STEEL} strokeWidth="2.2" />
          <line x1={hub.x} y1={hub.y} x2={e.x} y2={e.y} stroke="#8890a0" strokeWidth="0.6" />
          <rect x={hub.x - 4} y={hub.y - 4} width="8" height="8" rx="1" fill="#e8e0b0" stroke="#908050" transform={`rotate(45 ${hub.x} ${hub.y})`} />
          {syringe !== 'off' && (
            <g transform={`translate(${hub.x} ${hub.y}) rotate(45) translate(${syringe === 'turning' ? -turn * 6 : 0} 0)`}>
              <rect x="-32" y="-6" width="28" height="12" fill="#f4f8fc" stroke="#7888a0" />
              {flash !== 'none' && <rect x="-16" y="-5" width="12" height="10" fill={blood} />}
              {[0, 1, 2].map((i) => (
                <line key={i} x1={-6 - ((turn * 12 + i * 4) % 12)} y1="-6" x2={-6 - ((turn * 12 + i * 4) % 12)} y2="6" stroke="#9aa8b8" strokeWidth="0.6" />
              ))}
              <rect x="-44" y="-1.5" width="14" height="3" fill="#606878" />
              <rect x="-46" y="-6" width="3" height="12" fill="#303848" />
            </g>
          )}
          {syringe === 'off' && !thumb && !advancer && (
            <g>
              <circle cx={hub.x - 4} cy={hub.y - 4} r={flash === 'bright' ? 3 : 2} fill={blood} className={flash === 'bright' ? 'cvc-spurt' : 'cvc-drip'} />
            </g>
          )}
          {advancer && (
            <g transform={`translate(${hub.x} ${hub.y}) rotate(45)`}>
              <rect x="-22" y="-3" width="20" height="6" rx="2" fill="#5aa8e0" stroke="#2a6890" />
              <path d="M-22 0 Q-34 -12 -44 0" stroke="#5aa8e0" strokeWidth="4" fill="none" />
            </g>
          )}
          {thumb && !advancer && <Glove x={hub.x - 8} y={hub.y - 6} angle={135} scale={0.55} />}
          {steadied && <Glove x={e.x - 22} y={e.y - 2} angle={80} scale={0.6} pinch />}
        </g>
      )}
      {/* dilator or catheter on the wire */}
      {sleeveDraw && sleeve && (
        <g data-testid={`cvc-${sleeve.kind}`}>
          <path d={sleeveDraw.outside} stroke="#303848" strokeWidth={sleeve.kind === 'dilator' ? 6 : 6.4} fill="none" strokeLinecap="round" />
          <path d={sleeveDraw.outside} stroke={sleeve.kind === 'dilator' ? '#a8d8f0' : '#f8f0d8'} strokeWidth={sleeve.kind === 'dilator' ? 4.2 : 4.6} fill="none" strokeLinecap="round" />
          <path d={sleeveDraw.outside} stroke={sleeve.kind === 'dilator' ? '#9aa8b8' : '#c8b888'} strokeWidth="0.8" fill="none" strokeDasharray={sleeve.kind === 'dilator' ? '2 3' : '1 5'} strokeDashoffset={-twist * 10} />
          {sleeveDraw.inside && <path d={sleeveDraw.inside} stroke={sleeve.kind === 'dilator' ? '#a8d8f0' : '#f8f0d8'} strokeWidth="3.4" fill="none" opacity="0.9" />}
          {sleeve.kind === 'catheter' && <CatheterHubs at={wirePoint(Math.max(0.5, sleeve.front + CATH_LEN))} />}
          {sleeve.kind === 'catheter' && sleeve.front < 0 && (
            <text x={e.x - 30} y={e.y + 10} fontFamily={FONT} fontSize="5" fill="#202830">
              {Math.round(-sleeve.front)} CM
            </text>
          )}
        </g>
      )}
      {gauze && <rect x={e.x - 10} y={e.y - 8} width="20" height="10" rx="2" fill="#f8f8f8" stroke="#c0c0c0" />}
      {grip === 'skin' && <Glove x={wirePoint(SKIN_GRIP_CM).x - 9} y={wirePoint(SKIN_GRIP_CM).y + 1} angle={135} scale={0.5} pinch />}
      {grip === 'tail' && <Glove x={wirePoint(tail).x + 6} y={wirePoint(tail).y + 6} angle={-45} scale={0.5} pinch />}
      {scalpel && (
        <g transform={`translate(${scalpel.x} ${scalpel.y}) rotate(-45)`} pointerEvents="none">
          <path d="M0 0 L10 -3 L16 -1 L16 1 L0 0 Z" fill={STEEL} stroke="#808890" strokeWidth="0.5" />
          <rect x="16" y="-1.6" width="26" height="3.2" rx="1" fill="#2a6890" />
        </g>
      )}
      {children}
    </svg>
  )
}

function sleevePath(s: NonNullable<Sleeve>) {
  const len = s.kind === 'dilator' ? DIL_LEN : CATH_LEN
  const back = s.front + len
  const fromOut = Math.max(0, s.front)
  const pts = Array.from({ length: 16 }, (_, i) => wirePoint(fromOut + ((back - fromOut) * i) / 15))
  const insideMm = s.front < 0 ? -s.front * 10 : 0
  const ins = insideMm > 0 ? Array.from({ length: 12 }, (_, i) => insidePoint((insideMm * i) / 11)) : null
  return { outside: pathOf(pts), inside: ins ? pathOf(ins) : null }
}

/** The three hubs of the triple-lumen catheter, on their extension lines. */
function CatheterHubs({ at }: { at: { x: number; y: number } }) {
  return (
    <g>
      {LUMENS.map((l, i) => (
        <g key={l.id}>
          <line x1={at.x} y1={at.y} x2={at.x - 8 + i * 8} y2={at.y - 12} stroke="#f0e8d0" strokeWidth="1.6" />
          <rect x={at.x - 10 + i * 8} y={at.y - 17} width="5" height="6" rx="1" fill={l.colour} stroke="#404040" strokeWidth="0.6" />
        </g>
      ))}
      <rect x={at.x - 4} y={at.y - 3} width="8" height="6" rx="1" fill="#f0e8d0" stroke="#908870" />
    </g>
  )
}

/* ================================================================ the kit: the catheter's three lumens */

export function LumenTray({
  svgRef,
  flushed,
  clamped,
  active,
  fill = 0,
  aspirated = [],
  capped = [],
}: {
  svgRef?: Ref<SVGSVGElement>
  flushed: Lumen[]
  clamped: Lumen[]
  active?: Lumen | null
  fill?: number
  aspirated?: Lumen[]
  capped?: Lumen[]
}) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 110" className="block h-full w-full select-none" data-testid="cvc-tray">
      <rect width="200" height="110" fill={DRAPE} />
      <rect x="6" y="6" width="188" height="98" rx="4" fill="#5a9ac4" stroke={DRAPE_DARK} />
      {/* the catheter body running off to the left, the junction hub, three extension lines to the right */}
      <line x1="10" y1="56" x2="70" y2="56" stroke="#f8f0d8" strokeWidth="4" strokeLinecap="round" />
      {/* depth marks count from the tip, on your left */}
      {[5, 10, 15].map((cm) => (
        <g key={cm}>
          <line x1={12 + cm * 3.6} y1="53" x2={12 + cm * 3.6} y2="59" stroke="#303030" strokeWidth="0.8" />
          <text x={12 + cm * 3.6 - 3} y="66" fontFamily={FONT} fontSize="4" fill="#203040">
            {cm}
          </text>
        </g>
      ))}
      <rect x="68" y="50" width="16" height="12" rx="2" fill="#f0e8d0" stroke="#908870" />
      {LUMENS.map((l, i) => {
        const y = 26 + i * 30
        const isFlushed = flushed.includes(l.id)
        const isClamped = clamped.includes(l.id)
        const isActive = active === l.id
        const blood = aspirated.includes(l.id)
        return (
          <g key={l.id} data-testid={`cvc-lumen-${l.id}`}>
            <path d={`M84 56 Q110 ${y} 140 ${y}`} stroke="#f0e8d0" strokeWidth="3" fill="none" />
            {(isFlushed || (isActive && fill > 0)) && (
              <path d={`M84 56 Q110 ${y} 140 ${y}`} stroke={blood && !isFlushed ? '#6a1018' : '#bfe0ff'} strokeWidth="1.6" fill="none" strokeDasharray="80" strokeDashoffset={isFlushed ? 0 : 80 - fill * 80} />
            )}
            <rect x="140" y={y - 5} width="12" height="10" rx="2" fill={l.colour} stroke="#404040" />
            {(isClamped || capped.includes(l.id)) && <rect x="152" y={y - 4} width="6" height="8" rx="1" fill={l.colour} stroke="#202020" />}
            {l.id !== 'distal' && (
              <g transform={`translate(116 ${y + (i === 0 ? 8 : i === 1 ? 0 : -6)})`}>
                <rect x="-5" y="-4" width="10" height="8" rx="1" fill={isClamped ? '#f8f8f8' : '#d8d8d8'} stroke="#606060" />
                <line x1="-5" y1={isClamped ? 0 : -3} x2="5" y2={isClamped ? 0 : 3} stroke="#404040" strokeWidth="1.2" />
              </g>
            )}
            <text x="160" y={y + 2} fontFamily={FONT} fontSize="4" fill="#f8f8f8">
              {l.id.toUpperCase()}
            </text>
            {isActive && <rect x="138" y={y - 7} width="16" height="14" rx="3" fill="none" stroke="#f8d030" strokeWidth="1.2" />}
          </g>
        )
      })}
      <text x="10" y="18" fontFamily={FONT} fontSize="4.5" fill="#f8f8f8">
        TRIPLE-LUMEN CATHETER
      </text>
    </svg>
  )
}

/* ================================================================ the whole body, for the drape */

export function BodyDrape({ svgRef, draped }: { svgRef?: Ref<SVGSVGElement>; draped: number }) {
  const y = 6 + draped * 150
  return (
    <svg ref={svgRef} viewBox="0 0 100 170" className="block h-full w-full select-none" data-testid="cvc-body">
      <rect width="100" height="170" fill="#e8eef2" />
      <rect x="22" y="4" width="56" height="162" rx="6" fill="#f4f4f0" stroke="#b0b0a8" />
      <ellipse cx="50" cy="18" rx="11" ry="12" fill={PLASTIC} stroke={PLASTIC_EDGE} />
      <rect x="44" y="28" width="12" height="8" fill={PLASTIC} />
      <path d="M30 36 Q50 32 70 36 L70 100 L30 100 Z" fill={PLASTIC} stroke={PLASTIC_EDGE} />
      <path d="M32 100 L46 100 L44 160 L34 160 Z M54 100 L68 100 L66 160 L56 160 Z" fill={PLASTIC} stroke={PLASTIC_EDGE} />
      {/* the drape, pulled from the head toward the feet, its window over her right neck */}
      <path d={`M18 2 L82 2 L82 ${y} L18 ${y} Z M38 28 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0 Z`} fill={DRAPE} fillRule="evenodd" stroke={DRAPE_DARK} opacity="0.95" />
      <rect x="18" y={y - 3} width="64" height="5" rx="2" fill={DRAPE_DARK} />
      <text x="4" y="168" fontFamily={FONT} fontSize="4.5" fill="#40404c">
        {Math.round(draped * 100)}%
      </text>
    </svg>
  )
}

/* ================================================================ barrier precautions */

export function Operator({ garb, scrubbing }: { garb: string[]; scrubbing?: boolean }) {
  const has = (g: string) => garb.includes(g)
  return (
    <svg viewBox="0 0 100 110" className="block h-full w-full select-none" data-testid="cvc-operator">
      <rect width="100" height="110" fill="#e8eef2" />
      {/* scrubs, then the gown over them */}
      <path d="M26 58 Q50 48 74 58 L80 110 L20 110 Z" fill={has('gown') ? '#4a88b0' : '#3aa098'} stroke="#204050" />
      {has('gown') && <path d="M50 52 L50 110" stroke="#2a6088" strokeWidth="0.8" />}
      <circle cx="50" cy="34" r="16" fill="#e8b494" stroke="#8a5238" />
      {has('cap') && <path d="M33 30 Q34 14 50 14 Q66 14 67 30 Q60 26 50 26 Q40 26 33 30 Z" fill="#5a9ad0" stroke="#2a5a88" />}
      <circle cx="44" cy="33" r="1.8" fill="#303030" />
      <circle cx="56" cy="33" r="1.8" fill="#303030" />
      {has('mask') ? <path d="M38 38 L62 38 L60 47 Q50 52 40 47 Z" fill="#a8d8e8" stroke="#5a98b0" /> : <path d="M45 43 Q50 46 55 43" stroke="#8a5238" fill="none" />}
      {/* hands up in front, washing or gloved */}
      <g className={scrubbing ? 'cvc-scrub' : undefined}>
        <Glove x={38} y={84} angle={-8} scale={0.75} />
        <Glove x={62} y={84} angle={8} scale={0.75} flip />
      </g>
      {!has('gloves') && (
        <g>
          <rect x="26" y="66" width="48" height="36" fill="#e8b494" opacity="0.001" />
          <path d="M31 92 Q38 70 45 92 M55 92 Q62 70 69 92" stroke="#e8b494" strokeWidth="9" fill="none" />
        </g>
      )}
      {scrubbing && !has('gloves') && [30, 40, 60, 70].map((x) => <circle key={x} cx={x} cy={78} r="2.4" fill="#ffffff" opacity="0.8" className="cvc-foam" />)}
    </svg>
  )
}

/* ================================================================ monitor */

/** The ECG while the wire goes in: sinus, or ectopics when the J tip reaches the atrium. */
export function EcgStrip({ ectopy }: { ectopy: boolean }) {
  const beat = (x: number, wide: boolean) =>
    wide ? `L${x} 20 L${x + 3} 6 L${x + 7} 34 L${x + 11} 20 L${x + 22} 20` : `L${x} 20 L${x + 2} 18 L${x + 4} 20 L${x + 6} 20 L${x + 7} 6 L${x + 8} 26 L${x + 9} 20 L${x + 14} 20 Q${x + 17} 15 ${x + 20} 20 L${x + 26} 20`
  let d = 'M0 20'
  for (let i = 0; i < 16; i++) d += beat(i * 26, ectopy && i % 3 === 1)
  return (
    <svg viewBox="0 0 200 40" className="block h-full w-full" data-testid="cvc-ecg" preserveAspectRatio="none">
      <rect width="200" height="40" fill="#081008" />
      <g className="cvc-ecg-run">
        <path d={d} stroke={ectopy ? '#f8d030' : '#40e070'} strokeWidth="1.2" fill="none" />
      </g>
      <text x="4" y="8" fontFamily={FONT} fontSize="4.5" fill="#40e070">
        II · HR {ectopy ? '96 ECTOPICS' : '92'}
      </text>
    </svg>
  )
}

/* ================================================================ chest X-ray */

/** A portable AP chest film, her right on your left. The catheter runs down the right of the mediastinum. */
export const CXR = { carinaY: 80 }
export const cxrTipY = (cm: number) => 40 + (cm - 5) * 6.4

export function ChestXray({ svgRef, catheterCm, marks }: { svgRef?: Ref<SVGSVGElement>; catheterCm: number | null; marks?: { x: number; y: number; text: string }[] }) {
  const tipY = cxrTipY(catheterCm ?? 15)
  const ribs = Array.from({ length: 8 }, (_, i) => 50 + i * 15)
  return (
    <svg ref={svgRef} viewBox="0 0 200 200" className="block h-full w-full select-none" data-testid="cvc-cxr">
      <rect width="200" height="200" fill="#0a0a0a" />
      <path d="M20 200 Q10 120 30 50 Q60 30 100 32 Q140 30 170 50 Q190 120 180 200 Z" fill="#3a3a3a" />
      {/* lungs, markings to the edge */}
      <path d="M34 56 Q60 40 90 48 L88 172 Q60 182 30 170 Q24 110 34 56 Z" fill="#151515" />
      <path d="M110 48 Q140 40 166 56 Q176 110 170 170 Q140 182 112 172 Z" fill="#151515" />
      {Array.from({ length: 22 }, (_, i) => {
        const left = i % 2 === 0
        const x0 = left ? 80 : 120
        const x1 = left ? 38 + (i % 5) * 3 : 162 - (i % 5) * 3
        const y = 60 + ((i * 7) % 110)
        return <path key={i} d={`M${x0} ${y} Q${(x0 + x1) / 2} ${y - 6} ${x1} ${y + 8}`} stroke="#3a3a3a" strokeWidth="0.8" fill="none" />
      })}
      {ribs.map((y) => (
        <g key={y} stroke="#6a6a6a" strokeWidth="1.6" fill="none" opacity="0.7">
          <path d={`M92 ${y - 10} Q60 ${y - 14} 34 ${y + 6}`} />
          <path d={`M108 ${y - 10} Q140 ${y - 14} 166 ${y + 6}`} />
        </g>
      ))}
      {/* clavicles, spine, trachea to the carina, heart */}
      <path d="M40 46 Q70 36 94 44 M106 44 Q130 36 160 46" stroke="#b8b8b8" strokeWidth="3.4" fill="none" />
      <rect x="92" y="20" width="16" height="180" fill="#7a7a7a" opacity="0.8" />
      <path d={`M97 10 L97 ${CXR.carinaY} L86 ${CXR.carinaY + 16} M103 10 L103 ${CXR.carinaY} L114 ${CXR.carinaY + 16}`} stroke="#1a1a1a" strokeWidth="3.4" fill="none" />
      <path d="M86 92 Q70 110 72 140 Q80 172 110 174 Q150 172 150 140 Q148 104 112 92 Z" fill="#c8c8c8" opacity="0.9" />
      {/* the SVC: a soft grey band along the right of the mediastinum */}
      <path d="M86 50 L84 100" stroke="#8a8a8a" strokeWidth="8" opacity="0.6" />
      {/* the line, radio-opaque: from the right neck, down beside the trachea, into the SVC */}
      {catheterCm !== null && (
        <g data-testid="cvc-cxr-line">
          <path d={`M66 6 Q74 28 84 44 L86 ${Math.min(tipY, 70)} L87 ${tipY}`} stroke="#101010" strokeWidth="3.6" fill="none" />
          <path d={`M66 6 Q74 28 84 44 L86 ${Math.min(tipY, 70)} L87 ${tipY}`} stroke="#ffffff" strokeWidth="2" fill="none" />
          <circle cx="87" cy={tipY} r="2.2" fill="#ffffff" stroke="#101010" strokeWidth="0.8" />
        </g>
      )}
      {/* ECG leads */}
      {[
        [40, 40],
        [160, 40],
        [150, 180],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="none" stroke="#f0f0f0" strokeWidth="1.4" />
      ))}
      <g fontFamily={FONT} fontSize="5" fill="#d0d0d0">
        <text x="6" y="12">R</text>
        <text x="148" y="12">AP SUPINE</text>
      </g>
      {marks?.map((m) => (
        <text key={m.text} x={m.x + 5} y={m.y - 4} fontFamily={FONT} fontSize="4.5" fill="#f8d030">
          {m.text}
        </text>
      ))}
    </svg>
  )
}

/* ================================================================ securing */

/** The line at the skin from above: the clamp-and-fastener with its two suture wings, and the dressing. */
export function SecureView({ svgRef, sutures, stitching, dressing, dressingY = 0 }: { svgRef?: Ref<SVGSVGElement>; sutures: number; stitching?: number | null; dressing: boolean; dressingY?: number }) {
  const wings = [
    { x: 76, y: 76 },
    { x: 124, y: 76 },
  ]
  return (
    <svg ref={svgRef} viewBox="0 0 200 150" className="block h-full w-full select-none" data-testid="cvc-secure">
      <rect width="200" height="150" fill={DRAPE} />
      <ellipse cx="100" cy="78" rx="80" ry="62" fill={PLASTIC} />
      <ellipse cx="100" cy="78" rx="80" ry="62" fill="#f0a040" opacity="0.12" />
      {/* the catheter leaves the skin and runs to its hub */}
      <circle cx="100" cy="112" r="2" fill="#a05040" />
      <line x1="100" y1="112" x2="100" y2="30" stroke="#f8f0d8" strokeWidth="4" />
      <rect x="86" y="68" width="28" height="16" rx="3" fill="#3a78c8" stroke="#204870" />
      {wings.map((w, i) => (
        <g key={i} data-testid={`cvc-wing-${i}`}>
          <ellipse cx={w.x} cy={w.y} rx="12" ry="7" fill="#5a98e0" stroke="#204870" />
          <circle cx={w.x} cy={w.y} r="2.6" fill={PLASTIC} stroke="#204870" />
          {i < sutures && (
            <g>
              <path d={`M${w.x - 2} ${w.y - 4} Q${w.x} ${w.y - 9} ${w.x + 3} ${w.y - 3}`} stroke="#202060" strokeWidth="1.2" fill="none" />
              <path d={`M${w.x + 3} ${w.y - 3} l4 -5 M${w.x + 3} ${w.y - 3} l6 -2`} stroke="#202060" strokeWidth="1" />
            </g>
          )}
          {stitching === i && <path d={`M${w.x - 10} ${w.y + 6} A10 10 0 0 1 ${w.x + 8} ${w.y - 6}`} stroke={STEEL} strokeWidth="1.6" fill="none" className="cvc-stitch" />}
        </g>
      ))}
      {LUMENS.map((l, i) => (
        <rect key={l.id} x={88 + i * 9} y="20" width="7" height="9" rx="1" fill={l.colour} stroke="#404040" />
      ))}
      {(dressing || dressingY > 0) && (
        <g opacity={dressing ? 1 : 0.85}>
          <rect x="62" y={dressing ? 56 : 56 - (1 - dressingY) * 60} width="76" height="64" rx="6" fill="#f0f8ff" opacity="0.4" stroke="#a0b8c8" />
          <ellipse cx="100" cy={dressing ? 112 : 112 - (1 - dressingY) * 60} rx="8" ry="7" fill="#9ab8e0" opacity="0.8" />
        </g>
      )}
      <g fontFamily={FONT} fontSize="4.5" fill="#f8f8f8">
        <text x="4" y="10">FROM ABOVE · CHEST ↑</text>
      </g>
    </svg>
  )
}
