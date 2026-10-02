/**
 * Needle decompression and chest drain (ATLS 10th/11th; BTS pleural guidance). Pure.
 *
 * Front view, 180 × 170, of the chest with the arm up behind the head: midline on your left, the side you are working
 * on to your right (mid-clavicular line x 70, anterior axillary line x 118, mid-axillary line x 150). Rib n lies at
 * y = 30 + 16n; intercostal space n lies between rib n and rib n + 1.
 *
 * Cross-section, 160 × 120, through the chosen space: skin at the top, the upper rib on the left, the lower rib on
 * the right, the neurovascular bundle under the upper rib, the pleura at the depth of the chest wall.
 */

export type Pt = { x: number; y: number }
export type Mode = 'needle' | 'drain'
export type Blood = 'air' | 'blood'

export const LINES = { mcl: 70, aal: 118, mal: 150 }
export const ribY = (n: number) => 30 + 16 * n
export const spaceY = (n: number) => ribY(n) + 8

export type Site = 'safe' | 'second-mcl' | 'rib' | 'other'

/** Which space and site a tap on the front view lands on. */
export function siteAt(p: Pt): { site: Site; space: number } {
  const n = Math.round((p.y - 38) / 16)
  const onRib = Math.abs(p.y - ribY(Math.round((p.y - 30) / 16))) <= 3
  if (onRib) return { site: 'rib', space: n }
  if (n === 2 && Math.abs(p.x - LINES.mcl) <= 10) return { site: 'second-mcl', space: n }
  if ((n === 4 || n === 5) && p.x >= LINES.aal + 4 && p.x <= LINES.mal + 2) return { site: 'safe', space: n }
  return { site: 'other', space: n }
}

/** Chest wall thickness (cm) at a site: the pectorals make the 2nd space mid-clavicular deep. */
export const wallCm = (site: Site) => (site === 'second-mcl' ? 4.6 : 3.4)

export type Cannula = 'standard' | 'long'
export const CANNULA_CM: Record<Cannula, number> = { standard: 3.2, long: 8 }

/** Cross-section geometry. Depth units: 20 to the centimetre from the skin at y = 10. */
export const SECTION = { skinY: 10, perCm: 20, upperRib: { x: 40, y: 0 }, lowerRib: { x: 120, y: 0 }, ribR: 16 }
export const pleuraY = (site: Site) => SECTION.skinY + wallCm(site) * SECTION.perCm

/** Where in the space a needle or forceps enters: next to the upper rib (the bundle), mid-space, or over the lower rib. */
export function laneAt(x: number): 'bundle' | 'middle' | 'top-of-rib' {
  if (x < 66) return 'bundle'
  if (x > 92) return 'top-of-rib'
  return 'middle'
}

export type ChestRun = {
  site: Site | null
  space: number | null
  cleaned: number
  cannula: Cannula | null
  lane: 'bundle' | 'middle' | 'top-of-rib' | null
  depthCm: number
  decompressed: boolean
  bundleHit: boolean
  leftIn: boolean
  /* the drain */
  armUp: boolean
  confirmedSide: boolean
  mark: Site | null
  markSpace: number | null
  local: number
  aspiratedPleura: boolean
  incision: { where: 'upper-border' | 'lower-border' | 'other'; length: number; flat: number } | null
  dissectLane: 'bundle' | 'middle' | 'top-of-rib' | null
  inPleura: boolean
  sweep: number
  trocar: boolean
  tubeAngle: number | null
  tubeFr: 12 | 20 | 28 | null
  seal: boolean
  sutured: boolean
  xray: boolean
}

export function freshChest(): ChestRun {
  return {
    site: null,
    space: null,
    cleaned: 0,
    cannula: null,
    lane: null,
    depthCm: 0,
    decompressed: false,
    bundleHit: false,
    leftIn: false,
    armUp: false,
    confirmedSide: false,
    mark: null,
    markSpace: null,
    local: 0,
    aspiratedPleura: false,
    incision: null,
    dissectLane: null,
    inPleura: false,
    sweep: 0,
    trocar: false,
    tubeAngle: null,
    tubeFr: null,
    seal: false,
    sutured: false,
    xray: false,
  }
}

/** Push the needle to `cm`. It decompresses only if the site is in the chest, the lane is not the bundle, and it is long enough. */
export function pushNeedle(run: ChestRun, cm: number): { patch: Partial<ChestRun>; event: 'hiss' | 'short' | 'bundle' | 'move' } {
  if (!run.site || !run.cannula) return { patch: {}, event: 'move' }
  const max = CANNULA_CM[run.cannula]
  const depthCm = Math.min(cm, max)
  const wall = wallCm(run.site)
  const bundleHit = run.bundleHit || (run.lane === 'bundle' && depthCm > 1.5)
  if (depthCm >= wall && run.site !== 'rib') return { patch: { depthCm, decompressed: true, bundleHit }, event: run.decompressed ? 'move' : 'hiss' }
  if (cm >= max && max < wall) return { patch: { depthCm, bundleHit }, event: 'short' }
  return { patch: { depthCm, bundleHit }, event: bundleHit && !run.bundleHit ? 'bundle' : 'move' }
}

/** The incision on the front view, from a drag: how far from the upper border of the rib below, its length (cm) and slope. */
export function judgeIncision(a: Pt, b: Pt, space: number) {
  const mid = (a.y + b.y) / 2
  const upperBorderBelow = ribY(space + 1) - 3
  const lowerBorderAbove = ribY(space) + 3
  const angle = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 180
  const flat = Math.min(angle, 180 - angle)
  const where: 'upper-border' | 'lower-border' | 'other' = Math.abs(mid - upperBorderBelow) <= 3 ? 'upper-border' : Math.abs(mid - lowerBorderAbove) <= 3 ? 'lower-border' : 'other'
  return { where, length: Math.hypot(b.x - a.x, b.y - a.y) / 10, flat }
}

/* ---------------------------------------------------------------- check */

export const NEEDLE_MARKS = ['site', 'clean', 'needle', 'leave', 'drain'] as const
export const DRAIN_MARKS = ['position', 'mark', 'prep', 'incision', 'dissect', 'sweep', 'tube', 'seal', 'secure'] as const
export type ChestRow = { key: string; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function drainRows(r: ChestRun, fluid: Blood): ChestRow[] {
  const inc = r.incision
  return [
    { key: 'position', label: 'Position', value: [r.armUp && 'arm up behind the head', r.confirmedSide && 'side confirmed'].filter(Boolean).join(', ') || 'Not positioned', range: 'Arm up behind the head; the side checked on the patient and the film', ok: r.armUp && r.confirmedSide, why: 'Wrong-side drains still happen. The arm up opens the safe triangle.' },
    { key: 'mark', label: 'Safe triangle', value: r.mark === 'safe' ? `${r.markSpace}th space, just anterior to the mid-axillary line` : r.mark ? `Marked: ${r.mark}` : 'Not marked', range: '4th–5th intercostal space, just anterior to the mid-axillary line', ok: r.mark === 'safe', why: 'Below the nipple line you risk the diaphragm, liver or spleen; anteriorly the internal mammary and the heart.' },
    { key: 'prep', label: 'Asepsis and local', value: `${Math.round(r.cleaned * 100)}% cleaned, ${r.local.toFixed(0)} mL lidocaine${r.aspiratedPleura ? `, ${fluid} aspirated from the pleura` : ''}`, range: 'Clean and drape; infiltrate down to the pleura and aspirate ' + fluid, ok: r.cleaned >= 0.7 && r.local >= 5 && r.aspiratedPleura, why: `Aspirating ${fluid} with the local needle confirms you are over the collection.` },
    { key: 'incision', label: 'Incision', value: inc ? `${inc.length.toFixed(1)} cm along the ${inc.where === 'upper-border' ? 'upper border of the rib below' : inc.where === 'lower-border' ? 'lower border of the rib above' : 'middle of the space'}${inc.flat > 25 ? ', slanting across the ribs' : ''}` : 'None', range: 'About 3 cm, along the upper border of the rib below', ok: !!inc && inc.where === 'upper-border' && inc.flat <= 25 && inc.length >= 2 && inc.length <= 4.5, why: 'The neurovascular bundle runs under the lower border of each rib.', critical: !!inc && inc.where === 'lower-border' },
    { key: 'dissect', label: 'Blunt dissection', value: r.inPleura ? `Into the pleura ${r.dissectLane === 'top-of-rib' ? 'over the top of the rib' : r.dissectLane === 'bundle' ? 'under the rib above' : 'mid-space'}` : 'Pleura not entered', range: 'Forceps over the top of the rib below, into the pleura', ok: r.inPleura && r.dissectLane === 'top-of-rib', why: 'Over the top of the rib stays clear of the vessels; a pop and a rush tell you you are in.' },
    { key: 'sweep', label: 'Finger sweep', value: r.sweep >= 0.6 ? 'Lung and adhesions swept away' : 'Not swept', range: 'A finger in the pleura, swept round', ok: r.sweep >= 0.6, why: 'Make sure the space is free and the lung is not stuck to the wall before the tube goes in.' },
    { key: 'tube', label: 'Tube', value: r.trocar ? 'Pushed in on its trocar' : r.tubeAngle === null ? 'Not inserted' : `${r.tubeFr} Fr on a clamp, aimed ${r.tubeAngle > 20 ? 'up and back' : r.tubeAngle < -20 ? 'down' : 'straight across'}`, range: `${fluid === 'blood' ? '28–32' : '20–28'} Fr on a clamp, aimed posteriorly and up`, ok: !r.trocar && r.tubeAngle !== null && r.tubeAngle > 20 && (fluid === 'blood' ? r.tubeFr === 28 : r.tubeFr !== 12), why: 'A trocar can skewer the lung, heart or liver. A big clotting bleed blocks a small tube.', critical: r.trocar },
    { key: 'seal', label: 'Underwater seal', value: r.seal ? (fluid === 'blood' ? 'Swinging; 1600 mL of blood' : 'Swinging and bubbling') : 'Not connected', range: 'Connected; the fluid swings with breathing', ok: r.seal, why: 'Swing confirms the tube is in the pleura.' },
    { key: 'secure', label: 'Secure', value: [r.sutured && 'sutured and dressed', r.xray && 'repeat chest X-ray'].filter(Boolean).join(', ') || 'Neither', range: 'Suture, dress, and a chest X-ray', ok: r.sutured && r.xray, why: 'Drains fall out; the film shows where the tube lies.' },
  ]
}

export function needleRows(r: ChestRun): ChestRow[] {
  const drainOk = drainRows(r, 'air').filter((x) => x.ok).length >= 6
  return [
    { key: 'site', label: 'Site', value: r.site === 'safe' ? `${r.space}th space, just anterior to the mid-axillary line` : r.site === 'second-mcl' ? '2nd space, mid-clavicular line' : r.site ?? 'None', range: '4th/5th intercostal space, just anterior to the mid-axillary line', ok: r.site === 'safe', why: 'The chest wall is often thicker than a cannula at the 2nd space mid-clavicular line.' },
    { key: 'clean', label: 'Clean', value: r.cleaned >= 0.5 ? 'Skin cleaned' : 'Not cleaned', range: 'A quick wipe', ok: r.cleaned >= 0.5, why: 'Seconds matter, but a wipe takes one.' },
    { key: 'needle', label: 'Needle', value: `${r.cannula === 'long' ? '8 cm 14 G' : r.cannula === 'standard' ? 'Standard 32 mm' : 'None'}, ${r.lane === 'top-of-rib' ? 'over the top of the rib' : r.lane === 'bundle' ? 'under the rib above' : 'mid-space'}, ${r.decompressed ? 'hiss of air' : 'never reached the pleura'}`, range: 'A cannula of at least 8 cm, over the top of the rib below', ok: r.decompressed && r.cannula === 'long' && r.lane !== 'bundle', why: 'Too short and it never reaches the pleura; under the rib above it meets the intercostal vessels.', critical: !r.decompressed },
    { key: 'leave', label: 'Leave it', value: r.leftIn ? 'Cannula left in, taped' : 'Not secured', range: 'Leave the cannula in and tape it', ok: r.leftIn, why: 'It kinks and blocks easily: watch it until the drain is in.' },
    { key: 'drain', label: 'Chest drain', value: drainOk ? 'Drain in the safe triangle' : 'Drain incomplete', range: 'A chest drain in the safe triangle, promptly', ok: drainOk, why: 'Needle decompression is a temporising step; the drain is the treatment.' },
  ]
}
