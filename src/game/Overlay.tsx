import { useMemo, useRef, useState } from 'react'
import { itemLabel, menuIsMulti, missingItems } from '~/engine/judge'
import type { Action, Pack } from '~/engine/schema'
import { usePlay, type Overlay as OverlayState } from './store'
import { DrugCart } from './DrugCart'
import { Film, FilmButton } from './imaging/Film'
import { GroupPanel, MonitorPanel, StepsPanel, TurnPanel, seededShuffle } from './panels'
import { NavItem, Win, useCursor } from './ui'

export function targetName(pack: Pack, id: string) {
  const npc = pack.cast.find((row) => row.id === id)
  if (npc) return npc.displayName
  const label = pack.room.interactables.find((item) => item.id === id)?.label?.trim()
  if (label) return label
  const patient = pack.cast.find((row) => row.role === 'patient')
  return patient?.displayName ?? id
}

type Props = {
  pack: Pack
  overlay: OverlayState
  inventory: string[]
  spent: Record<string, string[]>
  onClose: () => void
  onAction: (actionId: string, targetId: string) => void
  onOption: (actionId: string, optionId: string) => void
  onConfirm: (actionId: string, optionIds: string[]) => void
  onFinding: (actionId: string, findingId: string) => void
  onRegion: (actionId: string, regionId: string) => void
  onEnter: () => void
  entered: boolean
}

/** Action menus in Gold windows. Keyed by overlay so the cursor starts at the top of each new menu. */
export function OverlaySheet(props: Props) {
  const { overlay } = props
  const key = overlay.kind === 'stem' ? 'stem' : overlay.kind === 'chooser' ? `c:${overlay.targetId}` : `a:${overlay.actionId}`
  return <OverlayBody key={key} {...props} />
}

function OverlayBody({ pack, overlay, inventory, spent, onClose, onAction, onOption, onConfirm, onFinding, onRegion, onEnter, entered }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const canClose = overlay.kind !== 'stem' || entered
  useCursor(root, { priority: 10, onBack: canClose ? onClose : undefined })

  return (
    <div ref={root} className="absolute inset-0 z-30 flex flex-col p-2" data-testid="overlay">
      <Body
        pack={pack}
        overlay={overlay}
        inventory={inventory}
        spent={spent}
        onClose={canClose ? onClose : undefined}
        onAction={onAction}
        onOption={onOption}
        onConfirm={onConfirm}
        onFinding={onFinding}
        onRegion={onRegion}
        onEnter={onEnter}
        entered={entered}
      />
    </div>
  )
}

function Body({
  pack,
  overlay,
  inventory,
  spent,
  onClose,
  onAction,
  onOption,
  onConfirm,
  onFinding,
  onRegion,
  onEnter,
  entered,
}: Omit<Props, 'onClose'> & { onClose?: () => void }) {
  if (overlay.kind === 'stem') {
    return (
      <Win title="DOOR NOTE" onClose={onClose} className="sheet">
        <div className="sheet-scroll">
          <p className="sheet-text whitespace-pre-wrap">{pack.meta.stem}</p>
          <p className="sheet-meta">
            READ {pack.meta.readTimeSec ?? 60}s · CLOCK STARTS IN THE ROOM
          </p>
        </div>
        <NavItem testId="stem-enter" onClick={onEnter}>
          {entered ? 'Back to the bay' : 'Enter room'}
        </NavItem>
      </Win>
    )
  }

  if (overlay.kind === 'chooser') {
    const actions = pack.actions.filter((action) => action.targetIds.includes(overlay.targetId))
    // A cart or trolley is one shelf of kit, whichever step each item belongs to.
    // The drug cart proper: drugs by name on shelves, the dose after.
    if (actions.every((a) => a.kind === 'kit') && actions.some((a) => (a.options ?? []).some((o) => o.drug))) {
      return <DrugCart actions={actions} spent={spent} onClose={onClose} onConfirm={onConfirm} />
    }
    if (actions.length > 1 && actions.every((a) => a.kind === 'kit')) {
      return <CartList actions={actions} title={targetName(pack, overlay.targetId)} spent={spent} onClose={onClose} onConfirm={onConfirm} />
    }
    return (
      <Win title={targetName(pack, overlay.targetId)} onClose={onClose} className="sheet">
        <div className="sheet-scroll">
          {actions.map((action) => {
            const missing = missingItems(action.requiresItems, inventory)
            return (
              <NavItem
                key={action.id}
                testId={`action-${action.id}`}
                disabled={missing.length > 0}
                onClick={() => onAction(action.id, overlay.targetId)}
              >
                {action.prompt || action.hint}
                {missing.length > 0 && <span className="nav-need">Need {missing.map((id) => itemLabel(pack, id)).join(', ')}</span>}
              </NavItem>
            )
          })}
        </div>
      </Win>
    )
  }

  const action = pack.actions.find((row) => row.id === overlay.actionId)
  if (!action) return null
  const title = targetName(pack, overlay.targetId)
  const used = new Set(spent[action.id] ?? [])
  const panel = { pack, action, title, spent: spent[action.id] ?? [], onClose, onOption: (id: string) => onOption(action.id, id) }

  if (action.kind === 'history' || action.kind === 'exam' || action.kind === 'order') return <GroupPanel {...panel} />
  if (action.kind === 'steps') return <StepsPanel {...panel} />
  if (action.kind === 'dialogue' || action.kind === 'viva') return <TurnPanel {...panel} />
  if (action.kind === 'monitor') return <MonitorPanel pack={pack} title={title} onClose={onClose} />

  if (action.kind === 'examine-face') {
    return (
      <Win title={title} onClose={onClose} className="sheet">
        <div className="sheet-scroll">
          {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
          <div className="exam-card relative mx-auto aspect-[4/5] w-[min(220px,70%)]">
            <Face />
            {(action.findings ?? []).map((finding) => (
              <NavItem
                key={finding.id}
                testId={`finding-${finding.id}`}
                tone={used.has(finding.id) ? 'done' : undefined}
                className="hotspot"
                onClick={() => onFinding(action.id, finding.id)}
              >
                <span style={{ left: `${finding.xPct}%`, top: `${finding.yPct}%` }} className="hotspot-pin">
                  {finding.label}
                </span>
              </NavItem>
            ))}
          </div>
        </div>
      </Win>
    )
  }

  if (action.kind === 'examine-body') {
    return (
      <Win title={title} onClose={onClose} className="sheet">
        <div className="sheet-scroll">
          {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
          <div className="exam-card relative mx-auto aspect-[4/7] w-[min(200px,60%)]">
            <Body2 />
            {(action.regions ?? []).map((region) => (
              <NavItem
                key={region.id}
                testId={`region-${region.id}`}
                tone={used.has(region.id) ? 'done' : undefined}
                className="hotspot"
                onClick={() => onRegion(action.id, region.id)}
              >
                <span
                  className="hotspot-area"
                  style={{ left: `${region.xPct}%`, top: `${region.yPct}%`, width: `${region.wPct}%`, height: `${region.hPct}%` }}
                >
                  {region.label}
                </span>
              </NavItem>
            ))}
          </div>
        </div>
      </Win>
    )
  }

  if (action.kind === 'kit' || (action.kind === 'menu' && menuIsMulti(action))) {
    return <SelectList action={action} title={title} spent={spent[action.id] ?? []} onClose={onClose} onConfirm={(ids) => onConfirm(action.id, ids)} />
  }

  return <TalkList action={action} title={title} used={used} inventory={inventory} pack={pack} onClose={onClose} onOption={onOption} />
}

/** Choices in a per-run order: the script's order (right answers first, the trap last) must not show. */
function useShuffled(action: Action) {
  const seed = usePlay((s) => s.seed)
  return useMemo(() => seededShuffle(action.options ?? [], seed, action.id), [action, seed])
}

function TalkList({
  pack,
  action,
  title,
  used,
  inventory,
  onClose,
  onOption,
}: {
  pack: Pack
  action: Action
  title: string
  used: Set<string>
  inventory: string[]
  onClose?: () => void
  onOption: (actionId: string, optionId: string) => void
}) {
  const [film, setFilm] = useState<string | null>(null)
  const options = useShuffled(action).filter((option) => !used.has(option.id))
  const results = (action.options ?? []).filter((option) => used.has(option.id) && option.img)
  return (
    <Win title={title} onClose={onClose} className="sheet">
      <div className="sheet-scroll">
        {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
        {action.img && <FilmButton src={action.img} onOpen={setFilm} />}
        {results.length > 0 && (
          <div className="results" data-testid="results">
            {results.map((option) => option.img && <FilmButton key={option.id} src={option.img} onOpen={setFilm} />)}
          </div>
        )}
        {options.map((option) => {
          const missing = [...missingItems(action.requiresItems, inventory), ...missingItems(option.requiresItems, inventory)]
          return (
            <NavItem
              key={option.id}
              testId={`option-${action.id}-${option.id}`}
              disabled={missing.length > 0}
              onClick={() => {
                // Close straight away: the reply and what happens next play out in the room, not behind the menu.
                onOption(action.id, option.id)
                onClose?.()
              }}
            >
              {option.label}
              {missing.length > 0 && <span className="nav-need">Need {missing.map((id) => itemLabel(pack, id)).join(', ')}</span>}
            </NavItem>
          )
        })}
      </div>
      {film && <Film src={film} onClose={() => setFilm(null)} />}
    </Win>
  )
}

function SelectList({
  action,
  title,
  spent,
  onClose,
  onConfirm,
}: {
  action: Action
  title: string
  spent: string[]
  onClose?: () => void
  onConfirm: (ids: string[]) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const used = new Set(spent)
  const options = useShuffled(action)
  return (
    <Win title={title} onClose={onClose} className="sheet">
      <div className="sheet-scroll">
        {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
        {options.map((option) => {
          const taken = used.has(option.id)
          const on = picked.includes(option.id)
          return (
            <NavItem
              key={option.id}
              testId={`option-${action.id}-${option.id}`}
              disabled={taken}
              tone={taken ? 'done' : undefined}
              onClick={() => setPicked((cur) => (cur.includes(option.id) ? cur.filter((id) => id !== option.id) : [...cur, option.id]))}
            >
              <span className="check">{taken ? '✓' : on ? '■' : '□'}</span>
              {option.label}
            </NavItem>
          )
        })}
      </div>
      <NavItem
        testId={`confirm-${action.id}`}
        className="nav-confirm"
        onClick={() => {
          if (!picked.length) return
          onConfirm(picked)
          setPicked([])
          onClose?.()
        }}
      >
        {action.confirmLabel || 'Take these'} {picked.length ? `(${picked.length})` : ''}
      </NavItem>
    </Win>
  )
}

/** Every item on a cart or trolley in one list; the choice is sent back to the step each item belongs to. */
function CartList({
  actions,
  title,
  spent,
  onClose,
  onConfirm,
}: {
  actions: Action[]
  title: string
  spent: Record<string, string[]>
  onClose?: () => void
  onConfirm: (actionId: string, optionIds: string[]) => void
}) {
  const seed = usePlay((s) => s.seed)
  const rows = useMemo(
    () => seededShuffle(actions.flatMap((a) => (a.options ?? []).map((o) => ({ actionId: a.id, option: o, key: `${a.id}:${o.id}` }))), seed, `cart:${title}`),
    [actions, seed, title],
  )
  const [picked, setPicked] = useState<string[]>([])
  return (
    <Win title={title} onClose={onClose} className="sheet">
      <div className="sheet-scroll">
        {rows.map(({ actionId, option, key }) => {
          const taken = (spent[actionId] ?? []).includes(option.id)
          const on = picked.includes(key)
          return (
            <NavItem
              key={key}
              testId={`option-${actionId}-${option.id}`}
              disabled={taken}
              tone={taken ? 'done' : undefined}
              onClick={() => setPicked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))}
            >
              <span className="check">{taken ? '✓' : on ? '■' : '□'}</span>
              {option.label}
            </NavItem>
          )
        })}
      </div>
      <NavItem
        testId="confirm-cart"
        className="nav-confirm"
        onClick={() => {
          if (!picked.length) return
          for (const a of actions) {
            const ids = picked.filter((k) => k.startsWith(`${a.id}:`)).map((k) => k.slice(a.id.length + 1))
            if (ids.length) onConfirm(a.id, ids)
          }
          setPicked([])
          onClose?.()
        }}
      >
        {actions[0]?.confirmLabel || 'Take these'} {picked.length ? `(${picked.length})` : ''}
      </NavItem>
    </Win>
  )
}

function Face() {
  return (
    <svg viewBox="0 0 32 40" className="pixelated absolute inset-0 h-full w-full" shapeRendering="crispEdges">
      <rect width="32" height="40" fill="#f8f0d8" />
      <rect x="7" y="4" width="18" height="10" fill="#583830" />
      <rect x="5" y="8" width="3" height="16" fill="#583830" />
      <rect x="24" y="8" width="3" height="16" fill="#583830" />
      <rect x="8" y="10" width="16" height="20" fill="#f8c8a0" />
      <rect x="7" y="16" width="1" height="4" fill="#e8a880" />
      <rect x="24" y="16" width="1" height="4" fill="#e8a880" />
      <rect x="10" y="15" width="4" height="1" fill="#583830" />
      <rect x="18" y="15" width="4" height="1" fill="#583830" />
      <rect x="11" y="17" width="2" height="2" fill="#181820" />
      <rect x="19" y="17" width="2" height="2" fill="#181820" />
      <rect x="15" y="19" width="2" height="4" fill="#e8a880" />
      <rect x="13" y="25" width="6" height="1" fill="#c86070" />
      <rect x="11" y="30" width="10" height="3" fill="#f8c8a0" />
      <rect x="4" y="33" width="24" height="7" fill="#f0b8c8" />
    </svg>
  )
}

function Body2() {
  return (
    <svg viewBox="0 0 40 70" className="pixelated absolute inset-0 h-full w-full" shapeRendering="crispEdges">
      <rect width="40" height="70" fill="#f8f0d8" />
      <rect x="15" y="2" width="10" height="10" fill="#f8c8a0" />
      <rect x="14" y="1" width="12" height="4" fill="#583830" />
      <rect x="17" y="12" width="6" height="2" fill="#f8c8a0" />
      <rect x="10" y="14" width="20" height="20" fill="#f0b8c8" />
      <rect x="6" y="15" width="4" height="18" fill="#f8c8a0" />
      <rect x="30" y="15" width="4" height="18" fill="#f8c8a0" />
      <rect x="11" y="34" width="18" height="12" fill="#d08898" />
      <rect x="12" y="46" width="7" height="22" fill="#f8c8a0" />
      <rect x="21" y="46" width="7" height="22" fill="#f8c8a0" />
    </svg>
  )
}
