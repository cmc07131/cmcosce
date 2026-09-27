import type { Pack } from './schema'

export type PatientLang = 'zh' | 'en'

/**
 * The pack as the candidate meets it: conversations with patients and relatives in spoken Cantonese
 * (when a translation exists), everything with staff, the examiner and the mark sheet in English.
 */
export function localizePack(pack: Pack, lang: PatientLang): Pack {
  if (lang === 'en') return pack
  return {
    ...pack,
    actions: pack.actions.map((a) => ({
      ...a,
      options: a.options?.map((o) => ({ ...o, label: o.labelZh ?? o.label, detail: o.detailZh ?? o.detail })),
      turns: a.turns?.map((t) => ({ ...t, line: t.lineZh ?? t.line })),
    })),
  }
}
