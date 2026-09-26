import type { Pose } from './model'

/** Legs apart under a drape, seen from the foot of the trolley. A loop of cord at the introitus if it is outside. */
export function PerineumView({ exposed, visible, gauze }: { exposed: boolean; visible: boolean; gauze: boolean }) {
  return (
    <svg viewBox="0 0 200 150" className="block h-full w-full" data-testid="perineum">
      <rect width="200" height="150" fill="#dfe8f0" />
      <rect y="120" width="200" height="30" fill="#c8d4e0" />
      <path d="M20 150 Q40 70 88 60 L100 80 L112 60 Q160 70 180 150 Z" fill="#e8b494" stroke="#8a5238" />
      <path d="M0 0 L200 0 L200 64 Q100 40 0 64 Z" fill="#6a8fc8" stroke="#46689a" />
      {!exposed && <path d="M40 150 Q60 70 100 64 Q140 70 160 150 Z" fill="#7aa0d4" stroke="#46689a" />}
      {exposed && (
        <g>
          <ellipse cx="100" cy="96" rx="9" ry="14" fill="#c86070" opacity="0.7" />
          {visible && (
            <g>
              <path d="M98 104 Q86 128 100 134 Q116 138 108 112" stroke="#6a78b8" strokeWidth="6" fill="none" />
              <path d="M98 104 Q86 128 100 134 Q116 138 108 112" stroke="#a8b4e8" strokeWidth="2" fill="none" strokeDasharray="3 3" />
              {gauze && <rect x="84" y="112" width="34" height="26" rx="6" fill="#f8f8f4" opacity="0.85" stroke="#b8b8b0" />}
            </g>
          )}
          <text x="6" y="146" fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">
            DRAPE BACK
          </text>
        </g>
      )}
    </svg>
  )
}

/**
 * Midline sagittal slice, mother supine: her head to the left, her front at the top, her back at the bottom.
 * The pubis is in front and low; the vagina runs down and out to the right. `lift` 0–1 pushes the fetal head
 * back up (toward her head) off the cord, which runs between the head and the pubis. The squeezed cord turns dark.
 */
export function PelvisSection({ lift, handIn, visible, examined, spasm, bladderMl }: { lift: number; handIn: boolean; visible: boolean; examined: boolean; spasm: boolean; bladderMl: number }) {
  const headX = 118 - lift * 24
  const headY = 104 - lift * 6
  const squeezed = lift < 0.6 && bladderMl < 500
  const cordColour = spasm ? '#3a2a68' : squeezed ? '#5a4a88' : '#a8b4e8'
  const bladder = Math.min(1, bladderMl / 750)
  const introitus = { x: 196, y: 128 }
  const cordEnd = visible ? '198 150' : '176 124'
  return (
    <svg viewBox="0 0 200 180" className="block h-full w-full" data-testid="pelvis-section">
      <rect width="200" height="180" fill="#f4e8e0" />
      {/* skin of the abdomen along the top, the back along the bottom */}
      <path d="M0 10 Q110 0 200 40" stroke="#c89078" strokeWidth="8" fill="none" />
      <path d="M0 176 Q110 186 200 160" stroke="#c89078" strokeWidth="8" fill="none" />
      {/* sacrum and coccyx along her back */}
      <path d="M20 160 Q90 176 150 160" stroke="#f4f0e2" strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M20 160 Q90 176 150 160" stroke="#9a9078" strokeWidth="1" fill="none" />
      {/* uterus, fundus toward her head */}
      <path d="M10 40 Q60 12 120 40 Q150 58 146 100 Q140 132 108 140 L40 140 Q8 120 10 60 Z" fill="#f0b8b8" stroke="#b86868" />
      {/* bladder, behind the pubis: fills and lifts the head */}
      <ellipse cx="160" cy={58 - bladder * 6} rx={10 + bladder * 14} ry={8 + bladder * 10} fill="#f8e070" opacity={0.35 + bladder * 0.55} stroke="#c8a830" />
      {/* pubic symphysis, front and low */}
      <ellipse cx="172" cy="84" rx="8" ry="15" fill="#f4f0e2" stroke="#9a9078" transform="rotate(-20 172 84)" />
      {/* vagina from the cervix down and out to the introitus */}
      <path d={`M140 118 Q170 124 ${introitus.x} ${introitus.y}`} stroke="#d87880" strokeWidth="14" fill="none" strokeLinecap="round" />
      {/* fetal head, low in the pelvis */}
      <circle cx={headX} cy={headY} r="28" fill="#f0c8a8" stroke="#8a5238" />
      <path d={`M${headX - 22} ${headY - 10} Q${headX - 26} ${headY + 6} ${headX - 16} ${headY + 20}`} stroke="#6a4838" strokeWidth="3" fill="none" />
      {/* cord: from the placenta, over the front of the head, between head and pubis, down the vagina */}
      <path
        d={`M60 34 Q${headX + 30} ${headY - 52} ${headX + 34} ${headY - 10} Q${headX + 36} ${headY + 12} 152 118 Q176 128 ${cordEnd}`}
        stroke={cordColour}
        strokeWidth="6"
        fill="none"
        opacity={examined || visible ? 1 : 0.35}
      />
      {/* your gloved fingers along the vagina, tips on the head */}
      {handIn && (
        <g>
          <path d={`M200 132 Q176 128 ${headX + 24} ${headY + 12}`} stroke="#181820" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d={`M200 132 Q176 128 ${headX + 24} ${headY + 12}`} stroke="#88c8f0" strokeWidth="9" fill="none" strokeLinecap="round" />
        </g>
      )}
      <g fontFamily="Press Start 2P, monospace" fontSize="5" fill="#40404c">
        <text x="4" y="26">HER HEAD ◀</text>
        <text x="154" y="108">PUBIS</text>
        <text x="60" y="154">SACRUM</text>
        <text x="4" y="176">HER BACK</text>
        {bladderMl > 0 && <text x="140" y="36">BLADDER</text>}
      </g>
    </svg>
  )
}

/** Small picture of each position. */
export function PoseCard({ pose }: { pose: Pose | 'walk' }) {
  return (
    <svg viewBox="0 0 80 50" className="block h-full w-full">
      <rect width="80" height="50" fill="#eef3f8" />
      <rect x="2" y="40" width="76" height="4" fill="#9aa6b8" />
      {pose === 'knee-chest' && (
        <g fill="#f0b8c8" stroke="#8a5238">
          <circle cx="18" cy="34" r="5" fill="#e8b494" />
          <path d="M22 34 L44 18 L52 40 L46 40 L42 28 L26 38 Z" />
        </g>
      )}
      {pose === 'lateral' && (
        <g fill="#f0b8c8" stroke="#8a5238" transform="rotate(-8 40 38)">
          <circle cx="12" cy="36" r="5" fill="#e8b494" />
          <path d="M16 32 L50 30 Q60 30 62 36 L54 38 L18 40 Z" />
          <rect x="44" y="37" width="14" height="4" rx="2" fill="#f8f8f8" />
        </g>
      )}
      {pose === 'supine' && (
        <g fill="#f0b8c8" stroke="#8a5238">
          <circle cx="12" cy="34" r="5" fill="#e8b494" />
          <rect x="17" y="30" width="50" height="9" rx="3" />
        </g>
      )}
      {pose === 'sitting' && (
        <g fill="#f0b8c8" stroke="#8a5238">
          <circle cx="30" cy="12" r="5" fill="#e8b494" />
          <path d="M26 18 L34 18 L36 36 L60 36 L60 40 L28 40 Z" />
        </g>
      )}
      {pose === 'walk' && (
        <g fill="#f0b8c8" stroke="#8a5238">
          <circle cx="40" cy="8" r="5" fill="#e8b494" />
          <path d="M36 14 L44 14 L46 30 L50 40 L46 40 L40 32 L34 40 L30 40 L34 30 Z" />
        </g>
      )}
    </svg>
  )
}
