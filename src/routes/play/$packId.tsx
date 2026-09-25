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
      <div className="page justify-center">
        <p className="win">No pack named {packId}.</p>
        <Link to="/gym" className="tap block text-center">
          Back to stations
        </Link>
      </div>
    )
  }
  return <PlayView pack={pack} />
}
