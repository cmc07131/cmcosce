import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getPack } from '~/engine/loadPacks'
import { readLastPackId } from '~/engine/session'
import { useButtons } from '~/game/input'
import { useSettings } from '~/game/settings'
import { sfx } from '~/game/sfx'
import { Sprite } from '~/game/Sprite'
import { NavItem, Win, useCursor } from '~/game/ui'

export const Route = createFileRoute('/')({
  component: TitlePage,
})

function TitlePage() {
  const navigate = useNavigate()
  const [lastId, setLastId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const sound = useSettings((s) => s.sound)
  const toggleSound = useSettings((s) => s.toggleSound)
  useEffect(() => setLastId(readLastPackId()), [])
  const last = lastId ? getPack(lastId) : undefined

  function start() {
    sfx.select()
    setStarted(true)
  }

  useButtons(5, !started, (btn) => {
    if (btn === 'a' || btn === 'start') start()
  })
  useCursor(menu, { priority: 10, enabled: started, onBack: () => setStarted(false) })

  return (
    <div className="page title-page" onClick={() => !started && start()}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="title-sub">HKCEM · IEEM PART 2</p>
        <h1 className="title-logo">
          OSCE
          <br />
          GYM
        </h1>
        <p className="title-sub">GOLD EDITION</p>
        <div className="title-stage">
          <Sprite role="nurse" facing="e" walk />
          <Sprite role="doctor" facing="e" walk scale={4} />
          <Sprite role="examiner" facing="w" />
        </div>
      </div>
      {!started ? (
        <p className="press-start mb-10" data-testid="enter-title">
          PRESS START
        </p>
      ) : (
        <div ref={menu} className="mb-6">
          <Win>
            {last && (
              <NavItem testId="continue" onClick={() => void navigate({ to: '/play/$packId', params: { packId: last.packId } })}>
                CONTINUE
                <span className="nav-need">{last.title}</span>
              </NavItem>
            )}
            <NavItem testId="stations" onClick={() => void navigate({ to: '/gym' })}>
              STATIONS
            </NavItem>
            <NavItem testId="title-sound" onClick={toggleSound}>
              SOUND: {sound ? 'ON' : 'OFF'}
            </NavItem>
          </Win>
        </div>
      )}
      <p className="title-foot">Fan-made revision tool · not affiliated with Nintendo, Game Freak or HKCEM</p>
    </div>
  )
}
