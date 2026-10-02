/**
 * Digital (web-space) nerve block of the right middle finger (RCEM/BSSH; Lalonde 2005 on adrenaline). Pure.
 *
 * Cross-section of the finger base, 160 × 160, dorsum up, radial side on your left. Dorsal digital nerves at 10 and
 * 2 o'clock, palmar digital nerves at 8 and 4 o'clock with the digital arteries beside them; the flexor sheath at 6.
 */

export type Pt = { x: number; y: number }
export type Side = 'radial' | 'ulnar'
export type Ampoule = 'plain1' | 'adr1' | 'plain2'
export type Spot = 'dorsal' | 'palmar' | 'artery' | 'sheath' | 'bone' | 'tissue' | 'outside'

export const SECTION = { cx: 80, cy: 80, r: 60 }
export const BONE = { x: 80, y: 80, r: 22 }
export const SHEATH = { x: 80, y: 122, r: 11 }
export const NERVES: Record<Side, { dorsal: Pt; palmar: Pt; artery: Pt }> = {
  radial: { dorsal: { x: 38, y: 50 }, palmar: { x: 42, y: 112 }, artery: { x: 52, y: 124 } },
  ulnar: { dorsal: { x: 122, y: 50 }, palmar: { x: 118, y: 112 }, artery: { x: 108, y: 124 } },
}
/** Total per finger before the volume itself squeezes the digital arteries. */
export const MAX_ML = 6

export function spotAt(p: Pt, side: Side): Spot {
  const d = (q: Pt) => Math.hypot(p.x - q.x, p.y - q.y)
  if (Math.hypot(p.x - SECTION.cx, p.y - SECTION.cy) > SECTION.r) return 'outside'
  if (d(BONE) <= BONE.r) return 'bone'
  if (d(SHEATH) <= SHEATH.r) return 'sheath'
  const n = NERVES[side]
  if (d(n.artery) <= 6) return 'artery'
  if (d(n.dorsal) <= 13) return 'dorsal'
  if (d(n.palmar) <= 13) return 'palmar'
  return 'tissue'
}

export type DigitalRun = {
  consent: boolean
  vascularAsked: boolean
  twoPoint: boolean
  crt: boolean
  ampoule: Ampoule | null
  drawn: number
  cleaned: number
  side: Side | null
  entries: { side: Side; site: 'web' | 'finger' | 'knuckle' | 'palm' }[]
  tip: Pt | null
  spot: Spot | null
  aspiratedHere: boolean
  unaspirated: number
  arteryHit: boolean
  ml: Record<Side, { dorsal: number; palmar: number; other: number }>
  minutes: number
  blockAt: number | null
  tested: boolean
}

export function freshDigital(): DigitalRun {
  return {
    consent: false,
    vascularAsked: false,
    twoPoint: false,
    crt: false,
    ampoule: null,
    drawn: 0,
    cleaned: 0,
    side: null,
    entries: [],
    tip: null,
    spot: null,
    aspiratedHere: false,
    unaspirated: 0,
    arteryHit: false,
    ml: { radial: { dorsal: 0, palmar: 0, other: 0 }, ulnar: { dorsal: 0, palmar: 0, other: 0 } },
    minutes: 0,
    blockAt: null,
    tested: false,
  }
}

export const totalMl = (r: DigitalRun) => r.ml.radial.dorsal + r.ml.radial.palmar + r.ml.radial.other + r.ml.ulnar.dorsal + r.ml.ulnar.palmar + r.ml.ulnar.other

/** Each side is blocked when both its nerves have about a millilitre, or more on the palmar side. */
export const sideBlocked = (r: DigitalRun, s: Side) => r.ml[s].palmar >= 1 && r.ml[s].dorsal >= 0.4

/** Inject where the tip is. */
export function injectHere(run: DigitalRun, ml: number): { patch: Partial<DigitalRun>; ok: boolean } {
  if (!run.side || !run.spot || run.spot === 'outside') return { patch: {}, ok: false }
  if (run.spot === 'bone' || run.spot === 'sheath') return { patch: {}, ok: false }
  const key = run.spot === 'dorsal' ? 'dorsal' : run.spot === 'palmar' ? 'palmar' : 'other'
  const side = { ...run.ml[run.side], [key]: run.ml[run.side][key] + ml }
  return {
    ok: true,
    patch: {
      ml: { ...run.ml, [run.side]: side },
      unaspirated: run.unaspirated + (run.aspiratedHere ? 0 : 1),
      blockAt: run.blockAt ?? run.minutes,
    },
  }
}

/** How the tip of the finger feels to a pin. */
export function tipFeels(r: DigitalRun) {
  const waited = r.blockAt !== null && r.minutes - r.blockAt >= 5
  const both = sideBlocked(r, 'radial') && sideBlocked(r, 'ulnar')
  if (both && waited) return 'numb'
  if ((sideBlocked(r, 'radial') || sideBlocked(r, 'ulnar')) && waited) return 'half'
  return 'sharp'
}

export const DIGITAL_MARKS = ['consent', 'vascular', 'baseline', 'asepsis', 'entry', 'nerves', 'both', 'volume', 'wait'] as const
export type DigitalRow = { key: (typeof DIGITAL_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkDigital(r: DigitalRun): DigitalRow[] {
  const total = totalMl(r)
  const webBoth = (['radial', 'ulnar'] as Side[]).every((s) => r.entries.some((e) => e.side === s && e.site === 'web'))
  const bad = r.entries.filter((e) => e.site !== 'web')
  return [
    { key: 'consent', label: 'Consent', value: r.consent ? 'Consent, no allergy' : 'Not asked', range: 'Consent and allergy to local anaesthetic', ok: r.consent, why: 'Ask before you inject.' },
    { key: 'vascular', label: 'Vascular history', value: r.vascularAsked ? "No Raynaud's or vascular disease" : 'Not asked', range: "Raynaud's, peripheral vascular disease", ok: r.vascularAsked, why: 'In those, avoid adrenaline and keep the volume small.' },
    { key: 'baseline', label: 'Baseline', value: [r.twoPoint && 'two-point', r.crt && 'refill'].filter(Boolean).join(', ') || 'None', range: 'Two-point discrimination and refill at the tip, before the block', ok: r.twoPoint && r.crt, why: 'After the block you cannot test the nerves: document them first.' },
    { key: 'asepsis', label: 'Asepsis', value: `${Math.round(r.cleaned * 100)}% cleaned`, range: 'Chlorhexidine over the finger base and web spaces', ok: r.cleaned >= 0.7, why: 'Clean skin before the needle.' },
    { key: 'entry', label: 'Entry', value: bad.length ? `Also into the ${bad.map((e) => e.site).join(', ')}` : webBoth ? 'Dorsal web space, both sides' : r.entries.length ? 'One side only' : 'No needle', range: 'Dorsally in the web space beside the base of the finger', ok: !bad.length && r.entries.length > 0, why: 'The web space is lax and less painful; the digital nerves lie just beside the base.' },
    { key: 'nerves', label: 'Dorsal and palmar', value: `R ${r.ml.radial.dorsal.toFixed(1)}/${r.ml.radial.palmar.toFixed(1)} mL, U ${r.ml.ulnar.dorsal.toFixed(1)}/${r.ml.ulnar.palmar.toFixed(1)} mL (dorsal/palmar)${r.unaspirated ? `; ${r.unaspirated} injection${r.unaspirated === 1 ? '' : 's'} without aspirating` : ''}`, range: 'About 0.5 mL dorsally, then 1–2 mL palmar, aspirating first', ok: (sideBlocked(r, 'radial') || sideBlocked(r, 'ulnar')) && r.unaspirated === 0 && !r.arteryHit, why: 'The palmar nerves supply the tip and nail bed; the digital artery runs beside them.' },
    { key: 'both', label: 'Both sides', value: sideBlocked(r, 'radial') && sideBlocked(r, 'ulnar') ? 'Radial and ulnar' : 'One side', range: 'The same on the other side', ok: sideBlocked(r, 'radial') && sideBlocked(r, 'ulnar'), why: 'Each side of the finger has its own pair of nerves.' },
    { key: 'volume', label: 'Volume', value: `${total.toFixed(1)} mL in all${r.ampoule ? `, ${r.ampoule === 'adr1' ? '1% with adrenaline' : r.ampoule === 'plain2' ? '2% plain' : '1% plain'}` : ''}`, range: `Under about ${MAX_ML - 1} mL`, ok: total > 0 && total <= MAX_ML - 1, why: 'A large volume at the base squeezes the digital arteries like a tourniquet.', critical: total >= 9 },
    { key: 'wait', label: 'Wait and test', value: r.tested ? `Tested at ${r.blockAt === null ? '?' : r.minutes - r.blockAt} min: ${tipFeels(r)}` : 'Not tested', range: 'Wait 5–10 minutes; prick the tip before you start', ok: r.tested && tipFeels(r) === 'numb', why: 'Starting before it works hurts him and he will not trust the next block.' },
  ]
}
