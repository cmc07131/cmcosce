/**
 * Stations the author has personally been through and signed off: they show a REVIEWED tag in the gym lists and on
 * the station's own screen. Add a station's id here once you have reviewed it.
 */
export const REVIEWED: ReadonlySet<string> = new Set([
  // The first three, rebuilt by hand.
  'io-em-01',
  'cv-em-02',
  'aw-em-01',
  // Airway and trauma.
  'atls-crico-teach',
  'atls-cspine-teach',
  'atls-lma',
  // Resuscitation.
  'acls-tca',
  // Examinations and procedures.
  'md-cerebellar',
  'md-vertigo',
  'ot-hare',
  'pd-supracondylar',
  'sx-suture',
])

export const isReviewed = (id: string) => REVIEWED.has(id)
