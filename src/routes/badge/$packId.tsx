import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { getPack } from '~/engine/loadPacks'
import { sfx } from '~/game/sfx'
import { NavItem, Win, useCursor } from '~/game/ui'

export const Route = createFileRoute('/badge/$packId')({
  component: BadgePage,
})

function BadgePage() {
  const { packId } = Route.useParams()
  const navigate = useNavigate()
  const pack = getPack(packId)
  const root = useRef<HTMLDivElement>(null)
  useCursor(root, { priority: 10, onBack: () => void navigate({ to: '/gym' }) })
  useEffect(() => {
    if (pack) sfx.fanfare()
  }, [pack])

  if (!pack) {
    return (
      <div className="page justify-center">
        <Win>No pack named {packId}.</Win>
      </div>
    )
  }
  return (
    <div className="page justify-center" ref={root}>
      <Win className="text-center">
        <p className="sheet-meta">YOU EARNED A BADGE!</p>
        <div className="badge-medal">{pack.badge.emoji ?? '★'}</div>
        <h1 className="win-title mt-3">{pack.badge.name}</h1>
        <p className="menu-note">{pack.badge.flavor}</p>
      </Win>
      <Win>
        <NavItem testId="back-gyms" onClick={() => void navigate({ to: '/gym' })}>
          BACK TO STATIONS
        </NavItem>
      </Win>
    </div>
  )
}
