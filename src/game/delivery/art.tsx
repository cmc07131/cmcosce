/**
 * The delivery drawn as it happens, every frame from the run: the view from the foot of the bed as the head crowns,
 * extends, restitutes and the shoulders follow; the baby on her mother's tummy; the abdomen, the cord, the vulva in
 * the third stage; the placenta in the dish.
 */
import type { ReactNode, Ref } from 'react'
import type { useRub } from '../bench/kit'
import { CLAMP_CM, CORD_CM, CONTRACTION, EBL, HEAD, clock, contraction, separated, type BirthRun, type ThirdRun, type View } from './model'

export const FONT = 'Press Start 2P, monospace'
const SKIN = '#e8b494'
const SKIN_DARK = '#d89c7c'
const SKIN_EDGE = '#8a5238'
const MUCOSA = '#c4626a'
const MUCOSA_DEEP = '#8a2e3a'
const SCALP = '#c99a88'
const HAIR = '#3d2c22'
const DRAPE = '#86aebd'
const DRAPE_DARK = '#6f98a8'
const GLOVE = '#efe3c8'
const GLOVE_EDGE = '#9a8a68'
const CORD = '#dfe3ec'
const CORD_STRIPE = '#b4bccf'
const BLOOD = '#9a1020'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
/** Mix two #rrggbb colours. */
export function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(lerp(v, pb[i], clamp01(t))).toString(16).padStart(2, '0')).join('')}`
}

/* ---------------------------------------------------------------- a gloved hand */

/**
 * A gloved hand, palm toward you, fingers pointing along `angle` (degrees, 0 = up). `press` darkens it and shows the
 * push. `flat`: fingers together, as on the head or the uterus.
 */
export function Hand({ x, y, angle = 0, scale = 1, press = false, children }: { x: number; y: number; angle?: number; scale?: number; press?: boolean; children?: ReactNode }) {
  const fill = press ? '#e2d0aa' : GLOVE
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} pointerEvents="none">
      {children}
      <path d="M-11 4 Q-12 -6 -9 -10 L9 -10 Q12 -6 11 4 Q10 12 0 13 Q-10 12 -11 4 Z" fill={fill} stroke={GLOVE_EDGE} strokeWidth="0.9" />
      {[-7.2, -2.4, 2.4, 7.2].map((fx, i) => (
        <rect key={fx} x={fx - 2.3} y={-10 - [13, 16, 15, 11][i]} width="4.6" height={[14, 17, 16, 12][i]} rx="2.3" fill={fill} stroke={GLOVE_EDGE} strokeWidth="0.8" />
      ))}
      <path d="M-11 2 Q-17 -2 -18 -9 Q-17 -12 -14 -10 L-10 -4" fill={fill} stroke={GLOVE_EDGE} strokeWidth="0.8" />
      {press && <path d="M-5 -30 L0 -36 L5 -30 M0 -36 L0 -28" stroke="#6a5a38" strokeWidth="1.2" fill="none" transform="rotate(180 0 -32)" />}
    </g>
  )
}

/* ---------------------------------------------------------------- the toco */

/** The contraction trace for the last 30 seconds, and whether one is on now. */
export function Toco({ t, sub }: { t: number; sub?: string }) {
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const s = t - 30 + i * 0.5
    pts.push(`${40 + i * 2.6},${22 - contraction(Math.max(0, s)) * 16}`)
  }
  const on = contraction(t) > 0.15
  const untilNext = (() => {
    if (t < CONTRACTION.first) return CONTRACTION.first - t
    const u = (t - CONTRACTION.first) % (CONTRACTION.on + CONTRACTION.off)
    return u < CONTRACTION.on ? 0 : CONTRACTION.on + CONTRACTION.off - u
  })()
  return (
    <svg viewBox="0 0 200 26" className="io-figure mt-1 block w-full select-none" data-testid="toco" data-on={on || undefined}>
      <rect width="200" height="26" fill="#f4f0e4" />
      {[6, 14, 22].map((y) => (
        <line key={y} x1="40" x2="196" y1={y} y2={y} stroke="#e0d0c0" strokeWidth="0.5" />
      ))}
      <polyline points={pts.join(' ')} fill="none" stroke="#b83838" strokeWidth="1.4" />
      <text x="3" y="11" fontFamily={FONT} fontSize="4.6" fill={on ? '#b83838' : '#606878'}>
        {on ? 'CONTRACTION' : 'BETWEEN'}
      </text>
      <text x="3" y="20" fontFamily={FONT} fontSize="3.8" fill="#606878">
        {on ? (sub ?? 'SHE PUSHES') : `NEXT ${Math.ceil(untilNext)} S`}
      </text>
    </svg>
  )
}

/* ---------------------------------------------------------------- the head */

/**
 * The baby's head seen from the foot of the bed, occiput toward the pubis (left occipito-anterior turned to direct
 * OA): wet dark hair, the sagittal suture running toward you, the Y of the posterior fontanelle under the pubis. Once
 * it is born the face shows at the bottom, looking down, and restitution turns it to face her right thigh (your left).
 */
function BabyHead({ face, r = 27 }: { face: number; r?: number }) {
  return (
    <g>
      <circle r={r} fill={SCALP} stroke={SKIN_EDGE} strokeWidth="1.2" />
      {/* wet hair over the vertex and occiput */}
      <path d={`M${-r * 0.96} ${r * 0.1} Q${-r} ${-r * 1.05} 0 ${-r} Q${r} ${-r * 1.05} ${r * 0.96} ${r * 0.1} Q${r * 0.5} ${r * 0.42} 0 ${r * 0.38} Q${-r * 0.5} ${r * 0.42} ${-r * 0.96} ${r * 0.1} Z`} fill={HAIR} opacity="0.9" />
      {[-14, -7, 0, 7, 14].map((x) => (
        <path key={x} d={`M${x * 0.9} ${-r * 0.85} q${x * 0.12} 10 ${x * 0.05} 22`} stroke="#5a463a" strokeWidth="0.7" fill="none" />
      ))}
      {/* sagittal suture and the lambda of the posterior fontanelle */}
      <path d={`M0 ${r * 0.3} L0 ${-r * 0.45} M0 ${-r * 0.45} L${-r * 0.42} ${-r * 0.82} M0 ${-r * 0.45} L${r * 0.42} ${-r * 0.82}`} stroke="#d8b8a0" strokeWidth="1.1" fill="none" />
      <circle cy={-r * 0.45} r="1.6" fill="#d8b8a0" />
      {/* vernix and a streak of blood */}
      <path d={`M${r * 0.3} ${-r * 0.2} q4 3 2 8`} stroke="#f4f0e0" strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d={`M${-r * 0.5} ${-r * 0.3} q2 4 -1 8`} stroke={BLOOD} strokeWidth="0.9" fill="none" opacity="0.6" />
      {face > 0 && (
        <g opacity={face}>
          {/* the face, looking down at the bed: brows, closed eyes, nose, mouth, chin at the rim */}
          <path d={`M-12 ${r * 0.5} Q-7 ${r * 0.44} -3 ${r * 0.52} M12 ${r * 0.5} Q7 ${r * 0.44} 3 ${r * 0.52}`} stroke={SKIN_EDGE} strokeWidth="1" fill="none" />
          <path d={`M-11 ${r * 0.62} q4 2 7 0 M11 ${r * 0.62} q-4 2 -7 0`} stroke="#5a3428" strokeWidth="1" fill="none" />
          <ellipse cy={r * 0.74} rx="3.4" ry="2.6" fill="#d89a88" stroke={SKIN_EDGE} strokeWidth="0.7" />
          <path d={`M-5 ${r * 0.88} q5 2.5 10 0`} stroke="#8a3a3a" strokeWidth="1.1" fill="none" />
          <ellipse cx={-r * 0.98} cy="2" rx="3" ry="6" fill="#d8a890" stroke={SKIN_EDGE} strokeWidth="0.8" />
          <ellipse cx={r * 0.98} cy="2" rx="3" ry="6" fill="#d8a890" stroke={SKIN_EDGE} strokeWidth="0.8" />
        </g>
      )}
    </g>
  )
}

/** The loose loop of cord round the neck: behind the head, or lifted up over it. */
function CordLoop({ lift, front }: { lift: number; front: boolean }) {
  const y = -lift * 46
  const rx = 38 + lift * 4
  return (
    <g transform={`translate(0 ${y})`} opacity={front ? 1 : 0.95}>
      <ellipse rx={rx} ry={front ? 12 + lift * 4 : 37} fill="none" stroke={CORD} strokeWidth="7" />
      <ellipse rx={rx} ry={front ? 12 + lift * 4 : 37} fill="none" stroke={CORD_STRIPE} strokeWidth="7" strokeDasharray="2 4" opacity="0.7" />
      <ellipse rx={rx} ry={front ? 12 + lift * 4 : 37} fill="none" stroke="#8090b0" strokeWidth="0.6" />
    </g>
  )
}

/** She is born: in your hands over the perineum, face to her mother's right, the cord running back into the vagina. */
function BornInHands() {
  const b = '#c8a0a8'
  return (
    <g>
      <path d="M112 132 Q140 150 120 166 Q104 176 100 150" stroke={CORD} strokeWidth="5" fill="none" />
      <path d="M112 132 Q140 150 120 166 Q104 176 100 150" stroke={CORD_STRIPE} strokeWidth="5" strokeDasharray="2 4" fill="none" />
      <g stroke={SKIN_EDGE} strokeWidth="1">
        <ellipse cx="74" cy="118" rx="7" ry="15" fill={b} transform="rotate(30 74 118)" />
        <ellipse cx="126" cy="118" rx="7" ry="15" fill={b} transform="rotate(-30 126 118)" />
        <ellipse cx="86" cy="150" rx="8" ry="14" fill={b} transform="rotate(-20 86 150)" />
        <ellipse cx="114" cy="150" rx="8" ry="14" fill={b} transform="rotate(20 114 150)" />
        <ellipse cx="100" cy="122" rx="24" ry="30" fill={b} />
      </g>
      <g transform="translate(100 80) rotate(90)">
        <BabyHead face={1} r={24} />
      </g>
      <Hand x={70} y={96} angle={60} scale={0.85} />
      <Hand x={130} y={128} angle={-60} scale={0.85} />
      <text x="70" y="26" fontFamily={FONT} fontSize="4.6" fill="#f8f8f0">
        BORN · CRYING
      </text>
    </g>
  )
}

export type BirthFrame = {
  holding: boolean
  /** Live traction: −1 up … 1 down. */
  force: number
  /** Finger going round the neck, shown while you feel. */
  feeling: boolean
}

export const BIRTH_VIEW = { w: 200, h: 180, introitus: { x: 100, y: 96 } }

/** Where the head's centre is drawn, for taps on it. */
export function headCentre(r: BirthRun, force = 0) {
  const ext = clamp01((r.head - HEAD.extending) / (HEAD.born - HEAD.extending))
  const shift = r.anterior < 1 ? r.anterior * 14 : 14 - r.posterior * 30
  return { x: BIRTH_VIEW.introitus.x, y: BIRTH_VIEW.introitus.y + ext * 8 + shift + force * 3 }
}

/** The view from the foot of the bed: pubis above, perineum below, her right thigh on your left. */
export function BirthView({ run, frame, svgRef }: { run: BirthRun; frame: BirthFrame; svgRef?: Ref<SVGSVGElement> }) {
  const { x: ix, y: iy } = BIRTH_VIEW.introitus
  const open = clamp01((run.head - 0.3) / (HEAD.extending - 0.3))
  const ext = clamp01((run.head - HEAD.extending) / (HEAD.born - HEAD.extending))
  const rx = lerp(9, 31, open) * (1 - ext * 0.4)
  const ry = lerp(7, 29, open) * (1 - ext * 0.4)
  const stretch = clamp01((run.head - HEAD.crowning) / (HEAD.extending - HEAD.crowning)) * (1 - ext * 0.7)
  const c = headCentre(run, frame.force)
  const scale = lerp(0.82, 1, open) * (1 + ext * 0.2)
  const turn = run.restitution * 90
  const showLoop = run.headBorn && run.loop < 1
  const loopFront = run.loop > 0.25
  const torn = run.headBorn && run.tear !== 'none'
  return (
    <svg ref={svgRef} viewBox={`0 0 ${BIRTH_VIEW.w} ${BIRTH_VIEW.h}`} className="block h-full w-full select-none" data-testid="birth-view">
      <defs>
        <clipPath id="dlv-introitus">
          <ellipse cx={ix} cy={iy} rx={rx - 1.5 + ext * 80} ry={ry - 1.5 + ext * 80} />
        </clipPath>
      </defs>
      <rect width="200" height="180" fill={DRAPE} />
      {/* her perineum and buttocks, the draped thighs either side, the abdomen drape above */}
      <ellipse cx="100" cy="112" rx="66" ry="74" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1" />
      <path d="M0 14 Q52 34 50 100 Q48 150 26 180 L0 180 Z" fill={DRAPE_DARK} stroke="#4f7888" />
      <path d="M200 14 Q148 34 150 100 Q152 150 174 180 L200 180 Z" fill={DRAPE_DARK} stroke="#4f7888" />
      <ellipse cx="100" cy="42" rx="42" ry="22" fill={SKIN_DARK} />
      {[-24, -14, -4, 6, 16, 26].map((x, i) => (
        <path key={x} d={`M${100 + x} ${30 + (i % 2) * 4} q2 -4 4 0`} stroke="#6a4430" strokeWidth="0.8" fill="none" />
      ))}
      <rect width="200" height="16" fill={DRAPE_DARK} />
      {/* labia either side of the introitus, stretched as it opens */}
      <path d={`M${ix} ${iy - ry - 12} Q${ix - rx - 16} ${iy - ry} ${ix - rx - 12} ${iy} Q${ix - rx - 10} ${iy + ry} ${ix} ${iy + ry + 10}`} fill="none" stroke={SKIN_EDGE} strokeWidth="2" />
      <path d={`M${ix} ${iy - ry - 12} Q${ix + rx + 16} ${iy - ry} ${ix + rx + 12} ${iy} Q${ix + rx + 10} ${iy + ry} ${ix} ${iy + ry + 10}`} fill="none" stroke={SKIN_EDGE} strokeWidth="2" />
      <ellipse cx={ix} cy={iy} rx={rx} ry={ry} fill={MUCOSA} stroke={MUCOSA_DEEP} strokeWidth="1.2" />
      {/* the perineum: thin, shiny and pale as the head stretches it */}
      <path d={`M${ix - rx * 0.8} ${iy + ry * 0.72} Q${ix} ${iy + ry + 22 - stretch * 10} ${ix + rx * 0.8} ${iy + ry * 0.72} Q${ix} ${iy + ry + 4} ${ix - rx * 0.8} ${iy + ry * 0.72} Z`} fill={mix(SKIN, '#f6ece6', stretch)} opacity={0.4 + stretch * 0.6} />
      {stretch > 0.3 && <path d={`M${ix - 10} ${iy + ry + 6} q10 3 20 0`} stroke="#ffffff" strokeWidth="1" opacity={stretch} fill="none" />}
      {torn && <path d={`M${ix - 3} ${iy + ry + 1} l2 ${run.tear === 'second' ? 12 : 5} l3 ${run.tear === 'second' ? -10 : -4}`} stroke={BLOOD} strokeWidth={run.tear === 'second' ? 2 : 1.2} fill="none" />}
      <circle cx={ix} cy="166" r="4" fill="#b07a64" stroke={SKIN_EDGE} />
      {/* the cord behind the neck, the head, then the cord eased over it */}
      {!run.born && <g clipPath="url(#dlv-introitus)">
        <g transform={`translate(${c.x} ${c.y}) rotate(${turn})`}>
          {showLoop && !loopFront && <CordLoop lift={run.loop} front={false} />}
          <g transform={`scale(${scale})`}>
            <BabyHead face={ext} />
          </g>
          {showLoop && loopFront && <CordLoop lift={run.loop} front />}
        </g>
      </g>}
      {/* your hands: the left palm on the occiput, the right with a pad guarding the perineum, or one each side */}
      {run.palm && !run.sides && !run.headBorn && <Hand x={c.x} y={iy - ry - 13} angle={180} scale={0.85} press={frame.holding} />}
      {run.guard && !run.sides && !run.born && (
        <Hand x={ix} y={iy + ry + 40 + ext * 6} angle={0} scale={0.9}>
          <rect x="-15" y="-34" width="30" height="16" rx="2" fill="#fbfbf6" stroke="#b8b8a8" />
          <path d="M-12 -30 h24 M-12 -26 h24 M-12 -22 h24" stroke="#d8d8cc" strokeWidth="0.6" />
        </Hand>
      )}
      {run.sides && !run.born && (
        <>
          <Hand x={c.x} y={c.y - 44} angle={180} scale={0.9} press={Math.abs(frame.force) > 0.15} />
          <Hand x={c.x} y={c.y + 44} angle={0} scale={0.9} press={Math.abs(frame.force) > 0.15} />
        </>
      )}
      {frame.feeling && run.headBorn && !run.born && (
        <g transform={`translate(${c.x} ${c.y}) rotate(${-90 + run.felt * 360})`}>
          <path d="M36 0 L58 -3 L58 5 L36 6 Z" fill={GLOVE} stroke={GLOVE_EDGE} />
          <ellipse cx="35" cy="3" rx="6" ry="4.5" fill={GLOVE} stroke={GLOVE_EDGE} strokeWidth="1.2" />
        </g>
      )}
      {/* the shoulders: the anterior from under the pubis, then the posterior over the perineum */}
      {run.anterior > 0 && !run.born && (
        <g transform={`translate(${ix} ${c.y - 44})`}>
          <ellipse rx={22 * run.anterior + 4} ry={9 * run.anterior + 3} fill="#d8a090" stroke={SKIN_EDGE} />
          <path d="M-8 2 q8 5 16 0" stroke={SKIN_EDGE} strokeWidth="0.8" fill="none" opacity={run.anterior} />
          {run.anterior >= 1 && <text x="-25" y="-12" fontFamily={FONT} fontSize="4" fill="#40202a">ANTERIOR</text>}
        </g>
      )}
      {run.posterior > 0 && !run.born && (
        <g transform={`translate(${ix} ${c.y + 44})`}>
          <ellipse rx={22 * run.posterior + 4} ry={9 * run.posterior + 3} fill="#d8a090" stroke={SKIN_EDGE} />
        </g>
      )}
      {run.born && <BornInHands />}
      <g fontFamily={FONT} fontSize="4.4" fill="#203040">
        <text x="4" y="10" fill="#f8f8f0">
          FROM THE FOOT · PUBIS ABOVE
        </text>
        <text x="4" y="176" fill="#f8f8f0">
          HER R
        </text>
        <text x="174" y="176" fill="#f8f8f0">
          HER L
        </text>
        {!run.guard && <text x={ix - 17} y="160" fill="#40202a">PERINEUM</text>}
        {!run.headBorn && open > 0.7 && run.head >= HEAD.crowning && (
          <text x={ix - 18} y={iy - ry - 16} fill="#40202a">
            CROWNING
          </text>
        )}
        {run.restitution >= 1 && !run.anterior && (
          <text x="22" y="68" fill="#40202a">
            ◀ FACING HER R THIGH
          </text>
        )}
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- the baby on mum */

export const BABY_AREA = { cx: 100, cy: 92, rx: 48, ry: 56 }

/** Mum's chest and tummy from above, her head at the top; the baby prone on her, wet until you dry her. */
export function BabyView({ run, rub, svgRef }: { run: BirthRun; rub: ReturnType<typeof useRub>; svgRef?: Ref<SVGSVGElement> }) {
  const pink = clamp01(run.dried * 1.2 + (run.since > 20 ? 0.2 : 0))
  const baby = mix('#a898ac', '#e8a898', pink)
  const wetLeft = rub.cellsHit.length === 0 && run.dried > 0 ? 1 - run.dried : 1
  return (
    <svg ref={svgRef} viewBox="0 0 200 170" className="block h-full w-full select-none" data-testid="birth-baby">
      <defs>
        <mask id="dlv-dry">
          <rect width="200" height="170" fill="white" />
          {rub.cellsHit.map((c, i) => (
            <rect key={i} x={c.x - rub.cellW / 2 - 1} y={c.y - rub.cellH / 2 - 1} width={rub.cellW + 2} height={rub.cellH + 2} fill="black" />
          ))}
        </mask>
      </defs>
      <rect width="200" height="170" fill="#d8e4ea" />
      {/* mum: her chest in a gown, then her tummy */}
      <path d="M10 0 L190 0 L196 170 L4 170 Z" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M10 0 L190 0 L188 22 Q100 34 12 22 Z" fill="#a8c0d8" stroke="#6880a0" />
      {!run.onMum ? (
        <g fontFamily={FONT} fontSize="5" fill="#40404c">
          <text x="34" y="96">
            HER TUMMY, WAITING
          </text>
        </g>
      ) : (
        <g>
          {/* the cord from her tummy, down off the bed to the introitus */}
          <path d="M104 128 Q120 150 150 170" stroke={CORD} strokeWidth="5" fill="none" />
          <path d="M104 128 Q120 150 150 170" stroke={CORD_STRIPE} strokeWidth="5" strokeDasharray="2 4" fill="none" />
          {/* the baby: prone, head turned to one side, arms and legs flexed */}
          <g stroke={SKIN_EDGE} strokeWidth="1">
            <ellipse cx="62" cy="108" rx="10" ry="20" fill={baby} transform="rotate(-30 62 108)" />
            <ellipse cx="138" cy="108" rx="10" ry="20" fill={baby} transform="rotate(30 138 108)" />
            <ellipse cx="66" cy="66" rx="8" ry="16" fill={baby} transform="rotate(50 66 66)" />
            <ellipse cx="134" cy="66" rx="8" ry="16" fill={baby} transform="rotate(-50 134 66)" />
            <ellipse cx="100" cy="94" rx="34" ry="40" fill={baby} />
            <circle cx="100" cy="46" r="22" fill={baby} />
          </g>
          <path d="M92 50 q4 2 8 0" stroke="#5a3428" strokeWidth="1" fill="none" />
          {/* wet: a sheen and vernix, gone wherever you have rubbed */}
          <g mask="url(#dlv-dry)" opacity={run.dryTowel ? 0 : wetLeft} pointerEvents="none">
            {[
              [84, 80, 14],
              [112, 96, 12],
              [96, 118, 10],
              [104, 40, 9],
              [70, 104, 6],
              [130, 70, 6],
            ].map(([x, y, s]) => (
              <g key={`${x}-${y}`}>
                <ellipse cx={x} cy={y} rx={s} ry={s * 0.45} fill="#ffffff" opacity="0.55" />
                <ellipse cx={x + 3} cy={y + 4} rx={s * 0.5} ry={s * 0.3} fill="#f4f0d8" opacity="0.8" />
              </g>
            ))}
            <path d="M74 90 q4 10 0 20 M126 86 q-3 10 1 18" stroke="#ffffff" strokeWidth="1.4" opacity="0.6" fill="none" />
          </g>
          {run.dryTowel && (
            <g>
              <path d="M58 76 Q100 60 142 76 L146 140 Q100 152 54 140 Z" fill="#f4f4ec" stroke="#b8b8a8" />
              <path d="M60 96 h82 M58 116 h86" stroke="#dcdcd0" strokeWidth="1" />
              <path d="M78 40 Q80 20 100 20 Q120 20 122 40 Q100 34 78 40 Z" fill="#f0c8d8" stroke="#a87890" />
              <circle cx="100" cy="18" r="3.5" fill="#f0c8d8" stroke="#a87890" />
            </g>
          )}
          {run.assessed && (
            <g fontFamily={FONT} fontSize="4.4" fill="#205030">
              <text x="142" y="132">
                CRYING
              </text>
              <text x="142" y="140">
                TONE GOOD
              </text>
              <text x="142" y="148">
                HR &gt; 100
              </text>
            </g>
          )}
        </g>
      )}
      <g fontFamily={FONT} fontSize="4.4" fill="#203040">
        <text x="14" y="10" fill="#203040">
          MUM · FROM ABOVE
        </text>
        <text x="14" y="164">
          {run.born ? `BORN ${clock(run.since)} AGO` : 'NOT BORN'}
        </text>
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- the third stage: her abdomen */

export const ABDO = { w: 200, h: 170, thigh: { cx: 44, cy: 150, rx: 26, ry: 14 }, fundus: { cx: 100, cy: 70, rx: 40, ry: 30 } }

/** Where the fundus sits and how it feels: broad and soft at the umbilicus; once separated, firm, globular and higher. */
export function uterusShape(r: ThirdRun) {
  const sep = separated(r) || r.out
  const firm = r.out ? clamp01(0.45 + r.rubbed * 0.55) : sep ? 0.8 : 0.2
  return { cy: sep ? 60 : 72, rx: sep ? 26 : 36, ry: sep ? 26 : 26, firm }
}

/**
 * Her abdomen from the foot of the bed, the baby skin to skin at the top: palpating hands, the uterus, the dashed
 * patch of her right thigh for the oxytocin. `inject` 0–1 animates the needle going in and the plunger down.
 */
export function AbdomenView({ run, palpating, inject, rubAt, twin = false, svgRef }: { run: ThirdRun; palpating: boolean; inject: number; rubAt?: { x: number; y: number } | null; twin?: boolean; svgRef?: Ref<SVGSVGElement> }) {
  const u = uterusShape(run)
  const sweep = palpating ? Math.sin(run.palpated * Math.PI * 4) : 0
  const { thigh } = ABDO
  return (
    <svg ref={svgRef} viewBox="0 0 200 170" className="block h-full w-full select-none" data-testid="third-abdomen">
      <rect width="200" height="170" fill={DRAPE} />
      <path d="M30 0 L170 0 Q186 80 168 130 L32 130 Q14 80 30 0 Z" fill={SKIN} stroke={SKIN_EDGE} />
      {/* the baby on her chest, a hat and a dry towel */}
      <ellipse cx="100" cy="8" rx="42" ry="20" fill="#f4f4ec" stroke="#b8b8a8" />
      <circle cx="78" cy="16" r="11" fill="#e8a898" stroke={SKIN_EDGE} />
      <path d="M67 14 Q68 2 78 2 Q88 2 89 14 Q78 10 67 14 Z" fill="#f0c8d8" stroke="#a87890" />
      <path d="M74 20 q3 1.5 6 0" stroke="#5a3428" strokeWidth="0.8" fill="none" />
      {/* the uterus, felt through the abdominal wall */}
      <ellipse cx="100" cy={u.cy} rx={u.rx} ry={u.ry} fill={mix('#e8b0a0', '#c87060', u.firm)} opacity="0.55" stroke="#a05040" strokeDasharray={u.firm > 0.6 ? undefined : '3 2'} />
      {rubAt && <Hand x={rubAt.x} y={rubAt.y + 10} angle={0} scale={0.9} press />}
      <circle cx="100" cy="66" r="2" fill={SKIN_EDGE} />
      <text x="104" y="68" fontFamily={FONT} fontSize="3.6" fill="#6a3a20">
        UMBILICUS
      </text>
      <path d="M44 122 Q100 112 156 122" stroke={SKIN_EDGE} strokeWidth="1.5" fill="none" />
      {/* her thighs: the right (your left) with the patch for the injection */}
      <path d="M8 130 L92 130 L86 170 L4 170 Z" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M192 130 L108 130 L114 170 L196 170 Z" fill={SKIN} stroke={SKIN_EDGE} />
      {twin && <ellipse cx={thigh.cx} cy={thigh.cy} rx={thigh.rx} ry={thigh.ry} fill="none" stroke={run.oxyAt === null ? '#205080' : '#609060'} strokeDasharray="3 2" />}
      {run.oxyAt !== null && inject <= 0 && <circle cx={thigh.cx} cy={thigh.cy} r="1.4" fill={BLOOD} />}
      {inject > 0 && (
        <g transform={`translate(${thigh.cx} ${thigh.cy - 4 + (1 - Math.min(1, inject * 2)) * -8}) rotate(-90)`}>
          <line x1="0" y1="0" x2="10" y2="0" stroke="#9098a8" strokeWidth="0.8" />
          <rect x="10" y="-3" width="30" height="6" fill="#f4f8fc" stroke="#6878a0" />
          <rect x={12 + Math.max(0, inject - 0.5) * 2 * 22} y="-2.4" width={Math.max(0, 26 - Math.max(0, inject - 0.5) * 2 * 22)} height="4.8" fill="#d8e8f8" />
          <rect x={10 + 30 - 2 - Math.max(0, inject - 0.5) * 2 * 22 + 4} y="-4" width="2" height="8" fill="#404858" />
        </g>
      )}
      {/* palpating hands sweep the fundus and both flanks */}
      {palpating && (
        <>
          <Hand x={100 - 30 + sweep * 10} y={u.cy - 4} angle={-70} scale={0.95} press />
          <Hand x={100 + 30 - sweep * 10} y={u.cy - 4} angle={70} scale={0.95} press />
        </>
      )}
      <g fontFamily={FONT} fontSize="4.2" fill="#203040">
        <text x="4" y="164" fill="#203040">
          HER R THIGH
        </text>
        <text x="132" y="164">
          HER L THIGH
        </text>
        {twin && run.palpated >= 1 && (
          <text x="40" y="112" fill="#40202a">
            ONE UTERUS · NO FETAL PARTS
          </text>
        )}
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- the cord to clamp */

export const CORDV = { w: 200, h: 100, x0: 30, x1: 186, y: 62 }
export const cordX = (cm: number) => CORDV.x0 + (cm / CORD_CM) * (CORDV.x1 - CORDV.x0)
export const cordCm = (x: number) => ((x - CORDV.x0) / (CORDV.x1 - CORDV.x0)) * CORD_CM

/** The cord from the baby's tummy (left) to the introitus (right), pulsing until it is clamped; clamps and the cut on it. */
export function CordView({ run, pulse, svgRef }: { run: ThirdRun; pulse: number; svgRef?: Ref<SVGSVGElement> }) {
  const clamped = run.clampAt !== null || run.forcepsAt !== null
  const fading = clamp01((run.since - 60) / 240)
  const throb = clamped ? 0 : (1 - fading) * (0.5 + 0.5 * Math.sin(pulse * Math.PI * 2 * 2.2))
  const cut = run.cutAt
  const seg = (a: number, b: number, key: string) => (
    <g key={key}>
      <line x1={cordX(a)} x2={cordX(b)} y1={CORDV.y} y2={CORDV.y} stroke={CORD} strokeWidth={8 + throb * 1.6} strokeLinecap="round" />
      <line x1={cordX(a)} x2={cordX(b)} y1={CORDV.y} y2={CORDV.y} stroke={CORD_STRIPE} strokeWidth={8 + throb * 1.6} strokeDasharray="2.5 4" />
      <line x1={cordX(a)} x2={cordX(b)} y1={CORDV.y - 1.5} y2={CORDV.y - 1.5} stroke="#9aa8d0" strokeWidth="1" opacity="0.6" />
      <line x1={cordX(a)} x2={cordX(b)} y1={CORDV.y + 2} y2={CORDV.y + 2} stroke="#d09090" strokeWidth="0.6" opacity="0.6" />
    </g>
  )
  return (
    <svg ref={svgRef} viewBox={`0 0 ${CORDV.w} ${CORDV.h}`} className="block h-full w-full select-none" data-testid="third-cord">
      <rect width="200" height="100" fill="#e6eef2" />
      {/* the baby's tummy at the left, under the towel; the vulva and the drape at the right */}
      <path d="M0 26 Q30 30 34 62 Q30 94 0 98 Z" fill="#e8a898" stroke={SKIN_EDGE} />
      <path d="M0 20 Q24 22 22 40 L0 44 Z" fill="#f4f4ec" stroke="#b8b8a8" />
      <path d="M200 30 Q182 40 184 62 Q182 84 200 92 Z" fill={MUCOSA} stroke={MUCOSA_DEEP} />
      {cut === null ? seg(0, CORD_CM, 'all') : [seg(0, cut - 1.3, 'baby'), seg(cut + 1.3, CORD_CM, 'mum')]}
      {/* where the cord clamp goes */}
      {run.clampAt === null && <rect x={cordX(CLAMP_CM.min)} y={CORDV.y - 9} width={cordX(CLAMP_CM.max) - cordX(CLAMP_CM.min)} height="18" fill="none" stroke="#205080" strokeDasharray="2 2" />}
      {run.clampAt !== null && (
        <g transform={`translate(${cordX(run.clampAt)} ${CORDV.y})`}>
          <rect x="-3" y="-12" width="6" height="24" rx="1.5" fill="#f4f4f8" stroke="#3878b8" strokeWidth="1.2" />
          <rect x="-1" y="-6" width="2" height="12" fill="#3878b8" />
        </g>
      )}
      {run.forcepsAt !== null && (
        <g transform={`translate(${cordX(run.forcepsAt)} ${CORDV.y})`}>
          <path d="M-2 -10 L2 -10 L2 10 L-2 10 Z" fill="#a8b0bc" stroke="#505868" />
          <path d="M0 10 L-8 30 M0 10 L8 30" stroke="#707888" strokeWidth="1.6" />
          <circle cx="-9" cy="33" r="3" fill="none" stroke="#707888" strokeWidth="1.4" />
          <circle cx="9" cy="33" r="3" fill="none" stroke="#707888" strokeWidth="1.4" />
        </g>
      )}
      {cut !== null && run.bleed && <path d={`M${cordX(cut)} ${CORDV.y + 4} q-2 8 1 16 M${cordX(cut) + 3} ${CORDV.y + 4} q2 6 0 12`} stroke={BLOOD} strokeWidth="1.6" fill="none" />}
      <g fontFamily={FONT} fontSize="4.2" fill="#203040">
        <text x="4" y="10">
          HER TUMMY
        </text>
        <text x="160" y="10">
          VULVA
        </text>
        <text x="70" y="24">
          {clamped ? 'NOT PULSING: CLAMPED' : throb > 0.05 || fading < 1 ? 'PULSING' : 'STOPPED PULSING'}
        </text>
        {run.clampAt === null && (
          <text x={cordX(CLAMP_CM.min) - 2} y={CORDV.y - 12} fill="#205080">
            CLAMP HERE
          </text>
        )}
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- the third stage: the vulva and the cord */

export const VULVA = { w: 200, h: 170, guard: { x: 100, y: 30, rx: 34, ry: 10 }, inset: { x: 132, y: 22, w: 62, h: 46 }, gush: { x: 100, y: 122 }, forceps: { x: 100, y: 118 } }

/**
 * From the foot of the bed in the third stage: the cut cord out of the introitus with forceps on it; the gush, the
 * forceps further down as the cord lengthens, the uterus (inset) firm and risen; your guarding hand above the pubis,
 * your other hand drawing the cord; the placenta coming, then the membranes twisting out behind it.
 */
export function VulvaView({ run, force, guardHint = false, svgRef }: { run: ThirdRun; force: number; guardHint?: boolean; svgRef?: Ref<SVGSVGElement> }) {
  const sep = separated(run)
  const len = (sep ? 12 : 0) + run.descent * 12 + force * 3
  const fy = VULVA.forceps.y + len
  const u = uterusShape(run)
  const out = run.out
  const at = run.descent
  const ix = 100
  const iy = 100
  const twist = run.turns
  return (
    <svg ref={svgRef} viewBox="0 0 200 170" className="block h-full w-full select-none" data-testid="third-vulva">
      <rect width="200" height="170" fill={DRAPE} />
      <ellipse cx="100" cy="112" rx="64" ry="70" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M0 14 Q52 34 50 100 Q48 150 26 170 L0 170 Z" fill={DRAPE_DARK} stroke="#4f7888" />
      <path d="M200 14 Q148 34 150 100 Q152 150 174 170 L200 170 Z" fill={DRAPE_DARK} stroke="#4f7888" />
      <ellipse cx="100" cy="42" rx="40" ry="20" fill={SKIN_DARK} />
      <rect width="200" height="16" fill={DRAPE_DARK} />
      {/* where the guarding hand goes, above the pubis */}
      {guardHint && !run.guarded && <ellipse cx={VULVA.guard.x} cy={VULVA.guard.y} rx={VULVA.guard.rx} ry={VULVA.guard.ry} fill="none" stroke="#f8f8f0" strokeDasharray="3 2" />}
      <path d={`M${ix} ${iy - 30} Q${ix - 28} ${iy - 20} ${ix - 24} ${iy} Q${ix - 22} ${iy + 18} ${ix} ${iy + 24}`} fill="none" stroke={SKIN_EDGE} strokeWidth="2" />
      <path d={`M${ix} ${iy - 30} Q${ix + 28} ${iy - 20} ${ix + 24} ${iy} Q${ix + 22} ${iy + 18} ${ix} ${iy + 24}`} fill="none" stroke={SKIN_EDGE} strokeWidth="2" />
      <ellipse cx={ix} cy={iy} rx={out ? 12 : 12 + at * 14} ry={out ? 10 : 10 + at * 12} fill={MUCOSA} stroke={MUCOSA_DEEP} />
      {/* the gush of blood, once it has separated */}
      {sep && !out && <path d={`M${ix - 6} ${iy + 8} q-6 14 -2 28 q4 6 8 0`} fill={BLOOD} opacity="0.85" />}
      {/* the placenta at the introitus, then out in your hands with the membranes twisting behind */}
      {at > 0.3 && !out && <ellipse cx={ix} cy={iy + 2} rx={8 + at * 14} ry={7 + at * 11} fill="#7a1424" stroke="#3a0810" />}
      {at >= 1 && (
        <g>
          <ellipse cx={ix} cy={iy + 30 + (out ? 18 : 0)} rx="26" ry="16" fill="#7a1424" stroke="#3a0810" />
          {[...Array(6)].map((_, i) => (
            <path key={i} d={`M${ix - 14 + i * 5} ${iy + 22 + (out ? 18 : 0)} q3 6 0 14`} stroke="#5a0c18" strokeWidth="0.8" fill="none" />
          ))}
          {!out && (
            <g transform={`translate(${ix} ${iy + 8})`}>
              <path d="M-8 0 Q0 10 8 0 L6 14 Q0 18 -6 14 Z" fill="#c8ccd8" opacity="0.85" stroke="#8890a8" />
              {[0, 1, 2, 3].map((i) => (
                <path key={i} d={`M-6 ${3 + i * 3} q6 ${((twist * 4 + i) % 2) * 2 - 1} 12 0`} stroke="#8890a8" strokeWidth="0.7" fill="none" />
              ))}
            </g>
          )}
          <Hand x={ix - 26} y={iy + 34 + (out ? 18 : 0)} angle={110} scale={0.9} />
          <Hand x={ix + 26} y={iy + 34 + (out ? 18 : 0)} angle={-110} scale={0.9} />
        </g>
      )}
      {/* the cord and its forceps; your hand on them */}
      {!out && at < 1 && (
        <g>
          <path d={`M${ix} ${iy + 4} L${ix} ${fy}`} stroke={CORD} strokeWidth="6" />
          <path d={`M${ix} ${iy + 4} L${ix} ${fy}`} stroke={CORD_STRIPE} strokeWidth="6" strokeDasharray="2 4" />
          {run.snapped ? (
            <path d={`M${ix - 4} ${iy + 26} l8 -3`} stroke={BLOOD} strokeWidth="2" />
          ) : (
            <g transform={`translate(${ix} ${fy})`}>
              <rect x="-2" y="-2" width="4" height="10" fill="#a8b0bc" stroke="#505868" />
              <path d="M0 8 L-6 22 M0 8 L6 22" stroke="#707888" strokeWidth="1.4" />
              <circle cx="-7" cy="25" r="2.6" fill="none" stroke="#707888" strokeWidth="1.2" />
              <circle cx="7" cy="25" r="2.6" fill="none" stroke="#707888" strokeWidth="1.2" />
              {force > 0.1 && <Hand x={0} y={30} angle={0} scale={0.75} press />}
            </g>
          )}
        </g>
      )}
      {run.guarded && <Hand x={VULVA.guard.x} y={VULVA.guard.y + 4} angle={0} scale={0.9} press={force > 0.1} />}
      {run.inversion && <path d={`M${ix - 14} ${iy - 8} q14 10 28 0`} stroke="#7a1424" strokeWidth="3" fill="none" />}
      {/* the abdomen, inset: the uterus as your hand feels it */}
      <g transform={`translate(${VULVA.inset.x} ${VULVA.inset.y})`}>
        <rect width={VULVA.inset.w} height={VULVA.inset.h} rx="3" fill={SKIN} stroke="#203040" />
        <circle cx={VULVA.inset.w / 2} cy="18" r="1.4" fill={SKIN_EDGE} />
        <ellipse cx={VULVA.inset.w / 2} cy={(u.cy - 30) * 0.5} rx={u.rx * 0.6} ry={u.ry * 0.6} fill={mix('#e8b0a0', '#c87060', u.firm)} opacity="0.8" stroke="#a05040" strokeDasharray={u.firm > 0.6 ? undefined : '2 1.5'} />
        <text x="3" y={VULVA.inset.h - 3} fontFamily={FONT} fontSize="3.6" fill="#203040">
          {run.inversion ? 'FUNDUS DIMPLED' : u.firm > 0.6 ? 'FIRM · GLOBULAR' : 'BROAD · SOFT'}
        </text>
      </g>
      <g fontFamily={FONT} fontSize="4.2" fill="#f8f8f0">
        <text x="4" y="10">
          FROM THE FOOT · {clock(run.since)} SINCE BIRTH
        </text>
        {guardHint && !run.guarded && (
          <text x="52" y="46" fill="#40202a">
            ABOVE THE PUBIS
          </text>
        )}
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- the placenta in the dish */

/** The placenta checked three ways: maternal surface, fetal surface with the membranes held up, the cut end of the cord. */
export function PlacentaView({ view }: { view: View | null }) {
  return (
    <svg viewBox="0 0 200 150" className="block h-full w-full select-none" data-testid="third-placenta">
      <rect width="200" height="150" fill="#e6eef2" />
      <path d="M20 40 Q100 10 180 40 Q196 90 180 120 Q100 146 20 120 Q4 90 20 40 Z" fill="#c8d0d8" stroke="#8890a0" />
      {(view === null || view === 'maternal') && (
        <g>
          <ellipse cx="100" cy="80" rx="62" ry="44" fill="#7a1424" stroke="#3a0810" strokeWidth="1.4" />
          {/* cotyledons: lobes separated by grooves, none missing */}
          {[
            'M58 62 Q72 52 86 58',
            'M86 58 Q100 50 114 58',
            'M114 58 Q128 52 142 62',
            'M48 82 Q74 74 100 80 Q126 74 152 82',
            'M56 102 Q80 94 100 102 Q120 94 144 102',
            'M86 58 Q84 70 100 80 Q98 92 100 102 Q100 112 100 122',
            'M114 58 Q118 70 126 76',
            'M70 66 Q76 80 74 96',
            'M128 88 Q132 100 126 114',
          ].map((d) => (
            <path key={d} d={d} stroke="#4a0a16" strokeWidth="1.2" fill="none" />
          ))}
          {[[72, 70], [104, 66], [130, 70], [66, 92], [92, 90], [116, 90], [138, 92], [84, 110], [114, 110]].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="6" ry="3" fill="#9a2434" opacity="0.6" />
          ))}
        </g>
      )}
      {view === 'fetal' && (
        <g>
          {/* held up by the cord: the shiny fetal surface, vessels running from the insertion, the membranes hanging whole */}
          <path d="M70 18 Q100 6 130 18 L150 120 Q100 140 50 120 Z" fill="#dfe3ee" opacity="0.7" stroke="#9aa0b8" />
          <ellipse cx="100" cy="60" rx="46" ry="34" fill="#a8b0c8" stroke="#6a7090" />
          {[[-40, -10], [-30, 20], [0, 30], [30, 22], [40, -8], [10, -28], [-14, -26]].map(([dx, dy]) => (
            <path key={`${dx}-${dy}`} d={`M100 60 q${dx * 0.4} ${dy * 0.2} ${dx} ${dy}`} stroke="#5868a0" strokeWidth="1.3" fill="none" />
          ))}
          <path d="M100 60 L100 4" stroke={CORD} strokeWidth="6" />
          <ellipse cx="100" cy="128" rx="7" ry="4" fill="#e6eef2" stroke="#9aa0b8" />
          <text x="112" y="132" fontFamily={FONT} fontSize="3.6" fill="#203040">
            ONE HOLE
          </text>
        </g>
      )}
      {view === 'cord' && (
        <g>
          <circle cx="100" cy="76" r="44" fill="#eef0f4" stroke="#9aa0b8" strokeWidth="2" />
          <circle cx="100" cy="76" r="44" fill="none" stroke={CORD_STRIPE} strokeWidth="1" strokeDasharray="3 5" />
          {/* two thick-walled arteries, one larger thin-walled vein */}
          <circle cx="82" cy="92" r="7" fill="#b03040" stroke="#f0e0e0" strokeWidth="3" />
          <circle cx="118" cy="92" r="7" fill="#b03040" stroke="#f0e0e0" strokeWidth="3" />
          <ellipse cx="100" cy="60" rx="14" ry="11" fill="#6a2838" stroke="#f0e0e0" strokeWidth="1.2" />
          <g fontFamily={FONT} fontSize="3.8" fill="#203040">
            <text x="58" y="112">
              ARTERY
            </text>
            <text x="118" y="112">
              ARTERY
            </text>
            <text x="90" y="42">
              VEIN
            </text>
          </g>
        </g>
      )}
      <text x="6" y="10" fontFamily={FONT} fontSize="4.2" fill="#203040">
        {view === 'fetal' ? 'FETAL SURFACE · MEMBRANES' : view === 'cord' ? 'CUT END OF THE CORD' : 'MATERNAL SURFACE'}
      </text>
    </svg>
  )
}

/* ---------------------------------------------------------------- tears and blood loss */

/** The perineum under the light: a first-degree tear at the fourchette, skin only, not bleeding. */
export function TearView() {
  return (
    <svg viewBox="0 0 200 90" className="block h-full w-full select-none" data-testid="third-tear">
      <rect width="200" height="90" fill={DRAPE} />
      <ellipse cx="100" cy="46" rx="70" ry="44" fill={SKIN} stroke={SKIN_EDGE} />
      <ellipse cx="100" cy="36" rx="14" ry="18" fill={MUCOSA} stroke={MUCOSA_DEEP} />
      <path d="M96 54 l3 8 l3 -8" stroke={BLOOD} strokeWidth="1.2" fill="#e88080" />
      <circle cx="100" cy="80" r="3" fill="#b07a64" />
      <text x="4" y="10" fontFamily={FONT} fontSize="4" fill="#f8f8f0">
        LIGHT AND LOOK
      </text>
      <text x="112" y="62" fontFamily={FONT} fontSize="3.8" fill="#40202a">
        1ST DEGREE: SKIN ONLY
      </text>
    </svg>
  )
}

/** The jug under the bed and the pads on the scale. */
export function LossView({ jug, pads }: { jug: boolean; pads: boolean }) {
  const level = jug ? EBL.jug / 500 : 0
  return (
    <svg viewBox="0 0 200 80" className="block h-full w-full select-none" data-testid="third-loss">
      <rect width="200" height="80" fill="#e6eef2" />
      {/* a measuring jug, 500 mL */}
      <path d="M20 14 L64 14 L60 72 L24 72 Z" fill="#f4f8fc" stroke="#6878a0" />
      <path d={`M${22 + (1 - level) * 2} ${72 - level * 58} L${62 - (1 - level) * 2} ${72 - level * 58} L60 72 L24 72 Z`} fill={BLOOD} opacity="0.85" />
      {[100, 200, 300, 400, 500].map((ml) => (
        <g key={ml}>
          <line x1="58" x2="64" y1={72 - (ml / 500) * 58} y2={72 - (ml / 500) * 58} stroke="#6878a0" />
          <text x="66" y={74 - (ml / 500) * 58} fontFamily={FONT} fontSize="3.4" fill="#203040">
            {ml}
          </text>
        </g>
      ))}
      {/* the pads on the scale */}
      <rect x="110" y="56" width="70" height="14" rx="2" fill="#d8dce4" stroke="#505868" />
      <rect x="130" y="60" width="30" height="7" fill="#203040" />
      <text x="133" y="65.6" fontFamily={FONT} fontSize="4" fill="#80f080">
        {pads ? `${EBL.pads + 60} G` : '--- G'}
      </text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={118 + i * 8} y={44 - i * 3} width="40" height="10" rx="2" fill={i === 1 ? '#e0a0a0' : '#f4f0f0'} stroke="#b8a8a8" />
      ))}
      <g fontFamily={FONT} fontSize="3.8" fill="#203040">
        <text x="20" y="10">
          JUG {jug ? `${EBL.jug} ML` : ''}
        </text>
        <text x="110" y="10">
          PADS {pads ? `${EBL.pads + 60} G` : ''}
        </text>
        {pads && (
          <text x="110" y="18">
            − 60 G DRY = {EBL.pads} ML
          </text>
        )}
      </g>
    </svg>
  )
}
