import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { packCatalog, packInfo } from '~/engine/loadPacks'
import { WORLD } from '~/world/data'
import { useProgress } from '~/world/progress'
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
  comms: { label: 'COMMS', icon: '♪' },
  psych: { label: 'PSYCH', icon: '☁' },
}

function GymPage() {
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  useCursor(root, { priority: 10, onBack: () => void navigate({ to: '/' }) })
  const cleared = useProgress((s) => s.cleared)
  const load = useProgress((s) => s.load)
  useEffect(() => load(), [load])

  return (
    <div className="page" ref={root}>
      <Win title="STATIONS" className="station-head">
        <p className="menu-note">
          {cleared.length}/{packCatalog().length} cleared. A to enter, B to go back.
        </p>
      </Win>
      <Win className="min-h-0 overflow-auto">
        {GROUPS.map(({ name, packs }) => (
          <div key={name}>
            <p className="sheet-meta station-group">
              {name} · {packs.filter((p) => cleared.includes(p.packId)).length}/{packs.length}
            </p>
            {packs.map((pack) => {
              const type = TYPE[pack.stationType] ?? { label: pack.stationType.toUpperCase(), icon: '•' }
              const done = cleared.includes(pack.packId)
              return (
                <NavItem
                  key={pack.packId}
                  testId={`gym-${pack.packId}`}
                  tone={done ? 'done' : undefined}
                  onClick={() => void navigate({ to: '/play/$packId', params: { packId: pack.packId } })}
                >
                  <span className="station-icon" data-type={pack.stationType}>
                    {type.icon}
                  </span>
                  {done ? '✓ ' : ''}
                  {pack.title}
                  <span className="nav-need">
                    {type.label} · {Math.round(pack.timeLimitSec / 60)} MIN
                  </span>
                </NavItem>
              )
            })}
          </div>
        ))}
        <NavItem onClick={() => void navigate({ to: '/' })}>BACK</NavItem>
      </Win>
    </div>
  )
}

/** Stations grouped by gym in map order; anything no gym lists goes last. */
const GROUPS = (() => {
  const seen = new Set<string>()
  const groups = WORLD.gyms.map((g) => ({
    name: g.name.replace(/ GYM$/, ''),
    packs: g.packs.flatMap((id) => {
      const info = packInfo(id)
      if (!info || seen.has(id)) return []
      seen.add(id)
      return [info]
    }),
  }))
  const rest = packCatalog().filter((p) => !seen.has(p.packId))
  return [...groups, ...(rest.length ? [{ name: 'OTHER', packs: rest }] : [])].filter((g) => g.packs.length)
})()
