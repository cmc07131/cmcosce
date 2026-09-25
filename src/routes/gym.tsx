import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef } from 'react'
import { loadPacks } from '~/engine/loadPacks'
import { timeLimitOf } from '~/engine/schema'
import { NavItem, Win, useCursor } from '~/game/ui'

export const Route = createFileRoute('/gym')({
  component: GymPage,
})

const TYPE: Record<string, { label: string; icon: string }> = {
  resus: { label: 'RESUS', icon: '♥' },
  exam: { label: 'EXAM', icon: '✚' },
  history: { label: 'HISTORY', icon: '?' },
  skills: { label: 'SKILLS', icon: '✂' },
  teaching: { label: 'TEACHING', icon: '★' },
}

function GymPage() {
  const navigate = useNavigate()
  const hits = loadPacks()
  const root = useRef<HTMLDivElement>(null)
  useCursor(root, { priority: 10, onBack: () => void navigate({ to: '/' }) })

  return (
    <div className="page" ref={root}>
      <Win title="STATIONS" className="station-head">
        <p className="menu-note">Pick a station. A to enter, B to go back.</p>
      </Win>
      <Win className="min-h-0 overflow-auto">
        {hits.map((hit) => {
          if (!hit.ok) {
            return (
              <p key={hit.packId} className="menu-note text-[var(--color-rose)]">
                {hit.packId} failed to load. {hit.error}
              </p>
            )
          }
          const pack = hit.pack
          const type = TYPE[pack.meta.stationType] ?? { label: pack.meta.stationType.toUpperCase(), icon: '•' }
          return (
            <NavItem
              key={pack.packId}
              testId={`gym-${pack.packId}`}
              onClick={() => void navigate({ to: '/play/$packId', params: { packId: pack.packId } })}
            >
              <span className="station-icon" data-type={pack.meta.stationType}>
                {type.icon}
              </span>
              {pack.title}
              <span className="nav-need">
                {type.label} · {Math.round(timeLimitOf(pack) / 60)} MIN{pack.placeholder ? ' · PLACEHOLDER' : ''}
              </span>
            </NavItem>
          )
        })}
        <NavItem onClick={() => void navigate({ to: '/' })}>BACK</NavItem>
      </Win>
    </div>
  )
}
