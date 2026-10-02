import type { ComponentType } from 'react'
import type { PerformKind } from '~/engine/schema'
import type { BenchResult, PerformJob } from './store'
import { CollesProcedure } from './colles/CollesProcedure'
import { DigitalProcedure } from './digital/DigitalProcedure'
import { SutureProcedure } from './suture/SutureProcedure'
import { NoseProcedure } from './nose/NoseProcedure'
import { CutdownProcedure } from './cutdown/CutdownProcedure'
import { HookProcedure } from './hook/HookProcedure'
import { ChestProcedure } from './chest/ChestProcedure'
import { BinderProcedure } from './binder/BinderProcedure'
import { EscharProcedure } from './eschar/EscharProcedure'
import { ClamshellProcedure } from './clamshell/ClamshellProcedure'
import { TrachProcedure } from './trach/TrachProcedure'
import { DystociaProcedure } from './dystocia/DystociaProcedure'
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
  suture: SutureProcedure,
  nose: NoseProcedure,
  cutdown: CutdownProcedure,
  hook: HookProcedure,
  chest: ChestProcedure,
  binder: BinderProcedure,
  eschar: EscharProcedure,
  clamshell: ClamshellProcedure,
  trach: TrachProcedure,
  dystocia: DystociaProcedure,
}
