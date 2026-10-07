import { INTUBATE_MS, IntubateSequence } from './Intubate'

/**
 * A short close-up of the doctor's hands doing an examination, played before the finding appears. Each shows the
 * technique as it is done (both sides compared, each quadrant felt, the torch into each eye) and the finding itself
 * (a fixed pupil stays wide; a silent side shows no breath sounds; a slow capillary refill is slow; a tender
 * quadrant flushes red). Pure SVG with CSS animation.
 */

export const CUT_IN_MS = 2400

/** How long a close-up plays: intubation is a sequence of its own. */
export function cutInMs(kind: CutInKind) {
  return kind === 'intubate' ? INTUBATE_MS : CUT_IN_MS
}

export const cutInKinds = ['gloves', 'packet', 'airway', 'auscultate', 'pulse', 'pupils', 'glucose', 'abdomen', 'intubate'] as const
export type CutInKind = (typeof cutInKinds)[number]

const CAPTIONS: Record<CutInKind, string> = {
  gloves: 'Gloves on…',
  packet: 'Reading the packet…',
  airway: 'Look, listen and feel…',
  auscultate: 'Listening: right and left, upper and lower…',
  pulse: 'Radial pulse… then capillary refill…',
  pupils: 'Torch into each eye: direct and consensual…',
  glucose: 'Finger-prick glucose…',
  abdomen: 'Feeling each quadrant, watching the face…',
  intubate: 'Laryngoscope in, tube through the cords…',
}

const SKIN = '#e8b494'
const SKIN_SHADE = '#d79c7a'
const EDGE = '#8a5238'
const GLOVE = '#8cc4ee'
const GLOVE_EDGE = '#3a78a8'
const INK = '#40404c'

/* ---------------------------------------------------------------- reading the finding */

type Side = 'left' | 'right' | 'both' | null

/** Which side (the patient's) a finding names near one of these words, if any. */
function sideNear(text: string, words: RegExp): Side {
  const t = text.toLowerCase()
  if (!words.test(t)) return null
  const bilateral = /bilateral|both|equal(ly)? (reduced|absent)/.test(t)
  if (bilateral) return 'both'
  // The side named in the same clause as the finding word ("trachea to the right; absent breath sounds on the left"
  // is the left), else the side word closest to it.
  const clause = t.split(/[;.]/).find((c) => words.test(c))
  const inClause = clause?.match(/\b(left|right)\b/)?.[1] as 'left' | 'right' | undefined
  if (inClause) return inClause
  const at = t.search(words)
  const sides = [...t.matchAll(/\b(left|right)\b/g)].map((m) => ({ side: m[1] as 'left' | 'right', d: Math.abs((m.index ?? 0) - at) }))
  if (!sides.length) return 'both'
  return sides.sort((a, b) => a.d - b.d)[0].side
}

export type CutInFinding = {
  /** Auscultation: the side with reduced or absent breath sounds. */
  quietSide: Side
  /** Pupils: the side that stays dilated and does not react; `pinpoint` both small. */
  fixedSide: Side
  /** Pupils: the side that is larger and reacts slowly. */
  sluggishSide: Side
  pinpoint: boolean
  /** Pulse: absent or weak; capillary refill delayed. */
  noPulse: boolean
  slowRefill: boolean
  /** Abdomen: the quadrant that is tender (patient's side). */
  tender: 'ruq' | 'luq' | 'rlq' | 'llq' | 'epi' | 'supra' | null
  /** Airway: not breathing; noisy. */
  apnoeic: boolean
  noisy: boolean
  /** Glucose meter value. */
  glucose: string | null
}

export function readFinding(text = ''): CutInFinding {
  const t = text.toLowerCase()
  const tender = (() => {
    if (!/tender|guard|rebound|peritonism|wince|pain on palpation/.test(t)) return null
    if (/left upper quadrant|\bluq\b|left hypochond/.test(t)) return 'luq'
    if (/right upper quadrant|\bruq\b|right hypochond|murphy/.test(t)) return 'ruq'
    if (/left (lower quadrant|iliac fossa)|\bllq\b|\blif\b/.test(t)) return 'llq'
    if (/right (lower quadrant|iliac fossa)|\brlq\b|\brif\b|mcburney/.test(t)) return 'rlq'
    if (/epigastri/.test(t)) return 'epi'
    if (/suprapubic|hypogastri/.test(t)) return 'supra'
    return null
  })()
  return {
    quietSide: sideNear(t, /(absent|reduced|decreased|diminished|no) (breath|air entry)|silent chest|(breath sounds|air entry) (absent|reduced|decreased)/),
    fixedSide: sideNear(t, /fixed|unreactive|non-reactive|blown|dilated and/),
    sluggishSide: sideNear(t, /sluggish/),
    pinpoint: /pinpoint/.test(t),
    noPulse: /no (radial |carotid |palpable )?pulse|pulseless|impalpable|absent (radial )?pulse|pulse absent/.test(t),
    slowRefill: /crt (of )?[3-9]|refill (of )?[3-9]|capillary refill [3-9]|delayed (capillary )?refill|prolonged/.test(t),
    tender,
    apnoeic: /not breathing|apnoe|apne|no respiratory effort/.test(t),
    noisy: /stridor|gurgl|snor|wheez/.test(t),
    glucose: t.match(/glucose[^0-9]{0,20}(\d+(?:\.\d+)?)/)?.[1] ?? t.match(/(\d+(?:\.\d+)?)\s*mmol/)?.[1] ?? null,
  }
}

/* ---------------------------------------------------------------- hands */

/** A gloved hand seen from above, fingers to the right; `two`: index and middle out, the rest tucked. */
function GlovedHand({ two = false }: { two?: boolean }) {
  return (
    <g>
      <path d="M-34 -9 L-6 -11 L-6 11 L-34 9 Z" fill={GLOVE} stroke={GLOVE_EDGE} />
      <rect x="-8" y="-12" width="22" height="24" rx="7" fill={GLOVE} stroke={GLOVE_EDGE} />
      {two ? (
        <>
          <rect x="10" y="-11" width="22" height="7" rx="3.5" fill={GLOVE} stroke={GLOVE_EDGE} />
          <rect x="10" y="-3" width="24" height="7" rx="3.5" fill={GLOVE} stroke={GLOVE_EDGE} />
          <path d="M12 6 q6 2 6 6 q-4 2 -8 0 Z" fill={GLOVE} stroke={GLOVE_EDGE} />
        </>
      ) : (
        [-10, -3.5, 3, 9.5].map((y, i) => <rect key={y} x="10" y={y} width={i === 3 ? 16 : 20 + (i === 1 ? 3 : 0)} height="6" rx="3" fill={GLOVE} stroke={GLOVE_EDGE} />)
      )}
      <path d="M-2 -12 q4 -8 12 -9 q4 0 3 3 q-6 2 -9 8 Z" fill={GLOVE} stroke={GLOVE_EDGE} />
    </g>
  )
}

/* ---------------------------------------------------------------- close-ups */

function Auscultate({ f }: { f: CutInFinding }) {
  // The patient faces us: his right is on our left.
  const quiet = (side: 'left' | 'right') => f.quietSide === 'both' || f.quietSide === side
  const spots: [number, number, 'left' | 'right', string][] = [
    [72, 50, 'right', 'ci-ear-1'],
    [128, 50, 'left', 'ci-ear-2'],
    [66, 86, 'right', 'ci-ear-3'],
    [134, 86, 'left', 'ci-ear-4'],
  ]
  return (
    <g>
      <rect width="200" height="120" fill="#efe4dc" />
      <path d="M0 120 L0 34 Q30 18 82 14 L118 14 Q170 18 200 34 L200 120 Z" fill={SKIN} stroke={EDGE} />
      <path d="M86 0 L86 16 Q100 22 114 16 L114 0" fill={SKIN_SHADE} stroke={EDGE} />
      <path d="M36 30 Q62 22 94 26 M164 30 Q138 22 106 26" stroke={EDGE} strokeWidth="1.6" fill="none" />
      <path d="M100 26 L100 98" stroke={SKIN_SHADE} strokeWidth="3" />
      <path d="M52 104 Q76 112 100 100 Q124 112 148 104" stroke={SKIN_SHADE} strokeWidth="1.6" fill="none" />
      <circle cx="68" cy="70" r="2.4" fill="#b87058" />
      <circle cx="132" cy="70" r="2.4" fill="#b87058" />
      {spots.map(([x, y, side, cls]) => (
        <g key={cls} opacity={quiet(side) ? 0.12 : 1}>
          <g className={`ci-sound ${cls}`}>
            <path d={`M${x + 12} ${y - 6} q5 6 0 12 M${x + 17} ${y - 9} q8 9 0 18`} stroke="#2f7a3e" strokeWidth="1.4" fill="none" />
            <path d={`M${x - 12} ${y - 6} q-5 6 0 12 M${x - 17} ${y - 9} q-8 9 0 18`} stroke="#2f7a3e" strokeWidth="1.4" fill="none" />
          </g>
        </g>
      ))}
      <g className="ci-steth">
        {/* the hand behind, fingertips on the rim; the diaphragm flat on the skin in front */}
        <g transform="translate(6 30) rotate(-100)">
          <GlovedHand two />
        </g>
        <path d="M6 -8 C 16 -34 44 -44 72 -72" stroke="#303848" strokeWidth="2.6" fill="none" />
        <circle r="9" fill="#c8d0d8" stroke="#303848" strokeWidth="2" />
        <circle r="5.5" fill="#eef2f6" stroke="#9aa4ae" strokeWidth="0.8" />
      </g>
      <text x="22" y="116" fontSize="6" fill={INK} fontFamily="Press Start 2P, monospace">R</text>
      <text x="172" y="116" fontSize="6" fill={INK} fontFamily="Press Start 2P, monospace">L</text>
    </g>
  )
}

function Pulse({ f }: { f: CutInFinding }) {
  return (
    <g>
      <rect width="200" height="120" fill="#efe4dc" />
      {/* forearm, palm up, hand to the right; thumb side at the top */}
      <path d="M0 52 L118 46 Q128 45 134 46 L134 86 Q126 88 118 88 L0 92 Z" fill={SKIN} stroke={EDGE} />
      <path d="M118 46 Q132 44 136 50" stroke={SKIN_SHADE} fill="none" />
      <path d="M126 50 L126 84" stroke={SKIN_SHADE} strokeDasharray="2 2" />
      <path d="M134 46 Q158 40 168 46 L196 48 Q200 52 196 56 L172 56 L198 62 Q201 66 196 69 L172 68 L196 76 Q199 80 194 82 L170 79 Q160 90 140 88 L134 86 Z" fill={SKIN} stroke={EDGE} />
      <path d="M140 46 Q150 30 166 26 Q172 26 170 31 Q160 36 156 46" fill={SKIN} stroke={EDGE} />
      <ellipse cx="148" cy="56" rx="9" ry="7" fill={SKIN_SHADE} opacity="0.45" />
      {/* the radial artery, just inside the radial border */}
      <path d="M40 56 Q90 52 122 52" stroke="#c87080" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.7" />
      {!f.noPulse && <circle cx="116" cy="53" r="4" fill="none" stroke="#d04050" strokeWidth="1.4" className="ci-throb" />}
      {/* the nail bed, blanching under the press and refilling */}
      <rect x="186" y="49" width="9" height="6" rx="2" fill="#f4b8b0" stroke={EDGE} strokeWidth="0.6" />
      <rect x="186" y="49" width="9" height="6" rx="2" fill="#fbf4ee" className={f.slowRefill ? 'ci-blanch-slow' : 'ci-blanch'} />
      <g className="ci-two-fingers">
        <GlovedHand two />
      </g>
      <text x="8" y="112" fontSize="6" fill={INK} fontFamily="Press Start 2P, monospace">{f.noPulse ? 'NO PULSE FELT' : ''}</text>
      {f.slowRefill && (
        <text x="140" y="112" fontSize="6" fill="#c03030" fontFamily="Press Start 2P, monospace" className="ci-reading">
          SLOW REFILL
        </text>
      )}
    </g>
  )
}

function Pupils({ f }: { f: CutInFinding }) {
  // His right eye is on our left.
  const eye = (cx: number, side: 'left' | 'right') => {
    const fixed = f.fixedSide === 'both' || f.fixedSide === side
    const sluggish = !fixed && (f.sluggishSide === 'both' || f.sluggishSide === side)
    const cls = fixed || f.pinpoint ? '' : sluggish ? 'ci-pupil-slow' : 'ci-pupil-r'
    return (
      <g key={side}>
        <path d={`M${cx - 30} 62 Q${cx} 38 ${cx + 30} 62 Q${cx} 84 ${cx - 30} 62 Z`} fill="#fffef6" stroke={EDGE} strokeWidth="1.4" />
        <circle cx={cx} cy="62" r="12" fill="#6a4830" />
        <circle cx={cx} cy="62" r={fixed ? 10 : f.pinpoint ? 2 : sluggish ? 9 : 7} fill="#101010" className={cls} />
        <circle cx={cx + 4} cy="58" r="1.6" fill="#ffffff" opacity="0.8" />
        <path d={`M${cx - 30} 44 Q${cx} 30 ${cx + 30} 42`} stroke="#5a3a24" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      <rect width="200" height="120" fill={SKIN} />
      <path d="M100 50 L96 90 Q100 96 104 90 Z" fill={SKIN_SHADE} />
      {eye(58, 'right')}
      {eye(142, 'left')}
      <g className="ci-penlight">
        <rect x="-4" y="0" width="8" height="40" rx="3" fill="#505860" />
        <rect x="-4" y="-4" width="8" height="5" fill="#f0e68c" />
        <path d="M0 -4 L-14 -34 L14 -34 Z" fill="#fff8a0" opacity="0.55" />
      </g>
      <text x="58" y="112" fontSize="6" textAnchor="middle" fill={INK} fontFamily="Press Start 2P, monospace">R</text>
      <text x="142" y="112" fontSize="6" textAnchor="middle" fill={INK} fontFamily="Press Start 2P, monospace">L</text>
    </g>
  )
}

function Glucose({ f }: { f: CutInFinding }) {
  return (
    <g>
      <rect width="200" height="120" fill="#efe4dc" />
      {/* a fingertip from below */}
      <path d="M26 120 L30 64 Q34 44 50 44 Q66 44 68 64 L70 120 Z" fill={SKIN} stroke={EDGE} />
      <path d="M38 56 Q50 48 60 56" stroke={SKIN_SHADE} fill="none" />
      <circle cx="52" cy="44" r="4" fill="#c82838" className="ci-drop" />
      {/* the lancet: clicks, then lifts away */}
      <g className="ci-lancet">
        <rect x="40" y="-2" width="24" height="30" rx="4" fill="#f0f0f0" stroke="#7a8a98" />
        <rect x="47" y="-10" width="10" height="9" rx="2" fill="#4a90d8" />
      </g>
      {/* the meter, with a strip that comes to the drop */}
      <g className="ci-meter">
        <rect x="112" y="28" width="62" height="82" rx="9" fill="#3c444c" />
        <rect x="120" y="38" width="46" height="28" rx="2" fill="#a0d0a8" />
        <text x="143" y="57" textAnchor="middle" fontSize="10" fill="#203020" fontFamily="Press Start 2P, monospace" className="ci-count">
          …
        </text>
        <text x="143" y="57" textAnchor="middle" fontSize="10" fill="#203020" fontFamily="Press Start 2P, monospace" className="ci-reading">
          {f.glucose ?? 'OK'}
        </text>
        <text x="143" y="78" textAnchor="middle" fontSize="5" fill="#c8d0d8" fontFamily="Press Start 2P, monospace">
          mmol/L
        </text>
        <rect x="86" y="54" width="28" height="5" fill="#f4f4ec" stroke="#7a8a98" />
      </g>
    </g>
  )
}

function Abdomen({ f }: { f: CutInFinding }) {
  // His right is on our left. Each quadrant in turn, flat hand, watching his face.
  const where: Record<NonNullable<CutInFinding['tender']>, [number, number]> = {
    ruq: [66, 52],
    luq: [134, 52],
    rlq: [66, 92],
    llq: [134, 92],
    epi: [100, 46],
    supra: [100, 102],
  }
  const tender = f.tender ? where[f.tender] : null
  return (
    <g>
      <rect width="200" height="120" fill="#efe4dc" />
      <path d="M8 120 L8 30 Q100 14 192 30 L192 120 Z" fill={SKIN} stroke={EDGE} />
      <path d="M40 32 Q70 48 100 36 Q130 48 160 32" stroke={EDGE} strokeWidth="1.4" fill="none" />
      <path d="M100 36 L100 112" stroke={SKIN_SHADE} strokeDasharray="2 3" />
      <path d="M30 72 L170 72" stroke={SKIN_SHADE} strokeDasharray="2 3" opacity="0.6" />
      <ellipse cx="100" cy="72" rx="3" ry="4" fill={EDGE} />
      {tender && (
        <g className={`ci-tender ci-tender-${f.tender}`}>
          <circle cx={tender[0]} cy={tender[1]} r="14" fill="#e05050" opacity="0.35" />
          <text x={tender[0]} y={tender[1] - 18} textAnchor="middle" fontSize="9" fill="#c03030" fontFamily="Press Start 2P, monospace">
            !
          </text>
        </g>
      )}
      <g className="ci-palpate">
        <g transform="rotate(-90)">
          <GlovedHand />
        </g>
      </g>
      <text x="18" y="116" fontSize="6" fill={INK} fontFamily="Press Start 2P, monospace">R</text>
      <text x="176" y="116" fontSize="6" fill={INK} fontFamily="Press Start 2P, monospace">L</text>
    </g>
  )
}

function Airway({ f }: { f: CutInFinding }) {
  return (
    <g>
      <rect width="200" height="120" fill="#efe4dc" />
      {/* he lies face up: head on the left, chest to the right; your cheek over his mouth, eyes along his chest */}
      <path d="M118 120 L118 84 Q160 66 200 72 L200 120 Z" fill="#88b0d8" stroke="#46689a" className={f.apnoeic ? '' : 'ci-chest-rise'} />
      <path d="M8 120 L8 88 Q10 72 32 70 L56 66 Q64 52 70 58 L74 66 Q80 66 82 70 L86 72 Q96 68 102 74 Q110 84 120 86 L120 120 Z" fill={SKIN} stroke={EDGE} />
      <path d="M8 88 Q10 72 32 70 L28 92 Z" fill="#403028" />
      <path d="M44 74 q4 -2 8 0" stroke={EDGE} strokeWidth="1.5" fill="none" />
      {!f.apnoeic && <path d="M80 62 q3 -7 0 -14" stroke="#9ac0e8" strokeWidth="2" fill="none" className="ci-breath" />}
      {f.noisy && (
        <text x="92" y="52" fontSize="7" fill="#c03030" fontFamily="Press Start 2P, monospace" className="ci-breath">
          ~
        </text>
      )}
      <g className="ci-lean">
        <ellipse cx="88" cy="40" rx="17" ry="18" fill="#f0c8a0" stroke={EDGE} />
        <path d="M72 36 Q74 20 92 22 Q102 23 104 30 Q90 26 76 40 Z" fill="#302018" />
        <ellipse cx="82" cy="50" rx="4" ry="5" fill="#e0b088" stroke={EDGE} />
        <circle cx="100" cy="40" r="1.8" fill="#302018" />
      </g>
      <path d="M104 44 L156 74" stroke={INK} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      {f.apnoeic && (
        <text x="140" y="60" fontSize="6" fill="#c03030" fontFamily="Press Start 2P, monospace">
          NO BREATHS
        </text>
      )}
    </g>
  )
}

/** `finding`: the finding this examination shows (read for side, reaction, rate, tenderness, the meter value). */
export function CutIn({ kind, finding }: { kind: CutInKind; finding?: string }) {
  if (kind === 'intubate') return <IntubateSequence />
  const f = readFinding(finding)
  return (
    <div className="cut-in" data-testid={`cut-in-${kind}`} role="status">
      <svg viewBox="0 0 200 120" className="cut-in-art">
        <rect width="200" height="120" fill="#f4e8e0" />
        {kind === 'gloves' && (
          <g>
            <rect x="60" y="30" width="80" height="60" rx="6" fill="#dfe8f0" stroke="#7a8a98" />
            <text x="100" y="64" textAnchor="middle" fontSize="9" fill={INK} fontFamily="Press Start 2P, monospace">
              GLOVES M
            </text>
            <g className="ci-rise">
              <g transform="rotate(-90)">
                <GlovedHand />
              </g>
            </g>
          </g>
        )}
        {kind === 'packet' && (
          <g>
            <g className="ci-tilt">
              <rect x="55" y="25" width="90" height="60" rx="3" fill="#f8f8f4" stroke="#7a8a98" />
              <text x="100" y="45" textAnchor="middle" fontSize="7" fill="#b83838" fontFamily="Press Start 2P, monospace">
                AMITRIPTYLINE
              </text>
              <text x="100" y="58" textAnchor="middle" fontSize="7" fill={INK} fontFamily="Press Start 2P, monospace">
                25 mg × 60
              </text>
              {[0, 1, 2, 3, 4].map((i) => (
                <circle key={i} cx={70 + i * 15} cy="73" r="4" fill="none" stroke="#9aa6b8" strokeDasharray="2 1" />
              ))}
            </g>
          </g>
        )}
        {kind === 'airway' && <Airway f={f} />}
        {kind === 'auscultate' && <Auscultate f={f} />}
        {kind === 'pulse' && <Pulse f={f} />}
        {kind === 'pupils' && <Pupils f={f} />}
        {kind === 'glucose' && <Glucose f={f} />}
        {kind === 'abdomen' && <Abdomen f={f} />}
      </svg>
      <p className="cut-in-cap">{CAPTIONS[kind]}</p>
    </div>
  )
}
