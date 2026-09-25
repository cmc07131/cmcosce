import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { hintFor } from '~/engine/judge'
import type { Pack } from '~/engine/schema'
import { Joystick } from './Joystick'
import { OverlaySheet } from './Overlay'
import { PerformStage } from './Perform'
import { Room, type RoomHandle } from './Room'
import { usePlay } from './store'

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds)
  const min = Math.floor(safe / 60)
  const sec = safe % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function PlayView({ pack }: { pack: Pack }) {
  const navigate = useNavigate()
  const boot = usePlay((s) => s.boot)
  const hydrated = usePlay((s) => s.hydrated && s.packId === pack.packId)
  const entered = usePlay((s) => s.entered)
  const ended = usePlay((s) => s.ended)
  const secondsLeft = usePlay((s) => s.secondsLeft)
  const position = usePlay((s) => s.position)
  const inventory = usePlay((s) => s.inventory)
  const earnedMarks = usePlay((s) => s.earnedMarks)
  const spent = usePlay((s) => s.spent)
  const overlay = usePlay((s) => s.overlay)
  const caption = usePlay((s) => s.caption)
  const trapLine = usePlay((s) => s.trapLine)
  const findingNote = usePlay((s) => s.findingNote)
  const enterRoom = usePlay((s) => s.enterRoom)
  const tick = usePlay((s) => s.tick)
  const setPosition = usePlay((s) => s.setPosition)
  const openTarget = usePlay((s) => s.openTarget)
  const openAction = usePlay((s) => s.openAction)
  const closeOverlay = usePlay((s) => s.closeOverlay)
  const showStem = usePlay((s) => s.showStem)
  const pickOption = usePlay((s) => s.pickOption)
  const confirmOptions = usePlay((s) => s.confirmOptions)
  const pickFinding = usePlay((s) => s.pickFinding)
  const pickRegion = usePlay((s) => s.pickRegion)
  const performing = usePlay((s) => s.performing)
  const speech = usePlay((s) => s.speech)
  const scene = usePlay((s) => s.scene)
  const finishPerform = usePlay((s) => s.finishPerform)
  const cancelPerform = usePlay((s) => s.cancelPerform)
  const leave = usePlay((s) => s.leave)
  const rerun = usePlay((s) => s.rerun)
  const room = useRef<RoomHandle>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [talking, setTalking] = useState(false)
  const [trapShown, setTrapShown] = useState<string | null>(null)
  const bootEnded = useRef<string | null>(null)

  useEffect(() => {
    boot(pack)
    bootEnded.current = null
  }, [pack, boot])

  useEffect(() => {
    if (!hydrated) return
    const sig = `${pack.packId}:${ended ?? 'live'}`
    if (bootEnded.current === null) {
      bootEnded.current = sig
      return
    }
    if (bootEnded.current.endsWith(':live') && ended === 'complete') {
      bootEnded.current = sig
      const id = window.setTimeout(() => {
        void navigate({ to: '/debrief/$packId', params: { packId: pack.packId } })
      }, 2400)
      return () => window.clearTimeout(id)
    }
    bootEnded.current = sig
  }, [hydrated, ended, pack.packId, navigate])

  useEffect(() => {
    if (!hydrated || !entered || ended) return
    const id = window.setInterval(() => tick(), 1000)
    return () => window.clearInterval(id)
  }, [hydrated, entered, ended, tick])

  useEffect(() => {
    if (!speech) return
    setTalking(true)
    const id = window.setTimeout(() => setTalking(false), 1200)
    return () => window.clearTimeout(id)
  }, [speech])

  useEffect(() => {
    if (!trapLine) {
      setTrapShown(null)
      return
    }
    setTrapShown(trapLine)
    const id = window.setTimeout(() => setTrapShown(null), 2600)
    return () => window.clearTimeout(id)
  }, [trapLine])

  if (!hydrated) {
    return (
      <div className="game-shell items-center justify-center">
        <p className="font-body text-[28px]">Opening the bay…</p>
      </div>
    )
  }

  if (ended === 'complete') {
    return (
      <div className="game-shell justify-center gap-3 px-4">
        <h1 className="font-body text-[40px] leading-none">Handed over</h1>
        <p className="font-body text-[22px]">This run is already on the debrief sheet.</p>
        <button type="button" className="tap" onClick={() => void navigate({ to: '/debrief/$packId', params: { packId: pack.packId } })}>
          Open debrief
        </button>
        <button type="button" className="tap" data-testid="run-again" onClick={() => rerun(pack)}>
          Run again
        </button>
      </div>
    )
  }

  const clockColor = !entered ? '#28241c' : secondsLeft > 60 ? '#28241c' : secondsLeft > 20 ? '#a86a08' : '#b42318'
  const paused = overlay !== null || performing !== null
  const statusLine = trapShown || speech?.text || '—'
  const talkIds = talking && speech ? [speech.speakerId, 'player'] : []

  return (
    <div className="game-shell">
      <header className="z-40 shrink-0 border-b-4 border-[#303848] bg-[#f8f8e0] px-2 pt-2 pb-1">
        <div
          className={`mb-1 max-h-16 overflow-auto border-2 border-[#303848] px-2 py-1 font-body text-[18px] leading-snug ${trapShown ? 'bg-[#f8e0d4] text-[#6a2820]' : 'bg-[#fffbec] text-[#28241c]'}`}
          data-testid="speech"
        >
          {statusLine}
        </div>
        <div className="flex items-center gap-1">
          <div className="hud-chip shrink-0" data-testid="hud-clock" style={{ color: clockColor }}>
            {formatClock(secondsLeft)}
          </div>
          <div className="score-scroll flex-1" data-testid="hud-score">
            {earnedMarks.map((id) => (
              <span key={id} className="hud-chip shrink-0" title={pack.marks.find((mark) => mark.id === id)?.label}>
                {id}
              </span>
            ))}
          </div>
          <div className="hud-chip shrink-0" data-testid="hud-count">
            {earnedMarks.length}/{pack.marks.length}
          </div>
        </div>
        <div className="score-scroll mt-1 min-h-[22px]" data-testid="hud-inventory">
          {inventory.length === 0 && <span className="font-body text-[16px] text-[#6a6458]">Empty hands</span>}
          {inventory.map((id) => (
            <span key={id} className="shrink-0 font-body text-[16px] text-[#206038]">
              {pack.items.find((item) => item.id === id)?.label ?? id}
            </span>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          <button type="button" className="hud-chip" data-testid="hud-hint" onClick={() => setHint(hintFor(pack, earnedMarks))}>
            HINT
          </button>
          <button type="button" className="hud-chip" data-testid="hud-stem" onClick={() => showStem()}>
            STEM
          </button>
          <button type="button" className="hud-chip" data-testid="hud-leave" onClick={() => leave()}>
            LEAVE
          </button>
        </div>
        {hint && (
          <button type="button" className="poke-box mt-1 w-full px-2 py-1 text-left font-body text-[20px] leading-snug whitespace-normal text-[#28241c]" data-testid="hint-text" onClick={() => setHint(null)}>
            {hint}
          </button>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {entered && (
          <Room
            ref={room}
            pack={pack}
            position={position}
            paused={paused}
            talkIds={talkIds}
            scene={scene ?? []}
            onMove={setPosition}
            onUse={(targetId) => openTarget(pack, targetId)}
            onEmpty={() => usePlay.setState({ caption: 'Nothing to use there.' })}
          />
        )}
        {!entered && <div className="flex-1" />}
        <p className="h-8 shrink-0 truncate px-2 font-body text-[18px] leading-8 text-[#4a453c]" data-testid="caption">
          {caption}
        </p>
        <div className="relative h-[132px] shrink-0">
          <Joystick onDir={(dir) => room.current?.setJoy(dir)} />
          <button
            type="button"
            data-testid="use"
            className="absolute right-2 bottom-3 h-[76px] w-[76px] rounded-full border-4 border-[#303848] bg-[#e23a3a] font-body text-[28px] text-[#fff8e8]"
            onClick={() => room.current?.useFacing()}
          >
            USE
          </button>
        </div>
        {overlay && (
          <OverlaySheet
            pack={pack}
            overlay={overlay}
            inventory={inventory}
            spent={spent}
            findingNote={findingNote}
            caption={caption}
            entered={entered}
            onClose={closeOverlay}
            onEnter={enterRoom}
            onAction={openAction}
            onOption={(actionId, optionId) => pickOption(pack, actionId, optionId)}
            onConfirm={(actionId, optionIds) => confirmOptions(pack, actionId, optionIds)}
            onFinding={(actionId, findingId) => pickFinding(pack, actionId, findingId)}
            onRegion={(actionId, regionId) => pickRegion(pack, actionId, regionId)}
          />
        )}
        {performing && (
          <PerformStage
            key={`${performing.actionId}-${performing.spendId}`}
            job={performing}
            onDone={() => finishPerform(pack)}
            onCancel={cancelPerform}
          />
        )}
      </div>
    </div>
  )
}
