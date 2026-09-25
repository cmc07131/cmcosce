import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { judgeSequence } from '~/engine/judge'
import { getPack } from '~/engine/loadPacks'
import { readSession } from '~/engine/session'
import type { Fault, LogEntry } from '~/engine/schema'
import { NavItem, Win, useCursor } from '~/game/ui'

export const Route = createFileRoute('/debrief/$packId')({
  component: DebriefPage,
})

function DebriefPage() {
  const { packId } = Route.useParams()
  const navigate = useNavigate()
  const pack = getPack(packId)
  const root = useRef<HTMLDivElement>(null)
  const [checked, setChecked] = useState<string[] | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [faults, setFaults] = useState<Fault[]>([])
  useCursor(root, { priority: 10, onBack: () => void navigate({ to: '/gym' }) })

  useEffect(() => {
    const session = readSession(packId)
    setChecked(session?.earnedMarks ?? [])
    setLog(session?.log ?? [])
    setFaults(session?.faults ?? [])
  }, [packId])

  if (!pack) {
    return (
      <div className="page justify-center">
        <Win>No pack named {packId}.</Win>
      </div>
    )
  }
  if (!checked) {
    return (
      <div className="page justify-center">
        <Win>Opening the sheet…</Win>
      </div>
    )
  }

  const verdicts = judgeSequence(pack.sequenceRules, log)
  const toggle = (id: string) => setChecked((cur) => (cur?.includes(id) ? cur.filter((row) => row !== id) : [...(cur ?? []), id]))
  const pct = pack.marks.length ? Math.round((checked.length / pack.marks.length) * 100) : 0

  return (
    <div className="page" ref={root}>
      <Win title="DEBRIEF">
        <p className="sheet-text">{pack.title}</p>
        <div className="score-bar" aria-label={`${pct}%`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="sheet-meta">
          ★ {checked.length}/{pack.marks.length} ticked ({pct}%) · order never blocks the badge
        </p>
      </Win>
      <Win className="min-h-0 flex-1 overflow-auto">
        <h2 className="win-title">MARK SCHEME</h2>
        <p className="menu-note">Tap a line to tick or untick it yourself.</p>
        {pack.marks.map((mark) => {
          const on = checked.includes(mark.id)
          return (
            <NavItem key={mark.id} testId={`mark-${mark.id}`} tone={on ? 'done' : undefined} onClick={() => toggle(mark.id)}>
              <span className="check">{on ? '■' : '□'}</span>
              <b className="font-normal text-[var(--color-amber)]">{mark.id}</b> {mark.label}
            </NavItem>
          )
        })}
        {faults.length > 0 && (
          <>
            <h2 className="win-title mt-4">PROCEDURE NOTES</h2>
            {[...faults]
              .sort((a, b) => Number(Boolean(b.critical)) - Number(Boolean(a.critical)))
              .map((row, i) => (
                <div key={i} className="verdict" data-status={row.critical ? 'critical' : 'caution'} data-testid="fault">
                  <span className="verdict-tag">{row.critical ? 'CRITICAL' : 'FIX'}</span>
                  <p className="menu-note">{row.text}</p>
                </div>
              ))}
          </>
        )}
        <h2 className="win-title mt-4">SEQUENCE</h2>
        {verdicts.length === 0 && <p className="menu-note">No sequence rules in this pack.</p>}
        {verdicts.map((verdict) => (
          <div key={verdict.id} className="verdict" data-status={verdict.status} data-testid={`seq-${verdict.id}`}>
            <span className="verdict-tag">{verdict.status === 'pass' ? 'PASS' : 'CAUTION'}</span>
            <p className="menu-note">{verdict.note}</p>
          </div>
        ))}
        {pack.meta.guidelineNotes && (
          <>
            <h2 className="win-title mt-4">GUIDELINE NOTES</h2>
            <p className="menu-note whitespace-pre-wrap">{pack.meta.guidelineNotes}</p>
          </>
        )}
      </Win>
      <Win>
        <NavItem testId="claim-badge" onClick={() => void navigate({ to: '/badge/$packId', params: { packId } })}>
          CLAIM BADGE
        </NavItem>
        <NavItem onClick={() => void navigate({ to: '/gym' })}>STATIONS</NavItem>
      </Win>
    </div>
  )
}
