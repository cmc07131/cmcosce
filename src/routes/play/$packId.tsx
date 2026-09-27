import { Link, createFileRoute } from '@tanstack/react-router'
import { loadPack } from '~/engine/loadPacks'
import { PlayView } from '~/game/PlayView'

export const Route = createFileRoute('/play/$packId')({
  loader: ({ params }) => loadPack(params.packId),
  pendingComponent: Opening,
  component: PlayPage,
})

export function Opening() {
  return (
    <div className="page justify-center">
      <p className="win text-center">Opening the station…</p>
    </div>
  )
}

function PlayPage() {
  const { packId } = Route.useParams()
  const hit = Route.useLoaderData()
  if (!hit.ok) {
    return (
      <div className="page justify-center">
        <p className="win">
          Station {packId} did not load. {hit.error}
        </p>
        <Link to="/gym" className="tap block text-center">
          Back to stations
        </Link>
      </div>
    )
  }
  return <PlayView pack={hit.pack} />
}
