import { SAVE_VERSION, timeLimitOf, type Pack, type Session } from './schema'

const LAST_KEY = 'osce-gym:last'

export function sessionKey(packId: string) {
  return `osce-gym:v${SAVE_VERSION}:${packId}`
}

export function freshSession(pack: Pack): Session {
  return {
    saveVersion: SAVE_VERSION,
    packId: pack.packId,
    startedAt: Date.now(),
    entered: false,
    secondsLeft: timeLimitOf(pack),
    position: { ...pack.room.playerStart, facing: 'n' },
    inventory: [],
    earnedMarks: [],
    spent: {},
    log: [],
    ended: null,
    scene: [],
  }
}

export function readSession(packId: string): Session | null {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(sessionKey(packId))
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Session
    if (data.saveVersion !== SAVE_VERSION || data.packId !== packId) return null
    if (!data.position || !Array.isArray(data.earnedMarks) || !Array.isArray(data.log)) return null
    if (!Array.isArray(data.scene)) data.scene = []
    return data
  } catch {
    return null
  }
}

export function writeSession(session: Session) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(sessionKey(session.packId), JSON.stringify(session))
  sessionStorage.setItem(LAST_KEY, session.packId)
}

export function clearSession(packId: string) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(sessionKey(packId))
}

export function readLastPackId(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const id = sessionStorage.getItem(LAST_KEY)
  if (!id) return null
  const session = readSession(id)
  if (!session || session.ended) return null
  return id
}
