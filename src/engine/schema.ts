import { z } from 'zod'

export const SAVE_VERSION = 2

const tile = z.object({
  x: z.number().int(),
  y: z.number().int(),
})

export const performKinds = ['lift', 'cover', 'dress', 'listen', 'pose', 'cannula', 'look', 'release', 'io', 'cico', 'pacing', 'cord'] as const
export type PerformKind = (typeof performKinds)[number]

const performFields = {
  perform: z.enum(performKinds).optional(),
  performPose: z.string().optional(),
  performHint: z.string().optional(),
}

const optionSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().optional(),
  needed: z.boolean().optional(),
  isTrap: z.boolean().optional(),
  marksChecklistIds: z.array(z.string()).optional(),
  grantsItems: z.array(z.string()).optional(),
  requiresItems: z.array(z.string()).optional(),
  endStation: z.boolean().optional(),
  scene: z.string().optional(),
  ...performFields,
})

const actionSchema = z.object({
  id: z.string(),
  kind: z.enum(['talk', 'kit', 'menu', 'examine-face', 'examine-body', 'handover']),
  targetIds: z.array(z.string()).min(1),
  hint: z.string(),
  prompt: z.string().optional(),
  confirmLabel: z.string().optional(),
  requiresItems: z.array(z.string()).optional(),
  grantsItems: z.array(z.string()).optional(),
  marksChecklistIds: z.array(z.string()).optional(),
  endStation: z.boolean().optional(),
  options: z.array(optionSchema).optional(),
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

export const packSchema = z.object({
  packId: z.string(),
  title: z.string(),
  placeholder: z.boolean().optional(),
  meta: z.object({
    timeLimitSec: z.number().int().positive().optional(),
    readTimeSec: z.number().int().nonnegative().optional(),
    stationType: z.enum(['resus', 'exam', 'history', 'skills', 'teaching']),
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
