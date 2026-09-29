import type { Ref } from 'react'
import { along, inward, LIPS, SIZES, TRACK, TRACK_LEN, type IgelSize, type Orientation, type Pt } from './model'

const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'
const BONE = '#f4f0e2'
const BONE_EDGE = '#9a9078'
const FONT = 'Press Start 2P, monospace'

/* ---------------------------------------------------------------- the device on its own */

/** An i-gel seen from the front (the bowl) or the back, tip at the top. Gel shows as translucent dabs. */
export function DeviceView({ size, view, dabs = [], svgRef }: { size: IgelSize; view: 'front' | 'back'; dabs?: Pt[]; svgRef?: Ref<SVGSVGElement> }) {
  const colour = SIZES[size].colour
  return (
    <svg ref={svgRef} viewBox="0 0 120 160" className="block h-full w-full" data-testid={`igel-${view}`}>
      <rect width="120" height="160" fill="#eef3f8" />
      {/* stem, bite block, connector */}
      <rect x="52" y="92" width="16" height="56" rx="3" fill="#dfe8e0" stroke="#7a8a80" />
      <rect x="50" y="108" width="20" height="26" rx="3" fill="#b8c4bc" stroke="#6a7a70" />
      <line x1="50" y1="121" x2="70" y2="121" stroke="#6a7a70" strokeDasharray="2 2" />
      <rect x="50" y="144" width="20" height="10" rx="2" fill={colour} stroke="#40404c" />
      <circle cx="60" cy="149" r="2.5" fill="#40404c" />
      {/* the cuff: narrow tip, wide bowl */}
      <path d="M60 6 C74 8 94 40 92 70 C90 90 76 98 60 98 C44 98 30 90 28 70 C26 40 46 8 60 6 Z" fill="#cfe8d4" stroke="#5a8a64" strokeWidth="1.5" />
      {view === 'front' ? (
        <g>
          <ellipse cx="60" cy="64" rx="18" ry="24" fill="#a8cdb0" stroke="#5a8a64" />
          <path d="M52 60 L68 60 M50 68 L70 68" stroke="#5a8a64" strokeWidth="1.5" />
          <circle cx="60" cy="20" r="2" fill="#40404c" />
        </g>
      ) : (
        <g>
          <path d="M60 12 L60 96" stroke="#8ab894" strokeWidth="5" />
          <path d="M60 12 L60 96" stroke="#5a8a64" strokeWidth="1" />
        </g>
      )}
      {dabs.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="5" fill="#e8f4ff" opacity="0.55" />
      ))}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="10">{view === 'front' ? 'FRONT · BOWL' : 'BACK'}</text>
        <text x="4" y="156">SIZE {size}</text>
      </g>
    </svg>
  )
}

/** A packed i-gel for the size tray. */
export function DeviceChip({ size }: { size: IgelSize }) {
  const c = SIZES[size].colour
  const k = size === 3 ? 0.8 : size === 4 ? 0.9 : 1
  return (
    <svg viewBox="0 0 60 60" className="block h-full w-full">
      <rect width="60" height="60" fill="#eef3f8" />
      <g transform={`translate(30 30) scale(${k}) translate(-30 -30)`}>
        <path d="M30 4 C38 5 46 20 45 32 C44 40 38 44 30 44 C22 44 16 40 15 32 C14 20 22 5 30 4 Z" fill="#cfe8d4" stroke="#5a8a64" />
        <rect x="26" y="44" width="8" height="10" fill="#dfe8e0" stroke="#7a8a80" />
        <rect x="25" y="52" width="10" height="5" fill={c} stroke="#40404c" />
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- the patient, supine */

export type SceneProps = {
  ext: number
  open: number
  pillow: boolean
  size: IgelSize | null
  depth: number
  orientation: Orientation
  folded: boolean
  showDevice: boolean
  showTrack?: boolean
  chest?: number
  tube?: number
  mask?: boolean
  /** A self-inflating bag on the connector; 1 while squeezed. */
  bag?: number
  frameRef?: Ref<SVGGElement>
  svgRef?: Ref<SVGSVGElement>
}

/** Where the head tilts: about the top of the neck. */
const TILT_PIVOT = { x: 96, y: 104 }
/** Where the jaw hinges. */
const TMJ = { x: 92, y: 80 }

/**
 * Midline section of the manikin on the trolley: the top of the head toward you on the left, face up, chest to
 * the right. The head and neck turn together for head tilt; the chest is drawn last so the root of the neck
 * disappears under the shoulder. `frameRef` is the tilted frame the track lives in.
 */
export function SupineScene({ ext, open, pillow, size, depth, orientation, folded, showDevice, showTrack, chest = 0, tube = 0, mask, bag, frameRef, svgRef }: SceneProps) {
  const lift = pillow ? -7 : 0
  const rise = chest * 6
  return (
    <svg ref={svgRef} viewBox="0 0 240 150" className="block h-full w-full" data-testid="igel-scene" style={{ touchAction: 'none' }}>
      <rect width="240" height="150" fill="#f4e8e0" />
      <rect y="132" width="240" height="18" fill="#9aa6b8" />
      <rect y="128" width="240" height="6" fill="#c8d4e0" />
      {pillow && <rect x="16" y="119" width="80" height="11" rx="5" fill="#f8f8f4" stroke="#b8b8b0" />}
      <g transform={`translate(0 ${lift})`}>
        <g ref={frameRef} transform={`rotate(${-ext * 0.45} ${TILT_PIVOT.x} ${TILT_PIVOT.y})`}>
          <Head open={open} />
          {showTrack && <polyline points={TRACK.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.8" />}
          {showDevice && size && <Device size={size} depth={depth} orientation={orientation} folded={folded} tube={tube} bag={bag} />}
          {mask && <path d="M58 34 Q80 4 104 32 L100 42 Q82 30 62 42 Z" fill="#d8ecf8" stroke="#46689a" opacity="0.92" />}
        </g>
      </g>
      {/* the chest, rising with each breath; it covers the root of the neck */}
      <path d={`M134 ${58 + lift / 2} Q168 ${46 - rise} 200 ${50 - rise * 0.7} L238 54 L238 128 L134 128 Z`} fill="#88b0d8" stroke="#46689a" />
      <path d={`M134 ${58 + lift / 2} Q140 ${56 + lift / 2} 146 ${58 - rise * 0.3}`} stroke="#46689a" fill="none" />
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="4" y="146">VERTEX ◀ YOU</text>
        <text x="186" y="146">CHEST ▶</text>
      </g>
    </svg>
  )
}

/** The head and neck in section. The jaw and tongue swing open about the TMJ. */
function Head({ open }: { open: number }) {
  return (
    <g>
      {/* skull, forehead, nose, upper lip; the back of the head and neck */}
      <path d="M14 100 Q8 62 34 46 Q46 38 58 36 L62 36 Q67 28 71 24 Q76 25 77 32 Q80 33 83 37 L86 41 L92 80 L142 84 L142 112 Q104 112 82 124 Q50 134 24 122 Q14 114 14 100 Z" fill={SKIN} stroke={SKIN_EDGE} />
      {/* skin of the throat */}
      <path d="M104 46 Q124 54 142 56 L142 86 L96 86 Z" fill={SKIN} stroke={SKIN_EDGE} />
      {/* mouth and pharynx, open space */}
      <path d="M84 42 L92 44 L106 76 Q112 82 118 82 L136 84 L136 97 L110 99 Q92 97 85 82 Z" fill="#a04858" />
      {/* spine behind the pharynx */}
      {[98, 111, 124, 137].map((x) => (
        <rect key={x} x={x} y="102" width="10" height="7" rx="1.5" fill={BONE} stroke={BONE_EDGE} strokeWidth="0.6" />
      ))}
      <path d="M86 88 Q94 100 112 99 L142 99" stroke="#c86878" strokeWidth="1.5" fill="none" />
      {/* larynx and trachea (front), oesophagus (behind) */}
      <path d="M114 70 L142 70 L142 79 L118 79 Q114 79 113 76 Z" fill="#2a1820" />
      <path d="M120 70 L120 79" stroke="#fffef4" strokeWidth="1.2" />
      {[128, 134, 140].map((x) => (
        <path key={x} d={`M${x} 70 L${x} 79`} stroke="#6a4858" strokeWidth="0.8" />
      ))}
      <path d="M128 87 L142 87 L142 95 L128 95 Z" fill="#b86070" />
      <path d="M128 91 L142 91" stroke="#8a4050" strokeWidth="0.8" />
      <path d="M116 81 Q113 74 109 69" stroke="#f0c0c0" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* jaw, lower teeth, tongue */}
      <g transform={`rotate(${open * 18} ${TMJ.x} ${TMJ.y})`}>
        <path d="M86 42 Q90 45 93 41 Q97 44 100 37 Q107 37 108 48 L112 74 L92 80 Z" fill={SKIN} stroke={SKIN_EDGE} />
        <rect x="88" y="40" width="4" height="5" fill="#fffef4" stroke="#9a9078" strokeWidth="0.5" />
        <path d="M90 47 Q104 50 106 63 Q108 74 104 78 Q96 82 90 77 Q86 64 90 47 Z" fill="#d87080" stroke="#a04858" />
      </g>
      {/* upper teeth, hard palate, soft palate */}
      <rect x="81" y="38" width="4" height="5" fill="#fffef4" stroke="#9a9078" strokeWidth="0.5" />
      <path d="M83 45 L82 70" stroke={BONE} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M83 45 L82 70" stroke={BONE_EDGE} strokeWidth="0.5" />
      <path d="M82 70 Q82 80 88 84" stroke="#e89098" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* the nasal cavity above the palate */}
      <path d="M78 34 L79 68" stroke="#c88878" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
    </g>
  )
}

/* ---------------------------------------------------------------- the device in the airway */

const CUFF = 0.36 * TRACK_LEN
const OUTSIDE_SEATED = 14
const DEVICE_LEN = TRACK_LEN + OUTSIDE_SEATED

/**
 * A point on the device, `u` units from the tip back toward the connector. Inside the mouth it follows the
 * track; outside it comes straight out of the lips.
 */
function devicePoint(depth: number, u: number): { p: Pt; t: Pt } {
  const tipArc = depth * TRACK_LEN
  const arc = tipArc - u
  if (arc >= 0) return along(arc / TRACK_LEN)
  const t0 = along(0).t
  return { p: { x: LIPS.x + t0.x * arc, y: LIPS.y + t0.y * arc }, t: t0 }
}

function strokeAlong(depth: number, from: number, to: number, step = 3) {
  const pts: string[] = []
  for (let u = from; u <= to; u += step) {
    const { p } = devicePoint(depth, u)
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
  const { p } = devicePoint(depth, to)
  pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  return pts.join(' ')
}

function Device({ size, depth, orientation, folded, tube, bag }: { size: IgelSize; depth: number; orientation: Orientation; folded: boolean; tube: number; bag?: number }) {
  const colour = SIZES[size].colour
  const side = orientation === 'chin' ? 1 : -1
  // The bowl lies on the side the outlet faces: toward the tongue when right way up.
  const bowl: string[] = []
  for (let u = 4; u <= CUFF - 6; u += 3) {
    const { p, t } = devicePoint(depth, u)
    const n = inward(t)
    bowl.push(`${(p.x + n.x * 3 * side).toFixed(1)},${(p.y + n.y * 3 * side).toFixed(1)}`)
  }
  const tip = devicePoint(depth, 0)
  const conn = devicePoint(depth, DEVICE_LEN - 4)
  const block = [DEVICE_LEN - 30, DEVICE_LEN - 8] as const
  const tubeEnd = tube > 0 ? Math.min(1, tube) : 0
  return (
    <g data-testid="igel-device">
      <polyline points={strokeAlong(depth, CUFF, DEVICE_LEN - 8)} fill="none" stroke="#7a8a80" strokeWidth="7" strokeLinecap="round" />
      <polyline points={strokeAlong(depth, CUFF, DEVICE_LEN - 8)} fill="none" stroke="#dfe8e0" strokeWidth="5" strokeLinecap="round" />
      <polyline points={strokeAlong(depth, block[0], block[1])} fill="none" stroke="#b8c4bc" strokeWidth="7" />
      <polyline points={strokeAlong(depth, folded ? 8 : 0, CUFF)} fill="none" stroke="#5a8a64" strokeWidth="10" strokeLinecap="round" />
      <polyline points={strokeAlong(depth, folded ? 8 : 0, CUFF)} fill="none" stroke="#cfe8d4" strokeWidth="8" strokeLinecap="round" />
      <polyline points={bowl.join(' ')} fill="none" stroke="#8ab894" strokeWidth="2" />
      {folded && (
        <path
          d={`M${tip.p.x - tip.t.x * 8} ${tip.p.y - tip.t.y * 8} q${-tip.t.y * 8} ${tip.t.x * 8} ${-tip.t.x * 10 - tip.t.y * 6} ${-tip.t.y * 10 + tip.t.x * 6}`}
          stroke="#5a8a64"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
      )}
      <circle cx={conn.p.x} cy={conn.p.y} r="4.5" fill={colour} stroke="#40404c" />
      {bag !== undefined && (
        <g>
          {/* catheter mount with the capnography line, and the bag in your hand toward the top of the head */}
          <path d={`M${conn.p.x} ${conn.p.y} L${conn.p.x - 12} ${conn.p.y}`} stroke="#c8d4e0" strokeWidth="4" />
          <path d={`M${conn.p.x - 6} ${conn.p.y} q2 10 -10 14`} stroke="#f0e060" strokeWidth="1" fill="none" />
          <ellipse cx={conn.p.x - 27} cy={conn.p.y} rx="15" ry={8 * (1 - 0.45 * bag)} fill="#f0d8a0" stroke="#8a6a38" />
        </g>
      )}
      {tubeEnd > 0 && (
        <g>
          <polyline points={strokeAlong(depth, 0, DEVICE_LEN - 4)} fill="none" stroke="#f0d890" strokeWidth="1.6" opacity="0.95" />
          <path d={`M${tip.p.x} ${tip.p.y} L${tip.p.x + 16 * tubeEnd} ${tip.p.y}`} stroke="#f0d890" strokeWidth="1.6" />
        </g>
      )}
    </g>
  )
}

/* ---------------------------------------------------------------- the face, for the tape */

/** The face from above, device in, bite block between the teeth. Tape strokes drawn on top. */
export function FaceFront({ size, stroke, taped, svgRef }: { size: IgelSize; stroke: Pt[]; taped: boolean; svgRef?: Ref<SVGSVGElement> }) {
  const colour = SIZES[size].colour
  return (
    <svg ref={svgRef} viewBox="0 0 100 100" className="block h-full w-full" data-testid="igel-face" style={{ touchAction: 'none' }}>
      <rect width="100" height="100" fill="#f4e8e0" />
      <ellipse cx="50" cy="52" rx="38" ry="46" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M28 34 Q34 30 40 34 M60 34 Q66 30 72 34" stroke={SKIN_EDGE} strokeWidth="1.5" fill="none" />
      <path d="M50 38 L46 52 Q50 55 54 52 Z" fill="#d8a080" stroke={SKIN_EDGE} strokeWidth="0.8" />
      {/* open mouth, the bite block between the teeth */}
      <ellipse cx="50" cy="66" rx="13" ry="8" fill="#a04858" stroke={SKIN_EDGE} />
      <rect x="38" y="59" width="24" height="3" fill="#fffef4" />
      <rect x="38" y="70" width="24" height="3" fill="#fffef4" />
      <rect x="44" y="57" width="12" height="17" rx="2" fill="#b8c4bc" stroke="#6a7a70" />
      <circle cx="50" cy="65" r="4.5" fill={colour} stroke="#40404c" />
      <g fontFamily={FONT} fontSize="4" fill="#40404c">
        <text x="4" y="62">MAXILLA</text>
        <text x="66" y="92">MANDIBLE</text>
      </g>
      {stroke.length > 1 && (
        <polyline
          points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={taped ? '#f8f4e4' : '#f8e8d8'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={taped ? 0.95 : 0.75}
        />
      )}
    </svg>
  )
}

/* ---------------------------------------------------------------- the monitor */

export function IgelMonitor({ spo2, co2 }: { spo2: number; co2: number[] | null }) {
  const low = spo2 < 90
  const pts = (co2 ?? []).map((v, i) => `${(i / 119) * 150 + 44},${30 - v * 20}`).join(' ')
  return (
    <svg viewBox="0 0 200 34" className="block w-full" data-testid="igel-monitor">
      <rect width="200" height="34" fill="#101418" />
      <text x="4" y="12" fontFamily={FONT} fontSize="5" fill="#60c8f0">
        SpO2
      </text>
      <text x="4" y="27" fontFamily={FONT} fontSize="11" fill={low ? '#f06060' : '#60c8f0'} data-testid="igel-spo2">
        {Math.round(spo2)}
      </text>
      <text x="44" y="8" fontFamily={FONT} fontSize="4" fill="#f0e060">
        EtCO2
      </text>
      {co2 ? <polyline points={pts} fill="none" stroke="#f0e060" strokeWidth="1.2" /> : <text x="80" y="22" fontFamily={FONT} fontSize="4" fill="#606870">NOT CONNECTED</text>}
    </svg>
  )
}
