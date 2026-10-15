import type { ReactNode } from 'react'

/**
 * What you draw on the teaching-room whiteboard as you teach: a picture a station names as `board:<id>`. Drawn here,
 * in marker colours, in our own words.
 */

const INK = '#1f3f8f'
const RED = '#c0392b'
const GREEN = '#1e8449'

type BoardDef = { title: string; draw: () => ReactNode }

/** A box of text at (x, y), `w` wide, one line per entry; the first line bold. */
function Box({ x, y, w, lines, color = INK }: { x: number; y: number; w: number; lines: string[]; color?: string }) {
  const h = 10 + lines.length * 11
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#ffffff" stroke={color} strokeWidth="1.6" />
      {lines.map((line, i) => (
        <text key={i} x={x + 7} y={y + 15 + i * 11} fontSize="9" fill={color} fontWeight={i === 0 ? 700 : 400}>
          {line}
        </text>
      ))}
    </g>
  )
}

function Arrow({ x1, y1, x2, y2, label, color = INK }: { x1: number; y1: number; x2: number; y2: number; label?: string; color?: string }) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const head = (s: number) => `${x2 - 6 * Math.cos(a + s)},${y2 - 6 * Math.sin(a + s)}`
  return (
    <g stroke={color} strokeWidth="1.6" fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polyline points={`${head(0.45)} ${x2},${y2} ${head(-0.45)}`} />
      {label && (
        <text x={y1 === y2 ? Math.min(x1, x2) + 3 : x1 + 4} y={y1 === y2 ? y1 - 4 : (y1 + y2) / 2 + 3} fontSize="9" fill={color} stroke="none" fontWeight={700}>
          {label}
        </text>
      )}
    </g>
  )
}

const BOARDS: Record<string, BoardDef> = {
  ccr: {
    title: 'Whiteboard: the Canadian C-spine Rule',
    draw: () => (
      <svg viewBox="0 0 330 330" className="block h-auto w-full" fontFamily="Arial, Helvetica, sans-serif" role="img" aria-label="The Canadian C-spine Rule as three questions">
        <rect x="1" y="1" width="328" height="328" rx="6" fill="#fbfbf8" stroke="#9aa4ad" strokeWidth="2" />
        <text x="12" y="20" fontSize="11" fontWeight={700} fill={INK}>
          Canadian C-spine Rule
        </text>
        <text x="12" y="33" fontSize="8.5" fill={INK}>
          For alert (GCS 15), stable adults with a possible neck injury
        </text>
        <Box x={12} y={44} w={196} lines={['1. Any high-risk factor?', '• age 65 or over', '• a dangerous mechanism', '• tingling or numbness in the limbs']} />
        <Arrow x1={208} y1={70} x2={250} y2={70} label="yes" color={RED} />
        <Box x={252} y={56} w={66} lines={['Image', 'CT C-spine']} color={RED} />
        <Arrow x1={60} y1={98} x2={60} y2={114} label="no" />
        <Box x={12} y={116} w={196} lines={['2. Any low-risk factor, safe to test?', '• simple rear-end collision', '• sitting up in the department', '• walking at any time', '• neck pain came on later', '• no midline tenderness']} />
        <Arrow x1={208} y1={150} x2={250} y2={150} label="none" color={RED} />
        <Box x={252} y={136} w={66} lines={['Image', 'CT C-spine']} color={RED} />
        <Arrow x1={60} y1={192} x2={60} y2={208} label="yes" />
        <Box x={12} y={210} w={196} lines={['3. Can they turn the head', '45° to the left and to the right?']} />
        <Arrow x1={208} y1={224} x2={250} y2={224} label="no" color={RED} />
        <Box x={252} y={210} w={66} lines={['Image', 'CT C-spine']} color={RED} />
        <Arrow x1={60} y1={243} x2={60} y2={259} label="yes" color={GREEN} />
        <Box x={12} y={261} w={196} lines={['Cleared clinically', 'no imaging; collar off']} color={GREEN} />
        <text x="12" y="312" fontSize="7.5" fill={INK}>
          Dangerous: fall from 1 m or 5 stairs; a blow down on the head (diving); high-speed,
        </text>
        <text x="12" y="322" fontSize="7.5" fill={INK}>
          rollover or ejection crash; motorised recreational vehicle; bicycle collision.
        </text>
      </svg>
    ),
  },
}

export function boardById(id: string): BoardDef | null {
  return BOARDS[id] ?? null
}

export function Board({ id }: { id: string }) {
  const board = boardById(id)
  if (!board) return <p className="menu-note">No whiteboard named {id}.</p>
  return (
    <div className="film-frame" data-kind="board" style={{ background: '#fbfbf8' }}>
      {board.draw()}
    </div>
  )
}
