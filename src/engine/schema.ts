import { z } from 'zod'

export const SAVE_VERSION = 2

const tile = z.object({
  x: z.number().int(),
  y: z.number().int(),
})

export const performKinds = ['lift', 'cover', 'dress', 'listen', 'pose', 'cannula', 'look', 'release', 'io', 'cico', 'pacing', 'cord', 'exam', 'igel'] as const
export type PerformKind = (typeof performKinds)[number]

const performFields = {
  perform: z.enum(performKinds).optional(),
  performPose: z.string().optional(),
  performHint: z.string().optional(),
}

const optionSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** The nurse fetches this from the drug cart or the kit trolley and gives it at the bedside. */
  fetch: z.enum(['cart', 'trolley']).optional(),
  /** Spoken Cantonese for patient conversations; shown instead of label/detail when the patient language is Chinese. */
  labelZh: z.string().optional(),
  detailZh: z.string().optional(),
  detail: z.string().optional(),
  needed: z.boolean().optional(),
  isTrap: z.boolean().optional(),
  marksChecklistIds: z.array(z.string()).optional(),
  grantsItems: z.array(z.string()).optional(),
  requiresItems: z.array(z.string()).optional(),
  endStation: z.boolean().optional(),
  scene: z.string().optional(),
  /** Section heading in grouped panels (history, exam, order), or the turn id in dialogue and viva. */
  group: z.string().optional(),
  /** An image shown with the reply: `ecg:<atlas id>`, `xr:<id>`, `ct:<id>`, `photo:<id>`. */
  img: z.string().optional(),
  /** Dialogue: how this reply moves the other person's distress (−2 calms … +2 inflames). */
  mood: z.number().optional(),
  /** A trap that would harm the patient: shown as CRITICAL on the debrief. */
  critical: z.boolean().optional(),
  /** Steps: this option's place in the correct sequence (1-based). */
  order: z.number().int().positive().optional(),
  ...performFields,
})

export const actionKinds = ['talk', 'kit', 'menu', 'examine-face', 'examine-body', 'handover', 'history', 'exam', 'order', 'steps', 'dialogue', 'viva', 'monitor'] as const
export type ActionKind = (typeof actionKinds)[number]

const actionSchema = z.object({
  id: z.string(),
  kind: z.enum(actionKinds),
  targetIds: z.array(z.string()).min(1),
  hint: z.string(),
  prompt: z.string().optional(),
  confirmLabel: z.string().optional(),
  requiresItems: z.array(z.string()).optional(),
  grantsItems: z.array(z.string()).optional(),
  marksChecklistIds: z.array(z.string()).optional(),
  endStation: z.boolean().optional(),
  /** The examiner prompts this step at the end of the station, with this line (the viva is always asked at the end). */
  ask: z.string().optional(),
  options: z.array(optionSchema).optional(),
  /** Dialogue and viva: the lines the other person says, in order. Options belong to a turn by `group`. */
  turns: z.array(z.object({ id: z.string(), line: z.string(), lineZh: z.string().optional() })).optional(),
  /** Dialogue: the starting distress, 0 calm … 10 about to walk out. */
  startMood: z.number().optional(),
  /** Shown at the top of the panel: the wound, the X-ray you were handed. */
  img: z.string().optional(),
  findings: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        detail: z.string().optional(),
        xPct: z.number(),
        yPct: z.number(),
        marksChecklistIds: z.array(z.string()).optional(),
        ...performFields,
      }),
    )
    .optional(),
  regions: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        xPct: z.number(),
        yPct: z.number(),
        wPct: z.number(),
        hPct: z.number(),
        finding: z.string(),
        marksChecklistIds: z.array(z.string()).optional(),
        ...performFields,
      }),
    )
    .optional(),
})

const vitalNums = {
  hr: z.number().optional(),
  sbp: z.number().optional(),
  dbp: z.number().optional(),
  spo2: z.number().optional(),
  rr: z.number().optional(),
  temp: z.number().optional(),
  etco2: z.number().optional(),
  gcs: z.number().optional(),
  glucose: z.number().optional(),
}

/**
 * The patient's physiology. Numbers start at the baseline and drift per minute until a `stop` scene flag
 * appears; each effect applies from the moment its scene flag is set.
 */
export const vitalsSchema = z.object({
  hr: z.number(),
  sbp: z.number(),
  dbp: z.number(),
  spo2: z.number(),
  rr: z.number(),
  temp: z.number().optional(),
  etco2: z.number().optional(),
  gcs: z.number().optional(),
  glucose: z.number().optional(),
  /** An ECG atlas id for the monitor strip: `sinus`, `af`, `vt`… */
  rhythm: z.string().optional(),
  drift: z.object(vitalNums).optional(),
  stop: z.array(z.string()).optional(),
  effects: z
    .array(
      z.object({
        scene: z.string(),
        set: z.object(vitalNums).optional(),
        /** Change applied gradually over `overS` seconds (default 30). */
        add: z.object(vitalNums).optional(),
        overS: z.number().optional(),
        rhythm: z.string().optional(),
      }),
    )
    .optional(),
})
export type Vitals = z.infer<typeof vitalsSchema>

export const packSchema = z.object({
  packId: z.string(),
  title: z.string(),
  placeholder: z.boolean().optional(),
  meta: z.object({
    timeLimitSec: z.number().int().positive().optional(),
    readTimeSec: z.number().int().nonnegative().optional(),
    stationType: z.enum(['resus', 'exam', 'history', 'skills', 'teaching', 'comms', 'psych']),
    gym: z.string().optional(),
    stem: z.string(),
    guidelineNotes: z.string().optional(),
  }),
  room: z.object({
    template: z.enum(['resus-bay', 'cubicle', 'skills-bench', 'teaching-room']).optional(),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    tileSize: z.number().int().positive(),
    playerStart: tile,
    props: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        x: z.number().int(),
        y: z.number().int(),
        w: z.number().int().positive().optional(),
        h: z.number().int().positive().optional(),
        label: z.string().optional(),
        readout: z
          .object({
            idle: z.string(),
            when: z.array(z.object({ scene: z.string(), text: z.string() })).optional(),
          })
          .optional(),
      }),
    ),
    interactables: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        x: z.number().int(),
        y: z.number().int(),
        w: z.number().int().positive().optional(),
        h: z.number().int().positive().optional(),
        label: z.string(),
        sourceFor: z.array(z.string()).optional(),
      }),
    ),
  }),
  cast: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      displayName: z.string(),
      spawn: tile,
      pixelKey: z.string().optional(),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      icon: z.string().optional(),
    }),
  ),
  marks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    }),
  ),
  actions: z.array(actionSchema),
  goldPath: z.array(z.string()),
  /** Phases of the perfect script; practice mode shows the current one as the objective. */
  phases: z.array(z.object({ title: z.string(), goal: z.string(), steps: z.array(z.string()) })).optional(),
  sequenceRules: z.array(
    z.object({
      id: z.string(),
      earlierAny: z.array(z.string()),
      laterAny: z.array(z.string()),
      require: z.enum(['all-earlier-before-any-later', 'a-before-b']),
      okNote: z.string(),
      failNote: z.string(),
    }),
  ),
  vitals: vitalsSchema.optional(),
  badge: z.object({
    id: z.string(),
    name: z.string(),
    emoji: z.string().optional(),
    flavor: z.string(),
  }),
})

export type Pack = z.infer<typeof packSchema>
export type Action = Pack['actions'][number]
export type ActionOption = NonNullable<Action['options']>[number]
export type SequenceRule = Pack['sequenceRules'][number]
export type Mark = Pack['marks'][number]

export type Dir = 'n' | 'e' | 's' | 'w'
export type Tile = { x: number; y: number }
export type Pos = Tile & { facing: Dir }

export type LogEntry = { actionId: string; atMs: number; markIds: string[] }

/** A mistake recorded during a hands-on procedure, shown on the debrief. */
export type Fault = { actionId: string; text: string; critical?: boolean }

export type Session = {
  saveVersion: number
  packId: string
  startedAt: number
  entered: boolean
  secondsLeft: number
  position: Pos
  inventory: string[]
  earnedMarks: string[]
  spent: Record<string, string[]>
  log: LogEntry[]
  ended: null | 'complete'
  scene: string[]
  /** Fixes the randomised case (which leg is out, tissue depth…) for this run. */
  seed: number
  faults: Fault[]
  /** Seconds into the station when each scene flag was first set; drives the vitals. */
  sceneAt?: Record<string, number>
}

export const SOLID_KINDS = new Set([
  'wall',
  'bed',
  'trolley',
  'monitor',
  'shelf',
  'chair',
  'couch',
  'desk',
  'door',
  'phone',
  'table',
  'chart',
  'whiteboard',
])

export function timeLimitOf(pack: Pack) {
  return pack.meta.timeLimitSec ?? 420
}

/** Last matching scene flag wins, so a later manikin state can replace an earlier one. */
export function readoutText(
  readout: { idle: string; when?: { scene: string; text: string }[] } | undefined,
  scene: string[],
) {
  if (!readout) return null
  let text = readout.idle
  for (const row of readout.when ?? []) {
    if (scene.includes(row.scene)) text = row.text
  }
  return text
}
