import { z } from 'zod'
import { offerOf } from '../game/exam3d/manoeuvres'
import { checkDo } from '../game/exam3d/model'
import { SITE_IDS } from '../game/exam3d/sites'
import { bodySchema, performKinds, vitalsSchema, type Action, type ActionOption, type Pack } from './schema'

/**
 * A station script: the compact form every new station is written in. `compileStation` turns it into a
 * full Pack (room, cast, actions, marks) so the play screen, debrief and badge work unchanged.
 *
 * Marks are written inline on the option that earns them; the compiler numbers them M01, M02… and gives
 * the same text the same id wherever it appears.
 */

const markField = z.union([z.string(), z.array(z.string())]).optional()

const optSchema = z.object({
  id: z.string().optional(),
  /** What you say or do. */
  t: z.string(),
  /** What comes back: the answer, the finding, the result, the nurse's reply. */
  r: z.string().optional(),
  mark: markField,
  /** true: no mark and a note on the debrief. 'critical': harms the patient. */
  trap: z.union([z.boolean(), z.literal('critical')]).optional(),
  need: z.boolean().optional(),
  img: z.string().optional(),
  mood: z.number().optional(),
  scene: z.string().optional(),
  /** The nurse fetches this from the drug cart or the kit trolley and gives it at the bedside. */
  fetch: z.enum(['cart', 'trolley']).optional(),
  /** Spoken Cantonese (Traditional Chinese) for conversations with patients and relatives: your line, their reply. */
  tz: z.string().optional(),
  rz: z.string().optional(),
  /** Steps: place in the correct sequence. */
  n: z.number().int().positive().optional(),
  end: z.boolean().optional(),
  perform: z.enum(performKinds).optional(),
  /** 3D examination: what you do to the patient that performs this, e.g. `feel iliac-R > feel ruq-R` (see game/exam3d/model.ts). */
  do: z.string().optional(),
  /** Perform detail, e.g. an exam test and the lesion side: "eyes:right". */
  pose: z.string().optional(),
  performHint: z.string().optional(),
  /** On the drug cart: the drug's name on the shelf, and this option's dose (shown after the drug is picked). */
  drug: z.string().optional(),
  dose: z.string().optional(),
  /** Only indicated once these scene flags are set (e.g. 'vt'): picked earlier, it is not given and scores a fault. */
  when: z.union([z.string(), z.array(z.string())]).optional(),
  /** Why it is not yet indicated, said by the nurse (e.g. "She isn't in VT."). */
  early: z.string().optional(),
  /** An examination close-up played before the finding (see CutIn). */
  anim: z.enum(['gloves', 'packet', 'airway', 'auscultate', 'pulse', 'pupils', 'glucose', 'abdomen', 'intubate']).optional(),
})
export type StationOpt = z.infer<typeof optSchema>

const stepSchema = z.object({
  id: z.string(),
  kind: z.enum(['say', 'pick', 'history', 'exam', 'order', 'steps', 'dialogue', 'viva', 'handover']),
  /** Who or what you walk up to: a cast id, or phone, trolley, cart, monitor, board, door. */
  to: z.string(),
  /** The neutral menu line ("Talk to the nurse"). It never names the answer. */
  label: z.string(),
  /** The practice-mode hint for this step. */
  hint: z.string().optional(),
  img: z.string().optional(),
  mark: markField,
  end: z.boolean().optional(),
  /** The examiner comes over and prompts this step at the end, saying this line (e.g. "Please present your findings."). */
  ask: z.string().optional(),
  confirm: z.string().optional(),
  /** 'en': stays in English though a patient is the target (the lines are the player's actions, or the speaker is staff). */
  lang: z.literal('en').optional(),
  opts: z.array(optSchema).optional(),
  groups: z.record(z.string(), z.array(optSchema)).optional(),
  mood: z.number().optional(),
  /** `lz`: the other person's line in spoken Cantonese. */
  turns: z.array(z.object({ line: z.string(), lz: z.string().optional(), opts: z.array(optSchema) })).optional(),
  qs: z
    .array(
      z.object({
        q: z.string(),
        a: z.string(),
        why: z.string().optional(),
        wrong: z.array(z.string()).min(1),
        mark: z.string().optional(),
        img: z.string().optional(),
      }),
    )
    .optional(),
})
export type StationStep = z.infer<typeof stepSchema>

export const stationTypes = ['resus', 'history', 'exam', 'comms', 'skills', 'teaching', 'psych'] as const

export const stationSchema = z.object({
  id: z.string(),
  gym: z.string(),
  title: z.string(),
  type: z.enum(stationTypes),
  time: z.number().int().positive().optional(),
  read: z.number().int().nonnegative().optional(),
  stem: z.string(),
  /** Guideline check, and every place the guideline differs from the source notes. */
  notes: z.string(),
  /**
   * What the author should re-check against their own notes: only what differs, is outdated, is rarely used
   * now, is missing, or could not be verified. Anything the notes already get right is left out. An empty list: nothing to review.
   */
  /**
   * The station's phases, in the order of the perfect script. Practice mode shows the current one as the
   * objective; it never blocks acting out of order. Each step belongs to at most one phase.
   */
  phases: z.array(z.object({ title: z.string(), goal: z.string(), steps: z.array(z.string()).min(1) })).optional(),
  /**
   * The case changes by itself: `delayS` seconds after the `after` scene flag (or after entering), `scene` is set
   * and `say` is announced (a seizure, VT). Vitals effects and `when` options key off the scene.
   */
  events: z
    .array(z.object({
        id: z.string(),
        after: z.string().optional(),
        delayS: z.number().nonnegative(),
        scene: z.string(),
        say: z.string(),
        /** The patient shakes on the bed from this event until this scene flag (e.g. a seizure until lorazepam). */
        shakeUntil: z.string().optional(),
        /** Does not happen if this flag is already set (a seizure that prompt bicarbonate prevents). */
        unless: z.string().optional(),
        /** Only on this difficulty: 'hard' presentations (she arrives fitting). */
        level: z.enum(['normal', 'hard']).optional(),
        /** If it happened and this flag never followed, the debrief says `untreated`. */
        treatedBy: z.string().optional(),
        untreated: z.string().optional(),
      }))
    .optional(),
  /** The 3D examination: the patient's starting position and the signs they show (see game/exam3d/scene.ts). */
  body: bodySchema.optional(),
  review: z.array(z.object({ tag: z.enum(['differs', 'outdated', 'rarely used', 'missing', 'unverified']), text: z.string() })).optional(),
  cast: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        /** Patient only: lying on the bed, or standing/sitting in the room. */
        inBed: z.boolean().optional(),
      }),
    )
    .min(1),
  vitals: vitalsSchema.optional(),
  steps: z.array(stepSchema).min(1),
  rules: z
    .array(
      z.object({
        id: z.string(),
        first: z.array(z.string()),
        then: z.array(z.string()),
        fail: z.string(),
        ok: z.string().optional(),
      }),
    )
    .optional(),
  badge: z.object({ name: z.string(), emoji: z.string().optional(), flavor: z.string() }),
  /** Flashcards for this gym's tall grass. The first option is the answer; the game shuffles them. */
  cards: z
    .array(
      z.object({
        q: z.string(),
        options: z.array(z.string()).length(4),
        why: z.string(),
        source: z.string(),
        note: z.string().optional(),
      }),
    )
    .optional(),
})
export type Station = z.infer<typeof stationSchema>

type Room = Pack['room']
type Spot = { x: number; y: number }

type Template = {
  room: Room
  /** Where the patient goes: in the bed, or standing. */
  bed: Spot
  standing: Spot
  /** Fixed spots for named roles, then free spots for anyone else. */
  roles: Record<string, Spot>
  free: Spot[]
}

function walls(cols: number, rows: number, doorX: number) {
  return [
    { id: 'wall-n', kind: 'wall', x: 0, y: 0, w: cols, h: 1 },
    { id: 'wall-w', kind: 'wall', x: 0, y: 1, w: 1, h: rows - 2 },
    { id: 'wall-e', kind: 'wall', x: cols - 1, y: 1, w: 1, h: rows - 2 },
    { id: 'wall-s1', kind: 'wall', x: 0, y: rows - 1, w: doorX, h: 1 },
    { id: 'wall-s2', kind: 'wall', x: doorX + 1, y: rows - 1, w: cols - doorX - 1, h: 1 },
  ]
}

function resusBay(): Template {
  return {
    room: {
      template: 'resus-bay',
      cols: 12,
      rows: 10,
      tileSize: 32,
      playerStart: { x: 5, y: 8 },
      props: [
        ...walls(12, 10, 5),
        { id: 'monitor', kind: 'monitor', x: 4, y: 2, w: 3, h: 1 },
        { id: 'bed', kind: 'bed', x: 4, y: 3, w: 4, h: 2 },
        { id: 'stripe', kind: 'hazard', x: 4, y: 5, w: 4, h: 1 },
        { id: 'trolley-prop', kind: 'trolley', x: 1, y: 2 },
        { id: 'cart-prop', kind: 'trolley', x: 1, y: 4 },
        { id: 'sink', kind: 'sink', x: 10, y: 5 },
        { id: 'ventilator-prop', kind: 'ventilator', x: 8, y: 2 },
      ],
      interactables: [
        { id: 'door', kind: 'door', x: 5, y: 9, label: 'Door' },
        { id: 'monitor', kind: 'monitor', x: 4, y: 2, w: 3, h: 1, label: 'Monitor' },
        { id: 'trolley', kind: 'trolley', x: 1, y: 2, label: 'Trolley' },
        { id: 'cart', kind: 'trolley', x: 1, y: 4, label: 'Drugs' },
        { id: 'phone', kind: 'phone', x: 10, y: 2, label: 'Phone' },
        { id: 'ventilator', kind: 'ventilator', x: 8, y: 2, label: 'Vent' },
        { id: 'bed-ix', kind: 'bed', x: 4, y: 3, w: 4, h: 2, label: '' },
      ],
    },
    bed: { x: 5, y: 4 },
    standing: { x: 5, y: 6 },
    roles: { nurse: { x: 9, y: 3 }, examiner: { x: 8, y: 7 } },
    free: [
      { x: 2, y: 7 },
      { x: 9, y: 6 },
      { x: 3, y: 6 },
      { x: 10, y: 7 },
    ],
  }
}

function cubicle(kind: 'exam' | 'talk'): Template {
  const props = [
    ...walls(10, 8, 4),
    { id: 'curtain', kind: 'curtain', x: 1, y: 1, w: 1, h: 1 },
    { id: 'sink', kind: 'sink', x: 8, y: 1 },
    { id: 'plant', kind: 'plant', x: 1, y: 5 },
  ]
  const interactables: Room['interactables'] = [{ id: 'door', kind: 'door', x: 4, y: 7, label: 'Door' }]
  if (kind === 'exam') {
    props.push({ id: 'bed', kind: 'bed', x: 3, y: 2, w: 4, h: 2 })
    interactables.push({ id: 'bed-ix', kind: 'bed', x: 3, y: 2, w: 4, h: 2, label: '' })
  } else {
    props.push({ id: 'desk', kind: 'desk', x: 3, y: 3, w: 3, h: 1 })
    props.push({ id: 'chair-a', kind: 'chair', x: 2, y: 2 })
  }
  props.push({ id: 'trolley-prop', kind: 'trolley', x: 8, y: 3 })
  interactables.push({ id: 'trolley', kind: 'trolley', x: 8, y: 3, label: 'Trolley' })
  props.push({ id: 'phone-prop', kind: 'phone', x: 7, y: 1 })
  interactables.push({ id: 'phone', kind: 'phone', x: 7, y: 1, label: 'Phone' })
  return {
    room: { template: 'cubicle', cols: 10, rows: 8, tileSize: 32, playerStart: { x: 4, y: 6 }, props, interactables },
    bed: { x: 4, y: 3 },
    standing: kind === 'exam' ? { x: 2, y: 4 } : { x: 4, y: 2 },
    roles: { examiner: { x: 8, y: 5 }, nurse: { x: 6, y: 1 } },
    free: [
      { x: 2, y: 3 },
      { x: 6, y: 2 },
      { x: 2, y: 5 },
      { x: 7, y: 5 },
    ],
  }
}

function teachingRoom(): Template {
  const props = [
    ...walls(10, 8, 4),
    { id: 'board', kind: 'whiteboard', x: 3, y: 1, w: 3, h: 1 },
    { id: 'table', kind: 'table', x: 3, y: 3, w: 3, h: 1 },
    { id: 'trolley-prop', kind: 'trolley', x: 8, y: 3 },
    { id: 'plant', kind: 'plant', x: 1, y: 1 },
  ]
  return {
    room: {
      template: 'teaching-room',
      cols: 10,
      rows: 8,
      tileSize: 32,
      playerStart: { x: 4, y: 6 },
      props,
      interactables: [
        { id: 'door', kind: 'door', x: 4, y: 7, label: 'Door' },
        { id: 'board', kind: 'whiteboard', x: 3, y: 1, w: 3, h: 1, label: 'Board' },
        { id: 'trolley', kind: 'trolley', x: 8, y: 3, label: 'Kit' },
        { id: 'table-ix', kind: 'table', x: 3, y: 3, w: 3, h: 1, label: 'Manikin' },
      ],
    },
    bed: { x: 4, y: 3 },
    standing: { x: 4, y: 2 },
    roles: { examiner: { x: 8, y: 5 }, junior: { x: 2, y: 4 } },
    free: [
      { x: 6, y: 4 },
      { x: 2, y: 2 },
      { x: 7, y: 5 },
    ],
  }
}

function templateFor(station: Station): Template {
  // A patient on a monitor is in resus, whatever the station type.
  if (station.type === 'resus' || station.vitals) return resusBay()
  if (station.type === 'teaching') return teachingRoom()
  const patient = station.cast.find((c) => c.id === 'patient')
  const lying = station.type === 'exam' || station.type === 'skills' || Boolean(patient?.inBed)
  return cubicle(lying ? 'exam' : 'talk')
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
}

/** Replies get a speaker so the right sprite talks: "Mr Lee: …". Lines that already name one keep it. */
function spoken(speaker: string | undefined, text: string | undefined) {
  if (!text) return undefined
  if (!speaker || /^[^:]{1,24}:\s/.test(text)) return text
  return `${speaker}: ${text}`
}

export function compileStation(station: Station): Pack {
  const tpl = templateFor(station)
  const marks: { id: string; label: string }[] = []
  const markIds = new Map<string, string>()
  const markOf = (field: string | string[] | undefined): string[] => {
    if (!field) return []
    const list = Array.isArray(field) ? field : [field]
    return list.map((label) => {
      const known = markIds.get(label)
      if (known) return known
      const id = `M${String(marks.length + 1).padStart(2, '0')}`
      marks.push({ id, label })
      markIds.set(label, id)
      return id
    })
  }

  const cast: Pack['cast'] = []
  const free = [...tpl.free]
  for (const who of station.cast) {
    let spawn: Spot
    if (who.id === 'patient') {
      const lying = tpl.room.interactables.some((i) => i.id === 'bed-ix') && (station.type === 'resus' || Boolean(station.vitals) || station.type === 'exam' || station.type === 'skills' || who.inBed)
      spawn = lying && who.inBed !== false ? tpl.bed : tpl.standing
    } else {
      spawn = tpl.roles[who.id] ?? tpl.roles[who.role] ?? free.shift() ?? { x: 2, y: 2 }
    }
    cast.push({ id: who.id, role: who.role, displayName: who.name, spawn, pixelKey: who.role })
  }
  if (!cast.some((c) => c.id === 'examiner')) {
    cast.push({ id: 'examiner', role: 'examiner', displayName: 'Examiner', spawn: tpl.roles.examiner, pixelKey: 'examiner' })
  }
  const patient = cast.find((c) => c.id === 'patient')
  const patientInBed = Boolean(patient && patient.spawn.x === tpl.bed.x && patient.spawn.y === tpl.bed.y && tpl.room.interactables.some((i) => i.id === 'bed-ix'))

  const nameOf = (id: string) => cast.find((c) => c.id === id)?.displayName
  const targetsOf = (to: string) => (to === 'patient' && patientInBed ? ['patient', 'bed-ix'] : [to])

  const option = (step: StationStep, o: StationOpt, i: number, group?: string, speaker?: string): ActionOption => {
    const id = o.id ?? (group !== undefined ? `${slug(group)}-${i + 1}` : `o${i + 1}`)
    return {
      id,
      label: o.t,
      detail: spoken(speaker, o.r),
      needed: o.need,
      isTrap: o.trap ? true : undefined,
      critical: o.trap === 'critical' ? true : undefined,
      marksChecklistIds: o.trap ? undefined : markOf(o.mark),
      endStation: o.end,
      scene: o.scene,
      group,
      img: o.img,
      mood: o.mood,
      order: o.n,
      perform: o.perform,
      do: o.do,
      fetch: o.fetch,
      labelZh: o.tz,
      detailZh: spoken(speaker, o.rz),
      performPose: o.pose,
      performHint: o.performHint,
      anim: o.anim,
      when: o.when === undefined ? undefined : Array.isArray(o.when) ? o.when : [o.when],
      early: o.early,
      drug: o.drug,
      dose: o.dose,
    }
  }

  const actions: Action[] = station.steps.map((step) => {
    const other = nameOf(step.to)
    const base: Action = {
      id: step.id,
      kind: 'talk',
      targetIds: targetsOf(step.to),
      hint: step.hint ?? step.label,
      prompt: step.label,
      img: step.img,
      endStation: step.end,
      ask: step.ask,
    }
    switch (step.kind) {
      case 'say':
        return { ...base, kind: 'talk', options: (step.opts ?? []).map((o, i) => option(step, o, i)) }
      case 'handover':
        return { ...base, kind: 'handover', options: (step.opts ?? []).map((o, i) => option(step, o, i)) }
      case 'pick':
        return {
          ...base,
          kind: 'kit',
          confirmLabel: step.confirm ?? 'Use these',
          marksChecklistIds: markOf(step.mark),
          options: (step.opts ?? []).map((o, i) => option(step, o, i)),
        }
      case 'steps':
        return { ...base, kind: 'steps', marksChecklistIds: markOf(step.mark), options: (step.opts ?? []).map((o, i) => option(step, o, i)) }
      case 'history':
      case 'exam':
      case 'order': {
        const speaker = step.kind === 'history' ? other : undefined
        const options = Object.entries(step.groups ?? {}).flatMap(([group, list]) => list.map((o, i) => option(step, o, i, group, speaker)))
        return { ...base, kind: step.kind, options }
      }
      case 'dialogue': {
        const turns = (step.turns ?? []).map((turn, i) => ({ id: `t${i + 1}`, line: spoken(other, turn.line) ?? turn.line, lineZh: spoken(other, turn.lz) }))
        const options = (step.turns ?? []).flatMap((turn, i) => turn.opts.map((o, j) => option(step, o, j, `t${i + 1}`, other)))
        return { ...base, kind: 'dialogue', turns, startMood: step.mood ?? 5, options }
      }
      case 'viva': {
        const qs = step.qs ?? []
        const turns = qs.map((q, i) => ({ id: `q${i + 1}`, line: q.q }))
        const options = qs.flatMap((q, i) => {
          const group = `q${i + 1}`
          const why = q.why ? ` ${q.why}` : ''
          return [
            { id: `${group}-a`, label: q.a, detail: `Correct.${why}`, group, img: q.img, marksChecklistIds: markOf(q.mark ?? `${q.q} ${q.a}`) },
            ...q.wrong.map((w, j) => ({ id: `${group}-w${j + 1}`, label: w, detail: `The answer: ${q.a}.${why}`, group, isTrap: true })),
          ]
        })
        return { ...base, kind: 'viva', turns, options }
      }
    }
  })

  if (station.vitals) {
    actions.push({ id: 'monitor', kind: 'monitor', targetIds: ['monitor'], hint: 'Look at the monitor.', prompt: 'Monitor' })
  }

  // A focused examination offers only real manoeuvres at real places.
  for (const key of Object.keys(station.body?.findings ?? {}))
    if (!(station.body?.focus ?? []).includes(key)) throw new Error(`${station.id}: finding for "${key}", which is not in the focus list`)
  for (const entry of station.body?.focus ?? []) {
    const o = offerOf(entry)
    if (!o) throw new Error(`${station.id}: focus "${entry}" is not a manoeuvre`)
    if (o.site && !SITE_IDS.includes(o.site)) throw new Error(`${station.id}: focus "${entry}" names no site "${o.site}"`)
  }
  // A 3D examination line that names a tool, site or instruction that does not exist would never be performed.
  for (const step of station.steps)
    for (const o of Object.values(step.groups ?? {}).flat())
      if (o.do) for (const problem of checkDo(o.do)) throw new Error(`${station.id}: "${o.t}": ${problem}`)

  // Ending early would strand the steps after it (usually the viva) and their marks.
  station.steps.forEach((step, i) => {
    const ends = step.end || (step.opts ?? []).some((o) => o.end)
    if (ends && i < station.steps.length - 1) throw new Error(`${station.id}: step ${step.id} ends the station before ${station.steps[i + 1].id}`)
  })

  const known = new Set(actions.map((a) => a.id))
  for (const rule of station.rules ?? []) {
    for (const id of [...rule.first, ...rule.then]) if (!known.has(id)) throw new Error(`${station.id}: rule ${rule.id} names unknown step ${id}`)
  }
  const stepIds = new Set(station.steps.map((s) => s.id))
  const phased = new Set<string>()
  for (const phase of station.phases ?? []) {
    for (const id of phase.steps) {
      if (!stepIds.has(id)) throw new Error(`${station.id}: phase ${phase.title} names unknown step ${id}`)
      if (phased.has(id)) throw new Error(`${station.id}: step ${id} is in two phases`)
      phased.add(id)
    }
  }
  // Every `when` flag must be one the station can actually set: by an option or by an event.
  const settable = new Set([
    ...station.steps.flatMap((s) => [...(s.opts ?? []), ...Object.values(s.groups ?? {}).flat(), ...(s.turns ?? []).flatMap((t) => t.opts)]).flatMap((o) => (o.scene ? [o.scene] : [])),
    ...(station.events ?? []).map((e) => e.scene),
  ])
  for (const s of station.steps)
    for (const o of [...(s.opts ?? []), ...Object.values(s.groups ?? {}).flat()])
      for (const flag of o.when === undefined ? [] : Array.isArray(o.when) ? o.when : [o.when])
        if (!settable.has(flag)) throw new Error(`${station.id}: ${s.id} waits for '${flag}', which nothing sets`)
  const targetIds = new Set([...cast.map((c) => c.id), ...tpl.room.interactables.map((i) => i.id)])
  for (const action of actions) {
    for (const t of action.targetIds) if (!targetIds.has(t)) throw new Error(`${station.id}: step ${action.id} walks to unknown ${t}`)
  }

  return {
    packId: station.id,
    title: station.title,
    meta: {
      timeLimitSec: station.time ?? 420,
      readTimeSec: station.read ?? 60,
      stationType: station.type,
      gym: station.gym,
      stem: station.stem,
      guidelineNotes: station.notes,
    },
    room: tpl.room,
    cast,
    items: [],
    marks,
    actions,
    goldPath: station.steps.map((s) => s.id),
    phases: station.phases,
    events: station.events,
    sequenceRules: (station.rules ?? []).map((rule) => ({
      id: rule.id,
      earlierAny: rule.first,
      laterAny: rule.then,
      require: 'all-earlier-before-any-later' as const,
      okNote: rule.ok ?? 'In the right order.',
      failNote: rule.fail,
    })),
    vitals: station.vitals,
    body: station.body,
    badge: { id: station.id, name: station.badge.name, emoji: station.badge.emoji, flavor: station.badge.flavor },
  }
}

/** A station's flashcards in the deck format (answer index 0; the battle shuffles). */
export function stationCards(station: Station) {
  return (station.cards ?? []).map((card, i) => ({ id: `${station.id}-c${i + 1}`, answer: 0, ...card }))
}
