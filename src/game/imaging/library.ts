import { chest } from './chest'
import { type Field, Pixels } from './field'
import { head } from './head'
import { burnChart, chestEschar, chickenpox, fightBite, fundus, purpura, scarletRash, scarletTongue, zoster, type BurnRegion } from './photos'
import { ankle, cspine, elbow, hip, pelvis, shoulder, wrist } from './skeleton'
import { cardiac, earlyPregnancy, fastPelvis, fastRuq } from './ultrasound'

/**
 * Every image a station can hand you, by reference: `xr:`, `ct:`, `us:`, `photo:` (and `ecg:` for the
 * 12-lead, drawn by the ECG engine). The title is what the film is, never what it shows.
 */

export type Picture = { kind: 'grey'; field: Field } | { kind: 'rgb'; pixels: Pixels }
export type Entry = { title: string; make: () => Picture }

const grey = (title: string, make: () => Field): Entry => ({ title, make: () => ({ kind: 'grey', field: make() }) })
const rgb = (title: string, make: () => Pixels): Entry => ({ title, make: () => ({ kind: 'rgb', pixels: make() }) })

const CXR_AP = 'Chest X-ray, AP supine'
const CXR_PA = 'Chest X-ray, PA erect'
const CXR_ERECT = 'Chest X-ray, erect'
const CT = 'CT head, non-contrast'

export const IMAGES: Record<string, Entry> = {
  'xr:cxr-normal': grey(CXR_PA, () => chest({})),
  'xr:cxr-tension-l': grey(CXR_AP, () => chest({ view: 'AP', ptx: { side: 'L', size: 'large', tension: true } })),
  'xr:cxr-tension-r': grey(CXR_AP, () => chest({ view: 'AP', ptx: { side: 'R', size: 'large', tension: true } })),
  'xr:cxr-ptx-r': grey(CXR_PA, () => chest({ ptx: { side: 'R', size: 'large' } })),
  'xr:cxr-ptx-small-l': grey(CXR_PA, () => chest({ ptx: { side: 'L', size: 'small' } })),
  'xr:cxr-haemothorax-l': grey(CXR_ERECT, () => chest({ fluid: { side: 'L', level: 0.85 } })),
  'xr:cxr-haemothorax-r-supine': grey(CXR_AP, () => chest({ view: 'AP', fluid: { side: 'R', level: 0.9, supine: true } })),
  'xr:cxr-drain-r': grey(CXR_AP, () => chest({ view: 'AP', drain: 'R', fluid: { side: 'R', level: 0.15 } })),
  'xr:cxr-ett-good': grey(CXR_AP, () => chest({ view: 'AP', ett: 'good' })),
  'xr:cxr-ett-right': grey(CXR_AP, () => chest({ view: 'AP', ett: 'right-main' })),
  'xr:cxr-pneumonia-rll': grey(CXR_PA, () => chest({ consolidation: { side: 'R', zone: 'lower' } })),
  'xr:cxr-pneumonia-rml': grey(CXR_PA, () => chest({ consolidation: { side: 'R', zone: 'middle' } })),
  'xr:cxr-pneumonia-lul': grey(CXR_PA, () => chest({ consolidation: { side: 'L', zone: 'upper' } })),
  'xr:cxr-oedema': grey(CXR_AP, () => chest({ view: 'AP', oedema: true, cardiomegaly: true })),
  'xr:cxr-free-air': grey(CXR_ERECT, () => chest({ freeAir: true })),
  'xr:cxr-wide-mediastinum': grey(CXR_AP, () => chest({ view: 'AP', wideMediastinum: true })),
  'xr:cxr-rib-fractures-l': grey(CXR_AP, () => chest({ view: 'AP', ribFractures: { side: 'L', ribs: [4, 5, 6, 7] }, surgicalEmphysema: 'L' })),
  'xr:cxr-hyperinflated': grey(CXR_PA, () => chest({ hyperinflated: true })),

  'ct:head-normal': grey(CT, () => head({})),
  'ct:edh-r': grey(CT, () => head({ edh: { side: 'R' }, fracture: { side: 'R' } })),
  'ct:edh-l': grey(CT, () => head({ edh: { side: 'L' }, fracture: { side: 'L' } })),
  'ct:sdh-l': grey(CT, () => head({ sdh: { side: 'L' } })),
  'ct:sdh-r': grey(CT, () => head({ sdh: { side: 'R' } })),
  'ct:sah': grey(`${CT}, basal cisterns`, () => head({ slice: 'basal', sah: true })),
  'ct:ich-r': grey(CT, () => head({ ich: { side: 'R' } })),
  'ct:infarct-l': grey(CT, () => head({ infarct: { side: 'L' } })),

  'xr:wrist-normal': grey('Wrist, PA and lateral', () => wrist('normal')),
  'xr:wrist-colles': grey('Wrist, PA and lateral', () => wrist('colles')),
  'xr:elbow-normal': grey('Elbow, lateral', () => elbow('normal')),
  'xr:elbow-supracondylar': grey('Elbow, lateral', () => elbow('supracondylar')),
  'xr:shoulder-normal': grey('Shoulder, AP', () => shoulder('normal')),
  'xr:shoulder-anterior': grey('Shoulder, AP', () => shoulder('anterior')),
  'xr:pelvis-normal': grey('Pelvis, AP', () => pelvis('normal')),
  'xr:pelvis-open-book': grey('Pelvis, AP', () => pelvis('open-book')),
  'xr:ankle-normal': grey('Ankle, mortise view', () => ankle('normal')),
  'xr:ankle-weber-b': grey('Ankle, mortise view', () => ankle('weber-b')),
  'xr:hip-normal': grey('Hip, AP', () => hip('normal')),
  'xr:hip-nof': grey('Hip, AP', () => hip('nof')),
  'xr:cspine-normal': grey('Cervical spine, lateral', () => cspine('normal')),
  'xr:cspine-short': grey('Cervical spine, lateral', () => cspine('short')),
  'xr:cspine-c5-6': grey('Cervical spine, lateral', () => cspine('c5-6')),

  'us:fast-ruq-pos': grey('FAST, right upper quadrant', () => fastRuq(true)),
  'us:fast-ruq-neg': grey('FAST, right upper quadrant', () => fastRuq(false)),
  'us:fast-pelvis-pos': grey('FAST, pelvis', () => fastPelvis(true)),
  'us:fast-pelvis-neg': grey('FAST, pelvis', () => fastPelvis(false)),
  'us:cardiac-effusion': grey('FAST, subxiphoid', () => cardiac(true)),
  'us:cardiac-normal': grey('FAST, subxiphoid', () => cardiac(false)),
  'us:early-ectopic': grey('Pelvic ultrasound, transabdominal', () => earlyPregnancy('ectopic')),
  'us:early-iup': grey('Pelvic ultrasound, transabdominal', () => earlyPregnancy('iup')),

  'photo:purpura': rgb('Photograph: leg, glass test', purpura),
  'photo:scarlet-tongue': rgb('Photograph: face and tongue', scarletTongue),
  'photo:scarlet-rash': rgb('Photograph: elbow crease', scarletRash),
  'photo:chickenpox': rgb('Photograph: trunk', chickenpox),
  'photo:zoster': rgb('Photograph: trunk', zoster),
  'photo:fight-bite': rgb('Photograph: dorsum of hand', fightBite),
  'photo:fundus-normal': rgb('Fundoscopy', () => fundus('normal')),
  'photo:fundus-papilloedema': rgb('Fundoscopy', () => fundus('papilloedema')),
  'photo:chest-eschar': rgb('Photograph: chest', chestEschar),
}

/** `photo:burns:chest-partial,r-arm-full`: a burns chart for any regions and depths. */
function burnsEntry(ref: string): Entry | null {
  const m = ref.match(/^photo:burns:(.+)$/)
  if (!m) return null
  const regions = m[1].split(',').map((part) => {
    const at = part.lastIndexOf('-')
    return { region: part.slice(0, at) as BurnRegion, depth: part.slice(at + 1) as 'superficial' | 'partial' | 'full' }
  })
  return rgb('Burns chart, front and back', () => burnChart(regions))
}

export function imageEntry(ref: string): Entry | null {
  return IMAGES[ref] ?? burnsEntry(ref)
}

export function imageTitle(ref: string) {
  if (ref.startsWith('ecg:')) return '12-lead ECG'
  return imageEntry(ref)?.title ?? 'Image'
}
