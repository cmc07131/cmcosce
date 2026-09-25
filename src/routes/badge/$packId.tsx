import { Link, createFileRoute } from '@tanstack/react-router'
import { getPack } from '~/engine/loadPacks'

export const Route = createFileRoute('/badge/$packId')({
  component: BadgePage,
})

function BadgePage() {
  const { packId } = Route.useParams()
  const pack = getPack(packId)
  if (!pack) {
    return (
      <div className="game-shell justify-center px-4">
        <p className="font-body text-[28px]">No pack named {packId}.</p>
      </div>
    )
  }
  return (
    <div className="game-shell items-center justify-center px-4 text-center">
      <p className="font-pixel text-[8px] text-[#ffb020]">BADGE</p>
      <div className="mt-4 border-4 border-[#ffb020] px-6 py-8">
        <div className="text-[64px] leading-none">{pack.badge.emoji ?? '★'}</div>
        <h1 className="mt-3 font-body text-[40px] leading-none">{pack.badge.name}</h1>
        <p className="mt-3 font-body text-[22px] leading-snug">{pack.badge.flavor}</p>
      </div>
      <Link to="/gym" className="tap mt-6 block text-center" data-testid="back-gyms">
        Back to stations
      </Link>
    </div>
  )
}
