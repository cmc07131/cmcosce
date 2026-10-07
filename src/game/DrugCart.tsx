import { useMemo, useState } from 'react'
import type { Action, ActionOption } from '~/engine/schema'
import { seededShuffle } from './panels'
import { indicated, usePlay } from './store'
import { NavItem, Win } from './ui'

/**
 * The drug cart as it looks: shelves of labelled boxes, vials and bags. You take a drug by name first; its doses
 * appear only after that. Each dose belongs to a step of the station; picking one sends it to the nurse at once.
 */

type Row = { actionId: string; option: ActionOption }

const nameOf = (o: ActionOption) => o.drug ?? o.label
const doseOf = (o: ActionOption) => o.dose ?? o.label

function formOf(name: string): 'bag' | 'bottle' | 'vial' {
  if (/crystalloid|saline|hartmann|plasma-lyte|glucose 10/i.test(name)) return 'bag'
  if (/charcoal/i.test(name)) return 'bottle'
  return 'vial'
}

/** A cap colour per drug, so the shelf reads like a real cart. */
function capOf(name: string) {
  const caps = ['#e85858', '#58a8e8', '#f8d858', '#78c878', '#b878e8', '#f89848', '#48c8c0']
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return caps[h % caps.length]
}

function DrugIcon({ name }: { name: string }) {
  const form = formOf(name)
  const cap = capOf(name)
  return (
    <svg viewBox="0 0 16 20" className="drug-icon pixelated" aria-hidden>
      {form === 'bag' && (
        <g>
          <rect x="3" y="2" width="10" height="13" rx="2" fill="#e8f4ff" stroke="#6a8aa8" />
          <rect x="5" y="6" width="6" height="4" fill="#ffffff" stroke="#9ab" strokeWidth="0.5" />
          <rect x="7" y="15" width="2" height="4" fill="#6a8aa8" />
        </g>
      )}
      {form === 'bottle' && (
        <g>
          <rect x="4" y="5" width="8" height="13" rx="1" fill="#202020" stroke="#606060" />
          <rect x="5" y="2" width="6" height="3" fill={cap} />
          <rect x="5" y="9" width="6" height="4" fill="#f0f0e8" />
        </g>
      )}
      {form === 'vial' && (
        <g>
          <rect x="4" y="6" width="8" height="12" rx="1" fill="#f4f8ff" stroke="#8898a8" />
          <rect x="5" y="3" width="6" height="3" fill={cap} stroke="#404850" strokeWidth="0.5" />
          <rect x="5" y="10" width="6" height="5" fill="#ffffff" stroke="#b8c0c8" strokeWidth="0.5" />
        </g>
      )}
    </svg>
  )
}

export function DrugCart({
  actions,
  spent,
  onConfirm,
  onClose,
}: {
  actions: Action[]
  spent: Record<string, string[]>
  onConfirm: (actionId: string, optionIds: string[]) => void
  onClose?: () => void
}) {
  const seed = usePlay((s) => s.seed)
  const scene = usePlay((s) => s.scene)
  const rows: Row[] = useMemo(() => actions.flatMap((a) => (a.options ?? []).map((option) => ({ actionId: a.id, option }))), [actions])
  const drugs = useMemo(() => seededShuffle([...new Set(rows.map((r) => nameOf(r.option)))], seed, 'drug-cart'), [rows, seed])
  const [drug, setDrug] = useState<string | null>(null)
  const used = (r: Row) => (spent[r.actionId] ?? []).includes(r.option.id)
  const scripted = !rows.some((r) => r.option.isTrap)

  if (drug) {
    const mine = rows.filter((r) => nameOf(r.option) === drug)
    // Shuffled, so the right dose is not always first.
    const doses = seededShuffle([...new Set(mine.map((r) => doseOf(r.option)))], seed, `dose:${drug}`)
    return (
      <Win title={drug.toUpperCase()} onClose={onClose} className="sheet">
        <div className="sheet-scroll">
          <p className="sheet-prompt">Dose?</p>
          {doses.map((dose) => {
            const same = mine.filter((r) => doseOf(r.option) === dose)
            // The same dose can serve more than one moment (a first bolus, a later one): use the one that is due.
            const pick = same.find((r) => !used(r) && indicated(r.option, scene ?? [])) ?? same.find((r) => !used(r))
            // Every dose on a trap-free cart is part of the script: one whose moment has not come waits, greyed.
            const waiting = scripted && pick && !indicated(pick.option, scene ?? []) ? (pick.option.early ?? 'Not yet.') : null
            return (
              <NavItem
                key={dose}
                testId={`dose-${pick?.actionId ?? 'x'}-${pick?.option.id ?? 'x'}`}
                disabled={!pick || waiting !== null}
                tone={pick ? undefined : 'done'}
                onClick={() => {
                  if (!pick || waiting) return
                  onConfirm(pick.actionId, [pick.option.id])
                  onClose?.()
                }}
              >
                {pick ? '▸ ' : '✓ '}
                {dose}
                {waiting && <span className="nav-need">{waiting}</span>}
              </NavItem>
            )
          })}
        </div>
        <NavItem testId="dose-back" className="nav-confirm" onClick={() => setDrug(null)}>
          ◀ Back to the cart
        </NavItem>
      </Win>
    )
  }

  return (
    <Win title="DRUG CART" onClose={onClose} className="sheet">
      <div className="sheet-scroll">
        <div className="drug-cart" data-testid="drug-cart">
          {drugs.map((name) => {
            const given = rows.some((r) => nameOf(r.option) === name && !r.option.isTrap && used(r))
            return (
              <button key={name} type="button" className="drug-item" data-given={given || undefined} data-testid={`drug-${name}`} onClick={() => setDrug(name)}>
                <DrugIcon name={name} />
                <span>{name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Win>
  )
}
