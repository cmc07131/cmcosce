import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { judgeSequence } from '~/engine/judge'
import { getPack } from '~/engine/loadPacks'
import { readSession } from '~/engine/session'
import type { LogEntry } from '~/engine/schema'

export const Route = createFileRoute('/debrief/$packId')({
  component: DebriefPage,
})

function DebriefPage() {
  const { packId } = Route.useParams()
  const pack = getPack(packId)
  const [checked, setChecked] = useState<string[] | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  useEffect(() => {
    const session = readSession(packId)
    setChecked(session?.earnedMarks ?? [])
    setLog(session?.log ?? [])
  }, [packId])

  if (!pack) {
    return (
      <div className="game-shell justify-center px-4">
        <p className="font-body text-[28px]">No pack named {packId}.</p>
      </div>
    )
  }
  if (!checked) {
    return (
      <div className="game-shell items-center justify-center">
        <p className="font-body text-[28px]">Opening the sheet…</p>
      </div>
    )
  }

  const verdicts = judgeSequence(pack.sequenceRules, log)
  const toggle = (id: string) =>
    setChecked((cur) => (cur?.includes(id) ? cur.filter((row) => row !== id) : [...(cur ?? []), id]))

  return (
    <div className="game-shell">
      <header className="px-3 pt-3">
        <p className="font-pixel text-[8px] text-[#ffb020]">DEBRIEF</p>
        <h1 className="font-body text-[34px] leading-none">{pack.title}</h1>
        <p className="font-body text-[20px] text-[#3a3428]">
          {checked.length}/{pack.marks.length} ticked · order never blocks the badge
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-3 pt-3 pb-4">
        <h2 className="font-body text-[26px]">Mark scheme</h2>
        <div className="mt-2 flex flex-col gap-2">
          {pack.marks.map((mark) => {
            const on = checked.includes(mark.id)
            return (
              <button
                key={mark.id}
                type="button"
                className="tap"
                data-testid={`mark-${mark.id}`}
                onClick={() => toggle(mark.id)}
              >
                {on ? '■' : '□'} {mark.id} {mark.label}
              </button>
            )
          })}
        </div>
        <h2 className="mt-5 font-body text-[26px]">Sequence</h2>
        <div className="mt-2 flex flex-col gap-2">
          {verdicts.length === 0 && <p className="font-body text-[20px]">No sequence rules in this pack.</p>}
          {verdicts.map((verdict) => (
            <div key={verdict.id} className="border-2 border-[#303848] bg-[#fffbec] p-2" data-testid={`seq-${verdict.id}`}>
              <p className="font-pixel text-[8px]" style={{ color: verdict.status === 'pass' ? '#1d6b32' : '#a86a08' }}>
                {verdict.status === 'pass' ? 'Pass' : 'Caution'}
              </p>
              <p className="font-body text-[20px] leading-snug">{verdict.note}</p>
            </div>
          ))}
        </div>
        {pack.meta.guidelineNotes && (
          <div className="mt-5 border-2 border-[#ffb020] p-2">
            <p className="font-pixel text-[8px] text-[#ffb020]">GUIDELINE NOTES</p>
            <p className="mt-1 font-body text-[20px] leading-snug whitespace-pre-wrap">{pack.meta.guidelineNotes}</p>
          </div>
        )}
        <Link to="/badge/$packId" params={{ packId }} className="tap mt-5 block bg-[#315c3d] text-center" data-testid="claim-badge">
          Claim badge
        </Link>
      </div>
    </div>
  )
}
