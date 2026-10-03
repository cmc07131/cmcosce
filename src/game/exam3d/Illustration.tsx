/**
 * What you see and feel under the drape, drawn as a clinical illustration rather than shown on the model: the speculum
 * view of the cervix, the bimanual (uterus and adnexa), the scrotum, the perianal skin. The drawing follows the
 * finding's words (inflamed, discharge, tender, high, horizontal, swollen…).
 */

export type IllustrationKind = 'vulva' | 'cervix' | 'bimanual' | 'scrotum' | 'perianal'

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
        {kind === 'perianal' && (
          <g>
            <ellipse cx="80" cy="55" rx="58" ry="40" fill="#e3b49e" stroke={ink} strokeWidth="1.5" />
            <circle cx="80" cy="55" r="9" fill="#9a5a52" stroke={ink} strokeWidth="1" />
            {has(/reduced|absent|weak/i) && <circle cx="80" cy="55" r="26" fill="none" stroke="#3a6ad4" strokeWidth="2" strokeDasharray="4 3" />}
          </g>
        )}
      </svg>
      <figcaption className="px-1 pb-0.5 text-[10px] leading-tight text-[#40404c]">Drawn close-up · under the drape</figcaption>
    </figure>
  )
}
