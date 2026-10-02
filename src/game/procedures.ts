import type { ComponentType } from 'react'
import type { PerformKind } from '~/engine/schema'
import type { BenchResult, PerformJob } from './store'
import { CollesProcedure } from './colles/CollesProcedure'
import { DigitalProcedure } from './digital/DigitalProcedure'
import { HareProcedure } from './hare/HareProcedure'
import { KneeProcedure } from './knee/KneeProcedure'
import { ShoulderProcedure } from './shoulder/ShoulderProcedure'
import { UsBlockProcedure } from './usblock/UsBlockProcedure'

export type ProcedureProps = { job: PerformJob; coach: boolean; onDone: (r: BenchResult) => void }

/** Hands-on procedure benches, by perform kind. Each scores itself and returns a BenchResult. */
export const PROCEDURES: Partial<Record<PerformKind, ComponentType<ProcedureProps>>> = {
  hare: HareProcedure,
  colles: CollesProcedure,
  usblock: UsBlockProcedure,
  knee: KneeProcedure,
  shoulder: ShoulderProcedure,
  digital: DigitalProcedure,
}
