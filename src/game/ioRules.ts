export const SHIN = { w: 200, h: 260 }
export const FLAT = { x: 130, y: 146, r: 26 }
export const BUMP = { x: 94, y: 108, r: 20 }

export type Landmark = 'flat' | 'bump' | 'joint' | 'shaft' | 'off'
export type NeedleColour = 'pink' | 'blue' | 'yellow'
export type NeedleSeat = 'short' | 'adult' | 'long'
export type DrillVerdict = 'early' | 'seated' | 'through'

/** Left proximal tibia, viewBox coordinates. Flat cortex is medial and distal to the tuberosity. */
export function classifyTibia(x: number, y: number): Landmark {
  if (Math.hypot(x - FLAT.x, y - FLAT.y) <= FLAT.r) return 'flat'
  if (Math.hypot(x - BUMP.x, y - BUMP.y) <= BUMP.r) return 'bump'
  if (y >= 62 && y <= 92 && x >= 64 && x <= 140) return 'joint'
  if (x >= 72 && x <= 132 && y >= 98 && y <= 248) return 'shaft'
  return 'off'
}

/** Adult proximal tibia with normal soft tissue. Pink buries the 5 mm mark. Yellow is for extra tissue or the humerus. */
export function needleSeat(colour: NeedleColour): NeedleSeat {
  if (colour === 'pink') return 'short'
  if (colour === 'yellow') return 'long'
  return 'adult'
}

/** Depth 0–100. Tip starts on cortex. Pop into marrow is 56. Far cortex is 90. */
export function drillRelease(depth: number): DrillVerdict {
  if (depth >= 90) return 'through'
  if (depth >= 56) return 'seated'
  return 'early'
}
