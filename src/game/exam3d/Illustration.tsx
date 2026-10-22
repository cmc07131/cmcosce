/**
 * What you see and feel under the drape, drawn as a clinical illustration rather than shown on the model: the speculum
 * view of the cervix, the bimanual (uterus and adnexa), the scrotum, the perianal skin. The drawing follows the
 * finding's words (inflamed, discharge, tender, high, horizontal, swollen…).
 */

export type IllustrationKind = 'vulva' | 'cervix' | 'bimanual' | 'scrotum' | 'perianal' | 'collar-size' | 'pv-speculum' | 'pv-bimanual'

export function illustrationFor(site: string): IllustrationKind | null {
  const base = site.replace(/-(R|L)$/, '')
  if (base === 'vulva') return 'vulva'
  if (base === 'cervix') return 'cervix'
  if (base === 'adnexa') return 'bimanual'
  if (base === 'scrotum' || base === 'testis') return 'scrotum'
  if (base === 'perianal') return 'perianal'
  return null
}

const ink = '#3a2a2a'

export function Illustration({ kind, finding }: { kind: IllustrationKind; finding: string }) {
  const has = (re: RegExp) => re.test(finding)
  const inflamed = has(/inflam|red|bleeds/i)
  const discharge = has(/discharge|mucopurulent|pus/i)
  const tender = has(/tender/i)
  return (
    <figure className="m-0 rounded border-2 border-[#181820] bg-[#fff9f2] p-1" data-testid="exam-illustration">
      <svg viewBox="0 0 160 110" className="block h-auto w-full" role="img" aria-label={finding}>
        {kind === 'vulva' && (
          <g>
            <ellipse cx="80" cy="55" rx="34" ry="44" fill="#e9b6a4" stroke={ink} strokeWidth="1.5" />
            <ellipse cx="80" cy="58" rx="16" ry="34" fill="#d58c86" stroke={ink} strokeWidth="1" />
            <ellipse cx="80" cy="66" rx="5" ry="10" fill="#7a3a3a" />
            {discharge && <path d="M76 78 q4 10 8 0 q-2 14 -4 18 q-2 -4 -4 -18z" fill="#e8d36a" stroke="#b89a2a" strokeWidth="0.8" />}
          </g>
        )}
        {kind === 'cervix' && (
          <g>
            <circle cx="80" cy="55" r="48" fill="#c98078" stroke={ink} strokeWidth="1.5" />
            <path d="M32 55 h18 M110 55 h18" stroke="#9aa4ad" strokeWidth="6" strokeLinecap="round" />
            <circle cx="80" cy="55" r="26" fill={inflamed ? '#d9555a' : '#eaa5a0'} stroke={ink} strokeWidth="1.2" />
            {inflamed && <circle cx="80" cy="55" r="14" fill="#c43a40" opacity="0.6" />}
            <ellipse cx="80" cy="55" rx="5" ry="3" fill="#5a1f22" />
            {discharge && <path d="M78 58 q2 14 4 0 q3 16 -2 26 q-5 -10 -2 -26z" fill="#e8d36a" stroke="#b89a2a" strokeWidth="0.8" />}
            {has(/bleed/i) && <path d="M66 62 q2 8 4 2" stroke="#9a1010" strokeWidth="2" fill="none" />}
          </g>
        )}
        {kind === 'bimanual' && (
          <g>
            <path d="M62 30 q18 -10 36 0 q8 22 -6 44 q-12 12 -24 0 q-14 -22 -6 -44z" fill="#e7a7a0" stroke={ink} strokeWidth="1.5" />
            <path d="M74 74 h12 v18 h-12z" fill="#e7a7a0" stroke={ink} strokeWidth="1.2" />
            <ellipse cx="34" cy="42" rx="12" ry="8" fill="#f1c9a6" stroke={ink} strokeWidth="1.2" />
            <ellipse cx="126" cy="42" rx="12" ry="8" fill="#f1c9a6" stroke={ink} strokeWidth="1.2" />
            <path d="M62 34 q-14 0 -16 6 M98 34 q14 0 16 6" stroke={ink} strokeWidth="1.2" fill="none" />
            {tender && (
              <g fill="#d42a2a" fontSize="14" fontWeight="700">
                <text x="26" y="28">✱</text>
                <text x="120" y="28">✱</text>
                {has(/uterus.*tender|mildly tender|motion/i) && <text x="74" y="26">✱</text>}
              </g>
            )}
          </g>
        )}
        {kind === 'scrotum' && (
          <g>
            <path d="M30 20 q50 -16 100 0 q12 56 -50 86 q-62 -30 -50 -86z" fill="#d8a58c" stroke={ink} strokeWidth="1.5" />
            <path d="M80 18 v80" stroke="#b07e68" strokeWidth="1" strokeDasharray="3 3" />
            {/* Her/his right is on the viewer's left. */}
            {has(/high|horizontal/i) ? (
              <ellipse cx="54" cy="40" rx={has(/swollen/i) ? 22 : 18} ry="11" fill="#f0c8b4" stroke={ink} strokeWidth="1.3" />
            ) : (
              <ellipse cx="54" cy="58" rx="11" ry={has(/swollen/i) ? 22 : 18} fill="#f0c8b4" stroke={ink} strokeWidth="1.3" />
            )}
            <ellipse cx="106" cy="60" rx="11" ry="18" fill="#f0c8b4" stroke={ink} strokeWidth="1.3" />
            {tender && <text x="44" y="24" fill="#d42a2a" fontSize="14" fontWeight="700">✱</text>}
            <text x="40" y="104" fontSize="8" fill={ink}>R</text>
            <text x="114" y="104" fontSize="8" fill={ink}>L</text>
          </g>
        )}
        {kind === 'collar-size' && (
          <g>
            {/* The side of the collar's front: the light shell, the darker panel, the size window with its red sizing
                mark and its holes, the lock tab above; the foam edge below the hard plastic; three fingers from the
                mark down to the bottom of the hard plastic. */}
            <path d="M8 30 Q80 18 152 30 L152 84 Q80 74 8 84 Z" fill="#e6e4dc" stroke={ink} strokeWidth="1.5" />
            <path d="M8 84 Q80 74 152 84 L152 92 Q80 82 8 92 Z" fill="#646a72" stroke={ink} strokeWidth="1" />
            <path d="M20 34 Q60 27 100 30 L100 78 Q60 75 20 80 Z" fill="#5a5f66" />
            <circle cx="40" cy="36" r="5" fill="#2f3338" stroke="#16191c" strokeWidth="0.8" />
            <rect x="35" y="45" width="10" height="27" rx="2" fill="#cfd3d6" stroke="#16191c" strokeWidth="0.6" />
            <rect x="35.5" y="46" width="9" height="2.6" fill="#c0392b" />
            {[54, 60, 66].map((y) => (
              <circle key={y} cx="40" cy={y} r="1.6" fill="#16191c" />
            ))}
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x="50" y={48 + i * 9.6} width="56" height="8.9" rx="4.4" fill="#e8b494" stroke={ink} strokeWidth="1" />
                <rect x="97" y={49.5 + i * 9.6} width="7" height="5.8" rx="2" fill="#f4d9cc" stroke={ink} strokeWidth="0.6" />
              </g>
            ))}
            <line x1="47" y1="47" x2="47" y2="77" stroke="#c0392b" strokeWidth="1" strokeDasharray="2 2" />
            <text x="58" y="14" fontSize="7.5" fill={ink}>lock tab</text>
            <line x1="62" y1="16" x2="44" y2="33" stroke={ink} strokeWidth="0.7" />
            <text x="4" y="107" fontSize="7.5" fill={ink}>red mark to the bottom of the hard plastic</text>
            <text x="112" y="62" fontSize="8" fill={ink}>3 fingers</text>
            <text x="100" y="99" fontSize="6.5" fill={ink}>foam: not counted</text>
          </g>
        )}
        {(kind === 'pv-speculum' || kind === 'pv-bimanual') && (
          <g>
            {/* A cut-away of her pelvis from the side as she lies: her head to the left, the front of her body up. The
                vagina runs from the introitus (right) down and back toward the sacrum, to the cervix; the uterus tips
                forward (anteverted) over the bladder, behind the pubic bone; the rectum below. */}
            <path d="M6 24 Q70 14 116 28 Q130 34 134 50" fill="none" stroke={ink} strokeWidth="1.4" />
            <path d="M6 100 Q40 102 70 96 Q110 92 150 96" fill="none" stroke={ink} strokeWidth="1.2" strokeDasharray="3 2" />
            <path d="M22 96 Q14 70 22 44" fill="none" stroke="#e4d8bd" strokeWidth="7" strokeLinecap="round" />
            <ellipse cx="121" cy="48" rx="6" ry="11" fill="#efe6d0" stroke={ink} strokeWidth="1" />
            <ellipse cx="101" cy="44" rx="13" ry="8.5" fill="#f2d87e" stroke={ink} strokeWidth="1" />
            <path d="M150 88 Q100 90 66 86 Q40 82 34 66" fill="none" stroke="#c9917a" strokeWidth="9" strokeLinecap="round" />
            <path d="M144 72 L90 66" stroke="#d98f8a" strokeWidth="10" strokeLinecap="round" />
            <ellipse cx="62" cy="44" rx="20" ry="11" transform="rotate(-28 62 44)" fill="#e7a7a0" stroke={ink} strokeWidth="1.3" />
            <path d="M74 56 Q84 60 88 66" fill="none" stroke="#e7a7a0" strokeWidth="9" strokeLinecap="round" />
            <circle cx="88" cy="66" r="4.5" fill={inflamed ? '#d9555a' : '#eaa5a0'} stroke={ink} strokeWidth="1" />
            <g fontSize="6.5" fill={ink}>
              <text x="92" y="35">bladder</text>
              <text x="40" y="30">uterus</text>
              <text x="76" y="80">cervix</text>
              <text x="58" y="98">rectum</text>
              <text x="124" y="66">pubis</text>
            </g>
            {kind === 'pv-speculum' && (
              <g>
                {/* The blades in, open, the cervix between their tips; the handle out, pointing up. */}
                <path d="M146 69 L92 58 L91 63 L146 71 Z" fill="#cfe6f4" stroke="#5b8db0" strokeWidth="0.9" opacity="0.92" />
                <path d="M146 74 L91 71 L92 76 L146 76 Z" fill="#cfe6f4" stroke="#5b8db0" strokeWidth="0.9" opacity="0.92" />
                <path d="M147 70 L154 44" stroke="#5b8db0" strokeWidth="4" strokeLinecap="round" />
                <text x="128" y="14" fontSize="6.5" fill={ink}>speculum: handle up</text>
              </g>
            )}
            {kind === 'pv-bimanual' && (
              <g>
                {/* Two fingers in to the cervix; the other hand above the pubis pressing down; the uterus between. */}
                <path d="M158 70 L92 64" stroke="#7fb0e0" strokeWidth="5" strokeLinecap="round" />
                <path d="M158 76 L93 69" stroke="#7fb0e0" strokeWidth="5" strokeLinecap="round" />
                <ellipse cx="160" cy="76" rx="6" ry="10" fill="#7fb0e0" />
                <rect x="46" y="8" width="40" height="8" rx="4" fill="#7fb0e0" stroke="#4a7fb0" strokeWidth="0.8" />
                <path d="M66 18 L64 28" stroke="#c0392b" strokeWidth="1.6" markerEnd="url(#pvArrow)" />
                <path d="M100 66 L96 56" stroke="#c0392b" strokeWidth="1.6" markerEnd="url(#pvArrow)" />
                <defs>
                  <marker id="pvArrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                    <path d="M0 0 L6 3 L0 6 z" fill="#c0392b" />
                  </marker>
                </defs>
                {tender && <text x="76" y="52" fill="#d42a2a" fontSize="12" fontWeight="700">✱</text>}
              </g>
            )}
          </g>
        )}
        {kind === 'perianal' && (
          <g>
            <ellipse cx="80" cy="55" rx="58" ry="40" fill="#e3b49e" stroke={ink} strokeWidth="1.5" />
            <circle cx="80" cy="55" r="9" fill="#9a5a52" stroke={ink} strokeWidth="1" />
            {has(/reduced|absent|weak/i) && <circle cx="80" cy="55" r="26" fill="none" stroke="#3a6ad4" strokeWidth="2" strokeDasharray="4 3" />}
          </g>
        )}
      </svg>
      <figcaption className="px-1 pb-0.5 text-[10px] leading-tight text-[#40404c]">{kind === 'collar-size' ? 'Drawn close-up · sizing the collar' : kind === 'pv-speculum' ? 'Drawn cut-away · the speculum in' : kind === 'pv-bimanual' ? 'Drawn cut-away · the bimanual' : 'Drawn close-up · under the drape'}</figcaption>
    </figure>
  )
}
