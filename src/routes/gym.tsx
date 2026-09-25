import { Link, createFileRoute } from '@tanstack/react-router'
import { loadPacks } from '~/engine/loadPacks'
import { timeLimitOf } from '~/engine/schema'

export const Route = createFileRoute('/gym')({
  component: GymPage,
})

const TYPE: Record<string, string> = {
  resus: 'Resus',
  exam: 'Exam',
  history: 'History',
  skills: 'Skills',
  teaching: 'Teaching',
}

function GymPage() {
  const hits = loadPacks()
  return (
    <div className="game-shell">
      <header className="px-3 pt-4 pb-2">
        <Link to="/" className="font-pixel text-[8px] text-[#ffb020]">
          OSCE GYM
        </Link>
        <h1 className="font-body text-[40px] leading-none">Stations</h1>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-3 pb-4">
        {hits.map((hit) => {
          if (!hit.ok) {
            return (
              <div key={hit.packId} className="border-2 border-[#ff6b6b] p-3 font-body text-[20px]">
                {hit.packId} failed to load. {hit.error}
              </div>
            )
          }
          const pack = hit.pack
          const minutes = Math.round(timeLimitOf(pack) / 60)
          return (
            <Link
              key={pack.packId}
              to="/play/$packId"
              params={{ packId: pack.packId }}
              className="tap block"
              data-testid={`gym-${pack.packId}`}
            >
              <span className="block text-[28px] leading-none">{pack.title}</span>
              <span className="mt-2 block font-pixel text-[8px] text-[#ffb020]">
                {TYPE[pack.meta.stationType]} · {minutes} min{pack.placeholder ? ' · Placeholder' : ''}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
