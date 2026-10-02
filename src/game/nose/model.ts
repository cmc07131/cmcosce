/**
 * Anterior epistaxis (ENT UK / British Rhinological Society 2017 consensus). Pure.
 *
 * The nostril view is 160 × 160, the left nostril from in front: the septum on your left, the lateral wall on your
 * right; the bleeding point in Little's area, low on the septum. The side view is 220 × 140, facing left: the
 * nostril on the left, the floor of the nose running back level with the hard palate, the skull base above.
 */

export type Pt = { x: number; y: number }
export type Posture = 'forward' | 'upright' | 'back'

export const BLEED: Pt = { x: 52, y: 104 }
export const NOSTRIL = { cx: 80, cy: 80, r: 64 }
/** Side view: the tampon enters at the nostril and should run back along the floor. */
export const SIDE = { nostril: { x: 30, y: 96 }, floorY: 96, depth: 150 }

export type NoseRun = {
  posture: Posture | null
  pinch: 'soft' | 'bony' | null
  pressMin: number
  ice: boolean
  haemo: boolean
  anticoag: boolean
  light: boolean
  speculum: boolean
  spray: boolean
  clots: number[]
  sawBleed: boolean
  dabs: Pt[]
  onBleed: number
  bothSides: boolean
  explained: boolean
  lubed: boolean
  tampon: { angle: number; depth: number } | null
  maxUp: number
  salineMl: number
  throat: boolean
  taped: boolean
  documented: boolean
}

export function freshNose(): NoseRun {
  return {
    posture: null,
    pinch: null,
    pressMin: 0,
    ice: false,
    haemo: false,
    anticoag: false,
    light: false,
    speculum: false,
    spray: false,
    clots: [0, 1, 2, 3, 4],
    sawBleed: false,
    dabs: [],
    onBleed: 0,
    bothSides: false,
    explained: false,
    lubed: false,
    tampon: null,
    maxUp: 0,
    salineMl: 0,
    throat: false,
    taped: false,
    documented: false,
  }
}

export const CLOTS: Pt[] = [
  { x: 56, y: 96 },
  { x: 76, y: 70 },
  { x: 96, y: 100 },
  { x: 68, y: 116 },
  { x: 88, y: 52 },
]

/** Sectors of a ring of silver nitrate around the bleeding point: 4–14 units out, 8 sectors. */
export function ringSectors(dabs: Pt[]) {
  const s = new Set<number>()
  for (const d of dabs) {
    const r = Math.hypot(d.x - BLEED.x, d.y - BLEED.y)
    if (r < 4 || r > 14) continue
    const a = Math.atan2(d.y - BLEED.y, d.x - BLEED.x)
    s.add(Math.floor(((a + Math.PI) / (2 * Math.PI)) * 8) % 8)
  }
  return s.size
}

/** The tampon dragged from the nostril to `tip`: its angle above the floor (degrees) and depth (units). */
export function tamponAt(tip: Pt) {
  const dx = tip.x - SIDE.nostril.x
  const dy = SIDE.nostril.y - tip.y
  return { angle: (Math.atan2(dy, Math.max(1, dx)) * 180) / Math.PI, depth: Math.hypot(dx, dy) }
}

export const NOSE_MARKS = ['firstaid', 'haemo', 'anticoag', 'examine', 'cautery', 'explain', 'prepare', 'floor', 'expand', 'throat', 'secure'] as const
export type NoseRow = { key: (typeof NOSE_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkNose(r: NoseRun): NoseRow[] {
  const ring = ringSectors(r.dabs)
  const t = r.tampon
  return [
    { key: 'firstaid', label: 'First aid', value: `${r.posture ?? 'no posture'}, pinched ${r.pinch ?? 'nowhere'} for ${r.pressMin} min${r.ice ? ', ice' : ''}`, range: 'Sitting forward, firm pressure on the soft part of the nose for 10–15 minutes', ok: r.posture === 'forward' && r.pinch === 'soft' && r.pressMin >= 10, why: 'Head back, blood runs down the throat and is swallowed or inhaled; the bony bridge is the wrong place to press.' },
    { key: 'haemo', label: 'Circulation', value: r.haemo ? 'HR 96, BP 168/94, Hb 128' : 'Not assessed', range: 'Pulse, BP, blood loss; FBC, group and save', ok: r.haemo, why: 'A long bleed in an older man on an anticoagulant can be a lot of blood.' },
    { key: 'anticoag', label: 'Anticoagulant', value: r.anticoag ? 'Apixaban this morning' : 'Not asked', range: 'Which, and when last taken', ok: r.anticoag, why: 'It changes how long it will ooze and who you call.' },
    { key: 'examine', label: 'Examination', value: [r.light && 'headlight', r.spray && 'co-phenylcaine', r.speculum && 'speculum', r.clots.length === 0 && 'clots suctioned', r.sawBleed && "Little's area found"].filter(Boolean).join(', ') || 'None', range: 'Headlight, suction of clots, vasoconstrictor, speculum: find the point', ok: r.light && r.spray && r.speculum && r.clots.length === 0 && r.sawBleed, why: 'You cannot cauterise what you cannot see.' },
    { key: 'cautery', label: 'Cautery', value: r.bothSides ? 'Both sides of the septum' : `${ring}/8 of a ring around the point${r.onBleed ? `; ${r.onBleed}× onto the bleeding itself` : ''}`, range: 'A ring around the point, one side of the septum only', ok: ring >= 6 && !r.bothSides, why: 'Silver nitrate does not work in a pool of blood; ring the vessel. Both sides risks a septal perforation.', critical: r.bothSides },
    { key: 'explain', label: 'Explain', value: r.explained ? 'Told him it will be uncomfortable' : 'Not explained', range: 'What you are doing, and that it will be uncomfortable', ok: r.explained, why: 'He will jerk away if it is a surprise.' },
    { key: 'prepare', label: 'Prepare', value: r.lubed ? 'Tampon lubricated' : 'Dry tampon', range: 'Lubricate the tampon', ok: r.lubed, why: 'A dry tampon drags on the septum and restarts the bleeding.' },
    { key: 'floor', label: 'Insertion', value: t ? `${Math.round(t.angle)}° above the floor, ${Math.round((t.depth / SIDE.depth) * 8)} cm in${r.maxUp > 30 ? `; once pushed ${Math.round(r.maxUp)}° up toward the eye` : ''}` : 'Not inserted', range: 'Along the floor of the nose, parallel to the hard palate, all the way in', ok: !!t && Math.abs(t.angle) <= 15 && t.depth >= SIDE.depth * 0.85 && r.maxUp <= 30, why: 'The nose runs back, not up. Pushed upward it heads for the skull base.', critical: r.maxUp > 45 },
    { key: 'expand', label: 'Expand', value: `${r.salineMl.toFixed(0)} mL saline`, range: 'About 10 mL of saline onto the tampon', ok: r.salineMl >= 8 && r.salineMl <= 15, why: 'The sponge swells against the septum and presses the bleeding point.' },
    { key: 'throat', label: 'Posterior bleed', value: r.throat ? 'No blood in the oropharynx' : 'Throat not checked', range: 'Look at the back of the throat', ok: r.throat, why: 'Bleeding running down the back despite the pack means a posterior source.' },
    { key: 'secure', label: 'Secure and document', value: [r.taped && 'string taped', r.documented && 'documented'].filter(Boolean).join(', ') || 'Neither', range: 'Tape the string to the cheek; document', ok: r.taped && r.documented, why: 'A loose pack can slip back into the airway.' },
  ]
}
