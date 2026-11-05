import type { RealtimeStatus } from '../../hooks/useRealtimeRefetch'

const labels: Record<RealtimeStatus, string> = {
  connecting: 'Connectant…',
  live: 'En directe',
  reconnecting: 'Reconnectant…',
}

// Shows guests whether their phone is receiving live updates.
export function StatusPill({ status }: { status: RealtimeStatus }) {
  const live = status === 'live'
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs font-bold shadow-card"
    >
      <span className={`size-2 rounded-full ${live ? 'animate-pulse bg-mint' : 'bg-sun'}`} />
      {labels[status]}
    </span>
  )
}
