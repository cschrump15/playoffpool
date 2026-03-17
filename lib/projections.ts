import { DBGame, DBPick, DBPlayer } from './supabase'
import { ROUND_CONFIG, ROUND_ORDER, maxPossiblePoints } from './bracketData'

export interface PlayerProjection {
  playerId: string
  name: string
  currentPoints: number
  projectedPoints: number
  maxPossiblePoints: number
  chanceOfFirst: number   // softmax probability 0-1
  pendingGames: number
}

/**
 * Calculate projected points for a player.
 * For ungraded picks: award expected value = base points * win_probability
 * (since we don't have real win probabilities here, use seed-based heuristic)
 */
export function projectStandings(
  players: DBPlayer[],
  games: DBGame[],
  picks: DBPick[]
): PlayerProjection[] {
  const gameMap = new Map(games.map(g => [g.id, g]))

  const projections = players.map(player => {
    const playerPicks = picks.filter(p => p.player_id === player.id)
    let current = 0
    let projected = 0
    let maxPossible = 0
    let pending = 0

    for (const pick of playerPicks) {
      const game = gameMap.get(pick.game_id)
      if (!game) continue

      const roundConfig = ROUND_CONFIG[game.round]
      if (!roundConfig) continue

      const maxForGame = roundConfig.basePoints + roundConfig.bonusPoints

      if (pick.points_earned !== null) {
        // Graded
        current += pick.points_earned
        projected += pick.points_earned
        maxPossible += pick.points_earned // can't improve on a graded game
      } else {
        // Ungraded: estimate expected value using seed-based win probability
        const winProb = estimateWinProbability(game, pick.picked_team as 1 | 2)
        const expectedBase = roundConfig.basePoints * winProb
        // Assume ~30% chance of getting spread bonus if winner is correct
        const expectedBonus = roundConfig.bonusPoints * winProb * 0.3
        projected += expectedBase + expectedBonus
        maxPossible += maxForGame
        pending++
      }
    }

    return {
      playerId: player.id,
      name: player.name,
      currentPoints: current,
      projectedPoints: Math.round(projected * 10) / 10,
      maxPossiblePoints: current + maxPossible,
      chanceOfFirst: 0, // filled in below
      pendingGames: pending,
    }
  })

  // Softmax on projected points to get "chance of first"
  const temps = projections.map(p => p.projectedPoints)
  const softmaxDenom = temps.reduce((sum, t) => sum + Math.exp(t / 5), 0)
  projections.forEach(p => {
    p.chanceOfFirst = Math.exp(p.projectedPoints / 5) / softmaxDenom
  })

  return projections.sort((a, b) => b.currentPoints - a.currentPoints)
}

/**
 * Seed-based win probability heuristic.
 * Uses log-odds model: higher seed (lower number) = stronger team.
 */
function estimateWinProbability(game: DBGame, pickedTeam: 1 | 2): number {
  if (game.winner !== null) {
    return game.winner === pickedTeam ? 1 : 0
  }

  const seed1 = game.team1_seed
  const seed2 = game.team2_seed

  // Simple logistic: log(seed2/seed1) scaled
  const logOdds = Math.log(seed2 / seed1) * 0.8
  const prob1 = 1 / (1 + Math.exp(-logOdds))

  return pickedTeam === 1 ? prob1 : 1 - prob1
}

/**
 * Build cumulative score history for Recharts line chart.
 * Returns one entry per graded game (in game_number order).
 */
export interface CumulativeDataPoint {
  gameLabel: string
  round: string
  [playerName: string]: number | string
}

export function buildCumulativeHistory(
  players: DBPlayer[],
  games: DBGame[],
  picks: DBPick[]
): CumulativeDataPoint[] {
  // Only graded games, sorted by round desc then game_number
  const gradedGames = games
    .filter(g => g.winner !== null)
    .sort((a, b) => {
      // Sort by round order first (R64 first), then game_number
      const roundOrder = [64, 32, 16, 8, 4, 2]
      return roundOrder.indexOf(a.round) - roundOrder.indexOf(b.round) || a.game_number - b.game_number
    })

  if (gradedGames.length === 0) return []

  const runningTotals: Record<string, number> = {}
  players.forEach(p => { runningTotals[p.name] = 0 })

  const points: CumulativeDataPoint[] = []

  for (const game of gradedGames) {
    const roundConfig = ROUND_CONFIG[game.round]
    const label = `${roundConfig?.shortLabel ?? game.round} G${game.game_number}`

    for (const player of players) {
      const pick = picks.find(pk => pk.player_id === player.id && pk.game_id === game.id)
      if (pick && pick.points_earned !== null) {
        runningTotals[player.name] += pick.points_earned
      }
    }

    points.push({
      gameLabel: label,
      round: roundConfig?.shortLabel ?? String(game.round),
      ...Object.fromEntries(players.map(p => [p.name, runningTotals[p.name]])),
    })
  }

  return points
}
