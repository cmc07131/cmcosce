import { useRef, useState, type ReactNode } from 'react'
import { sfx } from '../sfx'

/**
 * Shared shell for hands-on benches: a run record the scorer reads at the end,
 * three kinds of feedback, a step strip, and a Next button that never blocks.
 */

export type Note = { text: string; tone: 'feel' | 'coach' | 'bad' } | null

export type BenchApi<R> = {
  run: R
  runRef: React.MutableRefObject<R>
  upd: (patch: Partial<R> | ((r: R) => Partial<R>)) => R
  /** What your hands and eyes tell you. Always shown. */
  feel: (text: string) => void
  /** Why that was wrong. Practice mode only, and only after the mistake. */
  why: (text: string) => void
  /** The world pushing back: it did not fit, it hurt. Always shown. */
  physical: (text: string) => void
  coach: boolean
  note: Note
}

export function useBench<R>(fresh: () => R, coach: boolean): BenchApi<R> {
  const [run, setRun] = useState<R>(fresh)
  const runRef = useRef(run)
  const [note, setNote] = useState<Note>(null)
  return {
    run,
    runRef,
    coach,
    note,
    upd: (patch) => {
      const cur = runRef.current
      const next = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }
      runRef.current = next
      setRun(next)
      return next
    },
    feel: (text) => setNote({ text, tone: 'feel' }),
    why: (text) => {
      if (coach) setNote({ text, tone: 'coach' })
    },
    physical: (text) => {
      setNote({ text, tone: 'bad' })
      sfx.bump()
    },
  }
}

export function StepStrip({ titles, index }: { titles: string[]; index: number }) {
  return (
    <div className="io-steps" aria-label={`Step ${index + 1} of ${titles.length}`}>
      {titles.map((t, i) => (
        <span key={t} data-on={i === index || undefined} data-done={i < index || undefined} />
      ))}
      <b>
        {index + 1}/{titles.length} {titles[index]?.toUpperCase()}
      </b>
    </div>
  )
}

export function NoteLine({ note }: { note: Note }) {
  if (!note) return null
  return (
    <p className="io-note" data-tone={note.tone} data-testid="io-note">
      {note.tone === 'coach' ? 'WHY · ' : note.tone === 'bad' ? '! ' : ''}
      {note.text}
    </p>
  )
}

export function NextButton({ children, onClick, testId = 'io-next' }: { children: ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className="tap io-next mt-3" data-testid={testId} onClick={onClick}>
      {children} ▶
    </button>
  )
}

/** A pair of plain choice buttons laid out side by side. */
export function Choices({ options }: { options: { label: string; onClick: () => void; testId?: string; on?: boolean }[] }) {
  return (
    <div className="io-choices mt-2">
      {options.map((o) => (
        <button key={o.label} type="button" className="tap io-mini" data-on={o.on || undefined} data-testid={o.testId} onClick={o.onClick}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
