import { useRef, useState } from 'react'
import { examinerClause, itemLabel } from '~/engine/judge'
import type { Pack } from '~/engine/schema'
import { removeCustomModel, saveCustomModel } from './positional/customModel'
import type { AvatarId } from './positional/scene3d'
import { useSettings } from './settings'
import { NavItem, Win, useCursor } from './ui'

type Page = 'root' | 'bag' | 'marks' | 'leave' | 'patient' | 'settings' | 'restart'

/**
 * Gold START menu, in three groups: the station (bag, notes, hint, marks); who plays the 3D patient, and the settings;
 * restart, leave, close.
 */
export function StartMenu({
  pack,
  inventory,
  earnedMarks,
  initialPage = 'root',
  stepsLeft = [],
  onReady,
  onClose,
  onNotes,
  onHint,
  onRestart,
  onLeave,
}: {
  pack: Pack
  inventory: string[]
  earnedMarks: string[]
  /** 'leave' when opened from the door. */
  initialPage?: Page
  /** Steps not done yet, named on the hand-over question. */
  stepsLeft?: string[]
  /** Tell the examiner you have finished: they come over and ask their questions. Absent once asked. */
  onReady?: () => void
  onClose: () => void
  onNotes: () => void
  onHint: () => void
  /** Start the station again from the door: a fresh clock and no marks. */
  onRestart: () => void
  onLeave: () => void
}) {
  const [page, setPage] = useState<Page>(initialPage)
  const root = useRef<HTMLDivElement>(null)
  const sound = useSettings((s) => s.sound)
  const labels = useSettings((s) => s.labels)
  const toggleSound = useSettings((s) => s.toggleSound)
  const toggleLabels = useSettings((s) => s.toggleLabels)
  const patientLang = useSettings((s) => s.patientLang)
  const toggleLang = useSettings((s) => s.toggleLang)
  const coach = useSettings((s) => s.coach)
  const difficulty = useSettings((s) => s.difficulty)
  const toggleDifficulty = useSettings((s) => s.toggleDifficulty)
  const cycleCoach = useSettings((s) => s.cycleCoach)
  const patientModel = useSettings((s) => s.patientModel)
  const customModelName = useSettings((s) => s.customModelName)
  const setPatientModel = useSettings((s) => s.setPatientModel)
  const file = useRef<HTMLInputElement>(null)
  const [modelNote, setModelNote] = useState<string | null>(null)
  const cursor = useCursor(root, {
    priority: 20,
    onBack: () => {
      if (page === 'root' || page === initialPage) onClose()
      else go('root')
    },
  })

  function go(next: Page) {
    setPage(next)
    window.requestAnimationFrame(() => cursor.reset())
  }

  /** The player's own VRM: checked, then kept in this browser only. */
  async function loadMine(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    setModelNote('Reading your model…')
    try {
      const model = await saveCustomModel(chosen)
      setPatientModel('custom', model.name)
      setModelNote(`${model.name} now plays the patient.`)
    } catch (error) {
      setModelNote(error instanceof Error ? error.message : 'That model could not be read.')
    }
  }

  async function removeMine() {
    await removeCustomModel()
    setPatientModel(patientModel === 'custom' ? 'realistic' : patientModel, null)
    setModelNote('Your model is gone from this device.')
  }

  const modelItem = (id: AvatarId, label: string) => (
    <NavItem testId={`model-${id}`} tone={patientModel === id ? 'done' : undefined} onClick={() => (setPatientModel(id), setModelNote(null))}>
      {label}
      {patientModel === id ? ' ◀' : ''}
    </NavItem>
  )

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/20 p-2" data-testid="start-menu" onClick={onClose}>
      <div ref={root} className="flex max-h-full min-w-0 flex-col" onClick={(event) => event.stopPropagation()}>
        {page === 'root' && (
          <Win className="menu-col w-[188px]">
            {onReady && (
              <NavItem testId="menu-ready" onClick={onReady}>
                READY FOR QUESTIONS
              </NavItem>
            )}
            <NavItem testId="menu-bag" onClick={() => go('bag')}>BAG</NavItem>
            <NavItem testId="hud-stem" onClick={onNotes}>NOTES</NavItem>
            <NavItem testId="hud-hint" onClick={onHint}>HINT</NavItem>
            <NavItem testId="menu-marks" onClick={() => go('marks')}>
              MARKS {earnedMarks.length}/{pack.marks.length}
            </NavItem>
            <div className="nav-gap" />
            <NavItem testId="menu-patient-model" onClick={() => go('patient')}>
              3D PATIENT: {patientModel === 'custom' ? 'MINE' : patientModel === 'anime' ? 'ANIME' : 'REALISTIC'}
            </NavItem>
            <NavItem testId="menu-settings" onClick={() => go('settings')}>SETTINGS</NavItem>
            <div className="nav-gap" />
            <NavItem testId="menu-restart" onClick={() => go('restart')}>RESTART STATION</NavItem>
            <NavItem testId="hud-leave" onClick={() => go('leave')}>LEAVE STATION</NavItem>
            <NavItem testId="menu-exit" onClick={onClose}>CLOSE</NavItem>
          </Win>
        )}
        {page === 'bag' && (
          <Win title="BAG" className="menu-col w-[260px] max-w-full overflow-auto">
            {inventory.length === 0 && <p className="menu-note">Empty hands. Pick kit up from a trolley or shelf.</p>}
            {inventory.map((id) => (
              <p key={id} className="menu-note">• {itemLabel(pack, id)}</p>
            ))}
            <NavItem onClick={() => go('root')}>BACK</NavItem>
          </Win>
        )}
        {page === 'marks' && (
          <Win title={`MARKS ${earnedMarks.length}/${pack.marks.length}`} className="menu-col w-[300px] max-w-full overflow-auto">
            {earnedMarks.length === 0 && <p className="menu-note">No marks yet.</p>}
            {pack.marks
              .filter((mark) => earnedMarks.includes(mark.id))
              .map((mark) => (
                <p key={mark.id} className="menu-note">
                  <b>{mark.id}</b> {examinerClause(mark.label)}
                </p>
              ))}
            <NavItem onClick={() => go('root')}>BACK</NavItem>
          </Win>
        )}
        {page === 'patient' && (
          <Win title="3D PATIENT" className="menu-col w-[260px] max-w-full overflow-auto">
            <p className="menu-note">Who plays the patient in the 3D procedures.</p>
            {modelItem('realistic', 'REALISTIC')}
            {modelItem('anime', 'ANIME')}
            {customModelName && modelItem('custom', `MINE: ${customModelName.toUpperCase()}`)}
            <NavItem testId="model-load" onClick={() => file.current?.click()}>
              {customModelName ? 'LOAD ANOTHER OF MINE…' : 'LOAD MY OWN MODEL…'}
            </NavItem>
            {customModelName && (
              <NavItem testId="model-remove" onClick={removeMine}>
                REMOVE MINE
              </NavItem>
            )}
            <p className="menu-note">Your own model (.vrm, or a VRoid .xroid) stays in this browser on this device. It is never uploaded.</p>
            {modelNote && (
              <p className="menu-note" data-testid="model-note">
                {modelNote}
              </p>
            )}
            <input ref={file} type="file" accept=".vrm,.xroid,.glb" hidden data-testid="model-file" onChange={loadMine} />
            <NavItem onClick={() => go('root')}>BACK</NavItem>
          </Win>
        )}
        {page === 'settings' && (
          <Win title="SETTINGS" className="menu-col w-[220px] max-w-full">
            <NavItem testId="menu-sound" onClick={toggleSound}>SOUND: {sound ? 'ON' : 'OFF'}</NavItem>
            {pack.events?.some((e) => e.level) && (
              <NavItem testId="menu-difficulty" onClick={toggleDifficulty}>
                DIFFICULTY: {difficulty === 'hard' ? 'HARD' : 'NORMAL'}
              </NavItem>
            )}
            <NavItem testId="menu-coach" onClick={cycleCoach}>
              COACH: {coach === 'guided' ? 'GUIDED' : coach === 'objectives' ? 'OBJECTIVES' : 'OFF'}
            </NavItem>
            <p className="menu-note">Guided shows the step and what to do next; objectives, the step only; off, like the exam.</p>
            <NavItem testId="menu-names" onClick={toggleLabels}>NAME TAGS: {labels ? 'ON' : 'OFF'}</NavItem>
            <NavItem testId="menu-lang" onClick={toggleLang}>PATIENT SPEAKS: {patientLang === 'zh' ? '中文' : 'ENGLISH'}</NavItem>
            <NavItem onClick={() => go('root')}>BACK</NavItem>
          </Win>
        )}
        {page === 'restart' && (
          <Win title="Restart this station?" className="menu-col w-[240px]">
            <p className="menu-note">The clock, your marks and everything done so far are reset. You start again at the door.</p>
            <NavItem testId="restart-yes" onClick={onRestart}>YES, RESTART</NavItem>
            <NavItem testId="restart-no" onClick={() => go('root')}>NO</NavItem>
          </Win>
        )}
        {page === 'leave' && (
          <Win title="Hand over and end the station?" className="menu-col w-[240px]">
            {stepsLeft.length > 0 ? (
              <p className="menu-note" data-testid="leave-left">
                Not done yet: {stepsLeft.join(', ')}.
              </p>
            ) : (
              <p className="menu-note">Every step is done. The debrief is next.</p>
            )}
            <NavItem testId="leave-yes" onClick={onLeave}>YES, HAND OVER</NavItem>
            <NavItem testId="leave-no" onClick={() => (initialPage === 'leave' ? onClose() : go('root'))}>NOT YET</NavItem>
          </Win>
        )}
      </div>
    </div>
  )
}
