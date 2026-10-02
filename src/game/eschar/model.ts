/**
 * Escharotomy of the chest and arm (British Burn Association; EMSB; ATLS 11th). Pure.
 *
 * Chest from the front, 180 × 200: clavicles at y 30, the costal margin at y 150, anterior axillary lines at x 36
 * and x 144, midline x 90. Arm from the front, 200 × 110, in the anatomical position: the lateral (radial) border on
 * top at y 42, the medial (ulnar) border below at y 88, the volar midline over the tendons at y 65.
 */

export type Pt = { x: number; y: number }
export type ChestLine = 'aal-r' | 'aal-l' | 'costal' | 'midline' | 'other'
export type ArmLine = 'lateral' | 'medial' | 'volar' | 'other'

export const CHEST = { clavicleY: 30, costalY: 150, aal: [36, 144] as const, mid: 90 }
export const ARM = { lateralY: 42, medialY: 88, volarY: 65, x0: 14, x1: 190 }

export function judgeChestLine(path: Pt[]): ChestLine {
  if (path.length < 2) return 'other'
  const xs = path.map((p) => p.x)
  const ys = path.map((p) => p.y)
  const spanY = Math.max(...ys) - Math.min(...ys)
  const spanX = Math.max(...xs) - Math.min(...xs)
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
  if (spanY > 80 && spanX < 30) {
    const reachesTop = Math.min(...ys) <= CHEST.clavicleY + 18
    const reachesBottom = Math.max(...ys) >= CHEST.costalY - 14
    if (!reachesTop || !reachesBottom) return 'other'
    if (Math.abs(meanX - CHEST.aal[0]) <= 12) return 'aal-r'
    if (Math.abs(meanX - CHEST.aal[1]) <= 12) return 'aal-l'
    if (Math.abs(meanX - CHEST.mid) <= 12) return 'midline'
    return 'other'
  }
  if (spanX > 80 && spanY < 30 && Math.abs(meanY - CHEST.costalY) <= 14) return 'costal'
  return 'other'
}

export function judgeArmLine(path: Pt[]): ArmLine {
  if (path.length < 2) return 'other'
  const xs = path.map((p) => p.x)
  const ys = path.map((p) => p.y)
  if (Math.max(...xs) - Math.min(...xs) < 120) return 'other'
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
  if (Math.abs(meanY - ARM.lateralY) <= 8) return 'lateral'
  if (Math.abs(meanY - ARM.medialY) <= 8) return 'medial'
  if (Math.abs(meanY - ARM.volarY) <= 10) return 'volar'
  return 'other'
}

export type EscharRun = {
  cleaned: boolean
  kitReady: boolean
  marks: ChestLine[]
  depth: 'fat' | 'muscle' | null
  cut: ChestLine[]
  bleeders: number
  diathermied: number
  /** Which bleeding points are dry. */
  dry: number[]
  dressed: boolean
  rechecked: boolean
  armLines: ArmLine[]
  armDoppler: boolean
}

export function freshEschar(): EscharRun {
  return { cleaned: false, kitReady: false, marks: [], depth: null, cut: [], bleeders: 0, diathermied: 0, dry: [], dressed: false, rechecked: false, armLines: [], armDoppler: false }
}

/** Chest released when both sides and the costal line are cut through the eschar. */
export const released = (r: EscharRun) => ['aal-r', 'aal-l', 'costal'].every((l) => r.cut.includes(l as ChestLine)) && r.depth !== null

/** Ventilation: peak pressure and saturation follow the release. */
export function vent(r: EscharRun) {
  if (released(r)) return { peak: 27, spo2: 95, etco2: 5.6 }
  const partial = r.cut.filter((l) => l === 'aal-r' || l === 'aal-l' || l === 'costal').length
  return { peak: 42 - partial * 3, spo2: 84 + partial * 2, etco2: 8.4 - partial * 0.5 }
}

export const ESCHAR_MARKS = ['prep', 'mark-aal', 'mark-costal', 'cut', 'haemostasis', 'recheck', 'arm'] as const
export type EscharRow = { key: (typeof ESCHAR_MARKS)[number]; label: string; value: string; range: string; ok: boolean; why: string; critical?: boolean }

export function checkEschar(r: EscharRun): EscharRow[] {
  const v = vent(r)
  const hasBoth = r.marks.includes('aal-r') && r.marks.includes('aal-l')
  return [
    { key: 'prep', label: 'Prepare', value: [r.cleaned && 'cleaned and draped', r.kitReady && 'diathermy and scalpel ready'].filter(Boolean).join(', ') || 'Nothing', range: 'Clean and drape; diathermy and a scalpel ready', ok: r.cleaned && r.kitReady, why: 'The cuts bleed once you are through the eschar.' },
    { key: 'mark-aal', label: 'Mark: sides', value: hasBoth ? 'Both anterior axillary lines, clavicle to costal margin' : r.marks.includes('midline') ? 'A midline line only' : 'Not both sides', range: 'Both anterior axillary lines, from the clavicle to the costal margin', ok: hasBoth, why: 'The chest cannot expand until both sides are released.' },
    { key: 'mark-costal', label: 'Mark: costal', value: r.marks.includes('costal') ? 'Along the costal margin, joining them' : 'No transverse line', range: 'A transverse line along the costal margin joining them', ok: r.marks.includes('costal'), why: 'The transverse cut frees the front of the chest as a mobile shield.' },
    { key: 'cut', label: 'Cut', value: r.depth === 'muscle' ? 'Through fascia into muscle' : released(r) ? 'Through the eschar into fat; the edges spring apart' : `${r.cut.length} line${r.cut.length === 1 ? '' : 's'} cut`, range: 'Through the eschar into the fat, until the edges spring apart', ok: released(r) && r.depth === 'fat' && !r.cut.includes('midline'), why: 'Deeper than the fat adds bleeding and injury without more release.', critical: r.depth === 'muscle' },
    { key: 'haemostasis', label: 'Haemostasis', value: `${r.diathermied}/${r.bleeders} bleeders diathermied${r.dressed ? ', alginate dressing' : ''}`, range: 'Diathermy the bleeding points; dress with alginate', ok: r.bleeders > 0 && r.diathermied >= r.bleeders && r.dressed, why: 'Escharotomies can lose a surprising amount of blood.' },
    { key: 'recheck', label: 'Recheck', value: r.rechecked ? `Peak ${v.peak} cmH2O, SpO2 ${v.spo2}%` : 'Not rechecked', range: 'Ventilation and saturation again', ok: r.rechecked && released(r), why: 'If it has not improved, think again: DOPES.' },
    { key: 'arm', label: 'Arm', value: r.armLines.includes('volar') ? 'Down the front over the tendons' : r.armLines.includes('lateral') && r.armLines.includes('medial') ? 'Mid-lateral and mid-medial, along the eschar' : 'Incomplete', range: 'Mid-lateral and mid-medial incisions along the whole eschar', ok: r.armLines.includes('lateral') && r.armLines.includes('medial') && !r.armLines.includes('volar'), why: 'Over the front of the forearm you expose tendons and nerves.', critical: r.armLines.includes('volar') },
  ]
}
