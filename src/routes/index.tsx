import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getPack } from '~/engine/loadPacks'
import { readLastPackId } from '~/engine/session'

export const Route = createFileRoute('/')({
  component: TitlePage,
})

function TitlePage() {
  const [lastId, setLastId] = useState<string | null>(null)
  useEffect(() => setLastId(readLastPackId()), [])
  const last = lastId ? getPack(lastId) : undefined

  return (
    <div className="game-shell justify-between px-4 py-8">
      <div>
        <p className="font-pixel text-[8px] text-[#ffb020]">HKCEM IEEM</p>
        <h1 className="mt-3 font-body text-[72px] leading-none">OSCE GYM</h1>
        <p className="mt-2 font-body text-[26px] text-[#3a3428]">IEEM OSCE revision</p>
      </div>
      <div className="mb-6 flex flex-col gap-3">
        <div className="h-16 w-full bg-[repeating-linear-gradient(135deg,#f5c542_0_6px,#1a1a1a_6px_12px)]" />
        <Link to="/gym" className="tap block text-center" data-testid="enter-title">
          Enter
        </Link>
        {last && (
          <Link to="/play/$packId" params={{ packId: last.packId }} className="tap block text-center" data-testid="continue">
            Continue · {last.title}
          </Link>
        )}
      </div>
    </div>
  )
}
