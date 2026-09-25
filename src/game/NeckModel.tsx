/** Front view of a neck. Cartilage sits in front of the airway so the handshake and the cut have a place to land. */
export function NeckFront({
  rock = 0,
  incision = 0,
  bougie = 0,
}: {
  rock?: number
  incision?: number
  bougie?: number
}) {
  const shift = Math.max(-14, Math.min(14, rock))
  return (
    <svg viewBox="0 0 220 340" className="pointer-events-none absolute inset-0 mx-auto h-full w-auto">
      <ellipse cx="110" cy="36" rx="54" ry="28" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
      <path d="M78 48 Q110 70 142 48" fill="none" stroke="#303848" strokeWidth="2" />
      <path d="M70 58 C78 200 78 250 96 310 L124 310 C142 250 142 200 150 58" fill="#f0d2b4" stroke="#303848" strokeWidth="2" />
      <path d="M86 90 C78 160 82 230 96 280" fill="none" stroke="#c49a78" strokeWidth="6" strokeLinecap="round" />
      <path d="M134 90 C142 160 138 230 124 280" fill="none" stroke="#c49a78" strokeWidth="6" strokeLinecap="round" />
      <g transform={`translate(${shift} 0)`}>
        <path d="M92 108 H128" stroke="#303848" strokeWidth="3" />
        <text x="156" y="112" className="fill-[#28241c]" fontFamily="VT323, monospace" fontSize="16">
          Hyoid
        </text>
        <path
          d="M86 128 Q110 112 134 128 L138 168 Q110 188 82 168 Z"
          fill="#f7e7d2"
          stroke="#303848"
          strokeWidth="2"
        />
        <path d="M110 124 L104 146 H116 Z" fill="#e7c4a8" stroke="#303848" strokeWidth="1.5" />
        <text x="156" y="156" className="fill-[#28241c]" fontFamily="VT323, monospace" fontSize="16">
          Thyroid
        </text>
        <line x1="138" y1="156" x2="152" y2="152" stroke="#303848" strokeWidth="1" />
        <rect x="96" y="172" width="28" height="10" rx="2" fill="#e07080" stroke="#303848" strokeWidth="1.5" />
        {incision > 0 && (
          <line
            x1={110 - incision * 10}
            y1="177"
            x2={110 + incision * 10}
            y2="177"
            stroke="#9a2030"
            strokeWidth="3"
          />
        )}
        <text x="156" y="182" className="fill-[#28241c]" fontFamily="VT323, monospace" fontSize="16">
          Membrane
        </text>
        <line x1="124" y1="177" x2="152" y2="178" stroke="#303848" strokeWidth="1" />
        <ellipse cx="110" cy="204" rx="22" ry="12" fill="#f3e0c8" stroke="#303848" strokeWidth="2" />
        <ellipse cx="110" cy="204" rx="12" ry="6" fill="#d8ebe8" stroke="#303848" strokeWidth="1" />
        <text x="156" y="208" className="fill-[#28241c]" fontFamily="VT323, monospace" fontSize="16">
          Cricoid
        </text>
        <line x1="132" y1="204" x2="152" y2="204" stroke="#303848" strokeWidth="1" />
        {[0, 1, 2, 3].map((ring) => (
          <ellipse
            key={ring}
            cx="110"
            cy={228 + ring * 16}
            rx="16"
            ry="6"
            fill="none"
            stroke="#303848"
            strokeWidth="1.5"
            opacity={0.55}
          />
        ))}
        {bougie > 0 && (
          <path
            d={`M110 176 C114 190 108 210 110 ${176 + bougie * 70}`}
            fill="none"
            stroke="#e0a020"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
      </g>
      <path d="M92 300 L110 316 L128 300" fill="none" stroke="#303848" strokeWidth="2" />
      <text x="138" y="318" className="fill-[#28241c]" fontFamily="VT323, monospace" fontSize="14">
        Sternal notch
      </text>
    </svg>
  )
}

/** Side view. Dragging up tips the chin back. */
export function NeckSide({ extend = 0 }: { extend?: number }) {
  const tilt = -8 - extend * 28
  return (
    <svg viewBox="0 0 220 280" className="pointer-events-none absolute inset-0 mx-auto h-full w-auto">
      <g transform={`rotate(${tilt} 120 150)`}>
        <circle cx="150" cy="70" r="36" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
        <path d="M124 78 Q150 108 168 74" fill="none" stroke="#303848" strokeWidth="2" />
        <path d="M118 96 C100 140 108 190 130 230" fill="#f0d2b4" stroke="#303848" strokeWidth="2" />
        <path d="M168 100 C190 150 176 200 156 236" fill="#e7c4a8" stroke="#303848" strokeWidth="2" />
        <path d="M132 150 Q148 140 158 156 Q150 170 132 162 Z" fill="#f7e7d2" stroke="#303848" strokeWidth="2" />
        <text x="20" y="150" className="fill-[#28241c]" fontFamily="VT323, monospace" fontSize="16">
          Larynx
        </text>
      </g>
      <rect x="70" y="228" width="120" height="28" rx="6" fill="#d7dcc8" stroke="#303848" strokeWidth="2" />
    </svg>
  )
}

export function HandSprite() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <rect x="16" y="4" width="6" height="16" rx="2" fill="#f4d7b8" stroke="#303848" />
      <rect x="23" y="2" width="6" height="18" rx="2" fill="#f4d7b8" stroke="#303848" />
      <rect x="30" y="6" width="6" height="15" rx="2" fill="#f4d7b8" stroke="#303848" />
      <path d="M10 22 H38 Q42 22 40 30 L36 42 H14 L8 30 Q6 22 10 22 Z" fill="#f0d2b4" stroke="#303848" strokeWidth="1.5" />
    </svg>
  )
}
