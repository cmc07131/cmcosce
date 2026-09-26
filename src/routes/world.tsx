import { createFileRoute } from '@tanstack/react-router'
import { WorldView } from '~/world/WorldView'

export const Route = createFileRoute('/world')({
  component: WorldView,
})
