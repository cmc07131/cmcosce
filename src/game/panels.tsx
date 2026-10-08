import { useEffect, useMemo, useRef, useState } from 'react'
import type { Action, ActionOption, Pack } from '~/engine/schema'
import { hasOutput, monitored, vitalsAt, vitalsLine } from '~/engine/vitals'
import { CutIn, cutInKinds, cutInMs, type CutInKind } from './CutIn'
import { ecgById } from './ecg/atlas'
import { beats, sample } from './ecg/model'
import { Film, FilmButton } from './imaging/Film'
import { elapsedOf, indicated, usePlay } from './store'
import { NavItem, Win } from './ui'

/** Same order every time for one run, different between runs: the right answer is never always first. */
export function seededShuffle<T>(list: T[], seed: number, salt: string): T[] {
  let h = seed ^ 0x9e3779b9
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x5bd1e995)
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
    h ^= h >>> 15
    return (h >>> 0) / 4294967296
  }
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The reply without its "Speaker:" prefix, for showing under the question. */
function replyText(option: ActionOption) {
  return (option.detail ?? '').replace(/^[^:]{1,24}:\s*/, '')
}

type PanelProps = {
  pack: Pack
  action: Action
  title: string
  spent: string[]
  onClose?: () => void
  onOption: (optionId: string) => void
}

/**
 * History, examination and investigations: sections you can move between freely, each question or
 * manoeuvre asked once. The answer stays under it, like notes, so the summary can be built from them.
 */
export function GroupPanel({ action, title, spent, onClose, onOption }: PanelProps) {
  const groups = useMemo(() => [...new Set((action.options ?? []).map((o) => o.group ?? ''))], [action])
  const [tab, setTab] = useState(groups[0] ?? '')
  const [film, setFilm] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ id: string; kind: CutInKind; finding?: string } | null>(null)
  const used = new Set(spent)
  const rows = (action.options ?? []).filter((o) => (o.group ?? '') === tab)
  // Hands on first: the close-up plays, then the finding appears.
  const scene = usePlay((s) => s.scene)
  const examine = (o: NonNullable<typeof action.options>[number]) => {
    if (playing) return
    // Not indicated yet: refused at once, without playing the close-up.
    if (!o.anim || !indicated(o, scene ?? []) || !(cutInKinds as readonly string[]).includes(o.anim)) return onOption(o.id)
    // The close-up shows this finding: which side, how it reacts, the meter's number.
    setPlaying({ id: o.id, kind: o.anim as CutInKind, finding: replyText(o) })
    window.setTimeout(() => {
      setPlaying(null)
      onOption(o.id)
    }, cutInMs(o.anim as CutInKind))
  }
  const verb = action.kind === 'history' ? 'Ask' : action.kind === 'exam' ? 'Examine' : 'Order'
  return (
    <Win title={title} onClose={onClose} className="sheet">
      {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
      {action.img && <FilmButton src={action.img} onOpen={setFilm} />}
      <div className="tabs" role="tablist">
        {groups.map((g) => {
          const left = (action.options ?? []).filter((o) => (o.group ?? '') === g && !used.has(o.id)).length
          return (
            <button key={g} type="button" role="tab" className="tab" data-on={g === tab || undefined} data-testid={`tab-${g}`} onClick={() => setTab(g)}>
              {g || verb}
              {left === 0 && ' ✓'}
            </button>
          )
        })}
      </div>
      <div className="sheet-scroll">
        {rows.map((o) => {
          const done = used.has(o.id)
          return (
            <div key={o.id} className="qa" data-done={done || undefined}>
              <NavItem testId={`option-${action.id}-${o.id}`} tone={done ? 'done' : undefined} disabled={done} onClick={() => examine(o)}>
                <span className="check">{done ? '✓' : '▸'}</span>
                {o.label}
              </NavItem>
              {done && (
                <p className="qa-answer" data-trap={o.isTrap || undefined}>
                  {replyText(o) || '—'}
                  {o.img && <FilmButton src={o.img} onOpen={setFilm} />}
                </p>
              )}
            </div>
          )
        })}
      </div>
      {film && <Film src={film} onClose={() => setFilm(null)} />}
      {playing && <CutIn kind={playing.kind} finding={playing.finding} />}
    </Win>
  )
}

/**
 * A procedure done step by step. The steps and the decoys are shuffled; each tap does that step on the
 * patient. Doing a step before an earlier one is noted on the debrief, never blocked.
 */
export function StepsPanel({ action, title, spent, onClose, onOption }: PanelProps) {
  const seed = usePlay((s) => s.seed)
  const [film, setFilm] = useState<string | null>(null)
  const options = useMemo(() => seededShuffle(action.options ?? [], seed, action.id), [action, seed])
  const byId = new Map(options.map((o) => [o.id, o]))
  const done = spent.map((id) => byId.get(id)).filter((o): o is ActionOption => Boolean(o))
  const left = options.filter((o) => !spent.includes(o.id))
  return (
    <Win title={title} onClose={onClose} className="sheet">
      {action.prompt && <p className="sheet-prompt">{action.prompt}</p>}
      {action.img && <FilmButton src={action.img} onOpen={setFilm} />}
      {done.length > 0 && (
        <ol className="steps-done" data-testid="steps-done">
          {done.map((o) => (
            <li key={o.id} data-trap={o.isTrap || undefined}>
              {o.label}
            </li>
          ))}
        </ol>
      )}
      <p className="menu-note">Next step:</p>
      <div className="sheet-scroll">
        {left.map((o) => (
          <NavItem key={o.id} testId={`option-${action.id}-${o.id}`} onClick={() => onOption(o.id)}>
            {o.label}
          </NavItem>
        ))}
      </div>
      {film && <Film src={film} onClose={() => setFilm(null)} />}
    </Win>
  )
}

const MOOD_WORDS = ['Settled', 'Settled', 'Calmer', 'Calmer', 'Uneasy', 'Upset', 'Upset', 'Angry', 'Angry', 'Shouting', 'Walking out']
/** A learner's meter measures engagement, not anger. */
const LEARNER_WORDS = ['Engaged', 'Engaged', 'Keen', 'Keen', 'Unsure', 'Lost', 'Lost', 'Frustrated', 'Frustrated', 'Switched off', 'Switched off']

export function moodOf(action: Action, spent: string[]) {
  const picked = (action.options ?? []).filter((o) => spent.includes(o.id))
  // Answering a turn spends all its options, the one actually said first; only that one moves the mood.
  const said = new Map<string, ActionOption>()
  for (const id of spent) {
    const o = picked.find((row) => row.id === id)
    if (o && o.group && !said.has(o.group)) said.set(o.group, o)
  }
  let mood = action.startMood ?? 5
  for (const o of said.values()) mood += o.mood ?? 0
  return Math.max(0, Math.min(10, mood))
}

/**
 * A conversation (with a mood meter) or the examiner's questions: one line at a time, one reply each.
 * Replies are shuffled so position never gives the answer away.
 */
export function TurnPanel({ pack, action, title, spent, onClose, onOption }: PanelProps) {
  const seed = usePlay((s) => s.seed)
  const [film, setFilm] = useState<string | null>(null)
  const turns = action.turns ?? []
  const answered = new Set((action.options ?? []).filter((o) => spent.includes(o.id)).map((o) => o.group))
  const current = turns.find((t) => !answered.has(t.id))
  const options = useMemo(
    () => (current ? seededShuffle((action.options ?? []).filter((o) => o.group === current.id), seed, `${action.id}:${current.id}`) : []),
    [action, current, seed],
  )
  const mood = action.kind === 'dialogue' ? moodOf(action, spent) : null
  const learner = action.targetIds.some((id) => pack.cast.find((c) => c.id === id)?.role === 'junior')
  const words = learner ? LEARNER_WORDS : MOOD_WORDS
  const saidFor = (turnId: string) => {
    for (const id of spent) {
      const o = (action.options ?? []).find((row) => row.id === id && row.group === turnId)
      if (o) return o
    }
    return undefined
  }
  const last = [...turns].reverse().find((t) => answered.has(t.id))
  const lastSaid = last ? saidFor(last.id) : undefined
  return (
    <Win title={title} onClose={onClose} className="sheet">
      {mood !== null && (
        <div className="mood" data-testid="mood" aria-label={`Mood ${mood} of 10`}>
          <span className="mood-label">{words[mood]}</span>
          <span className="mood-bar">
            <span style={{ width: `${mood * 10}%` }} data-level={mood >= 7 ? 'hot' : mood >= 4 ? 'warm' : 'cool'} />
          </span>
        </div>
      )}
      <div className="sheet-scroll">
        {lastSaid && (
          <p className="turn-reply" data-trap={lastSaid.isTrap || undefined}>
            {action.kind === 'viva' ? `${lastSaid.isTrap ? '✗' : '✓'} ${lastSaid.detail ?? ''}` : lastSaid.detail}
            {lastSaid.img && <FilmButton src={lastSaid.img} onOpen={setFilm} />}
          </p>
        )}
        {current ? (
          <>
            <p className="turn-line" data-testid="turn-line">
              {action.kind === 'viva' && <b>{pack.cast.find((c) => c.id === 'examiner')?.displayName ?? 'Examiner'}: </b>}
              {current.line}
            </p>
            {options.map((o) => (
              <NavItem key={o.id} testId={`option-${action.id}-${o.id}`} onClick={() => onOption(o.id)}>
                {o.label}
              </NavItem>
            ))}
          </>
        ) : (
          <p className="menu-note">{action.kind === 'viva' ? 'No more questions.' : 'The conversation has run its course.'}</p>
        )}
      </div>
      {film && <Film src={film} onClose={() => setFilm(null)} />}
    </Win>
  )
}

/** The bedside monitor, live: a sweeping lead II from the ECG engine, pleth, and the numbers. */
export function MonitorPanel({ pack, title, onClose }: { pack: Pack; title: string; onClose?: () => void }) {
  const secondsLeft = usePlay((s) => s.secondsLeft)
  const entered = usePlay((s) => s.entered)
  const sceneAt = usePlay((s) => s.sceneAt)
  const scene = usePlay((s) => s.scene)
  const v = pack.vitals
  const now = v && monitored(v, scene ?? []) ? vitalsAt(v, sceneAt ?? {}, elapsedOf(pack, { secondsLeft, entered, skipS: usePlay.getState().skipS })) : null
  const canvas = useRef<HTMLCanvasElement>(null)
  const hr = now ? Math.round(now.hr ?? 80) : 80
  const spec = useMemo(() => (now ? ecgById(now.rhythm, hr) : null), [now?.rhythm, hr])
  const events = useMemo(() => (spec ? beats(spec, 64, 7) : []), [spec])
  const output = now ? hasOutput(now) : false

  useEffect(() => {
    const cv = canvas.current
    const c = cv?.getContext('2d')
    if (!cv || !c || !spec) return
    const W = 320
    const H = 120
    cv.width = W
    cv.height = H
    const sweepS = 4
    let raf = 0
    const t0 = performance.now()
    const draw = (ms: number) => {
      const t = ((ms - t0) / 1000) % 60
      c.fillStyle = '#081010'
      c.fillRect(0, 0, W, H)
      const cursor = Math.floor(((t % sweepS) / sweepS) * W)
      const plot = (color: string, base: number, gain: number, f: (tt: number) => number) => {
        c.strokeStyle = color
        c.lineWidth = 1.5
        c.beginPath()
        for (let x = 0; x < W; x++) {
          if (Math.abs(x - cursor) < 6) {
            c.moveTo(x + 1, base)
            continue
          }
          const age = x <= cursor ? cursor - x : cursor + W - x
          const tt = t - (age / W) * sweepS
          const y = base - f(tt < 0 ? tt + 60 : tt) * gain
          if (x === 0) c.moveTo(x, y)
          else c.lineTo(x, y)
        }
        c.stroke()
      }
      plot('#48f068', 52, 26, (tt) => sample(spec, 'II', tt, events, 7))
      if (output) {
        const period = 60 / Math.max(20, hr)
        plot('#48c8f8', 108, 14, (tt) => {
          const ph = (tt % period) / period
          return ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI * 0.5) : Math.max(0, 1 - (ph - 0.3) / 0.7) * (0.8 + 0.15 * Math.sin(ph * 14))
        })
      } else {
        c.strokeStyle = '#48c8f8'
        c.beginPath()
        c.moveTo(0, 108)
        c.lineTo(W, 108)
        c.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [spec, events, output, hr])

  if (!now) {
    return (
      <Win title={title} onClose={onClose} className="sheet">
        <p className="menu-note">{v ? 'No leads on yet. Ask the nurse to attach the monitoring.' : 'No monitor on this patient.'}</p>
      </Win>
    )
  }
  const r = (n?: number, d = 0) => (n === undefined ? '—' : n.toFixed(d))
  return (
    <Win title={title} onClose={onClose} className="sheet">
      <div className="live-monitor" data-testid="live-monitor">
        <canvas ref={canvas} className="live-trace" />
        <div className="live-nums">
          <span data-c="hr">
            HR<b>{output ? r(now.hr) : '—'}</b>
          </span>
          <span data-c="bp">
            NIBP<b>{output ? `${r(now.sbp)}/${r(now.dbp)}` : '—'}</b>
          </span>
          <span data-c="spo2">
            SpO₂<b>{output ? `${r(now.spo2)}` : '—'}</b>
          </span>
          <span data-c="rr">
            RR<b>{r(now.rr)}</b>
          </span>
          {now.etco2 !== undefined && (
            <span data-c="etco2">
              ETCO₂<b>{r(now.etco2, 1)}</b>
            </span>
          )}
          {now.temp !== undefined && (
            <span data-c="temp">
              T<b>{r(now.temp, 1)}</b>
            </span>
          )}
          {now.gcs !== undefined && (
            <span data-c="gcs">
              GCS<b>{r(now.gcs)}</b>
            </span>
          )}
          {now.glucose !== undefined && (
            <span data-c="glu">
              H'stix<b>{r(now.glucose, 1)}</b>
            </span>
          )}
        </div>
      </div>
      <p className="menu-note">{vitalsLine(now)}</p>
    </Win>
  )
}
