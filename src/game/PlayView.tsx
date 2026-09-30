import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { localizePack } from '~/engine/lang'
import { currentPhase, hintFor, stepsDone } from '~/engine/judge'
import { readoutText, type Action, type Pack } from '~/engine/schema'
import { hasOutput, vitalsAt, vitalsLine } from '~/engine/vitals'
import { Controller } from './Controller'
import { press, useButtons } from './input'
import { OverlaySheet, targetName } from './Overlay'
import { PerformStage } from './Perform'
import { Screen, type ScreenHandle, type Walk } from './Screen'
import { useSettings } from './settings'
import { sfx } from './sfx'
import { StartMenu } from './StartMenu'
import { elapsedOf, usePlay, type Errand } from './store'
import { TextBox, type TextBoxHandle } from './TextBox'
import { NavItem, Win, useCursor } from './ui'

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds)
  const min = Math.floor(safe / 60)
  const sec = safe % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function PlayView({ pack: source }: { pack: Pack }) {
  // Patients and relatives speak Cantonese (or English, from the START menu); staff and the examiner, English.
  const patientLang = useSettings((s) => s.patientLang)
  const pack = useMemo(() => localizePack(source, patientLang), [source, patientLang])
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
  const msg = usePlay((s) => s.msg)
  const toasts = usePlay((s) => s.toasts)
  const performing = usePlay((s) => s.performing)
  const scene = usePlay((s) => s.scene)
  const sceneAt = usePlay((s) => s.sceneAt)
  const store = usePlay.getState
  const labels = useSettings((s) => s.labels)
  const objectives = useSettings((s) => s.objectives)
  const screen = useRef<ScreenHandle>(null)
  const textBox = useRef<TextBoxHandle>(null)
  /** The START menu, or the door's hand-over question (the menu opened on its leave page). */
  const [menu, setMenu] = useState<false | 'root' | 'leave'>(false)
  const announcedDone = useRef(false)
  // The end of the station belongs to the examiner: the steps they prompt (present, hand over) and the viva.
  // They are held back until the rest is done (or time is short), then the examiner comes over and runs them.
  const endQueue = pack.goldPath
    .map((id) => pack.actions.find((a) => a.id === id))
    .filter((a): a is Action => Boolean(a && (a.kind === 'viva' || a.ask)))
  const endIds = endQueue.map((a) => a.id)
  const examinerId = endQueue[0]?.targetIds[0] ?? null
  const endCalled = useRef(false)
  const autoOpened = useRef(new Set<string>())
  const [readyAsked, setReadyAsked] = useState(false)
  const [walks, setWalks] = useState<Walk[]>([])
  const examinerWalk = useRef<number | null>(null)
  const [approaching, setApproaching] = useState(false)
  // The nurse's fetch-and-give jobs, one at a time.
  const errands = usePlay((s) => s.errands)
  const [errand, setErrand] = useState<{ job: Errand; walk: number } | null>(null)
  const nurseId = pack.cast.find((c) => c.role === 'nurse')?.id ?? null
  const [examinerHere, setExaminerHere] = useState(false)
  // A new run (Run again, or a fresh station) starts the examiner back at their desk.
  const runSeed = usePlay((s) => s.seed)
  useEffect(() => {
    announcedDone.current = false
    endCalled.current = false
    autoOpened.current = new Set()
    setReadyAsked(false)
    setWalks([])
    examinerWalk.current = null
    setErrand(null)
    setApproaching(false)
    setExaminerHere(false)
  }, [runSeed, pack.packId])
  const [typing, setTyping] = useState(false)
  const [facingId, setFacingId] = useState<string | null>(null)
  const bootEnded = useRef<string | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __osce: { play: usePlay, press } })
  }, [])

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
    const id = window.setInterval(() => store().tick(), 1000)
    return () => window.clearInterval(id)
  }, [hydrated, entered, ended, store])

  const firstToast = toasts[0]
  useEffect(() => {
    if (!firstToast) return
    sfx.mark()
    const id = window.setTimeout(() => store().dismissToast(firstToast.token), 2600)
    return () => window.clearTimeout(id)
  }, [firstToast?.token, store])

  const progress = stepsDone(pack, spent)
  // Practice mode: the current phase of the perfect script, until the examiner takes over.
  const phase = currentPhase(pack, spent)
  const objective = objectives && entered && !ended && phase ? phase : null
  const allDone = progress.total > 0 && progress.done === progress.total
  useEffect(() => {
    if (!hydrated || !entered || ended || !allDone || announcedDone.current) return
    announcedDone.current = true
    // Let the last reply finish before the examiner speaks.
    const id = window.setTimeout(() => {
      sfx.mark()
      store().note("Thank you, that's the station. Walk out of the door, or tap FINISH, when you're ready for the debrief.", 'say', 'examiner')
    }, 1800)
    return () => window.clearTimeout(id)
  }, [hydrated, entered, ended, allDone, store])

  const used = (a: Action) => (spent[a.id]?.length ?? 0) > 0
  const endStarted = endQueue.some(used)
  const beforeEnd = stepsDone({ ...pack, goldPath: pack.goldPath.filter((id) => !endIds.includes(id)) }, spent)
  const readyForEnd = beforeEnd.done === beforeEnd.total
  const timeShort = entered && secondsLeft <= 90
  const idleNow = overlay === null && performing === null && menu === false

  // Call the examiner over: the rest is done, the candidate says so, or time is nearly up.
  useEffect(() => {
    if (!hydrated || !entered || ended || !examinerId || endStarted || endCalled.current || !idleNow) return
    if (!readyForEnd && !timeShort && !readyAsked) return
    // Let the last reply land before the examiner moves.
    const id = window.setTimeout(() => {
      endCalled.current = true
      setApproaching(true)
      if (!readyForEnd && !readyAsked) store().note("We're nearly out of time. Let me stop you there.", 'say', examinerId)
      const token = Date.now()
      examinerWalk.current = token
      setWalks((cur) => [...cur, { token, npcId: examinerId, stops: ['@player'] }])
    }, readyAsked ? 900 : 1200)
    return () => window.clearTimeout(id)
  }, [hydrated, entered, ended, examinerId, endStarted, idleNow, readyForEnd, timeShort, readyAsked, store])

  // Beside the candidate, the examiner prompts each end step in turn: what they say, then the step opens.
  useEffect(() => {
    if (!examinerHere || !examinerId || ended || !idleNow) return
    const next = endQueue.find((a) => !used(a) && !autoOpened.current.has(a.id))
    if (!next) return
    const first = !endQueue.some((a) => autoOpened.current.has(a.id))
    const line = next.ask ?? (first ? 'Thank you. I have a few questions for you.' : 'Now a few questions.')
    const id = window.setTimeout(() => {
      autoOpened.current.add(next.id)
      store().note(line, 'say', examinerId)
      window.setTimeout(() => store().openAction(next.id, examinerId), 1100)
    }, 700)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examinerHere, examinerId, ended, idleNow, spent])

  // The nurse takes the next job: to the cart or trolley, to the patient, and back to their spot.
  useEffect(() => {
    if (!hydrated || !entered || ended || errand || !errands.length) return
    const job = errands[0]
    const has = (id: string) => pack.room.interactables.some((i) => i.id === id)
    const source = has(job.from) ? job.from : has('trolley') ? 'trolley' : has('cart') ? 'cart' : null
    const patient = pack.cast.some((c) => c.id === 'patient') ? 'patient' : has('bed-ix') ? 'bed-ix' : null
    if (!nurseId || !patient) {
      store().takeErrand(job.token)
      return
    }
    const token = Date.now() + job.token
    setErrand({ job, walk: token })
    setWalks((cur) => [...cur, { token, npcId: nurseId, stops: [...(source ? [source] : []), patient, '@home'] }])
  }, [hydrated, entered, ended, errand, errands, nurseId, pack, store])

  const paused = overlay !== null || performing !== null || menu !== false || approaching

  useButtons(0, hydrated && !ended && !paused, (btn) => {
    if (btn === 'a') {
      if (textBox.current?.advance() !== 'none') return
      screen.current?.useFacing()
      return
    }
    if (btn === 'b') {
      textBox.current?.advance()
      return
    }
    if (btn === 'start') {
      sfx.select()
      setMenu('root')
      return
    }
    if (btn === 'select') {
      sfx.cursor()
      useSettings.getState().toggleLabels()
    }
  })

  if (!hydrated) {
    return (
      <div className="device items-center justify-center">
        <p className="font-pixel text-[10px] text-[#181820]">Opening the bay…</p>
      </div>
    )
  }

  if (ended === 'complete') {
    return <EndedScreen pack={pack} onDebrief={() => void navigate({ to: '/debrief/$packId', params: { packId: pack.packId } })} onAgain={() => store().rerun(pack)} />
  }

  const clockTone = !entered ? '' : secondsLeft > 60 ? '' : secondsLeft > 20 ? 'hud-warn' : 'hud-alarm'
  const monitor = pack.room.props.find((prop) => prop.readout)
  const live = pack.vitals ? vitalsAt(pack.vitals, sceneAt ?? {}, elapsedOf(pack, { secondsLeft, entered })) : null
  const readout = live ? vitalsLine(live) : monitor ? readoutText(monitor.readout, scene ?? []) : null
  const monitorBpm = live ? (hasOutput(live) ? Math.round(live.hr ?? 80) : 0) : undefined
  const speakerName = msg?.speakerId ? (msg.speakerId === 'player' ? 'YOU' : targetName(pack, msg.speakerId)) : msg?.tone === 'trap' ? 'NO MARK' : null
  const facingNpc = facingId ? pack.cast.some((npc) => npc.id === facingId) : false
  const idle = !entered
    ? 'Read the door note, then enter.'
    : facingId
      ? `A ▶ ${facingNpc ? 'Talk to' : 'Use'} ${targetName(pack, facingId)}`
      : 'D-pad walks. Tap a spot to walk there. A uses what you face. START for the menu.'

  return (
    <div className="device" data-testid="play">
      <div className="bezel">
        <div className="screen">
          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* In the flow above the map, so it never covers the room; the HUD sits over its top margin. */}
            {objective && (
              <div className="objective" data-testid="objective" aria-live="polite">
                <b>
                  {objective.index + 1}/{objective.total} {objective.title.toUpperCase()}
                </b>
                <span>{objective.goal}</span>
              </div>
            )}
            <Screen
              key={`${pack.packId}:${runSeed}`}
              ref={screen}
              pack={pack}
              position={position}
              paused={paused || !entered}
              talkingId={typing ? (msg?.speakerId ?? null) : null}
              scene={scene ?? []}
              labels={labels}
              monitorBpm={monitorBpm}
              walks={walks}
              onWalkStop={(token, index, npcId) => {
                // The nurse reports at the bedside: the stop before going home.
                if (!errand || token !== errand.walk) return
                const stops = walks.find((w) => w.token === token)?.stops ?? []
                if (index !== stops.length - 2) return
                store().note(nurseReport(errand.job), 'say', npcId)
              }}
              onWalkDone={(token) => {
                if (token === examinerWalk.current) {
                  setApproaching(false)
                  setExaminerHere(true)
                }
                if (errand && token === errand.walk) {
                  store().takeErrand(errand.job.token)
                  setErrand(null)
                }
                setWalks((cur) => cur.filter((w) => w.token !== token))
              }}
              onMove={(pos) => {
                const cur = store().position
                store().setPosition(pos)
                if ((cur.x !== pos.x || cur.y !== pos.y) && store().msg && !textBox.current?.typing()) store().clearMsg()
              }}
              onUse={(targetId) => {
                sfx.select()
                // The door is the way out: it asks whether to hand over and end the station.
                if (targetId === 'door' && entered && !pack.actions.some((a) => a.targetIds.includes('door'))) {
                  setMenu('leave')
                  return
                }
                // Before the end, the examiner's own steps stay closed: walking up early gets "carry on".
                if (targetId === examinerId && !endStarted && !endCalled.current) {
                  const other = pack.actions.some((a) => !endIds.includes(a.id) && a.targetIds.includes(targetId))
                  if (!other) {
                    store().note("Carry on with the station. I'll come to you at the end.", 'say', examinerId)
                    return
                  }
                  store().openTarget(pack, targetId, endIds)
                  return
                }
                store().openTarget(pack, targetId)
              }}
              onEmpty={() => store().note('Nothing to use there.')}
              onFacing={setFacingId}
              onBump={() => sfx.bump()}
            />
            <div className="hud" data-testid="hud">
              <span className={`hud-chip ${clockTone}`} data-testid="hud-clock">
                ⏱{formatClock(secondsLeft)}
              </span>
              {readout && (
                <span className="hud-chip hud-readout" data-testid="hud-readout">
                  ♥ {readout}
                </span>
              )}
              <span className="hud-chip" data-testid="hud-count">
                ★{earnedMarks.length}/{pack.marks.length}
              </span>
            </div>
            {allDone && entered && !overlay && !performing && menu === false && (
              <button
                type="button"
                className="done-bar"
                data-testid="station-done"
                onClick={() => {
                  sfx.select()
                  store().leave()
                }}
              >
                ✓ STATION DONE · FINISH ▶
              </button>
            )}
            {firstToast && (
              <div className="toast" key={firstToast.token} data-testid="toast">
                <span className="toast-tag">MARK! {firstToast.id}</span>
                <span>{firstToast.text}</span>
              </div>
            )}
            {overlay && (
              <OverlaySheet
                pack={pack}
                overlay={overlay}
                inventory={inventory}
                spent={spent}
                entered={entered}
                onClose={() => store().closeOverlay()}
                onEnter={() => {
                  sfx.door()
                  store().enterRoom()
                }}
                onAction={(actionId, targetId) => store().openAction(actionId, targetId)}
                onOption={(actionId, optionId) => store().pickOption(pack, actionId, optionId)}
                onConfirm={(actionId, optionIds) => store().confirmOptions(pack, actionId, optionIds)}
                onFinding={(actionId, findingId) => store().pickFinding(pack, actionId, findingId)}
                onRegion={(actionId, regionId) => store().pickRegion(pack, actionId, regionId)}
              />
            )}
            {menu && (
              <StartMenu
                pack={pack}
                inventory={inventory}
                earnedMarks={earnedMarks}
                initialPage={menu}
                stepsLeft={progress.left}
                onReady={
                  endQueue.length > 0 && entered && !endStarted && !endCalled.current
                    ? () => {
                        setMenu(false)
                        store().note("I've finished.", 'say', 'player')
                        setReadyAsked(true)
                      }
                    : undefined
                }
                onClose={() => setMenu(false)}
                onNotes={() => {
                  setMenu(false)
                  store().showStem()
                }}
                onHint={() => {
                  setMenu(false)
                  store().note(`HINT: ${hintFor(pack, earnedMarks)}`)
                }}
                onLeave={() => {
                  setMenu(false)
                  store().leave()
                }}
              />
            )}
          </div>
          <TextBox
            ref={textBox}
            msg={msg}
            speaker={speakerName}
            idle={idle}
            onClose={() => store().clearMsg()}
            onTyping={setTyping}
          />
          {performing && (
            <PerformStage
              key={`${performing.actionId}-${performing.spendId}`}
              job={performing}
              seed={usePlay.getState().seed}
              onDone={(result) => store().finishPerform(pack, result)}
              onCancel={() => store().cancelPerform()}
            />
          )}
        </div>
        <p className="bezel-label">
          OSCE GYM <span>·</span> <b>{pack.title.toUpperCase()}</b>
        </p>
      </div>
      {!performing && <Controller />}
      <p className="keys-help">Arrows/WASD move · Z/Enter = A · X/Esc = B · M = START · Shift = SELECT</p>
    </div>
  )
}

/** What the nurse says at the bedside: the item, trimmed to its first clause, and what was done with it. */
function nurseReport(job: Errand) {
  const short = (label: string) => {
    const cut = label.split(/ — |; |, then | \(|: | over | as an | if /)[0].trim()
    return cut.length > 60 ? `${cut.slice(0, 57).trimEnd()}…` : cut
  }
  const items = job.items.map(short)
  const list = items.length > 2 ? `${items.slice(0, 2).join(', ')} and ${items.length - 2} more` : items.join(' and ')
  return job.from === 'cart' ? `${list} — given.` : `${list} — done.`
}

function EndedScreen({ pack, onDebrief, onAgain }: { pack: Pack; onDebrief: () => void; onAgain: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useCursor(root, { priority: 10 })
  const earned = usePlay((s) => s.earnedMarks)
  return (
    <div className="page" ref={root}>
      <Win title="STATION COMPLETE" className="w-full">
        <p className="sheet-text">{pack.title}</p>
        <p className="sheet-meta">
          ★ {earned.length}/{pack.marks.length} marks on the sheet
        </p>
        <NavItem onClick={onDebrief}>Open debrief</NavItem>
        <NavItem testId="run-again" onClick={onAgain}>
          Run again
        </NavItem>
      </Win>
    </div>
  )
}
