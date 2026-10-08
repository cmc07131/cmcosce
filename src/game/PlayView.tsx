import { useNavigate } from '@tanstack/react-router'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { localizePack } from '~/engine/lang'
import { currentPhase, dueEvents, eventOngoing, hintFor, nextHint, nextWaitedEvent, stepsDone } from '~/engine/judge'
import { readoutText, type Action, type Pack } from '~/engine/schema'
import { hasOutput, monitored, vitalsAt, vitalsLine } from '~/engine/vitals'
import { Controller } from './Controller'
import { press, useButtons } from './input'
import { OverlaySheet, targetName } from './Overlay'
import { examIn3d } from './exam3d/model'
import { PerformStage } from './Perform'

/** The physical examination on a 3D patient (three.js): loaded only when a station's exam is written for it. */
const Exam3D = lazy(() => import('./exam3d/Exam3D'))
import { Screen, type ScreenHandle, type Walk } from './Screen'
import { isReviewed } from '~/world/reviewed'
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
  const skipS = usePlay((s) => s.skipS)
  const store = usePlay.getState
  /** The clinical clock is running ahead to the next timed moment. */
  const [fastForward, setFastForward] = useState(false)
  const labels = useSettings((s) => s.labels)
  const coach = useSettings((s) => s.coach)
  const difficulty = useSettings((s) => s.difficulty)
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
  /** How many of an end step's lines were used when the examiner last opened it. */
  const openedWith = useRef(new Map<string, number>())
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
    openedWith.current = new Map()
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
    if (import.meta.env.DEV) Object.assign(window, { __osce: { play: usePlay, press, pack, endIds, hint: () => nextHint(pack, usePlay.getState().spent, usePlay.getState().scene ?? []) } })
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

  const progress = stepsDone(pack, spent, scene ?? [])
  // Practice mode: the current phase of the perfect script, until the examiner takes over; guided adds the next action.
  const coaching = coach !== 'off' && entered && !ended
  const objective = coaching ? currentPhase(pack, spent, scene ?? []) : null
  const next = coaching && coach === 'guided' ? nextHint(pack, spent, scene ?? []) : null
  const guideTarget = next?.kind === 'do' ? next.targetId : null

  // The case changes by itself: a seizure, VT. Timers, not animation frames (a hidden pane pauses those).
  useEffect(() => {
    if (!hydrated || !entered || ended || !pack.events?.length) return
    const id = window.setInterval(() => {
      const cur = store()
      for (const ev of dueEvents(pack, cur.scene ?? [], cur.sceneAt ?? {}, elapsedOf(pack, cur), difficulty)) cur.fireEvent(pack, ev.id)
      // Everything due now is done and the next step waits on time (the 2-minute rhythm check): the clinical clock
      // runs ahead to it, about 30 clinical seconds per tick, instead of making the candidate wait it out.
      const idle = !cur.performing && !cur.errands.length && nextHint(pack, cur.spent, cur.scene ?? [])?.kind === 'wait'
      const next = idle ? nextWaitedEvent(pack, cur.spent, cur.scene ?? [], cur.sceneAt ?? {}, difficulty) : null
      const gap = next ? next.dueAt - elapsedOf(pack, cur) : 0
      if (gap > 0) cur.skipAhead(Math.min(gap, 30))
      setFastForward(gap > 0)
    }, 500)
    return () => window.clearInterval(id)
  }, [hydrated, entered, ended, pack, store, difficulty])
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
  const beforeEnd = stepsDone({ ...pack, goldPath: pack.goldPath.filter((id) => !endIds.includes(id)) }, spent, scene ?? [])
  // The examiner comes when the case is really finished: nothing left in the script that can be done now, the nurse
  // has nothing in hand, and nothing is still happening to the patient. (Stations without phases: every step used.)
  const leftNow = nextHint(pack, spent, scene ?? [])
  const readyForEnd = pack.phases?.length
    ? leftNow?.kind !== 'do' && errands.length === 0 && !eventOngoing(pack, scene ?? [])
    : beforeEnd.done === beforeEnd.total
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
    // A prompted step stays with the examiner until every line of it is said: each pick closes the list, so they open
    // it again (without repeating the question) as long as the last opening got an answer.
    const said = (a: Action) => spent[a.id]?.length ?? 0
    const allSaid = (a: Action) => (a.options ?? []).filter((o) => !o.isTrap && o.marksChecklistIds?.length).every((o) => spent[a.id]?.includes(o.id))
    const next = endQueue.find((a) =>
      !autoOpened.current.has(a.id) ? !used(a) || (a.kind !== 'viva' && !allSaid(a)) : a.kind !== 'viva' && !allSaid(a) && said(a) > (openedWith.current.get(a.id) ?? 0),
    )
    if (!next) return
    const again = autoOpened.current.has(next.id)
    const first = !endQueue.some((a) => autoOpened.current.has(a.id))
    const line = next.ask ?? (first ? 'Thank you. I have a few questions for you.' : 'Now a few questions.')
    const id = window.setTimeout(() => {
      autoOpened.current.add(next.id)
      openedWith.current.set(next.id, said(next))
      if (!again) store().note(line, 'say', examinerId)
      window.setTimeout(() => store().openAction(next.id, examinerId), again ? 400 : 1100)
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
    // A wrong drug or item: the nurse will not fetch it. She comes to you instead.
    const stops = job.kind === 'refuse' ? ['@player', '@home'] : [...(source ? [source] : []), patient, '@home']
    setWalks((cur) => [...cur, { token, npcId: nurseId, stops }])
  }, [hydrated, entered, ended, errand, errands, nurseId, pack, store])

  const paused = overlay !== null || performing !== null || menu !== false || approaching
  const overlayAction = overlay?.kind === 'action' ? pack.actions.find((a) => a.id === overlay.actionId) : undefined
  const exam3d = examIn3d(overlayAction) ? overlayAction : undefined

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
  const leadsOn = monitored(pack.vitals, scene ?? [])
  const live = pack.vitals ? vitalsAt(pack.vitals, sceneAt ?? {}, elapsedOf(pack, { secondsLeft, entered, skipS })) : null
  const readout = live ? (leadsOn ? vitalsLine(live) : 'NO LEADS') : monitor ? readoutText(monitor.readout, scene ?? []) : null
  const monitorBpm = live && leadsOn ? (hasOutput(live) ? Math.round(live.hr ?? 80) : 0) : undefined
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
            {(objective || next) && (
              <div className="objective" data-testid="objective" aria-live="polite">
                {objective && (
                  <div className="objective-card">
                    <div className="objective-head">
                      <b>
                        STEP {objective.index + 1}/{objective.total}
                      </b>
                      <span className="objective-title">{objective.title.toUpperCase()}</span>
                      <span className="objective-pips" aria-hidden="true">
                        {Array.from({ length: objective.total }, (_, i) => (
                          <i key={i} data-on={i <= objective.index || undefined} />
                        ))}
                      </span>
                    </div>
                    <p className="objective-goal">{objective.goal}</p>
                  </div>
                )}
                {next && (
                  <div className="objective-next" data-testid="guide-next">
                    <b>NEXT</b>
                    <span>
                      {next.kind === 'do' ? (
                        <>
                          <em>{targetName(pack, next.targetId)}:</em> {next.option}
                        </>
                      ) : (
                        'Watch the patient and the monitor.'
                      )}
                    </span>
                  </div>
                )}
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
              monitorOff={!leadsOn}
              guideTarget={overlay ? null : guideTarget}
              walks={walks}
              onWalkStop={(token, index, npcId) => {
                // The nurse reports at the bedside: the stop before going home.
                if (!errand || token !== errand.walk) return
                const stops = walks.find((w) => w.token === token)?.stops ?? []
                if (index !== stops.length - 2) return
                if (errand.job.kind === 'refuse') {
                  screen.current?.slap(npcId)
                  sfx.bump()
                  store().note(refusal(errand.job.items[0] ?? ''), 'say', npcId)
                  return
                }
                store().deliverErrand(pack, errand.job.token)
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
              {pack.clock && entered && (
                <span className="hud-chip hud-case-clock" data-running={fastForward || undefined} data-testid="hud-case-clock">
                  {pack.clock} {formatClock(elapsedOf(pack, { secondsLeft, entered, skipS }))}
                  {fastForward ? ' ⏩' : ''}
                </span>
              )}
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
                onRestart={() => {
                  setMenu(false)
                  store().rerun(pack)
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
          {exam3d && overlay?.kind === 'action' && (
            <Suspense fallback={<p className="absolute inset-0 z-40 grid place-items-center bg-[#f4f1e8] font-[Press_Start_2P,monospace] text-[8px]">Setting up the couch…</p>}>
              <Exam3D
                pack={pack}
                action={exam3d}
                title={targetName(pack, overlay.targetId)}
                spent={spent[exam3d.id] ?? []}
                onClose={() => store().closeOverlay()}
                onOption={(optionId) => store().pickOption(pack, exam3d.id, optionId)}
              />
            </Suspense>
          )}
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
          {isReviewed(pack.packId) && <span className="reviewed-tag">REVIEWED</span>}
        </p>
      </div>
      {!performing && !exam3d && <Controller />}
      <p className="keys-help">Arrows/WASD move · Z/Enter = A · X/Esc = B · M = START · Shift = SELECT</p>
    </div>
  )
}

const REFUSALS = ['Not on my watch, doctor!', 'Are you trying to kill her?', 'Doctor. No.', 'I am not giving that. Think again!']

/** The nurse, after the slap: a line that names the item she would not fetch. */
function refusal(item: string) {
  const short = item.split(/ — |; |, | \(|: | for | in case | to /)[0].trim()
  return `${REFUSALS[Math.floor(Math.random() * REFUSALS.length)]} No ${short.charAt(0).toLowerCase()}${short.slice(1)}.`
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
