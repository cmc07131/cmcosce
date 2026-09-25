import { useRef, useState } from 'react'
import { examinerClause, itemLabel } from '~/engine/judge'
import type { Pack } from '~/engine/schema'
import { useSettings } from './settings'
import { NavItem, Win, useCursor } from './ui'

type Page = 'root' | 'bag' | 'marks' | 'leave'

/** Gold START menu: bag, notes, hint, marks, options, leave. */
export function StartMenu({
  pack,
  inventory,
  earnedMarks,
  onClose,
  onNotes,
  onHint,
  onLeave,
}: {
  pack: Pack
  inventory: string[]
  earnedMarks: string[]
  onClose: () => void
  onNotes: () => void
  onHint: () => void
  onLeave: () => void
}) {
  const [page, setPage] = useState<Page>('root')
  const root = useRef<HTMLDivElement>(null)
  const sound = useSettings((s) => s.sound)
  const labels = useSettings((s) => s.labels)
  const toggleSound = useSettings((s) => s.toggleSound)
  const toggleLabels = useSettings((s) => s.toggleLabels)
  const cursor = useCursor(root, {
    priority: 20,
    onBack: () => {
      if (page === 'root') onClose()
      else go('root')
    },
  })

  function go(next: Page) {
    setPage(next)
    window.requestAnimationFrame(() => cursor.reset())
  }

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/20 p-2" data-testid="start-menu" onClick={onClose}>
      <div ref={root} className="flex max-h-full min-w-0 flex-col" onClick={(event) => event.stopPropagation()}>
        {page === 'root' && (
          <Win className="menu-col w-[172px]">
            <NavItem testId="menu-bag" onClick={() => go('bag')}>BAG</NavItem>
            <NavItem testId="hud-stem" onClick={onNotes}>NOTES</NavItem>
            <NavItem testId="hud-hint" onClick={onHint}>HINT</NavItem>
            <NavItem testId="menu-marks" onClick={() => go('marks')}>MARKS</NavItem>
            <NavItem testId="menu-sound" onClick={toggleSound}>SOUND {sound ? 'ON' : 'OFF'}</NavItem>
            <NavItem testId="menu-names" onClick={toggleLabels}>NAMES {labels ? 'ON' : 'OFF'}</NavItem>
            <NavItem testId="hud-leave" onClick={() => go('leave')}>LEAVE</NavItem>
            <NavItem testId="menu-exit" onClick={onClose}>EXIT</NavItem>
          </Win>
        )}
        {page === 'bag' && (
          <Win title="BAG" className="menu-col w-[260px] max-w-full overflow-auto">
            {inventory.length === 0 && <p className="menu-note">Empty hands. Pick kit up from a trolley or shelf.</p>}
            {inventory.map((id) => (
              <p key={id} className="menu-note">• {itemLabel(pack, id)}</p>
            ))}
            <NavItem onClick={() => go('root')}>BACK</NavItem>
          </Win>
        )}
        {page === 'marks' && (
          <Win title={`MARKS ${earnedMarks.length}/${pack.marks.length}`} className="menu-col w-[300px] max-w-full overflow-auto">
            {earnedMarks.length === 0 && <p className="menu-note">No marks yet.</p>}
            {pack.marks
              .filter((mark) => earnedMarks.includes(mark.id))
              .map((mark) => (
                <p key={mark.id} className="menu-note">
                  <b>{mark.id}</b> {examinerClause(mark.label)}
                </p>
              ))}
            <NavItem onClick={() => go('root')}>BACK</NavItem>
          </Win>
        )}
        {page === 'leave' && (
          <Win title="Hand over and end the station?" className="menu-col w-[240px]">
            <NavItem testId="leave-yes" onClick={onLeave}>YES</NavItem>
            <NavItem testId="leave-no" onClick={() => go('root')}>NO</NavItem>
          </Win>
        )}
      </div>
    </div>
  )
}
