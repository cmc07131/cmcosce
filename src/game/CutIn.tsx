import { INTUBATE_MS, IntubateSequence } from './Intubate';
/**
 * A short close-up of the doctor's hands doing an examination, played before the finding appears.
 * Pure SVG with CSS animation; each lasts about 1.5 s.
 */

export const CUT_IN_MS = 1500;

/** How long a close-up plays: intubation is a sequence of its own. */
export function cutInMs(kind: CutInKind) {
  return kind === 'intubate' ? INTUBATE_MS : CUT_IN_MS;
}

export const cutInKinds = [
  "gloves",
  "packet",
  "airway",
  "auscultate",
  "pulse",
  "pupils",
  "glucose",
  "abdomen",
  "intubate",
] as const;
export type CutInKind = (typeof cutInKinds)[number];

const CAPTIONS: Record<CutInKind, string> = {
  gloves: "Gloves on…",
  packet: "Reading the packet…",
  airway: "Look, listen, feel…",
  auscultate: "Listening to the chest…",
  pulse: "Pulse and capillary refill…",
  pupils: "Torch in the pupils…",
  glucose: "Finger-prick glucose…",
  abdomen: "Feeling the abdomen…",
  intubate: "Laryngoscope in, tube through the cords…",
};

const SKIN = "#e8b494";
const EDGE = "#8a5238";
const GLOVE = "#88c8f0";
const GLOVE_EDGE = "#3a78a8";

function Glove({
  x,
  y,
  r = 0,
  cls = "",
}: {
  x: number;
  y: number;
  r?: number;
  cls?: string;
}) {
  return (
    <g className={cls} transform={`translate(${x} ${y}) rotate(${r})`}>
      <path
        d="M-10 0 L-10 -18 Q-10 -22 -7 -22 L-7 -10 L-5 -26 Q-2 -28 0 -26 L0 -12 L2 -27 Q5 -29 7 -27 L6 -11 L9 -24 Q12 -25 12 -22 L10 0 Z"
        fill={GLOVE}
        stroke={GLOVE_EDGE}
      />
      <rect
        x="-11"
        y="0"
        width="22"
        height="14"
        rx="2"
        fill={GLOVE}
        stroke={GLOVE_EDGE}
      />
    </g>
  );
}

/** `reading`: what a meter shows at the end (the glucose value from the finding). */
export function CutIn({
  kind,
  reading,
}: {
  kind: CutInKind;
  reading?: string;
}) {
  if (kind === 'intubate') return <IntubateSequence />;
  return (
    <div className="cut-in" data-testid={`cut-in-${kind}`} role="status">
      <svg viewBox="0 0 200 120" className="cut-in-art">
        <rect width="200" height="120" fill="#f4e8e0" />
        {kind === "gloves" && (
          <g>
            <rect
              x="60"
              y="30"
              width="80"
              height="60"
              rx="6"
              fill="#dfe8f0"
              stroke="#7a8a98"
            />
            <text
              x="100"
              y="64"
              textAnchor="middle"
              fontSize="9"
              fill="#40404c"
              fontFamily="Press Start 2P, monospace"
            >
              GLOVES M
            </text>
            <Glove x={100} y={112} cls="ci-rise" />
          </g>
        )}
        {kind === "packet" && (
          <g>
            <g className="ci-tilt">
              <rect
                x="55"
                y="25"
                width="90"
                height="60"
                rx="3"
                fill="#f8f8f4"
                stroke="#7a8a98"
              />
              <text
                x="100"
                y="45"
                textAnchor="middle"
                fontSize="7"
                fill="#b83838"
                fontFamily="Press Start 2P, monospace"
              >
                AMITRIPTYLINE
              </text>
              <text
                x="100"
                y="58"
                textAnchor="middle"
                fontSize="7"
                fill="#40404c"
                fontFamily="Press Start 2P, monospace"
              >
                25 mg × 60
              </text>
              {[0, 1, 2, 3, 4].map((i) => (
                <circle
                  key={i}
                  cx={70 + i * 15}
                  cy="73"
                  r="4"
                  fill="none"
                  stroke="#9aa6b8"
                  strokeDasharray="2 1"
                />
              ))}
            </g>
            <Glove x={62} y={100} r={20} />
          </g>
        )}
        {kind === "airway" && (
          <g>
            {/* she lies face up; your ear over her mouth, eyes on her chest */}
            <path
              d="M124 120 L124 82 Q160 62 200 70 L200 120 Z"
              fill="#88b0d8"
              stroke="#46689a"
              className="ci-breathe"
            />
            <path
              d="M10 120 L10 86 Q12 70 34 68 L56 64 Q64 50 70 56 L74 64 Q79 64 82 68 L86 70 Q94 66 100 72 Q110 82 126 84 L126 120 Z"
              fill={SKIN}
              stroke={EDGE}
            />
            <path d="M10 86 Q12 70 34 68 L30 90 Z" fill="#403028" />
            <path
              d="M44 72 q4 -2 8 0"
              stroke={EDGE}
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M80 60 q2 -6 0 -12"
              stroke="#a8c8e8"
              strokeWidth="2"
              fill="none"
              className="ci-breath"
            />
            <g className="ci-lean">
              <g transform="translate(0 12)">
                <ellipse
                  cx="86"
                  cy="30"
                  rx="17"
                  ry="18"
                  fill="#f0c8a0"
                  stroke={EDGE}
                />
                <path
                  d="M70 26 Q72 10 90 12 Q100 13 102 20 Q88 16 74 30 Z"
                  fill="#302018"
                />
                <ellipse
                  cx="80"
                  cy="40"
                  rx="4"
                  ry="5"
                  fill="#e0b088"
                  stroke={EDGE}
                />
                <circle cx="98" cy="30" r="1.8" fill="#302018" />
                <path
                  d="M101 36 q-3 2 -6 1"
                  stroke={EDGE}
                  strokeWidth="1.2"
                  fill="none"
                />
              </g>
            </g>
            <path
              d="M104 42 L150 66"
              stroke="#40404c"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
          </g>
        )}
        {kind === "auscultate" && (
          <g>
            <path
              d="M0 120 L0 30 Q100 10 200 30 L200 120 Z"
              fill={SKIN}
              stroke={EDGE}
            />
            <path
              d="M70 40 Q80 70 80 100 M130 40 Q120 70 120 100"
              stroke="#c89078"
              fill="none"
            />
            <g className="ci-slide">
              <path
                d="M100 20 Q100 50 100 58"
                stroke="#303848"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="100"
                cy="64"
                r="9"
                fill="#c8d0d8"
                stroke="#303848"
                strokeWidth="2"
              />
              <Glove x={100} y={90} />
            </g>
          </g>
        )}
        {kind === "pulse" && (
          <g>
            <path
              d="M0 70 L200 55 L200 90 L0 105 Z"
              fill={SKIN}
              stroke={EDGE}
            />
            <circle
              cx="150"
              cy="70"
              r="4"
              fill="#d87080"
              className="ci-throb"
            />
            <Glove x={140} y={62} r={-80} cls="ci-press" />
          </g>
        )}
        {kind === "pupils" && (
          <g>
            <ellipse
              cx="100"
              cy="60"
              rx="60"
              ry="30"
              fill="#fffef4"
              stroke={EDGE}
              strokeWidth="2"
            />
            <circle cx="100" cy="60" r="22" fill="#6a4830" />
            <circle
              cx="100"
              cy="60"
              r="14"
              fill="#101010"
              className="ci-pupil"
            />
            <path
              d="M100 38 Q60 30 40 60 Q60 34 100 34 Q140 34 160 60 Q140 30 100 38"
              fill={SKIN}
            />
            <g className="ci-torch">
              <rect
                x="150"
                y="96"
                width="46"
                height="10"
                rx="3"
                fill="#404850"
                transform="rotate(-25 150 96)"
              />
              <path
                d="M150 92 L110 66 L118 60 Z"
                fill="#fff8a0"
                opacity="0.7"
              />
            </g>
          </g>
        )}
        {kind === "glucose" && (
          <g>
            <path
              d="M20 120 L40 60 Q50 44 62 58 L60 120 Z"
              fill={SKIN}
              stroke={EDGE}
            />
            <circle cx="50" cy="56" r="3" fill="#c82838" className="ci-drop" />
            <rect x="110" y="30" width="60" height="80" rx="8" fill="#404850" />
            <rect x="118" y="40" width="44" height="26" fill="#98c8a0" />
            <text
              x="140"
              y="58"
              textAnchor="middle"
              fontSize="11"
              fill="#203020"
              fontFamily="Press Start 2P, monospace"
              className="ci-reading"
            >
              {reading ?? "OK"}
            </text>
            <rect
              x="84"
              y="56"
              width="30"
              height="4"
              fill="#f0f0e8"
              stroke="#7a8a98"
            />
          </g>
        )}
        {kind === "abdomen" && (
          <g>
            <path
              d="M0 120 L0 40 Q100 20 200 40 L200 120 Z"
              fill={SKIN}
              stroke={EDGE}
            />
            <circle cx="100" cy="70" r="3" fill={EDGE} />
            <ellipse
              cx="100"
              cy="100"
              rx="30"
              ry="14"
              fill="#e0a888"
              opacity="0.6"
            />
            <Glove x={80} y={92} r={-90} cls="ci-palpate" />
          </g>
        )}
      </svg>
      <p className="cut-in-cap">{CAPTIONS[kind]}</p>
    </div>
  );
}
