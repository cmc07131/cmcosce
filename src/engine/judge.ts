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

/**
 * How many of the station's steps the candidate has done (any non-trap choice, finding or region used).
 * The monitor is a readout, not a step. All done means the examiner has nothing left to watch.
 */
/**
 * A step is done once any of its non-trap options, findings or regions has been used. A step that only exists for
 * something that has not happened (a seizure on a run without one) is not waited for.
 */
function actionDone(a: Action, spent: Record<string, string[]>, scene: string[] = []) {
  const used = new Set(spent[a.id] ?? [])
  const real = (a.options ?? []).filter((o) => !o.isTrap)
  if (real.length && real.every((o) => o.when?.length) && !real.some((o) => (o.when ?? []).every((f) => scene.includes(f))) && !real.some((o) => used.has(o.id))) return true
  if ((a.options ?? []).some((o) => !o.isTrap && used.has(o.id))) return true
  if ((a.findings ?? []).some((f) => used.has(f.id))) return true
  return (a.regions ?? []).some((r) => used.has(r.id))
}

/**
 * The objective: the first phase with a step not yet done. Null when the station has no phases or all are
 * done (the examiner takes over from there).
 */
export function currentPhase(pack: Pack, spent: Record<string, string[]>, scene: string[] = []) {
  const phases = pack.phases ?? []
  for (let i = 0; i < phases.length; i++) {
    const steps = phases[i].steps.map((id) => pack.actions.find((a) => a.id === id)).filter((a): a is Action => Boolean(a))
    if (steps.some((a) => !actionDone(a, spent, scene))) return { index: i, total: phases.length, title: phases[i].title, goal: phases[i].goal }
  }
  return null
}

export type NextHint = { kind: 'do'; actionId: string; targetId: string; option: string } | { kind: 'wait' }

/**
 * Guided mode: the next thing to do in the perfect script. Walks the phases (or the script order) and returns
 * the first scoring option not yet used whose moment has come. Steps the examiner prompts are left to them. When
 * everything left is waiting on the patient (a seizure, VT), it says to watch.
 */
export function nextHint(pack: Pack, spent: Record<string, string[]>, scene: string[]): NextHint | null {
  const order = pack.phases?.length ? pack.phases.flatMap((p) => p.steps) : pack.goldPath
  // Something you prevented will not happen (no seizure once the bicarbonate is in): its treatment is not waited for.
  const events = pack.events ?? []
  const prevented = (f: string) =>
    !scene.includes(f) && events.some((e) => e.scene === f) && events.filter((e) => e.scene === f).every((e) => e.level === 'hard' || (e.unless && scene.includes(e.unless)))
  let waiting = false
  for (const id of order) {
    const a = pack.actions.find((x) => x.id === id)
    // The examiner's own end (what they prompt, and the viva) waits for them; a report you take to them does not.
    if (!a || a.kind === 'viva' || a.kind === 'monitor' || (a.ask && a.targetIds.includes('examiner'))) continue
    const used = new Set(spent[a.id] ?? [])
    const turnDone = new Set((a.options ?? []).filter((o) => used.has(o.id)).map((o) => o.group))
    for (const o of a.options ?? []) {
      // Scoring options, and treatments for something that happens to the patient (they wait on an event).
      if (o.isTrap || used.has(o.id) || (!o.marksChecklistIds?.length && !o.when?.length)) continue
      if ((a.kind === 'dialogue') && turnDone.has(o.group)) continue
      if ((o.when ?? []).some(prevented)) continue
      if (!(o.when ?? []).every((f) => scene.includes(f))) {
        waiting = true
        continue
      }
      return { kind: 'do', actionId: a.id, targetId: a.targetIds[0], option: o.label }
    }
    for (const f of a.findings ?? []) if (!used.has(f.id) && f.marksChecklistIds?.length) return { kind: 'do', actionId: a.id, targetId: a.targetIds[0], option: f.label }
  }
  return waiting ? { kind: 'wait' } : null
}

export type Level = 'normal' | 'hard'

/**
 * When nothing is left to do now, the clinical clock runs to the next thing that happens: the earliest event that a
 * pending action waits on (the 2-minute rhythm check before the second shock). Its due time on the clinical clock,
 * or null if nothing is waiting on time.
 */
export function nextWaitedEvent(pack: Pack, spent: Record<string, string[]>, scene: string[], sceneAt: Record<string, number>, level: Level) {
  const waitedOn = new Set<string>()
  for (const a of pack.actions) {
    const used = new Set(spent[a.id] ?? [])
    for (const o of a.options ?? []) if (!o.isTrap && !used.has(o.id)) for (const f of o.when ?? []) if (!scene.includes(f)) waitedOn.add(f)
  }
  let best: { eventId: string; dueAt: number } | null = null
  for (const ev of pack.events ?? []) {
    if (!waitedOn.has(ev.scene) || scene.includes(ev.scene)) continue
    if (ev.level && ev.level !== level) continue
    if (ev.unless && scene.includes(ev.unless)) continue
    const from = ev.after ? sceneAt[ev.after] : 0
    if (from === undefined) continue
    const dueAt = from + ev.delayS
    if (!best || dueAt < best.dueAt) best = { eventId: ev.id, dueAt }
  }
  return best
}

/** Events due now: on this difficulty, their trigger set long enough ago, not prevented, not already happened. */
export function dueEvents(pack: Pack, scene: string[], sceneAt: Record<string, number>, elapsedS: number, level: Level) {
  return (pack.events ?? []).filter((ev) => {
    if (ev.level && ev.level !== level) return false
    if (scene.includes(ev.scene) || (ev.unless && scene.includes(ev.unless))) return false
    const from = ev.after ? sceneAt[ev.after] : 0
    return from !== undefined && elapsedS >= from + ev.delayS
  })
}

/** Things that happened to the patient and were never treated (a seizure with no benzodiazepine). */
export function untreatedEvents(pack: Pack, scene: string[]) {
  const hit = (pack.events ?? []).filter((ev) => ev.untreated && ev.treatedBy && scene.includes(ev.scene) && !scene.includes(ev.treatedBy))
  // Two ways to the same seizure count once.
  return hit.filter((ev, i) => hit.findIndex((other) => other.scene === ev.scene) === i)
}

/** Something is still happening to the patient that needs treating (she is fitting). */
export function eventOngoing(pack: Pack, scene: string[]) {
  return (pack.events ?? []).some((ev) => ev.treatedBy && scene.includes(ev.scene) && !scene.includes(ev.treatedBy))
}

export function stepsDone(pack: Pack, spent: Record<string, string[]>, scene: string[] = []) {
  const steps = pack.goldPath.map((id) => pack.actions.find((a) => a.id === id)).filter((a): a is Action => Boolean(a) && a!.kind !== 'monitor')
  const done = steps.filter((a) => actionDone(a, spent, scene))
  return {
    done: done.length,
    total: steps.length,
    left: steps.filter((a) => !done.includes(a)).map((a) => (a.kind === 'viva' ? "Examiner's questions" : (a.prompt ?? a.id))),
  }
}
