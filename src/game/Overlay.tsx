import { useState, type ReactNode } from 'react'
import { itemLabel, menuIsMulti, missingItems } from '~/engine/judge'
import type { Action, Pack } from '~/engine/schema'
import type { Overlay as OverlayState } from './store'

function targetName(pack: Pack, id: string) {
  return (
    pack.cast.find((npc) => npc.id === id)?.displayName ??
    pack.room.interactables.find((item) => item.id === id)?.label ??
    id
  )
}

export function OverlaySheet({
  pack,
  overlay,
  inventory,
  spent,
  findingNote,
  caption,
  onClose,
  onAction,
  onOption,
  onConfirm,
  onFinding,
  onRegion,
  onEnter,
  entered,
}: {
  pack: Pack
  overlay: OverlayState
  inventory: string[]
  spent: Record<string, string[]>
  findingNote: string | null
  caption: string
  onClose: () => void
  onAction: (actionId: string, targetId: string) => void
  onOption: (actionId: string, optionId: string) => void
  onConfirm: (actionId: string, optionIds: string[]) => void
  onFinding: (actionId: string, findingId: string) => void
  onRegion: (actionId: string, regionId: string) => void
  onEnter: () => void
  entered: boolean
}) {
  if (overlay.kind === 'stem') {
    return (
      <Sheet title="Door note" onClose={entered ? onClose : undefined}>
        <p className="font-body text-[22px] leading-snug whitespace-pre-wrap">{pack.meta.stem}</p>
        <p className="mt-3 font-pixel text-[8px] text-[#ffb020]">
          Reading {pack.meta.readTimeSec ?? 60}s · clock starts in the room
        </p>
        <button type="button" className="tap mt-4" data-testid="stem-enter" onClick={onEnter}>
          {entered ? 'Back to the bay' : 'Enter room'}
        </button>
      </Sheet>
    )
  }

  if (overlay.kind === 'chooser') {
    const actions = pack.actions.filter((action) => action.targetIds.includes(overlay.targetId))
    return (
      <Sheet title={targetName(pack, overlay.targetId)} onClose={onClose}>
        <div className="flex flex-col gap-2">
          {actions.map((action) => {
            const missing = missingItems(action.requiresItems, inventory)
            return (
              <button
                key={action.id}
                type="button"
                className="tap"
                data-testid={`action-${action.id}`}
                disabled={missing.length > 0}
                onClick={() => onAction(action.id, overlay.targetId)}
              >
                {action.prompt || action.hint}
                {missing.length > 0 && (
                  <span className="mt-1 block font-body text-[18px] text-[#ffb020]">
                    Need {missing.map((id) => itemLabel(pack, id)).join(', ')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Sheet>
    )
  }

  const action = pack.actions.find((row) => row.id === overlay.actionId)
  if (!action) return null
  const title = targetName(pack, overlay.targetId)

  if (action.kind === 'examine-face') {
    return (
      <Sheet title={title} onClose={onClose}>
        <p className="mb-2 font-body text-[20px]">{action.prompt}</p>
        <div className="relative mx-auto h-[280px] w-[220px] border-4 border-[#303848] bg-[#f3e6c0]">
          <Face />
          {(action.findings ?? []).map((finding) => (
            <button
              key={finding.id}
              type="button"
              data-testid={`finding-${finding.id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-[#303848] bg-[#fffbec] px-1 font-body text-[16px] text-[#28241c]"
              style={{ left: `${finding.xPct}%`, top: `${finding.yPct}%` }}
              onClick={() => onFinding(action.id, finding.id)}
            >
              {finding.label}
            </button>
          ))}
        </div>
        {findingNote && <p className="mt-3 font-body text-[22px] leading-snug">{findingNote}</p>}
      </Sheet>
    )
  }

  if (action.kind === 'examine-body') {
    return (
      <Sheet title={title} onClose={onClose}>
        <p className="mb-2 font-body text-[20px]">{action.prompt}</p>
        <div className="relative mx-auto h-[360px] w-[200px]">
          <Body />
          {(action.regions ?? []).map((region) => (
            <button
              key={region.id}
              type="button"
              data-testid={`region-${region.id}`}
              className="absolute border-2 border-[#c88820] bg-[#fffbec]/80 font-body text-[16px] text-[#28241c]"
              style={{
                left: `${region.xPct}%`,
                top: `${region.yPct}%`,
                width: `${region.wPct}%`,
                height: `${region.hPct}%`,
              }}
              onClick={() => onRegion(action.id, region.id)}
            >
              {region.label}
            </button>
          ))}
        </div>
        {findingNote && <p className="mt-3 font-body text-[22px] leading-snug">{findingNote}</p>}
      </Sheet>
    )
  }

  if (action.kind === 'kit' || (action.kind === 'menu' && menuIsMulti(action))) {
    return (
      <SelectList
        action={action}
        title={title}
        spent={spent[action.id] ?? []}
        onClose={onClose}
        onConfirm={(ids) => onConfirm(action.id, ids)}
      />
    )
  }

  const used = new Set(spent[action.id] ?? [])
  const options = (action.options ?? []).filter((option) => !used.has(option.id))
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-3 font-body text-[22px] leading-snug">{action.prompt}</p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const missing = [
            ...missingItems(action.requiresItems, inventory),
            ...missingItems(option.requiresItems, inventory),
          ]
          return (
            <button
              key={option.id}
              type="button"
              className={option.isTrap ? 'tap trap' : 'tap'}
              data-testid={`option-${action.id}-${option.id}`}
              disabled={missing.length > 0}
              onClick={() => onOption(action.id, option.id)}
            >
              {option.label}
              {missing.length > 0 && (
                <span className="mt-1 block text-[18px] text-[#ffb020]">
                  Need {missing.map((id) => itemLabel(pack, id)).join(', ')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Sheet>
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
  onClose: () => void
  onConfirm: (ids: string[]) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const used = new Set(spent)
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-3 font-body text-[22px] leading-snug">{action.prompt}</p>
      <div className="flex flex-col gap-2">
        {(action.options ?? []).map((option) => {
          const taken = used.has(option.id)
          const on = picked.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              className={option.isTrap ? 'tap trap' : 'tap'}
              data-testid={`option-${action.id}-${option.id}`}
              disabled={taken}
              onClick={() =>
                setPicked((cur) => (cur.includes(option.id) ? cur.filter((id) => id !== option.id) : [...cur, option.id]))
              }
            >
              {on ? '■ ' : '□ '}
              {option.label}
              {taken ? ' · taken' : ''}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="tap mt-3 bg-[#315c3d]"
        data-testid={`confirm-${action.id}`}
        onClick={() => {
          if (!picked.length) return
          onConfirm(picked)
          setPicked([])
        }}
      >
        {action.confirmLabel || 'Confirm'}
      </button>
    </Sheet>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f8f8e0] text-[#28241c]" data-testid="overlay">
      <div className="flex items-center justify-between px-3 pt-2">
        <h2 className="font-body text-[28px] leading-none">{title}</h2>
        {onClose && (
          <button type="button" className="font-body text-[28px] leading-none px-2" aria-label="Close" data-testid="overlay-close" onClick={onClose}>
            ×
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pt-2 pb-4">{children}</div>
    </div>
  )
}

function Face() {
  return (
    <svg viewBox="0 0 64 80" className="pixelated h-full w-full">
      <rect x="16" y="8" width="32" height="28" fill="#3a2a22" />
      <rect x="18" y="22" width="28" height="32" fill="#e2b896" />
      <rect x="24" y="34" width="4" height="4" fill="#2a2118" />
      <rect x="36" y="34" width="4" height="4" fill="#2a2118" />
      <rect x="28" y="46" width="8" height="3" fill="#c4897a" />
    </svg>
  )
}

function Body() {
  return (
    <svg viewBox="0 0 80 140" className="pixelated h-full w-full">
      <rect x="28" y="4" width="24" height="22" fill="#e2b896" />
      <rect x="22" y="28" width="36" height="40" fill="#f2c9d4" />
      <rect x="24" y="70" width="32" height="36" fill="#e7a8ba" />
      <rect x="28" y="108" width="10" height="28" fill="#e2b896" />
      <rect x="42" y="108" width="10" height="28" fill="#e2b896" />
    </svg>
  )
}
