import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { Ecg12 } from '~/game/ecg/Ecg12'
import { ATLAS } from '~/game/ecg/atlas'
import { NavItem, Win, useCursor } from '~/game/ui'

export const Route = createFileRoute('/atlas')({
  component: Atlas,
})

function Atlas() {
  const navigate = useNavigate()
  const specs = useMemo(() => ATLAS.map((f) => f()), [])
  const [index, setIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  useCursor(root, { priority: 10, onBack: () => void navigate({ to: '/' }) })
  const spec = specs[index]
  return (
    <div className="page" ref={root}>
      <Win title="ECG ATLAS">
        <p className="menu-note">Generated from electrophysiology. Every pattern is checked against its criteria in the tests.</p>
      </Win>
      <Win>
        <Ecg12 spec={spec} caption={spec.label} />
      </Win>
      <Win className="min-h-0 overflow-auto">
        {specs.map((s, i) => (
          <NavItem key={s.id + i} testId={`atlas-${s.id}`} tone={i === index ? 'done' : undefined} onClick={() => setIndex(i)}>
            {s.label}
          </NavItem>
        ))}
      </Win>
    </div>
  )
}
