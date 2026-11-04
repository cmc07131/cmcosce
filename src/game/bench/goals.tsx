import { useRef, useState, type RefObject } from 'react'
import { sfx } from '../sfx'
import type { BenchApi } from './core'

/**
 * What a step must achieve, checked as you go and again at Next, and the way back when it was not: every bench with
 * steps shares this (the central line, the delivery).
 *
 * Every goal is `done`, `todo` (not done yet) or `fail` (something already went wrong that redoing the step fixes).
 * `how` is the guidance shown when it is not done: what to do, in the order you would do it.
 */
export type GoalState = 'done' | 'todo' | 'fail'
export type Goal = { label: string; state: GoalState; how: string; now?: string }

export const goal = (label: string, ok: boolean, how: string, failed = false, now?: string): Goal => ({ label, state: ok ? 'done' : failed ? 'fail' : 'todo', how, now })
export const goalsMet = (goals: Goal[]) => goals.every((x) => x.state === 'done')

/**
 * The step's goals, ticked as you go: a wrong move shows at once with how to put it right. After a Next that found
 * something missing, every open goal shows its guidance, and you choose: redo the step, fix it here, or carry on
 * anyway. Test ids are `<prefix>-goals`, `<prefix>-review-redo|fix|anyway`.
 */
export function StepGoals({ goals, review, onRedo, onFix, onAnyway, next, prefix }: { goals: Goal[]; review: boolean; onRedo: () => void; onFix: () => void; onAnyway: () => void; next: string; prefix: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const left = goals.filter((x) => x.state !== 'done')
  const failed = goals.some((x) => x.state === 'fail')
  return (
    <div className="cvc-goals mt-3" data-review={(review && left.length > 0) || undefined} data-testid={`${prefix}-goals`}>
      <p className="cvc-goals-head">{review && left.length > 0 ? `NOT YET · ${left.length} TO PUT RIGHT` : `THIS STEP · ${goals.length - left.length}/${goals.length}`}</p>
      <ul className="hare-rows">
        {goals.map((x, i) => {
          const show = x.state === 'fail' || (x.state === 'todo' && (review || open === i))
          return (
            <li key={x.label} data-ok={x.state === 'done' || undefined} data-todo={x.state === 'todo' || undefined} onClick={() => setOpen(open === i ? null : i)}>
              <b>
                {x.state === 'done' ? '✓' : x.state === 'fail' ? '✗' : '○'} {x.label}
              </b>
              {show && x.now && <span>You: {x.now}</span>}
              {show && <small>{x.how}</small>}
            </li>
          )
        })}
      </ul>
      {review && left.length > 0 && (
        <div className="io-choices mt-2">
          <button type="button" className="tap io-mini" data-testid={`${prefix}-review-redo`} onClick={onRedo}>
            ↺ REDO THIS STEP
          </button>
          <button type="button" className="tap io-mini" data-testid={`${prefix}-review-fix`} onClick={onFix}>
            {failed ? 'TRY TO FIX IT HERE' : 'FIX IT HERE'}
          </button>
          <button type="button" className="tap io-mini" data-testid={`${prefix}-review-anyway`} onClick={onAnyway}>
            CARRY ON TO {next.toUpperCase()} ▶
          </button>
        </div>
      )}
      {!review && left.length > 0 && <p className="io-small">Tap a goal to see how.</p>}
    </div>
  )
}

/**
 * Steps with a snapshot of the run as each began: Next checks the step's goals and opens the review if any is
 * open; Back returns to the previous step as you left it; Redo starts this step again from how it began. `epoch`
 * changes on every restore, so key the step's component on it to reset its local state.
 */
export function useStepper<R>(api: BenchApi<R>, titles: string[], goalsFor: (step: number, r: R) => Goal[], scroll?: RefObject<HTMLElement | null>) {
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [review, setReview] = useState(false)
  const snaps = useRef<R[]>([api.runRef.current])
  const goalsRef = useRef<HTMLDivElement>(null)
  const top = () => scroll?.current?.scrollTo({ top: 0 })
  const restore = (i: number) => {
    const snap = snaps.current[i]
    if (!snap) return
    api.upd({ ...snap })
    setEpoch((e) => e + 1)
  }
  const next = (anyway = false) => {
    if (!anyway && !goalsMet(goalsFor(index, api.runRef.current))) {
      sfx.bump()
      setReview(true)
      window.setTimeout(() => goalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
      return
    }
    setReview(false)
    if (!anyway) api.feel(`✓ ${titles[index]}: done right.`)
    sfx.select()
    snaps.current[index + 1] = api.runRef.current
    if (index < titles.length - 1) setIndex(index + 1)
    else setChecked(true)
    top()
  }
  const back = () => {
    setReview(false)
    sfx.back()
    if (checked) {
      setChecked(false)
      setEpoch((e) => e + 1)
      api.feel(`Back to the ${titles[titles.length - 1].toLowerCase()}, as you left it.`)
    } else if (index > 0) {
      restore(index)
      setIndex(index - 1)
      api.feel(`Back to the ${titles[index - 1].toLowerCase()}, as you left it. REDO THIS STEP starts it again.`)
    }
    top()
  }
  const redo = () => {
    setReview(false)
    sfx.back()
    restore(index)
    api.feel(`${titles[index]}: from the start of this step again.`)
    top()
  }
  return { index, checked, epoch, review, setReview, next, back, redo, goalsRef }
}
