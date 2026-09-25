import type { Action, ActionOption, LogEntry, Pack, SequenceRule } from './schema'

export function examinerClause(label: string) {
  const clause = label.split(/[.;]/)[0]?.trim() || label.trim()
  if (clause.length <= 70) return clause
  return `${clause.slice(0, 67).trimEnd()}…`
}

export function marksOnAction(action: Action): string[] {
  const ids = new Set<string>()
  for (const id of action.marksChecklistIds ?? []) ids.add(id)
  for (const opt of action.options ?? []) {
    if (opt.isTrap) continue
    for (const id of opt.marksChecklistIds ?? []) ids.add(id)
  }
  for (const f of action.findings ?? []) {
    for (const id of f.marksChecklistIds ?? []) ids.add(id)
  }
  for (const r of action.regions ?? []) {
    for (const id of r.marksChecklistIds ?? []) ids.add(id)
  }
  return [...ids]
}

export function hintFor(pack: Pack, earned: string[]): string {
  const have = new Set(earned)
  for (const id of pack.goldPath) {
    const action = pack.actions.find((a) => a.id === id)
    if (!action) continue
    const need = marksOnAction(action)
    if (need.length === 0) continue
    if (need.some((m) => !have.has(m))) return action.hint
  }
  return 'Handover / leave when you are ready.'
}

export function missingItems(need: string[] | undefined, inventory: string[]) {
  if (!need?.length) return []
  const have = new Set(inventory)
  return need.filter((id) => !have.has(id))
}

export type TalkApply = {
  lockedReason: string | null
  trapLine: string | null
  reply: string
  grantMarks: string[]
  grantItems: string[]
  spend: boolean
  endStation: boolean
  log: boolean
}

export function applyTalkOption(
  action: Action,
  option: ActionOption,
  inventory: string[],
  itemLabel: (id: string) => string,
): TalkApply {
  const missing = [
    ...missingItems(action.requiresItems, inventory),
    ...missingItems(option.requiresItems, inventory),
  ]
  if (missing.length) {
    return {
      lockedReason: `Need ${missing.map(itemLabel).join(', ')} first.`,
      trapLine: null,
      reply: '',
      grantMarks: [],
      grantItems: [],
      spend: false,
      endStation: false,
      log: false,
    }
  }
  if (option.isTrap) {
    return {
      lockedReason: null,
      trapLine: option.detail || 'That does not score.',
      reply: option.detail || 'That does not score.',
      grantMarks: [],
      grantItems: [],
      spend: true,
      endStation: false,
      log: false,
    }
  }
  return {
    lockedReason: null,
    trapLine: null,
    reply: option.detail || option.label,
    grantMarks: option.marksChecklistIds ?? [],
    grantItems: option.grantsItems ?? [],
    spend: true,
    endStation: Boolean(option.endStation || action.endStation),
    log: true,
  }
}

export type ConfirmApply = {
  grantMarks: string[]
  grantItems: string[]
  trapLines: string[]
  spendIds: string[]
  complete: boolean
  reply: string
}

/** Partial needed picks still score. Action-level marks wait until every needed row is selected. */
export function applyConfirm(action: Action, selectedIds: string[]): ConfirmApply {
  const options = action.options ?? []
  const selected = new Set(selectedIds)
  const needed = options.filter((o) => o.needed && !o.isTrap)
  const picked = options.filter((o) => selected.has(o.id))
  const grantMarks: string[] = []
  const grantItems: string[] = []
  const trapLines: string[] = []
  const spendIds: string[] = []
  for (const opt of picked) {
    spendIds.push(opt.id)
    if (opt.isTrap) {
      trapLines.push(opt.detail || `${opt.label} does not score.`)
      continue
    }
    grantMarks.push(...(opt.marksChecklistIds ?? []))
    grantItems.push(...(opt.grantsItems ?? []))
  }
  const complete = needed.every((o) => selected.has(o.id))
  if (complete) {
    grantMarks.push(...(action.marksChecklistIds ?? []))
    grantItems.push(...(action.grantsItems ?? []))
  }
  const reply = complete
    ? 'Taken.'
    : 'Some of the right kit is still on the trolley.'
  return { grantMarks, grantItems, trapLines, spendIds, complete, reply }
}

export function menuIsMulti(action: Action) {
  const needed = (action.options ?? []).filter((o) => o.needed && !o.isTrap).length
  return Boolean(action.confirmLabel) || needed > 1
}

export type SequenceVerdict = {
  id: string
  status: 'pass' | 'caution'
  note: string
}

function firstTime(log: LogEntry[], ids: string[]) {
  let best: number | null = null
  for (const id of ids) {
    for (const row of log) {
      if (row.actionId !== id) continue
      if (best === null || row.atMs < best) best = row.atMs
    }
  }
  return best
}

function timesOf(log: LogEntry[], id: string) {
  return log.filter((row) => row.actionId === id).map((row) => row.atMs)
}

export function judgeSequence(rules: SequenceRule[], log: LogEntry[]): SequenceVerdict[] {
  return rules.map((rule) => {
    if (rule.require === 'a-before-b') {
      const earlier = firstTime(log, rule.earlierAny)
      const later = firstTime(log, rule.laterAny)
      const ok = earlier === null || later === null || earlier < later
      return {
        id: rule.id,
        status: ok ? 'pass' : 'caution',
        note: ok ? rule.okNote : rule.failNote,
      }
    }
    const laterTimes = rule.laterAny.flatMap((id) => timesOf(log, id))
    if (!laterTimes.length) {
      return { id: rule.id, status: 'pass', note: rule.okNote }
    }
    const firstLater = Math.min(...laterTimes)
    const performedEarlier = rule.earlierAny.filter((id) => timesOf(log, id).length > 0)
    const ok = performedEarlier.every((id) => Math.min(...timesOf(log, id)) < firstLater)
    return {
      id: rule.id,
      status: ok ? 'pass' : 'caution',
      note: ok ? rule.okNote : rule.failNote,
    }
  })
}

export function itemLabel(pack: Pack, id: string) {
  return pack.items.find((item) => item.id === id)?.label ?? id
}

export function unique(ids: string[]) {
  return [...new Set(ids)]
}
