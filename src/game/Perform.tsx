import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { HandSprite, NeckFront, NeckSide } from './NeckModel'
import { IoBench } from './IoBench'
import { PacerBench } from './PacerBench'
import { useButtons } from './input'
import { sfx } from './sfx'
import type { PerformJob } from './store'

type Pt = { x: number; y: number }

export function PerformStage({ job, onDone, onCancel }: { job: PerformJob; onDone: () => void; onCancel: () => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const [pt, setPt] = useState<Pt>({ x: 68, y: 78 })
  const [holding, setHolding] = useState(0)
  const [dragged, setDragged] = useState(0)
  const done = useRef(false)
  const hold = useRef(0)
  const last = useRef<Pt | null>(null)

  if (job.kind === 'pacer') {
    return (
      <BattleFrame job={job} onCancel={onCancel}>
        <PacerBench pose={job.pose} onDone={onDone} />
      </BattleFrame>
    )
  }

  if (job.kind === 'io') {
    return (
      <BattleFrame job={job} onCancel={onCancel}>
        <IoBench onDone={onDone} />
      </BattleFrame>
    )
  }

  function local(event: PointerEvent<HTMLDivElement>) {
    const rect = stage.current?.getBoundingClientRect()
    if (!rect) return pt
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    }
  }

  function succeed() {
    if (done.current) return
    done.current = true
    onDone()
  }

  function near(a: Pt, b: Pt, reach: number) {
    return Math.hypot(a.x - b.x, a.y - b.y) < reach
  }

  function check(next: Pt, dt: number, travel = dragged) {
    if (job.kind === 'lift' && next.y < 36) succeed()
    if (job.kind === 'release' && next.y < 28) succeed()
    if (job.kind === 'cover' && near(next, { x: 50, y: 68 }, 14)) succeed()
    if (job.kind === 'dress' && job.pose === 'apron' && near(next, { x: 50, y: 58 }, 16)) succeed()
    if (job.kind === 'dress' && job.pose !== 'apron' && (near(next, { x: 28, y: 62 }, 14) || near(next, { x: 72, y: 62 }, 14))) succeed()
    if (job.kind === 'cannula' && near(next, { x: 74, y: 46 }, 14)) succeed()
    if (job.kind === 'pose' && job.pose === 'lateral' && next.x < 28) succeed()
    if (job.kind === 'pose' && job.pose === 'extend' && next.y < 34) succeed()
    if (job.kind === 'pose' && job.pose !== 'lateral' && job.pose !== 'extend' && next.y < 30) succeed()
    if (job.kind === 'look' && job.pose === 'larynx' && travel > 14 && near(next, { x: 50, y: 48 }, 24)) succeed()
    if (job.kind === 'look' && job.pose !== 'larynx' && travel > 28) succeed()
    if (job.kind === 'cut' && job.pose === 'bougie' && next.y < 52 && next.y > 32 && next.x > 40 && next.x < 62) succeed()
    if (job.kind === 'cut' && job.pose !== 'bougie' && travel > 18 && next.y > 42 && next.y < 68) succeed()
    if (job.kind === 'listen' && next.x > 32 && next.x < 68 && next.y > 38 && next.y < 70) {
      hold.current += dt
      setHolding(Math.min(1, hold.current / 650))
      if (hold.current > 650) succeed()
    } else if (job.kind === 'listen') {
      hold.current = 0
      setHolding(0)
    }
  }

  return (
    <BattleFrame job={job} onCancel={onCancel}>
      <div
        ref={stage}
        className="relative mx-3 mt-2 mb-3 min-h-[260px] flex-1 border-4 border-[#181820] bg-[#f3e6c0]"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          const next = local(event)
          last.current = next
          setPt(next)
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          const next = local(event)
          const step = last.current ? Math.hypot(next.x - last.current.x, next.y - last.current.y) : 0
          const travel = dragged + step
          if (step) setDragged(travel)
          last.current = next
          setPt(next)
          check(next, 16, travel)
        }}
        onPointerUp={(event) => check(local(event), 16, dragged)}
      >
        <Scene kind={job.kind} pose={job.pose} pt={pt} holding={holding} />
      </div>
    </BattleFrame>
  )
}

/** Procedure scenes open like a Gold battle: flash, wipe, then the bench with a title and a hint window. */
function BattleFrame({ job, onCancel, children }: { job: PerformJob; onCancel: () => void; children: ReactNode }) {
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    sfx.battle()
    const id = window.setTimeout(() => setIntro(false), 650)
    return () => window.clearTimeout(id)
  }, [])
  useButtons(30, true, (btn) => {
    if (btn === 'b') {
      sfx.back()
      onCancel()
    }
  })
  return (
    <div className="battle absolute inset-0 z-40 flex flex-col" data-testid="perform">
      {intro && <div className="battle-intro" aria-hidden />}
      <div className="win battle-head">
        <span className="battle-tag">PROCEDURE</span>
        <h2 className="win-title">{job.label}</h2>
        <button type="button" className="win-close" aria-label="Close" data-testid="perform-close" onClick={onCancel}>
          B✕
        </button>
      </div>
      <p className="win battle-hint">{job.hint}</p>
      <div className="battle-body flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
    </div>
  )
}

function Scene({ kind, pose, pt, holding }: { kind: PerformJob['kind']; pose?: string; pt: Pt; holding: number }) {
  const lift = kind === 'lift' ? Math.max(0, Math.min(1, (78 - pt.y) / 42)) : 0
  const larynx = kind === 'look' && pose === 'larynx'
  const onNeck = kind === 'cut' || larynx
  const extend = kind === 'pose' && pose === 'extend' ? Math.max(0, Math.min(1, (70 - pt.y) / 40)) : 0
  const incision = kind === 'cut' && pose !== 'bougie' ? Math.max(0, Math.min(1, (Math.abs(pt.x - 50) + Math.abs(pt.y - 52)) / 30)) : 0
  const bougie = kind === 'cut' && pose === 'bougie' ? Math.max(0, Math.min(1, (pt.y - 30) / 40)) : 0
  return (
    <div className="absolute inset-0">
      {(kind === 'lift' || kind === 'cover' || kind === 'release') && (
        <>
          <div className="absolute right-[18%] bottom-[18%] left-[18%] h-[28%] rounded-t-full bg-[#f7f1e4] border-2 border-[#303848]" />
          <div
            className="absolute left-1/2 h-10 w-10 -translate-x-1/2 rounded-full border-2 border-[#303848] bg-[#e7c4a8]"
            style={{ bottom: `${22 + lift * 28}%` }}
          />
          <div className="absolute bottom-[16%] left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-[#d85a6a]" />
          <div className="absolute bottom-[12%] left-[58%] h-8 w-3 rounded-full bg-[#e07080]" />
        </>
      )}
      {kind === 'dress' && pose === 'apron' && (
        <div className="absolute top-[18%] left-1/2 h-[58%] w-[34%] -translate-x-1/2 border-2 border-[#303848] bg-[#d8efe8]" />
      )}
      {kind === 'dress' && pose !== 'apron' && (
        <>
          <div className="absolute top-[48%] left-[18%] h-16 w-12 rounded-full border-2 border-[#303848] bg-[#f0d2b4]" />
          <div className="absolute top-[48%] right-[18%] h-16 w-12 rounded-full border-2 border-[#303848] bg-[#f0d2b4]" />
        </>
      )}
      {kind === 'listen' && (
        <>
          <div className="absolute top-[28%] left-1/2 h-[42%] w-[46%] -translate-x-1/2 rounded-full border-2 border-[#303848] bg-[#f3d5c4]" />
          <div className="absolute top-[8%] left-1/2 h-2 w-24 -translate-x-1/2 bg-[#303848]" style={{ transform: `translateX(-50%) scaleX(${0.3 + holding})` }} />
        </>
      )}
      {kind === 'pose' && pose === 'extend' && <NeckSide extend={extend} />}
      {kind === 'pose' && pose !== 'extend' && (
        <div
          className="absolute h-16 w-28 border-2 border-[#303848] bg-[#f2c9d4]"
          style={{
            left: pose === 'lateral' ? `${Math.min(pt.x, 70)}%` : '36%',
            top: pose === 'lateral' ? '42%' : `${Math.min(pt.y, 70)}%`,
          }}
        />
      )}
      {kind === 'cannula' && (
        <div className="absolute top-[28%] right-[10%] h-24 w-10 rounded-full border-2 border-[#303848] bg-[#f0d2b4]" />
      )}
      {onNeck && <NeckFront rock={(pt.x - 50) * 0.45} incision={incision} bougie={bougie} />}
      {kind === 'cut' && pose === 'bougie' && (
        <div className="absolute top-[70%] left-1/2 -translate-x-1/2 font-body text-[18px] text-[#a33a32]">Hold-up</div>
      )}
      {kind === 'look' && pose !== 'larynx' && (
        <div className="absolute inset-[12%] border-2 border-[#303848] bg-[#efe6c4]">
          <div className="absolute inset-x-0 top-0 h-[46%] bg-[#6ea0d8]" style={{ transform: `translateY(${-Math.min(dragOpen(pt), 80)}%)` }} />
          <p className="absolute right-2 bottom-2 left-2 text-center font-body text-[22px] text-[#28241c]">Look</p>
        </div>
      )}
      <div
        data-testid="perform-hand"
        className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
      >
        {kind === 'cut' && pose !== 'bougie' ? <Blade /> : <HandSprite />}
      </div>
    </div>
  )
}

function dragOpen(pt: Pt) {
  return Math.max(0, 70 - pt.y)
}

function Blade() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <rect x="20" y="18" width="8" height="22" rx="1" fill="#c8ccd4" stroke="#303848" />
      <path d="M18 18 L24 4 L30 18 Z" fill="#f4f6f8" stroke="#303848" />
    </svg>
  )
}
