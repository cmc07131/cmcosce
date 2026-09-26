import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getPack } from '~/engine/loadPacks'
import type { Pos } from '~/engine/schema'
import { Controller } from '~/game/Controller'
import { press, useButtons } from '~/game/input'
import { useSettings } from '~/game/settings'
import { sfx } from '~/game/sfx'
import { TextBox, type TextBoxHandle } from '~/game/TextBox'
import { NavItem, Win, useCursor } from '~/game/ui'
import type { Msg } from '~/game/store'
import { Battle } from './Battle'
import { DECKS, WORLD, deckFor } from './data'
import { ENCOUNTER_RATE, GRACE_STEPS } from './encounter'
import { GRASS_DECK, charAt, doorAt, outsideDoor, type Deck, type Gym } from './model'
import { useProgress } from './progress'
import { WorldScreen } from './WorldScreen'

type Overlay =
  | { kind: 'gym'; gym: Gym }
  | { kind: 'board' }
  | { kind: 'shop' }
  | { kind: 'battle'; deck: Deck }
  | { kind: 'menu' }
  | { kind: 'cardex' }
  | null

const CLOSED = new Set(WORLD.gyms.filter((g) => g.packs.length === 0).map((g) => g.id))
const CMC = { x0: 16, y0: 12, x1: 31, y1: 24 }

let msgToken = 1
const say = (text: string): Msg => ({ text, speakerId: null, tone: 'info', token: ++msgToken })

export function gymCleared(gym: Gym, cleared: string[]) {
  return gym.packs.length > 0 && gym.packs.every((id) => cleared.includes(id))
}

export function WorldView() {
  const navigate = useNavigate()
  const load = useProgress((s) => s.load)
  const loaded = useProgress((s) => s.loaded)
  const saved = useProgress((s) => s.pos)
  const coins = useProgress((s) => s.coins)
  const moveTo = useProgress((s) => s.moveTo)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const textBox = useRef<TextBoxHandle>(null)
  const grace = useRef(0)
  const position: Pos = saved ?? { ...WORLD.start, facing: 's' }

  useEffect(() => {
    load()
    useSettings.getState().load()
    if (import.meta.env.DEV) {
      Object.assign(window, {
        __world: {
          progress: useProgress,
          press,
          encounter: (key: string) => {
            const deck = deckFor(key)
            if (deck) setOverlay({ kind: 'battle', deck })
          },
        },
      })
    }
  }, [load])

  const paused = overlay !== null

  useButtons(0, loaded && !paused, (btn) => {
    if (btn === 'a' || btn === 'b') {
      textBox.current?.advance()
      return
    }
    if (btn === 'start') {
      sfx.select()
      setOverlay({ kind: 'menu' })
    }
  })

  function leaveDoor(door: { x: number; y: number }) {
    moveTo(outsideDoor(door))
  }

  function arrive(x: number, y: number) {
    const door = doorAt(WORLD, x, y)
    if (door) {
      sfx.door()
      grace.current = GRACE_STEPS
      if (door.kind === 'gym') setOverlay({ kind: 'gym', gym: door.gym })
      else setOverlay({ kind: door.kind })
      return
    }
    const deckKey = GRASS_DECK[charAt(WORLD, x, y)]
    if (!deckKey) return
    if (grace.current > 0) {
      grace.current -= 1
      return
    }
    if (Math.random() >= ENCOUNTER_RATE) return
    const deck = deckFor(deckKey)
    if (!deck) return
    grace.current = GRACE_STEPS
    setMsg(null)
    setOverlay({ kind: 'battle', deck })
  }

  function closeInside(door: { x: number; y: number }) {
    leaveDoor(door)
    setOverlay(null)
  }

  const inTown = position.x >= CMC.x0 && position.x <= CMC.x1 && position.y >= CMC.y0 && position.y <= CMC.y1
  const place = inTown ? 'CMC' : 'ROUTE'

  if (!loaded) {
    return (
      <div className="device items-center justify-center">
        <p className="font-pixel text-[10px]">Loading the map…</p>
      </div>
    )
  }

  return (
    <div className="device" data-testid="world-view">
      <div className="bezel">
        <div className="screen">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <WorldScreen
              world={WORLD}
              position={position}
              paused={paused}
              closedGyms={CLOSED}
              onMove={(pos) => {
                moveTo(pos)
                if (msg && !textBox.current?.typing()) setMsg(null)
              }}
              onArrive={arrive}
              onBump={() => sfx.bump()}
            />
            <div className="hud">
              <span className="hud-chip" data-testid="place">
                {place}
              </span>
              <span className="hud-chip hud-coins" data-testid="coins">
                <i className="coin" />{coins}
              </span>
            </div>
            {overlay?.kind === 'gym' && (
              <GymWindow
                gym={overlay.gym}
                onClose={() => closeInside(overlay.gym.door)}
                onPlay={(packId) => {
                  leaveDoor(overlay.gym.door)
                  void navigate({ to: '/play/$packId', params: { packId } })
                }}
              />
            )}
            {overlay?.kind === 'board' && (
              <BoardWindow
                onClose={() => closeInside(WORLD.places.find((p) => p.kind === 'board')!.door)}
                onTeleport={(gym) => {
                  sfx.door()
                  moveTo(outsideDoor(gym.door))
                  setOverlay(null)
                  setMsg(say(`Teleported to the ${gym.name}.`))
                }}
              />
            )}
            {overlay?.kind === 'shop' && <ShopWindow coins={coins} onClose={() => closeInside(WORLD.places.find((p) => p.kind === 'shop')!.door)} />}
            {overlay?.kind === 'menu' && (
              <WorldMenu
                onClose={() => setOverlay(null)}
                onCardex={() => setOverlay({ kind: 'cardex' })}
                onStations={() => void navigate({ to: '/gym' })}
                onTitle={() => void navigate({ to: '/' })}
              />
            )}
            {overlay?.kind === 'cardex' && <Cardex onClose={() => setOverlay(null)} />}
          </div>
          <TextBox
            ref={textBox}
            msg={msg}
            speaker={null}
            idle={inTown ? 'CMC. The hall shows your badges and can send you to any gym. Walk out through a gate to explore.' : 'Tall grass hides wild creatures with flashcards. Doors open gyms. START for the menu.'}
            onClose={() => setMsg(null)}
            onTyping={() => undefined}
          />
          {overlay?.kind === 'battle' && <Battle deck={overlay.deck} onClose={() => setOverlay(null)} />}
        </div>
        <p className="bezel-label">
          OSCE GYM <span>·</span> <b>{place === 'CMC' ? 'CMC' : 'THE REGION'}</b>
        </p>
      </div>
      {overlay?.kind !== 'battle' && <Controller />}
      <p className="keys-help">Arrows/WASD move · Z/Enter = A · X/Esc = B · M = START</p>
    </div>
  )
}

/* ================================================================ windows */

function Sheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: React.ReactNode; testId: string }) {
  const root = useRef<HTMLDivElement>(null)
  useCursor(root, { priority: 20, onBack: onClose })
  return (
    <div ref={root} className="absolute inset-0 z-30 flex flex-col p-2" data-testid={testId}>
      <Win title={title} onClose={onClose} className="sheet">
        {children}
      </Win>
    </div>
  )
}

function GymWindow({ gym, onClose, onPlay }: { gym: Gym; onClose: () => void; onPlay: (packId: string) => void }) {
  const cleared = useProgress((s) => s.cleared)
  const closed = gym.packs.length === 0
  return (
    <Sheet title={gym.name} onClose={onClose} testId="gym-window">
      <div className="sheet-scroll">
        <p className="sheet-meta">
          {gymCleared(gym, cleared) ? `★ ${gym.badge} earned` : closed ? 'UNDER CONSTRUCTION' : `Clear every station for the ${gym.badge}`}
        </p>
        {closed ? (
          <>
            <p className="menu-note">Stations coming here, from your notes:</p>
            {gym.topics.map((t) => (
              <p key={t} className="menu-note">
                • {t}
              </p>
            ))}
          </>
        ) : (
          gym.packs.map((id) => {
            const pack = getPack(id)
            return (
              <NavItem key={id} testId={`gym-station-${id}`} tone={cleared.includes(id) ? 'done' : undefined} onClick={() => onPlay(id)}>
                {cleared.includes(id) ? '✓ ' : ''}
                {pack?.title ?? id}
                <span className="nav-need">{cleared.includes(id) ? 'CLEARED' : 'NOT DONE YET'}</span>
              </NavItem>
            )
          })
        )}
      </div>
      <NavItem onClick={onClose}>LEAVE</NavItem>
    </Sheet>
  )
}

function BoardWindow({ onClose, onTeleport }: { onClose: () => void; onTeleport: (gym: Gym) => void }) {
  const cleared = useProgress((s) => s.cleared)
  const badges = WORLD.gyms.filter((g) => gymCleared(g, cleared))
  const todo = WORLD.gyms.flatMap((g) => g.packs.filter((id) => !cleared.includes(id)).map((id) => ({ gym: g, id })))
  return (
    <Sheet title="CMC HALL · GYM BOARD" onClose={onClose} testId="board">
      <div className="sheet-scroll">
        <p className="sheet-meta">BADGES {badges.length}/{WORLD.gyms.length}</p>
        <div className="badge-row">
          {WORLD.gyms.map((g) => (
            <span key={g.id} className="badge-dot" data-earned={gymCleared(g, cleared) || undefined} data-closed={g.packs.length === 0 || undefined} title={g.badge}>
              {gymCleared(g, cleared) ? '★' : g.packs.length === 0 ? '·' : '○'}
            </span>
          ))}
        </div>
        <p className="sheet-meta mt-2">STATIONS NOT DONE</p>
        {todo.length === 0 && <p className="menu-note">Every open station is cleared.</p>}
        {todo.map(({ gym, id }) => (
          <p key={id} className="menu-note">
            • {getPack(id)?.title ?? id} <b>({gym.name})</b>
          </p>
        ))}
        <p className="sheet-meta mt-2">TELEPORT TO A GYM</p>
        {WORLD.gyms.map((g) => (
          <NavItem key={g.id} testId={`teleport-${g.id}`} onClick={() => onTeleport(g)}>
            {g.name}
            <span className="nav-need">{g.packs.length === 0 ? 'under construction' : gymCleared(g, cleared) ? 'badge earned' : `${g.packs.filter((id) => !cleared.includes(id)).length} to do`}</span>
          </NavItem>
        ))}
      </div>
      <NavItem onClick={onClose}>LEAVE</NavItem>
    </Sheet>
  )
}

function ShopWindow({ coins, onClose }: { coins: number; onClose: () => void }) {
  return (
    <Sheet title="SHOP" onClose={onClose} testId="shop">
      <div className="sheet-scroll">
        <p className="sheet-text">Opening soon. Keep your coins.</p>
        <p className="sheet-meta">You have <i className="coin" />{coins}</p>
      </div>
      <NavItem onClick={onClose}>LEAVE</NavItem>
    </Sheet>
  )
}

function WorldMenu({ onClose, onCardex, onStations, onTitle }: { onClose: () => void; onCardex: () => void; onStations: () => void; onTitle: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const sound = useSettings((s) => s.sound)
  const toggleSound = useSettings((s) => s.toggleSound)
  useCursor(root, { priority: 20, onBack: onClose })
  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/20 p-2" data-testid="world-menu" onClick={onClose}>
      <div ref={root} onClick={(event) => event.stopPropagation()}>
        <Win className="menu-col w-[172px]">
          <NavItem testId="menu-cardex" onClick={onCardex}>CARDEX</NavItem>
          <NavItem testId="menu-stations" onClick={onStations}>STATIONS</NavItem>
          <NavItem onClick={toggleSound}>SOUND {sound ? 'ON' : 'OFF'}</NavItem>
          <NavItem onClick={onTitle}>TITLE</NavItem>
          <NavItem onClick={onClose}>EXIT</NavItem>
        </Win>
      </div>
    </div>
  )
}

function Cardex({ onClose }: { onClose: () => void }) {
  const dex = useProgress((s) => s.dex)
  const seen = useProgress((s) => s.seen)
  const coins = useProgress((s) => s.coins)
  const best = useProgress((s) => s.bestStreak)
  const decks = useMemo(() => Object.values(DECKS), [])
  return (
    <Sheet title="CARDEX" onClose={onClose} testId="cardex">
      <div className="sheet-scroll">
        <p className="sheet-meta">
          <i className="coin" />{coins} COINS · BEST STREAK {best}
        </p>
        {decks.map((d) => {
          const right = d.cards.filter((c) => (seen[c.id]?.r ?? 0) > 0).length
          return (
            <div key={d.deck} className="mt-2">
              <p className="menu-note">
                <b>{d.name}</b> · cards answered right {right}/{d.cards.length}
              </p>
              {d.creatures.map((cr) => (
                <p key={cr.id} className="menu-note">
                  {dex[cr.id] ? `✓ ${cr.name} ×${dex[cr.id]}` : '??? not beaten yet'}
                </p>
              ))}
            </div>
          )
        })}
      </div>
      <NavItem onClick={onClose}>CLOSE</NavItem>
    </Sheet>
  )
}
