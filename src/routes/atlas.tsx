import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { Ecg12 } from '~/game/ecg/Ecg12'
import { ATLAS } from '~/game/ecg/atlas'
import { FilmBody } from '~/game/imaging/Film'
import { IMAGES } from '~/game/imaging/library'
import { NavItem, Win, useCursor } from '~/game/ui'

export const Route = createFileRoute('/atlas')({
  component: Atlas,
})

/** Every ECG and image the stations can show, with its reference and what it shows. */
function Atlas() {
  const navigate = useNavigate()
  const specs = useMemo(() => ATLAS.map((f) => f()), [])
  const films = useMemo(() => [...Object.keys(IMAGES), 'photo:burns:chest-partial,abdomen-partial,r-arm-full,head-superficial'], [])
  const [pick, setPick] = useState<{ kind: 'ecg'; index: number } | { kind: 'img'; ref: string }>({ kind: 'ecg', index: 0 })
  const root = useRef<HTMLDivElement>(null)
  useCursor(root, { priority: 10, onBack: () => void navigate({ to: '/' }) })
  useMemo(() => {
    if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __atlasPick: setPick })
  }, [])
  return (
    <div className="page" ref={root}>
      <Win title="ATLAS">
        <p className="menu-note">ECGs generated from electrophysiology; films drawn from anatomy. Each sign is measured in the tests.</p>
      </Win>
      <Win>
        {pick.kind === 'ecg' ? (
          <Ecg12 spec={specs[pick.index]} caption={specs[pick.index].label} />
        ) : (
          <>
            <p className="ecg-caption">{pick.ref}</p>
            <FilmBody src={pick.ref} />
          </>
        )}
      </Win>
      <Win className="min-h-0 overflow-auto">
        <h2 className="win-title">ECG</h2>
        {specs.map((s, i) => (
          <NavItem key={s.id + i} testId={`atlas-${s.id}`} tone={pick.kind === 'ecg' && i === pick.index ? 'done' : undefined} onClick={() => setPick({ kind: 'ecg', index: i })}>
            {s.label}
          </NavItem>
        ))}
        <h2 className="win-title mt-4">FILMS AND PHOTOS</h2>
        {films.map((ref) => (
          <NavItem key={ref} testId={`atlas-${ref}`} tone={pick.kind === 'img' && pick.ref === ref ? 'done' : undefined} onClick={() => setPick({ kind: 'img', ref })}>
            {ref}
          </NavItem>
        ))}
      </Win>
    </div>
  )
}
