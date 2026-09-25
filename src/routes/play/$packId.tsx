import { Link, createFileRoute } from '@tanstack/react-router'
import { getPack } from '~/engine/loadPacks'
import { PlayView } from '~/game/PlayView'

export const Route = createFileRoute('/play/$packId')({
  component: PlayPage,
})

function PlayPage() {
  const { packId } = Route.useParams()
  const pack = getPack(packId)
  if (!pack) {
    return (
      <div className="game-shell justify-center px-4">
        <p className="font-body text-[28px]">No pack named {packId}.</p>
        <Link to="/gym" className="tap mt-4 block text-center">
          Back to stations
        </Link>
      </div>
    )
  }
  return <PlayView pack={pack} />
}
