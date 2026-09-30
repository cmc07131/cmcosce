import { useEffect, useState } from "react";

/**
 * Intubation, step by step, as it is done: pre-oxygenate in the sniffing position, laryngoscope in from the right
 * sweeping the tongue left, lift along the handle to see the epiglottis and cords, pass the tube under direct
 * vision, inflate the cuff, confirm with capnography, and secure it at the teeth.
 */

const FRAME_MS = 900;

const FRAMES = [
  "Pre-oxygenate: bag-mask, head in the sniffing position",
  "Laryngoscope in from the right, sweeping the tongue left",
  "Lift along the handle: the epiglottis, then the cords",
  "Tube through the cords under direct vision",
  "Cuff up: 5–10 mL of air",
  "Capnography: a square trace on every breath",
  "Tube at 21 cm at the teeth, tied",
] as const;

export const INTUBATE_MS = FRAMES.length * FRAME_MS + 300;

const SKIN = "#e8b494";
const EDGE = "#8a5238";
const GLOVE = "#88c8f0";
const GLOVE_EDGE = "#3a78a8";
const FONT = "Press Start 2P, monospace";

/** The view from the head of the bed: open mouth, tongue, and whatever the blade has shown. */
function Mouth({ swept, lifted }: { swept: boolean; lifted: boolean }) {
  return (
    <g>
      <rect width="200" height="120" fill="#2a1418" />
      <ellipse cx="100" cy="64" rx="74" ry="50" fill={SKIN} stroke={EDGE} />
      <ellipse cx="100" cy="66" rx="58" ry="38" fill="#a04858" />
      {/* upper teeth at the top of the view (you stand at the head) */}
      {[70, 82, 94, 106, 118, 130].map((x) => (
        <rect
          key={x}
          x={x - 5}
          y="26"
          width="10"
          height="8"
          rx="2"
          fill="#fffef4"
          stroke="#9a9078"
          strokeWidth="0.6"
        />
      ))}
      {/* the glottis, seen only once the blade lifts */}
      {lifted && (
        <g>
          <path d="M100 58 L86 92 L114 92 Z" fill="#1a0c10" />
          <path
            d="M100 58 L86 92 M100 58 L114 92"
            stroke="#fffef4"
            strokeWidth="3.5"
          />
          <path
            d="M80 54 Q100 40 120 54"
            stroke="#f0c0c0"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {/* the tongue: filling the mouth, or swept to the left of the view */}
      <ellipse
        className="ix-tongue"
        cx={swept ? 62 : 100}
        cy={swept ? 70 : 66}
        rx={swept ? 20 : 46}
        ry={swept ? 30 : 30}
        fill="#d87080"
        stroke="#a04858"
      />
    </g>
  );
}

function Blade({ lifted }: { lifted: boolean }) {
  return (
    <g className={lifted ? "ix-lift" : "ix-blade-in"}>
      {/* the handle comes from your left hand, above the chin; the blade runs down the right of the mouth */}
      <rect
        x="140"
        y="-10"
        width="16"
        height="44"
        rx="3"
        fill="#707880"
        stroke="#303840"
      />
      <path
        d="M146 30 Q134 50 118 58"
        stroke="#c0c8d0"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="120" cy="56" r="2.5" fill="#fff8a0" />
    </g>
  );
}

export function IntubateFrame({ n }: { n: number }) {
  if (n === 0) {
    return (
      <g>
        <rect width="200" height="120" fill="#f4e8e0" />
        {/* side view: head extended on a pillow, mask sealed with the C-E grip, bag squeezed */}
        <rect
          x="10"
          y="96"
          width="120"
          height="12"
          rx="5"
          fill="#f8f8f4"
          stroke="#b8b8b0"
        />
        <path
          d="M20 98 Q18 66 50 60 L70 54 Q78 44 84 52 L88 60 Q96 62 98 70 Q110 78 132 82 L132 98 Z"
          fill={SKIN}
          stroke={EDGE}
        />
        <path
          d="M70 46 Q86 30 100 50 L96 66 Q84 56 72 60 Z"
          fill="#d8ecf8"
          stroke="#46689a"
        />
        <g className="ix-squeeze">
          <ellipse
            cx="130"
            cy="36"
            rx="26"
            ry="14"
            fill="#f0d8a0"
            stroke="#8a6a38"
          />
        </g>
        <path d="M104 40 L110 38" stroke="#c8d4e0" strokeWidth="5" />
        <path
          d="M64 44 L74 40 L80 46"
          stroke={GLOVE_EDGE}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <text x="150" y="78" fontSize="6" fill="#1a6a38" fontFamily={FONT}>
          SpO2 100
        </text>
      </g>
    );
  }
  if (n === 1) {
    return (
      <g>
        <Mouth swept={false} lifted={false} />
        <Blade lifted={false} />
      </g>
    );
  }
  if (n === 2) {
    return (
      <g>
        <Mouth swept lifted />
        <Blade lifted />
        <path d="M168 4 L176 -6" stroke="#f8d030" strokeWidth="2" />
        <text x="150" y="112" fontSize="6" fill="#fff8d8" fontFamily={FONT}>
          LIFT ↗
        </text>
      </g>
    );
  }
  if (n === 3) {
    return (
      <g>
        <Mouth swept lifted />
        <Blade lifted />
        <g className="ix-tube">
          <path
            d="M40 -10 Q70 40 98 84"
            stroke="#e8f0f8"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M40 -10 Q70 40 98 84"
            stroke="#9ab8d0"
            strokeWidth="2"
            fill="none"
          />
        </g>
      </g>
    );
  }
  if (n === 4) {
    return (
      <g>
        <rect width="200" height="120" fill="#f4e8e0" />
        {/* the tube leaving the mouth, its pilot line, and a syringe filling the cuff */}
        <path
          d="M10 60 L120 60"
          stroke="#e8f0f8"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path d="M10 60 L120 60" stroke="#9ab8d0" strokeWidth="2" />
        <path
          d="M60 60 Q70 90 110 92"
          stroke="#9ab8d0"
          strokeWidth="2"
          fill="none"
        />
        <ellipse
          className="ix-pilot"
          cx="116"
          cy="92"
          rx="7"
          ry="5"
          fill="#b8e0f8"
          stroke="#3a78a8"
        />
        <g className="ix-syringe">
          <rect
            x="124"
            y="86"
            width="50"
            height="12"
            rx="2"
            fill="#f8f8f4"
            stroke="#7a8a98"
          />
          <rect
            x="174"
            y="89"
            width="18"
            height="6"
            fill="#c0c8d0"
            stroke="#7a8a98"
          />
        </g>
        <ellipse
          className="ix-cuff"
          cx="14"
          cy="60"
          rx="10"
          ry="9"
          fill="#b8e0f8"
          stroke="#3a78a8"
          opacity="0.85"
        />
      </g>
    );
  }
  if (n === 5) {
    return (
      <g>
        <rect width="200" height="120" fill="#101418" />
        <text x="10" y="18" fontSize="6" fill="#f0e060" fontFamily={FONT}>
          EtCO2
        </text>
        <polyline
          className="ix-capno"
          points="10,100 30,100 32,58 60,54 62,100 80,100 82,58 110,54 112,100 130,100 132,58 160,54 162,100 190,100"
          fill="none"
          stroke="#f0e060"
          strokeWidth="2.5"
        />
        <text x="140" y="30" fontSize="10" fill="#f0e060" fontFamily={FONT}>
          4.2
        </text>
      </g>
    );
  }
  return (
    <g>
      <rect width="200" height="120" fill="#f4e8e0" />
      {/* the tube at the corner of the mouth, 21 cm mark at the teeth, tied round */}
      <ellipse cx="100" cy="60" rx="70" ry="48" fill={SKIN} stroke={EDGE} />
      <ellipse cx="100" cy="70" rx="24" ry="12" fill="#a04858" />
      <rect
        x="92"
        y="10"
        width="14"
        height="64"
        rx="5"
        fill="#e8f0f8"
        stroke="#9ab8d0"
      />
      <text x="110" y="62" fontSize="7" fill="#303848" fontFamily={FONT}>
        21
      </text>
      <path
        className="ix-tie"
        d="M20 64 Q60 56 92 58 M106 58 Q140 56 180 64"
        stroke="#f8f4e4"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M40 30 L52 36" stroke={GLOVE_EDGE} strokeWidth="4" />
      <circle cx="30" cy="28" r="8" fill={GLOVE} stroke={GLOVE_EDGE} />
    </g>
  );
}

export function IntubateSequence() {
  const [n, setN] = useState(0);
  useEffect(() => {
    // Timers, not animation frames: a hidden pane pauses those.
    const id = window.setInterval(
      () => setN((cur) => Math.min(FRAMES.length - 1, cur + 1)),
      FRAME_MS,
    );
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="cut-in" data-testid="cut-in-intubate" role="status">
      <svg key={n} viewBox="0 0 200 120" className="cut-in-art">
        <IntubateFrame n={n} />
      </svg>
      <p className="cut-in-cap">
        {n + 1}/{FRAMES.length} · {FRAMES[n]}
      </p>
    </div>
  );
}
