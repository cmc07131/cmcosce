/**
 * Gastric lavage drawn from the side of the trolley, every frame from the run: Ms Chan rolled onto her left side, the
 * foot of the trolley raised, a cutaway of her oesophagus and stomach with the tube in it and what the stomach holds,
 * the funnel at the height you hold it, the jug, the bucket and what comes back.
 */
import type { Ref } from 'react'
import { DEPTH, FOOT, FUNNEL_MAX, HEIGHT, MEASURE, type LavageRun } from './model'

export const FONT = 'Press Start 2P, monospace'
const SKIN = '#e8bc98'
const SKIN_EDGE = '#8a5a3c'
const TUBE = '#e8e4c0'
const TUBE_EDGE = '#a8a080'
const CLOUDY = '#d6cc9a'
const CLEAR = '#cfe6f0'
const CHARCOAL = '#262626'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
export function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(lerp(v, pb[i], clamp01(t))).toString(16).padStart(2, '0')).join('')}`
}

export const VIEW = { w: 240, h: 160 }
/** The head end of the trolley, the pivot when the foot goes up. */
const PIVOT = { x: 54, y: 106 }
/** Where the mouth is, lying on her left side, before the tilt. */
const MOUTH = { x: 80, y: 93 }
/** The oesophagus and stomach, as cm from the lips → a point (before the tilt). */
const PATH: [number, number, number][] = [
  [0, 80, 93],
  [8, 85, 96],
  [DEPTH.gag, 90, 98],
  [DEPTH.gagEnd, 98, 98],
  [DEPTH.goj, 126, 95],
  [50, 136, 96],
  [60, 146, 97],
  [70, 151, 94],
]
export const STOMACH = { cx: 140, cy: 96, rx: 16, ry: 6.5 }
/** The epigastrium, on her front: where a correctly laid tube ends. */
export const EPI = { x: MOUTH.x + MEASURE.true * 1.15, y: 88 }

const tilt = (foot: number) => -foot * 0.32
/** A point before the tilt, after it. */
export function tilted(x: number, y: number, foot: number) {
  const a = (tilt(foot) * Math.PI) / 180
  const dx = x - PIVOT.x
  const dy = y - PIVOT.y
  return { x: PIVOT.x + dx * Math.cos(a) - dy * Math.sin(a), y: PIVOT.y + dx * Math.sin(a) + dy * Math.cos(a) }
}

/** The point `cm` along the tube from the lips. */
function along(cm: number) {
  const c = Math.max(0, Math.min(PATH[PATH.length - 1][0], cm))
  for (let i = 1; i < PATH.length; i++) {
    const [d0, x0, y0] = PATH[i - 1]
    const [d1, x1, y1] = PATH[i]
    if (c <= d1) {
      const t = (c - d0) / (d1 - d0)
      return { x: lerp(x0, x1, t), y: lerp(y0, y1, t) }
    }
  }
  return { x: PATH[PATH.length - 1][1], y: PATH[PATH.length - 1][2] }
}

function inside(cm: number) {
  const pts: string[] = []
  for (let c = 0; c <= cm; c += 1) {
    const p = along(c)
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
  const p = along(cm)
  pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  return pts.join(' ')
}

/** Funnel position on screen for a height 0–1. */
export const funnelY = (h: number) => 150 - h * 130
export const FUNNEL_X = 24

export type LavageFrame = {
  /** Something you are doing now, drawn with your hands or the kit. */
  spraying?: boolean
  lubing?: boolean
  pouring?: boolean
  aspirating?: boolean
  listening?: boolean
  /** Which step: decides what the tube's free end carries (nothing, a syringe, the funnel). */
  end: 'none' | 'syringe' | 'funnel'
}

/** The side view. */
export function LavageView({ run, frame, svgRef }: { run: LavageRun; frame: LavageFrame; svgRef?: Ref<SVGSVGElement> }) {
  const a = tilt(run.foot)
  const depth = Math.max(0, run.depth - run.out)
  const mouth = tilted(MOUTH.x, MOUTH.y, run.foot)
  const fy = funnelY(run.height)
  const fill = clamp01(run.stomach / 600)
  const cloud = run.charcoal ? CHARCOAL : mix(CLEAR, CLOUDY, clamp01(run.residue * 1.3))
  const ret = mix(CLEAR, CLOUDY, run.returnCloud)
  const draining = frame.end === 'funnel' && run.height <= HEIGHT.down && run.stomach > 1 && run.funnel <= 0 && depth > DEPTH.goj
  const running = frame.end === 'funnel' && run.height >= HEIGHT.up && run.funnel > 0
  const bucket = clamp01(run.outTotal / 3600)
  const tubeOut = depth > 0 && run.out < run.depth
  // The free end of the tube: at the funnel, at the syringe by her face, or lying on the trolley.
  const end = frame.end === 'funnel' ? { x: FUNNEL_X, y: fy + 16 } : frame.end === 'syringe' ? { x: mouth.x - 26, y: mouth.y - 14 } : { x: mouth.x - 18, y: mouth.y + 8 }
  const tapeAt = run.mark === null ? null : run.mark - depth
  return (
    <svg ref={svgRef} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block h-full w-full select-none" data-testid="lavage-view">
      <defs>
        <clipPath id="lv-stomach">
          <ellipse cx={STOMACH.cx} cy={STOMACH.cy} rx={STOMACH.rx} ry={STOMACH.ry} />
        </clipPath>
      </defs>
      <rect width="240" height="160" fill="#e6eef2" />
      <rect y="146" width="240" height="14" fill="#c4ccd2" />
      {/* the zones of the funnel's height */}
      {frame.end === 'funnel' && (
        <g fontFamily={FONT} fontSize="3.6">
          <rect x="4" y={funnelY(1)} width="44" height={funnelY(HEIGHT.up) - funnelY(1)} fill="#d8f0d0" opacity="0.7" />
          <rect x="4" y={funnelY(HEIGHT.down)} width="44" height={funnelY(0) - funnelY(HEIGHT.down)} fill="#d0e0f4" opacity="0.7" />
          <text x="6" y={funnelY(1) + 5} fill="#2a6a30">
            2 FT UP: IN
          </text>
          <text x="6" y={funnelY(0) - 2} fill="#204a80">
            DOWN: OUT
          </text>
        </g>
      )}
      {/* the bucket on the floor */}
      <g transform={`translate(${FUNNEL_X - 14} 128)`}>
        <path d="M0 0 L28 0 L25 24 L3 24 Z" fill="#9ab0c4" stroke="#506070" />
        <path d={`M${3 - bucket * 0} ${24 - bucket * 22} L${25 + bucket * 2.5} ${24 - bucket * 22} L25 24 L3 24 Z`} fill={ret} opacity="0.9" />
      </g>
      {/* the trolley and Ms Chan, tilted head-down as the foot goes up */}
      <g transform={`rotate(${a} ${PIVOT.x} ${PIVOT.y})`}>
        <rect x="50" y="104" width="186" height="8" rx="2" fill="#f4f4f0" stroke="#8890a0" />
        <rect x="50" y="112" width="186" height="3" fill="#8890a0" />
        {run.lateral ? <Lateral gagging={run.gagging} /> : <Supine />}
        {run.lateral && (
          <g opacity="0.92">
            {/* the cutaway: oesophagus to stomach */}
            <polyline points={inside(PATH[PATH.length - 1][0])} fill="none" stroke="#f0b0a8" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
            <ellipse cx={STOMACH.cx} cy={STOMACH.cy} rx={STOMACH.rx} ry={STOMACH.ry} fill="#f8d8d0" stroke="#c07068" strokeWidth="0.8" opacity="0.85" />
            <g clipPath="url(#lv-stomach)">
              <rect x={STOMACH.cx - STOMACH.rx} y={STOMACH.cy + STOMACH.ry - fill * STOMACH.ry * 2} width={STOMACH.rx * 2} height={fill * STOMACH.ry * 2} fill={cloud} />
              {!run.charcoal &&
                [...Array(Math.round(run.residue * 9))].map((_, i) => (
                  <rect key={i} x={STOMACH.cx - 12 + ((i * 7) % 24)} y={STOMACH.cy + 3 - (i % 3) * 1.6} width="2.2" height="1.4" fill="#f8f8f0" stroke="#a8a080" strokeWidth="0.3" />
                ))}
            </g>
            <text x={STOMACH.cx + 18} y={STOMACH.cy - 8} fontFamily={FONT} fontSize="3.4" fill="#804040">
              STOMACH {Math.round(run.stomach)} ML
            </text>
            {depth > 0 && <polyline points={inside(depth)} fill="none" stroke="#6a5a20" strokeWidth="2.8" strokeLinecap="round" />}
            {depth > 0 && <polyline points={inside(depth)} fill="none" stroke="#e8d880" strokeWidth="1.6" strokeLinecap="round" />}
          </g>
        )}
        {/* the tube laid along her to measure, the epigastrium marked */}
        {run.lateral && run.depth === 0 && run.out === 0 && (
          <g>
            <circle cx={EPI.x} cy={EPI.y} r="4" fill="none" stroke="#205080" strokeDasharray="1.5 1.2" />
            <text x={EPI.x - 14} y={EPI.y - 7} fontFamily={FONT} fontSize="3.4" fill="#205080">
              EPIGASTRIUM
            </text>
            {run.laid > 0 && (
              <g>
                <line x1={MOUTH.x} y1={MOUTH.y - 2} x2={MOUTH.x + run.laid * 1.15} y2={EPI.y} stroke={TUBE} strokeWidth="2.4" />
                <line x1={MOUTH.x} y1={MOUTH.y - 2} x2={MOUTH.x + run.laid * 1.15} y2={EPI.y} stroke={TUBE_EDGE} strokeWidth="0.4" />
              </g>
            )}
            {run.mark !== null && <rect x={MOUTH.x - 1} y={MOUTH.y - 5} width="3" height="5" fill="#3878c8" />}
          </g>
        )}
        {/* the mouth gag and the suction */}
        {run.gagIn && !run.gagOut && <rect x={MOUTH.x - 2} y={MOUTH.y - 3} width="5" height="5" rx="1" fill="#f4f4f8" stroke="#6070a0" strokeWidth="0.6" />}
        {run.suction && (
          <g>
            <path d={`M${MOUTH.x + 2} ${MOUTH.y + 6} q10 10 30 12`} stroke="#c8d8e8" strokeWidth="2" fill="none" />
            <text x={MOUTH.x - 22} y={MOUTH.y + 8} fontFamily={FONT} fontSize="3.2" fill="#305070">
              SUCTION
            </text>
          </g>
        )}
        {/* the foot raised: a gauge at the foot end */}
        <g transform="translate(226 104)">
          <text x="-16" y="-5" fontFamily={FONT} fontSize="3.4" fill={run.foot >= FOOT.min && run.foot <= FOOT.max ? '#2a6a30' : '#40404c'}>
            {Math.round(run.foot)} CM
          </text>
        </g>
      </g>
      {/* trolley legs: the foot end raised */}
      <line x1={PIVOT.x + 4} y1={tilted(PIVOT.x + 4, 115, run.foot).y} x2={PIVOT.x + 4} y2="146" stroke="#8890a0" strokeWidth="2" />
      <line x1={tilted(226, 115, run.foot).x} y1={tilted(226, 115, run.foot).y} x2={tilted(226, 115, run.foot).x} y2="146" stroke="#8890a0" strokeWidth="2" />
      {/* the tube outside her: lips to the free end, the tape on it */}
      {tubeOut && (
        <g>
          <path d={`M${mouth.x} ${mouth.y} Q${mouth.x - 14} ${mouth.y + 18} ${end.x} ${end.y}`} fill="none" stroke={TUBE} strokeWidth="2.6" />
          <path d={`M${mouth.x} ${mouth.y} Q${mouth.x - 14} ${mouth.y + 18} ${end.x} ${end.y}`} fill="none" stroke={TUBE_EDGE} strokeWidth="0.4" />
          {tapeAt !== null && tapeAt >= -1 && tapeAt < 20 && <rect x={mouth.x - 2 - Math.max(0, tapeAt) * 0.6} y={mouth.y + Math.max(0, tapeAt) * 0.9 - 1} width="3" height="4" fill="#3878c8" />}
          {run.pinched && <circle cx={mouth.x - 6} cy={mouth.y + 6} r="3" fill="#f0e0b8" stroke="#9a8a68" />}
        </g>
      )}
      {run.out >= run.depth && run.depth > 0 && (
        <g>
          <path d={`M${mouth.x - 10} ${mouth.y + 20} q-20 4 -40 0`} stroke={TUBE} strokeWidth="2.6" fill="none" />
          <text x={mouth.x - 46} y={mouth.y + 30} fontFamily={FONT} fontSize="3.4" fill="#40404c">
            TUBE OUT
          </text>
        </g>
      )}
      {/* the funnel and the jug */}
      {frame.end === 'funnel' && tubeOut && (
        <g>
          <path d={`M${FUNNEL_X - 9} ${fy} L${FUNNEL_X + 9} ${fy} L${FUNNEL_X + 2} ${fy + 12} L${FUNNEL_X + 2} ${fy + 16} L${FUNNEL_X - 2} ${fy + 16} L${FUNNEL_X - 2} ${fy + 12} Z`} fill="#f4f8fc" stroke="#6878a0" />
          {run.funnel > 0 && <path d={`M${FUNNEL_X - 9 * clamp01(run.funnel / FUNNEL_MAX) - 2} ${fy + 12 - clamp01(run.funnel / FUNNEL_MAX) * 12} L${FUNNEL_X + 9 * clamp01(run.funnel / FUNNEL_MAX) + 2} ${fy + 12 - clamp01(run.funnel / FUNNEL_MAX) * 12} L${FUNNEL_X + 2} ${fy + 12} L${FUNNEL_X - 2} ${fy + 12} Z`} fill={run.charcoal ? CHARCOAL : CLEAR} stroke="#7898b8" strokeWidth="0.4" />}
          <text x={FUNNEL_X + 11} y={fy + 4} fontFamily={FONT} fontSize="3.6" fill="#203040">
            {Math.round(run.funnel)} ML
          </text>
          {frame.pouring && (
            <g>
              <path d={`M${FUNNEL_X + 22} ${fy - 20} L${FUNNEL_X + 36} ${fy - 20} L${FUNNEL_X + 34} ${fy - 4} L${FUNNEL_X + 24} ${fy - 4} Z`} fill="#f4f8fc" stroke="#6878a0" transform={`rotate(-40 ${FUNNEL_X + 29} ${fy - 12})`} />
              <path d={`M${FUNNEL_X + 18} ${fy - 14} Q${FUNNEL_X + 6} ${fy - 10} ${FUNNEL_X + 2} ${fy + 4}`} stroke={CLEAR} strokeWidth="2" fill="none" />
            </g>
          )}
          {draining && <path d={`M${FUNNEL_X} ${fy} L${FUNNEL_X} 134`} stroke={ret} strokeWidth="2.4" strokeDasharray="3 2" />}
          {running && <text x={FUNNEL_X + 11} y={fy + 11} fontFamily={FONT} fontSize="3.4" fill="#2a6a30">RUNNING IN</text>}
          {draining && <text x={FUNNEL_X + 11} y={fy + 11} fontFamily={FONT} fontSize="3.4" fill="#204a80">DRAINING</text>}
        </g>
      )}
      {/* the syringe on the free end, the stethoscope at the epigastrium */}
      {frame.end === 'syringe' && tubeOut && (
        <g transform={`translate(${end.x} ${end.y}) rotate(200)`}>
          <rect x="0" y="-3" width="20" height="6" fill="#f4f8fc" stroke="#6878a0" />
          {frame.aspirating && <rect x="1" y="-2.4" width="10" height="4.8" fill={CLOUDY} />}
          <rect x={frame.aspirating ? 12 : 4} y="-3.6" width="2" height="7.2" fill="#404858" />
          <line x1={frame.aspirating ? 14 : 6} x2={frame.aspirating ? 26 : 18} y1="0" y2="0" stroke="#404858" strokeWidth="1.2" />
        </g>
      )}
      {frame.listening && (
        <g>
          <circle cx={tilted(EPI.x, EPI.y, run.foot).x} cy={tilted(EPI.x, EPI.y, run.foot).y} r="3.4" fill="#c8ccd8" stroke="#404858" />
          <path d={`M${tilted(EPI.x, EPI.y, run.foot).x} ${tilted(EPI.x, EPI.y, run.foot).y - 3} q4 -20 18 -30`} stroke="#404858" strokeWidth="0.9" fill="none" />
          {run.whoosh && (
            <text x={tilted(EPI.x, EPI.y, run.foot).x - 8} y={tilted(EPI.x, EPI.y, run.foot).y - 10} fontFamily={FONT} fontSize="4" fill="#2a6a30">
              WHOOSH
            </text>
          )}
        </g>
      )}
      {/* lignocaine spray at her mouth; the lubricated end */}
      {frame.spraying && (
        <g>
          <rect x={mouth.x - 22} y={mouth.y - 18} width="6" height="12" rx="1.4" fill="#e8f0f8" stroke="#506070" transform={`rotate(-40 ${mouth.x - 19} ${mouth.y - 12})`} />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={mouth.x - 8 + i * 2.4} cy={mouth.y - 6 + i * 1.6} r={0.7 + i * 0.2} fill="#b8d0f0" opacity="0.8" />
          ))}
        </g>
      )}
      {frame.lubing && (
        <text x={mouth.x - 30} y={mouth.y + 22} fontFamily={FONT} fontSize="3.4" fill="#2a6a30">
          LUBRICATING
        </text>
      )}
      {run.vomited && (
        <text x={mouth.x - 10} y={mouth.y - 12} fontFamily={FONT} fontSize="4" fill="#a02020">
          VOMITING!
        </text>
      )}
      {run.gagging && (
        <text x={mouth.x - 4} y={mouth.y - 12} fontFamily={FONT} fontSize="4" fill="#a05020">
          GAGS
        </text>
      )}
      {/* her monitor */}
      <g transform="translate(176 4)" fontFamily={FONT} fontSize="4">
        <rect width="60" height="20" rx="2" fill="#10181c" />
        <text x="4" y="8" fill="#60e080">
          HR {run.gagging || run.vomited ? 118 : 104}
        </text>
        <text x="4" y="16" fill="#60c0f0">
          SPO2 {run.vomited ? 90 : 98}%
        </text>
      </g>
      <text x="4" y="8" fontFamily={FONT} fontSize="4" fill="#40404c">
        {run.lateral ? 'MS CHAN · LEFT LATERAL' : 'MS CHAN · ON HER BACK'}
      </text>
    </svg>
  )
}

/** On her back, seen from the side. */
function Supine() {
  return (
    <g stroke={SKIN_EDGE} strokeWidth="0.8">
      <path d="M86 98 L226 98 Q232 100 226 104 L86 104 Z" fill="#a8c0d8" />
      <circle cx="74" cy="96" r="9" fill={SKIN} />
      <path d="M66 90 Q70 84 80 86" fill="#3a2a22" stroke="none" />
      <path d="M74 87 l-1.5 -3" fill="none" />
      <path d="M86 92 Q120 86 150 92 L150 100 L86 100 Z" fill="#c8d8e8" />
    </g>
  )
}

/** On her left side, facing you: knees bent, her arm forward, a blanket over her legs. */
function Lateral({ gagging }: { gagging: boolean }) {
  return (
    <g stroke={SKIN_EDGE} strokeWidth="0.8">
      {/* body: shoulder, chest, waist, hip */}
      <path d="M84 102 Q86 84 104 82 Q130 80 150 86 Q170 78 186 86 Q196 94 194 104 L84 104 Z" fill="#c8d8e8" />
      {/* the epigastrium and chest, uncovered */}
      <path d="M96 100 Q98 86 112 84 Q130 82 144 88 L144 100 Z" fill={SKIN} />
      {/* legs flexed under the blanket */}
      <path d="M186 90 Q210 84 222 92 Q228 100 220 104 L186 104 Z" fill="#a8c0d8" />
      {/* arm forward */}
      <path d="M100 98 Q110 102 122 100" fill="none" strokeWidth="2.4" stroke={SKIN} />
      {/* head on her left side, facing you: top of her head toward the head end */}
      <ellipse cx="76" cy="92" rx="11" ry="10" fill={SKIN} />
      <path d="M66 86 Q64 96 70 102 Q66 92 72 84 Z" fill="#3a2a22" stroke="none" />
      <path d="M65 90 Q66 82 74 82 Q70 86 68 94 Z" fill="#3a2a22" stroke="none" />
      {gagging ? (
        <path d="M73 88 l3 1.4 M73 95 l3 -1.4" stroke="#40281c" strokeWidth="0.9" />
      ) : (
        <path d="M73 88.5 h3 M73 95.5 h3" stroke="#40281c" strokeWidth="0.9" />
      )}
      <path d="M78 92 l2 0.5" stroke={SKIN_EDGE} />
    </g>
  )
}

/** The return in a specimen pot, held to the light. */
export function ReturnPot({ cloud, label }: { cloud: number; label: string }) {
  return (
    <svg viewBox="0 0 60 40" className="block h-full w-full select-none">
      <rect width="60" height="40" fill="#e6eef2" />
      <rect x="14" y="8" width="20" height="26" rx="2" fill="#f8fbfd" stroke="#6878a0" />
      <rect x="15" y="16" width="18" height="17" fill={mix(CLEAR, CLOUDY, cloud)} />
      {[...Array(Math.round(cloud * 6))].map((_, i) => (
        <rect key={i} x={17 + ((i * 5) % 14)} y={28 - (i % 3) * 3} width="2" height="1.2" fill="#f8f8f0" stroke="#a8a080" strokeWidth="0.3" />
      ))}
      <rect x="12" y="5" width="24" height="4" rx="1" fill="#c84040" />
      <text x="38" y="22" fontFamily={FONT} fontSize="3.4" fill="#203040">
        {label}
      </text>
    </svg>
  )
}
