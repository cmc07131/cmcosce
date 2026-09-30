import { create } from 'zustand'
import {
  applyConfirm,
  applyTalkOption,
  examinerClause,
  itemLabel,
  menuIsMulti,
  unique,
} from '~/engine/judge'
import { clearSession, freshSession, readSession, writeSession } from '~/engine/session'
import { SAVE_VERSION, timeLimitOf, type Action, type ActionOption, type Fault, type Pack, type PerformKind, type Session } from '~/engine/schema'

export type Overlay =
  | { kind: 'chooser'; targetId: string }
  | { kind: 'action'; actionId: string; targetId: string }
  | { kind: 'stem' }

type Toast = { id: string; text: string; token: number }

export type PerformJob = {
  actionId: string
  spendId: string
  kind: PerformKind
  pose?: string
  hint: string
  label: string
  reply: string
  grantMarks: string[]
  grantItems: string[]
  scene: string
  endStation: boolean
}

/** `scene` flags change the room afterwards: the monitor readout, the patient's pose. */
export type BenchResult = { marks: string[]; faults: { text: string; critical?: boolean }[]; summary: string; scene?: string | string[] }

export type MsgTone = 'say' | 'trap' | 'warn' | 'info'
/** The one line the text box shows. `speakerId` animates that actor's mouth while it types. */
export type Msg = { text: string; speakerId: string | null; tone: MsgTone; token: number }

/** Something the nurse has to fetch and give: walk to the cart or trolley, then to the patient. */
/**
 * A job for the nurse. `give`: fetch from the cart or trolley and give or apply it at the bedside, where its
 * scene effects start. `refuse`: a wrong drug or item — the nurse will not fetch it, walks over and slaps you.
 */
export type Errand =
  | { token: number; kind: 'give'; from: 'cart' | 'trolley'; items: string[]; scenes: string[] }
  | { token: number; kind: 'refuse'; from: 'cart' | 'trolley'; items: string[]; line: string }

let errandToken = 1

/** What the nurse fetched, grouped by where it comes from. Traps too: the nurse does as told. */
const sceneList = (o: ActionOption) => (Array.isArray(o.scene) ? o.scene : o.scene ? [o.scene] : [])

function errandsFor(options: ActionOption[]): Errand[] {
  const out: Errand[] = []
  for (const from of ['cart', 'trolley'] as const) {
    const good = options.filter((o) => o.fetch === from && !o.isTrap)
    if (good.length) out.push({ token: errandToken++, kind: 'give', from, items: good.map((o) => o.label), scenes: good.flatMap(sceneList) })
    const wrong = options.filter((o) => o.fetch === from && o.isTrap)
    if (wrong.length) out.push({ token: errandToken++, kind: 'refuse', from, items: wrong.map((o) => o.label), line: wrong[0].detail ?? '' })
  }
  return out
}

/** Scene effects of an option the nurse fetches wait for the bedside; everything else starts at once. */
const startsNow = (o: ActionOption) => !o.fetch

/** Is it indicated yet? Options with `when` wait for those scene flags (a seizure, VT, the fluid in). */
export function indicated(o: ActionOption, scene: string[]) {
  return (o.when ?? []).every((flag) => scene.includes(flag))
}

/** Asked for too early: not given, not spent, a fault, and the nurse says why. */
function tooEarly(pack: Pack, action: Action, rows: ActionOption[]) {
  const faults: Fault[] = rows.map((o) => ({ actionId: action.id, text: `Too early: "${o.label}". ${o.early ?? 'It was not indicated yet.'}` }))
  const nurse = pack.cast.find((c) => c.role === 'nurse')?.id
  const line = `Not now, doctor. ${rows[0]?.early ?? "She doesn't need that yet."}`
  return { faults, msg: nurse ? message(line, 'say', nurse) : message(line, 'warn') }
}

type PlayState = Session & {
  hydrated: boolean
  /** Fetch-and-give jobs waiting for the nurse, oldest first. Not saved: a reload finds them done. */
  errands: Errand[]
  takeErrand: (token: number) => void
  /** The nurse is at the bedside: the job's effects start now. */
  deliverErrand: (pack: Pack, token: number) => void
  /** The case changes by itself (a seizure, VT): set the event's scene and announce it. */
  fireEvent: (pack: Pack, eventId: string) => void
  overlay: Overlay | null
  msg: Msg | null
  toasts: Toast[]
  findingNote: string | null
  performing: PerformJob | null
  performQueue: PerformJob[]
  boot: (pack: Pack) => void
  rerun: (pack: Pack) => void
  enterRoom: () => void
  tick: () => void
  setPosition: (position: Session['position']) => void
  openTarget: (pack: Pack, targetId: string, hide?: string[]) => void
  openAction: (actionId: string, targetId: string) => void
  closeOverlay: () => void
  showStem: () => void
  pickOption: (pack: Pack, actionId: string, optionId: string) => void
  confirmOptions: (pack: Pack, actionId: string, optionIds: string[]) => void
  pickFinding: (pack: Pack, actionId: string, findingId: string) => void
  pickRegion: (pack: Pack, actionId: string, regionId: string) => void
  /** `result` comes from a bench that scores itself: only its marks are granted, and its faults are kept. */
  finishPerform: (pack: Pack, result?: BenchResult) => void
  cancelPerform: () => void
  leave: () => void
  dismissToast: (token: number) => void
  note: (text: string, tone?: MsgTone, speakerId?: string | null) => void
  clearMsg: () => void
}

let toastToken = 1

function persist(state: Session) {
  const session: Session = {
    saveVersion: state.saveVersion,
    packId: state.packId,
    startedAt: state.startedAt,
    entered: state.entered,
    secondsLeft: state.secondsLeft,
    position: state.position,
    inventory: state.inventory,
    earnedMarks: state.earnedMarks,
    spent: state.spent,
    log: state.log,
    ended: state.ended,
    scene: state.scene ?? [],
    seed: state.seed,
    faults: state.faults ?? [],
    sceneAt: state.sceneAt ?? {},
  }
  writeSession(session)
}

let msgToken = 1

function message(text: string, tone: MsgTone, speakerId: string | null = null): Msg {
  return { text, tone, speakerId, token: ++msgToken }
}

/** Pack lines open with "You:" or a cast name ("Nurse Wong: …"). No prefix is narration. */
export function spokenLine(pack: Pack, text: string): Msg {
  const m = text.match(/^([^:]{1,24}):\s*(.*)$/s)
  if (m) {
    const who = m[1].trim().toLowerCase()
    if (who === 'you') return message(m[2], 'say', 'player')
    const npc = pack.cast.find((row) => row.displayName.toLowerCase() === who || row.role.toLowerCase() === who)
    if (npc) return message(m[2], 'say', npc.id)
  }
  return message(text, 'info')
}

export function fallbackPerformHint(kind: PerformKind) {
  switch (kind) {
    case 'lift':
      return 'Drag your hand up until the cord is free. Leave the hand there.'
    case 'cover':
      return 'Drag the gauze onto the loop. Loose, not tight.'
    case 'dress':
      return 'Drag it on.'
    case 'listen':
      return 'Hold the probe on the abdomen.'
    case 'pose':
      return 'Drag her into the new position.'
    case 'cannula':
      return 'Drag the cannula to the arm.'
    case 'look':
      return 'Drag the drape aside and look.'
    case 'release':
      return 'Drag your hand away. Do not push it back.'
    case 'io':
      return 'Brace the leg, landmark the flat tibia, and drill the IO to the pop.'
    case 'exam':
      return 'Examine him as you would for real, then press Finish.'
    case 'igel':
      return 'Size it, lubricate it, position the head, glide it along the palate to resistance, then confirm, decompress and tape.'
    case 'cico':
    case 'pacing':
    case 'cord':
      return 'Do it as you would on a real patient. Nothing stops you making a mistake.'
  }
}

function sceneKey(kind: PerformKind, pose?: string) {
  if (kind === 'look' || kind === 'exam' || kind === 'igel') return ''
  if (kind === 'pose') return `pose:${pose || 'knee'}`
  if (kind === 'dress') return 'dress'
  return kind
}

function actionById(pack: Pack, id: string) {
  return pack.actions.find((action) => action.id === id)
}

const emptySession: Session = {
  saveVersion: SAVE_VERSION,
  packId: '',
  startedAt: 0,
  entered: false,
  secondsLeft: 420,
  position: { x: 0, y: 0, facing: 'n' },
  inventory: [],
  earnedMarks: [],
  spent: {},
  log: [],
  ended: null,
  scene: [],
  seed: 1,
  faults: [],
}

export const usePlay = create<PlayState>((set, get) => ({
  ...emptySession,
  hydrated: false,
  overlay: null,
  msg: null,
  toasts: [],
  findingNote: null,
  performing: null,
  performQueue: [],
  errands: [],

  takeErrand: (token) => set({ errands: get().errands.filter((e) => e.token !== token) }),

  fireEvent: (pack, eventId) => {
    const ev = pack.events?.find((e) => e.id === eventId)
    const cur = get()
    if (!ev || (cur.scene ?? []).includes(ev.scene)) return
    const sceneAt = { ...(cur.sceneAt ?? {}), [ev.scene]: elapsedOf(pack, cur) }
    set({ scene: [...(cur.scene ?? []), ev.scene], sceneAt, msg: message(ev.say, 'warn') })
  },

  deliverErrand: (pack, token) => {
    const job = get().errands.find((e) => e.token === token)
    if (!job || job.kind !== 'give' || !job.scenes.length) return
    const cur = get()
    const sceneAt = { ...(cur.sceneAt ?? {}) }
    for (const flag of job.scenes) if (sceneAt[flag] === undefined) sceneAt[flag] = elapsedOf(pack, cur)
    set({ scene: unique([...(cur.scene ?? []), ...job.scenes]), sceneAt, errands: cur.errands.map((e) => (e.token === token ? { ...e, scenes: [] } : e)) })
  },

  boot: (pack) => {
    const saved = readSession(pack.packId)
    const session = saved ?? freshSession(pack)
    if (!saved) writeSession(session)
    set({
      ...session,
      hydrated: true,
      overlay: session.entered ? null : { kind: 'stem' },
      msg: null,
      toasts: [],
      findingNote: null,
      performing: null,
      performQueue: [],
      errands: [],
    })
  },

  rerun: (pack) => {
    clearSession(pack.packId)
    const session = freshSession(pack)
    writeSession(session)
    set({
      ...session,
      hydrated: true,
      overlay: { kind: 'stem' },
      msg: null,
      toasts: [],
      findingNote: null,
      performing: null,
      performQueue: [],
      errands: [],
    })
  },

  enterRoom: () => {
    const cur = get()
    if (cur.entered) {
      set({ overlay: null })
      return
    }
    const next = { ...slice(cur), entered: true, startedAt: Date.now() }
    persist(next)
    set({ ...next, overlay: null })
  },

  tick: () => {
    const cur = get()
    if (!cur.entered || cur.ended || cur.secondsLeft <= 0) return
    const secondsLeft = cur.secondsLeft - 1
    const next = { ...slice(cur), secondsLeft }
    persist(next)
    set({ secondsLeft })
  },

  setPosition: (position) => {
    const cur = get()
    const next = { ...slice(cur), position }
    persist(next)
    set({ position })
  },

  openTarget: (pack, targetId, hide = []) => {
    const actions = pack.actions.filter((action) => action.targetIds.includes(targetId) && !hide.includes(action.id))
    if (!actions.length) {
      set({ msg: message('Nothing to use here.', 'info') })
      return
    }
    if (actions.length === 1) {
      set({ overlay: { kind: 'action', actionId: actions[0].id, targetId }, findingNote: null })
      return
    }
    set({ overlay: { kind: 'chooser', targetId }, findingNote: null })
  },

  openAction: (actionId, targetId) => set({ overlay: { kind: 'action', actionId, targetId }, findingNote: null }),

  closeOverlay: () => set({ overlay: null, findingNote: null }),

  showStem: () => set({ overlay: { kind: 'stem' } }),

  pickOption: (pack, actionId, optionId) => {
    const action = actionById(pack, actionId)
    const option = action?.options?.find((row) => row.id === optionId)
    if (!action || !option) return
    const cur = get()
    if ((cur.spent[actionId] ?? []).includes(optionId)) return
    if (!option.isTrap && !indicated(option, cur.scene ?? [])) {
      const early = tooEarly(pack, action, [option])
      set({ faults: [...(cur.faults ?? []), ...early.faults], msg: early.msg })
      return
    }
    const applied = applyTalkOption(action, option, cur.inventory, (id) => itemLabel(pack, id))
    if (applied.lockedReason) {
      set({ msg: message(applied.lockedReason, 'warn') })
      return
    }
    if (!option.isTrap && option.perform) {
      set({
        performing: jobFromOption(action, option, applied),
        performQueue: [],
      })
      return
    }
    const turnBased = action.kind === 'dialogue' || action.kind === 'viva'
    const spendIds = !applied.spend
      ? []
      : turnBased
        ? [optionId, ...(action.options ?? []).filter((row) => row.group === option.group && row.id !== optionId).map((row) => row.id)]
        : [optionId]
    commit(set, get, pack, action, {
      grantMarks: applied.grantMarks,
      grantItems: applied.grantItems,
      spendIds,
      faultsAdd: faultsFor(action, option, cur.spent[actionId] ?? []),
      trapLines: applied.trapLine && option.isTrap ? [applied.trapLine] : [],
      reply: applied.reply,
      log: applied.log,
      endStation: applied.endStation,
      close: false,
      sceneAdd: startsNow(option) ? option.scene : undefined,
    })
    if (applied.reply && !option.isTrap) set({ msg: spokenLine(pack, applied.reply) })
    if (applied.spend && option.fetch) set({ errands: [...get().errands, ...errandsFor([option])] })
  },

  confirmOptions: (pack, actionId, optionIds) => {
    const action = actionById(pack, actionId)
    if (!action) return
    const cur = get()
    const already = new Set(cur.spent[actionId] ?? [])
    const asked = (action.options ?? []).filter((row) => optionIds.includes(row.id) && !already.has(row.id))
    // Not indicated yet: held back, scored, and the nurse says so. The rest goes ahead.
    const early = asked.filter((row) => !row.isTrap && !indicated(row, cur.scene ?? []))
    if (early.length) {
      const e = tooEarly(pack, action, early)
      set({ faults: [...(cur.faults ?? []), ...e.faults], msg: e.msg })
    }
    const freshIds = asked.filter((row) => !early.includes(row)).map((row) => row.id)
    if (!freshIds.length) return
    const chosen = (action.options ?? []).filter((row) => freshIds.includes(row.id))
    const immediate = chosen.filter((row) => row.isTrap || !row.perform).map((row) => row.id)
    const gestured = chosen.filter((row) => !row.isTrap && row.perform)
    const applied = applyConfirm(action, immediate)
    const jobs = gestured.map((row) =>
      jobFromOption(action, row, applyTalkOption(action, row, cur.inventory, (id) => itemLabel(pack, id))),
    )
    commit(set, get, pack, action, {
      ...applied,
      sceneAdd: chosen.filter((row) => !row.isTrap && !row.perform && row.scene && startsNow(row)).flatMap(sceneList),
      faultsAdd: chosen.filter((row) => row.isTrap).flatMap((row) => faultsFor(action, row, [])),
      log: applied.grantMarks.length > 0 || applied.spendIds.some((id) => {
        const opt = action.options?.find((row) => row.id === id)
        return Boolean(opt && !opt.isTrap)
      }),
      endStation: Boolean(action.endStation && applied.complete && jobs.length === 0),
      close: applied.complete && jobs.length === 0,
    })
    if (jobs.length) {
      set({ performing: jobs[0], performQueue: jobs.slice(1), msg: applied.trapLines[0] ? message(applied.trapLines[0], 'trap') : get().msg })
    }
    const fetched = errandsFor(chosen.filter((row) => !row.perform))
    if (fetched.length) set({ errands: [...get().errands, ...fetched] })
  },

  pickFinding: (pack, actionId, findingId) => {
    const action = actionById(pack, actionId)
    const finding = action?.findings?.find((row) => row.id === findingId)
    if (!action || !finding) return
    const cur = get()
    const seen = (cur.spent[actionId] ?? []).includes(findingId)
    if (seen) {
      set({ findingNote: finding.detail || finding.label, msg: message(finding.detail || finding.label, 'info') })
      return
    }
    if (finding.perform) {
      set({
        performing: {
          actionId,
          spendId: findingId,
          kind: finding.perform,
          pose: finding.performPose,
          hint: finding.performHint || fallbackPerformHint(finding.perform),
          label: finding.label,
          reply: finding.detail || finding.label,
          grantMarks: finding.marksChecklistIds ?? [],
          grantItems: [],
          scene: sceneKey(finding.perform, finding.performPose),
          endStation: false,
        },
        performQueue: [],
      })
      return
    }
    set({ findingNote: finding.detail || finding.label, msg: message(finding.detail || finding.label, 'info') })
    commit(set, get, pack, action, {
      grantMarks: finding.marksChecklistIds ?? [],
      grantItems: [],
      spendIds: [findingId],
      trapLines: [],
      reply: finding.detail || finding.label,
      log: true,
      endStation: false,
      close: false,
    })
  },

  pickRegion: (pack, actionId, regionId) => {
    const action = actionById(pack, actionId)
    const region = action?.regions?.find((row) => row.id === regionId)
    if (!action || !region) return
    const cur = get()
    const seen = (cur.spent[actionId] ?? []).includes(regionId)
    if (seen) {
      set({ findingNote: region.finding, msg: message(region.finding, 'info') })
      return
    }
    if (region.perform) {
      set({
        performing: {
          actionId,
          spendId: regionId,
          kind: region.perform,
          pose: region.performPose,
          hint: region.performHint || fallbackPerformHint(region.perform),
          label: region.label,
          reply: region.finding,
          grantMarks: region.marksChecklistIds ?? [],
          grantItems: [],
          scene: sceneKey(region.perform, region.performPose),
          endStation: false,
        },
        performQueue: [],
      })
      return
    }
    set({ findingNote: region.finding, msg: message(region.finding, 'info') })
    commit(set, get, pack, action, {
      grantMarks: region.marksChecklistIds ?? [],
      grantItems: [],
      spendIds: [regionId],
      trapLines: [],
      reply: region.finding,
      log: true,
      endStation: false,
      close: false,
    })
  },

  finishPerform: (pack, result) => {
    const cur = get()
    const job = cur.performing
    if (!job) return
    if (result) {
      const faults = [...(cur.faults ?? []).filter((row) => row.actionId !== job.actionId), ...result.faults.map((row) => ({ ...row, actionId: job.actionId }))]
      set({ faults })
      job.grantMarks = result.marks
      job.reply = result.summary
      const flags = Array.isArray(result.scene) ? result.scene : result.scene ? [result.scene] : []
      if (flags.length) {
        job.scene = flags[0]
        const sceneAt = { ...(get().sceneAt ?? {}) }
        for (const f of flags.slice(1)) if (sceneAt[f] === undefined) sceneAt[f] = elapsedOf(pack, get())
        set({ scene: unique([...(get().scene ?? []), ...flags.slice(1)]), sceneAt })
      }
    }
    const action = actionById(pack, job.actionId)
    if (!action) {
      set({ performing: null, performQueue: [] })
      return
    }
    commit(set, get, pack, action, {
      grantMarks: job.grantMarks,
      grantItems: job.grantItems,
      spendIds: [job.spendId],
      trapLines: [],
      reply: job.reply,
      log: true,
      endStation: job.endStation,
      close: true,
      sceneAdd: job.scene,
    })
    const queue = get().performQueue
    const next = queue[0] ?? null
    set({
      performing: next,
      performQueue: queue.slice(1),
      findingNote: job.reply,
      msg: next ? get().msg : spokenLine(pack, job.reply),
    })
  },

  cancelPerform: () => set({ performing: null, performQueue: [] }),

  leave: () => {
    const cur = get()
    const next = { ...slice(cur), ended: 'complete' as const }
    persist(next)
    set({ ended: 'complete', overlay: null })
  },

  dismissToast: (token) => set({ toasts: get().toasts.filter((toast) => toast.token !== token) }),

  note: (text, tone = 'info', speakerId = null) => set({ msg: message(text, tone, speakerId) }),

  clearMsg: () => set({ msg: null }),
}))

function slice(state: PlayState): Session {
  return {
    saveVersion: state.saveVersion,
    packId: state.packId,
    startedAt: state.startedAt,
    entered: state.entered,
    secondsLeft: state.secondsLeft,
    position: state.position,
    inventory: state.inventory,
    earnedMarks: state.earnedMarks,
    spent: state.spent,
    log: state.log,
    ended: state.ended,
    scene: state.scene ?? [],
    seed: state.seed,
    faults: state.faults ?? [],
    sceneAt: state.sceneAt ?? {},
  }
}

/** Seconds since the candidate walked in, on the station clock. */
export function elapsedOf(pack: Pack, state: Pick<Session, 'secondsLeft' | 'entered'>) {
  return state.entered ? Math.max(0, timeLimitOf(pack) - state.secondsLeft) : 0
}

/**
 * What goes on the debrief for a pick: a trap is a note (critical if it harms), a wrong viva answer is a
 * note with the answer, and a procedure step done before an earlier one is an order note.
 */
export function faultsFor(action: Action, option: ActionOption, spentBefore: string[]): Fault[] {
  if (option.isTrap) {
    if (action.kind === 'viva') {
      const q = action.turns?.find((t) => t.id === option.group)?.line ?? ''
      return [{ actionId: action.id, text: `${q} You said "${option.label}". ${option.detail ?? ''}`.trim() }]
    }
    return [{ actionId: action.id, text: `"${option.label}" — ${option.detail ?? 'does not score.'}`, critical: option.critical }]
  }
  if (action.kind === 'steps' && option.order) {
    const done = new Set(spentBefore)
    const skipped = (action.options ?? []).filter((row) => row.order && row.order < (option.order ?? 0) && !row.isTrap && !done.has(row.id))
    if (skipped.length) {
      return [{ actionId: action.id, text: `"${option.label}" came before: ${skipped.map((row) => row.label).join('; ')}.` }]
    }
  }
  return []
}

function jobFromOption(
  action: Action,
  option: NonNullable<Action['options']>[number],
  applied: { reply: string; grantMarks: string[]; grantItems: string[]; endStation: boolean },
): PerformJob {
  const kind = option.perform ?? 'look'
  return {
    actionId: action.id,
    spendId: option.id,
    kind,
    pose: option.performPose,
    hint: option.performHint || fallbackPerformHint(kind),
    label: option.label,
    reply: applied.reply,
    grantMarks: applied.grantMarks,
    grantItems: applied.grantItems,
    scene: option.scene || sceneKey(kind, option.performPose),
    endStation: applied.endStation,
  }
}

function commit(
  set: (partial: Partial<PlayState> | ((state: PlayState) => Partial<PlayState>)) => void,
  get: () => PlayState,
  pack: Pack,
  action: Action,
  result: {
    grantMarks: string[]
    grantItems: string[]
    spendIds: string[]
    trapLines: string[]
    reply: string
    log: boolean
    endStation: boolean
    close: boolean
    sceneAdd?: string | string[]
    faultsAdd?: Fault[]
  },
) {
  const cur = get()
  const earned = new Set(cur.earnedMarks)
  const freshMarks = unique(result.grantMarks).filter((id) => pack.marks.some((mark) => mark.id === id) && !earned.has(id))
  for (const id of freshMarks) earned.add(id)
  const inventory = unique([...cur.inventory, ...result.grantItems])
  const spent = { ...cur.spent, [action.id]: unique([...(cur.spent[action.id] ?? []), ...result.spendIds]) }
  const needed = (action.options ?? []).filter((row) => row.needed && !row.isTrap)
  if (needed.length > 0 && needed.every((row) => spent[action.id].includes(row.id))) {
    for (const id of action.marksChecklistIds ?? []) {
      if (pack.marks.some((mark) => mark.id === id) && !earned.has(id) && !freshMarks.includes(id)) {
        earned.add(id)
        freshMarks.push(id)
      }
    }
    for (const id of action.grantsItems ?? []) {
      if (!inventory.includes(id)) inventory.push(id)
    }
  }
  const adds = Array.isArray(result.sceneAdd) ? result.sceneAdd : result.sceneAdd ? [result.sceneAdd] : []
  const scene = unique([...(cur.scene ?? []), ...adds])
  const sceneAt = { ...(cur.sceneAt ?? {}) }
  for (const flag of adds) if (sceneAt[flag] === undefined) sceneAt[flag] = elapsedOf(pack, cur)
  const faults = [...(cur.faults ?? []), ...(result.faultsAdd ?? [])]
  const atMs = cur.entered ? Date.now() - cur.startedAt : 0
  const log = result.log
    ? [...cur.log, { actionId: action.id, atMs, markIds: freshMarks }]
    : cur.log
  const ended = result.endStation ? 'complete' : cur.ended
  const next: Session = {
    ...slice(cur),
    inventory,
    earnedMarks: [...earned],
    spent,
    log,
    ended,
    scene,
    sceneAt,
    faults,
  }
  persist(next)
  const toasts = [...cur.toasts]
  for (const id of freshMarks) {
    const mark = pack.marks.find((row) => row.id === id)
    if (!mark) continue
    toasts.push({ id, text: examinerClause(mark.label), token: toastToken++ })
  }
  const workLeft = overlayHasWork(action, spent[action.id] ?? [], menuIsMulti(action))
  set({
    ...next,
    toasts,
    msg: result.trapLines[0]
      ? message(result.trapLines[0], 'trap')
      : result.reply
        ? spokenLine(pack, result.reply)
        : cur.msg,
    overlay: result.close || !workLeft || result.endStation ? null : cur.overlay,
  })
}

function overlayHasWork(action: Action, spentIds: string[], multi: boolean) {
  const spent = new Set(spentIds)
  if (action.kind === 'examine-face') {
    return (action.findings ?? []).some((row) => !spent.has(row.id))
  }
  if (action.kind === 'examine-body') {
    return (action.regions ?? []).some((row) => !spent.has(row.id))
  }
  if (action.kind === 'monitor') return true
  if (action.kind === 'steps') return (action.options ?? []).some((row) => !row.isTrap && !spent.has(row.id))
  if (action.kind === 'kit' || (action.kind === 'menu' && multi)) {
    return (action.options ?? []).some((row) => row.needed && !row.isTrap && !spent.has(row.id))
  }
  return (action.options ?? []).some((row) => !spent.has(row.id))
}
