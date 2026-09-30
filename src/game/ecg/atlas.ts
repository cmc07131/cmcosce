/** Every ECG the game can draw, in teaching order. */
import {
  brugada,
  hyperkalaemia,
  hypokalaemia,
  lbbb,
  longQt,
  lvh,
  pericarditis,
  pulmonaryEmbolism,
  rbbb,
  rhythms,
  sinus,
  stemi,
  tcaAfterBicarbonate,
  tcaToxicity,
  wpw,
  type EcgSpec,
} from './model'

export const ATLAS: (() => EcgSpec)[] = [
  () => sinus(),
  rhythms.sinusTachy,
  rhythms.sinusBrady,
  rhythms.firstDegree,
  rhythms.mobitz1,
  rhythms.mobitz2,
  rhythms.chb,
  () => rhythms.af(),
  () => rhythms.flutter(),
  () => rhythms.svt(),
  () => rhythms.vt(),
  rhythms.torsades,
  rhythms.vf,
  rhythms.asystole,
  () => rhythms.paced(true),
  () => rhythms.paced(false),
  rhythms.junctional,
  () => stemi('inferior'),
  () => stemi('anterior'),
  () => stemi('anterolateral'),
  () => stemi('lateral'),
  () => stemi('posterior'),
  () => hyperkalaemia('mild'),
  () => hyperkalaemia('moderate'),
  () => hyperkalaemia('severe'),
  () => hypokalaemia(),
  () => lbbb(),
  () => rbbb(),
  () => pericarditis(),
  pulmonaryEmbolism,
  () => lvh(),
  () => brugada(),
  () => wpw(),
  tcaToxicity,
  tcaAfterBicarbonate,
  () => longQt(),
]

let byId: Map<string, () => EcgSpec> | null = null

/** An atlas ECG by id; `rate` re-times rhythms that have one (sinus, AF, VT…) to match the live heart rate. */
export function ecgById(id: string, rate?: number): EcgSpec | null {
  if (!byId) byId = new Map(ATLAS.map((make) => [make().id, make]))
  const make = byId.get(id)
  if (!make) return null
  const spec = make()
  if (rate === undefined || !('rate' in spec.rhythm)) return spec
  return { ...spec, rhythm: { ...spec.rhythm, rate: Math.max(20, Math.round(rate)) } as EcgSpec['rhythm'] }
}
