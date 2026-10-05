import { SAY_IDS, TOOLS } from './catalog'
import { GROUPS, SITES, expand } from './sites'

/**
 * The 3D examination, as rules. Pure: the bench turns taps and drags into `ExamEvent`s; each exam item's `do` line
 * says which events perform it.
 *
 * A `do` line:
 * - `tool target` — use a tool on a site (or a group: `abdomen`; or a site on either side: `hand`). `say` takes an
 *   instruction id instead; `move` a joint movement (`knee-R:flex`, or `knee-R` for any of its movements).
 * - `a,b` — either target. `a+b` — each of them, in any order.
 * - `@cond,cond` — only counts if, at that moment, the patient is so: a posture (`supine`, `sitting`, `standing`,
 *   `walking`, `roll-R`…), a state (`untouched`: nobody has laid a hand on them yet; `gloved`), or a joint angle in
 *   degrees (`knee-R=20..30`).
 * - `x > y` — in that order. `x & y` — both, in any order. `x | y` — either way does it.
 */

export type ExamState = {
  posture: string
  /** Joint angles in degrees: `knee-R`, `hipflex-R`, `hiprot-R`, `shoulderabd-R`, `shoulderflex-R`, `shoulderrot-R`, `elbow-R`. */
  joints: Record<string, number>
  flags: string[]
}

export type ExamEvent = { tool: string; site?: string; say?: string; move?: string; state: ExamState }

export type Act = { tool: string; targets: string[]; conds: string[] }
/** Alternatives, each a set of parts done in any order, each part a sequence of acts. */
export type Plan = Act[][][]
/** For each alternative and part, how many of its acts are done. */
export type Progress = number[][]

function parseAct(text: string): Act[] {
  const [main, condText] = text.trim().split(/\s+@/)
  const [tool, targetText = ''] = main.trim().split(/\s+/, 2)
  const conds = condText ? condText.split(',').map((c) => c.trim()).filter(Boolean) : []
  // `a+b+c`: each of them — one part per target.
  if (targetText.includes('+')) return targetText.split('+').map((t) => ({ tool, targets: [t], conds }))
  return [{ tool, targets: targetText ? targetText.split(',') : [], conds }]
}

export function parseDo(line: string): Plan {
  return line.split(' | ').map((alt) =>
    alt.split(' & ').flatMap((part) => {
      const steps = part.split(' > ')
      // A single act with `+` targets becomes several independent parts.
      if (steps.length === 1) return parseAct(steps[0]).map((act) => [act])
      return [steps.flatMap((s) => parseAct(s))]
    }),
  )
}

export function freshProgress(plan: Plan): Progress {
  return plan.map((alt) => alt.map(() => 0))
}

/** Is the patient so, right now? */
export function holds(cond: string, state: ExamState): boolean {
  const range = cond.match(/^([\w-]+)=(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/)
  if (range) {
    const v = state.joints[range[1]] ?? 0
    return v >= Number(range[2]) && v <= Number(range[3])
  }
  if (cond === state.posture) return true
  return state.flags.includes(cond)
}

/** Pressing firmly is feeling too; the rest must be the very tool. */
function toolFits(want: string, used: string) {
  return want === used || (want === 'feel' && used === 'press')
}

export function matches(act: Act, ev: ExamEvent): boolean {
  if (!toolFits(act.tool, ev.tool)) return false
  if (!act.conds.every((c) => holds(c, ev.state))) return false
  if (act.targets.length === 0) return true
  if (ev.tool === 'say') return !!ev.say && act.targets.includes(ev.say)
  if (ev.tool === 'move') return !!ev.move && act.targets.some((t) => ev.move === t || ev.move!.startsWith(`${t}:`))
  return !!ev.site && act.targets.some((t) => expand(t).includes(ev.site!))
}

/** Take one event: which acts it completes, and whether the item is now done. */
export function advance(plan: Plan, progress: Progress, ev: ExamEvent): { progress: Progress; moved: boolean; done: boolean } {
  let moved = false
  const next = progress.map((parts, a) =>
    parts.map((n, p) => {
      const act = plan[a][p][n]
      if (act && matches(act, ev)) {
        moved = true
        return n + 1
      }
      return n
    }),
  )
  const done = next.some((parts, a) => parts.every((n, p) => n >= plan[a][p].length))
  return { progress: next, moved, done }
}

const POSTURES = ['supine', 'sitting', 'edge', 'standing', 'walking', 'heel-toe', 'roll-R', 'roll-L', 'knees-up', 'bent', 'one-leg-R', 'one-leg-L']
const FLAGS = ['untouched', 'gloved']
const JOINT_KEYS = /^(knee|hipflex|hipabd|hiprot|shoulderflex|shoulderabd|shoulderrot|elbow|wrist|ankle)-(R|L)$|^(neckyaw|neckpitch|trunk)$/
const MOVES = /^((knee|hip|shoulder|elbow)-(R|L))(:(flex|ext|rot|abd))?$|^neck(:yaw)?$/

/** What is wrong with a `do` line: tools, sites, instructions, movements or conditions that do not exist. */
export function checkDo(line: string): string[] {
  const problems: string[] = []
  const tools = new Set(TOOLS.map((t) => t.id))
  for (const act of parseDo(line).flat(2)) {
    if (!tools.has(act.tool)) problems.push(`no tool "${act.tool}"`)
    for (const target of act.targets) {
      if (act.tool === 'say') {
        if (!SAY_IDS.includes(target)) problems.push(`no instruction "${target}"`)
      } else if (act.tool === 'move') {
        if (!MOVES.test(target)) problems.push(`no movement "${target}"`)
      } else if (!GROUPS[target] && !SITES[target] && !SITES[target.replace(/-(R|L)$/, '')]?.sided) problems.push(`no site "${target}"`)
    }
    for (const cond of act.conds) {
      const range = cond.match(/^([\w-]+)=-?\d+(\.\d+)?\.\.-?\d+(\.\d+)?$/)
      if (range ? !JOINT_KEYS.test(range[1]) : !POSTURES.includes(cond) && !FLAGS.includes(cond)) problems.push(`no condition "${cond}"`)
    }
  }
  return problems
}

/** An examination written for the 3D patient: every item says what you do. */
export function examIn3d(action: { kind: string; options?: { do?: string }[] } | undefined): boolean {
  return action?.kind === 'exam' && (action.options ?? []).length > 0 && (action.options ?? []).every((o) => o.do)
}

/** Every tool a station's exam needs. */
export function toolsOf(plans: Plan[]): string[] {
  return [...new Set(plans.flatMap((p) => p.flat(2).map((a) => a.tool)))]
}

/** Every instruction a station's exam uses. */
export function saysOf(plans: Plan[]): string[] {
  return [...new Set(plans.flatMap((p) => p.flat(2).filter((a) => a.tool === 'say').flatMap((a) => a.targets)))]
}
