import { useRef, useState } from 'react'
import { itemLabel, menuIsMulti, missingItems } from '~/engine/judge'
import type { Action, Pack } from '~/engine/schema'
import type { Overlay as OverlayState } from './store'
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

  const options = (action.options ?? []).filter((option) => !used.has(option.id))
  return (
    <Win title={title} onClose={onClose} className="sheet">
      <div className="sheet-scroll">
        {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
        {options.map((option) => {
          const missing = [...missingItems(action.requiresItems, inventory), ...missingItems(option.requiresItems, inventory)]
          return (
            <NavItem
              key={option.id}
              testId={`option-${action.id}-${option.id}`}
              disabled={missing.length > 0}
              onClick={() => onOption(action.id, option.id)}
            >
              {option.label}
              {missing.length > 0 && <span className="nav-need">Need {missing.map((id) => itemLabel(pack, id)).join(', ')}</span>}
            </NavItem>
          )
        })}
      </div>
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
  return (
    <Win title={title} onClose={onClose} className="sheet">
      <div className="sheet-scroll">
        {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
        {(action.options ?? []).map((option) => {
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
        }}
      >
        {action.confirmLabel || 'Take these'} {picked.length ? `(${picked.length})` : ''}
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
