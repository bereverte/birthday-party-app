import { Card } from '../../components/ui/Card'
import { EmojiAvatar } from '../../components/ui/EmojiAvatar'
import { friendlyError } from '../../lib/errors'
import { Podium } from '../leaderboard/Podium'
import { Ranking } from '../leaderboard/Ranking'
import { useLeaderboard } from '../leaderboard/useLeaderboard'

// The end of the party: winner, podium and the full global ranking
// (DECISIONS 035). Shared by the guest screen and the host panel.
// Switching the phase to "finished" is the reveal, for everyone at once.
export function FinalResults({ meId }: { meId?: string }) {
  const ranking = useLeaderboard()

  if (!ranking.data) {
    return (
      <p className="font-display text-xl font-semibold">
        {ranking.error ? friendlyError(ranking.error) : 'Comptant tots els punts…'}
      </p>
    )
  }

  const ranks = ranking.data
  const winners = ranks.filter((r) => r.rank === 1 && r.total > 0)
  const iWon = !!meId && winners.some((w) => w.playerId === meId)

  return (
    <>
      <Card tone="party" className="flex animate-pop flex-col items-center gap-4 py-6 text-center">
        <span className="animate-float text-6xl" aria-hidden>
          🏆
        </span>
        {winners.length === 0 ? (
          <h1 className="text-3xl font-bold">S’ha acabat la festa!</h1>
        ) : (
          <>
            <p className="font-bold opacity-85">{winners.length > 1 ? 'Empat al primer lloc!' : 'Guanya la festa'}</p>
            <div className="flex flex-wrap justify-center gap-4">
              {winners.map((w) => (
                <div key={w.playerId} className="flex flex-col items-center gap-2">
                  <div className="rounded-full bg-paper p-1">
                    <EmojiAvatar emoji={w.emoji} seed={w.playerId} size="lg" />
                  </div>
                  <p className="font-display text-2xl leading-tight font-bold">{w.name}</p>
                </div>
              ))}
            </div>
            <p className="text-xl font-bold tabular-nums">{winners[0].total} punts</p>
            {iWon && <p className="text-lg">Has guanyat! 🎉 Ves a buscar el premi.</p>}
          </>
        )}
      </Card>

      {ranks.length > 1 && (
        <div className="mt-4">
          <Podium ranks={ranks} />
        </div>
      )}

      <section className="mt-4 flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold">Rànquing final</h2>
          <p className="text-ink-soft">Quiz + proves + show</p>
        </div>
        <Ranking ranks={ranks} limit={ranks.length} meId={meId} />
      </section>

      <p className="mt-4 text-center font-bold text-ink-soft">Gràcies per vindre. Ara toca el pastís 🎂</p>
    </>
  )
}
