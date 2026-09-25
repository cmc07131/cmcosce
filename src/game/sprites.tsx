import type { Dir } from '~/engine/schema'

const skin = '#e2b896'
const hair = '#2a2118'
const coat = '#eef2f6'
const scrub = '#2f6fed'

export function ActorSprite({
  role,
  facing,
  talk,
  frame = 0,
  gloved,
  pose,
}: {
  role: string
  facing: Dir
  talk?: boolean
  frame?: number
  gloved?: boolean
  pose?: string
}) {
  const flip = facing === 'w'
  const back = facing === 'n'
  const mouth = talk ? '#7a3040' : '#c4897a'
  const hand = gloved ? '#7ec8e3' : skin
  const step = frame ? 1 : 0
  if (role === 'patient' && pose === 'knee') {
    return (
      <svg viewBox="0 0 16 16" className="pixelated h-full w-full">
        <rect x="2" y="6" width="12" height="4" fill="#f2c9d4" />
        <rect x="2" y="4" width="3" height="3" fill={skin} />
        <rect x="1" y="10" width="3" height="4" fill={skin} />
        <rect x="11" y="10" width="3" height="4" fill={skin} />
      </svg>
    )
  }
  if (role === 'patient' && pose === 'lateral') {
    return (
      <svg viewBox="0 0 16 16" className="pixelated h-full w-full">
        <rect x="2" y="6" width="10" height="5" fill="#f2c9d4" />
        <rect x="11" y="5" width="4" height="4" fill={skin} />
        <rect x="3" y="11" width="4" height="2" fill={skin} />
      </svg>
    )
  }
  if (role === 'patient') {
    return (
      <svg viewBox="0 0 16 16" className="pixelated h-full w-full">
        <rect x="3" y="1" width="10" height="4" fill="#5c3a3a" />
        <rect x="5" y="3" width="6" height="3" fill={skin} />
        <rect x="6" y="4" width="1" height="1" fill="#2a2118" />
        <rect x="9" y="4" width="1" height="1" fill="#2a2118" />
        <rect x="7" y="6" width="2" height="1" fill={mouth} />
        <rect x="4" y="7" width="8" height="6" fill="#f2c9d4" />
        <rect x="5" y="9" width="6" height="3" fill="#e7a8ba" />
        <rect x="2" y="8" width="2" height="4" fill={skin} />
        <rect x="12" y="8" width="2" height="4" fill={skin} />
      </svg>
    )
  }
  const shirt = role === 'nurse' ? '#1f8a7a' : role === 'partner' ? '#c47b4a' : role === 'examiner' ? coat : scrub
  const top = role === 'examiner' || role === 'doctor' ? coat : shirt
  return (
    <svg viewBox="0 0 16 16" className="pixelated h-full w-full" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <rect x="4" y="1" width="8" height="3" fill={hair} />
      <rect x="5" y="3" width="6" height="3" fill={back ? hair : skin} />
      {!back && <rect x="6" y="4" width="1" height="1" fill="#24180f" />}
      {!back && <rect x="9" y="4" width="1" height="1" fill="#24180f" />}
      {!back && <rect x="7" y="5" width="2" height="1" fill={mouth} />}
      <rect x="4" y="7" width="8" height="6" fill={top} />
      <rect x="7" y="8" width="2" height="4" fill={shirt} />
      <rect x="3" y="8" width="2" height="4" fill={hand} />
      <rect x="11" y="8" width="2" height="4" fill={hand} />
      <rect x={5 + step} y="13" width="2" height="3" fill="#243044" />
      <rect x={9 - step} y="13" width="2" height="3" fill="#243044" />
      {facing === 'e' && <rect x="12" y="4" width="2" height="1" fill={skin} />}
      {facing === 's' && <rect x="7" y="6" width="2" height="1" fill={skin} />}
    </svg>
  )
}

export function PropArt({ kind }: { kind: string }) {
  if (kind === 'wall') return <div className="h-full w-full" style={{ background: '#d7dcc8', boxShadow: 'inset 0 -3px 0 #8a9078' }} />
  if (kind === 'bed') {
    return (
      <div className="h-full w-full" style={{ background: '#8d99ae' }}>
        <div className="absolute inset-[12%] bg-[#e7edf2]" />
        <div className="absolute left-[16%] top-[16%] h-[18%] w-[22%] bg-[#c5d0da]" />
      </div>
    )
  }
  if (kind === 'monitor') {
    return (
      <div className="h-full w-full bg-[#1b2430]">
        <div className="absolute inset-x-[15%] top-[18%] h-[48%] bg-[#07140c]">
          <div className="absolute bottom-[30%] left-[10%] right-[10%] h-[3px] bg-[#37f08a]" />
        </div>
      </div>
    )
  }
  if (kind === 'trolley' || kind === 'shelf') {
    return (
      <div className="h-full w-full" style={{ background: kind === 'shelf' ? '#6b4a2e' : '#9aa4b2' }}>
        <div className="absolute inset-x-[10%] top-[18%] h-[18%] bg-[#d5dbe3]" />
        <div className="absolute inset-x-[10%] top-[42%] h-[18%] bg-[#c3cbd6]" />
        <div className="absolute bottom-[8%] left-[18%] h-[10%] w-[14%] rounded-full bg-[#222]" />
        <div className="absolute bottom-[8%] right-[18%] h-[10%] w-[14%] rounded-full bg-[#222]" />
      </div>
    )
  }
  if (kind === 'phone') {
    return (
      <div className="h-full w-full bg-[#243044]">
        <div className="absolute left-[28%] top-[22%] h-[56%] w-[44%] bg-[#d7e2ea]" />
        <div className="absolute left-[36%] top-[30%] h-[8%] w-[28%] bg-[#243044]" />
      </div>
    )
  }
  if (kind === 'door') {
    return (
      <div className="h-full w-full bg-[#6e5338]">
        <div className="absolute inset-[15%] bg-[#c9a27a]" />
        <div className="absolute right-[22%] top-[48%] h-[8%] w-[8%] bg-[#3a2a18]" />
      </div>
    )
  }
  if (kind === 'hazard') {
    return (
      <div
        className="h-full w-full"
        style={{
          background: 'repeating-linear-gradient(135deg, #f5c542 0 4px, #1a1a1a 4px 8px)',
        }}
      />
    )
  }
  if (kind === 'desk' || kind === 'chart') {
    return <div className="h-full w-full bg-[#6b4a2e]" />
  }
  return <div className="h-full w-full bg-[#334155]" />
}
