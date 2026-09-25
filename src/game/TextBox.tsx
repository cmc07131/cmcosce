import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { sfx } from './sfx'
import type { Msg } from './store'

export type TextBoxHandle = {
  /** A/B on the text box: finish typing, or close a finished line. */
  advance: () => 'skipped' | 'closed' | 'none'
  typing: () => boolean
}

const CHAR_MS = 18

/** Gold-style dialogue box. Types the line out, blinks ▼ when done. */
export const TextBox = forwardRef<
  TextBoxHandle,
  { msg: Msg | null; speaker: string | null; idle: ReactNode; onClose: () => void; onTyping: (typing: boolean) => void }
>(function TextBox({ msg, speaker, idle, onClose, onTyping }, ref) {
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)
  const full = msg?.text.length ?? 0
  const body = useRef<HTMLDivElement>(null)
  const caret = useRef<HTMLSpanElement>(null)
  const typingCb = useRef(onTyping)
  typingCb.current = onTyping

  useEffect(() => {
    shownRef.current = 0
    setShown(0)
    if (!msg) {
      typingCb.current(false)
      return
    }
    if (msg.tone === 'trap') sfx.trap()
    else if (msg.tone === 'warn') sfx.bump()
    typingCb.current(true)
    const id = window.setInterval(() => {
      shownRef.current = Math.min(msg.text.length, shownRef.current + 1)
      setShown(shownRef.current)
      if (msg.text[shownRef.current - 1] !== ' ') sfx.blip()
      if (shownRef.current >= msg.text.length) {
        window.clearInterval(id)
        typingCb.current(false)
      }
    }, CHAR_MS)
    return () => window.clearInterval(id)
  }, [msg?.token])

  // Keep the line being typed in view. The untyped rest is laid out invisibly so words never jump lines.
  useEffect(() => {
    const el = body.current
    const mark = caret.current
    if (!el || !mark) return
    const lineBottom = mark.offsetTop + (parseFloat(getComputedStyle(el).lineHeight) || 19)
    if (lineBottom > el.scrollTop + el.clientHeight) el.scrollTop = lineBottom - el.clientHeight
    if (shown === 0) el.scrollTop = 0
  }, [shown])

  function advance(): 'skipped' | 'closed' | 'none' {
    if (!msg) return 'none'
    if (shownRef.current < full) {
      shownRef.current = full
      setShown(full)
      typingCb.current(false)
      return 'skipped'
    }
    onClose()
    return 'closed'
  }

  useImperativeHandle(ref, () => ({ advance, typing: () => Boolean(msg) && shownRef.current < full }))

  const done = msg && shown >= full
  return (
    <div
      className="textbox"
      data-tone={msg?.tone}
      data-testid="speech"
      onClick={() => {
        if (msg) advance()
      }}
    >
      {msg && speaker && <span className="textbox-name">{speaker}</span>}
      <div ref={body} className="textbox-body">
        {msg ? (
          <>
            {msg.text.slice(0, shown)}
            <span ref={caret} />
            <span className="invisible">{msg.text.slice(shown)}</span>
          </>
        ) : (
          <span className="textbox-idle">{idle}</span>
        )}
      </div>
      {done && <span className="textbox-more">▼</span>}
    </div>
  )
})
