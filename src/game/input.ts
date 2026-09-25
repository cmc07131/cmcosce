import { useEffect, useRef } from 'react'
import type { Dir } from '~/engine/schema'

/**
 * One input bus for keyboard, on-screen D-pad and A/B/START/SELECT.
 * Presses go to the highest-priority enabled handler. Held directions drive walking.
 */

export type Btn = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select'

export const BTN_DIR: Partial<Record<Btn, Dir>> = { up: 'n', down: 's', left: 'w', right: 'e' }

type Handler = { priority: number; press: (btn: Btn) => boolean | void }

const handlers = new Set<Handler>()
const held: Record<'key' | 'pad', Dir | null> = { key: null, pad: null }

export function press(btn: Btn) {
  const ordered = [...handlers].sort((a, b) => b.priority - a.priority)
  for (const handler of ordered) {
    if (handler.press(btn) !== false) return
  }
}

export function holdDir(source: 'key' | 'pad', dir: Dir | null) {
  held[source] = dir
}

export function heldDir(): Dir | null {
  return held.key ?? held.pad
}

export function keyToBtn(key: string): Btn | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
    case 'w':
      return 'up'
    case 'arrowdown':
    case 's':
      return 'down'
    case 'arrowleft':
    case 'a':
      return 'left'
    case 'arrowright':
    case 'd':
      return 'right'
    case 'z':
    case 'enter':
    case ' ':
      return 'a'
    case 'x':
    case 'escape':
    case 'backspace':
      return 'b'
    case 'm':
      return 'start'
    case 'shift':
      return 'select'
    default:
      return null
  }
}

let installed = false
const keysDown: Dir[] = []

/** Global keyboard hookup. Safe to call more than once. */
export function installKeyboard() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const btn = keyToBtn(event.key)
    if (!btn) return
    event.preventDefault()
    const dir = BTN_DIR[btn]
    if (dir) {
      if (!keysDown.includes(dir)) keysDown.push(dir)
      holdDir('key', keysDown[keysDown.length - 1] ?? null)
      press(btn)
      return
    }
    if (event.repeat) return
    press(btn)
  })
  window.addEventListener('keyup', (event) => {
    const btn = keyToBtn(event.key)
    if (!btn) return
    event.preventDefault()
    const dir = BTN_DIR[btn]
    if (!dir) return
    const at = keysDown.indexOf(dir)
    if (at >= 0) keysDown.splice(at, 1)
    holdDir('key', keysDown[keysDown.length - 1] ?? null)
  })
  window.addEventListener('blur', () => {
    keysDown.length = 0
    holdDir('key', null)
  })
}

/** Register a button handler while `enabled`. Return false from `onPress` to pass the press down. */
export function useButtons(priority: number, enabled: boolean, onPress: (btn: Btn) => boolean | void) {
  const ref = useRef(onPress)
  ref.current = onPress
  useEffect(() => {
    if (!enabled) return
    const handler: Handler = { priority, press: (btn) => ref.current(btn) }
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }, [priority, enabled])
}
