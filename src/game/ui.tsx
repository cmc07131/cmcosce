import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useButtons, type Btn } from './input'
import { sfx } from './sfx'

/** Gold-style window: white fill, dark double border. */
export function Win({
  title,
  children,
  className = '',
  onClose,
  testId,
}: {
  title?: string
  children: ReactNode
  className?: string
  onClose?: () => void
  testId?: string
}) {
  return (
    <div className={`win ${className}`} data-testid={testId}>
      {(title || onClose) && (
        <div className="flex items-start justify-between gap-2">
          {title && <h2 className="win-title">{title}</h2>}
          {onClose && (
            <button type="button" className="win-close" aria-label="Close" data-testid="overlay-close" onClick={onClose}>
              B✕
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

function items(root: HTMLElement | null) {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>('[data-nav]')]
}

/**
 * ▶ cursor over every `[data-nav]` element inside `root`.
 * D-pad moves it, A clicks it, B calls `onBack`. Hover and tap move it too.
 */
export function useCursor(
  root: RefObject<HTMLElement | null>,
  { priority, enabled = true, onBack }: { priority: number; enabled?: boolean; onBack?: () => void },
) {
  const index = useRef(0)

  function paint(scroll: boolean) {
    const list = items(root.current)
    if (!list.length) return
    if (index.current >= list.length) index.current = list.length - 1
    if (index.current < 0) index.current = 0
    list.forEach((el, i) => {
      if (i === index.current) el.setAttribute('data-cursor', '')
      else el.removeAttribute('data-cursor')
    })
    if (scroll) list[index.current]?.scrollIntoView({ block: 'nearest' })
  }

  useEffect(() => {
    paint(false)
  })

  useEffect(() => {
    const el = root.current
    if (!el) return
    const over = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const target = (event.target as HTMLElement).closest('[data-nav]')
      if (!target) return
      const at = items(el).indexOf(target as HTMLElement)
      if (at >= 0 && at !== index.current) {
        index.current = at
        paint(false)
      }
    }
    el.addEventListener('pointerover', over)
    return () => el.removeEventListener('pointerover', over)
  }, [root])

  useButtons(priority, enabled, (btn: Btn) => {
    const list = items(root.current)
    if (btn === 'up' || btn === 'left') {
      if (!list.length) return
      index.current = (index.current - 1 + list.length) % list.length
      sfx.cursor()
      paint(true)
      return
    }
    if (btn === 'down' || btn === 'right') {
      if (!list.length) return
      index.current = (index.current + 1) % list.length
      sfx.cursor()
      paint(true)
      return
    }
    if (btn === 'a') {
      const el = list[index.current]
      if (!el || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return
      el.click()
      return
    }
    if (btn === 'b') {
      if (onBack) {
        sfx.back()
        onBack()
      }
      return
    }
    return false
  })

  return {
    reset: () => {
      index.current = 0
      paint(true)
    },
  }
}

/** Menu row. Keeps the ▶ gutter and plays the select blip. */
export function NavItem({
  children,
  onClick,
  disabled,
  className = '',
  testId,
  tone,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
  testId?: string
  tone?: 'trap' | 'done'
}) {
  return (
    <button
      type="button"
      data-nav=""
      data-testid={testId}
      data-tone={tone}
      aria-disabled={disabled || undefined}
      className={`nav-item ${className}`}
      onClick={() => {
        if (disabled) {
          sfx.bump()
          return
        }
        sfx.select()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
