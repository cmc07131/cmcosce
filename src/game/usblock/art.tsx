import { useMemo, type ReactNode, type Ref } from 'react'
import { ARTERY, FASCIA_LATA_Y, NERVE, US, VEIN, fasciaIliacaY, type Probe, type Pt } from './model'

const FONT = 'Press Start 2P, monospace'
const SKIN = '#e8b494'
const SKIN_EDGE = '#8a5238'

/* ---------------------------------------------------------------- the groin */

/** Her left groin from the front: the ASIS on your right, the pubic tubercle on your left. */
export const GROIN = { asis: { x: 176, y: 34 }, pubic: { x: 54, y: 84 }, pulse: { x: 112, y: 74 } }
export const ligamentY = (x: number) => GROIN.pubic.y + ((x - GROIN.pubic.x) * (GROIN.asis.y - GROIN.pubic.y)) / (GROIN.asis.x - GROIN.pubic.x)

export function probeZone(p: Pt): Probe {
  if (p.y < ligamentY(p.x) + 4) return 'above'
  if (p.x < GROIN.pulse.x + 12) return 'medial'
  if (p.x > 162) return 'lateral'
  return 'good'
}

export function GroinView({ svgRef, probe, pulse, children }: { svgRef?: Ref<SVGSVGElement>; probe?: Pt | null; pulse?: boolean; children?: ReactNode }) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 160" className="block h-full w-full select-none" data-testid="usblock-groin">
      <rect width="200" height="160" fill="#eef2f4" />
      <path d="M0 0 L200 0 L200 160 L40 160 Q30 120 0 110 Z" fill={SKIN} stroke={SKIN_EDGE} />
      <path d="M0 110 Q30 120 40 160" fill="none" stroke={SKIN_EDGE} strokeWidth="1.5" />
      {/* drape edge at the top */}
      <rect x="0" y="0" width="200" height="16" fill="#5aa0c8" />
      <circle cx={GROIN.asis.x} cy={GROIN.asis.y} r="4" fill="none" stroke={SKIN_EDGE} />
      <circle cx={GROIN.pubic.x} cy={GROIN.pubic.y} r="3" fill="none" stroke={SKIN_EDGE} />
      <line x1={GROIN.pubic.x} y1={GROIN.pubic.y} x2={GROIN.asis.x} y2={GROIN.asis.y} stroke={SKIN_EDGE} strokeDasharray="3 3" />
      {pulse && <circle cx={GROIN.pulse.x} cy={GROIN.pulse.y} r="4" fill="#d03030" opacity="0.7" className="hare-pulse" />}
      <g fontFamily={FONT} fontSize="5" fill="#40404c">
        <text x="150" y="28">ASIS</text>
        <text x="28" y="96">PUBIC TUB.</text>
        <text x="4" y="10" fill="#f8f8f8">
          LEFT GROIN
        </text>
      </g>
      {children}
      {probe && (
        <g>
          <rect x={probe.x - 18} y={probe.y - 5} width="36" height="10" rx="3" fill="#303848" stroke="#101418" />
          <rect x={probe.x - 18} y={probe.y + 3} width="36" height="2" fill="#88c8f0" />
        </g>
      )}
    </svg>
  )
}

/* ---------------------------------------------------------------- the ultrasound screen */

/** Fixed speckle so the image does not shimmer between renders. */
function useSpeckle(n: number) {
  return useMemo(() => {
    let s = 7
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: n }, () => ({ x: rnd() * US.w, y: rnd() * US.h, a: 0.15 + rnd() * 0.35, w: 1 + rnd() * 2 }))
  }, [n])
}

export function panOf(probe: Probe | null) {
  return probe === 'medial' ? 60 : probe === 'lateral' ? -80 : 0
}

export function UsImage({
  probe,
  doppler,
  tip,
  plane,
  pools,
  svgRef,
  labels,
}: {
  probe: Probe | null
  doppler?: boolean
  tip?: Pt | null
  plane?: 'in' | 'out' | null
  /** mL injected under the fascia, above it, and into the muscle. */
  pools?: { under: number; above: number; muscle: number; at: Pt | null }
  svgRef?: Ref<SVGSVGElement>
  labels?: { p: Pt; text: string }[]
}) {
  const speck = useSpeckle(420)
  const pan = panOf(probe)
  const under = pools?.under ?? 0
  const lift = under > 0 ? Math.min(16, 3 + under / 2.5) : 0
  const at = pools?.at
  // The fascia iliaca, lifted by the pool beneath it around the needle tip.
  const fascia = Array.from({ length: 49 }, (_, i) => {
    const x = i * 5
    const bump = at && under > 0 ? lift * Math.exp(-(((x - (at.x - under * 0.6)) / (14 + under * 1.6)) ** 2)) : 0
    return `${x},${(fasciaIliacaY(x) - bump).toFixed(1)}`
  }).join(' ')
  return (
    <svg ref={svgRef} viewBox={`0 0 ${US.w} ${US.h}`} className="block h-full w-full select-none" data-testid="usblock-us">
      <rect width={US.w} height={US.h} fill="#05070a" />
      {!probe ? (
        <text x="70" y="84" fontFamily={FONT} fontSize="7" fill="#606870">
          NO IMAGE
        </text>
      ) : probe === 'above' ? (
        <g>
          {speck.map((p, i) => (
            <rect key={i} x={p.x} y={p.y} width={p.w} height="1" fill="#c8c8c8" opacity={p.a * 0.8} />
          ))}
          {[60, 130, 190].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="70" rx="22" ry="10" fill="#d8d8d8" opacity="0.5" />
              <rect x={x - 10} y="78" width="20" height="80" fill="#05070a" opacity="0.85" />
            </g>
          ))}
          <text x="6" y="152" fontFamily={FONT} fontSize="5" fill="#a0a8b0">
            BOWEL GAS · ABOVE THE LIGAMENT
          </text>
        </g>
      ) : (
        <g transform={`translate(${pan} 0)`}>
          {speck.map((p, i) => (
            <rect key={i} x={p.x - pan} y={p.y} width={p.w} height="1" fill="#c8c8c8" opacity={p.y < FASCIA_LATA_Y ? p.a * 0.6 : p.a} />
          ))}
          <rect x={-pan} y="0" width={US.w} height="5" fill="#e8e8e8" opacity="0.8" />
          <line x1={-pan} y1={FASCIA_LATA_Y} x2={US.w - pan} y2={FASCIA_LATA_Y} stroke="#f0f0f0" strokeWidth="1.6" />
          {/* sartorius, laterally between the fasciae */}
          <path d={`M160 ${FASCIA_LATA_Y} Q210 ${FASCIA_LATA_Y + 8} 260 ${FASCIA_LATA_Y + 4} L260 ${fasciaIliacaY(240) - 4} Q200 ${fasciaIliacaY(200) - 8} 160 ${FASCIA_LATA_Y + 18} Z`} fill="#8a8a8a" opacity="0.25" />
          {/* iliacus striations under the fascia */}
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={60 + i * 14} y1={fasciaIliacaY(60 + i * 14) + 10} x2={80 + i * 14} y2={fasciaIliacaY(80 + i * 14) + 40} stroke="#9a9a9a" opacity="0.25" />
          ))}
          {/* vessels: dark, the artery pulsing */}
          <ellipse cx={VEIN.x} cy={VEIN.y} rx={VEIN.r + 2} ry={VEIN.r - 1} fill={doppler ? '#2050c0' : '#020304'} stroke="#707070" />
          <circle cx={ARTERY.x} cy={ARTERY.y} r={ARTERY.r} fill={doppler ? '#d02828' : '#020304'} stroke="#c8c8c8" strokeWidth="1.4">
            <animate attributeName="r" values={`${ARTERY.r};${ARTERY.r + 1.6};${ARTERY.r}`} dur="0.8s" repeatCount="indefinite" />
          </circle>
          {/* the nerve: a bright honeycomb triangle under the fascia */}
          <path d={`M${NERVE.x - 9} ${NERVE.y - 5} L${NERVE.x + 9} ${NERVE.y - 6} L${NERVE.x + 1} ${NERVE.y + 7} Z`} fill="#d8d8d8" opacity="0.85" />
          <circle cx={NERVE.x - 2} cy={NERVE.y - 2} r="1.6" fill="#303030" />
          <circle cx={NERVE.x + 3} cy={NERVE.y - 2} r="1.4" fill="#303030" />
          {/* pools of injectate */}
          {at && under > 0 && (
            <g>
              <ellipse cx={at.x - under * 0.6} cy={fasciaIliacaY(at.x) - lift / 2 + 2} rx={14 + under * 1.6} ry={lift / 2 + 2} fill="#000000" />
              <path d={`M${at.x - under * 0.6 - 14 - under * 1.6} ${fasciaIliacaY(at.x) + 3} Q${at.x - under * 0.6} ${fasciaIliacaY(at.x) + 6} ${at.x - under * 0.6 + 14 + under * 1.6} ${fasciaIliacaY(at.x) + 2}`} stroke="#b8b8b8" strokeWidth="1" fill="none" opacity="0.7" />
            </g>
          )}
          {at && (pools?.above ?? 0) > 0 && <ellipse cx={at.x} cy={at.y} rx={6 + (pools?.above ?? 0) * 0.9} ry={3 + (pools?.above ?? 0) * 0.3} fill="#020304" />}
          {at && (pools?.muscle ?? 0) > 0 && <ellipse cx={at.x} cy={at.y} rx={4 + (pools?.muscle ?? 0) * 0.5} ry={4 + (pools?.muscle ?? 0) * 0.5} fill="#2a2a2a" />}
          <polyline points={fascia} fill="none" stroke="#f4f4f4" strokeWidth="1.8" />
          {/* the needle, in plane from lateral */}
          {tip && plane === 'in' && (
            <g>
              <line x1={US.w + 10} y1="2" x2={tip.x} y2={tip.y} stroke="#ffffff" strokeWidth="1.6" />
              <circle cx={tip.x} cy={tip.y} r="2" fill="#ffffff" />
            </g>
          )}
          {labels?.map((l) => (
            <text key={l.text} x={l.p.x + 6} y={l.p.y - 6} fontFamily={FONT} fontSize="5" fill="#f8d030">
              {l.text}
            </text>
          ))}
        </g>
      )}
      <g fontFamily={FONT} fontSize="5" fill="#a0a8b0">
        <text x="4" y="10">MED</text>
        <text x={US.w - 22} y="10">LAT</text>
        {probe && probe !== 'above' && <text x={US.w - 50} y={US.h - 4}>4 CM</text>}
      </g>
    </svg>
  )
}
